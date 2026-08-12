<script lang="ts">
	import { Check } from '@lucide/svelte';
	import type { Material } from '$lib/dashboard/types';
	import type { MaterialState } from '$lib/dashboard/materialState';
	import { t } from '$lib/i18n';

	let {
		material,
		state,
		onValueChange,
	}: {
		material: Material;
		state: MaterialState;
		onValueChange: (value: string) => void;
	} = $props();
</script>

{#if state.pdfUrl}
	<div class="flex items-center gap-2 text-[12.5px] text-emerald-600">
		<Check class="h-4 w-4" />
		<a
			href={state.pdfUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="underline hover:text-emerald-700 truncate max-w-[200px]"
		>
			{t('materials.viewPdf')}
		</a>
		<button
			type="button"
			onclick={() => {
				state.pdfUrl = '';
				onValueChange('');
			}}
			class="text-[12px] text-ink-400 hover:text-red-500 underline ml-auto"
		>
			{t('materials.remove')}
		</button>
	</div>
{/if}
