<script lang="ts">
	import Input from './Input.svelte';
	import { dateToStringInput, stringInputToDate } from '$lib/dashboard/utils';

	interface Props {
		label?: string;
		mode?: 'date' | 'datetime-local' | 'time';
		value?: Date | null;
		placeholder?: string;
		error?: string;
		hint?: string;
		disabled?: boolean;
		required?: boolean;
		compact?: boolean;
		id?: string;
		name?: string;
		onchange?: (value: Date | null) => void;
		oninput?: (value: Date | null) => void;
		class?: string;
	}

	let {
		label,
		mode = 'datetime-local',
		value = $bindable(null),
		placeholder = '',
		error = '',
		hint = '',
		disabled = false,
		required = false,
		compact = false,
		id = undefined,
		name = undefined,
		onchange,
		oninput,
		class: className = '',
	}: Props = $props();

	const inputValue = $derived(
		value
			? dateToStringInput(value).slice(0, mode === 'date' ? 10 : mode === 'time' ? 5 : 16)
			: '',
	);

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const next = target.value ? stringInputToDate(target.value) : null;
		value = next;
		oninput?.(next);
	}

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const next = target.value ? stringInputToDate(target.value) : null;
		value = next;
		onchange?.(next);
	}
</script>

<Input
	{label}
	type={mode}
	value={inputValue}
	{placeholder}
	{error}
	{hint}
	{disabled}
	{required}
	{compact}
	{id}
	{name}
	oninput={handleInput}
	onchange={handleChange}
	class={className}
/>
