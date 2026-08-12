<script lang="ts">
	import { goto } from '$app/navigation';
	import { doc, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { Check, Pencil, ArrowLeft } from '@lucide/svelte';
	import type { Quiz, Question } from '$lib/quiz-types';
	import { getOptionLabel, getQuestionTypeLabel } from '$lib/quiz-types';
	import Markdown from '$lib/components/ui/Markdown.svelte';
	import ImageContainer from '$lib/components/ui/ImageContainer.svelte';
	import { t, tn } from '$lib/i18n';

	let { quizId }: { quizId: string } = $props();

	let loading = $state(true);
	let quiz = $state<Quiz | null>(null);

	$effect(() => {
		async function load() {
			try {
				const snap = await getDoc(doc(db, 'quizzes', quizId));
				if (!snap.exists()) {
					goto('/quiz');
					return;
				}
				quiz = { id: snap.id, ...snap.data() } as Quiz;
			} catch (err) {
				console.error(err);
			} finally {
				loading = false;
			}
		}
		load();
	});

	function isCorrect(question: Question, optionId: string): boolean {
		if (Array.isArray(question.correctAnswer)) {
			return question.correctAnswer.includes(optionId);
		}
		return question.correctAnswer === optionId;
	}

	function formatCorrectAnswer(question: Question): string {
		if (Array.isArray(question.correctAnswer)) {
			return question.correctAnswer
				.map((id) => getOptionLabel(question.options, id))
				.join(', ');
		}
		if (question.type === 'short-answer') return question.correctAnswer;
		return getOptionLabel(question.options, question.correctAnswer);
	}
</script>

{#if loading}
	<div class="flex min-h-screen items-center justify-center">
		<div
			class="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
		></div>
	</div>
{:else if quiz}
	<div class="mx-auto w-2xl px-8 py-10">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">
					{t('quiz.preview')}
				</p>
				<h1 class="mt-1 text-[18px] font-semibold text-ink-900">
					{quiz.title || t('common.untitledQuiz')}
				</h1>
				<p class="mt-0.5 text-[13px] text-ink-500">
					{tn(
						quiz.questions?.length || 0,
						'quiz.questionsCount',
						'quiz.questionsCountPlural',
					)} · {t('quiz.pass')}: {quiz.passingScore ?? 70}%{#if quiz.shuffleQuestions}
						· {t('quiz.shuffled')}{/if}
				</p>
			</div>
			<button
				onclick={() => goto(`/quiz/${quizId}/edit`)}
				class="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800"
			>
				<Pencil class="h-3.5 w-3.5" />
				{t('quiz.editQuiz')}
			</button>
		</div>

		{#if quiz.questions?.length === 0}
			<div class="mt-8 rounded-xl border border-dashed border-ink-900/15 py-12 text-center">
				<p class="text-[14px] text-ink-500">{t('quiz.noQuestionsInQuiz')}</p>
				<button
					onclick={() => goto(`/quiz/${quizId}/edit`)}
					class="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-iris-600 hover:text-iris-700"
				>
					<ArrowLeft class="h-3.5 w-3.5" />
					{t('quiz.addQuestions')}
				</button>
			</div>
		{:else}
			<div class="mt-8 space-y-4">
				{#each quiz.questions as q, i (q.id)}
					<div class="rounded-xl border border-ink-900/10 bg-white p-5 shadow-soft">
						<div class="flex items-start gap-3">
							<span
								class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-iris-50 text-[13px] font-semibold text-iris-600"
							>
								{i + 1}
							</span>
							<div class="min-w-0 flex-1">
								<Markdown value={q.prompt} />
								<p
									class="mt-1 text-[12.5px] font-medium uppercase tracking-wider text-ink-400"
								>
									{getQuestionTypeLabel(q.type)} · {tn(
										q.points,
										'quiz.pointsCount',
										'quiz.pointsCountPlural',
									)}
								</p>
							</div>
						</div>

						{#if q.imageUrl}
							<div class="mt-4 overflow-hidden rounded-lg border border-ink-900/10">
								<ImageContainer imageUrl={q.imageUrl} height="h-64" />
							</div>
						{/if}

						<div class="mt-4 space-y-2">
							{#if q.type === 'true-false'}
								<div class="flex gap-3">
									{#each q.options as opt (opt.id)}
										{@const correct = isCorrect(q, opt.id)}
										<div
											class="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-[14px] font-medium {correct
												? 'border-emerald-400 bg-emerald-50 text-emerald-700'
												: 'border-ink-900/10 text-ink-600'}"
										>
											{#if correct}
												<Check class="h-4 w-4 shrink-0" />
											{/if}
											{opt.value}
										</div>
									{/each}
								</div>
							{:else if q.type === 'short-answer'}
								<div
									class="rounded-lg border border-dashed border-ink-900/15 bg-ink-900/[0.02] px-4 py-3"
								>
									<p
										class="text-[12px] font-medium uppercase tracking-wider text-ink-300"
									>
										{t('quiz.expectedAnswer')}
									</p>
									<p
										class="mt-1 flex items-center gap-1.5 text-[14px] font-medium text-emerald-700"
									>
										<Check class="h-4 w-4 shrink-0" />
										{q.correctAnswer}
									</p>
								</div>
							{:else}
								{#each q.options as opt, oi (opt.id)}
									{@const correct = isCorrect(q, opt.id)}
									<div
										class="flex items-center gap-3 rounded-lg border px-4 py-3 text-[14px] {correct
											? 'border-emerald-400 bg-emerald-50 text-emerald-700'
											: 'border-ink-900/10 text-ink-700'}"
									>
										<span
											class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border {correct
												? 'border-emerald-500 bg-emerald-500 text-white'
												: 'border-ink-900/15 text-ink-400'}"
										>
											{#if correct}
												<Check class="h-3 w-3" />
											{:else}
												{String.fromCharCode(65 + oi)}
											{/if}
										</span>
										<span class="min-w-0 flex-1"
											>{opt.value || t('quiz.optionN', { n: oi + 1 })}</span
										>
									</div>
								{/each}
							{/if}
						</div>

						{#if q.explanation}
							<div
								class="mt-4 rounded-lg border border-ink-900/5 bg-ink-900/[0.03] px-4 py-3 text-[13px] text-ink-500"
							>
								<span class="font-medium text-ink-700"
									>{t('quiz.explanation')}:
								</span>
								{q.explanation}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<div class="mt-6 text-center text-[12.5px] text-ink-400">
				{t('quiz.correctAnswersHighlighted')}
			</div>
		{/if}
	</div>
{/if}
