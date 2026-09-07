<script lang="ts">
	import { X } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { Snippet } from 'svelte';
	import { t } from '$lib/i18n';

	interface Props {
		open?: boolean;
		title?: string;
		children: Snippet;
		footer?: Snippet;
		onclose?: () => void;
		class?: string;
		contentClass?: string;
	}

	let {
		open = $bindable(false),
		title = '',
		children,
		footer,
		onclose,
		class: className = '',
		contentClass = 'px-5 py-4',
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
		class="modal modal-open"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="modal-box p-0 {className || 'max-w-sm'}"
			transition:fly={{ duration: 200, y: 16, easing: cubicOut }}
		>
			{#if title}
				<div class="flex items-center justify-between border-b border-ink-900/10 px-5 py-4">
					<p class="text-[15px] font-semibold text-ink-900">{title}</p>
					<button
						type="button"
						onclick={() => onclose?.()}
						aria-label={t('common.close')}
						class="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-900/5 hover:text-ink-700"
					>
						<X class="h-4 w-4" />
					</button>
				</div>
			{/if}
			<div class={contentClass}>
				{@render children()}
			</div>
			{#if footer}
				<div
					class="flex items-center justify-end gap-2 border-t border-ink-900/10 px-5 pb-5 pt-4"
				>
					{@render footer()}
				</div>
			{/if}
		</div>
		<button
			type="button"
			class="modal-backdrop"
			aria-label={t('common.close')}
			onclick={() => onclose?.()}
		></button>
	</div>
{/if}
