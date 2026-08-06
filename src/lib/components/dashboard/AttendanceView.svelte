<script lang="ts">
	import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import {
		CalendarCheck,
		ChevronDown,
		ChevronRight,
		Download,
		ClockCheck,
		ListChecks,
		Users,
	} from '@lucide/svelte';
	import type { Lecture } from '$lib/dashboard/types';
	import moment from 'moment';

	let { classId }: { classId: string } = $props();

	let loading = $state(true);
	let error = $state<string | null>(null);
	let lectures = $state<Lecture[]>([]);
	let expanded = $state<Set<string>>(new Set());

	interface StudentActivity {
		checkedInAt: Date | null;
		completedAt: Date | null;
	}

	interface StudentRow {
		id: string;
		ramaId: string;
		name: string;
		email: string;
		lectures: Record<string, StudentActivity>;
	}

	let students = $state<StudentRow[]>([]);

	function fmtTime(d?: Date | null): string {
		return d ? moment(d).format('ddd, MMM D · hh:mm A') : '';
	}

	function checkedInCount(row: StudentRow): number {
		return lectures.filter((l) => row.lectures[l.id]?.checkedInAt).length;
	}

	function completedCount(row: StudentRow): number {
		return lectures.filter((l) => row.lectures[l.id]?.completedAt).length;
	}

	async function load() {
		loading = true;
		error = null;
		try {
			const classSnap = await getDoc(doc(db, 'classes', classId));
			if (!classSnap.exists()) {
				error = 'Class not found.';
				return;
			}
			console.log(classSnap.data());
			const enroled: string[] = classSnap.data()?.enroledStudents ?? [];

			const lecSnap = await getDocs(collection(db, 'classes', classId, 'lectures'));
			lectures = lecSnap.docs.map((d) => ({
				id: d.id,
				title: d.data()?.title ?? 'Untitled lecture',
				startTime: d.data()?.startTime?.toDate?.() ?? new Date(),
				endTime: d.data()?.endTime?.toDate?.() ?? new Date(),
				materials: [],
			})) as Lecture[];
			lectures.sort(
				(a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
			);

			const usersSnap = await getDocs(collection(db, 'users'));
			const byId = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));

			const rows: StudentRow[] = [];
			for (const id of enroled) {
				const data = byId.get(id);
				if (!data) continue;
				const actSnap = await getDocs(
					query(
						collection(db, 'users', id, 'activities'),
						where('classId', '==', classId),
					),
				);
				const acts: Record<string, StudentActivity> = {};
				actSnap.docs.forEach((d) => {
					const a = d.data();
					acts[d.id] = {
						checkedInAt: a.checkedInAt?.toDate?.() ?? null,
						completedAt: a.completedAt?.toDate?.() ?? null,
					};
				});
				rows.push({
					id,
					ramaId: data.rama_id ?? '',
					name: data.name ?? 'Unknown',
					email: data.email ?? '',
					lectures: acts,
				});
			}
			rows.sort((a, b) => a.name.localeCompare(b.name));
			students = rows;
		} catch (err) {
			console.error(err);
			error = "Couldn't load attendance. Try refreshing the page.";
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	function toggleExpand(id: string) {
		const next = new Set(expanded);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expanded = next;
	}

	function exportCsv() {
		const fmt = (d?: Date | null) => (d ? moment(d).format('YYYY-MM-DD HH:mm:ss') : '');
		const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
		const header = [
			'Student ID',
			'Full Name',
			'Email',
			'Checked In',
			'Completed',
			'Total Lectures',
			...lectures.flatMap((l) => [`Check-in: ${l.title}`, `Completed: ${l.title}`]),
		];
		const lines = students.map((s) =>
			[
				s.ramaId,
				s.name,
				s.email,
				checkedInCount(s),
				completedCount(s),
				lectures.length,
				...lectures.flatMap((l) => [
					fmt(s.lectures[l.id]?.checkedInAt),
					fmt(s.lectures[l.id]?.completedAt),
				]),
			]
				.map(esc)
				.join(','),
		);
		const csv = [header.map(esc).join(','), ...lines].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `attendance_${classId}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="mx-auto w-xl px-8 py-10">
	<div class="flex items-center justify-between gap-3">
		<div>
			<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">Attendance</p>
			<h1 class="mt-1 flex items-center gap-2 text-[18px] font-semibold text-ink-900">
				<CalendarCheck class="h-4 w-4 text-emerald-500" />
				Student attendance
			</h1>
			<p class="mt-1 text-[13px] text-ink-500">
				{loading
					? 'Loading…'
					: `${students.length} student${students.length === 1 ? '' : 's'} · ${lectures.length} lecture${lectures.length === 1 ? '' : 's'}`}
			</p>
		</div>
		<button
			onclick={exportCsv}
			disabled={loading || students.length === 0}
			class="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-900/10 bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-700 shadow-soft transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Download class="h-3.5 w-3.5" />
			Export CSV
		</button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center gap-2 py-16">
			<div
				class="h-5 w-5 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
			></div>
			<span class="text-[13px] text-ink-500">Loading attendance…</span>
		</div>
	{:else if error}
		<p class="py-10 text-center text-[13px] text-red-600">{error}</p>
	{:else if lectures.length === 0}
		<div class="flex flex-col items-center justify-center px-8 py-16 text-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900/5 text-ink-400"
			>
				<CalendarCheck class="h-6 w-6" />
			</div>
			<p class="mt-4 text-[15px] font-medium text-ink-900">No lectures yet</p>
			<p class="mt-1 max-w-xs text-[13.5px] text-ink-500">
				Add lectures to this class to start tracking attendance.
			</p>
		</div>
	{:else if students.length === 0}
		<div class="flex flex-col items-center justify-center px-8 py-16 text-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500"
			>
				<Users class="h-6 w-6" />
			</div>
			<p class="mt-4 text-[15px] font-medium text-ink-900">No students enrolled</p>
			<p class="mt-1 max-w-xs text-[13.5px] text-ink-500">
				Enrol students into this class to start tracking their attendance.
			</p>
		</div>
	{:else}
		<div class="mt-6 space-y-2">
			{#each students as student (student.id)}
				{@const ci = checkedInCount(student)}
				{@const co = completedCount(student)}
				<div
					class="overflow-hidden rounded-lg border border-ink-900/10 bg-white shadow-soft"
				>
					<button
						onclick={() => toggleExpand(student.id)}
						class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-900/[0.02]"
					>
						{#if expanded.has(student.id)}
							<ChevronDown class="h-4 w-4 shrink-0 text-ink-400" />
						{:else}
							<ChevronRight class="h-4 w-4 shrink-0 text-ink-400" />
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-[14px] font-medium text-ink-900">
								{student.name}
								<span class="ml-2 font-mono text-[12px] font-normal text-ink-400"
									>{student.ramaId}</span
								>
							</p>
							<p class="truncate text-[12.5px] text-ink-500">{student.email}</p>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<span
								class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700"
							>
								<ClockCheck class="h-3.5 w-3.5" />
								{ci}/{lectures.length}
							</span>
							<span
								class="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11.5px] font-semibold text-teal-700"
							>
								<ListChecks class="h-3.5 w-3.5" />
								{co}/{lectures.length}
							</span>
						</div>
					</button>

					{#if expanded.has(student.id)}
						<div class="border-t border-ink-900/5">
							{#if lectures.length === 0}
								<p class="px-4 py-3 text-[12.5px] text-ink-400">No lectures yet.</p>
							{:else}
								<ul class="divide-y divide-ink-900/5">
									{#each lectures as lec (lec.id)}
										{@const act = student.lectures[lec.id]}
										<li
											class="flex items-center justify-between gap-3 px-4 py-2.5"
										>
											<div class="min-w-0 flex-1">
												<p
													class="truncate text-[13px] font-medium text-ink-900"
												>
													{lec.title || 'Untitled lecture'}
												</p>
												<p class="text-[12px] text-ink-400">
													{moment(lec.startTime).format(
														'ddd, MMM D · hh:mm A',
													)}
												</p>
											</div>
											<div
												class="flex shrink-0 items-center gap-3 text-[12px]"
											>
												<span
													class="inline-flex items-center gap-1 font-medium {act?.checkedInAt
														? 'text-emerald-600'
														: 'text-ink-300'}"
												>
													<ClockCheck class="h-3.5 w-3.5" />
													{act?.checkedInAt
														? fmtTime(act.checkedInAt)
														: 'Not checked in'}
												</span>
												<span
													class="inline-flex items-center gap-1 font-medium {act?.completedAt
														? 'text-teal-600'
														: 'text-ink-300'}"
												>
													<ListChecks class="h-3.5 w-3.5" />
													{act?.completedAt
														? fmtTime(act.completedAt)
														: 'Not completed'}
												</span>
											</div>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
