<script lang="ts">
	import { ChevronRight, Folder, Clock } from '@lucide/svelte';
	import type { ClassItem, Lecture } from '$lib/dashboard/types';
	import formatTimeRange from '$lib/formatTimeRange';
	import moment from 'moment';

	let {
		classes,
		activeClassId,
		activeLectureId,
		expanded,
		onToggle,
		onSelectClass,
		onSelectLecture,
	}: {
		classes: ClassItem[];
		activeClassId?: string;
		activeLectureId?: string;
		expanded: Set<string>;
		onToggle: (classId: string, isExpanded: boolean) => void;
		onSelectClass: (classId: string) => void;
		onSelectLecture: (classId: string, lectureId: string) => void;
	} = $props();

	function groupedLectures(lectures: Lecture[]): [string, Lecture[]][] {
		const groups = new Map<string, Lecture[]>();
		for (const lec of lectures) {
			const key = moment(lec.startTime).format('YYYY-MM-DD');
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(lec);
		}
		return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
	}
</script>

{#if classes.length === 0}
	<div class="px-4 py-10 text-center">
		<p class="text-[13.5px] text-ink-300">No classes yet.</p>
	</div>
{:else}
	<div class="space-y-0.5 py-2">
		{#each classes as cls}
			{@const classExpanded = expanded.has(cls.id)}
			{@const classSelected = activeClassId === cls.id}

			<div
				role="button"
				tabindex="0"
				onclick={() => onSelectClass(cls.id)}
				onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectClass(cls.id)}
				class={`group relative flex h-9 items-center gap-1.5 rounded-md pr-1.5 text-left transition pl-2 ${
					classSelected
						? 'bg-iris-50 text-iris-700'
						: 'text-ink-700 hover:bg-ink-900/[0.03]'
				}`}
			>
				<button
					type="button"
					onclick={(e) => {
						e.stopPropagation();
						onToggle(cls.id, classExpanded);
					}}
					class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-300 hover:text-ink-500"
					aria-label={classExpanded ? 'Collapse' : 'Expand'}
				>
					<ChevronRight
						class={`h-3.5 w-3.5 transition-transform ${classExpanded ? 'rotate-90' : ''}`}
					/>
				</button>
				<span
					class={`flex h-5 w-5 shrink-0 items-center justify-center ${classSelected ? 'text-iris-600' : 'text-ink-300'}`}
				>
					<Folder class="h-4 w-4" />
				</span>
				<span class="flex min-w-0 flex-1 items-baseline gap-2">
					<span class="truncate text-[13.5px] font-medium">{cls.name}</span>
					{#if cls.code}
						<span class="shrink-0 truncate text-[12px] text-ink-300">{cls.code}</span>
					{/if}
				</span>
			</div>

			{#if classExpanded}
				<div class="relative" style="margin-left: 18px;">
					<div class="absolute bottom-1 left-0 top-0 w-px bg-ink-900/10"></div>
					<div class="pl-4">
						{#if cls.lectures === undefined}
							<p class="py-2 text-[12.5px] italic text-ink-300">Loading ...</p>
						{:else if cls.lectures.length === 0}
							<p class="py-2 text-[12.5px] italic text-ink-300">No lectures yet</p>
						{:else}
							{#each groupedLectures(cls.lectures) as [key, lecs]}
								{@const firstLec = lecs[0]}
								<div
									class="px-1 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-400"
								>
									{moment(firstLec.startTime).format('ddd, MMM D, YYYY')}
								</div>
								{#each lecs as lec}
									{@const lecExpanded = expanded.has(lec.id)}
									{@const lecSelected =
										activeClassId === cls.id && activeLectureId === lec.id}
									<div
										role="button"
										tabindex="0"
										onclick={() => onSelectLecture(cls.id, lec.id)}
										onkeydown={(e) =>
											(e.key === 'Enter' || e.key === ' ') &&
											onSelectLecture(cls.id, lec.id)}
										class={`group relative flex h-9 items-center gap-1.5 rounded-md pr-1.5 text-left transition pl-2 ${
											lecSelected
												? 'bg-iris-50 text-iris-700'
												: 'text-ink-700 hover:bg-ink-900/[0.03]'
										}`}
									>
										<span
											class={`flex h-5 w-5 shrink-0 items-center justify-center ${lecSelected ? 'text-iris-600' : 'text-ink-300'}`}
										>
											<Clock class="h-4 w-4" />
										</span>
										<span class="flex min-w-0 flex-1 items-baseline gap-2">
											<span class="truncate text-[13.5px] font-medium"
												>{lec.title || 'Untitled lecture'}</span
											>
											<span class="shrink-0 truncate text-[12px] text-ink-300"
												>{formatTimeRange(lec.startTime, lec.endTime)}</span
											>
										</span>
									</div>
								{/each}
							{/each}
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</div>
{/if}
