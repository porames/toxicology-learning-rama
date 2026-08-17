<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { visibleNavItems, isNavActive } from '$lib/navigation';
	import { t, type MessageKeys } from '$lib/i18n';

	let { isAdmin = false }: { isAdmin?: boolean } = $props();

	const items = $derived(visibleNavItems(isAdmin));
</script>

<div class="space-y-0.5">
	{#each items as item}
		{@const active = isNavActive(page.route.id ?? '', item.href)}
		<div
			role="button"
			tabindex="0"
			onclick={() => goto(`${base}/#${item.href}`)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					goto(`${base}/#${item.href}`);
				}
			}}
			class={`group relative flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2 text-left transition ${
				active ? 'bg-iris-50 text-iris-700' : 'text-ink-700 hover:bg-ink-900/[0.03]'
			}`}
		>
			<span
				class={`flex h-5 w-5 shrink-0 items-center justify-center ${
					active ? 'text-iris-600' : 'text-ink-300'
				}`}
			>
				<item.icon class="h-4 w-4" />
			</span>
			<span class="truncate text-[13.5px] font-medium">
				{t(item.labelKey as MessageKeys)}
			</span>
		</div>
	{/each}
</div>
