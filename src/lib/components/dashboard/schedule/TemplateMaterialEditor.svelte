<script lang="ts">
	import type { Material } from '$lib/dashboard/types';
	import { MATERIAL_ICON, MATERIAL_COLOR } from '$lib/dashboard/icons';
	import { initMaterialState } from '$lib/dashboard/materialState';
	import MaterialCard from '../materials/MaterialCard.svelte';
	import MaterialLinkEditor from '../materials/MaterialLinkEditor.svelte';
	import MaterialTextEditor from '../materials/MaterialTextEditor.svelte';
	import MaterialPdfEditor from '../materials/MaterialPdfEditor.svelte';
	import MaterialQuizEditor from '../materials/MaterialQuizEditor.svelte';
	import MaterialVideoEditor from '../materials/MaterialVideoEditor.svelte';
	import MaterialFileEditor from '../materials/MaterialFileEditor.svelte';

	let {
		material,
		index,
		templateId,
		lectureId,
		onTitleChange,
		onValueChange,
		onTogglePostTest,
		onDelete,
		persistValue,
	}: {
		material: Material;
		index: number;
		templateId: string;
		lectureId: string;
		onTitleChange: (title: string) => void;
		onValueChange: (value: string) => void;
		onTogglePostTest: (checked: boolean) => Promise<void>;
		onDelete: () => void;
		persistValue: (value: string) => Promise<void>;
	} = $props();

	const state = $state(initMaterialState(material));
</script>

<MaterialCard
	{material}
	{state}
	{index}
	Icon={MATERIAL_ICON[material.type]}
	color={MATERIAL_COLOR[material.type]}
	highlighted={false}
	{onTitleChange}
	{onDelete}
>
	{#if material.type === 'link'}
		<MaterialLinkEditor {material} {onValueChange} />
	{:else if material.type === 'text'}
		<MaterialTextEditor {material} {onValueChange} />
	{:else if material.type === 'pdf'}
		<MaterialPdfEditor {material} {state} {onValueChange} />
	{:else if material.type === 'quiz'}
		<MaterialQuizEditor {material} {state} {onTogglePostTest} />
	{:else if material.type === 'video'}
		<MaterialVideoEditor
			{material}
			{state}
			classId={templateId}
			lectureId={lectureId}
			{onValueChange}
			{persistValue}
		/>
	{:else if material.type === 'file'}
		<MaterialFileEditor
			{material}
			{state}
			classId={templateId}
			lectureId={lectureId}
			{onValueChange}
			{persistValue}
		/>
	{/if}
</MaterialCard>
