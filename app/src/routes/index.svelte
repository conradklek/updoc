<svelte:window bind:innerWidth={innerWidth} />
<script>
    import "../app.css"
    import { onMount } from "svelte"
    import { app } from "$lib/stores" 
    import { Pane, Splitpanes } from "svelte-splitpanes"
    import { Auth, Data, Code, icons } from "$lib/components"
    let flat = (data, list = [], path = []) => {
        if (!data) return list
        for (let item of data) {
            list.push(item)
            item.path = path.concat(item.name)
            if (item.kind === "directory") flat(item.data, list, item.path)
        }
        return list
    }
    $: data = $app && $app[0] ? flat($app) : null
    $: view = null
    let save = () => {
        let loop = (data, copy = []) => {
            for (let item of data) {
                if (item.kind === "file") copy.push({ name: item.name, kind: item.kind, data: item.data, path: item.path })
                else copy.push({ name: item.name, kind: item.kind, data: loop(item.data), path: item.path, open: item.open || false })
            }
            return copy
        }
        let data = loop($app[0].data)
        app.patch($app[0].id, { data })
        $app.save = false
        $app = $app
    }
    let chan = new BroadcastChannel("host")
    chan.onmessage = e => {
        let { type } = e.data
        if (type === "init" && $app[0]) chan.postMessage({ type: "load", data: $app })
    }
    $: innerWidth = 0
    onMount(() => {
        if (data?.find(i => i.view)) view.src = data.find(i => i.view).path.join("/").slice(0, -3)
    })
</script>

{#if $app[0]}
<main id=root>
    <header>
        <div id=head>
            <button disabled={!$app.save} on:click={save}>
                <span>
                    {@html icons["floppy-disk"]}
                </span>
            </button>
            <button>
                <span>
                    {@html icons["gear"]}
                </span>
            </button>
            <button>
                <span>
                    {@html icons["earth"]}
                </span>
            </button>
        </div>
    </header>
    <article>
        <Splitpanes>
            <Pane size={10}>
                <div id=book>
                    <Data on:view={(e) => { if (view && data) view.src = "/" + e.detail.path.join("/").slice(0, -3) }} />
                </div>
            </Pane>
            <Pane>
                <Splitpanes horizontal={innerWidth < 568 ? true : false}>
                    <Pane>
                        <div id=code>
                            {#each data.filter(i => i.name.endsWith(".md") || i.name.endsWith(".html") || i.name.endsWith(".css") || i.name.endsWith(".js") || i.name.endsWith(".json") || i.name.endsWith(".txt")) as item (item.path.join("/"))}
                            <Code {item} on:code={() => { chan.postMessage({ type: "load", data: $app })}} />
                            {/each}
                        </div>
                    </Pane>
                    <Pane>
                        <iframe title=page id=page bind:this={view} />
                    </Pane>
                </Splitpanes>
            </Pane>
        </Splitpanes>
    </article>
</main>
{:else}
<Auth />
{/if}