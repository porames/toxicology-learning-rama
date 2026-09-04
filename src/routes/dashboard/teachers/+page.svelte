<script lang="ts">
	import ManageTeachers from '$lib/components/dashboard/ManageTeachers.svelte';
	import { t } from '$lib/i18n';
</script>

<svelte:head>
	<title>RAMA Toxico | {t('teachers.manageTeachers')}</title>
</svelte:head>

<div class="mx-auto w-full min-w-0 px-4 py-10">
	<div class="grid grid-row gap-3">
		<h1 class="text-lg font-semibold">{t('teachers.manageTeachers')}</h1>
		<ManageTeachers />
	</div>
</div>
