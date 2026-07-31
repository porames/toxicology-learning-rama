<script lang="ts">
	import { ChevronLeft, ChevronRight, Check, Sun } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import formatTimeRange from '$lib/formatTimeRange';
	import type { Lecture, ClassItem } from '$lib/dashboard/types';

	function groupLecturesByDate(lectures: Lecture[]): Record<string, Lecture[]> {
		const sorted = [...lectures].sort(
			(a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
		);
		return sorted.reduce<Record<string, Lecture[]>>((groups, lec) => {
			const d = new Date(lec.startTime);
			const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			if (!groups[dateKey]) groups[dateKey] = [];
			groups[dateKey].push(lec);
			return groups;
		}, {});
	}

	function formatDateHeader(dateKey: string): string {
		const [year, month, day] = dateKey.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'short',
			day: 'numeric',
		});
	}

	function getDateKey(date: Date): string {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}

	interface Props {
		lectures: Lecture[];
		currentClass?: ClassItem;
		selectedLectureId?: string;
		completedIds: Set<string>;
		loading: boolean;
		error: string | null;
		onSelectLecture: (lec: Lecture) => void;
	}

	let {
		lectures,
		currentClass,
		selectedLectureId,
		completedIds,
		loading,
		error,
		onSelectLecture,
	}: Props = $props();

	const todayKey = $derived(getDateKey(new Date()));
	const upcomingToday = $derived(
		[...lectures]
			.filter((lec) => getDateKey(new Date(lec.startTime)) === todayKey)
			.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
	);
	const upcomingTodayIds = $derived(new Set(upcomingToday.map((lec) => lec.id)));
	const groupedLectures = $derived(
		groupLecturesByDate(lectures.filter((lec) => !upcomingTodayIds.has(lec.id))),
	);
</script>

<div
	class={`overflow-y-auto border-r border-ink-900/8 px-6 py-5 ${selectedLectureId ? 'hidden md:block md:w-[280px] md:shrink-0' : 'block w-full md:w-[280px] md:shrink-0'}`}
>
	<div class="-mx-4 px-2">
		{#if loading}
			<div class="space-y-1.5">
				{#each Array(3) as _}
					<div class="h-12 w-full animate-pulse rounded-md bg-ink-900/5"></div>
				{/each}
			</div>
		{:else if error}
			<p class="text-xs text-red-600">{error}</p>
		{:else if lectures.length === 0}
			<p class="text-xs text-ink-900/40">No lectures yet for this class.</p>
		{:else}
			<div>
				{#if upcomingToday.length > 0}
					<div
						class="mb-4 overflow-hidden rounded-xl bg-gradient-to-br from-iris-500 to-iris-700 text-white shadow-button"
					>
						<div class="flex items-center justify-between gap-2 px-3 pt-3">
							<div class="flex items-center gap-2">
								<span
									class="flex h-6 w-6 items-center justify-center rounded-md bg-white/15"
								>
									<Sun class="h-3.5 w-3.5" />
								</span>
								<p class="text-[12.5px] font-semibold uppercase tracking-wide">
									Today's lectures
								</p>
							</div>
							<p class="text-[12px] font-medium text-white/80">
								{new Date().toLocaleDateString(undefined, {
									weekday: 'short',
									month: 'short',
									day: 'numeric',
								})}
							</p>
						</div>
						<div class="mt-1.5 space-y-0.5 p-1.5">
							{#each upcomingToday as lec}
								<button
									type="button"
									onclick={() => onSelectLecture(lec)}
									class={`block w-full rounded-lg py-2 px-2.5 text-left transition-colors ${
										selectedLectureId === lec.id
											? 'bg-white/25'
											: 'hover:bg-white/15'
									}`}
								>
									<div class="flex items-center gap-2">
										<p class="text-[13.5px] font-medium text-white flex-1">
											{lec.title || 'Untitled'}
										</p>
										{#if completedIds.has(lec.id)}
											<Check size={14} class="shrink-0 text-emerald-200" />
										{/if}
									</div>
									<p class="text-[12px] text-white/70">
										{formatTimeRange(lec.startTime, lec.endTime)}
									</p>
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<div
						class="mb-4 flex items-center justify-between gap-2 rounded-xl border border-ink-900/10 bg-white/60 px-3 py-3 shadow-soft"
					>
						<div class="flex items-center gap-2">
							<span
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-900/5"
							>
								<Sun class="h-3.5 w-3.5 text-ink-400" />
							</span>
							<p class="text-[12.5px] text-ink-500">No lectures for today</p>
						</div>
						<p class="text-[12px] font-medium text-ink-400">
							{new Date().toLocaleDateString(undefined, {
								weekday: 'short',
								month: 'short',
								day: 'numeric',
							})}
						</p>
					</div>
				{/if}

				{#each Object.entries(groupedLectures) as [dateKey, lecsForDay]}
					<div class="mb-4 last:mb-0">
						<p
							class="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-ink-900/40"
						>
							{formatDateHeader(dateKey)}
						</p>
						<div class="space-y-1">
							{#each lecsForDay as lec}
								<button
									type="button"
									onclick={() => onSelectLecture(lec)}
									class={`block w-full rounded-md py-2 px-2 md:py-1.5 text-left transition-colors ${
										selectedLectureId === lec.id
											? 'bg-iris-600/10'
											: 'hover:bg-ink-900/5'
									}`}
								>
									<div class="flex items-center gap-2">
										<p class="text-sm font-medium text-ink-900 flex-1">
											{lec.title || 'Untitled'}
										</p>
										{#if completedIds.has(lec.id)}
											<Check size={14} class="shrink-0 text-teal-500" />
										{/if}
									</div>
									<p class="text-xs text-ink-900/50">
										{formatTimeRange(lec.startTime, lec.endTime)}
									</p>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
