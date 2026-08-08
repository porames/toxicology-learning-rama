<script lang="ts">
	import { type Lecture, type ClassItem, type ScheduleEvent } from '$lib/dashboard/types';
	import { Button, Input, Modal } from '$lib/components/ui';
	import {
		Plus,
		ChevronLeft,
		ChevronRight,
		CalendarCheck,
		ClipboardList,
		Trash2,
		Library,
	} from '@lucide/svelte';
	import { db } from '$lib/firebase';
	import { updateDoc, deleteDoc, doc } from 'firebase/firestore';
	import { beforeNavigate, goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import moment from 'moment';
	import * as Utils from '$lib/dashboard/utils';
	import ScheduleCalendar from './schedule/ScheduleCalendar.svelte';
	import ImportLecturesFromTemplate from './schedule/ImportLecturesFromTemplate.svelte';
	import LectureEditor from './LectureEditor.svelte';
	import { dashboardStore } from '$lib/dashboard/dashboardStore.svelte';

	let {
		selectedClass,
		onRename,
		onDeleteClass,
		onEnrolStudents,
		onViewAttendance,
		onViewAssignments,
	}: {
		selectedClass: ClassItem;
		onRename: (patch: Partial<Pick<ClassItem, 'name' | 'code'>>) => void;
		onDeleteClass: (classId: string) => void;
		onEnrolStudents: (classId: string) => void;
		onViewAttendance: (classId: string) => void;
		onViewAssignments: (classId: string) => void;
	} = $props();

	let ceSaving = $state(false);
	let ceDeleting = $state(false);
	let ceShowConfirm = $state(false);

	let lastClassId = $state<string | null>(null);
	let baseline = $state({ name: '', code: '' });
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
		baseline.name !== selectedClass.name || baseline.code !== selectedClass.code,
	);

	$effect(() => {
		if (lastClassId !== selectedClass.id) {
			lastClassId = selectedClass.id;
			baseline = { name: selectedClass.name, code: selectedClass.code };
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
				name: selectedClass.name,
				code: selectedClass.code,
			});
			baseline = { name: selectedClass.name, code: selectedClass.code };
		} catch (err) {
			console.error(err);
		} finally {
			ceSaving = false;
		}
	}

	function confirmLeave() {
		allowLeave = true;
		showLeaveWarning = false;
		onRename({ name: baseline.name, code: baseline.code });
		if (pendingUrl) {
			goto(pendingUrl);
		}
	}

	async function handleDeleteClass() {
		ceDeleting = true;
		try {
			await deleteDoc(doc(db, 'classes', selectedClass.id));
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
</script>

<div class="mx-auto max-w-2xl w-full px-8 py-10">
	<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">Class</p>
	<div class="mt-4 grid grid-cols-[1fr_auto] gap-3">
		<Input
			label="Class name"
			value={selectedClass.name}
			oninput={(e) => {
				const target = e.target as HTMLInputElement;
				onRename({ name: target.value });
			}}
			placeholder="e.g. Introduction to Algorithms"
		/>
		<Input
			label="Code"
			value={selectedClass.code}
			oninput={(e) => {
				const target = e.target as HTMLInputElement;
				onRename({ code: target.value });
			}}
			placeholder="CS 201"
			class="w-28"
		/>
	</div>
	<Button variant="accent" disabled={ceSaving || !dirty} onclick={handleSaveClass} class="mt-4">
		{#if ceSaving}
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
			></div>
			Saving…
		{:else}
			Save changes
		{/if}
	</Button>

	<div class="mt-8 flex items-center justify-between border-t border-ink-900/10 pt-6">
		<div>
			<p class="text-[13.5px] font-medium text-ink-900">
				{selectedClass.students ? (selectedClass.students as unknown[]).length : 0} students enroled
				in this class
			</p>
			<p class="text-[12.5px] text-ink-500">Manage students enrolment.</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<Button variant="primary" onclick={() => onEnrolStudents(selectedClass.id)}>
				<Plus class="h-3.5 w-3.5" />
				Enrol students
			</Button>
			<Button variant="primary" onclick={() => onViewAttendance(selectedClass.id)}>
				<CalendarCheck class="h-3.5 w-3.5" />
				Attendance
			</Button>
		</div>
	</div>
	<div class="mt-8 flex items-center justify-between border-t border-ink-900/10 pt-6">
		<div>
			<p class="text-[13.5px] font-medium text-ink-900">Manage class assignments</p>
		</div>
		<Button variant="primary" onclick={() => onViewAssignments(selectedClass.id)}>
			<ClipboardList class="h-3.5 w-3.5" />
			Assignments
		</Button>
	</div>
	<div class="mt-8 flex items-center justify-between border-t border-ink-900/10 pt-6">
		<div>
			<p class="text-[13.5px] font-medium text-ink-900">
				{selectedClass.lectures?.length ?? 0} lecture{selectedClass.lectures?.length === 1
					? ''
					: 's'}
			</p>
			<p class="text-[12.5px] text-ink-500">Add a lecture to start scheduling materials.</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<Button variant="ghost" onclick={() => (showImportModal = true)}>
				<Library class="h-3.5 w-3.5" />
				Import from template
			</Button>
			<Button variant="primary" onclick={handleAddLectureLocal}>
				<Plus class="h-3.5 w-3.5" />
				Add lecture
			</Button>
		</div>
	</div>
	<div class="mt-2 border-b border-ink-900/10 pt-6 pb-8">
		{#if !selectedClass.lectures || selectedClass.lectures.length === 0}
			<p
				class="rounded-lg border border-dashed border-ink-900/15 bg-ink-900/[0.015] px-4 py-8 text-center text-[13px] text-ink-500"
			>
				No lectures yet. Add one to start scheduling.
			</p>
		{:else}
			<div class="mb-3 flex items-center justify-between">
				<div class="flex items-center gap-1">
					<button
						type="button"
						onclick={() => (weekOffset = weekOffset - 1)}
						class="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-900/5 hover:text-ink-900"
						aria-label="Previous week"
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
						aria-label="Next week"
					>
						<ChevronRight class="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
			<ScheduleCalendar
				{weekStart}
				events={calendarEvents}
				onEventClick={(event) => (editingLectureId = event.id)}
				onEventChange={handleEventChange}
			/>
		{/if}
	</div>

	<Button variant="danger" onclick={() => (ceShowConfirm = true)} class="mt-8 mb-4 -mx-3.5">
		Delete this class
	</Button>

	<Modal open={ceShowConfirm} title="Delete class?" onclose={() => (ceShowConfirm = false)}>
		<p class="text-[13px] text-ink-500">
			This will permanently delete "{selectedClass.name}" and all its lectures and materials.
			This action cannot be undone.
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (ceShowConfirm = false)}>Cancel</Button>
			<Button variant="danger-solid" disabled={ceDeleting} onclick={handleDeleteClass}>
				{ceDeleting ? 'Deleting...' : 'Delete'}
			</Button>
		{/snippet}
	</Modal>

	<Modal
		open={showLeaveWarning}
		title="Unsaved changes"
		onclose={() => (showLeaveWarning = false)}
	>
		<p class="text-[13px] text-ink-500">
			You have unsaved changes to this class. If you leave now, your changes will be lost.
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (showLeaveWarning = false)}>Keep editing</Button>
			<Button variant="danger-solid" onclick={confirmLeave}>Discard &amp; leave</Button>
		{/snippet}
	</Modal>

	<Modal
		open={showAddLectureModal}
		title="Create a new lecture"
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
					Delete
				</Button>
				<Button
					variant="accent"
					disabled={saveDisabled}
					onclick={() => (saveRequested = true)}
				>
					Create
				</Button>
			</div>
		{/snippet}
	</Modal>

	<Modal
		open={showDiscardConfirm}
		title="Unsaved changes"
		onclose={() => (showDiscardConfirm = false)}
	>
		<p class="text-[13px] text-ink-500">
			You have unsaved changes to this lecture. If you close now, your changes will be lost.
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (showDiscardConfirm = false)}
				>Keep editing</Button
			>
			<Button variant="danger-solid" onclick={confirmDiscard}>Discard &amp; close</Button>
		{/snippet}
	</Modal>
	<Modal
		open={editingLectureId !== null}
		title="Edit lecture"
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
			/>
		{/if}
		{#snippet footer()}
			<div class="flex w-full items-center justify-between">
				<Button variant="danger" onclick={() => (deleteRequested = true)}>
					<Trash2 class="h-4 w-4" />
					Delete
				</Button>
				<Button
					variant="accent"
					disabled={saveDisabled}
					onclick={() => (saveRequested = true)}
				>
					Save changes
				</Button>
			</div>
		{/snippet}
	</Modal>

	<Modal
		open={showDiscardConfirm}
		title="Unsaved changes"
		onclose={() => (showDiscardConfirm = false)}
	>
		<p class="text-[13px] text-ink-500">
			You have unsaved changes to this lecture. If you close now, your changes will be lost.
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (showDiscardConfirm = false)}
				>Keep editing</Button
			>
			<Button variant="danger-solid" onclick={confirmDiscard}>Discard &amp; close</Button>
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
