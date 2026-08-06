<script lang="ts">
	import { page } from '$app/state';
	import QuizResults from '$lib/components/quiz/QuizResults.svelte';

	let quizId = $derived(page.params.id);
</script>

{#if quizId}
	<QuizResults {quizId} />
{/if}
