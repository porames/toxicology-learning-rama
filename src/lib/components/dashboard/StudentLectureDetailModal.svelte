<script lang="ts">
	import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { Modal } from '$lib/components/ui';
	import GoogleMeetIcon from '$lib/components/GoogleMeetIcon.svelte';
	import { ClockCheck, ListChecks, FileQuestion, Video, LoaderCircle } from '@lucide/svelte';
	import type { Lecture } from '$lib/dashboard/types';
	import { t } from '$lib/i18n';
	import moment from 'moment';

	const WATCH_THRESHOLD = 0.8;

	export interface DetailStudent {
		id: string;
		name: string;
		email: string;
		authId: string;
	}

	export interface DetailParticipant {
		displayName: string | null;
		joinTime: string | null;
		leaveTime: string | null;
		sessionTimeSec: number | null;
	}

	interface QuizStatus {
		title: string;
		passed: boolean;
		attempted: boolean;
		score: number | null;
		totalPoints: number | null;
		completedAt: Date | null;
	}

	interface VideoStatus {
		title: string;
		pct: number;
		done: boolean;
	}

	interface MeetSession {
		displayName: string;
		joinTime: Date | null;
		leaveTime: Date | null;
		durationSec: number | null;
	}

	interface DetailData {
		checkedInAt: Date | null;
		completedAt: Date | null;
		quizzes: QuizStatus[];
		videos: VideoStatus[];
		meetSession: MeetSession | null;
	}

	let {
		student,
		lecture,
		participant,
		sessionRecorded,
		onclose,
	}: {
		student: DetailStudent;
		lecture: Lecture;
		participant: DetailParticipant | null;
		sessionRecorded: boolean;
		onclose: () => void;
	} = $props();

	let loading = $state(true);
	let error = $state(false);
	let detail = $state<DetailData | null>(null);

	const toDate = (v: unknown): Date | null =>
		v != null && typeof (v as { toDate?: unknown }).toDate === 'function'
			? (v as { toDate: () => Date }).toDate()
			: ((v as Date | null) ?? null);

	const hasMeet = $derived(lecture.materials.some((m) => m.type === 'meet'));
	const hasRequirements = $derived(
		(detail?.quizzes.length ?? 0) > 0 || (detail?.videos.length ?? 0) > 0 || hasMeet,
	);

	// Prefer the session record; fall back to the student's own meetSession.
	const meetSource = $derived.by(() => {
		if (participant) return participant;
		const ms = detail?.meetSession;
		if (!ms) return null;
		return {
			displayName: ms.displayName,
			joinTime: ms.joinTime?.toISOString() ?? null,
			leaveTime: ms.leaveTime?.toISOString() ?? null,
			sessionTimeSec: ms.durationSec,
		};
	});

	function fmtDT(d: Date | null): string {
		return d ? moment(d).format('ddd, MMM D · HH:mm') : '—';
	}

	function fmtDuration(sec: number | null): string {
		if (sec == null || sec <= 0) return '—';
		return moment.duration(sec, 'seconds').humanize();
	}

	async function load() {
		loading = true;
		error = false;
		try {
			const snap = await getDoc(doc(db, 'users', student.id, 'activities', lecture.id));
			const data = snap.exists() ? snap.data() : {};
			const storedVideos = (data.videos ?? []) as { id: string; maxPosition: number }[];
			const maxById = new Map<string, number>();
			for (const v of storedVideos) {
				if (v?.id != null)
					maxById.set(v.id, Math.max(maxById.get(v.id) ?? 0, v.maxPosition ?? 0));
			}
			const ms = data.meetSession;

			const requiredQuizzes = lecture.materials.filter(
				(m) => m.type === 'quiz' && m.requiredPostTest && m.value,
			);
			const quizzes: QuizStatus[] = await Promise.all(
				requiredQuizzes.map(async (m) => {
					const base = {
						title: m.title || t('materials.quiz'),
						passed: false,
						attempted: false,
						score: null as number | null,
						totalPoints: null as number | null,
						completedAt: null as Date | null,
					};
					if (!student.authId) return base;
					const qSnap = await getDocs(
						query(
							collection(db, 'quizAttempts'),
							where('authId', '==', student.authId),
							where('quizId', '==', m.value),
							where('lectureId', '==', lecture.id),
						),
					);
					if (qSnap.empty) return base;
					const attempts = qSnap.docs.map((d) => d.data());
					const byTime = (a: { completedAt?: unknown }, b: { completedAt?: unknown }) =>
						(toDate(a.completedAt)?.getTime() ?? 0) -
						(toDate(b.completedAt)?.getTime() ?? 0);
					const firstPassed = attempts.filter((a) => a.passed).sort(byTime)[0];
					const chosen = firstPassed ?? attempts.sort((a, b) => byTime(b, a))[0];
					return {
						...base,
						passed: !!firstPassed,
						attempted: true,
						score: (chosen.score as number | undefined) ?? null,
						totalPoints: (chosen.totalPoints as number | undefined) ?? null,
						completedAt: toDate(chosen.completedAt),
					};
				}),
			);

			detail = {
				checkedInAt: toDate(data.checkedInAt),
				completedAt: toDate(data.completedAt),
				quizzes,
				videos: lecture.materials
					.filter((m) => m.type === 'video' && m.value)
					.map((m) => {
						const pct = Math.round((maxById.get(m.value) ?? 0) * 100);
						return {
							title: m.title || t('materials.video'),
							pct,
							done: (maxById.get(m.value) ?? 0) > WATCH_THRESHOLD,
						};
					}),
				meetSession: ms
					? {
							displayName: ms.displayName ?? '',
							joinTime: toDate(ms.joinTime),
							leaveTime: toDate(ms.leaveTime),
							durationSec: (ms.durationSec as number | undefined) ?? null,
						}
					: null,
			};
		} catch (err) {
			console.error(err);
			error = true;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void student.id;
		void lecture.id;
		void load();
	});
