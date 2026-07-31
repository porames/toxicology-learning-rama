<script lang="ts">
	import { goto } from '$app/navigation';
	import { doc, getDoc, updateDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { Plus } from '@lucide/svelte';
	import type { Question, QuestionType, Quiz } from '$lib/quiz-types';
	import QuestionCard from './QuestionCard.svelte';

	const fieldClass =
		'w-full rounded-md bg-white px-3 py-2 text-[14px] text-ink-900 placeholder:text-ink-300 outline-1 -outline-offset-1 outline-ink-900/15 focus:outline-2 focus:-outline-offset-2 focus:outline-iris-500 transition';
	const labelClass = 'mb-1.5 block text-[12.5px] font-medium text-ink-700';

	function makeId() {
		return typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `q-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	function createQuestion(type: QuestionType): Question {
		const base: Question = {
			id: makeId(),
			type,
			prompt: '',
			options: [],
			correctAnswer: '',
			explanation: '',
			points: 1
		};
		if (type === 'multiple-choice' || type === 'multiple-answer') {
			base.options = [{ id: makeId(), value: '' }, { id: makeId(), value: '' }];
		}
		if (type === 'true-false') {
			base.options = [
				{ id: 'tf-true', value: 'True' },
				{ id: 'tf-false', value: 'False' }
			];
			base.correctAnswer = 'tf-true';
		}
		return base;
	}

	let { quizId }: { quizId: string } = $props();

	let loading = $state(true);
	let title = $state('');
	let passingScore = $state(70);
	let shuffle = $state(false);
	let questions = $state<Question[]>([]);
	let saving = $state(false);
	let expandedQuestion = $state<string | null>(null);

	$effect(() => {
		async function load() {
			try {
				const snap = await getDoc(doc(db, 'quizzes', quizId));
				if (!snap.exists()) {
					goto('/quiz');
					return;
				}
				const data = { id: snap.id, ...snap.data() } as Quiz;
				title = data.title || '';
				passingScore = data.passingScore ?? 70;
				shuffle = data.shuffleQuestions ?? false;
				questions = data.questions || [];
			} catch (err) {
				console.error(err);
			} finally {
				loading = false;
			}
		}
		load();
	});

	function updateQuestion(id: string, patch: Partial<Question>) {
		questions = questions.map((q) => (q.id === id ? { ...q, ...patch } : q));
	}

	function addQuestion() {
		const q = createQuestion('multiple-choice');
		questions = [...questions, q];
		expandedQuestion = q.id;
	}

	function deleteQuestion(id: string) {
		questions = questions.filter((q) => q.id !== id);
		if (expandedQuestion === id) expandedQuestion = null;
	}

	async function saveChanges() {
		saving = true;
		try {
			await updateDoc(doc(db, 'quizzes', quizId), {
				title,
				passingScore,
				shuffleQuestions: shuffle,
				questions
			});
		} catch (err) {
			console.error(err);
		} finally {
			saving = false;
		}
	}
</script>

{#if loading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"></div>
	</div>
{:else}
	<div class="mx-auto max-w-xl px-8 py-10">
		<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">Quiz</p>

		<div class="mt-4 space-y-4">
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0 flex-1">
					<label class={labelClass}>Quiz title</label>
					<input
						bind:value={title}
						class={fieldClass}
						placeholder="e.g. Cardiology Quiz 1"
					/>
				</div>
				<button
					onclick={saveChanges}
					disabled={saving}
					class="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if saving}
						<div class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
						Saving…
					{:else}
						Save
					{/if}
				</button>
			</div>

			<div class="flex items-center gap-6">
				<div class="flex items-center gap-2">
					<label class={labelClass}>Passing score:</label>
					<input
						type="number"
						min={0}
						max={100}
						bind:value={passingScore}
						class="{fieldClass} w-20 text-center"
					/>
					<span class="text-[13px] text-ink-300">%</span>
				</div>
				<label class="flex items-center gap-2 text-[13px] text-ink-500">
					<input
						type="checkbox"
						bind:checked={shuffle}
						class="h-4 w-4 rounded border-ink-900/20 text-iris-500"
					/>
					Shuffle questions
				</label>
			</div>
		</div>

		<div class="mt-9 border-t border-ink-900/10 pt-6">
			<p class="text-[15px] font-semibold text-ink-900">
				Questions
				<span class="ml-1.5 font-normal text-ink-300">({questions.length})</span>
			</p>

			<div class="mt-4 space-y-3">
				{#if questions.length === 0}
					<div class="rounded-xl border border-dashed border-ink-900/15 py-12 text-center">
						<p class="text-[14px] text-ink-400">No questions yet.</p>
						<p class="mt-0.5 text-[13px] text-ink-300">
							Click the button below to add your first question.
						</p>
					</div>
				{/if}

				{#each questions as q, i (q.id)}
					<QuestionCard
						question={q}
						index={i}
						expanded={expandedQuestion === q.id}
						onupdate={(patch) => updateQuestion(q.id, patch)}
						ondelete={() => deleteQuestion(q.id)}
						ontoggle={() => (expandedQuestion = expandedQuestion === q.id ? null : q.id)}
					/>
				{/each}

				<button
					onclick={addQuestion}
					class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-900/15 bg-white px-3 py-2 text-[13px] font-medium text-ink-500 transition hover:border-iris-400 hover:text-iris-600"
				>
					<Plus class="h-3.5 w-3.5" />
					Add question
				</button>
			</div>
		</div>
	</div>
{/if}
