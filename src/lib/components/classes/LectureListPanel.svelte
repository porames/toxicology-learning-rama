<script lang="ts">
	import { Sun, ClockCheck, ListChecks, Folder, Lock, ClipboardList } from '@lucide/svelte';
	import formatTimeRange from '$lib/formatTimeRange';
	import { Tooltip } from '$lib/components/ui';
	import type { Lecture, ClassItem, Assignment } from '$lib/dashboard/types';
	import { db } from '$lib/firebase';
	import { collection, getDocs, query, where } from 'firebase/firestore';
	import { authState } from '$lib/auth.svelte';
	import moment from 'moment';

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

	function statusLabel(status: 'checkedIn' | 'completed', time?: Date): string {
		const label = status === 'checkedIn' ? 'Checked in' : 'Completed';
		if (!time) return label;
		return `${label} · ${moment(time).format('ddd, MMM D · hh:mm A')}`;
	}

	interface Props {
		lectures: Lecture[];
		currentClass?: ClassItem;
		selectedLectureId?: string;
		selectedAssignmentId?: string;
		completedIds: Set<string>;
		checkedInIds: Set<string>;
		checkedInTimes: Record<string, Date>;
		completedTimes: Record<string, Date>;
		loading: boolean;
		error: string | null;
		onSelectLecture: (lec: Lecture) => void;
		onSelectAssignment?: (assignment: Assignment) => void;
	}

	let {
		lectures,
		currentClass,
		selectedLectureId,
		selectedAssignmentId,
		completedIds,
		checkedInIds,
		checkedInTimes,
		completedTimes,
		loading,
		error,
		onSelectLecture,
		onSelectAssignment,
	}: Props = $props();

	const todayKey = $derived(getDateKey(new Date()));
	const upcomingToday = $derived(
		[...lectures]
			.filter((lec) => getDateKey(new Date(lec.startTime)) === todayKey)
			.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
	);
	const upcomingLectures = $derived(
		lectures.filter((lec) => getDateKey(new Date(lec.startTime)) > todayKey),
	);
	const pastLectures = $derived(
		lectures.filter((lec) => getDateKey(new Date(lec.startTime)) < todayKey),
	);
	const groupedUpcoming = $derived(groupLecturesByDate(upcomingLectures));
	const groupedPast = $derived(Object.entries(groupLecturesByDate(pastLectures)).reverse());

	let now = $state(new Date());

	$effect(() => {
		const timer = setInterval(() => {
			now = new Date();
		}, 1000);
		return () => clearInterval(timer);
	});

	let assignments = $state<Assignment[]>([]);
	let assignmentsLoading = $state(false);
	let assignmentsError = $state<string | null>(null);

	$effect(() => {
		const classId = currentClass?.id;
		const docId = authState.profile?.docId;
		if (!classId || !docId) return;
		assignmentsLoading = true;
		assignmentsError = null;
		(async () => {
			try {
				const snapshot = await getDocs(
					query(
						collection(db, 'classes', classId, 'assignments'),
						where('assignedStudentIds', 'array-contains', docId),
					),
				);

				const data = snapshot.docs.map(
					(d) =>
						({
							id: d.id,
							...d.data(),
							requiredAttachments: d.data()?.requiredAttachments ?? [],
							assignedStudentIds: d.data()?.assignedStudentIds ?? [],
						}) as Assignment,
				);
				console.log(data);
				assignments = data.sort(
					(a, b) =>
						(a.dueDate?.toDate?.()?.getTime() ?? 0) -
						(b.dueDate?.toDate?.()?.getTime() ?? 0),
				);
			} catch (err) {
				console.error(err);
				assignmentsError = "Couldn't load assignments.";
			} finally {
				assignmentsLoading = false;
			}
		})();
	});

	function isAccessible(lec: Lecture): boolean {
		const t = now.getTime();
		return t >= new Date(lec.startTime).getTime() && t <= new Date(lec.endTime).getTime();
	}
</script>

