<script>
    import { app } from "$lib/stores"
    import { clickOutside } from "./actions"
    import { createEventDispatcher } from "svelte"
    import { Book, icons } from "$lib/components"
    const dispatch = createEventDispatcher()
    $app[0].open = true
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
    $: each = []
    let open = (e, item) => {
        if (e.shiftKey && each.length) {
            let i1 = data.indexOf(each[0])
            let i2 = data.indexOf(item)
            if (i1 > i2) {
                for (let i = i1; i >= i2; i--) 
                    if (!each.includes(data[i])) each.push(data[i])
            } else {
                for (let i = i1; i <= i2; i++) 
                    if (!each.includes(data[i])) each.push(data[i])
            }
            return each = each.filter(i => i.path.slice(0, -1).join("/") === item.path.slice(0, -1).join("/"))
        } else each = [item]
        
        if (item.kind === "directory") {
            item.open = item.open ? false : true
        } else {
            let same = data.find(i => i.view)
            if (same) { if (same?.path.join("/") !== item.path.join("/")) same.view = false }
            item.view = !item.view || false
            if (item.view && !item.name.startsWith("_") && item.name.endsWith(".md") && item.kind === "file") {
                dispatch("view", item)
            }
        }
        $app = $app
    }
    let drag = (item) => {
        item.drag = true
        if (!each.includes(item)) each = [item]
        for (let e of each) {
           e.drag = true
        }
        $app = $app
    }
    let over = (item) => {
        if (item.drag) return
        item.over = true
        $app = $app
    }
    let exit = (item) => {
        item.over = false
        $app = $app
    }
    let stop = () => {
        for (let item of data) {
            item.drag = false
            item.over = false
        }
        $app = $app
    }
    let move = (dragTarget, dropTarget) => {
        let dragParent = data.find(i => i.path.join("/") === dragTarget.path.slice(0, -1).join("/")) || $app
        let dropParent = data.find(i => i.path.join("/") === dropTarget.path.slice(0, -1).join("/")) || $app
        switch([dragTarget.kind, dropTarget.kind].join("-")) {
            case "file-directory": {
                let same = dropTarget.data.find(i => i.name === dragTarget.name)
                if (same && dragParent.path.join("/") !== dropTarget.path.join("/")) break
                dragParent.data.splice(dragParent.data.indexOf(dragTarget), 1)
                dropTarget.data.splice(0, 0, dragTarget)
                break
            }
            case "file-file": {
                let same = dropParent.data.find(i => i.name === dragTarget.name)
                if (same && dragParent.path.join("/") !== dropParent.path.join("/")) break
                dragParent.data.splice(dragParent.data.indexOf(dragTarget), 1)
                dropParent.data.splice(dropParent.data.indexOf(dropTarget) + 1, 0, dragTarget)
                break
            }
            case "directory-directory": {
                let same = dropTarget.data.find(i => i.name === dragTarget.name)
                if (same && dragParent.path.join("/") !== dropTarget.path.join("/")) break
                if (dropTarget.path.join("/").startsWith(dragTarget.path.join("/"))) break
                dragParent.data.splice(dragParent.data.indexOf(dragTarget), 1)
                dropTarget.data.splice(0, 0, dragTarget)
                break
            }
            case "directory-file": {
                let same = dropParent.data.find(i => i.name === dragTarget.name)
                if (same && dragParent.path.join("/") !== dropParent.path.join("/")) break
                if (dropParent.path.join("/").startsWith(dragTarget.path.join("/"))) break
                dragParent.data.splice(dragParent.data.indexOf(dragTarget), 1)
                dropParent.data.splice(dropParent.data.indexOf(dropTarget) + 1, 0, dragTarget)
                break
            }
        }
        if (dragTarget.drag) dragTarget.drag = false
        $app.save = true
        $app = $app
    }
    let drop = async (e, drop) => {
        let list = [...e.dataTransfer.items].filter((item) => item.kind === 'file').map((item) => item.getAsFileSystemHandle())
        if (list.length) {
            let read = async (file) => {
                if (file.name.endsWith(".html") || file.name.endsWith(".css") || file.name.endsWith(".js") || file.name.endsWith(".json") || file.name.endsWith(".md")) {
                    return await file.text()
                }
                let read = new FileReader()
                let data = new Promise((resolve, reject) => {
                    read.onload = () => resolve(read.result)
                    read.onerror = () => reject(read.error)
                })
                read.readAsDataURL(file)
                return data
            }
            let grow = async (root, seed = root, tree = []) => {
                for await (let leaf of root.values()) {
                    let name = leaf.name
                    let path = await seed.resolve(leaf)
                    let item = { name, path, kind: leaf.kind }
                    tree.push(item)
                    if (leaf.kind === "directory") {
                        item.data = await grow(leaf, seed)
                    } else {
                        let file = await leaf.getFile()
                        item.data = await read(file)
                    }
                }
                return tree
            }
            for await (let item of list) {
                let tree
                if (item.kind === "file") {
                    let file = await item.getFile()
                    tree = await read(file)
                } else {
                    tree = await grow(item)
                }
                if (drop.data.find(i => i.name === item.name)) break
                drop.data.splice(0, 0, { name: item.name, path: drop.path.concat(item.name), kind: item.kind, data: tree })
                $app = $app
            }
        } else {
            for (let i = each.length - 1; i >= 0; i--) move(each[i], drop)
        }
        drop.over = false
        $app.save = true
        $app = $app
    }
    let menu = (item) => {
        item.menu = !item.menu
        $app = $app
    }
    let edit = (verb, item) => {
        console.log(verb, item)
        switch (verb) {
            case "Delete": {
                let parent = data.find(i => i.path.join("/") === item.path.slice(0, -1).join("/")) || $app
                let ask = confirm(`Delete ${item.name}?`)
                if (ask) {
                    parent.data.splice(parent.data.indexOf(item), 1)
                    $app.save = true
                    $app = $app
                }
                break
            }
            case "Rename": {
                let parent = data.find(i => i.path.join("/") === item.path.slice(0, -1).join("/")) || $app
                let ask = prompt(`Rename ${item.name} to:`, item.name)
                if (ask) {
                    if (parent.data.find(i => i.name === ask)) break
                    item.name = ask
                    $app.save = true
                    $app = $app
                }
                break
            }
            case "Create File": {
                let ask = prompt(`Create File:`, "")
                if (ask) {
                    if (item.data.find(i => i.name === ask)) break
                    item.data.splice(0, 0, { name: ask, kind: "file", data: "", path: item.path.concat(ask) })
                    $app.save = true
                    $app = $app
                }
                break
            }
            case "Create Folder": {
                let ask = prompt(`Create Folder:`, "")
                if (ask) {
                    if (item.data.find(i => i.name === ask)) break
                    item.data.splice(0, 0, { name: ask, kind: "directory", data: [], path: item.path.concat(ask) })
                    $app.save = true
                    $app = $app
                }
                break
            }
            default: {
                break
            }
        }
        item.menu = false
        $app = $app
    }
