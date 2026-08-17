<script lang="ts">
	import MaterialText from './MaterialText.svelte';
	import MaterialYouTube from './MaterialYouTube.svelte';
	import MaterialVideo from './MaterialVideo.svelte';
	import MaterialQuiz from './MaterialQuiz.svelte';
	import MaterialLink from './MaterialLink.svelte';
	import MaterialEmpty from './MaterialEmpty.svelte';
	import { materialIcon } from './utils';
	import type { Component } from 'svelte';

	interface MaterialData {
		id: string;
		type: string;
		title: string;
		value: string;
		requiredPostTest?: boolean;
	}

	let {
		material,
		color,
		videoUrls,
		onStartQuiz,
		quizAttempts,
		onVideoPositionChange,
	}: {
		material: MaterialData;
		color: { bg: string; text: string };
		videoUrls: Record<string, string>;
		onStartQuiz: (quizId: string) => void;
		quizAttempts: Record<string, { passed: boolean; completedAt: Date | null }>;
		onVideoPositionChange?: (seconds: number) => void;
	} = $props();

	const icon = $derived(materialIcon(material.type));
	const shared = $derived({
		icon,
		title: material.title,
		type: material.type,
		bg: color.bg,
		text: color.text,
	});
</script>

{#if material.type === 'text'}
	<MaterialText {...shared} value={material.value} />
{:else if material.type === 'youtube' && material.value}
	<MaterialYouTube {...shared} url={material.value} />
{:else if material.type === 'video' && videoUrls[material.id]}
	<MaterialVideo
		{...shared}
		embedUrl={videoUrls[material.id]}
		onPositionChange={onVideoPositionChange}
	/>
{:else if material.type === 'quiz' && material.value}
	<MaterialQuiz
		{...shared}
		quizId={material.value}
		requiredPostTest={material.requiredPostTest}
		{onStartQuiz}
		attempt={quizAttempts[material.value]}
	/>
{:else if material.value}
	<MaterialLink {...shared} url={material.value} />
{:else}
	<MaterialEmpty {...shared} />
{/if}
