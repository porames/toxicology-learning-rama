<script lang="ts">
	import moment from 'moment';
	import type { Component } from 'svelte';
	import MaterialBadge from './MaterialBadge.svelte';
	import { materialTypeLabel } from './utils';

	let {
		icon: IconComponent,
		title,
		type,
		bg,
		text: textColor,
		quizId,
		requiredPostTest = false,
		attempt,
		onStartQuiz,
	}: {
		icon: Component;
		title: string;
		type: string;
		bg: string;
		text: string;
		quizId: string;
		requiredPostTest?: boolean;
		attempt?: { passed: boolean; completedAt: Date | null };
		onStartQuiz: (quizId: string) => void;
	} = $props();

	const borderClass = $derived(
		attempt
			? attempt.passed ? 'border-emerald-300' : 'border-red-300'
			: 'border-ink-900/8'
	);
</script>

<button
	onclick={() => onStartQuiz(quizId)}
	class={`group flex w-full items-center gap-3 rounded-md border bg-white shadow px-3 py-2.5 transition-colors hover:bg-ink-900/5 text-left ${borderClass}`}
>
	<div class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${bg} ${textColor}`}>
		<IconComponent class="h-4 w-4 shrink-0" />
	</div>
	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<p class="truncate text-sm font-medium text-ink-900">{title}</p>
			<MaterialBadge label={materialTypeLabel(type)} {bg} text={textColor} />
			{#if requiredPostTest}
				<span class="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 uppercase tracking-wide">
					Required
				</span>
			{/if}
			{#if attempt?.passed}
				<span class="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 uppercase tracking-wide">
					Passed
				</span>
			{/if}
			{#if attempt && !attempt.passed}
				<span class="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 uppercase tracking-wide">
					Failed
				</span>
			{/if}
		</div>
		<p class={`text-xs ${
			attempt
				? attempt.passed ? 'text-emerald-600' : 'text-red-500'
				: 'text-ink-900/40'
		}`}>
			{#if attempt}
				{#if attempt.passed}
					&check; Passed{#if attempt.completedAt} {moment(attempt.completedAt).format('MMM D, YYYY')}{/if}
				{:else}
					Failed &middot; {attempt.completedAt ? moment(attempt.completedAt).format('MMM D, YYYY') : ''}
				{/if}
			{:else}
				Click to take quiz
			{/if}
		</p>
	</div>
</button>
