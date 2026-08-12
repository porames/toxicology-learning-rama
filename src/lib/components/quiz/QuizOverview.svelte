<script lang="ts">
	import { goto } from '$app/navigation';
	import { doc, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { Pencil, Play, BarChart3, FileQuestion, ClipboardCheck } from '@lucide/svelte';
	import type { Quiz } from '$lib/quiz-types';
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

	const actions = $derived.by(
		() =>
			[
				{
					label: t('quiz.actionEditQuiz'),
					description: t('quiz.actionEditQuizDesc'),
					href: `/quiz/${quizId}/edit`,
					icon: Pencil,
					color: 'iris',
				},
				{
					label: t('quiz.actionTakeQuiz'),
					description: t('quiz.actionTakeQuizDesc'),
					href: `/quiz/${quizId}/take`,
					icon: ClipboardCheck,
					color: 'emerald',
				},
				{
					label: t('quiz.actionPreview'),
					description: t('quiz.actionPreviewDesc'),
					href: `/quiz/${quizId}/preview`,
					icon: Play,
					color: 'emerald',
				},
				{
					label: t('quiz.actionResults'),
					description: t('quiz.actionResultsDesc'),
					href: `/quiz/${quizId}/results`,
					icon: BarChart3,
					color: 'amber',
				},
			] as const,
	);

	const colorClasses: Record<string, { bg: string; text: string; ring: string }> = {
		iris: {
			bg: 'bg-iris-50',
			text: 'text-iris-600',
			ring: 'hover:border-iris-400 hover:bg-iris-50',
		},
		emerald: {
			bg: 'bg-emerald-50',
			text: 'text-emerald-600',
			ring: 'hover:border-emerald-400 hover:bg-emerald-50',
		},
		amber: {
			bg: 'bg-amber-50',
			text: 'text-amber-600',
			ring: 'hover:border-amber-400 hover:bg-amber-50',
		},
	};
</script>

{#if loading}
	<div class="flex min-h-screen items-center justify-center">
		<div
			class="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
		></div>
	</div>
{:else if quiz}
	<div class="mx-auto w-2xl px-8 py-10">
		<div class="flex items-center gap-2.5">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-iris-50 text-iris-500"
			>
				<FileQuestion class="h-5 w-5" />
			</div>
			<div>
				<p class="text-[15px] font-semibold text-ink-900">
					{quiz.title || t('common.untitledQuiz')}
				</p>
				<p class="text-[13px] text-ink-500">
					{tn(
						quiz.questions?.length || 0,
						'quiz.questionsCount',
						'quiz.questionsCountPlural',
					)} · {t('quiz.pass')}: {quiz.passingScore ?? 70}%{#if quiz.shuffleQuestions}
						· {t('quiz.shuffled')}{/if}
				</p>
			</div>
		</div>

		<div class="mt-8 space-y-3">
			{#each actions as action}
				{@const colors = colorClasses[action.color]}
				<button
					onclick={() => goto(action.href)}
					class="flex w-full items-center gap-4 rounded-xl border border-ink-900/10 bg-white p-5 text-left shadow-soft transition {colors.ring}"
				>
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {colors.bg} {colors.text}"
					>
						<action.icon class="h-5 w-5" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-[14px] font-semibold text-ink-900">{action.label}</p>
						<p class="text-[12.5px] text-ink-500">{action.description}</p>
					</div>
				</button>
			{/each}
		</div>
	</div>
{/if}
