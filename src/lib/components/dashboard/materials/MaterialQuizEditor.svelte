<script lang="ts">
	import { FileQuestion } from '@lucide/svelte';
	import type { Material } from '$lib/dashboard/types';
	import type { MaterialState } from '$lib/dashboard/materialState';

	let {
		material,
		state,
		onTogglePostTest,
	}: {
		material: Material;
		state: MaterialState;
		onTogglePostTest: (checked: boolean) => Promise<void>;
	} = $props();
</script>

<div class="space-y-2">
	<div class="flex items-center gap-2">
		<FileQuestion class="h-5 w-5 shrink-0 text-iris-500" />
		<span class="text-[13px] text-ink-700">{material.title || 'Untitled quiz'}</span>
		{#if material.value}
			<button
				type="button"
				onclick={() => {
					window.open(`/quiz/${material.value}/edit`, '_blank');
				}}
				class="ml-auto text-[12px] font-medium text-iris-600 underline hover:text-iris-700"
			>
				Edit quiz
			</button>
		{/if}
	</div>
	<label class="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-600">
		<input
			type="checkbox"
			checked={state.requiredPostTest}
			onchange={async (e) => {
				const checked = (e.target as HTMLInputElement).checked;
				state.requiredPostTest = checked;
				try {
					await onTogglePostTest(checked);
				} catch (err) {
					console.error(err);
					state.requiredPostTest = !checked;
				}
			}}
			class="h-3.5 w-3.5 rounded border-ink-900/20 text-iris-500"
		/>
		Required post-test
	</label>
</div>
