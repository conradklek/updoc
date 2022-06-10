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

    $: flat = (data, list = []) => { if (!data) return; for (let item of data) { list.push(item); if (item.kind === "directory") flat(item.data, list) } return list }
    $: list = flat($app)
    $: item = list[0] ? list.find(i => i.path.join("/") === path) || null : null
    $: walk = (tree, seed = { tags: { ...Markdoc.tags }, nodes: { ...Markdoc.nodes }, functions: { ...Markdoc.functions }, variables: null, partials: {} }) => {
        try {
            if (!seed.variables) seed.variables = tree.attributes.frontmatter ? { ...seed.variables, ...yaml.load(tree.attributes.frontmatter) } : seed.variables
            else seed.variables = tree.attributes.frontmatter ? { ...yaml.load(tree.attributes.frontmatter), ...seed.variables } : seed.variables
            for (let node of tree.walk()) {
                if (node?.tag === "partial") {
                    let file = list.find(i => i.path.slice(1).join("/") === node.attributes.file)
                    if (file) seed.partials[file.path.slice(1).join("/")] = walk(Markdoc.parse(file.data), seed)[0]
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
    $: tree = null
    $: if (item) { try { tree = walk(Markdoc.parse(item.data)) } catch (e) { console.log(e) } }
    
    let chan = new BroadcastChannel("host")
    chan.onmessage = e => {
        console.log(e.data)
        if (e.data.type === "load") app.set(e.data.data)
        if (e.data.type === "set") {
            
        }
    }
    onMount(() => !$app[0] && chan.postMessage({ type: "init" }))

    $: init = true
    $: if (item && tree && init) {
        init = false
        let meta = []
        if (item.path.length === 2) for (let file of list.filter(i => (i.name.endsWith(".css") || i.name.endsWith(".js")) && i.path.length === 2)) meta.push(file)
        else for (let file of list.filter(i => (i.name.endsWith(".css") || i.name.endsWith(".js")) && (i.path[1] === item.path[1] || i.path.length === 2))) meta.push(file)
        console.clear()
        console.log(tree[0])
        console.log(tree[1])
        console.log(tree[3])
        console.log(meta)
        let script = document.createElement("script")
        script.innerHTML = `\
        var host = new BroadcastChannel("host")
        var _ = ${JSON.stringify(tree[3].variables)}
        var $ = new Proxy(_, { get(obj, key) {
                queueMicrotask(() => host.postMessage({ type: "set", key, val: obj[key] }))
                return obj[key]
        }})`
        document.head.appendChild(script)
    }
</script>

<article id=page class="prose prose-slate prose-sm md:prose lg:prose-lg">
    {#if tree}{@html tree[2].slice(9, -10)}{/if}
</article>