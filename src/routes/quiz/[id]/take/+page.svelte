<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	$effect(() => {
		goto(`/quiz/${page.params.id}`);
	});
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"></div>
</div>
