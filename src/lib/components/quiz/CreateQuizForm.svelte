<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { ArrowLeft, Plus } from '@lucide/svelte';
	import { Button, Input } from '$lib/components/ui';
	import { t } from '$lib/i18n';

	let title = $state('');
	let passingScore = $state(70);
	let shuffle = $state(false);
	let saving = $state(false);

	async function handleCreate() {
		if (!title.trim()) return;
		saving = true;
		try {
			const docRef = await addDoc(collection(db, 'quizzes'), {
				title: title.trim(),
				questions: [],
				passingScore,
				shuffleQuestions: shuffle,
				createdAt: serverTimestamp(),
			});
			goto(`${base}/#/quiz/${docRef.id}`);
		} catch (err) {
			console.error(err);
			saving = false;
		}
	}
</script>

<div class="mx-auto max-w-xl px-8 py-10">
	<button
		onclick={() => history.back()}
		class="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-500 hover:text-ink-900 transition"
	>
		<ArrowLeft class="h-4 w-4" />
		{t('common.back')}
	</button>

	<p class="mt-6 text-[12px] font-medium uppercase tracking-wider text-ink-300">
		{t('quiz.newQuiz')}
	</p>

	<div class="mt-4 space-y-6">
		<Input
			label={t('quiz.quizTitle')}
			bind:value={title}
			placeholder={t('quiz.quizTitlePlaceholder')}
		/>

		<div>
			<p class="mb-1.5 text-[13px] font-medium text-ink-700">{t('quiz.passingScore')} (%)</p>
			<div class="flex items-center gap-4">
				<input
					type="range"
					min={0}
					max={100}
					bind:value={passingScore}
					class="flex-1 accent-iris-500"
				/>
				<span class="w-10 text-right text-[14px] font-semibold text-ink-900">
					{passingScore}%
				</span>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<input
				type="checkbox"
				id="shuffle"
				bind:checked={shuffle}
				class="h-4 w-4 rounded border-ink-900/20 text-iris-500 focus:ring-iris-500"
			/>
			<label for="shuffle" class="text-[14px] text-ink-700">
				{t('quiz.shuffleForStudents')}
			</label>
		</div>

		<Button onclick={handleCreate} disabled={saving || !title.trim()} class="w-full">
			{#if saving}
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></div>
				{t('common.creating')}
			{:else}
				<Plus class="h-3.5 w-3.5" />
				{t('quiz.createQuiz')}
			{/if}
		</Button>
	</div>
</div>
