<script lang="ts">
	import {
		type Lecture,
		type ClassItem,
		type ScheduleEvent,
		type Assignment,
		type RequiredAttachment,
	} from '$lib/dashboard/types';
	import { Button, Input, Modal, DateTimeInput } from '$lib/components/ui';
	import {
		Plus,
		ChevronLeft,
		ChevronRight,
		CalendarCheck,
		Trash2,
		Library,
	} from '@lucide/svelte';
	import { db } from '$lib/firebase';
	import { collection, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { beforeNavigate, goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import moment from 'moment';
	import * as Utils from '$lib/dashboard/utils';
	import ScheduleCalendar from './schedule/ScheduleCalendar.svelte';
	import ImportLecturesFromTemplate from './schedule/ImportLecturesFromTemplate.svelte';
	import LectureEditor from './LectureEditor.svelte';
	import AssignmentEditor from './AssignmentEditor.svelte';
	import AssignmentCard from './AssignmentCard.svelte';
	import { dashboardStore } from '$lib/dashboard/dashboardStore.svelte';
	import { t, tn } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';

	let {
		selectedClass,
		onRename,
		onDeleteClass,
		onEnrolStudents,
		onViewAttendance,
	}: {
		selectedClass: ClassItem;
		onRename: (
			patch: Partial<Pick<ClassItem, 'name' | 'code' | 'classStart' | 'classEnd'>>,
		) => void;
		onDeleteClass: (classId: string) => void;
		onEnrolStudents: (classId: string) => void;
		onViewAttendance: (classId: string) => void;
	} = $props();

	let ceSaving = $state(false);
	let ceDeleting = $state(false);
	let ceShowConfirm = $state(false);

	let lastClassId = $state<string | null>(null);
	let baseline = $state({
		name: '',
		code: '',
		classStart: null as Date | null,
		classEnd: null as Date | null,
	});
	let draft = $state({
		name: '',
		code: '',
		classStart: null as Date | null,
		classEnd: null as Date | null,
	});
	let allowLeave = $state(false);
	let showLeaveWarning = $state(false);
	let pendingUrl = $state<string | null>(null);

	let showAddLectureModal = $state<boolean>(false);
	let newLectureDraft = $state<Lecture | null>(null);
	let showImportModal = $state(false);
	let saveRequested = $state(false);
	let deleteRequested = $state(false);
	let saveDisabled = $state(true);

	const dirty = $derived(
		baseline.name !== draft.name ||
			baseline.code !== draft.code ||
			(baseline.classStart?.getTime() ?? 0) !== (draft.classStart?.getTime() ?? 0) ||
			(baseline.classEnd?.getTime() ?? 0) !== (draft.classEnd?.getTime() ?? 0),
	);

	$effect(() => {
		if (lastClassId !== selectedClass.id) {
			lastClassId = selectedClass.id;
			baseline = {
				name: selectedClass.name,
				code: selectedClass.code,
				classStart: selectedClass.classStart ?? null,
				classEnd: selectedClass.classEnd ?? null,
			};
			draft = {
				name: selectedClass.name,
				code: selectedClass.code,
				classStart: selectedClass.classStart ?? null,
				classEnd: selectedClass.classEnd ?? null,
			};
			allowLeave = false;
		}
	});

	beforeNavigate((navigation) => {
		if (allowLeave || !dirty) return;
		const url = navigation.to?.url;
		if (!url) return;
		navigation.cancel();
		pendingUrl = url.pathname + url.search;
		showLeaveWarning = true;
	});

	onMount(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (dirty) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	async function handleSaveClass() {
		ceSaving = true;
		try {
			await updateDoc(doc(db, 'classes', selectedClass.id), {
				name: draft.name,
				code: draft.code,
				classStart: draft.classStart ?? null,
				classEnd: draft.classEnd ?? null,
			});
			baseline = {
				name: draft.name,
				code: draft.code,
				classStart: draft.classStart ?? null,
				classEnd: draft.classEnd ?? null,
			};
			onRename({
				name: draft.name,
				code: draft.code,
				classStart: draft.classStart,
				classEnd: draft.classEnd,
			});
		} catch (err) {
			console.error(err);
		} finally {
			ceSaving = false;
		}
	}

	function confirmLeave() {
		allowLeave = true;
		showLeaveWarning = false;
		onRename({
			name: baseline.name,
			code: baseline.code,
			classStart: baseline.classStart,
			classEnd: baseline.classEnd,
		});
		if (pendingUrl) {
			goto(pendingUrl);
		}
	}

	async function handleDeleteClass() {
		ceDeleting = true;
		try {
			const user = authState.user;
			if (!user) throw new Error('Not logged in');
			const token = await user.getIdToken();
			const res = await fetch(functionsUrl('deleteClass'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ classId: selectedClass.id }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(translateApiError(data.error));
			}
			onDeleteClass(selectedClass.id);
		} catch (err) {
			console.error(err);
		} finally {
			ceDeleting = false;
			ceShowConfirm = false;
		}
	}

	let weekOffset = $state(0);
	let editingLectureId = $state<string | null>(null);
	let lectureDirty = $state(false);
	let showDiscardConfirm = $state(false);
	let discardRequested = $state(false);

	const weekStart = $derived(moment().startOf('week').add(weekOffset, 'week').toDate());

	const calendarEvents = $derived<ScheduleEvent[]>(
		(selectedClass.lectures ?? [])
			.filter((l) => l.startTime && l.endTime)
			.map((l) => ({
				id: l.id,
				date: l.startTime,
				startTime: l.startTime,
				endTime: l.endTime,
				title: l.title || 'Untitled lecture',
			})),
	);

	const sortedLectures = $derived(
		[...(selectedClass.lectures ?? [])].sort(
			(a, b) => a.startTime.getTime() - b.startTime.getTime(),
		),
	);

	const lectureToEdit = $derived(
		editingLectureId
			? (selectedClass.lectures?.find((l) => l.id === editingLectureId) ?? null)
			: null,
	);

	function handleRequestCloseLecture() {
		if (lectureDirty) {
			showDiscardConfirm = true;
		} else {
			editingLectureId = null;
		}
	}

	function handleCloseNewLecture() {
		if (lectureDirty) {
			showDiscardConfirm = true;
		} else {
			newLectureDraft = null;
			showAddLectureModal = false;
		}
	}

	async function confirmDiscard() {
		if (newLectureDraft) {
			newLectureDraft = null;
			showAddLectureModal = false;
			showDiscardConfirm = false;
			return;
		}
		discardRequested = true;
		await tick();
		editingLectureId = null;
		showDiscardConfirm = false;
	}

	function handleDeleteLectureModal(classId: string, lectureId: string) {
		dashboardStore.deleteLecture(classId, lectureId);
		editingLectureId = null;
	}

	function handleDeleteNewLecture() {
		newLectureDraft = null;
		showAddLectureModal = false;
	}

	function handleLectureCreated(lecture: Lecture) {
		dashboardStore.insertLecture(selectedClass.id, lecture);
		newLectureDraft = null;
		showAddLectureModal = false;
	}

	function handleAddLectureLocal() {
		const { startTime, endTime } = Utils.defaultTimes();
		newLectureDraft = { id: '', title: '', startTime, endTime, materials: [] };
		showAddLectureModal = true;
	}

	function handleScheduleCreate(event: { date: Date; startTime: Date; endTime: Date }) {
		newLectureDraft = {
			id: '',
			title: '',
			startTime: event.startTime,
			endTime: event.endTime,
			materials: [],
		};
		showAddLectureModal = true;
	}

	function handleImportedLectures(lectures: Lecture[]) {
		for (const lec of lectures) {
			dashboardStore.insertLecture(selectedClass.id, lec);
		}
		showImportModal = false;
	}

	async function handleEventChange(event: ScheduleEvent, startTime: Date, endTime: Date) {
		dashboardStore.updateLecture(selectedClass.id, event.id, { startTime, endTime });
		try {
			await updateDoc(doc(db, 'classes', selectedClass.id, 'lectures', event.id), {
				startTime,
				endTime,
			});
		} catch (err) {
			console.error(err);
		}
	}

	let assignments = $state<Assignment[]>([]);
	let assignmentsLoading = $state(true);
	let assignmentsError = $state<string | null>(null);
	let showAddAssignmentModal = $state(false);
	let newAssignmentDraft = $state<Assignment | null>(null);
	let confirmingDeleteAssignment = $state<Assignment | null>(null);
	let deletingAssignment = $state(false);

	async function loadAssignments() {
		assignmentsLoading = true;
		assignmentsError = null;
		try {
			const snap = await getDocs(collection(db, 'classes', selectedClass.id, 'assignments'));
			const loaded = snap.docs.map((d) => ({
				id: d.id,
				...d.data(),
				requiredAttachments: (d.data()?.requiredAttachments ?? []) as RequiredAttachment[],
				assignedStudentIds: (d.data()?.assignedStudentIds ?? []) as string[],
			})) as Assignment[];
			loaded.sort(
				(a, b) =>
					(a.dueDate?.toDate?.()?.getTime() ?? 0) -
					(b.dueDate?.toDate?.()?.getTime() ?? 0),
			);
			assignments = loaded;
		} catch (err) {
			console.error(err);
			assignmentsError = t('classes.couldNotLoadAssignments');
		} finally {
			assignmentsLoading = false;
		}
	}

	$effect(() => {
		loadAssignments();
	});

	function handleAddAssignment() {
		newAssignmentDraft = {
			id: '',
			title: '',
			instructions: '',
			opensAt: { toDate: () => new Date() },
			dueDate: { toDate: () => new Date() },
			requiredAttachments: [],
			assignedStudentIds: [],
			createdAt: null,
		};
		showAddAssignmentModal = true;
	}

	function handleAssignmentCreated(assignment: Assignment) {
		assignments = [assignment, ...assignments].sort(
			(a, b) =>
				(a.dueDate?.toDate?.()?.getTime() ?? 0) - (b.dueDate?.toDate?.()?.getTime() ?? 0),
		);
		showAddAssignmentModal = false;
		newAssignmentDraft = null;
	}

	async function handleDeleteAssignment() {
		const target = confirmingDeleteAssignment;
		if (!target) return;
		deletingAssignment = true;
		try {
			await deleteDoc(doc(db, 'classes', selectedClass.id, 'assignments', target.id));
			assignments = assignments.filter((a) => a.id !== target.id);
			confirmingDeleteAssignment = null;
		} catch (err) {
			console.error(err);
		} finally {
			deletingAssignment = false;
		}
	}
</script>

<div class="mx-auto max-w-2xl w-full px-8">
	<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">
		{t('dashboard.class')}
	</p>
	<div class="mt-4 grid grid-cols-[1fr_auto] gap-3">
		<Input
			label={t('dashboard.className')}
			value={draft.name}
			oninput={(e) => {
				draft.name = (e.target as HTMLInputElement).value;
			}}
			placeholder="e.g. Introduction to Algorithms"
		/>
		<Input
			label={t('dashboard.code')}
			value={draft.code}
			oninput={(e) => {
				draft.code = (e.target as HTMLInputElement).value;
			}}
			placeholder="CS 201"
			class="w-28"
		/>
	</div>
	<div class="mt-4 grid grid-cols-2 gap-3">
		<DateTimeInput
			label={t('dashboard.classStart')}
			mode="date"
			value={draft.classStart ?? null}
			onchange={(v) => {
				draft.classStart = v;
			}}
		/>
		<DateTimeInput
			label={t('dashboard.classEnd')}
			mode="date"
			value={draft.classEnd ?? null}
			onchange={(v) => {
				draft.classEnd = v;
			}}
		/>
	</div>
	<Button variant="accent" disabled={ceSaving || !dirty} onclick={handleSaveClass} class="mt-4">
		{#if ceSaving}
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
			></div>
			{t('common.saving')}
		{:else}
			{t('common.saveChanges')}
		{/if}
	</Button>

	<div class="mt-8 flex items-center justify-between border-t border-ink-900/10 pt-6">
		<div>
			<p class="text-[13.5px] font-medium text-ink-900">
				{t('dashboard.studentsEnroled', {
					count: selectedClass.students ? selectedClass.students.length : 0,
				})}
			</p>
			<p class="text-[12.5px] text-ink-500">{t('dashboard.manageEnrolment')}</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<Button variant="primary" onclick={() => onEnrolStudents(selectedClass.id)}>
				<Plus class="h-3.5 w-3.5" />
				{t('dashboard.enrolStudents')}
			</Button>
			<Button variant="primary" onclick={() => onViewAttendance(selectedClass.id)}>
				<CalendarCheck class="h-3.5 w-3.5" />
				{t('dashboard.attendance')}
			</Button>
		</div>
	</div>
	<div class="mt-8 border-t border-ink-900/10 pt-6">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-[13.5px] font-medium text-ink-900">
					{t('dashboard.classAssignments')}
					<span class="ml-1.5 font-normal text-ink-300">({assignments.length})</span>
				</p>
				<p class="text-[12.5px] text-ink-500">
					{t('dashboard.createAssignmentsForStudents')}
				</p>
			</div>
			<Button variant="primary" onclick={handleAddAssignment}>
				<Plus class="h-3.5 w-3.5" />
				{t('dashboard.addAssignment')}
			</Button>
		</div>

		{#if assignmentsLoading}
			<div class="mt-4 space-y-2">
				{#each Array(2) as _}
					<div class="h-20 w-full animate-pulse rounded-lg bg-ink-900/5"></div>
				{/each}
			</div>
		{:else if assignmentsError}
			<p class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
				{assignmentsError}
			</p>
		{:else if assignments.length === 0}
			<p
				class="mt-4 rounded-lg border border-dashed border-ink-900/15 bg-ink-900/[0.015] px-4 py-8 text-center text-[13px] text-ink-500"
			>
				{t('dashboard.noAssignmentsYet')}
			</p>
		{:else}
			<div class="mt-4 space-y-2">
				{#each assignments as assignment (assignment.id)}
					<AssignmentCard
						classId={selectedClass.id}
						{assignment}
						onDelete={() => (confirmingDeleteAssignment = assignment)}
					/>
				{/each}
			</div>
		{/if}
	</div>
	<div class="mt-8 flex items-center justify-between border-t border-ink-900/10 pt-6">
		<div>
			<p class="text-[13.5px] font-medium text-ink-900">
				{tn(
					selectedClass.lectures?.length ?? 0,
					'dashboard.lecturesCount',
					'dashboard.lecturesCountPlural',
				)}
			</p>
			<p class="text-[12.5px] text-ink-500">{t('dashboard.addLectureHint')}</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<Button variant="ghost" onclick={() => (showImportModal = true)}>
				<Library class="h-3.5 w-3.5" />
				{t('dashboard.importFromTemplate')}
			</Button>
			<Button variant="primary" onclick={handleAddLectureLocal}>
				<Plus class="h-3.5 w-3.5" />
				{t('dashboard.addLecture')}
			</Button>
		</div>
	</div>
	<div class="mt-2 border-b border-ink-900/10 pt-6 pb-8">
		{#if !selectedClass.lectures || selectedClass.lectures.length === 0}
			<p
				class="rounded-lg border border-dashed border-ink-900/15 bg-ink-900/[0.015] px-4 py-8 text-center text-[13px] text-ink-500"
			>
				{t('dashboard.noLecturesYetHint')}
			</p>
		{:else}
			<div class="mb-3 flex items-center justify-between">
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
						{moment(weekStart).format('MMM D')} – {moment(weekStart)
							.add(6, 'day')
							.format('MMM D, YYYY')}
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
			<ScheduleCalendar
				{weekStart}
				events={calendarEvents}
				onCreate={handleScheduleCreate}
				onEventClick={(event) => (editingLectureId = event.id)}
				onEventChange={handleEventChange}
			/>
			<div class="mt-6">
				<p class="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-400">
					{t('dashboard.allLectures')}
				</p>
				<ul
					class="divide-y divide-ink-900/10 overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft"
				>
					{#each sortedLectures as lecture (lecture.id)}
						<li>
							<button
								type="button"
								onclick={() => (editingLectureId = lecture.id)}
								class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-900/[0.03]"
							>
								<span class="min-w-0 flex-1">
									<span
										class="block truncate text-[14px] font-medium text-ink-900"
									>
										{lecture.title || t('common.untitledLecture')}
									</span>
									<span class="block text-[12px] text-ink-500">
										{moment(lecture.startTime).format('ddd, MMM D')} · {moment(
											lecture.startTime,
										).format('HH:mm')}
										– {moment(lecture.endTime).format('HH:mm')}
									</span>
								</span>
								<span class="shrink-0 text-[12px] text-ink-400">
									{tn(
										lecture.materials?.length ?? 0,
										'dashboard.materialsCount',
										'dashboard.materialsCountPlural',
									)}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<Button variant="danger" onclick={() => (ceShowConfirm = true)} class="my-4 -mx-3.5">
		{t('dashboard.deleteThisClass')}
	</Button>

	<Modal
		open={ceShowConfirm}
		title={t('dashboard.deleteClassTitle')}
		onclose={() => (ceShowConfirm = false)}
	>
		<p class="text-[13px] text-ink-500">
			{t('dashboard.deleteClassConfirm', { name: selectedClass.name })}
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (ceShowConfirm = false)}
				>{t('common.cancel')}</Button
			>
			<Button variant="danger-solid" disabled={ceDeleting} onclick={handleDeleteClass}>
				{ceDeleting ? t('common.deletingEllipsis') : t('common.delete')}
			</Button>
		{/snippet}
	</Modal>

	<Modal
		open={showLeaveWarning}
		title={t('dashboard.unsavedChanges')}
		onclose={() => (showLeaveWarning = false)}
	>
		<p class="text-[13px] text-ink-500">
			{t('dashboard.unsavedChangesClass')}
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (showLeaveWarning = false)}
				>{t('dashboard.keepEditing')}</Button
			>
			<Button variant="danger-solid" onclick={confirmLeave}
				>{t('dashboard.discardAndLeave')}</Button
			>
		{/snippet}
	</Modal>

	<Modal
		open={showAddLectureModal}
		title={t('dashboard.createNewLecture')}
		onclose={handleCloseNewLecture}
		class="max-w-2xl"
		contentClass="max-h-[75vh] overflow-y-auto px-4 py-3"
	>
		{#if newLectureDraft}
			<LectureEditor
				{selectedClass}
				selectedLecture={newLectureDraft}
				highlightMaterialId={undefined}
				embedded
				isNew
				bind:dirty={lectureDirty}
				bind:saveRequested
				bind:deleteRequested
				bind:saveDisabled
				onUpdateLecture={(patch) => {
					if (newLectureDraft) newLectureDraft = { ...newLectureDraft, ...patch };
				}}
				onBackToClasses={() => {}}
				onBackToClass={() => {}}
				onDeleteLecture={handleDeleteNewLecture}
				onCreated={handleLectureCreated}
			/>
		{/if}
		{#snippet footer()}
			<div class="flex w-full items-center justify-between">
				<Button variant="danger" onclick={() => (deleteRequested = true)}>
					<Trash2 class="h-4 w-4" />
					{t('common.delete')}
				</Button>
				<Button
					variant="accent"
					disabled={saveDisabled}
					onclick={() => (saveRequested = true)}
				>
					{t('common.create')}
				</Button>
			</div>
		{/snippet}
	</Modal>

	<Modal
		open={showDiscardConfirm}
		title={t('dashboard.unsavedChanges')}
		onclose={() => (showDiscardConfirm = false)}
	>
		<p class="text-[13px] text-ink-500">
			{t('dashboard.unsavedChangesLecture')}
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (showDiscardConfirm = false)}
				>{t('dashboard.keepEditing')}</Button
			>
			<Button variant="danger-solid" onclick={confirmDiscard}
				>{t('dashboard.discardAndClose')}</Button
			>
		{/snippet}
	</Modal>
	<Modal
		open={editingLectureId !== null}
		title={t('dashboard.editLecture')}
		onclose={handleRequestCloseLecture}
		class="max-w-2xl"
		contentClass="max-h-[75vh] overflow-y-auto px-4 py-3"
	>
		{#if lectureToEdit}
			<LectureEditor
				{selectedClass}
				selectedLecture={lectureToEdit}
				highlightMaterialId={undefined}
				embedded
				bind:dirty={lectureDirty}
				bind:discardRequested
				bind:saveRequested
				bind:deleteRequested
				bind:saveDisabled
				onUpdateLecture={(patch) =>
					dashboardStore.updateLecture(selectedClass.id, lectureToEdit.id, patch)}
				onBackToClasses={() => {}}
				onBackToClass={() => {}}
				onDeleteLecture={handleDeleteLectureModal}
				onSaved={() => (editingLectureId = null)}
			/>
		{/if}
		{#snippet footer()}
			<div class="flex w-full items-center justify-between">
				<Button variant="danger" onclick={() => (deleteRequested = true)}>
					<Trash2 class="h-4 w-4" />
					{t('common.delete')}
				</Button>
				<Button
					variant="accent"
					disabled={saveDisabled}
					onclick={() => (saveRequested = true)}
				>
					{t('common.saveChanges')}
				</Button>
			</div>
		{/snippet}
	</Modal>

	<Modal
		open={showAddAssignmentModal}
		title={t('dashboard.createNewAssignment')}
		onclose={() => {
			showAddAssignmentModal = false;
			newAssignmentDraft = null;
		}}
		class="max-w-2xl"
		contentClass="max-h-[75vh] overflow-y-auto px-4 py-3"
	>
		{#if newAssignmentDraft}
			<AssignmentEditor
				classId={selectedClass.id}
				assignment={newAssignmentDraft}
				embedded
				isNew
				onDeleted={() => {}}
				bind:saveRequested
				bind:saveDisabled
				onCreated={handleAssignmentCreated}
			/>
		{/if}
		{#snippet footer()}
			<div class="flex w-full items-center justify-between">
				<Button
					variant="ghost"
					onclick={() => {
						showAddAssignmentModal = false;
						newAssignmentDraft = null;
					}}
				>
					{t('common.cancel')}
				</Button>
				<Button
					variant="accent"
					disabled={saveDisabled}
					onclick={() => (saveRequested = true)}
				>
					{t('dashboard.createAssignment')}
				</Button>
			</div>
		{/snippet}
	</Modal>

	<Modal
		open={confirmingDeleteAssignment !== null}
		title={t('dashboard.deleteAssignmentTitle')}
		onclose={() => (confirmingDeleteAssignment = null)}
	>
		<p class="text-[13px] text-ink-500">
			{t('dashboard.deleteAssignmentConfirm')}
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (confirmingDeleteAssignment = null)}>
				{t('common.cancel')}
			</Button>
			<Button
				variant="danger-solid"
				disabled={deletingAssignment}
				onclick={handleDeleteAssignment}
			>
				{deletingAssignment ? t('common.deletingEllipsis') : t('common.delete')}
			</Button>
		{/snippet}
	</Modal>
</div>

{#if showImportModal}
	<ImportLecturesFromTemplate
		classId={selectedClass.id}
		onClose={() => (showImportModal = false)}
		onImported={handleImportedLectures}
	/>
{/if}
