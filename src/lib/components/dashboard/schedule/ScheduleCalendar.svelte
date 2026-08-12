<script lang="ts">
	import type { ScheduleEvent } from '$lib/dashboard/types';
	import { onMount } from 'svelte';
	import moment from 'moment';
	import { t } from '$lib/i18n';

	interface DragState {
		day: Date;
		startY: number;
		currentY: number;
	}

	type EventDragMode = 'move' | 'resize-start' | 'resize-end';

	interface EventDragState {
		event: ScheduleEvent;
		mode: EventDragMode;
		columnTop: number;
		columnLeft: number;
		columnWidth: number;
		startOffsetY: number;
		startOffsetX: number;
		pointerStartMin: number;
		startMin: number;
		endMin: number;
		currentMin: number;
		dayDelta: number;
		moved: boolean;
	}

	interface Props {
		weekStart: Date;
		events: ScheduleEvent[];
		pxPerHour?: number;
		snapMinutes?: number;
		showDate?: boolean;
		onCreate?: (event: { date: Date; startTime: Date; endTime: Date }) => void;
		onEventClick?: (event: ScheduleEvent) => void;
		onEventChange?: (event: ScheduleEvent, startTime: Date, endTime: Date) => void;
	}

	let {
		weekStart,
		events,
		pxPerHour = 60,
		snapMinutes = 15,
		showDate = true,
		onCreate,
		onEventClick,
		onEventChange,
	}: Props = $props();

	const HOURS = 24;
	const DAY_LABELS = $derived([
		t('templates.daySun'),
		t('templates.dayMon'),
		t('templates.dayTue'),
		t('templates.dayWed'),
		t('templates.dayThu'),
		t('templates.dayFri'),
		t('templates.daySat'),
	]);

	const days = $derived(
		Array.from({ length: 7 }, (_, i) => {
			const d = moment(weekStart).startOf('week').add(i, 'day');
			return d.toDate();
		}),
	);

	const columnHeight = $derived(HOURS * pxPerHour);

	let scrollContainer = $state<HTMLDivElement | null>(null);
	let headerRow = $state<HTMLDivElement | null>(null);

	onMount(() => {
		const el = scrollContainer;
		if (!el) return;
		el.scrollTop = Math.max(0, 8 * pxPerHour - (headerRow?.offsetHeight ?? 0));
	});

	function minutesSinceMidnight(date: Date): number {
		return date.getHours() * 60 + date.getMinutes();
	}

	interface LayoutEvent extends ScheduleEvent {
		top: number;
		height: number;
		col: number;
		cols: number;
	}

	function eventsOverlap(a: ScheduleEvent, b: ScheduleEvent): boolean {
		return (
			a.startTime.getTime() < b.endTime.getTime() &&
			a.endTime.getTime() > b.startTime.getTime()
		);
	}

	function layoutDay(day: Date): LayoutEvent[] {
		const dayStart = moment(day).startOf('day');
		const dayEnd = moment(day).endOf('day');
		const ds0 = dayStart.toDate().getTime();
		const de0 = dayEnd.toDate().getTime();

		const candidates: LayoutEvent[] = events.flatMap((e) => {
			let es = e.startTime;
			let ee = e.endTime;
			if (eventDrag && eventDrag.event.id === e.id) {
				const t = computeEventDragTimes(eventDrag);
				es = t.startTime;
				ee = t.endTime;
			}
			const s = es.getTime();
			const en = ee.getTime();
			if (s >= de0 || en <= ds0) return [];
			const ds = new Date(Math.max(s, ds0));
			const de = new Date(Math.min(en, de0));
			if (de.getTime() <= ds.getTime()) return [];
			return [
				{
					...e,
					top: (minutesSinceMidnight(ds) / 60) * pxPerHour,
					height: Math.max(((de.getTime() - ds.getTime()) / 3600000) * pxPerHour, 18),
					col: 0,
					cols: 1,
				},
			];
		});
		candidates.sort(
			(a, b) =>
				a.startTime.getTime() - b.startTime.getTime() ||
				b.endTime.getTime() - a.endTime.getTime(),
		);

		const groups: LayoutEvent[][] = [];
		let groupEnd = -Infinity;
		for (const e of candidates) {
			if (e.startTime.getTime() < groupEnd) {
				groups[groups.length - 1].push(e);
			} else {
				groups.push([e]);
			}
			groupEnd = Math.max(groupEnd, e.endTime.getTime());
		}

		for (const group of groups) {
			const placed: LayoutEvent[] = [];
			for (const e of group) {
				let col = 0;
				while (placed.some((p) => p.col === col && eventsOverlap(p, e))) {
					col++;
				}
				e.col = col;
				placed.push(e);
			}
			const width = Math.max(...group.map((g) => g.col)) + 1;
			for (const e of group) {
				e.cols = width;
			}
		}

		return candidates;
	}

	let dragging = $state<DragState | null>(null);
	let hoverTooltip = $state<{ event: ScheduleEvent; left: number; top: number } | null>(null);
	let eventDrag = $state<EventDragState | null>(null);
	let suppressClick = $state(false);

	function startEventDrag(e: PointerEvent, event: LayoutEvent, mode: EventDragMode) {
		e.stopPropagation();
		suppressClick = false;
		if (!moment(event.startTime).isSame(event.endTime, 'day')) return;
		const colEl = (e.currentTarget as HTMLElement).closest(
			'[role="gridcell"]',
		) as HTMLElement | null;
		if (!colEl) return;
		colEl.setPointerCapture(e.pointerId);
		const colRect = colEl.getBoundingClientRect();
		const startOffsetY = e.clientY - colRect.top;
		const startOffsetX = e.clientX - colRect.left;
		eventDrag = {
			event,
			mode,
			columnTop: colRect.top,
			columnLeft: colRect.left,
			columnWidth: colRect.width,
			startOffsetY,
			startOffsetX,
			pointerStartMin: minutesFromOffset(startOffsetY),
			startMin: minutesSinceMidnight(event.startTime),
			endMin: minutesSinceMidnight(event.endTime),
			currentMin: minutesFromOffset(startOffsetY),
			dayDelta: 0,
			moved: false,
		};
		hoverTooltip = null;
	}

	function updateEventDrag(e: PointerEvent) {
		if (!eventDrag) return;
		const offsetY = e.clientY - eventDrag.columnTop;
		const offsetX = e.clientX - eventDrag.columnLeft;
		if (
			Math.abs(offsetY - eventDrag.startOffsetY) > 3 ||
			Math.abs(offsetX - eventDrag.startOffsetX) > 3
		) {
			eventDrag.moved = true;
		}
		eventDrag.currentMin = minutesFromOffset(offsetY);
		if (eventDrag.mode === 'move') {
			const col = Math.floor(offsetX / eventDrag.columnWidth);
			eventDrag.dayDelta = Math.max(-6, Math.min(6, col));
		}
	}

	const DAY_MS = 86400000;

	function computeEventDragTimes(d: EventDragState): { startTime: Date; endTime: Date } {
		const dayShift = d.mode === 'move' ? d.dayDelta * DAY_MS : 0;
		const baseStart = new Date(d.event.startTime.getTime() + dayShift);
		const baseEnd = new Date(d.event.endTime.getTime() + dayShift);
		let ns = d.startMin;
		let ne = d.endMin;
		if (d.mode === 'move') {
			const delta = d.currentMin - d.pointerStartMin;
			ns = d.startMin + delta;
			ne = d.endMin + delta;
			if (ns < 0) {
				ne -= ns;
				ns = 0;
			}
			if (ne > HOURS * 60) {
				ns -= ne - HOURS * 60;
				ne = HOURS * 60;
			}
			if (ns < 0) ns = 0;
		} else if (d.mode === 'resize-start') {
			ns = Math.min(d.currentMin, d.endMin - snapMinutes);
		} else {
			ne = Math.max(d.currentMin, d.startMin + snapMinutes);
		}
		const startTime = new Date(baseStart);
		startTime.setHours(Math.floor(ns / 60), ns % 60, 0, 0);
		const endTime = new Date(baseEnd);
		endTime.setHours(Math.floor(ne / 60), ne % 60, 0, 0);
		return { startTime, endTime };
	}

	function finishEventDrag() {
		if (!eventDrag) return;
		const drag = eventDrag;
		if (drag.moved) {
			const { startTime, endTime } = computeEventDragTimes(drag);
			if (
				startTime.getTime() !== drag.event.startTime.getTime() ||
				endTime.getTime() !== drag.event.endTime.getTime()
			) {
				onEventChange?.(drag.event, startTime, endTime);
			}
			suppressClick = true;
		} else {
			onEventClick?.(drag.event);
			suppressClick = true;
		}
		eventDrag = null;
	}

	function showEventTooltip(target: HTMLElement, event: ScheduleEvent) {
		const rect = target.getBoundingClientRect();
		const width = 224;
		const gap = 8;
		let left = rect.right + gap;
		if (left + width > window.innerWidth - gap) {
			left = Math.max(gap, rect.left - gap - width);
		}
		const top = Math.max(gap, rect.top);
		hoverTooltip = { event, left, top };
	}

	function minutesFromOffset(offsetY: number): number {
		const raw = Math.round((offsetY / pxPerHour) * 60);
		const snapped = Math.max(0, Math.round(raw / snapMinutes) * snapMinutes);
		return Math.min(snapped, HOURS * 60);
	}

	function onColumnPointerDown(e: PointerEvent, day: Date) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const offsetY = e.clientY - rect.top;
		dragging = { day, startY: offsetY, currentY: offsetY };
	}

	function onColumnPointerMove(e: PointerEvent) {
		if (eventDrag) {
			updateEventDrag(e);
			return;
		}
		if (!dragging) return;
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		dragging = { ...dragging, currentY: e.clientY - rect.top };
	}

	function onColumnPointerUp() {
		if (eventDrag) {
			finishEventDrag();
			return;
		}
		if (!dragging) return;
		const { day, startY, currentY } = dragging;
		const minY = Math.min(startY, currentY);
		const maxY = Math.max(startY, currentY);

		const startMinutes = minutesFromOffset(minY);
		const endMinutes = minutesFromOffset(maxY);

		if (endMinutes - startMinutes >= snapMinutes) {
			const startTime = new Date(day);
			startTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
			const endTime = new Date(day);
			endTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
			onCreate?.({ date: new Date(day), startTime, endTime });
		}

		dragging = null;
	}

	function hourLabel(h: number): string {
		return `${String(h).padStart(2, '0')}:00`;
	}
