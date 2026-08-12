<script lang="ts">
	import type { Snippet } from 'svelte';
	import DashboardLayout from '$lib/components/DashboardLayout.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import { t } from '$lib/i18n';

	let { children }: { children: Snippet } = $props();
</script>

<DashboardLayout>
	{#snippet headerLeft()}
		<Breadcrumbs crumbs={[{ label: t('nav.settings'), active: true }]} />
	{/snippet}
	{@render children()}
</DashboardLayout>
