<script lang="ts">
	import { db } from '$lib/firebase';
	import { collection, getDocs, getDoc, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
	import { goto } from '$app/navigation';
	import { FileText, Plus, Trash2, ClipboardList, CalendarClock, FileIcon, Users } from '@lucide/svelte';
	import type { Assignment, RequiredAttachment } from '$lib/dashboard/types';
	import { Button, Modal } from '$lib/components/ui';
	import moment from 'moment';

	let { classId }: { classId: string } = $props();

	let assignments = $state<Assignment[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let className = $state('');
	let confirmingDelete = $state<Assignment | null>(null);
	let deleting = $state(false);

	async function load() {
		loading = true;
		error = null;
		try {
			const classSnap = await getDoc(doc(db, 'classes', classId));
			className = classSnap.exists() ? (classSnap.data()?.name ?? '') : '';
			const snap = await getDocs(collection(db, 'classes', classId, 'assignments'));
			assignments = snap.docs.map((d) => ({
				id: d.id,
				...d.data(),
				requiredAttachments: (d.data()?.requiredAttachments ?? []) as RequiredAttachment[],
				assignedStudentIds: (d.data()?.assignedStudentIds ?? []) as string[],
			})) as Assignment[];
			assignments.sort(
				(a, b) =>
					(a.dueDate?.toDate?.()?.getTime() ?? 0) -
					(b.dueDate?.toDate?.()?.getTime() ?? 0),
			);
		} catch (err) {
			console.error(err);
			error = "Couldn't load assignments. Try refreshing the page.";
		} finally {
			loading = false;
		}
	}

	async function handleNewAssignment() {
		try {
			const now = new Date();
			const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
			const assignmentRef = await addDoc(collection(db, 'classes', classId, 'assignments'), {
				title: '',
				instructions: '',
				opensAt: now,
				dueDate,
				requiredAttachments: [],
				assignedStudentIds: [],
				createdAt: serverTimestamp(),
			});
			goto(`/dashboard/${classId}/assignments/${assignmentRef.id}`);
		} catch (err) {
			console.error(err);
			error = "Couldn't create the assignment. Please try again.";
		}
	}

	async function handleDelete() {
		const target = confirmingDelete;
		if (!target) return;
		deleting = true;
		try {
			await deleteDoc(doc(db, 'classes', classId, 'assignments', target.id));
			assignments = assignments.filter((a) => a.id !== target.id);
			confirmingDelete = null;
		} catch (err) {
			console.error(err);
		} finally {
			deleting = false;
		}
	}

	function fmtDate(d?: { toDate?: () => Date } | Date | null): string {
		if (!d) return '—';
		const date = (d as any).toDate ? (d as any).toDate() : d;
		return moment(date).format('ddd, MMM D, YYYY · hh:mm A');
	}

	$effect(() => {
		load();
	});
</script>

<div class="mx-auto w-full min-w-0 max-w-4xl px-4 py-10 md:px-8">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="min-w-0 flex-1">
			<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">Assignments</p>
			<h1 class="mt-1 flex items-center gap-2 truncate text-[18px] font-semibold text-ink-900">
				<ClipboardList class="h-4 w-4 shrink-0 text-iris-600" />
				<span class="truncate">{className || 'Class'}</span>
			</h1>
		</div>
		<Button variant="primary" onclick={handleNewAssignment}>
			<Plus class="h-3.5 w-3.5" />
			New assignment
		</Button>
	</div>

	{#if loading}
		<div class="mt-8 space-y-2">
			{#each Array(3) as _}
				<div class="h-20 w-full animate-pulse rounded-lg bg-ink-900/5"></div>
			{/each}
		</div>
	{:else if error}
		<p class="mt-8 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>
	{:else if assignments.length === 0}
		<div class="mt-16 flex flex-col items-center justify-center px-8 text-center">
			<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-iris-50 text-iris-600">
				<ClipboardList class="h-6 w-6" />
			</div>
			<p class="mt-4 text-[15px] font-medium text-ink-900">No assignments yet</p>
			<p class="mt-1 max-w-xs text-[13.5px] text-ink-500">
				Create an assignment with instructions, a due date, and required files for students
				to submit.
			</p>
		</div>
	{:else}
		<div class="mt-8 space-y-3">
			{#each assignments as assignment (assignment.id)}
				<div class="rounded-xl border border-ink-900/10 bg-white shadow-soft">
					<div class="flex items-start justify-between gap-3 p-4">
						<button
							type="button"
							onclick={() =>
								goto(`/dashboard/${classId}/assignments/${assignment.id}`)}
							class="min-w-0 flex-1 text-left"
						>
							<div class="flex items-center gap-2">
								<FileText class="h-4 w-4 shrink-0 text-ink-400" />
								<p class="truncate text-[14.5px] font-semibold text-ink-900">
									{assignment.title ||
										assignment.instructions.split('\n')[0] ||
										'Untitled assignment'}
								</p>
							</div>
							{#if assignment.instructions}
								<p class="mt-1 line-clamp-2 text-[13px] text-ink-500">
									{assignment.instructions}
								</p>
							{/if}
							<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-500">
								<span class="inline-flex items-center gap-1">
									<CalendarClock class="h-3.5 w-3.5 text-iris-500" />
									Opens {fmtDate(assignment.opensAt)}
								</span>
								<span class="inline-flex items-center gap-1">
									<CalendarClock class="h-3.5 w-3.5 text-red-500" />
									Due {fmtDate(assignment.dueDate)}
								</span>
								<span>{assignment.requiredAttachments.length} required file{assignment.requiredAttachments.length === 1 ? '' : 's'}</span>
								<span>{assignment.assignedStudentIds.length} student{assignment.assignedStudentIds.length === 1 ? '' : 's'}</span>
							</div>
						</button>
						<div class="flex shrink-0 items-center gap-1">
							<Button
								variant="ghost"
								onclick={() =>
									goto(
										`/dashboard/${classId}/assignments/${assignment.id}/submissions`,
									)}
							>
								<Users class="h-3.5 w-3.5" />
								View submissions
							</Button>
							<button
								type="button"
								onclick={() => (confirmingDelete = assignment)}
								aria-label="Delete assignment"
								class="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
					{#if assignment.requiredAttachments.length > 0}
						<div class="border-t border-ink-900/5 px-4 py-2.5">
							<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
								Required attachments
							</p>
							<ul class="space-y-1">
								{#each assignment.requiredAttachments as req}
									<li class="flex items-start gap-2 text-[12.5px] text-ink-600">
										<FileIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
										<span>{req.instruction || 'Untitled required file'}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if confirmingDelete}
	<Modal open title="Delete assignment?" onclose={() => (confirmingDelete = null)}>
		<p class="text-[13px] text-ink-500">
			This will permanently delete this assignment and all its student submissions. This
			action cannot be undone.
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (confirmingDelete = null)}>Cancel</Button>
			<Button variant="danger-solid" disabled={deleting} onclick={handleDelete}>
				{deleting ? 'Deleting...' : 'Delete'}
			</Button>
		{/snippet}
	</Modal>
{/if}
