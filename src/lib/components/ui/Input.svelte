<script lang="ts">
	interface Props {
		label?: string;
		type?:
			| 'text'
			| 'email'
			| 'password'
			| 'number'
			| 'url'
			| 'tel'
			| 'search'
			| 'datetime-local'
			| 'date'
			| 'time';
		value?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		required?: boolean;
		compact?: boolean;
		autocomplete?: string;
		id?: string;
		name?: string;
		oninput?: (e: Event) => void;
		onchange?: (e: Event) => void;
		onkeydown?: (e: KeyboardEvent) => void;
		onfocus?: (e: FocusEvent) => void;
		onblur?: (e: FocusEvent) => void;
		class?: string;
	}

	let {
		label,
		type = 'text',
		value = $bindable(''),
		placeholder = '',
		error = '',
		hint = '',
		disabled = false,
		required = false,
		compact = false,
		autocomplete = undefined,
		id = undefined,
		name = undefined,
		class: className = '',
		...rest
	}: Props = $props();

	const inputId = $derived(id ?? crypto.randomUUID());
	const hasError = $derived(error.length > 0);
</script>

<div class={className}>
	{#if label}
		<label for={inputId} class="mb-1.5 block text-[13px] font-medium text-ink-700">
			{label}
		</label>
	{/if}
	<input
		{id}
		{name}
		{type}
		{required}
		{disabled}
		autocomplete={autocomplete as any}
		bind:value
		{placeholder}
		{...rest}
		class="input w-full transition outline-none focus:outline-none focus:ring-2 {compact
			? 'input-xs text-[13px]'
			: 'input-md text-[14.5px]'} {hasError
			? 'input-error focus:border-red-500 focus:ring-red-500/20'
			: 'focus:border-iris-500 focus:ring-iris-500/20'}"
	/>
	{#if hasError}
		<p class="mt-1 text-[12.5px] text-red-600">{error}</p>
	{:else if hint}
		<p class="mt-1 text-[12.5px] text-ink-500">{hint}</p>
	{/if}
</div>
