<script lang="ts">
	import { goto } from '$app/navigation';
	import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { ArrowLeft, Plus } from '@lucide/svelte';

	const fieldClass =
		'w-full rounded-md bg-white px-3 py-2 text-[14px] text-ink-900 placeholder:text-ink-300 outline-1 -outline-offset-1 outline-ink-900/15 focus:outline-2 focus:-outline-offset-2 focus:outline-iris-500 transition';
	const labelClass = 'mb-1.5 block text-[12.5px] font-medium text-ink-700';

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
				createdAt: serverTimestamp()
			});
			goto(`/quiz/${docRef.id}`);
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
		Back
	</button>

	<p class="mt-6 text-[12px] font-medium uppercase tracking-wider text-ink-300">New quiz</p>

	<div class="mt-4 space-y-6">
		<div>
			<label class={labelClass}>Quiz title</label>
			<input
				bind:value={title}
				class={fieldClass}
				placeholder="e.g. Cardiology Quiz 1"
				autofocus
			/>
		</div>

		<div>
			<label class={labelClass}>Passing score (%)</label>
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
				Shuffle questions for students
			</label>
		</div>

		<button
			onclick={handleCreate}
			disabled={saving || !title.trim()}
			class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if saving}
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
				Creating…
			{:else}
				<Plus class="h-3.5 w-3.5" />
				Create quiz
			{/if}
		</button>
	</div>
</div>
