<script lang="ts">
	import '../app.css';
	import { authState } from '$lib/auth.svelte';
	import { page } from '$app/state';
	import NavigationList from '$lib/components/NavigationList.svelte';
	import UserInfoCard from '$lib/components/UserInfoCard.svelte';
	import { LoaderCircle } from '@lucide/svelte';

	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();

	const authRoutes = ['/login', '/'];
	const isAuthPage = $derived(authRoutes.includes(page.url.pathname));
	const isAdmin = $derived(authState.profile?.role === 'admin' || authState.profile?.role === 'teacher');
</script>

<svelte:head>
	<title>RAMA Toxico | E-Learning</title>
	<meta name="description" content="RAMA Toxico | E-Learning" />
</svelte:head>

{#if authState.loading}
	<div class="flex h-screen items-center justify-center">
		<LoaderCircle class="h-8 w-8 animate-spin text-iris-500" />
	</div>
{:else if isAuthPage || authState.profile}
	<div class="flex h-screen overflow-hidden">
		{#if !isAuthPage}
			<aside class="flex w-60 flex-col border-r border-ink-900/8 bg-canvas/80 p-4">
				<UserInfoCard
					name={authState.profile?.name ?? ''}
					email={authState.profile?.email ?? ''}
					photoURL={authState.profile?.photoURL}
					year={authState.profile?.year}
					role={authState.profile?.role}
				/>
				<NavigationList isAdmin={isAdmin} />
			</aside>
		{/if}
		<main class="flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
{/if}
