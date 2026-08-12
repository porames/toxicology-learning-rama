<script lang="ts">
	import { db } from '$lib/firebase';
	import {
		collection,
		doc,
		addDoc,
		updateDoc,
		deleteDoc,
		serverTimestamp,
	} from 'firebase/firestore';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import type { Assignment, RequiredAttachment, Student } from '$lib/dashboard/types';
	import { Button, Input, Modal, Textarea } from '$lib/components/ui';
	import { Plus, X, FileIcon, AlertCircle } from '@lucide/svelte';
	import * as Utils from '$lib/dashboard/utils';
	import moment from 'moment';
	import { t } from '$lib/i18n';

	let {
		classId,
		assignment,
		onDeleted,
		embedded = false,
		isNew = false,
		onCreated,
		saveRequested = $bindable(false),
		saveDisabled = $bindable(false),
	}: {
		classId: string;
		assignment: Assignment;
		onDeleted: () => void;
		embedded?: boolean;
		isNew?: boolean;
		onCreated?: (assignment: Assignment) => void;
		saveRequested?: boolean;
		saveDisabled?: boolean;
	} = $props();

	let title = $state(assignment.title ?? '');
	let instructions = $state(assignment.instructions ?? '');
	let opensAt = $state(
		isNew
			? moment(new Date()).format('YYYY-MM-DDTHH:mm')
			: assignment.opensAt?.toDate?.()
				? moment(assignment.opensAt.toDate()).format('YYYY-MM-DDTHH:mm')
				: '',
	);
	let dueDate = $state(
		isNew
			? moment(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).format('YYYY-MM-DDTHH:mm')
			: assignment.dueDate?.toDate?.()
				? moment(assignment.dueDate.toDate()).format('YYYY-MM-DDTHH:mm')
				: '',
	);
	let requiredAttachments = $state<RequiredAttachment[]>(assignment.requiredAttachments ?? []);
	let assignedStudentIds = $state<string[]>(assignment.assignedStudentIds ?? []);

	let students = $state<Student[]>([]);
	let rosterLoading = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let saved = $state(false);
	let showDeleteConfirm = $state(false);
	let deleting = $state(false);

	async function loadRoster() {
		const user = authState.user;
		if (!user) return;
		rosterLoading = true;
		try {
			const token = await user.getIdToken();
			const res = await fetch(functionsUrl('getStudents'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ classId }),
			});
			if (!res.ok) return;
			const data = await res.json();
			students = (data.students ?? []) as Student[];
		} catch (err) {
			console.error(err);
		} finally {
			rosterLoading = false;
		}
	}

	const opensAtError = $derived(opensAt ? Utils.validateDateTimeInput(opensAt) : null);
	const dueDateError = $derived(dueDate ? Utils.validateDateTimeInput(dueDate) : null);
	const dueAfterOpensError = $derived(
		opensAt && dueDate && new Date(dueDate).getTime() <= new Date(opensAt).getTime()
			? t('assignmentEditor.dueAfterOpen')
			: null,
	);

	function toggleStudent(id: string) {
		if (assignedStudentIds.includes(id)) {
			assignedStudentIds = assignedStudentIds.filter((s) => s !== id);
		} else {
			assignedStudentIds = [...assignedStudentIds, id];
		}
	}

	function addRequiredAttachment() {
		requiredAttachments = [
			...requiredAttachments,
			{ id: crypto.randomUUID(), instruction: '' },
		];
	}

	function updateRequiredAttachment(id: string, instruction: string) {
		requiredAttachments = requiredAttachments.map((r) =>
			r.id === id ? { ...r, instruction } : r,
		);
	}

	function removeRequiredAttachment(id: string) {
		requiredAttachments = requiredAttachments.filter((r) => r.id !== id);
	}

	async function handleSave() {
		if (!instructions.trim()) {
			error = t('assignmentEditor.instructionsRequired');
			return;
		}
		if (!opensAt) {
			error = t('assignmentEditor.openingRequired');
			return;
		}
		if (!dueDate) {
			error = t('assignmentEditor.dueDateRequired');
			return;
		}
		if (opensAtError || dueDateError) {
			error = t('assignmentEditor.fixDates');
			return;
		}
		if (new Date(dueDate).getTime() <= new Date(opensAt).getTime()) {
			error = t('assignmentEditor.dueAfterOpen');
			return;
		}

		saving = true;
		error = null;
		saved = false;
		try {
			const payload = {
				title: title.trim(),
				instructions: instructions.trim(),
				opensAt: new Date(opensAt),
				dueDate: new Date(dueDate),
				requiredAttachments: requiredAttachments.map((r) => ({
					id: r.id,
					instruction: r.instruction.trim(),
				})),
				assignedStudentIds,
			};
			if (isNew) {
				const ref = await addDoc(collection(db, 'classes', classId, 'assignments'), {
					...payload,
					createdAt: serverTimestamp(),
				});
				onCreated?.({
					id: ref.id,
					title: payload.title,
					instructions: payload.instructions,
					opensAt: { toDate: () => new Date(opensAt) },
					dueDate: { toDate: () => new Date(dueDate) },
					requiredAttachments: payload.requiredAttachments,
					assignedStudentIds: payload.assignedStudentIds,
					createdAt: null,
				});
				return;
			}
			await updateDoc(doc(db, 'classes', classId, 'assignments', assignment.id), {
				...payload,
				updatedAt: serverTimestamp(),
			});
			saved = true;
			window.setTimeout(() => (saved = false), 2000);
		} catch (err) {
			console.error(err);
			error = t('assignmentEditor.couldNotSaveAssignment');
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		deleting = true;
		try {
			await deleteDoc(doc(db, 'classes', classId, 'assignments', assignment.id));
			onDeleted();
		} catch (err) {
			console.error(err);
		} finally {
			deleting = false;
		}
	}

	$effect(() => {
		loadRoster();
	});

	$effect(() => {
		saveDisabled = isNew
			? !instructions.trim() || !opensAt || !dueDate || !!opensAtError || !!dueDateError
			: false;
	});

	$effect(() => {
		if (saveRequested) {
			saveRequested = false;
			handleSave();
		}
	});
</script>

<div class={embedded ? 'w-full min-w-0' : 'mx-auto w-full max-w-xl px-8 py-10'}>
	{#if !embedded}
		<div class="flex items-center justify-between">
			<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">
				{t('assignmentEditor.assignment')}
			</p>
			<Button variant="accent" disabled={saving} onclick={handleSave}>
				{#if saving}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
					></div>
					{t('common.saving')}
				{:else if saved}
					{t('assignmentDetail.saved')}
				{:else}
					{t('common.saveChanges')}
				{/if}
			</Button>
		</div>
	{/if}

	<div class="mt-4">
		<Input
			label={t('assignmentEditor.assignmentTitle')}
			bind:value={title}
			placeholder="e.g. Lab Report 1"
		/>
	</div>

	<div class="mt-4">
		<Textarea
			label={t('assignmentEditor.instructions')}
			bind:value={instructions}
			placeholder="e.g. Submit your lab report as a PDF before the due date."
			rows={4}
		/>
	</div>

	<div class="mt-4 grid grid-cols-2 gap-3">
		<Input
			type="datetime-local"
			label={t('assignmentEditor.openingSubmission')}
			bind:value={opensAt}
			error={opensAtError ?? ''}
			hint={t('assignmentEditor.studentsCanSubmitFrom')}
		/>
		<Input
			type="datetime-local"
			label={t('assignmentEditor.dueDate')}
			bind:value={dueDate}
			error={dueDateError ?? dueAfterOpensError ?? ''}
			hint={t('assignmentEditor.submissionsCloseAt')}
		/>
	</div>

	<div class="mt-6">
		<p class="mb-1.5 text-[13px] font-medium text-ink-700">
			{t('assignmentEditor.requiredAttachments')}
		</p>
		<p class="mb-2 text-[12.5px] text-ink-500">
			{t('assignmentEditor.requiredAttachmentsHint')}
		</p>
		{#if requiredAttachments.length > 0}
			<div class="mb-2 space-y-2">
				{#each requiredAttachments as req (req.id)}
					<div
						class="flex items-start gap-2 rounded-lg border border-ink-900/10 bg-ink-900/[0.02] p-2.5"
					>
						<FileIcon class="mt-2.5 h-4 w-4 shrink-0 text-ink-400" />
						<Input
							value={req.instruction}
							oninput={(e) =>
								updateRequiredAttachment(
									req.id,
									(e.target as HTMLInputElement).value,
								)}
							placeholder="e.g. Upload your lab report (PDF)"
							class="flex-1"
						/>
						<button
							type="button"
							onclick={() => removeRequiredAttachment(req.id)}
							aria-label={t('assignmentEditor.removeRequiredFile')}
							class="mt-2 shrink-0 rounded p-1 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
						>
							<X class="h-3.5 w-3.5" />
						</button>
					</div>
				{/each}
			</div>
		{/if}
		<Button variant="dashed" onclick={addRequiredAttachment}>
			<Plus class="h-3.5 w-3.5" />
			{t('assignmentEditor.addRequiredFile')}
		</Button>
	</div>

	<div class="mt-6">
		<p class="mb-1.5 text-[13px] font-medium text-ink-700">
			{t('assignmentEditor.assignedStudents')}
		</p>
		{#if rosterLoading}
			<div class="space-y-1.5">
				{#each Array(3) as _}
					<div class="h-8 w-full animate-pulse rounded-md bg-ink-900/5"></div>
				{/each}
			</div>
		{:else if students.length === 0}
			<p class="rounded-lg bg-ink-900/[0.03] px-3 py-2 text-[12.5px] text-ink-500">
				{t('assignmentEditor.noStudentsInClass')}
			</p>
		{:else}
			<div class="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-ink-900/10 p-2">
				{#each students as student (student.id)}
					<label
						class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition hover:bg-ink-900/[0.03]"
					>
						<input
							type="checkbox"
							checked={assignedStudentIds.includes(student.id)}
							onchange={() => toggleStudent(student.id)}
							class="h-4 w-4 rounded border-ink-900/20 text-iris-600 focus:ring-iris-500"
						/>
						<span class="min-w-0 flex-1 truncate font-medium text-ink-700">
							{student.name}
						</span>
						<span class="shrink-0 font-mono text-[11.5px] text-ink-400">
							{student.rama_id}
						</span>
					</label>
				{/each}
			</div>
		{/if}
	</div>

	{#if error}
		<p
			class="mt-4 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600"
		>
			<AlertCircle class="h-4 w-4 shrink-0" />
			{error}
		</p>
	{/if}

	{#if !embedded}
		<button
			type="button"
			onclick={() => (showDeleteConfirm = true)}
			class="mt-12 mb-4 text-[13px] font-medium text-red-500 transition hover:text-red-600"
		>
			{t('assignmentEditor.deleteThisAssignment')}
		</button>
	{/if}
</div>

{#if showDeleteConfirm}
	<Modal
		open
		title={t('assignmentEditor.deleteAssignmentTitle')}
		onclose={() => (showDeleteConfirm = false)}
	>
		<p class="text-[13px] text-ink-500">
			{t('dashboard.deleteAssignmentConfirm')}
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (showDeleteConfirm = false)}
				>{t('common.cancel')}</Button
			>
			<Button variant="danger-solid" disabled={deleting} onclick={handleDelete}>
				{deleting ? t('common.deletingEllipsis') : t('common.delete')}
			</Button>
		{/snippet}
	</Modal>
{/if}
