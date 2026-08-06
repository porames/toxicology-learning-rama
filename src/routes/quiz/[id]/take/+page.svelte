<script lang="ts">
	import { page } from '$app/state';
	import QuizTaker from '$lib/components/quiz/QuizTaker.svelte';

	let quizId = $derived(page.params.id);
</script>

{#if quizId}
	<QuizTaker {quizId} />
{/if}
