<script lang="ts">
	import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import moment from 'moment';
	import { t } from '$lib/i18n';

	interface Props {
		value?: string;
		label?: string;
		hint?: string;
		class?: string;
	}

	let { value = $bindable(''), label = '', hint = '', class: className = '' }: Props = $props();

	let open = $state(false);
	let viewYear = $state(0);
	let viewMonth = $state(0);
	let rootEl = $state<HTMLDivElement | null>(null);

	const DAY_LABELS = $derived([
		t('templates.daySun'),
		t('templates.dayMon'),
		t('templates.dayTue'),
		t('templates.dayWed'),
		t('templates.dayThu'),
		t('templates.dayFri'),
		t('templates.daySat'),
	]);

	const displayLabel = $derived.by(() => {
		const m = moment(value, 'YYYY-MM-DD', true);
		return m.isValid() ? m.format('ddd, MMM D, YYYY') : t('templates.chooseSunday');
	});

	const monthLabel = $derived(
		moment({ year: viewYear, month: viewMonth, date: 1 }).format('MMMM YYYY'),
	);

	const weeks = $derived.by(() => {
		const first = moment({ year: viewYear, month: viewMonth, date: 1 });
		const cells: (number | null)[] = [
			...Array(first.day()).fill(null),
			...Array.from({ length: first.daysInMonth() }, (_, i) => i + 1),
		];
		while (cells.length % 7 !== 0) cells.push(null);
		const rows: (number | null)[][] = [];
		for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
		return rows;
	});

	function dayMoment(day: number) {
		return moment({ year: viewYear, month: viewMonth, date: day });
	}

	function isSelected(day: number) {
		return dayMoment(day).format('YYYY-MM-DD') === value;
	}

	function select(day: number) {
		value = dayMoment(day).format('YYYY-MM-DD');
		open = false;
	}

	function openPicker() {
		const m = moment(value, 'YYYY-MM-DD', true);
		const base = m.isValid() ? m : moment();
		viewYear = base.year();
		viewMonth = base.month();
		open = true;
	}

	function shiftMonth(delta: number) {
		const m = moment({ year: viewYear, month: viewMonth, date: 1 }).add(delta, 'month');
		viewYear = m.year();
		viewMonth = m.month();
	}

	function onWindowMouseDown(e: MouseEvent) {
		if (rootEl && !rootEl.contains(e.target as Node)) open = false;
	}

	function onWindowKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}

	$effect(() => {
		if (!open) return;
		window.addEventListener('mousedown', onWindowMouseDown);
		window.addEventListener('keydown', onWindowKeyDown);
		return () => {
			window.removeEventListener('mousedown', onWindowMouseDown);
			window.removeEventListener('keydown', onWindowKeyDown);
		};
	});
</script>

<div class={className} bind:this={rootEl}>
	{#if label}
		<p class="mb-1.5 block text-[13px] font-medium text-ink-700">{label}</p>
	{/if}
	<div class="relative">
		<button
			type="button"
			onclick={() => (open ? (open = false) : openPicker())}
			class="flex w-full items-center gap-2 rounded-lg border border-ink-900/12 bg-white px-3.5 py-2.5 text-left text-[14.5px] text-ink-900 transition focus:border-iris-500 focus:outline-none focus:ring-4 focus:ring-iris-500/15"
		>
			<CalendarDays class="h-4 w-4 shrink-0 text-ink-400" />
			<span class="flex-1 truncate">{displayLabel}</span>
		</button>
		{#if open}
			<div
				class="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-ink-900/10 bg-white p-3 shadow-button"
			>
				<div class="mb-2 flex items-center justify-between">
					<button
						type="button"
						onclick={() => shiftMonth(-1)}
						class="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-900/5"
						aria-label="Previous month"
					>
						<ChevronLeft class="h-4 w-4" />
					</button>
					<p class="text-[13px] font-semibold text-ink-900">{monthLabel}</p>
					<button
						type="button"
						onclick={() => shiftMonth(1)}
						class="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition hover:bg-ink-900/5"
						aria-label="Next month"
					>
						<ChevronRight class="h-4 w-4" />
					</button>
				</div>
				<div class="grid grid-cols-7 gap-0.5 text-center">
					{#each DAY_LABELS as dayLabel, i}
						<p
							class={`py-1 text-[11px] font-semibold uppercase ${i === 0 ? 'text-iris-600' : 'text-ink-300'}`}
						>
							{dayLabel}
						</p>
					{/each}
					{#each weeks as week}
						{#each week as day}
							{#if day === null}
								<span></span>
							{:else if dayMoment(day).day() === 0}
								<button
									type="button"
									onclick={() => select(day)}
									class={`flex h-8 w-8 items-center justify-center rounded-md text-[13px] transition {isSelected(day)
										? 'bg-iris-600 font-semibold text-white'
										: 'font-medium text-ink-900 hover:bg-iris-50 hover:text-iris-700'}`}
								>
									{day}
								</button>
							{:else}
								<span
									class="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-[13px] text-ink-900/25"
								>
									{day}
								</span>
							{/if}
						{/each}
					{/each}
				</div>
			</div>
		{/if}
	</div>
	{#if hint}
		<p class="mt-1 text-[12.5px] text-ink-500">{hint}</p>
	{/if}
</div>
