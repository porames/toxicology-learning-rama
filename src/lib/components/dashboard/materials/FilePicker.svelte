<script lang="ts">
	import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { authState } from '$lib/auth.svelte';
	import { Modal } from '$lib/components/ui';
	import { File, AlertCircle, Loader2 } from '@lucide/svelte';
	import { t } from '$lib/i18n';
	import moment from 'moment';

	export interface UploadedFile {
		id: string;
		originalName: string;
		description: string;
		storagePath: string;
		createdAt: { toDate: () => Date } | null;
	}

	let {
		onSelect,
		onClose,
	}: {
		onSelect: (file: UploadedFile) => void;
		onClose: () => void;
	} = $props();

	let files = $state<UploadedFile[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			const uid = authState.user?.uid;
			if (!uid) throw new Error('Not signed in');
			const q = query(
				collection(db, 'files'),
				where('userId', '==', uid),
				orderBy('createdAt', 'desc'),
			);
			const snap = await getDocs(q);
			files = snap.docs.map((d) => {
				const data = d.data();
				return {
					id: d.id,
					originalName: (data.originalName as string) || t('common.untitled'),
					description: (data.description as string) || '',
					storagePath: (data.storagePath as string) || '',
					createdAt: (data.createdAt as { toDate: () => Date } | null) ?? null,
				};
			});
		} catch (err) {
			console.error(err);
			error = t('materials.couldNotLoadFiles');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	function fmtDate(d?: { toDate?: () => Date } | null): string {
		if (!d) return '';
		const date = (d as any).toDate ? (d as any).toDate() : d;
		return moment(date).format('MMM D, YYYY · hh:mm A');
	}
</script>

<Modal open title={t('materials.chooseUploadedFiles')} onclose={onClose} class="max-w-lg">
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
	{:else if files.length === 0}
		<p class="py-10 text-center text-[13px] text-ink-400">{t('materials.noUploadedFiles')}</p>
	{:else}
		<div class="max-h-96 space-y-2 overflow-y-auto">
			{#each files as f (f.id)}
				<button
					type="button"
					onclick={() => {
						onSelect(f);
					}}
					class="flex w-full items-center gap-3 rounded-lg border border-ink-900/10 px-3 py-2.5 text-left transition hover:border-iris-400 hover:bg-iris-50"
				>
					<span
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink-900/5 text-ink-400"
					>
						<File class="h-4 w-4" />
					</span>
					<div class="min-w-0 flex-1">
						<p class="truncate text-[14px] font-medium text-ink-900">
							{f.originalName}
						</p>
						{#if f.description}
							<p class="truncate text-[12px] text-ink-400">{f.description}</p>
						{/if}
						{#if fmtDate(f.createdAt)}
							<p class="text-[11px] text-ink-300">{fmtDate(f.createdAt)}</p>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{/if}
</Modal>
