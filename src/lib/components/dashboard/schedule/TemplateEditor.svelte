<script lang="ts">
	import { db } from '$lib/firebase';
	import {
		collection,
		addDoc,
		getDoc,
		doc,
		updateDoc,
		serverTimestamp,
	} from 'firebase/firestore';
	import type {
		CourseTemplate,
		TemplateLecture,
		TemplateTime,
		Material,
		ScheduleEvent,
	} from '$lib/dashboard/types';
	import { Button, Input, Textarea, Modal } from '$lib/components/ui';
	import { Plus, ChevronLeft, AlertCircle, ChevronRight, Trash2 } from '@lucide/svelte';
	import * as Utils from '$lib/dashboard/utils';
	import TemplateLectureEditor from './TemplateLectureEditor.svelte';
	import ScheduleCalendar from './ScheduleCalendar.svelte';
	import moment from 'moment';
	import { t, tn } from '$lib/i18n';

	let {
		template,
	}: {
		template: CourseTemplate;
	} = $props();

	let draftId = $state(template.id ?? '');

	let name = $state(template.name ?? '');
	let code = $state(template.code ?? '');
	let description = $state(template.description ?? '');
	let lectures = $state<TemplateLecture[]>([]);
	let loadingLectures = $state(true);
	let hasLoaded = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let saved = $state(false);
	let selectedLectureId = $state<string | null>(null);
	let deleteConfirmOpen = $state(false);
	let weekOffset = $state(0);

	const selectedLecture = $derived(lectures.find((l) => l.id === selectedLectureId) ?? null);

	const weekStart = $derived(moment().startOf('week').add(weekOffset, 'week').toDate());

	const calendarEvents = $derived<ScheduleEvent[]>(
		lectures
			.filter((l) => l.startTime?.week === weekOffset + 1)
			.map((l) => {
				const sunday = moment().startOf('week').add(weekOffset, 'week');
				const start = sunday
					.clone()
					.add(l.startTime.day - 1, 'day')
					.set({
						hours: l.startTime.time.getHours(),
						minutes: l.startTime.time.getMinutes(),
					});
				const end = sunday
					.clone()
					.add(l.endTime.day - 1, 'day')
					.set({
						hours: l.endTime.time.getHours(),
						minutes: l.endTime.time.getMinutes(),
					});
				return {
					id: l.id,
					date: start.toDate(),
					startTime: start.toDate(),
					endTime: end.toDate(),
					title: l.title || t('common.untitledLecture'),
					lectureTemplateId: l.id,
				};
			}),
	);

	function toTemplateTime(raw: unknown): TemplateTime {
		const obj = (raw ?? {}) as {
			week?: number;
			day?: number;
			time?: { toDate?: () => Date } | Date;
		};
		const t = obj.time;
		let time: Date;
		if (t && typeof t === 'object' && 'toDate' in t && t.toDate) {
			time = t.toDate();
		} else if (t instanceof Date) {
			time = t;
		} else {
			time = new Date();
		}
		return { week: obj.week ?? 1, day: obj.day ?? 1, time };
	}

	function closeLectureEditor() {
		selectedLectureId = null;
		clearTimeout(persistTimer);
		persistLectures();
	}

	function openLectureEditor(lectureId: string) {
		selectedLectureId = lectureId;
		deleteConfirmOpen = false;
	}

	function handleEventClick(event: ScheduleEvent) {
		openLectureEditor(event.id);
	}

	function handleEventChange(event: ScheduleEvent, startTime: Date, endTime: Date) {
		const lec = lectures.find((l) => l.id === event.id);
		if (!lec) return;
		handleUpdateLecture(lec.id, {
			startTime: {
				week: weekOffset + 1,
				day: moment(startTime).day() + 1,
				time: Utils.timeOfDay(startTime),
			},
			endTime: {
				week: weekOffset + 1,
				day: moment(endTime).day() + 1,
				time: Utils.timeOfDay(endTime),
			},
		});
	}

	async function ensureTemplate(): Promise<string> {
		if (draftId) return draftId;
		const ref = await addDoc(collection(db, 'courseTemplates'), {
			name,
			code,
			description,
			lectures: [],
			createdAt: serverTimestamp(),
		});
		draftId = ref.id;
		return ref.id;
	}

	function mapRawLectures(raw: unknown[]): TemplateLecture[] {
		return raw.map((l) => {
			const lec = l as Record<string, unknown>;
			return {
				id: String(lec.id ?? Utils.makeId()),
				title: (lec.title as string) ?? t('common.untitledLecture'),
				startTime: toTemplateTime(lec.startTime),
				endTime: toTemplateTime(lec.endTime),
				materials: ((lec.materials as unknown[]) ?? []).map((m) => {
					const mat = m as Record<string, unknown>;
					return {
						id: String(mat.id ?? Utils.makeId()),
						type: mat.type as Material['type'],
						title: (mat.title as string) ?? '',
						value: (mat.value as string) ?? '',
						...(mat.requiredPostTest !== undefined
							? { requiredPostTest: mat.requiredPostTest as boolean }
							: {}),
					};
				}),
				materialsOrder: (lec.materialsOrder as string[]) ?? [],
			};
		});
	}

	async function loadLectures() {
		loadingLectures = true;
		try {
			const id = await ensureTemplate();
			const snap = await getDoc(doc(db, 'courseTemplates', id));
			const data = snap.data();
			lectures = mapRawLectures(data?.lectures ?? []);
			lectures.sort(
				(a, b) => Utils.templateTimeToMs(a.startTime) - Utils.templateTimeToMs(b.startTime),
			);
			lastPersistedJson = JSON.stringify(lectures.map(lectureSnapshot));
			hasLoaded = true;
		} catch (err) {
			console.error(err);
			error = t('templates.couldNotLoadTemplateLectures');
		} finally {
			loadingLectures = false;
		}
	}

	let persistTimer: ReturnType<typeof setTimeout> | undefined;
	let persistQueue: Promise<void> = Promise.resolve();
	let lastPersistedJson = '';

	function lectureSnapshot(l: TemplateLecture): TemplateLecture {
		return {
			...l,
			startTime: { ...l.startTime, time: new Date(l.startTime.time) },
			endTime: { ...l.endTime, time: new Date(l.endTime.time) },
			materials: (l.materials ?? []).map((m) => {
				const { requiredPostTest, ...rest } = m;
				return requiredPostTest === undefined ? rest : { ...rest, requiredPostTest };
			}),
			materialsOrder: [...(l.materialsOrder ?? [])],
		};
	}

	async function persistLectures() {
		const id = draftId;
		if (!id) return;
		const snapshot = lectures.map(lectureSnapshot);
		const json = JSON.stringify(snapshot);
		persistQueue = persistQueue.then(async () => {
			if (json === lastPersistedJson) return;
			try {
				await updateDoc(doc(db, 'courseTemplates', id), {
					lectures: snapshot,
					updatedAt: serverTimestamp(),
				});
				lastPersistedJson = json;
			} catch (err) {
				console.error(err);
				error = t('templates.couldNotSaveLectures');
			}
		});
		await persistQueue;
	}

	$effect(() => {
		if (!hasLoaded) return;
		const touched = lectures.map((l) => ({
			title: l.title,
			startTime: l.startTime,
			endTime: l.endTime,
			materials: l.materials,
			materialsOrder: l.materialsOrder,
		}));
		void touched;
		clearTimeout(persistTimer);
		persistTimer = setTimeout(persistLectures, 300);
	});

	async function handleCreateEvent({
		date,
		startTime,
		endTime,
	}: {
		date: Date;
		startTime: Date;
		endTime: Date;
	}) {
		try {
			await ensureTemplate();
			const startObj: TemplateTime = {
				week: weekOffset + 1,
				day: moment(date).day() + 1,
				time: Utils.timeOfDay(startTime),
			};
			const endObj: TemplateTime = {
				week: weekOffset + 1,
				day: moment(date).day() + 1,
				time: Utils.timeOfDay(endTime),
			};
			const newLecture: TemplateLecture = {
				id: Utils.makeId(),
				title: t('dashboard.addLecture'),
				startTime: startObj,
				endTime: endObj,
				materials: [],
				materialsOrder: [],
			};
			lectures = [...lectures, newLecture];
			lectures.sort(
				(a, b) => Utils.templateTimeToMs(a.startTime) - Utils.templateTimeToMs(b.startTime),
			);
			weekOffset = moment(date).diff(moment().startOf('week'), 'week');
			openLectureEditor(newLecture.id);
		} catch (err) {
			console.error(err);
			error = t('templates.couldNotAddLecture');
		}
	}

	async function handleAddLecture() {
		try {
			await ensureTemplate();
			const { startTime, endTime } = Utils.defaultTimes();
			const startObj: TemplateTime = {
				week: weekOffset + 1,
				day: moment().day() + 1,
				time: Utils.timeOfDay(startTime),
			};
			const endObj: TemplateTime = {
				week: weekOffset + 1,
				day: moment().day() + 1,
				time: Utils.timeOfDay(endTime),
			};
			const newLecture: TemplateLecture = {
				id: Utils.makeId(),
				title: t('dashboard.addLecture'),
				startTime: startObj,
				endTime: endObj,
				materials: [],
				materialsOrder: [],
			};
			lectures = [...lectures, newLecture];
			lectures.sort(
				(a, b) => Utils.templateTimeToMs(a.startTime) - Utils.templateTimeToMs(b.startTime),
			);
			openLectureEditor(newLecture.id);
		} catch (err) {
			console.error(err);
			error = t('templates.couldNotAddALecture');
		}
	}

	function handleUpdateLecture(
		lectureId: string,
		patch: Partial<Pick<TemplateLecture, 'title' | 'startTime' | 'endTime'>>,
	) {
		lectures = lectures
			.map((l) => (l.id === lectureId ? { ...l, ...patch } : l))
			.sort(
				(a, b) => Utils.templateTimeToMs(a.startTime) - Utils.templateTimeToMs(b.startTime),
			);
	}

	async function handleDeleteLecture(lectureId: string) {
		lectures = lectures.filter((l) => l.id !== lectureId);
	}

	async function handleSave() {
		if (!name.trim()) {
			error = t('templates.templateNameRequired');
			return;
		}
		saving = true;
		error = null;
		saved = false;
		try {
			const id = await ensureTemplate();
			clearTimeout(persistTimer);
			await persistLectures();
			await updateDoc(doc(db, 'courseTemplates', id), {
				name: name.trim(),
				code: code.trim(),
				description: description.trim(),
				updatedAt: serverTimestamp(),
			});
			saved = true;
			window.setTimeout(() => (saved = false), 2000);
		} catch (err) {
			console.error(err);
			error = t('templates.couldNotSaveTemplate');
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		loadLectures();
	});
