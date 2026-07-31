<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';

	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		label?: string;
		options: Option[];
		value?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		id?: string;
		name?: string;
		class?: string;
	}

	let {
		label,
		options,
		value = $bindable(''),
		placeholder = '',
		error = '',
		hint = '',
		disabled = false,
		id = undefined,
		name = undefined,
		class: className = '',
	}: Props = $props();

	const selectId = $derived(id ?? crypto.randomUUID());
	const hasError = $derived(error.length > 0);
</script>

<div class={className}>
	{#if label}
		<label for={selectId} class="mb-1.5 block text-[13px] font-medium text-ink-700">
			{label}
		</label>
	{/if}
	<div class="relative">
		<select
			{id}
			{name}
			{disabled}
			bind:value
			class="w-full appearance-none rounded-lg border bg-white px-3.5 py-2.5 pr-9 text-[14.5px] text-ink-900 transition {hasError
				? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-500/15'
				: 'border-ink-900/12 focus:border-iris-500 focus:ring-4 focus:ring-iris-500/15'} disabled:cursor-not-allowed disabled:bg-ink-900/[0.02] disabled:text-ink-500"
		>
			{#if placeholder}
				<option value="" disabled hidden>{placeholder}</option>
			{/if}
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
		<ChevronDown
			class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
		/>
	</div>
	{#if hasError}
		<p class="mt-1 text-[12.5px] text-red-600">{error}</p>
	{:else if hint}
		<p class="mt-1 text-[12.5px] text-ink-500">{hint}</p>
	{/if}
</div>
