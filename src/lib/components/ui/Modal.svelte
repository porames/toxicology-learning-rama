<script lang="ts">
	import { X } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title?: string;
		children: Snippet;
		footer?: Snippet;
		onclose?: () => void;
		class?: string;
	}

	let {
		open = $bindable(false),
		title = '',
		children,
		footer,
		onclose,
		class: className = '',
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') {
			onclose?.();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
		role="none"
		transition:fade={{ duration: 150 }}
		onclick={() => onclose?.()}
	>
		<div
			class="mx-4 w-full max-w-sm rounded-xl bg-white shadow-xl {className}"
			role="dialog"
			aria-modal="true"
			transition:fade={{ duration: 150 }}
			onclick={(e) => e.stopPropagation()}
		>
			{#if title}
				<div class="flex items-center justify-between border-b border-ink-900/10 px-5 py-4">
					<p class="text-[15px] font-semibold text-ink-900">{title}</p>
					<button
						type="button"
						onclick={() => onclose?.()}
						aria-label="Close"
						class="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-900/5 hover:text-ink-700"
					>
						<X class="h-4 w-4" />
					</button>
				</div>
			{/if}
			<div class="px-5 py-4">
				{@render children()}
			</div>
			{#if footer}
				<div class="flex items-center justify-end gap-2 px-5 pb-5">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
