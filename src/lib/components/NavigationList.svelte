<script lang="ts">
	import { LayoutDashboard, BookOpen, Beaker, ClipboardList } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	interface NavItem {
		label: string;
		href: string;
		icon: typeof LayoutDashboard;
	}

	const NAV_ITEMS: NavItem[] = [
		{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
		{ label: 'Classes', href: '/classes', icon: BookOpen },
		{ label: 'Simulator', href: '/simulator', icon: Beaker },
		{ label: 'Quizzes', href: '/quiz', icon: ClipboardList },
	];

	let { isAdmin = false }: { isAdmin?: boolean } = $props();

	function isActive(href: string) {
		if (href === '/quiz') return page.url.pathname.startsWith('/quiz');
		return page.url.pathname.startsWith(href);
	}

	const visibleItems = $derived(NAV_ITEMS.filter((item) => {
		if (isAdmin) return true;
		return item.label === 'Classes' || item.label === 'Simulator';
	}));
</script>

<div class="space-y-0.5">
	{#each visibleItems as item}
		{@const active = isActive(item.href)}
		<div
			role="button"
			tabindex="0"
			onclick={() => goto(item.href)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					goto(item.href);
				}
			}}
			class={`group relative flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2 text-left transition ${
				active
					? 'bg-iris-50 text-iris-700'
					: 'text-ink-700 hover:bg-ink-900/[0.03]'
			}`}
		>
			<span class={`flex h-5 w-5 shrink-0 items-center justify-center ${
				active ? 'text-iris-600' : 'text-ink-300'
			}`}>
				<item.icon class="h-4 w-4" />
			</span>
			<span class="truncate text-[13.5px] font-medium">
				{item.label}
			</span>
		</div>
	{/each}
</div>
