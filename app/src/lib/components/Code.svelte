<script>
    import { onMount } from "svelte"
    import { app } from "$lib/stores"
    import { EditorState, basicSetup } from "@codemirror/basic-setup"
    import { indentWithTab } from "@codemirror/commands"
    import { EditorView, keymap } from "@codemirror/view"
    import { markdown } from "@codemirror/lang-markdown"
    import { javascript } from "@codemirror/lang-javascript"
    import { html } from "@codemirror/lang-html"
    import { css } from "@codemirror/lang-css"
    import { json } from "@codemirror/lang-json"
    import { createEventDispatcher } from "svelte"
    const dispatch = createEventDispatcher()
    export let item
    $: node = null
    $: code = null
    onMount(() => {
        if (code) code.destroy()
        let lang = null
        switch (item.name.split(".").at(-1)) {
            case "html": lang = html();     break
            case "css": lang = css();       break
            case "js": lang = javascript(); break
            case "json": lang = json();     break
            case "md": lang = markdown();   break
            default: break
        }
        code = new EditorView({
            parent: node,
            state: EditorState.create({ 
                    doc: item.data, 
                    extensions: [ basicSetup, lang, EditorView.lineWrapping, keymap.of([indentWithTab]),
                    EditorView.updateListener.of((v) => {
                        if (v.docChanged) {
                            item.data = v.state.doc.toString()
                            $app.save = true
                            $app = $app
                            dispatch("code")
                        }
                    })
                ]
            })
        })
        $app = $app
    })
</script>

<div class:hidden={!item.view} bind:this={node} />