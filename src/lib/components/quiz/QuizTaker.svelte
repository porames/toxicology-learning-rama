<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
	import { db, auth } from '$lib/firebase';
	import { functionsUrl } from '$lib/functionsUrl';
	import { Play, CheckCircle, XCircle } from '@lucide/svelte';
	import type { Quiz, Question, QuizAttempt } from '$lib/quiz-types';
	import moment from 'moment';
	import Markdown from '$lib/components/ui/Markdown.svelte';
	import ImageContainer from '$lib/components/ui/ImageContainer.svelte';
	import { t, tn } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';

	let {
		quizId,
		lectureId,
		oncomplete,
	}: {
		quizId: string;
		lectureId?: string;
		oncomplete?: (result: {
			id: string;
			score: number;
			totalPoints: number;
			passed: boolean;
			pct: number;
		}) => void;
	} = $props();

	let loading = $state(true);
	let quiz = $state<Quiz | null>(null);
	let answers = $state<Record<string, string | string[]>>({});
	let submitting = $state(false);
	let started = $state(false);
	let previousAttempts = $state<QuizAttempt[]>([]);

	let shuffledQuestions = $derived.by(() => {
		if (!quiz) return [];
		const qs = [...quiz.questions];
		if (quiz.shuffleQuestions) {
			for (let i = qs.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[qs[i], qs[j]] = [qs[j], qs[i]];
			}
		}
		return qs;
	});

	const latestAttempt = $derived(
		previousAttempts.length > 0
			? previousAttempts.reduce((a, b) => {
					const aTime = a.completedAt?.toDate?.()?.getTime() ?? 0;
					const bTime = b.completedAt?.toDate?.()?.getTime() ?? 0;
					return aTime > bTime ? a : b;
				})
			: null,
	);

	$effect(() => {
		async function load() {
			try {
				const snap = await getDoc(doc(db, 'quizzes', quizId));
				if (!snap.exists()) {
					goto(`${base}/#/quiz`);
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

	$effect(() => {
		const user = auth.currentUser;
		if (!user) return;

		async function loadAttempts() {
			try {
				const constraints = [
					where('authId', '==', user!.uid),
					where('quizId', '==', quizId),
				];
				if (lectureId) {
					constraints.push(where('lectureId', '==', lectureId));
				}
				const q = query(collection(db, 'quizAttempts'), ...constraints);
				const snap = await getDocs(q);
				previousAttempts = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as QuizAttempt);
			} catch (err) {
				console.error(err);
			}
		}
		loadAttempts();
	});

	function setAnswer(questionId: string, value: string | string[]) {
		answers = { ...answers, [questionId]: value };
	}

	async function handleSubmit() {
		if (!quiz) return;
		submitting = true;
		try {
			const token = await auth.currentUser?.getIdToken();
			const body: Record<string, unknown> = { quizId, answers };
			if (lectureId) body.lectureId = lectureId;
			const res = await fetch(functionsUrl('submitQuiz'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(translateApiError(err.error));
			}

			const data = await res.json();
			if (oncomplete) {
				oncomplete(data);
				submitting = false;
				return;
			}
			goto(`${base}/#/quiz/${quizId}/results/${data.id}`);
		} catch (err) {
			console.error(err);
			submitting = false;
		}
	}
</script>

{#if loading}
	<div class="flex min-h-screen items-center justify-center">
		<div
			class="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
		></div>
	</div>
{:else if quiz}
	{#if !started}
		<!-- StartPage -->
		<div class="mx-auto max-w-4xl w-4xl px-8 py-10" style="height: max-content">
			<div class="rounded-xl border border-ink-900/10 bg-white p-8 shadow-soft">
				<div class="text-center">
					<h1 class="text-2xl font-bold text-ink-900">{quiz.title}</h1>
					<p class="mt-1 text-[14px] text-ink-500">
						{tn(
							quiz.questions.length,
							'quiz.questionsCount',
							'quiz.questionsCountPlural',
						)}
					</p>
				</div>

				<div class="mt-6 grid grid-cols-2 gap-3">
					<div
						class="rounded-lg border border-ink-900/10 bg-ink-900/[0.02] px-4 py-3 text-center"
					>
						<p class="text-[24px] font-bold text-ink-900">{quiz.questions.length}</p>
						<p class="text-[12px] text-ink-500">{t('quiz.questions')}</p>
					</div>
					<div
						class="rounded-lg border border-ink-900/10 bg-ink-900/[0.02] px-4 py-3 text-center"
					>
						<p class="text-[24px] font-bold text-emerald-600">
							{quiz.passingScore ?? 70}%
						</p>
						<p class="text-[12px] text-ink-500">{t('quiz.passingScore')}</p>
					</div>
				</div>

				{#if previousAttempts.length > 0}
					<div class="mt-6">
						<p class="text-[13px] font-semibold text-ink-900 mb-2">
							{t('quiz.previousAttempts', { count: previousAttempts.length })}
						</p>
						<div class="space-y-1.5">
							{#each [...previousAttempts]
								.sort((a, b) => {
									const aTime = a.completedAt?.toDate?.()?.getTime() ?? 0;
									const bTime = b.completedAt?.toDate?.()?.getTime() ?? 0;
									return bTime - aTime;
								})
								.slice(0, 5) as attempt}
								{@const pct =
									attempt.totalPoints > 0
										? Math.round((attempt.score / attempt.totalPoints) * 100)
										: 0}
								<div
									class="flex items-center gap-3 rounded-lg border border-ink-900/10 px-4 py-2.5"
								>
									{#if attempt.passed}
										<CheckCircle class="h-4 w-4 shrink-0 text-emerald-500" />
									{:else}
										<XCircle class="h-4 w-4 shrink-0 text-red-500" />
									{/if}
									<div class="min-w-0 flex-1">
										<p class="text-[13px] font-medium text-ink-900">
											{attempt.score} / {attempt.totalPoints} ({pct}%)
										</p>
									</div>
									{#if attempt.completedAt}
										<p class="shrink-0 text-[11px] text-ink-400">
											{moment(attempt.completedAt.toDate()).format(
												'MMM D, YYYY',
											)}
										</p>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<button
					onclick={() => (started = true)}
					class="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-4 py-3 text-[15px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800"
				>
					<Play class="h-5 w-5" />
					{latestAttempt ? t('quiz.retakeQuiz') : t('quiz.startQuiz')}
				</button>
			</div>
		</div>
	{:else}
		<!-- Quiz taking view -->
		{@const answeredCount = Object.keys(answers).length}
		{@const totalQuestions = quiz.questions.length}
		{@const allAnswered = answeredCount >= totalQuestions}

		<div class="mx-auto max-w-4xl w-4xl px-8 py-10" style="height: max-content">
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">
						{t('quiz.takingQuiz')}
					</p>
					<h1 class="mt-1 text-[18px] font-semibold text-ink-900">{quiz.title}</h1>
					<p class="mt-0.5 text-[13px] text-ink-500">
						{t('quiz.answeredOf', { answered: answeredCount, total: totalQuestions })}
					</p>
				</div>
				<div class="flex items-center gap-2">
					<div class="h-2 w-32 rounded-full bg-ink-900/10 overflow-hidden">
						<div
							class="h-full rounded-full bg-iris-500 transition-all"
							style="width: {totalQuestions
								? (answeredCount / totalQuestions) * 100
								: 0}%"
						></div>
					</div>
				</div>
			</div>

			<div class="mt-8 space-y-4">
				{#each shuffledQuestions as q, i (q.id)}
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
									class="mt-3 text-[12.5px] font-medium text-ink-400 uppercase tracking-wider"
								>
									{tn(q.points, 'quiz.pointsCount', 'quiz.pointsCountPlural')}
								</p>
							</div>
						</div>

						{#if q.imageUrl}
							<ImageContainer
								imageUrl={q.imageUrl}
								class="mt-4 overflow-hidden rounded-lg border border-ink-900/10"
							/>
						{/if}

						<div class="mt-4 space-y-2">
							{#if q.type === 'multiple-choice'}
								{#each q.options as opt (opt.id)}
									<label
										class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-[14px] transition {answers[
											q.id
										] === opt.id
											? 'border-iris-400 bg-iris-50 text-iris-700'
											: 'border-ink-900/10 text-ink-700 hover:border-ink-900/20'}"
									>
										<input
											type="radio"
											name="q-{i}-{q.id}"
											value={opt.id}
											checked={answers[q.id] === opt.id}
											onchange={() => setAnswer(q.id, opt.id)}
											class="h-4 w-4 shrink-0 accent-iris-500 hidden"
										/>
										<input
											type="radio"
											name="q-{i}-{q.id}"
											checked={answers[q.id] === opt.id}
											onchange={() => setAnswer(q.id, opt.id)}
											class="h-4 w-4 shrink-0 accent-iris-500"
										/>
										{opt.value}
									</label>
								{/each}
							{/if}

							{#if q.type === 'multiple-answer'}
								{#each q.options as opt (opt.id)}
									{@const checked =
										Array.isArray(answers[q.id]) &&
										answers[q.id]!.includes(opt.id)}
									<label
										class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-[14px] transition {checked
											? 'border-iris-400 bg-iris-50 text-iris-700'
											: 'border-ink-900/10 text-ink-700 hover:border-ink-900/20'}"
									>
										<input
											type="checkbox"
											{checked}
											onchange={(e) => {
												const arr = Array.isArray(answers[q.id])
													? [...(answers[q.id] as string[])]
													: [];
												if ((e.target as HTMLInputElement).checked) {
													setAnswer(q.id, [...arr, opt.id]);
												} else {
													setAnswer(
														q.id,
														arr.filter((a) => a !== opt.id),
													);
												}
											}}
											class="h-4 w-4 shrink-0 accent-iris-500"
										/>
										{opt.value}
									</label>
								{/each}
							{/if}

							{#if q.type === 'true-false'}
								<div class="flex gap-3">
									{#each q.options as opt (opt.id)}
										<label
											class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-3 text-[14px] font-medium transition {answers[
												q.id
											] === opt.id
												? 'border-iris-400 bg-iris-50 text-iris-700'
												: 'border-ink-900/10 text-ink-600 hover:border-ink-900/20'}"
										>
											<input
												type="radio"
												name="q-{i}-{q.id}"
												value={opt.id}
												checked={answers[q.id] === opt.id}
												onchange={() => setAnswer(q.id, opt.id)}
												class="hidden"
											/>
											{opt.value}
										</label>
									{/each}
								</div>
							{/if}

							{#if q.type === 'short-answer'}
								<input
									value={(answers[q.id] as string) || ''}
									oninput={(e) =>
										setAnswer(q.id, (e.target as HTMLInputElement).value)}
									class="w-full rounded-md bg-white px-3 py-2 text-[14px] text-ink-900 placeholder:text-ink-300 outline-1 -outline-offset-1 outline-ink-900/15 focus:outline-2 focus:-outline-offset-2 focus:outline-iris-500 transition"
									placeholder={t('quiz.typeYourAnswer')}
								/>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-9 border-t border-ink-900/10 pt-6">
				<button
					onclick={handleSubmit}
					disabled={submitting || !allAnswered}
					class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if submitting}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></div>
						{t('common.submitting')}
					{:else if allAnswered}
						{t('quiz.submitQuiz')}
					{:else}
						{t('quiz.answerAllToSubmit', {
							answered: answeredCount,
							total: totalQuestions,
						})}
					{/if}
				</button>
			</div>
		</div>
	{/if}
{/if}
