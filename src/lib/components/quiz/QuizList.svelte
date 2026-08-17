<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import {
		collection,
		getDocs,
		deleteDoc,
		doc,
		addDoc,
		serverTimestamp,
	} from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { ClipboardList, Plus, Pencil, Trash2, FileQuestion } from '@lucide/svelte';
	import { Button, Input, Modal } from '$lib/components/ui';
	import type { Quiz } from '$lib/quiz-types';
	import moment from 'moment';
	import { t, tn } from '$lib/i18n';

	let loading = $state(true);
	let quizzes = $state<Quiz[]>([]);
	let showCreateModal = $state(false);
	let newQuizTitle = $state('');
	let creating = $state(false);

	$effect(() => {
		async function load() {
			try {
				const snapshot = await getDocs(collection(db, 'quizzes'));
				const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Quiz);
				quizzes = data;
			} catch (err) {
				console.error(err);
			} finally {
				loading = false;
			}
		}
		load();
	});

	async function handleDelete(id: string) {
		if (!confirm(t('quiz.deleteQuizConfirm'))) return;
		try {
			await deleteDoc(doc(db, 'quizzes', id));
			quizzes = quizzes.filter((q) => q.id !== id);
		} catch (err) {
			console.error(err);
		}
	}

	function openCreateModal() {
		newQuizTitle = '';
		showCreateModal = true;
	}

	async function handleCreate() {
		if (!newQuizTitle.trim() || creating) return;
		creating = true;
		try {
			const docRef = await addDoc(collection(db, 'quizzes'), {
				title: newQuizTitle.trim(),
				questions: [],
				passingScore: 70,
				shuffleQuestions: false,
				createdAt: serverTimestamp(),
			});
			goto(`${base}/#/quiz/${docRef.id}`);
		} catch (err) {
			console.error(err);
			creating = false;
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
		<div class="flex items-center justify-between">
			<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">
				{t('nav.quizzes')}
			</p>
			<button
				onclick={openCreateModal}
				class="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800"
			>
				<Plus class="h-3.5 w-3.5" />
				{t('quiz.newQuiz')}
			</button>
		</div>

		<p class="mt-1 text-[13.5px] text-ink-500">
			{tn(quizzes.length, 'quiz.quizCountCreated', 'quiz.quizCountCreatedPlural')}
		</p>

		{#if quizzes.length === 0}
			<div class="flex h-full flex-col items-center justify-center px-8 text-center mt-16">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-xl bg-iris-50 text-iris-500"
				>
					<ClipboardList class="h-6 w-6" />
				</div>
				<p class="mt-4 text-[15px] font-medium text-ink-900">{t('quiz.noQuizzesYet')}</p>
				<p class="mt-1 max-w-xs text-[13.5px] text-ink-500">
					{t('quiz.createFirstQuiz')}
				</p>
				<button
					onclick={openCreateModal}
					class="mt-5 flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-4 py-2 text-[13.5px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800"
				>
					<Plus class="h-3.5 w-3.5" />
					{t('quiz.newQuiz')}
				</button>
			</div>
		{:else}
			<div class="mt-6 space-y-2">
				{#each quizzes as quiz (quiz.id)}
					<div
						class="rounded-lg border border-ink-900/10 bg-white px-4 py-3 transition hover:border-iris-300"
					>
						<div class="flex items-center justify-between gap-3">
							<div class="flex items-center gap-2.5 min-w-0 flex-1">
								<FileQuestion class="h-4 w-4 shrink-0 text-iris-500" />
								<div class="min-w-0 flex-1">
									<button
										onclick={() => goto(`${base}/#/quiz/${quiz.id}`)}
										class="truncate text-[14px] font-medium text-ink-900 hover:text-iris-600"
									>
										{quiz.title || t('common.untitledQuiz')}
									</button>
									<p class="mt-0.5 text-[12.5px] text-ink-400">
										{tn(
											quiz.questions?.length || 0,
											'quiz.questionsCount',
											'quiz.questionsCountPlural',
										)} · {t('quiz.pass')}: {quiz.passingScore ?? 70}%
										{#if quiz.createdAt}
											· {t('quiz.created', {
												time: moment(quiz.createdAt.toDate()).fromNow(),
											})}
										{/if}
									</p>
								</div>
							</div>
							<div class="flex shrink-0 gap-1">
								<button
									onclick={() => goto(`${base}/#/quiz/${quiz.id}`)}
									class="flex h-7 w-7 items-center justify-center rounded text-ink-400 transition hover:bg-iris-50 hover:text-iris-600"
									title={t('quiz.edit')}
								>
									<Pencil class="h-3.5 w-3.5" />
								</button>
								<button
									onclick={() => handleDelete(quiz.id)}
									class="flex h-7 w-7 items-center justify-center rounded text-ink-400 transition hover:bg-red-50 hover:text-red-500"
									title={t('common.delete')}
								>
									<Trash2 class="h-3.5 w-3.5" />
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<Modal open={showCreateModal} title={t('quiz.newQuiz')} onclose={() => (showCreateModal = false)}>
	<Input
		label={t('quiz.quizTitle')}
		bind:value={newQuizTitle}
		placeholder={t('quiz.quizTitlePlaceholder')}
		onkeydown={(e) => {
			if (e.key === 'Enter') handleCreate();
		}}
	/>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (showCreateModal = false)} disabled={creating}>
			{t('common.cancel')}
		</Button>
		<Button onclick={handleCreate} disabled={creating || !newQuizTitle.trim()}>
			{#if creating}
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></div>
				{t('common.creating')}
			{:else}
				<Plus class="h-3.5 w-3.5" />
				{t('quiz.createQuiz')}
			{/if}
		</Button>
	{/snippet}
</Modal>
