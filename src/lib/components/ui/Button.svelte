<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		variant?: 'primary' | 'ghost' | 'danger' | 'danger-solid' | 'dashed' | 'accent';
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

	const base = 'btn btn-sm';

	const variants: Record<string, string> = {
		primary: 'btn-primary',
		accent: 'btn-secondary',
		ghost: 'btn-ghost',
		danger: 'btn-ghost text-error hover:bg-error/10',
		'danger-solid': 'btn-error',
		dashed: 'btn-dash',
	};

	const variantClass = $derived(variants[variant] ?? variants.primary);
</script>

<button {type} {disabled} {onclick} class="{base} {variantClass} {className}">
	{@render children()}
</button>
