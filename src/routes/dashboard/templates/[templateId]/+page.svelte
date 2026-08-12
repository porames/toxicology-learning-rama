<script lang="ts">
	import { page } from '$app/state';
	import TemplateEditor from '$lib/components/dashboard/schedule/TemplateEditor.svelte';
	import { db } from '$lib/firebase';
	import { doc, getDoc } from 'firebase/firestore';
	import type { CourseTemplate } from '$lib/dashboard/types';
	import { t } from '$lib/i18n';

	const templateId = page.params.templateId ?? '';

	let template = $state<CourseTemplate | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		async function load() {
			loading = true;
			error = null;
			try {
				const snap = await getDoc(doc(db, 'courseTemplates', templateId));
				if (!snap.exists()) {
					error = t('common.templateNotFoundClient');
					return;
				}
				template = {
					id: snap.id,
					...snap.data(),
					lectures: [],
				} as unknown as CourseTemplate;
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
	<title>RAMA Toxico | Edit Template</title>
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
{:else if error || !template}
	<div class="flex h-full w-full items-center justify-center">
		<p class="text-[13.5px] text-ink-500">{error}</p>
	</div>
{:else}
	<TemplateEditor {template} />
{/if}
