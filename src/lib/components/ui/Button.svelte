<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		variant?: 'primary' | 'ghost' | 'danger' | 'dashed';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		class?: string;
	}

	let {
		children,
		variant = 'primary',
		type = 'button',
		disabled = false,
		onclick,
		class: className = '',
	}: Props = $props();

	const base = 'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60';

	const variants: Record<string, string> = {
		primary:
			'bg-gradient-to-b from-iris-500 to-iris-700 text-white shadow-button hover:from-iris-500 hover:to-iris-800',
		ghost:
			'border border-ink-900/15 bg-white text-ink-700 hover:bg-ink-900/[0.03] hover:border-ink-900/25',
		danger:
			'text-red-600 hover:text-red-700 hover:bg-red-50',
		dashed:
			'border border-dashed border-ink-900/15 bg-white text-ink-500 hover:border-iris-400 hover:text-iris-600',
	};

	const variantClass = $derived(variants[variant] ?? variants.primary);
</script>

<button
	{type}
	{disabled}
	onclick={onclick}
	class="{base} {variantClass} {className}"
>
	{@render children()}
</button>
