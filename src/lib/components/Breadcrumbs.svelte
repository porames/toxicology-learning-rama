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
		'inline-flex max-w-[180px] shrink-0 items-center truncate py-1 text-sm font-medium transition cursor-pointer';
</script>

<nav
	class="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none ml-2"
	aria-label="Breadcrumbs"
>
	{#each crumbs as crumb, i}
		{#if i > 0}
			<ChevronRight class="h-4 w-4 shrink-0 text-ink-300" />
		{/if}
		{#if crumb.active}
			<span class="{chipClass} font-semibold text-ink-900">
				{crumb.label}
			</span>
		{:else if crumb.href}
			<button
				type="button"
				onclick={() => goto(crumb.href!)}
				class="{chipClass} rounded-full bg-ink-900/[0.06] px-3 text-ink-700 hover:bg-iris-600 hover:text-white"
			>
				{crumb.label}
			</button>
		{:else if crumb.onclick}
			<button
				type="button"
				onclick={crumb.onclick}
				class="{chipClass} rounded-full bg-ink-900/[0.06] px-3 text-ink-700 hover:bg-iris-600 hover:text-white"
			>
				{crumb.label}
			</button>
		{/if}
	{/each}
</nav>
