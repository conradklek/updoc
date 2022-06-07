<script>
	export let data = []
</script>

<ol>
{#each data as item (item.path.join("/"))}
	<li>
		<slot {item}>No slot</slot>
		{#if item.kind === 'directory' && item.open && !item.drag}
			<svelte:self data={item.data} let:item={item}>
				<slot {item}>No slot</slot>
			</svelte:self>
		{/if}
	</li>
{/each}
</ol>