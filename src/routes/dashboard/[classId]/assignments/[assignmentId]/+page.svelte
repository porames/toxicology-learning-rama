<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import AssignmentEditor from '$lib/components/dashboard/AssignmentEditor.svelte';
	import { db } from '$lib/firebase';
	import { doc, getDoc } from 'firebase/firestore';
	import type { Assignment, RequiredAttachment } from '$lib/dashboard/types';
	import { t } from '$lib/i18n';

	const classId = $derived(page.params.classId ?? '');
	const assignmentId = $derived(page.params.assignmentId ?? '');

	let assignment = $state<Assignment | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		async function load() {
			loading = true;
			error = null;
			try {
				const snap = await getDoc(doc(db, 'classes', classId, 'assignments', assignmentId));
				if (!snap.exists()) {
					error = t('common.assignmentNotFound');
					return;
				}
				assignment = {
					id: snap.id,
					...snap.data(),
					requiredAttachments: (snap.data()?.requiredAttachments ??
						[]) as RequiredAttachment[],
					assignedStudentIds: (snap.data()?.assignedStudentIds ?? []) as string[],
				} as Assignment;
			} catch (err) {
				console.error(err);
				error = t('common.somethingWentWrong');
			} finally {
				loading = false;
			}
		}
		load();
	});
</script>

<svelte:head>
	<title>RAMA Toxico | Assignment</title>
</svelte:head>

{#if loading}
	<div class="flex h-full w-full items-center justify-center">
		<div class="flex flex-col items-center gap-3">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"
			></div>
			<span class="text-[13px] text-ink-500">{t('common.loading')}</span>
		</div>
	</div>
{:else if error || !assignment}
	<div class="flex h-full w-full items-center justify-center">
		<p class="text-[13.5px] text-ink-500">{error}</p>
	</div>
{:else}
	<AssignmentEditor {classId} {assignment} onDeleted={() => goto(`/dashboard/${classId}`)} />
{/if}
