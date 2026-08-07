<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ClassEditor from '$lib/components/dashboard/ClassEditor.svelte';
	import { dashboardStore } from '$lib/dashboard/dashboardStore.svelte';

	const classId = $derived(page.params.classId ?? '');
	const selectedClass = $derived(dashboardStore.getClass(classId));

	async function handleAddLecture() {
		const lectureId = await dashboardStore.addLecture(classId);
		goto(`/dashboard/${classId}/${lectureId}`);
	}

	function handleDeleteClass(cid: string) {
		dashboardStore.deleteClass(cid);
		goto('/dashboard');
	}
</script>

<svelte:head>
	<title>RAMA Toxico | Class</title>
</svelte:head>

{#if !selectedClass}
	<div class="flex h-full w-full items-center justify-center">
		<div class="flex flex-col items-center gap-3">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"
			></div>
			<span class="text-[13px] text-ink-500">Loading…</span>
		</div>
	</div>
{:else if selectedClass.lectures === undefined}
	<div class="flex h-full w-full items-center justify-center">
		<div class="flex flex-col items-center gap-3">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"
			></div>
			<span class="text-[13px] text-ink-500">Loading lectures…</span>
		</div>
	</div>
{:else}
	<ClassEditor
		{selectedClass}
		onRename={(patch) => dashboardStore.renameClass(classId, patch)}
		onAddLecture={handleAddLecture}
		onDeleteClass={handleDeleteClass}
		onSelectLecture={(cid, lid) => goto(`/dashboard/${cid}/${lid}`)}
		onEnrolStudents={(cid) => goto(`/dashboard/${cid}/students`)}
		onViewAttendance={(cid) => goto(`/dashboard/${cid}/attendance`)}
		onViewAssignments={(cid) => goto(`/dashboard/${cid}/assignments`)}
	/>
{/if}
