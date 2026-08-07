<script lang="ts">
	import { page } from '$app/state';
	import AssignmentsView from '$lib/components/dashboard/AssignmentsView.svelte';

	const classId = $derived(page.params.classId ?? '');
</script>

<svelte:head>
	<title>RAMA Toxico | Assignments</title>
</svelte:head>

<AssignmentsView {classId} />
