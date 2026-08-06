<script lang="ts">
	let { imageUrl, height = 'h-48', class: className = '' }: {
		imageUrl: string;
		height?: string;
		class?: string;
	} = $props();

	let loaded = $state(false);

	$effect(() => {
		const url = imageUrl;
		loaded = false;
		const img = new Image();
		img.onload = () => (loaded = true);
		img.onerror = () => (loaded = true);
		img.src = url;
	});
</script>

<div class="relative w-full {height} {className}">
	{#if !loaded}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center bg-ink-900/5"
		>
			<div
				class="h-5 w-5 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
			></div>
		</div>
	{/if}
	<div
		class="h-full w-full transition-opacity duration-200 {loaded ? 'opacity-100' : 'opacity-0'}"
		role="img"
		style="background-image: url('{imageUrl}'); background-size: contain; background-position: center; background-repeat: no-repeat;"
	></div>
</div>
