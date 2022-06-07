<svelte:head>
    <script src="/browser/diffDOM.js"></script>
    <script id=script></script>
    {#if tree}{#await css then styles}
    {@html `<style>${styles}<\/style>`}
    {/await}{/if}
</svelte:head>
<script context="module">
    export async function load({ params }) { return { props: { path: `${params.path}.md` } }}
</script>
<script>
    export let path = []
    import "../blank.css"
    import { onMount } from "svelte"
    import { app } from "$lib/stores"
    import Markdoc from "@markdoc/markdoc"
    import yaml from "js-yaml"
    import postcss from "postcss"
    import postcssNested from "postcss-nested"
    import postcssApply from "postcss-class-apply/dist/index"
    import { Processor } from "windicss/lib"
    import { HTMLParser } from "windicss/utils/parser"
    function generateStyles(html) {
        const processor = new Processor()
        const htmlClasses = new HTMLParser(html).parseClasses().map(i => i.result).join(' ')
        const preflightSheet = processor.preflight(html)
        const interpretedSheet = processor.interpret(htmlClasses).styleSheet
        const MINIFY = true
        const APPEND = false
        const styles = interpretedSheet.extend(preflightSheet, APPEND).build(MINIFY)
        return styles
    }
    $: flat = (data, list = []) => { if (!data) return; for (let item of data) { list.push(item); if (item.kind === "directory") flat(item.data, list) } return list }
    $: list = flat($app)
    $: item = list[0] ? list.find(i => i.path.join("/") === path) || null : null
    $: loop = (node) => {
        if (node?.children) { for (let child of node.children) {
            if (typeof child === "number") node.children[node.children.indexOf(child)] = child.toString()
            else loop(child)
        }}
    }
    $: walk = (tree, path, seed = { tags: { ...Markdoc.tags }, nodes: { ...Markdoc.nodes }, functions: { ...Markdoc.functions }, variables: null, partials: {}, style: {}, script: {} }) => {
        try {
            if (!seed.variables) seed.variables = tree.attributes.frontmatter ? { ...seed.variables, ...yaml.load(tree.attributes.frontmatter) } : seed.variables
            else seed.variables = tree.attributes.frontmatter ? { ...yaml.load(tree.attributes.frontmatter), ...seed.variables } : seed.variables
            for (let node of tree.walk()) {
                if (node) {
                    if (node.tag === "partial") {
                        let file = list.find(i => i.path.slice(1).join("/") === node.attributes.file)
                        if (file) seed.partials[file.path.slice(1).join("/")] = walk(Markdoc.parse(file.data), file.path.slice(1).join("/"), seed)[0]
                    } else {
                        if (!seed.tags[node.tag]) seed.tags[node.tag] = { render: node.tag, attributes: { ...node.attributes } }
                        else { seed.tags[node.tag].attributes = { ...seed.tags[node.tag].attributes, ...node.attributes } }
                        if (node.tag === "style" || node.tag === "script") {
                            if (node.attributes.src) {
                                let file = list.find(i => i.path.slice(1).join("/") === node.attributes.src)
                                if (file) {
                                    seed[node.tag][path] = seed[node.tag][path] ? [...seed[node.tag][path], file.data] : [file.data]
                                    node.tag = undefined
                                }
                            } else {
                                let loop = (node, list = []) => {
                                    for (let child of node.walk()) { if (child?.attributes.content) list.push(child.attributes.content) }
                                    return list.join(" ")
                                }
                                seed[node.tag][path] = seed[node.tag][path] ? [...seed[node.tag][path], loop(node)] : [loop(node)]
                                node.tag = undefined
                            }
                            node.children = []
                        }
                    }
                }
            }
            let root = Markdoc.transform(tree, seed)
            loop(root)
            return [tree, root, seed]
        } catch (e) {}
    }
    $: tree = null
    $: if (item) { try { tree = walk(Markdoc.parse(item.data), path) } catch (e) { console.log(e) } }
    $: html = ""
    $: page = null
    $: temp = ""
    $: style = async (css) => {
        try { 
            let styles = [Object.values(tree[2].style)].flat().flat().join("\n")
            let reg = /@apply\s*([^;]+);/g
            let matches = []
            let match
            while ((match = reg.exec(styles)) !== null) matches.push(...match[1].split(" "))
            let classes = [...new Set(matches)]
            let text = Markdoc.renderers.html(tree[1])
            reg = /\${([^}]+)}/g
            match = null
            while ((match = reg.exec(text)) !== null) text = text.replace(match[0], eval(match[1]))
            html = text
            return temp = postcss([postcssNested, postcssApply]).process(generateStyles(html + "<div class='" + classes.join(" ") + "'><\/div>") + css).css 
        } 
        catch (e) { return temp }
    }
    $: css = tree ? style([Object.values(tree[2].style)].flat().flat().join("\n")) : null
    let chan = new BroadcastChannel("host")
    chan.onmessage = e => { (e.data.type === "load") && app.set(e.data.data) }
    let diff
    onMount(() => { 
        diff = new diffDOM.DiffDOM()
        !$app[0] && chan.postMessage({ type: "init" })
    })
    $: init = true
    $: script = null
    $: if (init && tree && page) {
        init = false
        document.$ = tree[2].variables
        script = document.createElement("script")
        script.id = "script"
        script.textContent = "var $ = document.$"
        document.head.appendChild(script)
    }
    $: if (tree && page) document.$ = tree[2].variables
    $: if (!init && tree && page) {
        try {
            document.head.removeChild(script)
            script = document.createElement("script")
            script.id = "script"
            script.textContent = `var $ = document.$;\n${[Object.values(tree[2].script)].flat().flat().join("\n")}`
            document.head.appendChild(script)
            let seed = { ...tree[2], variables: { ...tree[2].variables, ...document.$ }}
            let root = item ? Markdoc.transform(Markdoc.parse(item.data), seed) : null
            let body = root ? walk(Markdoc.parse(item.data), path, seed) : null
            let text = body ? Markdoc.renderers.html(body[1]) : null
            if (diff.diff(html, text)[0]) {
                let reg = /\${([^}]+)}/g
                let match
                while ((match = reg.exec(text)) !== null) text = text.replace(match[0], eval(match[1]))
                diff.apply(page, diff.diff(html, text))
            }
        } catch (e) { console.log(e) }
    }
    setTimeout(async () => { 
        if (!tree && $app[0]?.path[0] !== path.split("/")[0]) {
            let name = path.split("/")[0]
            let data = await app.get(name)
            let user = [{ name, path: [name], kind: "directory", data }]
            app.set(user)
        }
    }, 100)
</script>
<article id=page bind:this={page} class="prose prose-slate" on:click={() => page = page} on:keydown={() => page = page} on:keyup={() => page = page}>
    {@html html.slice(9, -10)}
</article>