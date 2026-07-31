<script lang="ts">
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { FileQuestion, Plus, X } from '@lucide/svelte';

	let {
		onSelect,
		onClose,
	}: {
		onSelect: (quizId: string, quizTitle: string) => void;
		onClose: () => void;
	} = $props();

	let quizzes = $state<{ id: string; title: string; questions: unknown[] }[]>([]);
	let loading = $state(true);

	$effect(() => {
		async function load() {
			loading = true;
			try {
				const snap = await getDocs(collection(db, 'quizzes'));
				quizzes = snap.docs.map((d) => ({
					id: d.id,
					title: d.data().title || 'Untitled',
					questions: d.data().questions || [],
				}));
			} catch (err) {
				console.error(err);
			} finally {
				loading = false;
			}
		}
		load();
	});
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
	onclick={onClose}
	role="none"
>
	<div
		class="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl"
		onclick={(e) => e.stopPropagation()}
		role="none"
	>
		<div class="flex items-center justify-between border-b border-ink-900/10 px-5 py-4">
			<p class="text-[15px] font-semibold text-ink-900">Link a quiz</p>
			<button
				onclick={onClose}
				class="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-900/5 hover:text-ink-700"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
		<div class="max-h-80 overflow-y-auto px-5 py-3">
			{#if loading}
				<div class="flex items-center justify-center py-8">
					<div
						class="h-5 w-5 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
					></div>
				</div>
			{:else if quizzes.length === 0}
				<p class="py-8 text-center text-[13px] text-ink-400">
					No quizzes yet.&nbsp;
					<button
						onclick={() => {
							onClose();
							window.open('/quiz/new', '_blank');
						}}
						class="text-iris-600 underline hover:text-iris-700"
					>
						Create one
					</button>
				</p>
			{:else}
				<div class="space-y-2">
					{#each quizzes as q (q.id)}
						<button
							onclick={() => onSelect(q.id, q.title)}
							class="flex w-full items-center gap-3 rounded-lg border border-ink-900/10 px-4 py-3 text-left transition hover:border-iris-400 hover:bg-iris-50"
						>
							<FileQuestion class="h-5 w-5 shrink-0 text-iris-500" />
							<div class="min-w-0 flex-1">
								<p class="truncate text-[14px] font-medium text-ink-900">
									{q.title}
								</p>
								<p class="text-[12px] text-ink-400">
									{q.questions.length} questions
								</p>
							</div>
						</button>
					{/each}
				</div>
			{/if}
			<div class="border-t border-ink-900/10 mt-3 pt-3">
				<button
					onclick={() => {
						onClose();
						window.open('/quiz/new', '_blank');
					}}
					class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-900/15 px-3 py-2 text-[13px] font-medium text-iris-600 transition hover:border-iris-400 hover:bg-iris-50"
				>
					<Plus class="h-3.5 w-3.5" />
					Create new quiz
				</button>
			</div>
		</div>
	</div>
</div>
