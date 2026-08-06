<script lang="ts">
	import type { ClassItem } from '$lib/dashboard/types';
	import { Button, Input, Modal } from '$lib/components/ui';
	import { Plus, ChevronRight, CalendarCheck } from '@lucide/svelte';
	import formatTimeRange from '$lib/formatTimeRange';
	import { db } from '$lib/firebase';
	import { updateDoc, deleteDoc, doc } from 'firebase/firestore';
	import { beforeNavigate, goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import moment from 'moment';
	import * as Utils from '$lib/dashboard/utils';

	let {
		selectedClass,
		onRename,
		onAddLecture,
		onDeleteClass,
		onSelectLecture,
		onEnrolStudents,
		onViewAttendance,
	}: {
		selectedClass: ClassItem;
		onRename: (patch: Partial<Pick<ClassItem, 'name' | 'code'>>) => void;
		onAddLecture: (classId: string) => void;
		onDeleteClass: (classId: string) => void;
		onSelectLecture: (classId: string, lectureId: string) => void;
		onEnrolStudents: (classId: string) => void;
		onViewAttendance: (classId: string) => void;
	} = $props();

	let ceSaving = $state(false);
	let ceDeleting = $state(false);
	let ceShowConfirm = $state(false);

	let lastClassId = $state<string | null>(null);
	let baseline = $state({ name: '', code: '' });
	let allowLeave = $state(false);
	let showLeaveWarning = $state(false);
	let pendingUrl = $state<string | null>(null);

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
</script>

<div class="mx-auto max-w-xl w-full px-8 py-10">
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
			<p class="text-[13.5px] font-medium text-ink-900">
				{selectedClass.lectures?.length ?? 0} lecture{selectedClass.lectures?.length === 1 ? '' : 's'}
			</p>
			<p class="text-[12.5px] text-ink-500">Add a lecture to start scheduling materials.</p>
		</div>
		<Button variant="primary" onclick={() => onAddLecture(selectedClass.id)}>
			<Plus class="h-3.5 w-3.5" />
			Add lecture
		</Button>
	</div>
	<div class="mt-2 flex-row border-b border-ink-900/10 pt-6 pb-8 text-sm">
		{#if selectedClass.lectures}
			{#each Utils.groupedLectures(selectedClass.lectures) as [key, lecs]}
				<div class="mb-4">
					<p class="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-2">
						{moment(lecs[0].startTime).format('ddd, MMM D, YYYY')}
					</p>
					<div class="space-y-2">
						{#each lecs as lec}
							<button
								onclick={() => onSelectLecture(selectedClass.id, lec.id)}
								class="w-full text-left rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<div class="flex items-center justify-between gap-3">
									<p class="font-medium text-gray-900 truncate">
										{lec.title || 'Untitled lecture'}
									</p>
									<p class="shrink-0 text-sm text-gray-500">
										{formatTimeRange(lec.startTime, lec.endTime)}
									</p>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<Button variant="danger" onclick={() => (ceShowConfirm = true)} class="mt-8 -mx-3.5">
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
			<Button variant="ghost" onclick={() => (showLeaveWarning = false)}>
				Keep editing
			</Button>
			<Button variant="danger-solid" onclick={confirmLeave}>
				Discard &amp; leave
			</Button>
		{/snippet}
	</Modal>
</div>
