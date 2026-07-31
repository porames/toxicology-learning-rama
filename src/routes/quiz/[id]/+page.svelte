<script lang="ts">
	import { page } from '$app/state';
	import QuizOverview from '$lib/components/quiz/QuizOverview.svelte';

	let quizId = $derived(page.params.id);
</script>

{#if quizId}
	<QuizOverview {quizId} />
{/if}