</script>

<Modal open={true} title={student.name} class="max-w-lg" {onclose}>
	<p class="-mt-1 mb-3 truncate text-[12.5px] text-ink-500">
		{lecture.title} · {moment(lecture.startTime).format('ddd, MMM D · HH:mm')}
	</p>

	{#if loading}
		<div class="flex items-center justify-center gap-2 py-10">
			<LoaderCircle class="h-5 w-5 animate-spin text-iris-500" />
			<span class="text-[13px] text-ink-500">{t('common.loading')}</span>
		</div>
	{:else if error || !detail}
		<p class="py-6 text-center text-[13px] text-red-600">
			{t('common.somethingWentWrong')}
		</p>
	{:else}
		<dl class="divide-y divide-ink-900/5 rounded-xl border border-ink-900/10 text-[12.5px]">
			<div class="flex items-center justify-between gap-2 px-3 py-2">
				<dt class="flex items-center gap-1.5 text-ink-500">
					<ClockCheck class="h-3.5 w-3.5" />
					{t('classes.checkIn')}
				</dt>
				<dd
					class="font-medium {detail.checkedInAt
						? 'text-emerald-600'
						: 'text-ink-900/40'}"
				>
					{detail.checkedInAt
						? moment(detail.checkedInAt).format('MMM D · HH:mm')
						: t('common.notCheckedIn')}
				</dd>
			</div>
			<div class="flex items-center justify-between gap-2 px-3 py-2">
				<dt class="flex items-center gap-1.5 text-ink-500">
					<ListChecks class="h-3.5 w-3.5" />
					{t('classes.completed')}
				</dt>
				<dd class="font-medium {detail.completedAt ? 'text-teal-600' : 'text-ink-900/40'}">
					{detail.completedAt
						? moment(detail.completedAt).format('MMM D · HH:mm')
						: t('common.notCompleted')}
				</dd>
			</div>
		</dl>

		{#if hasRequirements}
			<p class="mb-1 mt-4 text-[12px] font-semibold text-ink-900">
				{t('classes.completionRequirements')}
			</p>
			<dl class="divide-y divide-ink-900/5 rounded-xl border border-ink-900/10 text-[12.5px]">
				{#each detail.quizzes as q}
					<div class="flex items-center justify-between gap-2 px-3 py-2">
						<dt class="flex min-w-0 items-center gap-1.5 text-ink-500">
							<FileQuestion class="h-3.5 w-3.5 shrink-0" />
							<span class="truncate">{q.title}</span>
						</dt>
						<dd class="shrink-0 text-right font-medium">
							{#if !q.attempted}
								<span class="text-ink-900/40">{t('dashboard.notAttempted')}</span>
							{:else}
								<span class={q.passed ? 'text-emerald-600' : 'text-red-600'}>
									{t(q.passed ? 'common.passed' : 'common.failed')}
								</span>
								<span class="ml-1.5 font-normal text-ink-500">
									{q.score ?? '—'}/{q.totalPoints ?? '—'}
									{q.completedAt
										? `· ${moment(q.completedAt).format('MMM D · HH:mm')}`
										: ''}
								</span>
							{/if}
						</dd>
					</div>
				{/each}
				{#each detail.videos as v}
					<div class="flex items-center justify-between gap-2 px-3 py-2">
						<dt class="flex min-w-0 items-center gap-1.5 text-ink-500">
							<Video class="h-3.5 w-3.5 shrink-0" />
							<span class="truncate">{v.title}</span>
						</dt>
						<dd
							class="shrink-0 font-medium {v.done
								? 'text-emerald-600'
								: 'text-ink-900/40'}"
						>
							{v.pct}%{#if !v.done}
								· {t('classes.watchRequired')}{/if}
						</dd>
					</div>
				{/each}
				{#if hasMeet}
					<div class="px-3 py-2">
						<div class="flex items-center justify-between gap-2">
							<dt class="flex min-w-0 items-center gap-1.5 text-ink-500">
								<GoogleMeetIcon class="h-3.5 w-3.5 shrink-0" />
								<span class="truncate">{t('classes.attendedMeeting')}</span>
							</dt>
							<dd
								class="shrink-0 font-medium {participant
									? 'text-emerald-600'
									: sessionRecorded
										? 'text-red-600'
										: 'text-ink-900/40'}"
							>
								{#if participant}
									{t('dashboard.attended')}
								{:else if sessionRecorded}
									{t('dashboard.absent')}
								{:else}
									{t('classes.attendanceNotAvailable')}
								{/if}
							</dd>
						</div>
						{#if meetSource}
							<div class="mt-1 space-y-0.5 pl-5 text-[12px] text-ink-500">
								<p>
									{t('dashboard.joinTime')}: {meetSource.joinTime
										? moment(meetSource.joinTime).format('MMM D · HH:mm')
										: '—'}
								</p>
								<p>
									{t('dashboard.leaveTime')}: {meetSource.leaveTime
										? moment(meetSource.leaveTime).format('MMM D · HH:mm')
										: '—'}
								</p>
								<p>
									{t('dashboard.sessionTime')}: {fmtDuration(
										meetSource.sessionTimeSec,
									)}
								</p>
							</div>
						{/if}
					</div>
				{/if}
			</dl>
		{:else}
			<p
				class="mt-4 rounded-xl bg-ink-900/[0.03] px-3 py-3 text-center text-[12.5px] text-ink-500"
			>
				{t('dashboard.noRequirements')}
			</p>
		{/if}
	{/if}
</Modal>
