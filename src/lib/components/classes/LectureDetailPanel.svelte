<script lang="ts">
	import {
		ChevronLeft,
		ChevronRight,
		LoaderCircle,
		ClockCheck,
		ListChecks,
		FileQuestion,
		Video,
	} from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import moment from 'moment';
	import formatTimeRange from '$lib/formatTimeRange';
	import { MATERIAL_COLOR } from '$lib/dashboard/icons';
	import GoogleMeetIcon from '$lib/components/GoogleMeetIcon.svelte';
	import type { Lecture, ClassItem, MeetParticipantInfo } from '$lib/dashboard/types';
	import MaterialRenderer from '$lib/components/materials/MaterialRenderer.svelte';
	import QuizResultModal from './QuizResultModal.svelte';
	import QuizTaker from '$lib/components/quiz/QuizTaker.svelte';
	import { t } from '$lib/i18n';

	interface QuizAttempt {
		passed: boolean;
		completedAt: Date | null;
	}

	interface QuizResult {
		id: string;
		score: number;
		totalPoints: number;
		passed: boolean;
		pct: number;
	}

	interface Props {
		selectedLecture: Lecture | undefined;
		displayQuiz: string | null;
		currentClass?: ClassItem;
		completedIds: Set<string>;
		checkedInTime: Date | undefined;
		completedTime: Date | undefined;
		completingLec: boolean;
		allRequiredPassed: boolean;
		materialsLoading: boolean;
		materialsError: string | null;
		videoUrls: Record<string, string>;
		quizAttempts: Record<string, QuizAttempt>;
		quizResult: QuizResult | null;
		meetSession?: {
			displayName: string;
			joinTime: Date | null;
			leaveTime: Date | null;
			durationSec: number | null;
		} | null;
		meetParticipant?: MeetParticipantInfo | null;
		onVideoPositionChange?: (videoId: string, fraction: number) => void;
		videoStartPositions?: Record<string, number>;
		onBack: () => void;
		onBackFromQuiz: () => void;
		onStartQuiz: (quizId: string) => void;
		onComplete: () => void;
		onQuizComplete: (result: QuizResult) => void;
		onCloseQuizResult: () => void;
		onViewAttempts: () => void;
	}

	let {
		selectedLecture,
		displayQuiz,
		currentClass,
		completedIds,
		checkedInTime,
		completedTime,
		completingLec,
		allRequiredPassed,
		materialsLoading,
		materialsError,
		videoUrls,
		quizAttempts,
		quizResult,
		onBack,
		onBackFromQuiz,
		onStartQuiz,
		onComplete,
		onQuizComplete,
		onCloseQuizResult,
		onViewAttempts,
		meetSession = null,
		meetParticipant = null,
		onVideoPositionChange,
		videoStartPositions,
	}: Props = $props();

	const hasMeetLecture = $derived(
		(selectedLecture?.materials ?? []).some((m) => m.type === 'meet' && m.value),
	);
	const sessionRecorded = $derived(selectedLecture?.sessionData?.conferenceRecord != null);
	const COMPLETION_WATCH_THRESHOLD = 0.8;
	const postTestReqs = $derived(
		(selectedLecture?.materials ?? [])
			.filter((m) => m.type === 'quiz' && m.requiredPostTest)
			.map((m) => ({
				id: m.id,
				title: m.title || t('materials.quiz'),
				quizId: m.value,
				passed: !!quizAttempts[m.value]?.passed,
				attempted: quizAttempts[m.value] != null,
			})),
	);
	const videoReqs = $derived(
		(selectedLecture?.materials ?? [])
			.filter((m) => m.type === 'video' && m.value)
			.map((m) => {
				const fraction = videoStartPositions?.[m.value] ?? 0;
				return {
					id: m.id,
					title: m.title || t('materials.video'),
					pct: Math.round(fraction * 100),
					done: fraction > COMPLETION_WATCH_THRESHOLD,
				};
			}),
	);
	const allVideosWatched = $derived(videoReqs.every((v) => v.done));
	const meetAttended = $derived(!hasMeetLecture || meetParticipant != null);
	const canComplete = $derived(allRequiredPassed && allVideosWatched && meetAttended);
	const showRequirements = $derived(
		postTestReqs.length > 0 || videoReqs.length > 0 || hasMeetLecture,
	);
	const isCompletedLate = $derived(
		completedTime != null &&
			selectedLecture != null &&
			completedTime.getTime() > new Date(selectedLecture.endTime).getTime(),
	);

	function fmtDateTime(d: Date | null): string {
		if (!d) return '—';
		return moment(d).format('ddd, MMM D · HH:mm');
	}

	function fmtDuration(sec: number | null): string {
		if (sec == null || sec <= 0) return '—';
		return moment.duration(sec, 'seconds').humanize();
	}
</script>

<div
	class={`flex-1 min-w-0 overflow-y-auto px-6 py-5 ${selectedLecture || displayQuiz ? 'block' : 'hidden md:block'}`}
