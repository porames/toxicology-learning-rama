<script lang="ts">
	import { page } from '$app/state';
	import EnrolStudents from '$lib/components/dashboard/EnrolStudents.svelte';

	const classId = $derived(page.params.classId ?? '');
</script>

<svelte:head>
	<title>RAMA Toxico | Students</title>
</svelte:head>

<EnrolStudents {classId} />
