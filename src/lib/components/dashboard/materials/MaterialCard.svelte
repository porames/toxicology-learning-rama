<script lang="ts">
	import { GripVertical, Trash2 } from '@lucide/svelte';
	import { Input } from '$lib/components/ui';
	import { createSortable } from '@dnd-kit/svelte/sortable';
	import type { Component, Snippet } from 'svelte';
	import type { Material } from '$lib/dashboard/types';
	import type { MaterialState } from '$lib/dashboard/materialState';
	import { t } from '$lib/i18n';

	let {
		material,
		state,
		index,
		Icon,
		color,
		highlighted = false,
		onTitleChange,
		onDelete,
		children,
	}: {
		material: Material;
		state: MaterialState;
		index: number;
		Icon: Component;
		color: { text: string; bg: string; ring: string };
		highlighted: boolean;
		onTitleChange: (title: string) => void;
		onDelete: () => void;
		children: Snippet;
	} = $props();

	const sortable = createSortable({
		id: material.id,
		index,
		data: { title: material.title, type: material.type },
	});
</script>

<div
	{@attach sortable.attach}
	class={`rounded-xl border bg-white p-3.5 transition ${
		highlighted ? `border-transparent ring-2 ${color.ring}` : 'border-ink-900/10'
	} ${sortable.isDragging ? 'opacity-60' : ''} ${
		sortable.isDropTarget ? 'border-iris-400 ring-2 ring-iris-400/30' : ''
	}`}
>
	<div class="flex items-start gap-1.5">
		<button
			type="button"
			{@attach sortable.attachHandle}
			class="mt-1 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-ink-300 transition active:cursor-grabbing hover:text-ink-500"
			aria-label={t('materials.dragToReorder')}
		>
			<GripVertical class="h-4 w-4" />
		</button>
		<div class="flex items-start gap-2.5 min-w-0 flex-1">
			<span
				class={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${color.bg} ${color.text}`}
			>
				<Icon class="h-3.5 w-3.5" />
			</span>

			<div class="min-w-0 flex-1 space-y-2">
				<Input
					value={material.title}
					oninput={(e) => {
						const target = e.target as HTMLInputElement;
						onTitleChange(target.value);
					}}
					placeholder={t('materials.materialTitle')}
				/>

				{@render children()}
			</div>

			<button
				type="button"
				disabled={state.deleting}
				onclick={onDelete}
				aria-label={t('materials.deleteMaterial')}
				class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-300 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
			>
				{#if state.deleting}
					<div
						class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-900/10 border-t-red-500"
					></div>
				{:else}
					<Trash2 class="h-3.5 w-3.5" />
				{/if}
			</button>
		</div>
	</div>
</div>