</script>

<div class="mx-auto w-full max-w-3xl px-8 py-10">
	<div class="flex items-center justify-between">
		<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">
			{t('templates.courseTemplate')}
		</p>
		<Button variant="accent" disabled={saving} onclick={handleSave}>
			{#if saving}
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></div>
				{t('common.saving')}
			{:else if saved}
				{t('common.saved')}
			{:else}
				{t('common.saveChanges')}
			{/if}
		</Button>
	</div>

	<div class="mt-4 grid grid-cols-2 gap-3">
		<Input
			label={t('templates.templateName')}
			bind:value={name}
			placeholder="e.g. Toxicology Rotation"
		/>
		<Input label={t('templates.code')} bind:value={code} placeholder="TOX 101" />
	</div>
	<div class="mt-4">
		<Textarea
			label={t('templates.description')}
			bind:value={description}
			placeholder={t('templates.templateDescriptionPlaceholder')}
			rows={2}
		/>
	</div>
	<div class="mt-8">
		<div class="mb-2 flex items-center justify-between gap-3">
			<p class="text-[13.5px] font-semibold text-ink-900">{t('templates.schedule')}</p>
			<div class="flex items-center gap-2">
				<Button variant="primary" disabled={loadingLectures} onclick={handleAddLecture}>
					<Plus class="h-3.5 w-3.5" />
					{t('templates.addLecture')}
				</Button>
				<div class="flex items-center gap-1">
					<button
						type="button"
						onclick={() => (weekOffset = weekOffset - 1)}
						class="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-900/5 hover:text-ink-900"
						aria-label={t('dashboard.previousWeek')}
					>
						<ChevronLeft class="h-3.5 w-3.5" />
					</button>
					<p class="min-w-24 text-center text-[12px] font-medium text-ink-600">
						{t('templates.week', { week: weekOffset + 1 })}
					</p>
					<button
						type="button"
						onclick={() => (weekOffset = weekOffset + 1)}
						class="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-900/5 hover:text-ink-900"
						aria-label={t('dashboard.nextWeek')}
					>
						<ChevronRight class="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>
		<p class="mb-2 text-[12.5px] text-ink-500">
			{t('templates.dragHint')}
		</p>
		<ScheduleCalendar
			{weekStart}
			events={calendarEvents}
			showDate={false}
			onCreate={handleCreateEvent}
			onEventClick={handleEventClick}
			onEventChange={handleEventChange}
		/>
	</div>

	<p class="mt-3 text-[12.5px] text-ink-500">
		{tn(
			lectures.length,
			'templates.lectureTemplatesCount',
			'templates.lectureTemplatesCountPlural',
		)}. {t('templates.lectureTemplatesClickHint')}
	</p>

	{#if error}
		<p
			class="mt-4 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600"
		>
			<AlertCircle class="h-4 w-4 shrink-0" />
			{error}
		</p>
	{/if}
</div>

<Modal
	open={selectedLecture !== null}
	title={t('templates.lectureTemplate')}
	onclose={closeLectureEditor}
	class="max-w-4xl"
	contentClass="max-h-[70vh] overflow-y-auto px-4 py-3"
>
	{#if selectedLecture}
		<TemplateLectureEditor
			templateId={draftId}
			lecture={selectedLecture}
			bare
			bind:deleteConfirmOpen
			onUpdateLecture={(patch) => handleUpdateLecture(selectedLecture.id, patch)}
			onDelete={() => {
				handleDeleteLecture(selectedLecture.id);
				closeLectureEditor();
			}}
		/>
	{/if}
	{#snippet footer()}
		<div class="flex w-full items-center justify-between">
			<Button variant="danger" onclick={() => (deleteConfirmOpen = true)}>
				<Trash2 class="h-4 w-4" />
				{t('common.delete')}
			</Button>
			<Button variant="accent" onclick={closeLectureEditor}>{t('common.save')}</Button>
		</div>
	{/snippet}
</Modal>
