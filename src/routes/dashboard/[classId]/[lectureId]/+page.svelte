<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import LectureEditor from '$lib/components/dashboard/LectureEditor.svelte';
	import { dashboardStore } from '$lib/dashboard/dashboardStore.svelte';
	import { t } from '$lib/i18n';

	const classId = $derived(page.params.classId ?? '');
	const lectureId = $derived(page.params.lectureId ?? '');
	const selectedClass = $derived(dashboardStore.getClass(classId));
	const selectedLecture = $derived(dashboardStore.getLecture(classId, lectureId));

	function handleDeleteLecture(cid: string, lid: string) {
		dashboardStore.deleteLecture(cid, lid);
		goto(`${base}/#/dashboard/${cid}`);
	}
</script>

<svelte:head>
	<title>RAMA Toxico | Lecture</title>
</svelte:head>

{#if !selectedClass || !selectedLecture}
	<div class="flex h-full w-full items-center justify-center">
		<div class="flex flex-col items-center gap-3">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"
			></div>
			<span class="text-[13px] text-ink-500">{t('common.loading')}</span>
		</div>
	</div>
{:else}
	<LectureEditor
		{selectedClass}
		{selectedLecture}
		highlightMaterialId={undefined}
		onUpdateLecture={(patch) => dashboardStore.updateLecture(classId, lectureId, patch)}
		onBackToClasses={() => goto(`${base}/#/dashboard`)}
		onBackToClass={() => goto(`${base}/#/dashboard/${classId}`)}
		onDeleteLecture={handleDeleteLecture}
	/>
{/if}
