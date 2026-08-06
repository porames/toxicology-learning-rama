<script lang="ts">
	import { goto } from '$app/navigation';
	import { doc, getDoc, updateDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { Plus } from '@lucide/svelte';
	import { Button, Input } from '$lib/components/ui';
	import type { Question, QuestionType, Quiz } from '$lib/quiz-types';
	import QuestionCard from './QuestionCard.svelte';

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
			points: 1,
		};
		if (type === 'multiple-choice' || type === 'multiple-answer') {
			base.options = [
				{ id: makeId(), value: '' },
				{ id: makeId(), value: '' },
			];
		}
		if (type === 'true-false') {
			base.options = [
				{ id: 'tf-true', value: 'True' },
				{ id: 'tf-false', value: 'False' },
			];
			base.correctAnswer = 'tf-true';
		}
		return base;
	}

	let { quizId }: { quizId: string } = $props();

	let loading = $state(true);
	let title = $state('');
	let passingScore = $state(70);
	let passingScoreInput = $state('70');
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
				passingScoreInput = String(passingScore);
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

	function handlePassingScore(e: Event) {
		const value = (e.currentTarget as HTMLInputElement).value;
		passingScoreInput = value;
		const parsed = parseInt(value, 10);
		passingScore = isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed));
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
				questions,
			});
		} catch (err) {
			console.error(err);
		} finally {
			saving = false;
		}
	}

	async function autoSaveImageRemoval() {
		try {
			await updateDoc(doc(db, 'quizzes', quizId), { questions });
		} catch (err) {
			console.error(err);
		}
	}
</script>

{#if loading}
	<div class="flex min-h-screen items-center justify-center">
		<div
			class="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
		></div>
	</div>
{:else}
	<div class="mx-auto w-2xl px-8 py-10">
		<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">Quiz</p>

		<div class="mt-4 space-y-4">
			<div class="flex items-end justify-between gap-4">
				<div class="min-w-0 flex-1">
					<Input
						label="Quiz title"
						bind:value={title}
						placeholder="e.g. Cardiology Quiz 1"
					/>
				</div>
				<Button onclick={saveChanges} disabled={saving} class="shrink-0">
					{#if saving}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></div>
						Saving…
					{:else}
						Save
					{/if}
				</Button>
			</div>

			<div class="flex items-end gap-6">
				<Input
					type="number"
					label="Passing score"
					value={passingScoreInput}
					oninput={handlePassingScore}
					class="w-24"
				/>
				<span class="pb-2.5 text-[13px] text-ink-300">%</span>
				<label class="flex items-center gap-2 pb-2 text-[13px] text-ink-500">
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
					<div
						class="rounded-xl border border-dashed border-ink-900/15 py-12 text-center"
					>
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
						onremoveimage={autoSaveImageRemoval}
						ontoggle={() =>
							(expandedQuestion = expandedQuestion === q.id ? null : q.id)}
					/>
				{/each}

				<Button variant="dashed" onclick={addQuestion} class="w-full">
					<Plus class="h-3.5 w-3.5" />
					Add question
				</Button>
			</div>
		</div>
	</div>
{/if}
