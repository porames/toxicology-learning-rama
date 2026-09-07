<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { LoaderCircle } from '@lucide/svelte';
	import SearchInput from './SearchInput.svelte';

	interface Props<T> {
		label?: string;
		query?: string;
		open?: boolean;
		loading?: boolean;
		items: T[];
		highlightIndex?: number;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		compact?: boolean;
		loadingText?: string;
		emptyText?: string;
		children?: Snippet;
		class?: string;
		oninput?: () => void;
		onselect?: (item: T) => void;
		onfocus?: () => void;
		onclose?: () => void;
		onclear?: () => void;
	}

	let {
		label,
		query = $bindable(''),
		open = $bindable(false),
		loading = false,
		items,
		highlightIndex = $bindable(0),
		placeholder = '',
		error = '',
		hint = '',
		disabled = false,
		compact = false,
		loadingText = 'Loading...',
		emptyText = '',
		children,
		class: className = '',
		oninput,
		onselect,
		onfocus,
		onclose,
		onclear,
	}: Props<T> = $props();

	let root = $state<HTMLDivElement>();

	function close() {
		if (!open) return;
		open = false;
		onclose?.();
	}

	function handleInput() {
		highlightIndex = 0;
		oninput?.();
	}

	function handleFocus() {
		if (query.trim() && (items.length > 0 || loading)) open = true;
		onfocus?.();
	}

	function handleClear() {
		highlightIndex = 0;
		open = false;
		onclear?.();
		onclose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		const count = items.length;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightIndex = Math.min(highlightIndex + 1, Math.max(count - 1, 0));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightIndex = Math.max(highlightIndex - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const item = items[highlightIndex];
			if (item !== undefined) onselect?.(item);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}

	function handleOutside(e: PointerEvent) {
		if (root && !root.contains(e.target as Node)) close();
	}
</script>

<svelte:window onpointerdown={handleOutside} />

<div bind:this={root} class="relative {className}">
	<SearchInput
		bind:value={query}
		{label}
		{placeholder}
		{error}
		{hint}
		{loading}
		{disabled}
		{compact}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onfocus={handleFocus}
		onclear={handleClear}
	/>

	{#if open}
		<div
			class="absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-ink-900/12 bg-white shadow-lg"
		>
			{#if loading}
				<div
					class="flex items-center justify-center gap-2 px-3 py-5 text-[12.5px] text-ink-400"
				>
					<LoaderCircle class="h-4 w-4 animate-spin text-iris-500" />
					{loadingText}
				</div>
			{:else if items.length === 0}
				<div class="px-3 py-3 text-[12.5px] text-ink-400">{emptyText}</div>
			{:else if children}
				<ul class="max-h-72 overflow-y-auto py-1">
					{@render children()}
				</ul>
			{/if}
		</div>
	{/if}
</div>
