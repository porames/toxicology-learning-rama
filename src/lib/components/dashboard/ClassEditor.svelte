<script lang="ts">
	import type { ClassItem, Selection } from '$lib/dashboard/types';
	import { Button, Input, Modal } from '$lib/components/ui';
	import { Plus, ChevronRight } from '@lucide/svelte';
	import formatTimeRange from '$lib/formatTimeRange';
	import { db } from '$lib/firebase';
	import { updateDoc, deleteDoc, doc } from 'firebase/firestore';
	import moment from 'moment';
	import * as Utils from '$lib/dashboard/utils';

	let {
		selectedClass,
		onRename,
		onAddLecture,
		onDeleteClass,
		onSelectLecture,
		onNavigate,
	}: {
		selectedClass: ClassItem;
		onRename: (patch: Partial<Pick<ClassItem, 'name' | 'code'>>) => void;
		onAddLecture: (classId: string) => void;
		onDeleteClass: (classId: string) => void;
		onSelectLecture: (sel: Selection) => void;
		onNavigate: (sel: Selection) => void;
	} = $props();

	let ceSaving = $state(false);
	let ceDeleting = $state(false);
	let ceShowConfirm = $state(false);

	async function handleSaveClass() {
		ceSaving = true;
		try {
			await updateDoc(doc(db, 'classes', selectedClass.id), {
				name: selectedClass.name,
				code: selectedClass.code,
			});
		} catch (err) {
			console.error(err);
		} finally {
			ceSaving = false;
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
	<div class="md:hidden flex items-center gap-1.5 mb-4">
		<button
			type="button"
			onclick={() => onNavigate(null)}
			class="text-[12px] text-ink-400 hover:text-iris-600 transition-colors"
		>
			All Classes
		</button>
		<ChevronRight class="h-3 w-3 text-ink-300" />
		<span class="text-[12px] font-medium text-ink-900">{selectedClass.name}</span>
	</div>
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
	<Button variant="accent" disabled={ceSaving} onclick={handleSaveClass} class="mt-4">
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
		<Button
			variant="primary"
			onclick={() => onNavigate({ level: 'enrol_student', classId: selectedClass.id })}
		>
			<Plus class="h-3.5 w-3.5" />
			Enrol students
		</Button>
	</div>
	<div class="mt-8 flex items-center justify-between border-t border-ink-900/10 pt-6">
		<div>
			<p class="text-[13.5px] font-medium text-ink-900">
				{selectedClass.lectures?.length ?? 0} lecture
				{(selectedClass.lectures?.length ?? 0) === 1 ? '' : 's'}
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
								onclick={() =>
									onSelectLecture({
										level: 'lecture',
										classId: selectedClass.id,
										lectureId: lec.id,
									})}
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
</div>
