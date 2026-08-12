<script lang="ts">
	import { LoaderCircle, ClockCheck, CheckCircle2 } from '@lucide/svelte';
	import { db } from '$lib/firebase';
	import {
		collection,
		getDocs,
		getDoc,
		query,
		where,
		serverTimestamp,
		setDoc,
		doc,
		Timestamp,
	} from 'firebase/firestore';
	import { goto } from '$app/navigation';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import moment from 'moment';
	import type { ClassItem, Lecture, Selection, Activity, Assignment } from '$lib/dashboard/types';
	import LectureListPanel from '$lib/components/classes/LectureListPanel.svelte';
	import LectureDetailPanel from '$lib/components/classes/LectureDetailPanel.svelte';
	import AssignmentDetailPanel from '$lib/components/classes/AssignmentDetailPanel.svelte';
	import DashboardLayout from '$lib/components/DashboardLayout.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import { Button, Modal } from '$lib/components/ui';
	import { t } from '$lib/i18n';
	import ClassesList from './ClassesList.svelte';

	let { classId }: { classId?: string } = $props();

	let classes = $state<ClassItem[]>([]);
	let lectures = $state<Lecture[]>([]);
	let selection = $state<Selection>(null);
	let classesLoading = $state(true);
	let classesError = $state<string | null>(null);
	let lecturesLoading = $state(false);
	let lecturesError = $state<string | null>(null);
	let materialsLoading = $state(false);
	let materialsError = $state<string | null>(null);
	let activities = $state<Activity[]>([]);
	let completingLec = $state(false);
	let showCompletedModal = $state(false);
	let showCheckInModal = $state(false);
	let pendingCheckInLecture = $state<Lecture | null>(null);
	let checkingIn = $state(false);
	let checkInError = $state<string | null>(null);
	let now = $state(new Date());

	$effect(() => {
		if (!showCheckInModal) return;
		const timer = setInterval(() => {
			now = new Date();
		}, 1000);
		return () => clearInterval(timer);
	});
	let videoUrls = $state<Record<string, string>>({});
	let displayQuiz = $state<string | null>(null);
	let quizAttempts = $state<Record<string, { passed: boolean; completedAt: Date | null }>>({});
	let quizResult = $state<{
		id: string;
		score: number;
		totalPoints: number;
		passed: boolean;
		pct: number;
	} | null>(null);
	let quizViewKey = $state(0);

	async function loadClasses() {
		if (authState.loading || !authState.user || !authState.profile) return;
		classesLoading = true;
		classesError = null;
		try {
			const isAdmin =
				authState.profile.role === 'admin' || authState.profile.role === 'teacher';
			const snapshot = await getDocs(
				isAdmin
					? collection(db, 'classes')
					: query(
							collection(db, 'classes'),
							where('enroledStudents', 'array-contains', authState.profile.docId),
						),
			);
			const classesData = snapshot.docs.map((doc) => ({
				id: doc.id,
				name: doc.data()['name'],
				code: doc.data()['code'],
				lectures: [],
			}));
			classes = classesData;
			const activitiesSnap = await getDocs(
				collection(db, 'users', authState.profile.docId, 'activities'),
			);
			activities = activitiesSnap.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
				checkedInAt: doc.data().checkedInAt ?? null,
				completedAt: doc.data().completedAt ?? null,
			})) as Activity[];
		} catch (err) {
			console.error(err);
			classesError = t('classes.couldNotLoadClasses');
		} finally {
			classesLoading = false;
		}
	}

	async function loadLectures() {
		if (!classId) {
			lectures = [];
			selection = null;
			return;
		}
		lecturesLoading = true;
		lecturesError = null;
		selection = null;
		try {
			const snapshot = await getDocs(collection(db, 'classes', classId, 'lectures'));
			const lecturesData = snapshot.docs.map((doc) => ({
				id: doc.id,
				title: doc.data().title,
				startTime: doc.data().startTime.toDate(),
				endTime: doc.data().endTime.toDate(),
				materials: [],
				materialsOrder: doc.data().materialsOrder || [],
			}));
			lectures = lecturesData;
		} catch (err) {
			console.error(err);
			lecturesError = t('classes.couldNotLoadLectures');
		} finally {
			lecturesLoading = false;
		}
	}

	async function openLecture(lec: Lecture) {
		if (!classId) return;
		selection = { level: 'lecture', classId, lectureId: lec.id };
		selectedAssignment = null;

		const existing = lectures.find((l) => l.id === lec.id);
		if (existing && existing.materials.length > 0) return;

		materialsLoading = true;
		materialsError = null;
		try {
			const snapshot = await getDocs(
				collection(db, 'classes', classId, 'lectures', lec.id, 'materials'),
			);
			const materials = snapshot.docs.map((doc) => ({
				id: doc.id,
				type: doc.data().type,
				title: doc.data().title,
				value: doc.data().value,
				requiredPostTest: doc.data()?.requiredPostTest,
			}));

			const lecOrder = lec.materialsOrder;
			if (lecOrder && lecOrder.length > 0) {
				materials.sort((a: any, b: any) => {
					const aIdx = lecOrder.indexOf(a.id);
					const bIdx = lecOrder.indexOf(b.id);
					return (aIdx === -1 ? Infinity : aIdx) - (bIdx === -1 ? Infinity : bIdx);
				});
			}

			lectures = lectures.map((l) => (l.id === lec.id ? { ...l, materials } : l));
		} catch (err) {
			console.error(err);
			materialsError = t('classes.couldNotLoadMaterials');
		} finally {
			materialsLoading = false;
		}
	}

	function handleLecSelection(lec: Lecture) {
		if (checkedInIds.has(lec.id)) {
			openLecture(lec);
			return;
		}
		pendingCheckInLecture = lec;
		showCheckInModal = true;
	}

	async function confirmCheckIn() {
		const lec = pendingCheckInLecture;
		if (!lec || !classId || !authState.profile || checkingIn) return;
		if (!canCheckIn) return;
		if (checkedInIds.has(lec.id)) {
			showCheckInModal = false;
			pendingCheckInLecture = null;
			openLecture(lec);
			return;
		}
		checkingIn = true;
		checkInError = null;
		try {
			const docRef = doc(db, 'users', authState.profile.docId, 'activities', lec.id);

			await setDoc(docRef, {
				classId,
				lectureId: lec.id,
				checkedInAt: serverTimestamp(),
			});
			const docSnap = await getDoc(docRef);
			if (!docSnap.exists()) return;
			activities = [
				...activities,
				{
					id: lec.id,
					classId,
					lectureId: lec.id,
					checkedInAt: docSnap.data().checkedInAt,
					completedAt: null,
				},
			];
			console.log('activities recorded');
			console.log(activities);
		} catch (err) {
			console.error(err);
			checkInError = t('classes.couldNotCheckIn');
			checkingIn = false;
			return;
		}
		checkingIn = false;
		showCheckInModal = false;
		pendingCheckInLecture = null;
		openLecture(lec);
	}

	function cancelCheckIn() {
		if (checkingIn) return;
		showCheckInModal = false;
		pendingCheckInLecture = null;
		checkInError = null;
	}

	const currentClass = $derived(classes.find((c) => c.id === classId));
	const selectedLecture = $derived(
		lectures.find((l) => selection?.level === 'lecture' && l.id === selection.lectureId),
	);
	let selectedAssignment = $state<Assignment | null>(null);

	function handleSelectAssignment(assignment: Assignment) {
		selectedAssignment = assignment;
		selection = null;
	}
	const completedIds = $derived(
		new Set(activities.filter((a) => a.completedAt != null).map((a) => a.lectureId)),
	);
	const checkedInIds = $derived(
		new Set(activities.filter((a) => a.checkedInAt != null).map((a) => a.lectureId)),
	);
	const checkedInTimes = $derived(
		activities.reduce<Record<string, Date>>((map, a) => {
			if (a.checkedInAt) map[a.lectureId] = a.checkedInAt.toDate();
			return map;
		}, {}),
	);
	const completedTimes = $derived(
		activities.reduce<Record<string, Date>>((map, a) => {
			if (a.completedAt) map[a.lectureId] = a.completedAt.toDate();
			return map;
		}, {}),
	);
	const canCheckIn = $derived.by(() => {
		if (!pendingCheckInLecture) return false;
		const start = new Date(pendingCheckInLecture.startTime).getTime();
		const t = now.getTime();
		return t >= start - 15 * 60 * 1000 && t <= start + 15 * 60 * 1000;
	});
	const requiredQuizValues = $derived(
		selectedLecture?.materials
			.filter((m) => m.type === 'quiz' && m.requiredPostTest)
			.map((m) => m.value) ?? [],
	);
	const allRequiredPassed = $derived(requiredQuizValues.every((v) => quizAttempts[v]?.passed));

	$effect(() => {
		const authLoad = authState.loading;
		const user = authState.user;
		const profile = authState.profile;
		if (!authLoad && user && profile) {
			loadClasses();
		}
	});

	$effect(() => {
		if (classId) {
			loadLectures();
		}
	});

	$effect(() => {
		if (!selectedLecture || !authState.user) return;
		void quizViewKey;
		const user = authState.user;
		const lec = selectedLecture;

		lec.materials.forEach(async (mat) => {
			if (mat.type === 'video' && !videoUrls[mat.id] && mat.value) {
				try {
					const token = await user.getIdToken();
					const res = await fetch(functionsUrl('getVideoPlaybackUrl'), {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({ videoId: mat.value }),
					});
					if (res.ok) {
						const { embedUrl } = await res.json();
						const url = embedUrl.includes('?')
							? embedUrl + '&autoplay=false'
							: embedUrl + '?autoplay=false';
						videoUrls = { ...videoUrls, [mat.id]: url };
					}
				} catch (err) {
					console.error(err);
				}
			}

			if (mat.type === 'quiz' && mat.value && !quizAttempts[mat.value]) {
				const q = query(
					collection(db, 'quizAttempts'),
					where('authId', '==', user.uid),
					where('quizId', '==', mat.value),
					where('lectureId', '==', lec.id),
				);
				const snapshot = await getDocs(q);
				if (!snapshot.empty) {
					const attempts = snapshot.docs.map((d) => ({
						id: d.id,
						passed: d.data().passed as boolean,
						completedAt: d.data().completedAt as any,
					}));
					const firstPassed = attempts
						.filter((a) => a.passed)
						.sort((a, b) => {
							const aTime = a.completedAt?.toDate?.()?.getTime() ?? 0;
							const bTime = b.completedAt?.toDate?.()?.getTime() ?? 0;
							return aTime - bTime;
						})[0];
					const lastAttempt = attempts.sort((a, b) => {
						const aTime = a.completedAt?.toDate?.()?.getTime() ?? 0;
						const bTime = b.completedAt?.toDate?.()?.getTime() ?? 0;
						return bTime - aTime;
					})[0];
					quizAttempts = {
						...quizAttempts,
						[mat.value]: {
							passed: !!firstPassed,
							completedAt: firstPassed
								? (firstPassed.completedAt?.toDate?.() ?? null)
								: (lastAttempt.completedAt?.toDate?.() ?? null),
						},
					};
				}
			}
		});
	});

	async function completedLec() {
		if (completingLec) return;
		if (selection?.level !== 'lecture' || !authState.user) return;
		if (completedIds.has(selection.lectureId)) return;

		completingLec = true;
		try {
			const profile = authState.profile;
			if (!profile || selection?.level !== 'lecture') return;
			const lectureId = selection.lectureId;
			await setDoc(
				doc(db, 'users', profile.docId, 'activities', lectureId),
				{
					classId: classId,
					lectureId,
					completedAt: serverTimestamp(),
				},
				{ merge: true },
			);

			const completedAt = Timestamp.now();
			activities = activities.map((a) =>
				a.lectureId === lectureId ? { ...a, completedAt } : a,
			);
			if (!activities.some((a) => a.lectureId === lectureId)) {
				activities = [
					...activities,
					{
						id: lectureId,
						classId: classId ?? '',
						lectureId,
						checkedInAt: null,
						completedAt,
					},
				];
			}
			showCompletedModal = true;
		} catch (err) {
			console.log(err);
		} finally {
			completingLec = false;
		}
	}

	function handleQuizComplete(result: {
		id: string;
		score: number;
		totalPoints: number;
		passed: boolean;
		pct: number;
	}) {
		quizResult = result;
		displayQuiz = null;
		quizViewKey++;
	}
