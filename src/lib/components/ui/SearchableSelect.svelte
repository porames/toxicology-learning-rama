<script lang="ts">
	import { ChevronDown, Search, Check } from '@lucide/svelte';

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
		onchange?: (value: string) => void;
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

	let open = $state(false);
	let query = $state('');
	let highlightIndex = $state(0);
	let root = $state<HTMLDivElement>();
	let trigger = $state<HTMLButtonElement>();
	let searchInput = $state<HTMLInputElement>();
	let panelLeft = $state(0);
	let panelTop = $state(0);
	let panelWidth = $state(0);

	const selectedLabel = $derived(
		options.find((o) => o.value === value)?.label ?? '',
	);

	const filtered = $derived(
		query.trim()
			? options.filter((o) =>
					o.label.toLowerCase().includes(query.trim().toLowerCase()),
				)
			: options,
	);

	function toggle() {
		if (disabled) return;
		open ? close() : openDropdown();
	}

	function openDropdown() {
		open = true;
		highlightIndex = 0;
	}

	function close() {
		open = false;
		query = '';
		highlightIndex = 0;
	}

	function select(option: Option) {
		value = option.value;
		onchange?.(option.value);
		close();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (!open) return;
			highlightIndex = Math.min(highlightIndex + 1, filtered.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) return;
			highlightIndex = Math.max(highlightIndex - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (open && filtered[highlightIndex]) {
				select(filtered[highlightIndex]);
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}

	function onOutside(e: PointerEvent) {
		if (root && !root.contains(e.target as Node)) {
			close();
		}
	}

	function updatePos() {
		if (!trigger) return;
		const r = trigger.getBoundingClientRect();
		panelLeft = r.left;
		panelTop = r.bottom + 4;
		panelWidth = r.width;
	}

	$effect(() => {
		if (open) {
			highlightIndex = 0;
			updatePos();
			requestAnimationFrame(() => searchInput?.focus());
			window.addEventListener('scroll', updatePos, true);
			window.addEventListener('resize', updatePos);
			return () => {
				window.removeEventListener('scroll', updatePos, true);
				window.removeEventListener('resize', updatePos);
			};
		}
	});
</script>

<svelte:window onpointerdown={onOutside} onkeydown={onKeydown} />

<div class={className} bind:this={root}>
	{#if label}
		<label for={selectId} class="mb-1.5 block text-[13px] font-medium text-ink-700">
			{label}
		</label>
	{/if}
	<div class="relative">
		<button
			type="button"
			id={selectId}
			{name}
			{disabled}
			bind:this={trigger}
			onclick={toggle}
			aria-haspopup="listbox"
			aria-expanded={open}
			class="flex w-full items-center justify-between gap-2 rounded-lg border bg-white text-left text-ink-900 transition {compact
				? 'px-2.5 py-1.5 text-[13px]'
				: 'px-3.5 py-2.5 text-[14.5px]'} {hasError
				? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-500/15'
				: 'border-ink-900/12 focus:border-iris-500 focus:ring-4 focus:ring-iris-500/15'} disabled:cursor-not-allowed disabled:bg-ink-900/[0.02] disabled:text-ink-500"
		>
			<span class={selectedLabel ? '' : 'text-ink-300'}>
				{selectedLabel || placeholder || '\u00a0'}
			</span>
			<ChevronDown
				class="h-4 w-4 shrink-0 text-ink-400 transition-transform {open ? 'rotate-180' : ''}"
			/>
		</button>

		{#if open}
			<div
				role="listbox"
				class="fixed z-[100] overflow-hidden rounded-lg border border-ink-900/12 bg-white shadow-lg"
				style={`left:${panelLeft}px;top:${panelTop}px;width:${panelWidth}px`}
			>
				<div class="flex items-center gap-2 border-b border-ink-900/10 px-3">
					<Search class="h-4 w-4 shrink-0 text-ink-400" />
					<input
						bind:this={searchInput}
						bind:value={query}
						type="text"
						placeholder="Search..."
						class="w-full bg-transparent py-2.5 text-[14px] text-ink-900 placeholder:text-ink-300 focus:outline-none"
					/>
				</div>
				<ul class="max-h-56 overflow-y-auto py-1">
					{#each filtered as option, i (option.value)}
						<li>
							<button
								type="button"
								role="option"
								aria-selected={option.value === value}
								onclick={() => select(option)}
								onmouseenter={() => (highlightIndex = i)}
								class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[14px] transition {option.value === value
									? 'bg-iris-50 text-iris-700'
									: i === highlightIndex
										? 'bg-ink-900/[0.04] text-ink-900'
										: 'text-ink-900'}"
							>
								<span class="truncate">{option.label}</span>
								{#if option.value === value}
									<Check class="h-4 w-4 shrink-0" />
								{/if}
							</button>
						</li>
					{:else}
						<li class="px-3 py-2.5 text-[13px] text-ink-400">No results</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
	{#if hasError}
		<p class="mt-1 text-[12.5px] text-red-600">{error}</p>
	{:else if hint}
		<p class="mt-1 text-[12.5px] text-ink-500">{hint}</p>
	{/if}
</div>
