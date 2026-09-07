<script lang="ts">
	interface Props {
		label?: string;
		value?: string;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		required?: boolean;
		rows?: number;
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
		value = $bindable(''),
		placeholder = '',
		error = '',
		hint = '',
		disabled = false,
		required = false,
		rows = 4,
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
	<textarea
		{id}
		{name}
		{required}
		{disabled}
		{rows}
		bind:value
		{placeholder}
		{...rest}
		class="textarea w-full resize-none transition text-[14.5px] {hasError
			? 'textarea-error'
			: ''}"></textarea>
	{#if hasError}
		<p class="mt-1 text-[12.5px] text-red-600">{error}</p>
	{:else if hint}
		<p class="mt-1 text-[12.5px] text-ink-500">{hint}</p>
	{/if}
</div>
