<script lang="ts">
	import { functionsUrl } from '$lib/functionsUrl';
	import { authState } from '$lib/auth.svelte';
	import { Modal } from '$lib/components/ui';
	import { Video, AlertCircle, Loader2 } from '@lucide/svelte';
	import { t } from '$lib/i18n';

	interface BunnyVideo {
		guid: string;
		title?: string;
		thumbnailUrl?: string;
		length?: number;
	}

	let {
		onSelect,
		onClose,
	}: {
		onSelect: (videoId: string) => void;
		onClose: () => void;
	} = $props();

	let videos = $state<BunnyVideo[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	function formatDuration(seconds: number | undefined): string {
		if (seconds == null || seconds < 0 || Number.isNaN(seconds)) return '';
		const total = Math.round(seconds);
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;
		const mm = String(m).padStart(2, '0');
		const ss = String(s).padStart(2, '0');
		return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
	}

	async function load() {
		loading = true;
		error = null;
		try {
			const user = authState.user;
			const token = await user?.getIdToken();
			const res = await fetch(functionsUrl('videoList'), {
				method: 'GET',
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error(t('materials.failedToLoadVideos'));
			const data = await res.json();
			videos = (data?.items ?? []).map((v: Record<string, unknown>) => ({
				guid: String(v.guid ?? ''),
				title: typeof v.title === 'string' ? v.title : '',
				thumbnailUrl: typeof v.thumbnailUrl === 'string' ? v.thumbnailUrl : undefined,
				length: typeof v.length === 'number' ? v.length : undefined,
			}));
		} catch (err) {
			console.error(err);
			error = err instanceof Error ? err.message : t('materials.couldNotLoadVideos');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});
</script>

<Modal open title={t('materials.chooseUploadedVideo')} onclose={onClose} class="max-w-lg">
	{#if loading}
		<div class="flex items-center justify-center py-10">
			<Loader2 class="h-5 w-5 animate-spin text-iris-600" />
		</div>
	{:else if error}
		<div
			class="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600"
		>
			<AlertCircle class="h-4 w-4 shrink-0" />
			{error}
		</div>
	{:else if videos.length === 0}
		<p class="py-10 text-center text-[13px] text-ink-400">{t('materials.noUploadedVideos')}</p>
	{:else}
		<div class="max-h-96 space-y-2 overflow-y-auto">
			{#each videos as v (v.guid)}
				<button
					type="button"
					onclick={() => onSelect(v.guid)}
					class="flex w-full items-center gap-3 rounded-lg border border-ink-900/10 px-3 py-2 text-left transition hover:border-iris-400 hover:bg-iris-50"
				>
					{#if v.thumbnailUrl}
						<img
							src={v.thumbnailUrl}
							alt=""
							class="h-12 w-20 shrink-0 rounded object-cover"
						/>
					{:else}
						<div
							class="flex h-12 w-20 shrink-0 items-center justify-center rounded bg-ink-900/5 text-ink-400"
						>
							<Video class="h-5 w-5" />
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="truncate text-[14px] font-medium text-ink-900">
							{v.title || t('common.untitled')}
						</p>
						{#if formatDuration(v.length)}
							<p class="text-[12px] text-ink-400">{formatDuration(v.length)}</p>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{/if}
</Modal>
