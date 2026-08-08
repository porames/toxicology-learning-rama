<script lang="ts">
	import { db } from '$lib/firebase';
	import {
		collection,
		getDocs,
		getDoc,
		writeBatch,
		doc,
		serverTimestamp,
	} from 'firebase/firestore';
	import type { CourseTemplate, Lecture, TemplateLecture } from '$lib/dashboard/types';
	import { Button, Input, Modal, Select } from '$lib/components/ui';
	import { Library, Loader2, AlertCircle } from '@lucide/svelte';
	import moment from 'moment';

	let {
		classId,
		onClose,
		onImported,
	}: {
		classId: string;
		onClose: () => void;
		onImported: (lectures: Lecture[]) => void;
	} = $props();

	const DAY_MS = 86400000;
	const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	let templates = $state<CourseTemplate[]>([]);
	let loading = $state(true);
	let selectedTemplateId = $state('');
	let startDate = $state(moment().add(1, 'day').format('YYYY-MM-DD'));
	let previewLectures = $state<TemplateLecture[]>([]);
	let lectureCount = $state(0);
	let countLoading = $state(false);
	let importing = $state(false);
	let error = $state<string | null>(null);

	const templateOptions = $derived(
		templates.map((t) => ({ value: t.id, label: t.name || 'Untitled template' })),
	);

	function toDate(value: unknown): Date {
		if (value && typeof value === 'object' && 'toDate' in value) {
			return (value as { toDate: () => Date }).toDate();
		}
		return new Date(value as Date);
	}

	function timeOfDay(d: Date): number {
		return d.getHours() * 3600000 + d.getMinutes() * 60000 + d.getSeconds() * 1000;
	}

	function timeIndex(t: { week?: number; day?: number }): number {
		return ((t.week ?? 1) - 1) * 7 + ((t.day ?? 1) - 1);
	}

	async function loadTemplates() {
		loading = true;
		error = null;
		try {
			const snap = await getDocs(collection(db, 'courseTemplates'));
			templates = snap.docs.map(
				(d) => ({ id: d.id, ...d.data() }) as unknown as CourseTemplate,
			);
			templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
		} catch (err) {
			console.error(err);
			error = "Couldn't load templates.";
		} finally {
			loading = false;
		}
	}

	async function handleTemplateChange(e: Event) {
		selectedTemplateId = (e.target as HTMLSelectElement).value;
		previewLectures = [];
		lectureCount = 0;
		if (!selectedTemplateId) return;
		countLoading = true;
		try {
			const snap = await getDoc(doc(db, 'courseTemplates', selectedTemplateId));
			previewLectures = [...(snap.data()?.lectures ?? [])] as TemplateLecture[];
			previewLectures.sort((a, b) => timeIndex(a.startTime) - timeIndex(b.startTime));
			lectureCount = previewLectures.length;
		} catch (err) {
			console.error(err);
		} finally {
			countLoading = false;
		}
	}

	async function handleImport() {
		if (!selectedTemplateId || !startDate) {
			error = 'Pick a template and a start date.';
			return;
		}
		importing = true;
		error = null;
		try {
			const base = new Date(startDate);
			base.setHours(0, 0, 0, 0);

			const templateLectures = previewLectures;
			const created: Lecture[] = [];
			let batch = writeBatch(db);
			let opCount = 0;

			for (const tl of templateLectures) {
				const startTime = new Date(
					base.getTime() +
						timeIndex(tl.startTime) * DAY_MS +
						timeOfDay(toDate(tl.startTime.time)),
				);
				const endTime = new Date(
					base.getTime() +
						timeIndex(tl.endTime) * DAY_MS +
						timeOfDay(toDate(tl.endTime.time)),
				);

				const lectureRef = doc(collection(db, 'classes', classId, 'lectures'));
				const materialRefs = (tl.materials ?? []).map((m) => ({
					ref: doc(
						collection(db, 'classes', classId, 'lectures', lectureRef.id, 'materials'),
					),
					data: m,
				}));
				batch.set(lectureRef, {
					title: tl.title || 'Untitled lecture',
					startTime,
					endTime,
					materialsOrder: materialRefs.map((x) => x.ref.id),
					createdAt: serverTimestamp(),
				});
				opCount++;

				for (const { ref, data: m } of materialRefs) {
					batch.set(ref, {
						type: m.type,
						title: m.title,
						value: m.value ?? '',
						...(m.requiredPostTest !== undefined
							? { requiredPostTest: m.requiredPostTest }
							: {}),
						createdAt: serverTimestamp(),
					});
					opCount++;
				}

				created.push({
					id: lectureRef.id,
					title: tl.title || 'Untitled lecture',
					startTime,
					endTime,
					materials: [],
				});

				if (opCount >= 400) {
					await batch.commit();
					batch = writeBatch(db);
					opCount = 0;
				}
			}

			if (opCount > 0) await batch.commit();

			onImported(created);
		} catch (err) {
			console.error(err);
			error = err instanceof Error ? err.message : "Couldn't import the lectures.";
		} finally {
			importing = false;
		}
	}

	$effect(() => {
		loadTemplates();
	});
</script>

<Modal open title="Import lectures from template" onclose={onClose} class="max-w-lg">
	<div class="space-y-4">
		{#if loading}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-5 w-5 animate-spin text-iris-600" />
			</div>
		{:else if templates.length === 0}
			<p class="py-6 text-center text-[13px] text-ink-400">
				No templates yet. Create one from the Templates page first.
			</p>
		{:else}
			<Select
				label="Template"
				options={templateOptions}
				value={selectedTemplateId}
				onchange={handleTemplateChange}
				placeholder="Choose a template"
			/>
			<Input
				type="date"
				label="Start date"
				bind:value={startDate}
				hint="This date is the template's first week (Week 1, day 1). Lectures are placed from it by week and day."
			/>
			{#if countLoading}
				<p class="text-[12.5px] text-ink-500">Loading lecture count…</p>
			{:else if selectedTemplateId}
				<p class="text-[12.5px] text-ink-500">
					{lectureCount} lecture template{lectureCount === 1 ? '' : 's'} will be imported.
				</p>
			{/if}

			{#if selectedTemplateId && !countLoading}
				<div class="overflow-hidden rounded-lg border border-ink-900/10 bg-white">
					<p
						class="border-b border-ink-900/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400"
					>
						Lectures ({lectureCount})
					</p>
					<div class="max-h-56 divide-y divide-ink-900/5 overflow-y-auto">
						{#each previewLectures as l (l.id)}
							<div class="flex items-center justify-between gap-3 px-3 py-2">
								<p
									class="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-900"
								>
									{l.title || 'Untitled lecture'}
								</p>
								<p class="shrink-0 text-[12px] text-ink-500">
									{DAY_LABELS[l.startTime.day - 1]} ·{' '}
									{moment(toDate(l.startTime.time)).format('HH:mm')} –{' '}
									{moment(toDate(l.endTime.time)).format('HH:mm')}
								</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		{#if error}
			<p
				class="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600"
			>
				<AlertCircle class="h-4 w-4 shrink-0" />
				{error}
			</p>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={onClose}>Cancel</Button>
		<Button
			variant="accent"
			disabled={importing || !selectedTemplateId || !startDate}
			onclick={handleImport}
		>
			{#if importing}
				<Loader2 class="h-4 w-4 animate-spin" />
				Importing…
			{:else}
				<Library class="h-4 w-4" />
				Import
			{/if}
		</Button>
	{/snippet}
</Modal>