</script>

<DashboardLayout>
	{#snippet headerLeft()}
		<Breadcrumbs
			crumbs={[
				{ label: t('nav.allClasses'), href: '/classes' },
				...(currentClass
					? [
							{
								label: currentClass.name,
								onclick: () => {
									selection = null;
									selectedAssignment = null;
								},
								active: !selectedLecture && !selectedAssignment,
							},
						]
					: []),
				...(selectedAssignment
					? [
							{
								label:
									selectedAssignment.title ||
									selectedAssignment.instructions.split('\n')[0] ||
									t('classes.assignment'),
								active: true,
							},
						]
					: []),
				...(selectedLecture ? [{ label: selectedLecture.title, active: true }] : []),
			]}
		/>
	{/snippet}

	{#snippet sidebarBottom()}
		<div class="flex-1 overflow-y-auto pt-3">
			<p
				class="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-300"
			>
				{t('nav.classes')}
			</p>
			{#if classesLoading}
				<div class="space-y-1.5 px-2">
					{#each Array(4) as _}
						<div class="h-7 w-full animate-pulse rounded-md bg-ink-900/5"></div>
					{/each}
				</div>
			{:else if classesError}
				<p class="px-2 text-xs text-red-600">{classesError}</p>
			{:else}
				{#each classes as cls}
					<button
						type="button"
						onclick={() => goto(`/classes/${cls.id}`)}
						class={`block w-full rounded-md px-2 py-2 md:py-1.5 text-left text-sm transition-colors ${
							cls.id === classId
								? 'bg-iris-600/10 font-medium text-iris-600'
								: 'text-ink-900/70 hover:bg-ink-900/5'
						}`}
					>
						{cls.name}
					</button>
				{/each}
			{/if}
		</div>
	{/snippet}
	{#if classesLoading}
		<div class="flex h-full items-center justify-center w-full">
			<div class="flex flex-col items-center gap-3">
				<div
					class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"
				></div>
				<span class="text-[13px] text-ink-500">{t('common.loading')}</span>
			</div>
		</div>
	{:else}
		{#if !classId}
			<ClassesList {classes} />
		{:else}
			<div class="flex flex-1 min-w-0 overflow-hidden">
				<LectureListPanel
					{lectures}
					{currentClass}
					selectedLectureId={selectedLecture?.id}
					selectedAssignmentId={selectedAssignment?.id}
					{completedIds}
					{checkedInIds}
					{checkedInTimes}
					{completedTimes}
					loading={lecturesLoading}
					error={lecturesError}
					onSelectLecture={handleLecSelection}
					onSelectAssignment={handleSelectAssignment}
				/>
				{#if selectedAssignment}
					<AssignmentDetailPanel
						classId={classId ?? ''}
						assignment={selectedAssignment}
					/>
				{:else}
					<LectureDetailPanel
						{selectedLecture}
						{displayQuiz}
						{currentClass}
						{completedIds}
						checkedInTime={selectedLecture
							? checkedInTimes[selectedLecture.id]
							: undefined}
						completedTime={selectedLecture
							? completedTimes[selectedLecture.id]
							: undefined}
						{completingLec}
						{allRequiredPassed}
						{materialsLoading}
						{materialsError}
						{videoUrls}
						{quizAttempts}
						{quizResult}
						onBack={() => (selection = null)}
						onBackFromQuiz={() => (displayQuiz = null)}
						onStartQuiz={(quizId) => (displayQuiz = quizId)}
						onComplete={() => completedLec()}
						onQuizComplete={handleQuizComplete}
						onCloseQuizResult={() => {
							quizResult = null;
							displayQuiz = null;
						}}
						onViewAttempts={() => {
							quizResult = null;
							quizViewKey++;
						}}
					/>
				{/if}
			</div>
		{/if}
	{/if}
</DashboardLayout>

{#if showCheckInModal && pendingCheckInLecture}
	<Modal open onclose={cancelCheckIn} title={t('classes.checkInTitle')}>
		<div class="space-y-3">
			<p class="text-ink-500">
				{t('classes.lectureName')}
				<span class="font-bold text-ink-700"
					>{pendingCheckInLecture.title || t('common.untitledLecture')}</span
				>
			</p>
			<p class="text-[13px] text-ink-500">
				{t('classes.currentDeviceTime')}
				<span class="font-medium text-ink-700">{moment(now).format('hh:mm:ss A')}</span>
			</p>
			<p class="rounded-lg bg-iris-50 px-3 py-2 text-[14px] font-semibold text-iris-700">
				{t('classes.startsAt', {
					time: moment(pendingCheckInLecture.startTime).format('ddd, MMM D · hh:mm A'),
				})}
			</p>
			<div
				class="flex items-start gap-2 rounded-lg bg-ink-900/[0.03] px-3 py-2.5 text-[12.5px] text-ink-500"
			>
				<ClockCheck class="mt-0.5 h-4 w-4 shrink-0 text-iris-500" />
				<span>
					{t('classes.checkInWindow', {
						before: t('classes.minutesBefore'),
						after: t('classes.minutesAfter'),
					})}
				</span>
			</div>
			{#if checkInError}
				<p class="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600">
					{checkInError}
				</p>
			{:else if !canCheckIn}
				<p class="rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] text-red-600">
					{t('classes.outsideCheckInWindow')}
				</p>
			{/if}
		</div>
		{#snippet footer()}
			<Button variant="ghost" onclick={cancelCheckIn} disabled={checkingIn}
				>{t('common.cancel')}</Button
			>
			<Button onclick={confirmCheckIn} disabled={checkingIn || !canCheckIn}>
				{#if checkingIn}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
					></div>
					{t('classes.checkingIn')}
				{:else}
					{t('classes.checkIn')}
				{/if}
			</Button>
		{/snippet}
	</Modal>
{/if}

{#if showCompletedModal}
	<Modal open onclose={() => (showCompletedModal = false)} title={t('classes.lectureCompleted')}>
		<div class="flex flex-col items-center gap-2 py-2 text-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600"
			>
				<CheckCircle2 class="h-6 w-6" />
			</div>
			<p class="text-sm font-semibold text-ink-900">{t('classes.greatJob')}</p>
			<p class="text-[13px] text-ink-500">{t('classes.markedAsCompleted')}</p>
		</div>
		{#snippet footer()}
			<Button onclick={() => (showCompletedModal = false)}>{t('common.done')}</Button>
		{/snippet}
	</Modal>
{/if}
