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
		class="w-full resize-none rounded-lg border bg-white px-3.5 py-2.5 text-[14.5px] text-ink-900 placeholder:text-ink-300 transition {hasError
			? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-500/15'
			: 'border-ink-900/12 focus:border-iris-500 focus:ring-4 focus:ring-iris-500/15'} disabled:cursor-not-allowed disabled:bg-ink-900/[0.02] disabled:text-ink-500"
	></textarea>
	{#if hasError}
		<p class="mt-1 text-[12.5px] text-red-600">{error}</p>
	{:else if hint}
		<p class="mt-1 text-[12.5px] text-ink-500">{hint}</p>
	{/if}
</div>
