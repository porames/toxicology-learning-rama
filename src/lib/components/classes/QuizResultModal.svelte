<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import { Button } from '$lib/components/ui';

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

<Modal open onclose={onClose} title={quizResult.passed ? 'Quiz passed' : 'Quiz failed'}>
	<div class="flex flex-col items-center gap-1 py-1">
		<p
			class={`text-5xl font-bold text-center ${quizResult.passed ? 'text-emerald-600' : 'text-red-500'}`}
		>
			{Math.round(quizResult.pct)}%
		</p>
		<span
			class={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${quizResult.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
		>
			{quizResult.passed ? 'Passed' : 'Failed'}
		</span>
		<p class="mt-2 text-center text-sm text-ink-500">
			{quizResult.score} / {quizResult.totalPoints} points
		</p>
	</div>
	{#snippet footer()}
		<Button onclick={onViewAttempts}>View quiz attempts</Button>
	{/snippet}
</Modal>