</script>

<Book data={$app} let:item>
    <div 
        class:view={item.view} 
        class:each={each.length > 1 && each.includes(item)}
        class:drag={item.drag}
        class:over={item.over}
        draggable={true}
        on:dragstart={() => drag(item)}
        on:dragover|preventDefault={() => over(item)}
        on:dragleave|preventDefault={() => exit(item)}
        on:dragend={() => stop()}
        on:drop|preventDefault={(e) => drop(e, item)}>
        <span class=menu>
            {#if each.length <= 1}
            <button on:click|preventDefault={() => menu(item)}>
                {@html item.menu ? icons["xmark"] : icons["ellipsis"]}
            </button>
                {#if item.menu}
                <ul use:clickOutside on:clickOutside={() => {
                    item.menu = false
                    $app = $app
                }}>
                    {#if item.kind === "directory"}
                    <li><button on:click={() => edit("Create Folder", item)}>Create Folder</button></li>
                    <li><button on:click={() => edit("Create File", item)}>Create File</button></li>
                    {/if}
                    {#if item.path.length > 1} 
                    <li><button on:click={() => edit("Rename", item)}>Rename</button></li>
                    <li><button on:click={() => edit("Delete", item)}>Delete</button></li>
                    {/if}
                </ul>
                {/if}
            {/if}
        </span>
        <span>
            {@html item.kind === "directory" ? item.open && !item.drag ? icons["folder-open"] : icons["folder"] : icons["file"]}
        </span>
        {#if item.kind === "file" && item.name.endsWith(".md") && !item.name.startsWith("_")}
        <a class=link href={item.path.join("/").slice(0, -3)} on:click|preventDefault={(e) => open(e, item)}>{item.name}</a>
        {:else}
        <button class=link on:click|preventDefault={(e) => open(e, item)}>{item.name}</button>
        {/if}
    </div>
</Book>