</script>

<div
	class="overflow-auto rounded-xl border border-ink-900/10 bg-white shadow-soft"
	style="max-height: 600px;"
	bind:this={scrollContainer}
>
	<div class="min-w-[720px]">
		<div
			class="sticky top-0 z-20 grid border-b border-ink-900/10 bg-white"
			style="grid-template-columns: 56px repeat(7, minmax(0, 1fr));"
			bind:this={headerRow}
		>
			<div class="sticky left-0 z-30 border-r border-ink-900/10 bg-white"></div>
			{#each days as day}
				<div class="border-l border-ink-900/5 px-2 py-2 text-center">
					<p class="text-[13px] font-semibold uppercase tracking-wide text-ink-900">
						{DAY_LABELS[moment(day).day()]}
					</p>
					{#if showDate}
						<p class="text-[10.5px] text-ink-400">
							{moment(day).format('MMM D')}
						</p>
					{/if}
				</div>
			{/each}
		</div>

		<div
			class="grid"
			style="grid-template-columns: 56px repeat(7, minmax(0, 1fr)); height: {columnHeight}px;"
		>
			<div class="sticky left-0 z-20 border-r border-ink-900/10 bg-white">
				{#each Array.from({ length: HOURS + 1 }, (_, h) => h) as h}
					<div
						class="absolute right-1 -translate-y-1/2 text-[10px] text-ink-400"
						style="top: {h * pxPerHour}px;"
					>
						{hourLabel(h)}
					</div>
				{/each}
			</div>

			{#each days as day}
				<div
					role="gridcell"
					tabindex="-1"
					aria-label={DAY_LABELS[moment(day).day()]}
					class="relative cursor-crosshair border-l border-ink-900/5 bg-ink-900/[0.01]"
					style="height: {columnHeight}px;"
					onpointerdown={(e) => onColumnPointerDown(e, day)}
					onpointermove={onColumnPointerMove}
					onpointerup={onColumnPointerUp}
					onpointerleave={onColumnPointerUp}
				>
					{#each Array.from({ length: HOURS }, (_, h) => h) as h}
						<div
							class="absolute inset-x-0 border-t border-ink-900/5"
							style="top: {h * pxPerHour}px;"
						></div>
					{/each}

					{#each layoutDay(day) as event (event.id)}
						<button
							type="button"
							onmouseenter={(e) =>
								showEventTooltip(e.currentTarget as HTMLElement, event)}
							onmouseleave={() => (hoverTooltip = null)}
							onfocus={(e) => showEventTooltip(e.currentTarget as HTMLElement, event)}
							onblur={() => (hoverTooltip = null)}
							onpointerdown={(e) => startEventDrag(e, event, 'move')}
							onclick={(e) => {
								e.stopPropagation();
								if (suppressClick) {
									suppressClick = false;
									return;
								}
								onEventClick?.(event);
							}}
							class="absolute cursor-grab select-none touch-none overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-left shadow-sm transition hover:opacity-80"
							style="top: {event.top}px; height: {event.height}px; left: calc({(event.col /
								event.cols) *
								100}% + 4px); width: calc({100 /
								event.cols}% - 8px); background: {event.color ??
								'#eef2ff'}; border-color: {event.color ?? '#6366f1'};"
						>
							<span
								role="presentation"
								class="absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize touch-none"
								onpointerdown={(e) => startEventDrag(e, event, 'resize-start')}
							></span>
							<span
								role="presentation"
								class="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-ns-resize touch-none"
								onpointerdown={(e) => startEventDrag(e, event, 'resize-end')}
							></span>
							<p
								class="truncate text-[11px] font-medium"
								style="color: {event.color ? '#ffffff' : '#3730a3'};"
							>
								{event.title || t('common.untitled')}
							</p>
							<p
								class="truncate text-[9.5px]"
								style="color: {event.color ? 'rgba(255,255,255,0.8)' : '#64748b'};"
							>
								{moment(event.startTime).format('HH:mm')} – {moment(
									event.endTime,
								).format('HH:mm')}
							</p>
						</button>
					{/each}

					{#if dragging && moment(dragging.day).isSame(day, 'day')}
						{@const minY = Math.min(dragging.startY, dragging.currentY)}
						{@const maxY = Math.max(dragging.startY, dragging.currentY)}
						{@const height = Math.max(maxY - minY, 2)}
						{@const startMinutes = minutesFromOffset(minY)}
						{@const endMinutes = minutesFromOffset(maxY)}
						<div
							class="pointer-events-none absolute inset-x-1 z-10 rounded-md bg-iris-500/30 ring-1 ring-iris-500"
							style="top: {minY}px; height: {height}px;"
						>
							<p class="px-1.5 text-[10px] font-semibold text-iris-700">
								{moment()
									.startOf('day')
									.set('hours', Math.floor(startMinutes / 60))
									.set('minutes', startMinutes % 60)
									.format('HH:mm')}
								–
								{moment()
									.startOf('day')
									.set('hours', Math.floor(endMinutes / 60))
									.set('minutes', endMinutes % 60)
									.format('HH:mm')}
							</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>

{#if hoverTooltip}
	<div
		class="pointer-events-none fixed z-50 w-56 rounded-lg bg-ink-900/95 px-3 py-2 text-white shadow-xl"
		style={`left:${hoverTooltip.left}px;top:${hoverTooltip.top}px`}
		role="tooltip"
	>
		<p class="truncate text-[12.5px] font-semibold">
			{hoverTooltip.event.title || t('common.untitledLecture')}
		</p>
		<p class="mt-0.5 text-[11px] text-white/80">
			{moment(hoverTooltip.event.startTime).format('HH:mm')} –{' '}
			{moment(hoverTooltip.event.endTime).format('HH:mm')}
		</p>
		<p class="text-[11px] text-white/60">
			{moment(hoverTooltip.event.startTime).format('ddd, MMM D')}
		</p>
	</div>
{/if}
