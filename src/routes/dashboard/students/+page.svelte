<script lang="ts">
	import ManageStudents from '$lib/components/dashboard/ManageStudents.svelte';
</script>

<svelte:head>
	<title>RAMA Toxico | Manage students</title>
</svelte:head>

<div class="mx-auto w-full min-w-0 px-4 py-10">
	<div class="grid grid-row gap-3">
		<h1 class="text-lg font-semibold">Manage students</h1>
		<ManageStudents enableSelection={false} />
	</div>
</div>
