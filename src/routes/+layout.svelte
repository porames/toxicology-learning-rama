<script lang="ts">
	import '../app.css';
	import { authState } from '$lib/auth.svelte';
	import { page } from '$app/state';
	import { LoaderCircle } from '@lucide/svelte';

	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const authRoutes = ['/login', '/', '/activate'];
	const isAuthPage = $derived(authRoutes.includes(page.url.pathname));
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
	{@render children()}
{/if}
