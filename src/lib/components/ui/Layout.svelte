<script lang="ts">
	import { ChevronRight, LoaderCircle } from '@lucide/svelte';
	import { goto } from '$app/navigation';

	let { authState, currentClass, selectedLecture } = $props();
</script>

{#if authState.loading}
	<div class="flex h-screen items-center justify-center">
		<LoaderCircle class="h-8 w-8 animate-spin text-iris-500" />
	</div>
{:else}
	<div class="flex h-screen flex-col bg-canvas">
		<header
			class="flex h-14 shrink-0 items-center justify-between border-b border-ink-900/8 bg-white px-5"
		>
			<div class="flex items-center gap-1 sm:gap-2.5 min-w-0">
				<div
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-iris-600"
				>
					<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none">
						<path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" fill="white" />
					</svg>
				</div>
				<button
					type="button"
					onclick={() => goto('/classes')}
					class="shrink-0 text-sm font-semibold tracking-tight text-ink-900 hover:text-iris-600 transition-colors"
				>
					All Classes
				</button>
				{#if currentClass}
					<ChevronRight size={14} class="hidden md:inline text-ink-900/20 shrink-0" />
					<button
						type="button"
						onclick={() => goto(`/classes/${currentClass.id}`)}
						class="hidden md:block truncate text-sm text-ink-900/60 hover:text-iris-600 transition-colors"
					>
						{currentClass.name}
					</button>
				{/if}
				{#if selectedLecture}
					<ChevronRight size={14} class="hidden md:inline text-ink-900/20 shrink-0" />
					<span class="hidden md:block truncate text-sm font-medium text-ink-900"
						>{selectedLecture.title}</span
					>
				{/if}
			</div>
		</header>
	</div>
{/if}
