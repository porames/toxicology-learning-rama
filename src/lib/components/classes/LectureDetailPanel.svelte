<script lang="ts">
	import { ChevronLeft, ChevronRight, Check, LoaderCircle } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import moment from 'moment';
	import formatTimeRange from '$lib/formatTimeRange';
	import { MATERIAL_COLOR } from '$lib/dashboard/icons';
	import type { Lecture, ClassItem } from '$lib/dashboard/types';
	import MaterialRenderer from '$lib/components/materials/MaterialRenderer.svelte';
	import QuizResultModal from './QuizResultModal.svelte';

	interface QuizAttempt {
		passed: boolean;
		completedAt: Date | null;
	}

	interface QuizResult {
		id: string;
		score: number;
		totalPoints: number;
		passed: boolean;
		pct: number;
	}

	interface Props {
		selectedLecture: Lecture | undefined;
		displayQuiz: string | null;
		currentClass?: ClassItem;
		completedIds: Set<string>;
		checkedInTime: Date | undefined;
		completingLec: boolean;
		allRequiredPassed: boolean;
		materialsLoading: boolean;
		materialsError: string | null;
		videoUrls: Record<string, string>;
		quizAttempts: Record<string, QuizAttempt>;
		quizResult: QuizResult | null;
		onBack: () => void;
		onBackFromQuiz: () => void;
		onStartQuiz: (quizId: string) => void;
		onComplete: () => void;
		onCloseQuizResult: () => void;
		onViewAttempts: () => void;
	}

	let {
		selectedLecture,
		displayQuiz,
		currentClass,
		completedIds,
		checkedInTime,
		completingLec,
		allRequiredPassed,
		materialsLoading,
		materialsError,
		videoUrls,
		quizAttempts,
		quizResult,
		onBack,
		onBackFromQuiz,
		onStartQuiz,
		onComplete,
		onCloseQuizResult,
		onViewAttempts,
	}: Props = $props();
</script>

<div
	class={`flex-1 min-w-0 overflow-y-auto px-6 py-5 ${selectedLecture || displayQuiz ? 'block' : 'hidden md:block'}`}
>
	{#if displayQuiz}
		<div>
			<button
				onclick={onBackFromQuiz}
				class="mb-4 flex items-center gap-1.5 text-[13.5px] font-medium text-ink-500 hover:text-ink-900 transition"
			>
				<ChevronLeft size={16} />
				Back to materials
			</button>
			<p class="text-sm text-ink-500">Quiz component coming in Phase 4.</p>
		</div>
	{:else if quizResult}
		<QuizResultModal {quizResult} onClose={onCloseQuizResult} {onViewAttempts} />
	{:else if !selectedLecture}
		<div class="flex h-full flex-col items-center justify-center gap-2 text-center">
			<p class="text-sm font-medium text-ink-900">Select a lecture</p>
			<p class="max-w-xs text-sm text-ink-900/50">
				Pick a lecture from the list to see its materials.
			</p>
		</div>
	{:else}
		<div>
			<h2 class="text-base font-semibold text-ink-900">{selectedLecture.title}</h2>
			<div class="flex items-center gap-2 mt-0.5">
				<p class="text-xs text-ink-900/50">
					{moment(selectedLecture.startTime).format('Do MMM')} · {formatTimeRange(
						selectedLecture.startTime,
						selectedLecture.endTime,
					)}
				</p>
				{#if checkedInTime}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-iris-500/10 px-2 py-0.5 text-xs font-medium text-iris-600"
					>
						Checked in · {moment(checkedInTime).format('hh:mm A')}
					</span>
				{/if}
				{#if completedIds.has(selectedLecture.id)}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-600"
					>
						<Check size={12} />
						Completed
					</span>
				{/if}
			</div>

			<div class="mt-4">
				{#if materialsLoading}
					<div class="space-y-2">
						{#each Array(3) as _}
							<div class="h-10 w-full animate-pulse rounded-md bg-ink-900/5"></div>
						{/each}
					</div>
				{:else if materialsError}
					<p class="text-xs text-red-600">{materialsError}</p>
				{:else if selectedLecture.materials.length === 0}
					<p class="text-xs text-ink-900/40">
						No materials uploaded for this lecture yet.
					</p>
				{:else}
					<ul class="space-y-1.5">
						{#each selectedLecture.materials as mat}
							{@const color = MATERIAL_COLOR[mat.type]}
							<li>
								<MaterialRenderer
									material={mat}
									{color}
									{videoUrls}
									onStartQuiz={(quizId) => onStartQuiz(quizId)}
									{quizAttempts}
								/>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}

	<button
		onclick={onComplete}
		disabled={!selectedLecture ||
			completingLec ||
			(!!selectedLecture && completedIds.has(selectedLecture.id)) ||
			(!!selectedLecture && !allRequiredPassed)}
		class="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-teal-500 to-teal-700 px-4 py-2.5 md:py-2 text-sm font-semibold text-white transition hover:from-teal-500 hover:to-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:cursor-not-allowed disabled:opacity-50"
	>
		{#if completingLec}
			<LoaderCircle class="h-4 w-4 animate-spin" />
			Marking...
		{:else if selectedLecture && completedIds.has(selectedLecture.id)}
			<Check class="h-4 w-4" />
			Completed
		{:else}
			<Check class="h-4 w-4" />
			Mark as completed
		{/if}
	</button>
	{#if selectedLecture && !allRequiredPassed}
		<p class="mt-1.5 text-xs text-red-500">Please complete the required posttest first</p>
	{/if}
</div>
