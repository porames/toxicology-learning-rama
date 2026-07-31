<script lang="ts">
	import { page } from '$app/state';
	import QuizResults from '$lib/components/quiz/QuizResults.svelte';

	let quizId = $derived(page.params.id);
	let attemptId = $derived(page.params.attemptId);
</script>

{#if quizId && attemptId}
	<QuizResults {quizId} {attemptId} />
{/if}
