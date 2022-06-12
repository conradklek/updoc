<svelte:head>
    <script src="/browser/diffDOM.js"></script>
    <script id=script></script>
    <style id=style></style>
</svelte:head>
<script context="module">
    export async function load({ params }) { return { props: { path: `${params.path}.md` } }}
</script>
<script>
    export let path = []
    import "../app.css"
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
    $: walk = (tree, seed = { tags: { ...Markdoc.tags }, nodes: { ...Markdoc.nodes }, functions: { ...Markdoc.functions }, variables: {}, partials: {} }) => {
        try {
            if (!seed.variables) seed.variables = tree.attributes.frontmatter ? { ...seed.variables, ...yaml.load(tree.attributes.frontmatter) } : seed.variables
            else seed.variables = tree.attributes.frontmatter ? { ...yaml.load(tree.attributes.frontmatter), ...seed.variables } : seed.variables
            for (let node of tree.walk()) {
                if (node?.tag === "partial") {
                    let file = list.find(i => i.path.slice(1).join("/") === node.attributes.file)
                    if (file) seed.partials[file.path.slice(1).join("/")] = walk(Markdoc.parse(file.data))[0]
                } else if (node?.tag) {
                    if (!seed.tags[node.tag]) seed.tags[node.tag] = { render: node.tag, attributes: { ...node.attributes } }
                    else { seed.tags[node.tag].attributes = { ...seed.tags[node.tag].attributes, ...node.attributes } }
                }
            }
            let root = Markdoc.transform(tree, seed)
            let loop = (node) => {
                if (node?.children) { 
                    for (let child of node.children) {
                        if (typeof child === "number") node.children[node.children.indexOf(child)] = child.toString()
                        else loop(child)
                    }
                }
            }
            loop(root)
            let html = Markdoc.renderers.html(root)
            return [tree, root, html, seed]
        } catch (e) { console.log(e) }
    }
    $: page = null
    $: tree = null
    $: if (item) { try { tree = walk(Markdoc.parse(item.data)) } catch (e) { console.log(e) } }
    let diff
    let chan = new BroadcastChannel("host")
    chan.onmessage = e => {
        if (e.data.type === "load" && page) {
            let temp = page.outerHTML
            app.set(e.data.data)
            queueMicrotask(() => {
                let dom = new DOMParser().parseFromString(temp, "text/html").body.firstChild
                let all = Array.from(dom.querySelectorAll("*"))
                let arr = Array.from(page.querySelectorAll("*"))
                arr = arr.filter(i => !all[arr.indexOf(i)].isEqualNode(i))
                if (arr.length) window.scrollTo(arr[0].offsetLeft, arr[0].offsetTop)
            })
        }
        if (e.data.type === "set") {
            tree[3].variables[e.data.key] = e.data.val
            let leaf = walk(Markdoc.parse(item.data), tree[3])[2]
            diff.apply(page, diff.diff(tree[2], leaf))
        }
    }
    onMount(() => { 
        diff = new diffDOM.DiffDOM()
        !$app[0] && chan.postMessage({ type: "init" })
    })
    $: if (item && tree) {
        try {
            let meta = []
            if (item.path.length === 2) for (let file of list.filter(i => (i.name.endsWith(".css") || i.name.endsWith(".js")) && i.path.length === 2)) meta.push(file)
            else for (let file of list.filter(i => (i.name.endsWith(".css") || i.name.endsWith(".js")) && (i.path[1] === item.path[1] || i.path.length === 2))) meta.push(file)
            let str = `\
var host = new BroadcastChannel("host")
var _ = ${JSON.stringify(tree[3].variables)}
var $ = new Proxy(_, { get(obj, key) {
queueMicrotask(() => host.postMessage({ type: "set", key, val: obj[key] }))
return obj[key]}})\n` + meta.filter(i => i.name.endsWith(".js")).map(i => i.data).join("\n")
            document.head.removeChild(document.head.querySelector("#script"))
            const script = document.createElement("script")
            script.id = "script"
            script.textContent = str
            document.head.appendChild(script)
            let styles = meta.filter(i => i.name.endsWith(".css")).map(i => i.data).join("\n")
            let reg = /@apply\s*([^;]+);/g
            let matches = []
            let match
            while ((match = reg.exec(styles)) !== null) matches.push(...match[1].split(" "))
            let classes = [...new Set(matches)]
            let css = postcss([postcssNested, postcssApply]).process(generateStyles(tree[2] + "<div class='" + classes.join(" ") + "'><\/div>") + styles).css
            document.querySelector("#style").textContent = css
        } catch (e) { console.log(e) }
    }
</script>

<article id=page bind:this={page} class="prose prose-slate prose-sm md:prose lg:prose-lg">
    {#if tree}
        {@html tree[2].slice(9, -10)}
    {/if}
</article>