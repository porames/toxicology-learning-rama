<script lang="ts">
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
		compact?: boolean;
		id?: string;
		name?: string;
		class?: string;
		onchange?: (e: Event) => void;
	}

	let {
		label,
		options,
		value = $bindable(''),
		placeholder = '',
		error = '',
		hint = '',
		disabled = false,
		compact = false,
		id = undefined,
		name = undefined,
		class: className = '',
		onchange,
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
			{onchange}
			bind:value
			class="select w-full transition {compact
				? 'select-xs text-[13px]'
				: 'select-sm text-[14.5px]'} {hasError ? 'select-error' : ''}"
		>
			{#if placeholder}
				<option value="" disabled hidden>{placeholder}</option>
			{/if}
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</div>
	{#if hasError}
		<p class="mt-1 text-[12.5px] text-red-600">{error}</p>
	{:else if hint}
		<p class="mt-1 text-[12.5px] text-ink-500">{hint}</p>
	{/if}
</div>