<div
	class={`overflow-y-auto border-r border-ink-900/8 px-6 py-5 ${selectedLectureId || selectedAssignmentId ? 'hidden md:block md:w-[280px] md:shrink-0' : 'block w-full md:w-[280px] md:shrink-0'}`}
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
								<p class="text-[12.5px] font-semibold">Today's lectures</p>
							</div>
							<p class="text-[12px] font-medium text-white/80">
								{moment().format('Do MMM')}
							</p>
						</div>
						<div class="mt-1.5 divide-y divide-white/10 rounded-lg p-1.5">
							{#each upcomingToday as lec}
								<button
									type="button"
									onclick={() => isAccessible(lec) && onSelectLecture(lec)}
									disabled={!isAccessible(lec)}
									class={`block w-full py-2 px-2.5 text-left transition-colors ${
										selectedLectureId === lec.id
											? 'bg-white/25'
											: isAccessible(lec)
												? 'hover:bg-white/15'
												: 'opacity-50 cursor-not-allowed'
									}`}
								>
									<div class="flex items-center gap-2 justify-between">
										<div>
											<p class="text-[13.5px] font-medium text-white flex-1">
												{lec.title || 'Untitled'}
											</p>
											<p class="text-[12px] text-white/70">
												{formatTimeRange(lec.startTime, lec.endTime)}
											</p>
										</div>
										<div class="flex flex-col gap-2 items-center">
											{#if checkedInIds.has(lec.id)}
												<Tooltip
													text={statusLabel(
														'checkedIn',
														checkedInTimes[lec.id],
													)}
												>
													<div
														class="bg-emerald-300/20 px-1.5 py-1 rounded-full text-emerald-200 flex flex-row items-center gap-1 font-semibold"
													>
														<ClockCheck size={13} />
													</div>
												</Tooltip>
											{:else}
												<Tooltip text="Hasn't checked in">
													<div
														class="bg-yellow-300/20 px-1.5 py-1 rounded-full text-yellow-200 flex flex-row items-center gap-1 font-semibold"
													>
														<ClockCheck size={13} />
													</div>
												</Tooltip>
											{/if}
											{#if completedIds.has(lec.id)}
												<Tooltip
													text={statusLabel(
														'completed',
														completedTimes[lec.id],
													)}
												>
													<div
														class="bg-emerald-300/20 px-1.5 py-1 rounded-full text-emerald-200 flex flex-row items-center gap-1 font-semibold"
													>
														<ListChecks size={13} />
													</div>
												</Tooltip>
											{:else}
												<Tooltip text="Hasn't completed lecture">
													<div
														class="bg-yellow-300/20 px-1.5 py-1 rounded-full text-yellow-200 flex flex-row items-center gap-1 font-semibold"
													>
														<ListChecks size={13} />
													</div>
												</Tooltip>
											{/if}
										</div>
									</div>
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

				{#if currentClass}
					<div class="mb-4">
						<div
							class="my-2 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-iris-600"
						>
							<ClipboardList class="h-3.5 w-3.5 shrink-0" />
							Assignments
							<span class="h-px flex-1 bg-ink-900/10"></span>
						</div>
						{#if assignmentsLoading}
							<div class="space-y-1.5 px-2">
								{#each Array(2) as _}
									<div
										class="h-14 w-full animate-pulse rounded-lg bg-ink-900/5"
									></div>
								{/each}
							</div>
						{:else if assignmentsError}
							<p class="px-2 text-xs text-red-600">{assignmentsError}</p>
						{:else if assignments.length === 0}
							<div
								class="mx-2 rounded-lg border border-dashed border-ink-900/15 bg-ink-900/[0.015] px-3 py-2.5"
							>
								<p class="text-[12.5px] text-ink-500">No assignments</p>
							</div>
						{:else}
							<div class="space-y-1.5 px-2">
								{#each assignments as assignment (assignment.id)}
									<button
										type="button"
										onclick={() => onSelectAssignment?.(assignment)}
										class={`block w-full rounded-lg border px-3 py-2 text-left shadow-soft transition ${
											selectedAssignmentId === assignment.id
												? 'border-iris-400 bg-iris-50/50'
												: 'border-ink-900/10 bg-white hover:border-iris-300 hover:bg-iris-50/40'
										}`}
									>
										<p class="truncate text-[13px] font-medium text-ink-900">
											{assignment.title ||
												assignment.instructions.split('\n')[0] ||
												'Assignment'}
										</p>
										<p class="mt-0.5 text-[11.5px] text-ink-500">
											Opens {assignment.opensAt?.toDate?.()
												? moment(assignment.opensAt.toDate()).format(
														'MMM D · hh:mm A',
													)
												: '—'}
										</p>
										<p class="text-[11.5px] text-ink-500">
											Due {assignment.dueDate?.toDate?.()
												? moment(assignment.dueDate.toDate()).format(
														'MMM D · hh:mm A',
													)
												: '—'}
										</p>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				{#if Object.keys(groupedUpcoming).length > 0}
					<div
						class="my-2 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-iris-600"
					>
						<Folder class="h-3.5 w-3.5 shrink-0" />
						Upcoming
						<span class="h-px flex-1 bg-ink-900/10"></span>
					</div>
					{#each Object.entries(groupedUpcoming) as [dateKey, lecsForDay]}
						<div class="mb-3 last:mb-0">
							<p
								class="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-ink-900/40"
							>
								{formatDateHeader(dateKey)}
							</p>
							<div class="divide-y divide-ink-900/5">
								{#each lecsForDay as lec}
									{@render lectureRow(lec)}
								{/each}
							</div>
						</div>
					{/each}
				{/if}

				{#if groupedPast.length > 0}
					<div
						class="my-2 mt-5 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-iris-600"
					>
						<Folder class="h-3.5 w-3.5 shrink-0" />
						Past lectures
						<span class="h-px flex-1 bg-ink-900/10"></span>
					</div>
					{#each groupedPast as [dateKey, lecsForDay]}
						<div class="mb-3 last:mb-0">
							<p
								class="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-ink-900/40"
							>
								{formatDateHeader(dateKey)}
							</p>
							<div class="divide-y divide-ink-900/5">
								{#each lecsForDay as lec}
									{@render lectureRow(lec, true)}
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>

{#snippet lectureRow(lec: Lecture, showAlert = false)}
	<button
		type="button"
		onclick={() => isAccessible(lec) && onSelectLecture(lec)}
		disabled={!isAccessible(lec)}
		class={`block w-full py-2 px-2 md:py-1.5 text-left transition-colors ${
			selectedLectureId === lec.id
				? 'bg-iris-600/10'
				: isAccessible(lec)
					? 'hover:bg-ink-900/5'
					: 'opacity-50 cursor-not-allowed'
		}`}
	>
		<div class="flex items-center gap-2">
			{#if !isAccessible(lec)}
				<Lock class="h-3.5 w-3.5 shrink-0 text-ink-400" />
			{/if}
			<p class="text-sm font-medium text-ink-900 flex-1">
				{lec.title || 'Untitled'}
			</p>
			{#if checkedInIds.has(lec.id)}
				<Tooltip text={statusLabel('checkedIn', checkedInTimes[lec.id])}>
					<div
						class="bg-emerald-300/20 px-1.5 py-1 rounded-full text-emerald-600 flex flex-row items-center gap-1 font-semibold"
					>
						<ClockCheck size={13} />
					</div>
				</Tooltip>
			{:else}
				<Tooltip text="Hasn't checked in">
					<div
						class="bg-yellow-300/20 px-1.5 py-1 rounded-full text-yellow-600 flex flex-row items-center gap-1 font-semibold"
					>
						<ClockCheck size={13} />
					</div>
				</Tooltip>
			{/if}

			{#if completedIds.has(lec.id)}
				<Tooltip text={statusLabel('completed', completedTimes[lec.id])}>
					<div
						class="bg-emerald-300/20 px-1.5 py-1 rounded-full text-emerald-600 flex flex-row items-center gap-1 font-semibold"
					>
						<ListChecks size={13} />
					</div>
				</Tooltip>
			{:else}
				<Tooltip text="Hasn't completed lecture">
					<div
						class="bg-yellow-300/20 px-1.5 py-1 rounded-full text-yellow-600 flex flex-row items-center gap-1 font-semibold"
					>
						<ListChecks size={13} />
					</div>
				</Tooltip>
			{/if}
		</div>
		<p class="text-xs text-ink-900/50">
			{formatTimeRange(lec.startTime, lec.endTime)}
		</p>
		{#if showAlert && !checkedInIds.has(lec.id) && !completedIds.has(lec.id)}
			<p class="mt-1.5 rounded-md bg-red-50 px-2 py-1 text-[11.5px] font-medium text-red-600">
				Not checked in or completed
			</p>
		{/if}
	</button>
{/snippet}
