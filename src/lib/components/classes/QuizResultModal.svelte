<script lang="ts">
	interface QuizResult {
		id: string;
		score: number;
		totalPoints: number;
		passed: boolean;
		pct: number;
	}

	interface Props {
		quizResult: QuizResult;
		onClose: () => void;
		onViewAttempts: () => void;
	}

	let { quizResult, onClose, onViewAttempts }: Props = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
	onclick={onClose}
>
	<div
		class="mx-4 w-full max-w-sm rounded-xl bg-white p-8 shadow-xl"
		onclick={(e) => e.stopPropagation()}
	>
		<p
			class={`text-5xl font-bold text-center ${quizResult.passed ? 'text-emerald-600' : 'text-red-500'}`}
		>
			{quizResult.pct}%
		</p>
		<div class="mt-3 flex justify-center">
			<span
				class={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${quizResult.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
			>
				{quizResult.passed ? 'Passed' : 'Failed'}
			</span>
		</div>
		<p class="mt-4 text-center text-sm text-ink-500">
			{quizResult.score} / {quizResult.totalPoints} points
		</p>
		<button
			onclick={onViewAttempts}
			class="mt-6 flex w-full items-center justify-center rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-4 py-2 text-sm font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800"
		>
			View quiz attempts
		</button>
	</div>
</div>
