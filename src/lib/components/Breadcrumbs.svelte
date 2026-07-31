<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import { goto } from '$app/navigation';

	interface Crumb {
		label: string;
		href?: string;
		onclick?: () => void;
		active?: boolean;
	}

	let { crumbs }: { crumbs: Crumb[] } = $props();

	const chipClass =
		'inline-flex max-w-[160px] shrink-0 items-center truncate rounded-full px-3 py-1 text-[12.5px] font-medium transition';
</script>

<nav
	class="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none"
	aria-label="Breadcrumbs"
>
	{#each crumbs as crumb, i}
		{#if i > 0}
			<ChevronRight class="h-3.5 w-3.5 shrink-0 text-ink-300" />
		{/if}
		{#if crumb.active}
			<span class="{chipClass} bg-iris-600 text-white">
				{crumb.label}
			</span>
		{:else if crumb.href}
			<button
				type="button"
				onclick={() => goto(crumb.href!)}
				class="{chipClass} text-ink-600 hover:bg-ink-900/5 hover:text-ink-900"
			>
				{crumb.label}
			</button>
		{:else if crumb.onclick}
			<button
				type="button"
				onclick={crumb.onclick}
				class="{chipClass} text-ink-600 hover:bg-ink-900/5 hover:text-ink-900"
			>
				{crumb.label}
			</button>
		{/if}
	{/each}
</nav>
