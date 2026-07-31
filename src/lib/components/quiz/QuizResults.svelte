<script lang="ts">
	import { goto } from '$app/navigation';
	import { doc, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { CheckCircle, XCircle } from '@lucide/svelte';
	import type { Quiz, QuizAttempt, Question } from '$lib/quiz-types';
	import { getOptionLabel } from '$lib/quiz-types';

	let { quizId, attemptId }: { quizId: string; attemptId: string } = $props();

	let loading = $state(true);
	let quiz = $state<Quiz | null>(null);
	let attempt = $state<QuizAttempt | null>(null);

	$effect(() => {
		async function load() {
			try {
				const [quizSnap, attemptSnap] = await Promise.all([
					getDoc(doc(db, 'quizzes', quizId)),
					getDoc(doc(db, 'quizAttempts', attemptId))
				]);
				if (!quizSnap.exists() || !attemptSnap.exists()) {
					goto('/quiz');
					return;
				}
				quiz = { id: quizSnap.id, ...quizSnap.data() } as Quiz;
				attempt = { id: attemptSnap.id, ...attemptSnap.data() } as QuizAttempt;
			} catch (err) {
				console.error(err);
			} finally {
				loading = false;
			}
		}
		load();
	});

	function formatAnswerDisplay(answer: string | string[] | undefined, question: Question): string {
		if (!answer || (Array.isArray(answer) && answer.length === 0)) return '(no answer)';
		if (Array.isArray(answer)) {
			return answer.map((id) => getOptionLabel(question.options, id)).join(', ');
		}
		if (question.type === 'short-answer') return answer;
		return getOptionLabel(question.options, answer);
	}

	function formatCorrectAnswerDisplay(question: Question): string {
		if (Array.isArray(question.correctAnswer)) {
			return question.correctAnswer.map((id) => getOptionLabel(question.options, id)).join(', ');
		}
		if (question.type === 'short-answer') return question.correctAnswer;
		return getOptionLabel(question.options, question.correctAnswer);
	}
</script>

{#if loading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"></div>
	</div>
{:else if quiz && attempt}
	{@const pct = attempt.totalPoints > 0 ? Math.round((attempt.score / attempt.totalPoints) * 100) : 0}

	<div class="mx-auto max-w-xl px-8 py-10">
		<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">Results</p>

		<div class="mt-4 rounded-xl border border-ink-900/10 bg-white p-8 shadow-soft">
			<div class="text-center">
				<p class="text-[15px] font-semibold text-ink-900">{quiz.title}</p>
				<div class="mt-6 flex items-center justify-center gap-4">
					<span class="text-5xl font-bold {attempt.passed ? 'text-emerald-600' : 'text-red-500'}">
						{pct}%
					</span>
					<div class="text-left">
						<p class="text-[14px] text-ink-500">
							{attempt.score} / {attempt.totalPoints} points
						</p>
						<span
							class="mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold {attempt.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}"
						>
							{#if attempt.passed}
								<CheckCircle class="h-3.5 w-3.5" />
								Passed
							{:else}
								<XCircle class="h-3.5 w-3.5" />
								Failed
							{/if}
						</span>
					</div>
				</div>
				<div class="mt-4 h-2.5 w-full max-w-sm mx-auto rounded-full bg-ink-900/10 overflow-hidden">
					<div
						class="h-full rounded-full transition-all {attempt.passed ? 'bg-emerald-500' : 'bg-red-500'}"
						style="width: {pct}%"
					></div>
				</div>
			</div>
		</div>

		<div class="mt-9 border-t border-ink-900/10 pt-6">
			<p class="text-[15px] font-semibold text-ink-900">
				Review
				<span class="ml-1.5 font-normal text-ink-300">
					({quiz.questions.length} questions)
				</span>
			</p>

			<div class="mt-4 space-y-3">
				{#each quiz.questions as q, i (q.id)}
					{@const attemptAnswer = attempt.answers.find((a) => a.questionId === q.id)}
					{@const correct = attemptAnswer?.correct ?? false}

					<div
						class="rounded-xl border bg-white p-5 shadow-soft {correct ? 'border-emerald-200' : 'border-red-200'}"
					>
						<div class="flex items-start gap-3">
							<span
								class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold {correct ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}"
							>
								{#if correct}
									<CheckCircle class="h-4 w-4" />
								{:else}
									<XCircle class="h-4 w-4" />
								{/if}
							</span>
							<div class="min-w-0 flex-1">
								<p class="text-[14px] font-medium text-ink-900">{q.prompt}</p>
								<p class="mt-1 text-[12.5px] font-medium text-ink-400 uppercase tracking-wider">
									{q.points} pt{q.points !== 1 ? 's' : ''}
								</p>
							</div>
						</div>

						<div class="mt-3 space-y-1.5 pl-10">
							<p class="text-[13px] text-ink-500">
								<span class="font-medium text-ink-700">Your answer:</span>
								{formatAnswerDisplay(attemptAnswer?.answer, q)}
							</p>
							{#if !correct}
								<p class="text-[13px] text-ink-500">
									<span class="font-medium text-emerald-600">Correct answer:</span>
									{formatCorrectAnswerDisplay(q)}
								</p>
							{/if}
							{#if q.explanation}
								<p class="mt-2 rounded-lg bg-ink-900/[0.03] px-3 py-2 text-[13px] text-ink-500">
									{q.explanation}
								</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
