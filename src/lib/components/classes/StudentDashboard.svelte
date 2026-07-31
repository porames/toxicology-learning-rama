<script lang="ts">
	import { LogOut, LoaderCircle } from '@lucide/svelte';
	import { db, auth } from '$lib/firebase';
	import {
		collection,
		getDocs,
		query,
		where,
		serverTimestamp,
		setDoc,
		doc,
	} from 'firebase/firestore';
	import { signOut } from 'firebase/auth';
	import { goto } from '$app/navigation';
	import { authState } from '$lib/auth.svelte';
	import type { ClassItem, Lecture, Selection, CompletedLecture } from '$lib/dashboard/types';
	import LectureListPanel from '$lib/components/classes/LectureListPanel.svelte';
	import LectureDetailPanel from '$lib/components/classes/LectureDetailPanel.svelte';
	import DashboardLayout from '$lib/components/DashboardLayout.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

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
	let completedLecs = $state<CompletedLecture[]>([]);
	let completingLec = $state(false);
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
			const snapshot = await getDocs(collection(db, 'classes'));
			const classesData = snapshot.docs.map((doc) => ({
				id: doc.id,
				name: doc.data()['name'],
				code: doc.data()['code'],
				lectures: [],
			}));
			classes = classesData;

			const completedLecSnap = await getDocs(
				collection(db, 'users', authState.profile.docId, 'completedLectures'),
			);
			completedLecs = completedLecSnap.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as CompletedLecture[];
		} catch (err) {
			console.error(err);
			classesError = "Couldn't load classes. Try refreshing the page.";
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
			lecturesError = "Couldn't load lectures. Try refreshing the page.";
		} finally {
			lecturesLoading = false;
		}
	}

	async function handleLecSelection(lec: Lecture) {
		if (!classId) return;
		selection = { level: 'lecture', classId, lectureId: lec.id };

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
			materialsError = "Couldn't load materials for this lecture.";
		} finally {
			materialsLoading = false;
		}
	}

	const currentClass = $derived(classes.find((c) => c.id === classId));
	const selectedLecture = $derived(
		lectures.find((l) => selection?.level === 'lecture' && l.id === selection.lectureId),
	);
	const completedIds = $derived(new Set(completedLecs.map((c) => c.lectureId)));
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
		const user = authState.user;
		const lec = selectedLecture;

		lec.materials.forEach(async (mat) => {
			if (mat.type === 'video' && !videoUrls[mat.id] && mat.value) {
				try {
					const token = await user.getIdToken();
					const res = await fetch(
						'https://us-central1-rama-toxico-edu.cloudfunctions.net/getVideoPlaybackUrl',
						{
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								Authorization: `Bearer ${token}`,
							},
							body: JSON.stringify({ videoId: mat.value }),
						},
					);
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
			const uid = authState.user.uid;
			const q = query(collection(db, 'users'), where('authId', '==', uid));
			const snapshot = await getDocs(q);
			if (snapshot.empty) throw new Error('User document not found');

			const userDoc = snapshot.docs[0];
			await setDoc(doc(db, 'users', userDoc.id, 'completedLectures', selection.lectureId), {
				classId: classId,
				lectureId: selection.lectureId,
				completedAt: serverTimestamp(),
			});

			completedLecs = [
				...completedLecs,
				{
					id: selection.lectureId,
					classId: classId ?? '',
					lectureId: selection.lectureId,
					completedAt: serverTimestamp() as any,
				},
			];
		} catch (err) {
			console.log(err);
		} finally {
			completingLec = false;
		}
	}

	async function handleLogout() {
		await signOut(auth);
		goto('/');
	}
</script>

<DashboardLayout>
	{#snippet headerLeft()}
		<Breadcrumbs
			crumbs={[
				{ label: 'All Classes', href: '/classes' },
				...(currentClass ? [{ label: currentClass.name, active: true }] : []),
			]}
		/>
	{/snippet}

	{#snippet sidebarBottom()}
		<div class="flex-1 overflow-y-auto pt-3">
			<p
				class="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-300"
			>
				Classes
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
		<div class="border-t border-ink-900/8">
			<button
				onclick={handleLogout}
				class="flex w-full items-center gap-2 rounded-lg px-3 py-2 mt-2 text-[13px] font-medium text-ink-500 transition hover:bg-red-50 hover:text-red-600"
			>
				<LogOut class="h-4 w-4" />
				Sign out
			</button>
		</div>
	{/snippet}

	{#if !classId}
		<div
			class="hidden md:flex flex-1 flex-col items-center justify-center gap-2 overflow-y-auto px-5 text-center"
		>
			<p class="text-sm font-medium text-ink-900">Pick a class</p>
			<p class="max-w-xs text-sm text-ink-900/50">
				Choose a class from the sidebar to see its lectures and materials.
			</p>
		</div>
	{:else}
		<div class="flex flex-1 min-w-0 overflow-hidden">
			<LectureListPanel
				{lectures}
				{currentClass}
				selectedLectureId={selectedLecture?.id}
				{completedIds}
				loading={lecturesLoading}
				error={lecturesError}
				onSelectLecture={handleLecSelection}
			/>
			<LectureDetailPanel
				{selectedLecture}
				{displayQuiz}
				{currentClass}
				{completedIds}
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
				onCloseQuizResult={() => {
					quizResult = null;
					displayQuiz = null;
				}}
				onViewAttempts={() => {
					quizResult = null;
					quizViewKey++;
				}}
			/>
		</div>
	{/if}
</DashboardLayout>
