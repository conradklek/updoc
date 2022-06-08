<script>
    import "../app.css"
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
                if (item.kind === "file") copy.push({ name: item.name, kind: item.kind, data: item.data, path: item.path, view: item.view || false })
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
</script>

{#if $app[0]}
<Splitpanes theme="no-splitter" horizontal dblClickSplitter={false}>
	<Pane size="10" minSize="10" maxSize="10">
		<div id=head>
            <label for=find>
                <span>
                    {@html icons["find"]}
                </span>
                <input name=find id=find type=text placeholder="Search..." />
            </label>
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
        </div>
    </Pane>
	<Pane>
		<Splitpanes>
			<Pane>
				<div id=book>
                    <Data on:view={(e) => { 
                        console.clear()
                        console.log(e.detail)
                        console.log(view)
                        if (view && data) view.src = "/" + e.detail.path.join("/").slice(0, -3)
                    }} />
                </div>
            </Pane>
			<Pane>
				<div id=code>
                    {#each data.filter(i => i.name.endsWith(".md") || i.name.endsWith(".html") || i.name.endsWith(".css") || i.name.endsWith(".js") || i.name.endsWith(".json")) as item (item.path.join("/"))}
                    <Code {item} on:code={() => { chan.postMessage({ type: "load", data: $app })}} />
                    {/each}
                </div>
            </Pane>
			<Pane>
				<div id=view>
                    <iframe title=view bind:this={view} />
                </div>
            </Pane>
		</Splitpanes>
	</Pane>
</Splitpanes>
{:else}
    <Auth />
{/if}