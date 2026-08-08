<script lang="ts">
	import { MATERIAL_ICON, MATERIAL_COLOR } from '$lib/dashboard/icons';
	import type { Material } from '$lib/dashboard/types';
	import type { MaterialState } from '$lib/dashboard/materialState';
	import MaterialCard from './MaterialCard.svelte';
	import MaterialLinkEditor from './MaterialLinkEditor.svelte';
	import MaterialTextEditor from './MaterialTextEditor.svelte';
	import MaterialPdfEditor from './MaterialPdfEditor.svelte';
	import MaterialFileEditor from './MaterialFileEditor.svelte';
	import MaterialQuizEditor from './MaterialQuizEditor.svelte';
	import MaterialVideoEditor from './MaterialVideoEditor.svelte';

	let {
		material,
		state,
		index,
		classId,
		lectureId,
		highlighted = false,
		onTitleChange,
		onValueChange,
		onDelete,
		onTogglePostTest,
		persistValue,
	}: {
		material: Material;
		state: MaterialState;
		index: number;
		classId: string;
		lectureId: string;
		highlighted: boolean;
		onTitleChange: (title: string) => void;
		onValueChange: (value: string) => void;
		onDelete: () => void;
		onTogglePostTest: (checked: boolean) => Promise<void>;
		persistValue?: (value: string) => Promise<void>;
	} = $props();
</script>

<MaterialCard
	{material}
	{state}
	{index}
	Icon={MATERIAL_ICON[material.type]}
	color={MATERIAL_COLOR[material.type]}
	{highlighted}
	{onTitleChange}
	{onDelete}
>
	{#if material.type === 'link'}
		<MaterialLinkEditor {material} {onValueChange} />
	{:else if material.type === 'text'}
		<MaterialTextEditor {material} {onValueChange} />
	{:else if material.type === 'pdf'}
		<MaterialPdfEditor {material} {state} {onValueChange} />
	{:else if material.type === 'file'}
		<MaterialFileEditor
			{material}
			{state}
			{classId}
			{lectureId}
			{onValueChange}
			{persistValue}
		/>
	{:else if material.type === 'quiz'}
		<MaterialQuizEditor {material} {state} {onTogglePostTest} />
	{:else if material.type === 'video'}
		<MaterialVideoEditor
			{material}
			{state}
			{classId}
			{lectureId}
			{onValueChange}
			{persistValue}
		/>
	{/if}
</MaterialCard>
