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
	let participantTimesOpen = $state<Set<string>>(new Set());
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

	function toggleParticipantTimes(id: string) {
		const next = new Set(participantTimesOpen);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		participantTimesOpen = next;
	}

	function exportCsv() {
		const fmt = (d?: Date | null) => (d ? moment(d).format('YYYY-MM-DD HH:mm:ss') : '');
		const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
		const header = [
			t('export.studentId'),
			t('export.fullName'),
			t('export.email'),
			t('export.checkedIn'),
			t('export.completed'),
			t('export.totalLectures'),
			...lectures.flatMap((l) => [
				t('export.checkInFor', { title: l.title }),
				t('export.completedFor', { title: l.title }),
			]),
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
			<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">
				{t('dashboard.attendance')}
			</p>
			<h1 class="mt-1 flex items-center gap-2 text-[18px] font-semibold text-ink-900">
				<CalendarCheck class="h-4 w-4 text-emerald-500" />
				{t('students.enrolledStudents')}
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
		<div class="mt-6 overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft">
			<div class="flex items-center gap-2 border-b border-ink-900/8 px-5 py-3">
				<GoogleMeetIcon class="h-4 w-4" />
				<h2 class="text-sm font-semibold text-ink-900">{t('materials.googleMeet')}</h2>
				<span class="ml-auto text-[12px] text-ink-400">({lectures.length})</span>
			</div>
			<ul class="divide-y divide-ink-900/5">
				{#each lectures as lec (lec.id)}
					{@const loading = participantsLoading === lec.id}
					{@const err = participantsError[lec.id]}
					{@const session = sessionDataByLecture[lec.id]}
					<li class="px-5 py-3">
						<div class="flex items-center gap-3">
							<div class="min-w-0 flex-1">
								<p class="truncate text-[13.5px] font-medium text-ink-900">
									{lec.title || t('common.untitledLecture')}
								</p>
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
					</li>
				{/each}
			</ul>
		</div>
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
													{lec.title || t('common.untitledLecture')}
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
														: t('common.notCheckedIn')}
												</span>
												<span
													class="inline-flex items-center gap-1 font-medium {act?.completedAt
														? 'text-teal-600'
														: 'text-ink-300'}"
												>
													<ListChecks class="h-3.5 w-3.5" />
													{act?.completedAt
														? fmtTime(act.completedAt)
														: t('common.notCompleted')}
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

	<Modal
		open={viewingParticipants != null}
		title={t('dashboard.participantsTitle')}
		class="max-w-3xl"
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
			<ul class="max-h-[60vh] space-y-2 overflow-y-auto">
				{#each rosterRows as row (row.student.id)}
					<li class="rounded-lg border border-ink-900/10 bg-ink-900/[0.02] px-3.5 py-3">
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate text-[13.5px] font-medium text-ink-900">
									{row.student.name}
								</p>
								<p class="truncate text-[12px] text-ink-500">
									{row.student.email}
								</p>
							</div>
							{#if row.participant}
								<span
									class="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
								>
									{t('dashboard.attended')}
								</span>
							{:else}
								<span
									class="inline-flex shrink-0 items-center rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600"
								>
									{t('dashboard.absent')}
								</span>
							{/if}
						</div>
						{#if row.participant}
							<button
								type="button"
								onclick={() => toggleParticipantTimes(row.student.id)}
								class="mt-2 flex w-full items-center gap-1.5 border-t border-ink-900/5 pt-2 text-[12px] font-medium text-ink-500 transition hover:text-ink-700"
							>
								{#if participantTimesOpen.has(row.student.id)}
									<ChevronDown class="h-3.5 w-3.5 shrink-0" />
								{:else}
									<ChevronRight class="h-3.5 w-3.5 shrink-0" />
								{/if}
								{t('dashboard.sessionDetails')}
							</button>
							{#if participantTimesOpen.has(row.student.id)}
								<div class="mt-2.5 grid grid-cols-2 gap-2 text-[12px]">
									<div class="col-span-2">
										<p class="text-ink-400">{t('dashboard.displayName')}</p>
										<p class="mt-0.5 font-medium text-ink-700">
											{row.participant.displayName || '—'}
										</p>
									</div>
									<div>
										<p class="text-ink-400">{t('dashboard.joinTime')}</p>
										<p class="mt-0.5 font-medium text-ink-700">
											{fmtDateTime(row.participant.joinTime)}
										</p>
									</div>
									<div>
										<p class="text-ink-400">{t('dashboard.leaveTime')}</p>
										<p class="mt-0.5 font-medium text-ink-700">
											{fmtDateTime(row.participant.leaveTime)}
										</p>
									</div>
									<div class="col-span-2">
										<p class="text-ink-400">{t('dashboard.sessionTime')}</p>
										<p class="mt-0.5 font-medium text-ink-700">
											{fmtDuration(row.participant.sessionTimeSec)}
										</p>
									</div>
								</div>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
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
