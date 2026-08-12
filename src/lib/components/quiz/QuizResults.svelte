<script lang="ts">
	import { goto } from '$app/navigation';
	import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import {
		CheckCircle,
		XCircle,
		ChevronDown,
		ChevronRight,
		Download,
		BarChart3,
	} from '@lucide/svelte';
	import type { Quiz, QuizAttempt, Question } from '$lib/quiz-types';
	import { getOptionLabel } from '$lib/quiz-types';
	import Markdown from '$lib/components/ui/Markdown.svelte';
	import moment from 'moment';
	import { t, tn } from '$lib/i18n';

	let { quizId, attemptId }: { quizId: string; attemptId?: string } = $props();

	let loading = $state(true);
	let quiz = $state<Quiz | null>(null);
	let attempt = $state<QuizAttempt | null>(null);

	interface AttemptRow {
		attempt: QuizAttempt;
		name: string;
		ramaId: string;
		email: string;
		completedAt: Date | null;
		score: number;
		totalPoints: number;
		pct: number;
		passed: boolean;
	}

	let attemptRows = $state<AttemptRow[]>([]);
	let expandedGroups = $state<Set<string>>(new Set());

	interface StudentUser {
		id: string;
		authId?: string;
		name?: string;
		rama_id?: string;
		email?: string;
	}

	$effect(() => {
		async function load() {
			loading = true;
			try {
				const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
				if (!quizSnap.exists()) {
					goto('/quiz');
					return;
				}
				quiz = { id: quizSnap.id, ...quizSnap.data() } as Quiz;

				if (attemptId) {
					const attemptSnap = await getDoc(doc(db, 'quizAttempts', attemptId));
					if (!attemptSnap.exists()) {
						goto('/quiz');
						return;
					}
					attempt = { id: attemptSnap.id, ...attemptSnap.data() } as QuizAttempt;
				} else {
					const attemptsSnap = await getDocs(
						query(collection(db, 'quizAttempts'), where('quizId', '==', quizId)),
					);
					const attempts = attemptsSnap.docs.map(
						(d) => ({ id: d.id, ...d.data() }) as QuizAttempt,
					);

					const usersSnap = await getDocs(collection(db, 'users'));
					const byAuth = new Map<string, StudentUser>();
					const byDoc = new Map<string, StudentUser>();
					usersSnap.docs.forEach((d) => {
						const data = d.data() as StudentUser;
						const user = { ...data, id: d.id };
						if (user.authId) byAuth.set(user.authId, user);
						byDoc.set(d.id, user);
					});

					attemptRows = attempts
						.map((a) => {
							const authId = (a as unknown as { authId?: string }).authId;
							const userId = a.userId;
							const user =
								(authId && byAuth.get(authId)) ||
								(userId && (byDoc.get(userId) || byAuth.get(userId))) ||
								undefined;
							const completedAt = a.completedAt?.toDate?.() ?? null;
							const totalPoints = a.totalPoints ?? 0;
							const score = a.score ?? 0;
							return {
								attempt: a,
								name: user?.name ?? t('quiz.unknown'),
								ramaId: user?.rama_id ?? '',
								email: user?.email ?? '',
								completedAt,
								score,
								totalPoints,
								pct: totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0,
								passed: !!a.passed,
							};
						})
						.sort(
							(a, b) =>
								(b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
						);
					expandedGroups = new Set();
				}
			} catch (err) {
				console.error(err);
			} finally {
				loading = false;
			}
		}
		load();
	});

	const groups = $derived.by(() => {
		const map = new Map<string, AttemptRow[]>();
		for (const row of attemptRows) {
			const key =
				row.ramaId ||
				(row.attempt as unknown as { authId?: string }).authId ||
				`unknown-${row.attempt.id}`;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(row);
		}
		return Array.from(map.entries())
			.map(([key, rows]) => ({
				key,
				name: rows[0].name,
				ramaId: rows[0].ramaId,
				email: rows[0].email,
				rows,
				best: rows.reduce((best, r) =>
					r.score > best.score || (r.score === best.score && r.pct > best.pct) ? r : best,
				),
			}))
			.sort((a, b) => {
				if (a.name === t('quiz.unknown') && b.name !== t('quiz.unknown')) return 1;
				if (b.name === t('quiz.unknown') && a.name !== t('quiz.unknown')) return -1;
				return a.name.localeCompare(b.name) || a.ramaId.localeCompare(b.ramaId);
			});
	});

	function toggleGroup(key: string) {
		const next = new Set(expandedGroups);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		expandedGroups = next;
	}

	function expandAll() {
		expandedGroups = new Set(groups.map((g) => g.key));
	}

	function collapseAll() {
		expandedGroups = new Set();
	}

	function exportCsv() {
		const header = [
			t('export.timestamp'),
			t('export.studentId'),
			t('export.fullName'),
			t('export.email'),
			t('export.score'),
			t('export.totalPoints'),
			t('export.percentage'),
			t('export.status'),
		];
		const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
		const lines = attemptRows.map((r) =>
			[
				r.completedAt ? moment(r.completedAt).format('YYYY-MM-DD HH:mm:ss') : '',
				r.ramaId,
				r.name,
				r.email,
				r.score,
				r.totalPoints,
				`${r.pct}%`,
				r.passed ? t('export.submitted') : t('export.incomplete'),
			]
				.map(escape)
				.join(','),
		);
		const csv = [header.join(','), ...lines].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${(quiz?.title || 'quiz').replace(/[^a-z0-9]+/gi, '_')}_results.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function formatAnswerDisplay(
		answer: string | string[] | undefined,
		question: Question,
	): string {
		if (!answer || (Array.isArray(answer) && answer.length === 0)) return t('quiz.noAnswer');
		if (Array.isArray(answer)) {
			return answer.map((id) => getOptionLabel(question.options, id)).join(', ');
		}
		if (question.type === 'short-answer') return answer;
		return getOptionLabel(question.options, answer);
	}

	function formatCorrectAnswerDisplay(question: Question): string {
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
{:else if !attemptId}
	<div class="mx-auto w-full max-w-4xl px-4 py-10 md:px-8">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="min-w-0 flex-1">
				<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">
					{t('quiz.results')}
				</p>
				<h1
					class="mt-1 flex items-center gap-2 truncate text-[18px] font-semibold text-ink-900"
				>
					<BarChart3 class="h-4 w-4 shrink-0 text-amber-500" />
					<span class="truncate">{quiz?.title || t('common.untitledQuiz')}</span>
				</h1>
			</div>
			<button
				onclick={exportCsv}
				disabled={attemptRows.length === 0}
				class="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-900/10 bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-700 shadow-soft transition hover:border-iris-400 hover:bg-iris-50 hover:text-iris-600 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Download class="h-3.5 w-3.5" />
				{t('quiz.exportCsv')}
			</button>
		</div>

		{#if attemptRows.length === 0}
			<div class="flex flex-col items-center justify-center px-8 text-center mt-16">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-500"
				>
					<BarChart3 class="h-6 w-6" />
				</div>
				<p class="mt-4 text-[15px] font-medium text-ink-900">{t('quiz.noAttemptsYet')}</p>
				<p class="mt-1 max-w-xs text-[13.5px] text-ink-500">
					{t('quiz.attemptsWillShowHere')}
				</p>
			</div>
		{:else}
			<div class="mt-6">
				<div class="space-y-2">
					{#each groups as group}
						<div
							class="overflow-hidden rounded-lg border border-ink-900/10 bg-white shadow-soft"
						>
							<button
								onclick={() => toggleGroup(group.key)}
								class="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-900/[0.02]"
							>
								{#if expandedGroups.has(group.key)}
									<ChevronDown class="h-4 w-4 shrink-0 text-ink-400" />
								{:else}
									<ChevronRight class="h-4 w-4 shrink-0 text-ink-400" />
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate text-[14px] font-medium text-ink-900">
										{group.name}
										<span
											class="ml-2 font-mono text-[12px] font-normal text-ink-400"
											>{group.ramaId}</span
										>
									</p>
									<p class="truncate text-[12.5px] text-ink-500">{group.email}</p>
								</div>
								<div class="flex shrink-0 flex-wrap items-center gap-3">
									<span class="text-[12px] text-ink-400">
										{tn(
											group.rows.length,
											'quiz.attemptsCount',
											'quiz.attemptsCountPlural',
										)}
									</span>
									<span
										class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold {group
											.best.passed
											? 'bg-emerald-50 text-emerald-700'
											: 'bg-red-50 text-red-700'}"
									>
										{#if group.best.passed}
											<CheckCircle class="h-3.5 w-3.5" />
										{:else}
											<XCircle class="h-3.5 w-3.5" />
										{/if}
										{group.best.passed
											? t('common.passed')
											: t('common.failed')}
									</span>
								</div>
							</button>

							{#if expandedGroups.has(group.key)}
								<div class="overflow-x-auto border-t border-ink-900/5">
									<table class="min-w-full text-[13px]">
										<thead>
											<tr
												class="border-b border-ink-900/5 bg-ink-900/[0.02] text-left text-[11px] uppercase tracking-wide text-ink-400"
											>
												<th class="px-4 py-2 font-medium"
													>{t('export.timestamp')}</th
												>
												<th class="px-4 py-2 font-medium"
													>{t('export.studentId')}</th
												>
												<th class="px-4 py-2 font-medium"
													>{t('export.fullName')}</th
												>
												<th class="px-4 py-2 font-medium"
													>{t('export.email')}</th
												>
												<th class="px-4 py-2 font-medium"
													>{t('export.score')}</th
												>
												<th class="px-4 py-2 font-medium"
													>{t('export.totalPoints')}</th
												>
												<th class="px-4 py-2 font-medium"
													>{t('export.percentage')}</th
												>
												<th class="px-4 py-2 font-medium"
													>{t('export.status')}</th
												>
											</tr>
										</thead>
										<tbody class="divide-y divide-ink-900/5">
											{#each group.rows as row}
												<tr
													onclick={() =>
														goto(
															`/quiz/${quizId}/results/${row.attempt.id}`,
														)}
													class="cursor-pointer text-ink-700 transition-colors hover:bg-iris-50/50"
												>
													<td
														class="whitespace-nowrap px-4 py-2.5 text-ink-500"
													>
														{row.completedAt
															? moment(row.completedAt).format(
																	'MMM D, YYYY · hh:mm A',
																)
															: '—'}
													</td>
													<td
														class="whitespace-nowrap px-4 py-2.5 font-mono text-[12px]"
													>
														{row.ramaId || '—'}
													</td>
													<td
														class="whitespace-nowrap px-4 py-2.5 font-medium text-ink-900"
													>
														{row.name}
													</td>
													<td
														class="whitespace-nowrap px-4 py-2.5 text-ink-500"
													>
														{row.email || '—'}
													</td>
													<td class="whitespace-nowrap px-4 py-2.5"
														>{row.score}</td
													>
													<td class="whitespace-nowrap px-4 py-2.5"
														>{row.totalPoints}</td
													>
													<td
														class="whitespace-nowrap px-4 py-2.5 font-semibold"
													>
														{row.pct}%
													</td>
													<td class="whitespace-nowrap px-4 py-2.5">
														<span
															class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold {row.passed
																? 'bg-emerald-50 text-emerald-700'
																: 'bg-red-50 text-red-700'}"
														>
															{#if row.passed}
																<CheckCircle class="h-3.5 w-3.5" />
															{:else}
																<XCircle class="h-3.5 w-3.5" />
															{/if}
															{row.passed
																? t('common.passed')
																: t('common.failed')}
														</span>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{:else if quiz && attempt && attemptId}
	{@const pct =
		attempt.totalPoints > 0 ? Math.round((attempt.score / attempt.totalPoints) * 100) : 0}

	<div class="mx-auto w-full max-w-4xl px-4 py-10 md:px-8">
		<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">
			{t('quiz.results')}
		</p>

		<div class="mt-4 rounded-xl border border-ink-900/10 bg-white p-8 shadow-soft">
			<div class="text-center">
				<p class="text-[15px] font-semibold text-ink-900">{quiz.title}</p>
				<div class="mt-6 flex items-center justify-center gap-4">
					<span
						class="text-5xl font-bold {attempt.passed
							? 'text-emerald-600'
							: 'text-red-500'}"
					>
						{pct}%
					</span>
					<div class="text-left">
						<p class="text-[14px] text-ink-500">
							{t('quiz.pointsTotal', {
								score: attempt.score,
								totalPoints: attempt.totalPoints,
							})}
						</p>
						<span
							class="mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold {attempt.passed
								? 'bg-emerald-50 text-emerald-700'
								: 'bg-red-50 text-red-700'}"
						>
							{#if attempt.passed}
								<CheckCircle class="h-3.5 w-3.5" />
								{t('common.passed')}
							{:else}
								<XCircle class="h-3.5 w-3.5" />
								{t('common.failed')}
							{/if}
						</span>
					</div>
				</div>
				<div
					class="mt-4 h-2.5 w-full max-w-sm mx-auto rounded-full bg-ink-900/10 overflow-hidden"
				>
					<div
						class="h-full rounded-full transition-all {attempt.passed
							? 'bg-emerald-500'
							: 'bg-red-500'}"
						style="width: {pct}%"
					></div>
				</div>
			</div>
		</div>

		<div class="mt-9 border-t border-ink-900/10 pt-6">
			<p class="text-[15px] font-semibold text-ink-900">
				{t('quiz.review')}
				<span class="ml-1.5 font-normal text-ink-300">
					({t('quiz.questionsCount', { count: quiz.questions.length })})
				</span>
			</p>

			<div class="mt-4 space-y-3">
				{#each quiz.questions as q, i (q.id)}
					{@const attemptAnswer = attempt.answers.find((a) => a.questionId === q.id)}
					{@const correct = attemptAnswer?.correct ?? false}

					<div
						class="rounded-xl border bg-white p-5 shadow-soft {correct
							? 'border-emerald-200'
							: 'border-red-200'}"
					>
						<div class="flex items-start gap-3">
							<span
								class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold {correct
									? 'bg-emerald-50 text-emerald-600'
									: 'bg-red-50 text-red-600'}"
							>
								{#if correct}
									<CheckCircle class="h-4 w-4" />
								{:else}
									<XCircle class="h-4 w-4" />
								{/if}
							</span>
							<div class="min-w-0 flex-1">
								<Markdown value={q.prompt} />
								<p
									class="mt-1 text-[12.5px] font-medium text-ink-400 uppercase tracking-wider"
								>
									{tn(q.points, 'quiz.pointsCount', 'quiz.pointsCountPlural')}
								</p>
							</div>
						</div>

						<div class="mt-3 space-y-1.5 pl-0 sm:pl-10">
							<p class="text-[13px] text-ink-500">
								<span class="font-medium text-ink-700">{t('quiz.yourAnswer')}</span>
								{formatAnswerDisplay(attemptAnswer?.answer, q)}
							</p>
							{#if !correct}
								<p class="text-[13px] text-ink-500">
									<span class="font-medium text-emerald-600"
										>{t('quiz.correctAnswerLabel')}</span
									>
									{formatCorrectAnswerDisplay(q)}
								</p>
							{/if}
							{#if q.explanation}
								<p
									class="mt-2 rounded-lg bg-ink-900/[0.03] px-3 py-2 text-[13px] text-ink-500"
								>
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