>
	{#if displayQuiz}
		<div>
			<button
				onclick={onBackFromQuiz}
				class="mb-4 flex items-center gap-1.5 text-[13.5px] font-medium text-ink-500 hover:text-ink-900 transition"
			>
				<ChevronLeft size={16} />
				{t('classes.backToMaterials')}
			</button>
			<QuizTaker
				quizId={displayQuiz}
				lectureId={selectedLecture?.id}
				oncomplete={onQuizComplete}
			/>
		</div>
	{:else if quizResult}
		<QuizResultModal {quizResult} onClose={onCloseQuizResult} {onViewAttempts} />
	{:else if !selectedLecture}
		<div class="flex h-full flex-col items-center justify-center gap-2 text-center">
			<p class="text-sm font-medium text-ink-900">{t('classes.selectLecture')}</p>
			<p class="max-w-xs text-sm text-ink-900/50">
				{t('classes.pickLecture')}
			</p>
		</div>
	{:else}
		<div>
			<h2 class="text-base font-semibold text-ink-900">{selectedLecture.title}</h2>
			<p class="mt-0.5 text-xs text-ink-900/50">
				{moment(selectedLecture.startTime).format('Do MMM')} · {formatTimeRange(
					selectedLecture.startTime,
					selectedLecture.endTime,
				)}
			</p>
			<div class="mt-3 rounded-xl border border-ink-900/10 bg-white px-3 py-1 shadow-soft">
				<dl class="divide-y divide-ink-900/5 text-[12.5px]">
					<div class="flex items-center justify-between gap-2 py-1.5">
						<dt class="flex items-center gap-1.5 text-ink-500">
							<ClockCheck size={13} />
							{t('classes.checkedIn')}
						</dt>
						<dd
							class={`font-medium ${checkedInTime ? 'text-emerald-600' : 'text-ink-900/40'}`}
						>
							{checkedInTime
								? moment(checkedInTime).format('MMM D · HH:mm')
								: t('classes.hasntCheckedIn')}
						</dd>
					</div>
					<div class="flex items-center justify-between gap-2 py-1.5">
						<dt class="flex items-center gap-1.5 text-ink-500">
							<ListChecks size={13} />
							{t('classes.completed')}
						</dt>
						<dd
							class={`font-medium ${completedIds.has(selectedLecture.id) ? 'text-emerald-600' : 'text-ink-900/40'}`}
						>
							{#if completedTime}
								{moment(completedTime).format('MMM D · HH:mm')}
								{#if isCompletedLate}
									<span
										class="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700"
									>
										{t('classes.late')}
									</span>
								{/if}
							{:else if completedIds.has(selectedLecture.id)}
								{t('classes.completed')}
							{:else}
								{t('classes.hasntCompleted')}
							{/if}
						</dd>
					</div>
					{#if hasMeetLecture}
						<div class="flex items-center justify-between gap-2 py-1.5">
							<dt class="flex items-center gap-1.5 text-ink-500">
								<GoogleMeetIcon class="h-3.5 w-3.5 shrink-0" />
								{t('classes.attendedMeeting')}
							</dt>
							<dd
								class={`font-medium ${meetParticipant ? 'text-emerald-600' : sessionRecorded ? 'text-red-600' : 'text-ink-900/40'}`}
							>
								{#if meetParticipant?.joinTime}
									{t('dashboard.attended')} · {moment(
										meetParticipant.joinTime,
									).format('MMM D · HH:mm')}
								{:else if meetParticipant}
									{t('dashboard.attended')}
								{:else if sessionRecorded}
									{t('dashboard.absent')}
								{:else}
									{t('classes.attendanceNotAvailable')}
								{/if}
							</dd>
						</div>
					{/if}
				</dl>
			</div>

			<div class="mt-4">
				{#if materialsLoading}
					<div class="space-y-2">
						{#each Array(3) as _}
							<div class="h-10 w-full animate-pulse rounded-md bg-ink-900/5"></div>
						{/each}
					</div>
				{:else if materialsError}
					<p class="text-xs text-red-600">{materialsError}</p>
				{:else if selectedLecture.materials.length === 0}
					<p class="text-xs text-ink-900/40">
						{t('classes.noMaterialsForLecture')}
					</p>
				{:else}
					<ul class="space-y-1.5">
						{#each selectedLecture.materials as mat (mat.id)}
							{@const color = MATERIAL_COLOR[mat.type]}
							<li>
								<MaterialRenderer
									material={mat}
									{color}
									{videoUrls}
									onStartQuiz={(quizId) => onStartQuiz(quizId)}
									{quizAttempts}
									{onVideoPositionChange}
									{videoStartPositions}
								/>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			{#if meetSession}
				<div class="mt-4 rounded-xl border border-ink-900/10 bg-white p-3 shadow-soft">
					<div class="flex items-center gap-2">
						<GoogleMeetIcon class="h-4 w-4 shrink-0" />
						<p class="text-[13px] font-semibold text-ink-900">
							{t('classes.meetingAttendance')}
						</p>
					</div>
					<dl class="mt-2 space-y-1 text-[12.5px]">
						<div class="flex items-center justify-between gap-2">
							<dt class="text-ink-500">{t('classes.sessionName')}</dt>
							<dd class="truncate font-medium text-ink-900">
								{meetSession.displayName || '—'}
							</dd>
						</div>
						<div class="flex items-center justify-between gap-2">
							<dt class="text-ink-500">{t('classes.sessionJoined')}</dt>
							<dd class="font-medium text-ink-900">
								{fmtDateTime(meetSession.joinTime)}
							</dd>
						</div>
						<div class="flex items-center justify-between gap-2">
							<dt class="text-ink-500">{t('classes.sessionLeft')}</dt>
							<dd class="font-medium text-ink-900">
								{fmtDateTime(meetSession.leaveTime)}
							</dd>
						</div>
						<div class="flex items-center justify-between gap-2">
							<dt class="text-ink-500">{t('classes.sessionDuration')}</dt>
							<dd class="font-medium text-ink-900">
								{fmtDuration(meetSession.durationSec)}
							</dd>
						</div>
					</dl>
				</div>
			{/if}
		</div>
	{/if}

	{#if !displayQuiz}
		<div class="mt-4 rounded-xl border border-ink-900/10 bg-white px-3 py-1 shadow-soft">
			{#if showRequirements}
				<p class="py-1.5 text-[12px] font-semibold text-ink-900">
					{t('classes.completionRequirements')}
				</p>
				<dl class="divide-y divide-ink-900/5 text-[12.5px]">
					{#each postTestReqs as req (req.id)}
						{#if req.passed}
							<div class="flex items-center justify-between gap-2 py-1.5">
								<dt class="flex min-w-0 items-center gap-1.5 text-ink-500">
									<FileQuestion size={13} class="shrink-0" />
									<span class="truncate">{req.title}</span>
								</dt>
								<dd class="shrink-0 font-medium text-emerald-600">
									{t('common.passed')}
								</dd>
							</div>
						{:else}
							<button
								type="button"
								onclick={() => onStartQuiz(req.quizId)}
								class="flex w-full items-center justify-between gap-2 py-1.5 text-left transition hover:bg-ink-900/[0.02]"
							>
								<span class="flex min-w-0 items-center gap-1.5 text-ink-500">
									<FileQuestion size={13} class="shrink-0" />
									<span class="truncate">{req.title}</span>
								</span>
								{#if req.attempted}
									<span class="shrink-0 font-medium text-red-600">
										{t('common.failed')}
									</span>
								{:else}
									<span class="shrink-0 font-medium text-ink-900/40">
										{t('dashboard.notAttempted')}
									</span>
								{/if}
							</button>
						{/if}
					{/each}
					{#each videoReqs as req (req.id)}
						<div class="flex items-center justify-between gap-2 py-1.5">
							<dt class="flex min-w-0 items-center gap-1.5 text-ink-500">
								<Video size={13} class="shrink-0" />
								<span class="truncate">{req.title}</span>
							</dt>
							<dd
								class={`shrink-0 font-medium ${req.done ? 'text-emerald-600' : 'text-ink-900/40'}`}
							>
								{req.pct}%{#if !req.done}
									· {t('classes.watchRequired')}{/if}
							</dd>
						</div>
					{/each}
					{#if hasMeetLecture}
						<div class="flex items-center justify-between gap-2 py-1.5">
							<dt class="flex min-w-0 items-center gap-1.5 text-ink-500">
								<GoogleMeetIcon class="h-3.5 w-3.5 shrink-0" />
								<span class="truncate">{t('classes.attendedMeeting')}</span>
							</dt>
							<dd
								class={`shrink-0 font-medium ${meetParticipant ? 'text-emerald-600' : sessionRecorded ? 'text-red-600' : 'text-ink-900/40'}`}
							>
								{#if meetParticipant?.joinTime}
									{t('dashboard.attended')} · {moment(
										meetParticipant.joinTime,
									).format('MMM D · HH:mm')}
								{:else if meetParticipant}
									{t('dashboard.attended')}
								{:else if sessionRecorded}
									{t('dashboard.absent')}
								{:else}
									{t('classes.attendanceNotAvailable')}
								{/if}
							</dd>
						</div>
					{/if}
				</dl>
			{/if}
			<div class={showRequirements ? 'border-t border-ink-900/5 py-2.5' : 'py-2.5'}>
				<button
					onclick={onComplete}
					disabled={!selectedLecture ||
						completingLec ||
						(!!selectedLecture && completedIds.has(selectedLecture.id)) ||
						!canComplete}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-teal-500 to-teal-700 px-4 py-2.5 md:py-2 text-sm font-semibold text-white transition hover:from-teal-500 hover:to-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if completingLec}
						<LoaderCircle class="h-4 w-4 animate-spin" />
						{t('classes.marking')}
					{:else if selectedLecture && completedIds.has(selectedLecture.id)}
						<ListChecks class="h-4 w-4" />
						{t('classes.completed')}
					{:else}
						<ListChecks class="h-4 w-4" />
						{t('classes.markAsCompleted')}
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>
