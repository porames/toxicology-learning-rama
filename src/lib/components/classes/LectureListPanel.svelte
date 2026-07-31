<script lang="ts">
	import { ChevronLeft, ChevronRight, Check } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import formatTimeRange from '$lib/formatTimeRange';
	import type { Lecture, ClassItem } from '$lib/dashboard/types';

	function groupLecturesByDate(lectures: Lecture[]): Record<string, Lecture[]> {
		const sorted = [...lectures].sort(
			(a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
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

	const groupedLectures = $derived(groupLecturesByDate(lectures));
</script>

<div
	class={`overflow-y-auto border-r border-ink-900/8 px-6 py-5 ${selectedLectureId ? 'hidden md:block md:w-[280px] md:shrink-0' : 'block w-full md:w-[280px] md:shrink-0'}`}
>
	<div class="flex md:hidden items-center gap-1 pb-2 min-w-0 mb-2">
		<button
			type="button"
			onclick={() => goto('/classes')}
			class="text-ink-900/40 hover:text-ink-900 shrink-0"
			aria-label="Back to classes"
		>
			<ChevronLeft size={16} />
		</button>
		<button
			type="button"
			onclick={() => goto('/classes')}
			class="text-xs text-ink-900/40 hover:text-ink-900 shrink-0"
		>
			All Classes
		</button>
		<ChevronRight size={12} class="text-xs text-ink-900/20 shrink-0" />
		<button
			type="button"
			onclick={() => goto(`/classes/${currentClass?.id}`)}
			class="text-xs font-medium text-ink-900 hover:text-iris-600 truncate"
		>
			{currentClass?.name}
		</button>
	</div>

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
				{#each Object.entries(groupedLectures) as [dateKey, lecsForDay]}
					<div class="mb-4 last:mb-0">
						<p class="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-ink-900/40">
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
										<p class="text-sm font-medium text-ink-900 flex-1">{lec.title || 'Untitled'}</p>
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
