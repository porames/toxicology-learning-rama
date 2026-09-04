<script lang="ts">
	import { ExternalLink, Copy, Check } from '@lucide/svelte';
	import GoogleMeetIcon from '$lib/components/GoogleMeetIcon.svelte';
	import type { Material } from '$lib/dashboard/types';
	import { t } from '$lib/i18n';

	let { material }: { material: Material } = $props();

	let copied = $state(false);

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(material.value);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch (err) {
			console.error(err);
		}
	}
</script>

<div class="flex items-center gap-2 rounded-lg border border-ink-900/8 bg-ink-900/[0.02] px-3 py-2">
	<GoogleMeetIcon class="h-4 w-4 shrink-0" />
	<a
		href={material.value}
		target="_blank"
		rel="noopener noreferrer"
		class="min-w-0 flex-1 truncate text-[12.5px] font-medium text-emerald-700 underline hover:text-emerald-800"
	>
		{material.value}
	</a>
	<button
		type="button"
		onclick={copyLink}
		class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-900/5 hover:text-ink-700"
		aria-label={t('materials.copyLink')}
	>
		{#if copied}
			<Check class="h-3.5 w-3.5 text-emerald-600" />
		{:else}
			<Copy class="h-3.5 w-3.5" />
		{/if}
	</button>
	<a
		href={material.value}
		target="_blank"
		rel="noopener noreferrer"
		class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-900/5 hover:text-ink-700"
		aria-label={t('materials.openLink')}
	>
		<ExternalLink class="h-3.5 w-3.5" />
	</a>
</div>
