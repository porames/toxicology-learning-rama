<script lang="ts">
	import { page } from '$app/state';
	import QuizCreator from '$lib/components/quiz/QuizCreator.svelte';

	let quizId = $derived(page.params.id);
</script>

{#if quizId}
	<QuizCreator {quizId} />
{/if}
