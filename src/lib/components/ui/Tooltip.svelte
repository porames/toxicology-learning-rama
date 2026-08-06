<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		text: string;
		children: Snippet;
	}

	let { text, children }: Props = $props();

	let ref = $state<HTMLSpanElement>();
	let open = $state(false);
	let left = $state(0);
	let top = $state(0);

	function updatePos() {
		if (!ref) return;
		const r = ref.getBoundingClientRect();
		left = r.left + r.width / 2;
		top = r.bottom + 8;
	}

	function show() {
		updatePos();
		open = true;
	}

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		if (open) {
			open = false;
		} else {
			show();
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			e.stopPropagation();
			open ? (open = false) : show();
		}
	}
</script>

<span
	bind:this={ref}
	class="inline-flex"
	role="button"
	tabindex="0"
	onmouseenter={show}
	onmouseleave={() => (open = false)}
	onfocusin={show}
	onfocusout={() => (open = false)}
	onclick={toggle}
	onkeydown={onKeydown}
>
	{@render children()}
	{#if open}
		<span
			role="tooltip"
			class="pointer-events-none fixed z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2.5 py-1.5 text-[11px] font-medium leading-tight text-white shadow-lg"
			style={`left:${left}px;top:${top}px`}
		>
			{text}
		</span>
	{/if}
</span>
