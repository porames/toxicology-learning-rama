<script lang="ts">
	import { page } from '$app/state';
	import AttendanceView from '$lib/components/dashboard/AttendanceView.svelte';

	const classId = $derived(page.params.classId ?? '');
</script>

<svelte:head>
	<title>RAMA Toxico | Attendance</title>
</svelte:head>

<AttendanceView {classId} />
