<script lang="ts">
	import { Menu, LogOut } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import { signOut } from 'firebase/auth';
	import NavigationList from '$lib/components/NavigationList.svelte';
	import UserInfoCard from '$lib/components/UserInfoCard.svelte';
	import { authState } from '$lib/auth.svelte';
	import { auth } from '$lib/firebase';

	import type { Snippet } from 'svelte';

	let {
		children,
		sidebarBottom,
		headerLeft,
		sidebarClass = 'w-72',
	}: {
		children: Snippet;
		sidebarBottom?: Snippet;
		headerLeft?: Snippet;
		sidebarClass?: string;
	} = $props();

	let showMenu = $state(false);

	const isAdmin = $derived(
		authState.profile?.role === 'admin' || authState.profile?.role === 'teacher',
	);
</script>

<div class="flex h-screen flex-col bg-canvas">
	<header
		class="flex h-16 shrink-0 items-center justify-between border-b border-ink-900/8 bg-white px-5"
	>
		<div class="flex items-center gap-1 sm:gap-2.5 min-w-0">
			<button type="button" onclick={() => (showMenu = !showMenu)} class="md:hidden shrink-0">
				<Menu class="h-6 w-6" />
			</button>
			<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-iris-600">
				<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none">
					<path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" fill="white" />
				</svg>
			</div>
			{#if headerLeft}
				{@render headerLeft()}
			{/if}
		</div>
	</header>
	<div class="flex min-h-0 flex-1">
		{#if showMenu}
			<div
				class="fixed inset-0 z-10 bg-black/30 md:hidden"
				role="none"
				transition:fade={{ duration: 200 }}
				onclick={() => (showMenu = false)}
			></div>
		{/if}
		<aside
			class={`flex shrink-0 flex-col border-r border-ink-900/8 bg-white p-4 transition-transform duration-300 ease-in-out fixed inset-y-0 left-0 z-20 md:relative md:z-auto md:translate-x-0 md:pointer-events-auto min-w-72 ${sidebarClass} ${
				showMenu
					? 'translate-x-0 pointer-events-auto'
					: '-translate-x-full pointer-events-none'
			}`}
		>
			<UserInfoCard
				name={authState.profile?.name ?? ''}
				email={authState.profile?.email ?? ''}
				photoURL={authState.profile?.photoURL}
				year={authState.profile?.year}
				role={authState.profile?.role}
			/>
			<NavigationList {isAdmin} />
			{#if sidebarBottom}
				{@render sidebarBottom()}
			{/if}
			<div class="mt-auto border-t border-ink-900/8 px-2 pt-2">
				<button
					type="button"
					onclick={() => signOut(auth)}
					class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-500 transition hover:bg-red-50 hover:text-red-600"
				>
					<LogOut class="h-4 w-4" />
					Sign out
				</button>
			</div>
		</aside>
		<main class="flex min-h-0 flex-1 overflow-y-auto justify-center">
			{@render children()}
		</main>
	</div>
</div>
