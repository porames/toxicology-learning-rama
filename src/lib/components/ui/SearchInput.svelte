<script lang="ts">
	import { LoaderCircle, Search, X } from '@lucide/svelte';

	interface Props {
		label?: string;
		value?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		loading?: boolean;
		disabled?: boolean;
		compact?: boolean;
		id?: string;
		name?: string;
		autocomplete?: string;
		class?: string;
		oninput?: () => void;
		onkeydown?: (e: KeyboardEvent) => void;
		onfocus?: (e: FocusEvent) => void;
		onblur?: (e: FocusEvent) => void;
		onclear?: () => void;
	}

	let {
		label,
		value = $bindable(''),
		placeholder = '',
		error = '',
		hint = '',
		loading = false,
		disabled = false,
		compact = false,
		id = undefined,
		name = undefined,
		autocomplete = undefined,
		class: className = '',
		oninput,
		onkeydown,
		onfocus,
		onblur,
		onclear,
	}: Props = $props();

	const inputId = $derived(id ?? crypto.randomUUID());
	const hasError = $derived(error.length > 0);
	const showClear = $derived(!loading && !disabled && value.length > 0 && onclear);

	function clear() {
		value = '';
		onclear?.();
		oninput?.();
	}
</script>

<div class={className}>
	{#if label}
		<label for={inputId} class="mb-1.5 block text-[13px] font-medium text-ink-700">
			{label}
		</label>
	{/if}
	<div class="relative">
		<Search
			class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300"
		/>
		<input
			id={inputId}
			{name}
			type="text"
			autocomplete={autocomplete as any}
			bind:value
			{placeholder}
			{disabled}
			oninput={() => oninput?.()}
			onkeydown={(e) => onkeydown?.(e)}
			onfocus={(e) => onfocus?.(e)}
			onblur={(e) => onblur?.(e)}
			class="input w-full transition outline-none placeholder:text-ink-300 focus:outline-none focus:ring-2 {compact
				? 'input-xs text-[13px]'
				: 'input-md text-[14.5px]'} {hasError
				? 'input-error focus:border-red-500 focus:ring-red-500/20'
				: 'focus:border-iris-500 focus:ring-iris-500/20'} {showClear || loading
				? 'pr-10'
				: 'pr-3'}"
		/>
		{#if loading}
			<LoaderCircle
				class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-iris-500"
			/>
		{:else if showClear}
			<button
				type="button"
				onclick={clear}
				aria-label="Clear search"
				class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-300 transition hover:bg-ink-900/5 hover:text-ink-500"
			>
				<X class="h-4 w-4" />
			</button>
		{/if}
	</div>
	{#if hasError}
		<p class="mt-1 text-[12.5px] text-red-600">{error}</p>
	{:else if hint}
		<p class="mt-1 text-[12.5px] text-ink-500">{hint}</p>
	{/if}
</div>
