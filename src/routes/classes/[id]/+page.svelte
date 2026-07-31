<script lang="ts">
	import { page } from '$app/state';
	import StudentDashboard from '$lib/components/classes/StudentDashboard.svelte';
</script>

<svelte:head>
	<title>RAMA Toxico | Class</title>
</svelte:head>

<StudentDashboard classId={page.params.id} />
