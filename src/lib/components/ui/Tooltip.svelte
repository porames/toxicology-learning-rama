<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		text: string;
		children: Snippet;
	}

	let { text, children }: Props = $props();
</script>

<span class="tooltip tooltip-bottom inline-flex" data-tip={text} role="button" tabindex="0">
	{@render children()}
</span>
