<script lang="ts">
	import ManageStudents from '$lib/components/dashboard/ManageStudents.svelte';
	import { t } from '$lib/i18n';
</script>

<svelte:head>
	<title>RAMA Toxico | {t('students.manageStudents')}</title>
</svelte:head>

<div class="mx-auto w-full min-w-0 px-4 py-10">
	<div class="grid grid-row gap-3">
		<h1 class="text-lg font-semibold">{t('students.manageStudents')}</h1>
		<ManageStudents enableSelection={false} />
	</div>
</div>
