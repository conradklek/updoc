<script>
    import "../app.css"
    import { app } from "$lib/stores"
    import { Auth, Main } from "$lib/components"
    let chan = new BroadcastChannel("host")
    chan.onmessage = e => {
        let { type } = e.data
        if (type === "init" && $app[0]) chan.postMessage({ type: "load", data: $app })
    }
</script>

{#if $app[0]?.data?.length}
<Main on:code={() => { chan.postMessage({ type: "load", data: $app })}} on:view={(e) => { chan.postMessage({ type: "view", data: e.detail })}}/>
{:else}
<Auth />
{/if}