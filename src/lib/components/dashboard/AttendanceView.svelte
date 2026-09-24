<script lang="ts">
	import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import {
		CalendarCheck,
		CheckCircle2,
		ChevronDown,
		ChevronRight,
		Download,
		ClockCheck,
		ListChecks,
		Users,
		LoaderCircle,
		RefreshCw,
	} from '@lucide/svelte';
	import GoogleMeetIcon from '$lib/components/GoogleMeetIcon.svelte';
	import { Modal } from '$lib/components/ui';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import type { Lecture } from '$lib/dashboard/types';
	import { t, tn } from '$lib/i18n';
	import moment from 'moment';
	import Button from '../ui/Button.svelte';

	let { classId }: { classId: string } = $props();

	let loading = $state(true);
	let error = $state<string | null>(null);
	let lectures = $state<Lecture[]>([]);
	let expanded = $state<Set<string>>(new Set());
	let expandedLectures = $state<Set<string>>(new Set());

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
		return d ? moment(d).format('MMM D · hh:mm A') : '';
	}

	function fmtDateTime(iso?: string | null): string {
		return iso ? moment(iso).format('MMM D · hh:mm A') : '—';
	}

	function fmtDuration(sec?: number | null): string {
		if (!sec || sec <= 0) return '—';
		const mins = Math.floor(sec / 60);
		const hrs = Math.floor(mins / 60);
		return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
	}

	function meetUrl(lec: Lecture): string | null {
		return lec.materials.find((m) => m.type === 'meet')?.value ?? null;
	}

	interface MeetParticipant {
		name: string;
		email: string | null;
		displayName: string | null;
		realName: string | null;
		type: string;
		joinTime: string | null;
		leaveTime: string | null;
		sessionTimeSec: number | null;
	}

	interface MeetResult {
		conferenceRecord: string | null;
		participants: MeetParticipant[];
	}

	interface ParticipantsView {
		lecture: Lecture;
		result: MeetResult;
	}

	let participantsLoading = $state<string | null>(null);
	let participantsError = $state<Record<string, string>>({});
	let viewingParticipants = $state<ParticipantsView | null>(null);
	let refreshing = $state(false);
	let refreshError = $state<string | null>(null);
	let sessionDataByLecture = $state<Record<string, MeetResult>>({});

	const participantByEmail = $derived(
		new Map<string, MeetParticipant>(
			(viewingParticipants?.result.participants ?? [])
				.filter((p) => p.email)
				.map((p) => [p.email!.toLowerCase(), p]),
		),
	);

	const rosterRows = $derived(
		students.map((s) => ({
			student: s,
			participant: participantByEmail.get(s.email.toLowerCase()) ?? null,
		})),
	);

	async function loadParticipants(lec: Lecture, force = false): Promise<MeetResult> {
		const lecRef = doc(db, 'classes', classId, 'lectures', lec.id);
		if (!force) {
			const snap = await getDoc(lecRef);
			const cached = snap.exists()
				? (snap.data()?.sessionData as MeetResult | undefined)
				: undefined;
			if (cached) return cached;
		}

		const url = meetUrl(lec);
		if (!url) throw new Error('no meet url');
		const user = authState.user;
		const token = await user?.getIdToken();
		const res = await fetch(functionsUrl('getMeetParticipants'), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ meetingUri: url, classId, lectureId: lec.id }),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || 'failed');

		await updateDoc(lecRef, { sessionData: data }).catch((err) => console.warn(err));
		return data;
	}

	async function checkParticipants(lec: Lecture) {
		if (participantsLoading) return;
		participantsLoading = lec.id;
		participantsError = { ...participantsError, [lec.id]: '' };
		try {
			const result = await loadParticipants(lec);
			viewingParticipants = { lecture: lec, result };
			sessionDataByLecture = { ...sessionDataByLecture, [lec.id]: result };
		} catch (err) {
			console.error(err);
			participantsError = {
				...participantsError,
				[lec.id]: t('common.somethingWentWrong'),
			};
		} finally {
			participantsLoading = null;
		}
	}

	function openCachedParticipants(lec: Lecture) {
		const session = sessionDataByLecture[lec.id];
		if (!session) return;
		refreshError = null;
		viewingParticipants = { lecture: lec, result: session };
	}

	async function refreshParticipants() {
		if (!viewingParticipants || refreshing) return;
		refreshing = true;
		refreshError = null;
		try {
			const result = await loadParticipants(viewingParticipants.lecture, true);
			viewingParticipants = { ...viewingParticipants, result };
		} catch (err) {
			console.error(err);
			refreshError = t('common.somethingWentWrong');
		} finally {
			refreshing = false;
		}
	}

	function checkedInCount(row: StudentRow): number {
		return lectures.filter((l) => row.lectures[l.id]?.checkedInAt).length;
	}

	function completedCount(row: StudentRow): number {
		return lectures.filter((l) => row.lectures[l.id]?.completedAt).length;
	}

	function participantFor(lecId: string, email: string): MeetParticipant | null {
		const parts = sessionDataByLecture[lecId]?.participants ?? [];
		const lower = email.toLowerCase();
		return parts.find((p) => (p.email?.toLowerCase() ?? '') === lower) ?? null;
	}

	function hasSessionRecord(lecId: string): boolean {
		return sessionDataByLecture[lecId]?.conferenceRecord != null;
	}

	function meetAttendedCount(row: StudentRow): number {
		return lectures.filter((l) => participantFor(l.id, row.email)).length;
	}

	async function load() {
		loading = true;
		error = null;
		try {
			const classSnap = await getDoc(doc(db, 'classes', classId));
			if (!classSnap.exists()) {
				error = t('common.classNotFound');
				return;
			}
			console.log(classSnap.data());
			const enroled: string[] = classSnap.data()?.enroledStudents ?? [];

			const lecSnap = await getDocs(collection(db, 'classes', classId, 'lectures'));
			const sessionByLecture: Record<string, MeetResult> = {};
			const loadedLecs = lecSnap.docs
				.map((d) => {
					const sdata = d.data()?.sessionData as MeetResult | undefined;
					if (sdata) sessionByLecture[d.id] = sdata;
					return {
						id: d.id,
						title: d.data()?.title ?? t('common.untitledLecture'),
						startTime: d.data()?.startTime?.toDate?.() ?? new Date(),
						endTime: d.data()?.endTime?.toDate?.() ?? new Date(),
						materials: (d.data()?.materials ?? []) as Lecture['materials'],
					};
				})
				.filter((l) => l.materials.some((m) => m.type === 'meet')) as Lecture[];
			sessionDataByLecture = sessionByLecture;
			lectures = loadedLecs;
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
			error = t('common.somethingWentWrong');
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

	function toggleExpandLecture(id: string) {
		const next = new Set(expandedLectures);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expandedLectures = next;
	}

	function exportCsv() {
		const fmt = (d?: Date | null) => (d ? moment(d).format('YYYY-MM-DD HH:mm:ss') : '');
		const fmtMeet = (lecId: string, email: string) => {
			const part = participantFor(lecId, email);
			if (part?.joinTime) return moment(part.joinTime).format('YYYY-MM-DD HH:mm:ss');
			if (part) return t('dashboard.attended');
			if (hasSessionRecord(lecId)) return t('dashboard.absent');
			return '';
		};
		const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
		const header = [
			t('export.studentId'),
			t('export.fullName'),
			t('export.email'),
			t('export.checkedIn'),
			t('export.completed'),
			t('export.meeting'),
			t('export.totalLectures'),
			...lectures.flatMap((l) => [
				t('export.checkInFor', { title: l.title }),
				t('export.completedFor', { title: l.title }),
				t('export.meetingFor', { title: l.title }),
			]),
		];
		const lines = students.map((s) =>
			[
				s.ramaId,
				s.name,
				s.email,
				checkedInCount(s),
				completedCount(s),
				meetAttendedCount(s),
				lectures.length,
				...lectures.flatMap((l) => [
					fmt(s.lectures[l.id]?.checkedInAt),
					fmt(s.lectures[l.id]?.completedAt),
					fmtMeet(l.id, s.email),
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

<div class="mx-auto w-full max-w-6xl px-8 py-10">
	{#snippet checkInCell(time: Date | null)}
		<span class="font-medium {time ? 'text-emerald-600' : 'text-ink-300'}">
			{time ? fmtTime(time) : t('common.notCheckedIn')}
		</span>
	{/snippet}
	{#snippet completedCell(time: Date | null)}
		<span class="font-medium {time ? 'text-teal-600' : 'text-ink-300'}">
			{time ? fmtTime(time) : t('common.notCompleted')}
		</span>
	{/snippet}
	{#snippet meetCell(part: MeetParticipant | null, recorded: boolean)}
		<span
			class="font-medium {part
				? 'text-emerald-600'
				: recorded
					? 'text-red-600'
					: 'text-ink-300'}"
		>
			{#if part?.joinTime}
				{fmtDateTime(part.joinTime)}
			{:else if part}
				{t('dashboard.attended')}
			{:else if recorded}
				{t('dashboard.absent')}
			{:else}
				{t('classes.attendanceNotAvailable')}
			{/if}
		</span>
	{/snippet}
	<div class="flex items-center justify-between gap-3">
		<div>
			<h1 class="mt-1 flex items-center gap-2 text-[18px] font-semibold text-ink-900">
				<CalendarCheck class="h-4 w-4 text-emerald-500" />
				{t('dashboard.attendance')}
			</h1>
			<p class="mt-1 text-[13px] text-ink-500">
				{loading
					? t('common.loading')
					: `${tn(students.length, 'dashboard.studentsCount', 'dashboard.studentsCountPlural')} · ${tn(lectures.length, 'dashboard.lecturesCount', 'dashboard.lecturesCountPlural')}`}
			</p>
		</div>
		<button
			onclick={exportCsv}
			disabled={loading || students.length === 0}
			class="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-900/10 bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-700 shadow-soft transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<Download class="h-3.5 w-3.5" />
			{t('quiz.exportCsv')}
		</button>
	</div>

	{#if !loading && lectures.length > 0}
		<section class="mt-6">
			<div class="mb-2 flex items-baseline justify-between gap-2 px-1">
				<h2 class="text-[13px] font-semibold text-ink-900">
					{t('dashboard.groupedByLecture')}
				</h2>
				<span class="text-[12px] text-ink-400">({lectures.length})</span>
			</div>
			<div class="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft">
				<ul class="divide-y divide-ink-900/5">
					{#each lectures as lec (lec.id)}
						{@const loading = participantsLoading === lec.id}
						{@const err = participantsError[lec.id]}
						{@const session = sessionDataByLecture[lec.id]}
						{@const open = expandedLectures.has(lec.id)}
						<li class="px-5 py-3">
							<div class="flex items-center gap-3">
								<button
									type="button"
									onclick={() => toggleExpandLecture(lec.id)}
									class="flex min-w-0 flex-1 items-center gap-2 text-left"
								>
									{#if open}
										<ChevronDown class="h-4 w-4 shrink-0 text-ink-400" />
									{:else}
										<ChevronRight class="h-4 w-4 shrink-0 text-ink-400" />
									{/if}
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-1.5">
											<GoogleMeetIcon class="h-3.5 w-3.5 shrink-0" />
											<p
												class="truncate text-[13.5px] font-medium text-ink-900"
											>
												{lec.title || t('common.untitledLecture')}
											</p>
										</div>
										<p class="text-[12px] text-ink-400">
											{moment(lec.startTime).format('ddd, MMM D · hh:mm A')}
										</p>
										{#if session}
											<p>
												<span
													class="inline-flex shrink-0 items-center gap-1 rounded-full text-[11px] font-semibold text-emerald-600"
												>
													<CheckCircle2 class="h-3 w-3" />
													{t('dashboard.saved')}
												</span>
											</p>
										{/if}
									</div>
								</button>
								{#if session}
									<button
										type="button"
										onclick={() => openCachedParticipants(lec)}
										class="flex shrink-0 items-center gap-1.5 rounded-md bg-iris-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-iris-700 transition hover:bg-iris-500/15"
									>
										<Users class="h-3.5 w-3.5" />
										{t('dashboard.viewSession')}
									</button>
								{:else}
									<button
										type="button"
										onclick={() => checkParticipants(lec)}
										disabled={loading}
										class="flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
									>
										{#if loading}
											<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
											{t('common.loading')}
										{:else}
											<Users class="h-3.5 w-3.5" />
											{t('dashboard.checkParticipants')}
										{/if}
									</button>
								{/if}
							</div>

							{#if err}
								<p class="mt-2 text-[12px] text-red-500">{err}</p>
							{/if}

							{#if open}
								<div class="mt-3 overflow-x-auto border-t border-ink-900/5">
									<table class="w-full text-[12px]">
										<thead>
											<tr
												class="text-[11px] uppercase tracking-wide text-ink-400"
											>
												<th class="px-4 py-2 text-left font-semibold">
													{t('students.fullName')}
												</th>
												<th
													class="whitespace-nowrap px-2 py-2 text-right font-semibold"
												>
													<span
														class="inline-flex items-center justify-end gap-1"
													>
														<ClockCheck class="h-3.5 w-3.5" />
														{t('classes.checkIn')}
													</span>
												</th>
												<th
													class="whitespace-nowrap px-2 py-2 text-right font-semibold"
												>
													<span
														class="inline-flex items-center justify-end gap-1"
													>
														<ListChecks class="h-3.5 w-3.5" />
														{t('classes.completed')}
													</span>
												</th>
												<th
													class="whitespace-nowrap py-2 pl-2 pr-4 text-right font-semibold"
												>
													<span
														class="inline-flex items-center justify-end gap-1"
													>
														<GoogleMeetIcon class="h-3.5 w-3.5" />
														{t('materials.googleMeet')}
													</span>
												</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-ink-900/5">
											{#each students as student (student.id)}
												{@const act = student.lectures[lec.id]}
												{@const part = participantFor(
													lec.id,
													student.email,
												)}
												{@const recorded = hasSessionRecord(lec.id)}
												<tr>
													<td class="min-w-0 max-w-52 px-4 py-2.5">
														<p
															class="truncate text-[13px] font-medium text-ink-900"
														>
															{student.name}
														</p>
														<p
															class="truncate text-[12px] text-ink-500"
														>
															{student.email}
														</p>
													</td>
													<td
														class="whitespace-nowrap px-2 py-2.5 text-right"
													>
														{@render checkInCell(
															act?.checkedInAt ?? null,
														)}
													</td>
													<td
														class="whitespace-nowrap px-2 py-2.5 text-right"
													>
														{@render completedCell(
															act?.completedAt ?? null,
														)}
													</td>
													<td
														class="whitespace-nowrap py-2.5 pl-2 pr-4 text-right"
													>
														{@render meetCell(part, recorded)}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center gap-2 py-16">
			<div
				class="h-5 w-5 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
			></div>
			<span class="text-[13px] text-ink-500">{t('common.loading')}</span>
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
			<p class="mt-4 text-[15px] font-medium text-ink-900">{t('dashboard.noLecturesYet')}</p>
			<p class="mt-1 max-w-xs text-[13.5px] text-ink-500">
				{t('dashboard.addLectureHint')}
			</p>
		</div>
	{:else if students.length === 0}
		<div class="flex flex-col items-center justify-center px-8 py-16 text-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500"
			>
				<Users class="h-6 w-6" />
			</div>
			<p class="mt-4 text-[15px] font-medium text-ink-900">
				{t('students.noStudentsEnrolledYet')}
			</p>
			<p class="mt-1 max-w-xs text-[13.5px] text-ink-500">
				{t('students.importStudentsHint')}
			</p>
		</div>
	{:else}
		<section class="mt-6">
			<div class="mb-2 flex items-baseline justify-between gap-2 px-1">
				<h2 class="text-[13px] font-semibold text-ink-900">
					{t('dashboard.groupedByStudent')}
				</h2>
				<span class="text-[12px] text-ink-400">({students.length})</span>
			</div>
			<div class="space-y-2">
				{#each students as student (student.id)}
					{@const ci = checkedInCount(student)}
					{@const co = completedCount(student)}
					{@const mt = meetAttendedCount(student)}
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
									<span
										class="ml-2 font-mono text-[12px] font-normal text-ink-400"
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
								<span
									class="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11.5px] font-semibold text-sky-700"
								>
									<GoogleMeetIcon class="h-3.5 w-3.5" />
									{mt}/{lectures.length}
								</span>
							</div>
						</button>

						{#if expanded.has(student.id)}
							<div class="border-t border-ink-900/5">
								{#if lectures.length === 0}
									<p class="px-4 py-3 text-[12.5px] text-ink-400">
										No lectures yet.
									</p>
								{:else}
									<div class="overflow-x-auto">
										<table class="w-full text-[12px]">
											<thead>
												<tr
													class="text-[11px] uppercase tracking-wide text-ink-400"
												>
													<th class="px-4 py-2 text-left font-semibold">
														{t('dashboard.lecture')}
													</th>
													<th
														class="whitespace-nowrap px-2 py-2 text-right font-semibold"
													>
														<span
															class="inline-flex items-center justify-end gap-1"
														>
															<ClockCheck class="h-3.5 w-3.5" />
															{t('classes.checkIn')}
														</span>
													</th>
													<th
														class="whitespace-nowrap px-2 py-2 text-right font-semibold"
													>
														<span
															class="inline-flex items-center justify-end gap-1"
														>
															<ListChecks class="h-3.5 w-3.5" />
															{t('classes.completed')}
														</span>
													</th>
													<th
														class="whitespace-nowrap py-2 pl-2 pr-4 text-right font-semibold"
													>
														<span
															class="inline-flex items-center justify-end gap-1"
														>
															<GoogleMeetIcon class="h-3.5 w-3.5" />
															{t('materials.googleMeet')}
														</span>
													</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-ink-900/5">
												{#each lectures as lec (lec.id)}
													{@const act = student.lectures[lec.id]}
													{@const part = participantFor(
														lec.id,
														student.email,
													)}
													{@const recorded = hasSessionRecord(lec.id)}
													<tr>
														<td class="min-w-0 px-4 py-2.5">
															<div class="flex items-center gap-1.5">
																<GoogleMeetIcon
																	class="h-3.5 w-3.5 shrink-0"
																/>
																<p
																	class="truncate text-[13px] font-medium text-ink-900"
																>
																	{lec.title ||
																		t('common.untitledLecture')}
																</p>
															</div>
															<p
																class="whitespace-nowrap text-[12px] text-ink-400"
															>
																{moment(lec.startTime).format(
																	'ddd, MMM D · hh:mm A',
																)}
															</p>
														</td>
														<td
															class="whitespace-nowrap px-2 py-2.5 text-right"
														>
															{@render checkInCell(
																act?.checkedInAt ?? null,
															)}
														</td>
														<td
															class="whitespace-nowrap px-2 py-2.5 text-right"
														>
															{@render completedCell(
																act?.completedAt ?? null,
															)}
														</td>
														<td
															class="whitespace-nowrap py-2.5 pl-2 pr-4 text-right"
														>
															{@render meetCell(part, recorded)}
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<Modal
		open={viewingParticipants != null}
		title={t('dashboard.participantsTitle')}
		class="max-w-4xl"
		onclose={() => (viewingParticipants = null)}
	>
		{@const view = viewingParticipants!}
		{#if !view.result.conferenceRecord}
			<p class="py-6 text-center text-[13px] text-ink-400">
				{t('dashboard.noConferenceYet')}
			</p>
		{:else if rosterRows.length === 0}
			<p class="py-6 text-center text-[13px] text-ink-400">
				{t('students.noStudentsEnrolledYet')}
			</p>
		{:else}
			<div class="max-h-[60vh] overflow-auto">
				<table class="w-full text-[12.5px]">
					<thead class="sticky top-0 bg-white shadow-[0_1px_0_0_var(--color-ink-900)]/5">
						<tr class="text-left text-[11px] uppercase tracking-wide text-ink-400">
							<th class="whitespace-nowrap px-3 py-2 font-semibold">
								{t('students.fullName')}
							</th>
							<th class="whitespace-nowrap px-2 py-2 font-semibold">
								{t('export.status')}
							</th>
							<th class="whitespace-nowrap px-2 py-2 font-semibold">
								{t('dashboard.displayName')}
							</th>
							<th class="whitespace-nowrap px-2 py-2 text-right font-semibold">
								{t('dashboard.joinTime')}
							</th>
							<th class="whitespace-nowrap px-2 py-2 text-right font-semibold">
								{t('dashboard.leaveTime')}
							</th>
							<th class="whitespace-nowrap py-2 pl-2 pr-3 text-right font-semibold">
								{t('dashboard.sessionTime')}
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-ink-900/5">
						{#each rosterRows as row (row.student.id)}
							<tr>
								<td class="min-w-0 max-w-52 px-3 py-2.5">
									<p class="truncate text-[13px] font-medium text-ink-900">
										{row.student.name}
									</p>
									<p class="truncate text-[12px] text-ink-500">
										{row.student.email}
									</p>
								</td>
								<td class="whitespace-nowrap px-2 py-2.5">
									{#if row.participant}
										<span
											class="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
										>
											{t('dashboard.attended')}
										</span>
									{:else}
										<span
											class="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600"
										>
											{t('dashboard.absent')}
										</span>
									{/if}
								</td>
								<td class="max-w-40 truncate px-2 py-2.5 font-medium text-ink-700">
									{row.participant?.displayName || '—'}
								</td>
								<td
									class="whitespace-nowrap px-2 py-2.5 text-right font-medium text-ink-700"
								>
									{row.participant ? fmtDateTime(row.participant.joinTime) : '—'}
								</td>
								<td
									class="whitespace-nowrap px-2 py-2.5 text-right font-medium text-ink-700"
								>
									{row.participant ? fmtDateTime(row.participant.leaveTime) : '—'}
								</td>
								<td
									class="whitespace-nowrap py-2.5 pl-2 pr-3 text-right font-medium text-ink-700"
								>
									{row.participant
										? fmtDuration(row.participant.sessionTimeSec)
										: '—'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		{#snippet footer()}
			{#if refreshError}
				<p class="mr-auto text-[12px] text-red-600">{refreshError}</p>
			{/if}
			<button
				type="button"
				onclick={refreshParticipants}
				disabled={refreshing}
				class="inline-flex items-center gap-1.5 rounded-md border border-ink-900/15 bg-white px-3.5 py-2 text-xs font-medium text-ink-700 transition hover:bg-ink-900/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if refreshing}
					<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
					{t('common.loading')}
				{:else}
					<RefreshCw class="h-3.5 w-3.5" />
					{t('dashboard.refresh')}
				{/if}
			</button>
		{/snippet}
	</Modal>
</div>
