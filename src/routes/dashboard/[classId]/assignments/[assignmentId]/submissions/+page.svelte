<script lang="ts">
	import { page } from '$app/state';
	import SubmissionsView from '$lib/components/dashboard/SubmissionsView.svelte';

	const classId = page.params.classId ?? '';
	const assignmentId = page.params.assignmentId ?? '';
</script>

<svelte:head>
	<title>RAMA Toxico | Submissions</title>
</svelte:head>

<SubmissionsView {classId} {assignmentId} />
