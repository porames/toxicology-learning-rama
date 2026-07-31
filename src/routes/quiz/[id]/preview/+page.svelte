<script lang="ts">
	import { page } from '$app/state';
	import QuizPreview from '$lib/components/quiz/QuizPreview.svelte';

	let quizId = $derived(page.params.id);
</script>

{#if quizId}
	<QuizPreview {quizId} />
{/if}
