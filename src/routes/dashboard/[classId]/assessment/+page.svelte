<script lang="ts">
	import { page } from '$app/state';
	import { db } from '$lib/firebase';
	import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
	import { ClipboardList, Download, CheckCircle2, XCircle, LoaderCircle } from '@lucide/svelte';
	import { Modal, FileUpload } from '$lib/components/ui';
	import GoogleMeetIcon from '$lib/components/GoogleMeetIcon.svelte';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { t } from '$lib/i18n';

	const classId = $derived(page.params.classId ?? '');
	const MAX_FILE_BYTES = 10 * 1024 * 1024;

	interface RosterStudent {
		id: string;
		authId: string;
		name: string;
		email: string;
		ramaId: string;
		assessmentFormUrl?: string;
	}

	interface PostTestDef {
		quizId: string;
		lectureId: string;
		lectureTitle: string;
		quizTitle: string;
	}

	interface StudentPerformance {
		attended: number;
		total: number;
		activities: Record<string, { checkedInAt: Date | null; hasMeetSession: boolean }>;
		postTestsByLecture: Record<string, { quizTitle: string; scorePct: number | null }>;
		assessmentFormUrl?: string;
	}

	type MaterialLike = {
		type: string;
		value?: string;
		title?: string;
		requiredPostTest?: boolean;
	};

	interface AttemptDoc {
		score?: number;
		totalPoints?: number;
		completedAt?: { toDate?: () => Date };
	}

	let loading = $state(true);
	let error = $state<string | null>(null);
	let students = $state<RosterStudent[]>([]);
	let lectures = $state<{ id: string; title: string; hasMeet: boolean }[]>([]);
	let postTestDefs = $state<PostTestDef[]>([]);

	let selectedStudent = $state<RosterStudent | null>(null);
	let modalLoading = $state(false);
	let modalError = $state<string | null>(null);
	let performance = $state<StudentPerformance | null>(null);
	let uploading = $state(false);
	let uploadError = $state<string | null>(null);
	let uploadSuccess = $state(false);

	function fileToDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});
	}

	async function uploadAssessmentForm(file: File) {
		const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
		if (!isPdf) {
			uploadError = t('signup.assessmentFormInvalidType');
			return;
		}
		if (file.size >= MAX_FILE_BYTES) {
			uploadError = t('signup.assessmentFormTooLarge');
			return;
		}
		if (!selectedStudent) return;

		uploading = true;
		uploadError = null;
		uploadSuccess = false;
		try {
			const user = authState.user;
			if (!user) throw new Error(t('common.notLoggedIn'));
			const token = await user.getIdToken();
			const fileData = await fileToDataUrl(file);
			const res = await fetch(functionsUrl('uploadAssessmentForm'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					studentId: selectedStudent.id,
					originalName: file.name,
					fileData,
				}),
			});
			const data = await res.json();
			if (!res.ok || !data.downloadUrl) {
				throw new Error(data.error || t('common.somethingWentWrong'));
			}
			selectedStudent.assessmentFormUrl = data.downloadUrl;
			if (performance) performance = { ...performance, assessmentFormUrl: data.downloadUrl };
			uploadSuccess = true;
		} catch (err) {
			console.error(err);
			uploadError = t('dashboard.uploadAssessmentFormError');
		} finally {
			uploading = false;
		}
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
			const enroled: string[] = classSnap.data()?.enroledStudents ?? [];

			const lecSnap = await getDocs(collection(db, 'classes', classId, 'lectures'));
			const lecList: { id: string; title: string; hasMeet: boolean }[] = [];
			const defs: PostTestDef[] = [];
			for (const d of lecSnap.docs) {
				const data = d.data();
				const title = data?.title ?? t('common.untitledLecture');
				const mats = (data?.materials ?? []) as MaterialLike[];
				lecList.push({ id: d.id, title, hasMeet: mats.some((m) => m.type === 'meet') });
				for (const mat of mats) {
					if (mat.type === 'quiz' && mat.requiredPostTest && mat.value) {
						defs.push({
							quizId: mat.value,
							lectureId: d.id,
							lectureTitle: title,
							quizTitle: mat.title ?? '',
						});
					}
				}
			}
			lectures = lecList;
			postTestDefs = defs;

			const usersSnap = await getDocs(collection(db, 'users'));
			const byId = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
			students = enroled
				.map((id): RosterStudent | null => {
					const u = byId.get(id);
					if (!u) return null;
					return {
						id,
						authId: (u.authId as string) ?? '',
						name: (u.name as string) ?? 'Unknown',
						email: (u.email as string) ?? '',
						ramaId: (u.rama_id as string) ?? '',
						assessmentFormUrl: (u.assessmentFormUrl as string | undefined) ?? undefined,
					};
				})
				.filter((s): s is RosterStudent => s !== null)
				.sort((a, b) => a.name.localeCompare(b.name));
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

	async function openModal(student: RosterStudent) {
		selectedStudent = student;
		modalLoading = true;
		modalError = null;
		performance = null;
		uploading = false;
		uploadError = null;
		uploadSuccess = false;
		try {
			const actSnap = await getDocs(collection(db, 'users', student.id, 'activities'));
			const activities: Record<
				string,
				{ checkedInAt: Date | null; hasMeetSession: boolean }
			> = {};
			actSnap.docs.forEach((d) => {
				const a = d.data();
				activities[d.id] = {
					checkedInAt: a.checkedInAt?.toDate?.() ?? null,
					hasMeetSession: Boolean(a.meetSession),
				};
			});

			const postTestsByLecture: Record<
				string,
				{ quizTitle: string; scorePct: number | null }
			> = {};
			for (const def of postTestDefs) {
				let scorePct: number | null = null;
				const q = query(
					collection(db, 'quizAttempts'),
					where('authId', '==', student.authId),
					where('quizId', '==', def.quizId),
					where('lectureId', '==', def.lectureId),
				);
				const snap = await getDocs(q);
				if (!snap.empty) {
					const attempts = snap.docs
						.map((d) => d.data() as AttemptDoc | undefined)
						.filter((d): d is AttemptDoc => d != null);
					const latest = attempts.sort(
						(a, b) =>
							(b.completedAt?.toDate?.()?.getTime() ?? 0) -
							(a.completedAt?.toDate?.()?.getTime() ?? 0),
					)[0];
					const total = latest?.totalPoints ?? 0;
					scorePct = total > 0 ? Math.round(((latest?.score ?? 0) / total) * 100) : 0;
				}
				postTestsByLecture[def.lectureId] = { quizTitle: def.quizTitle, scorePct };
			}

			performance = {
				attended: lectures.filter((lec) =>
					lec.hasMeet
						? activities[lec.id]?.hasMeetSession
						: activities[lec.id]?.checkedInAt != null,
				).length,
				total: lectures.length,
				activities,
				postTestsByLecture,
				assessmentFormUrl: student.assessmentFormUrl,
			};
		} catch (err) {
			console.error(err);
			modalError = t('common.somethingWentWrong');
		} finally {
			modalLoading = false;
		}
	}
</script>

<svelte:head>
	<title>RAMA Toxico | {t('dashboard.assessStudents')}</title>
</svelte:head>

<div class="mx-auto w-full min-w-0 px-4 py-10">
	<h1 class="flex items-center gap-2 text-lg font-semibold text-ink-900">
		<ClipboardList class="h-4 w-4 text-iris-500" />
		{t('dashboard.assessStudents')}
	</h1>

	{#if loading}
		<div class="flex items-center justify-center gap-2 py-16">
			<LoaderCircle class="h-5 w-5 animate-spin text-iris-600" />
			<span class="text-[13px] text-ink-500">{t('common.loading')}</span>
		</div>
	{:else if error}
		<p class="py-10 text-center text-[13px] text-red-600">{error}</p>
	{:else if students.length === 0}
		<p class="py-10 text-center text-[13px] text-ink-400">
			{t('students.noStudentsEnrolledYet')}
		</p>
	{:else}
		<ul
			class="mt-6 divide-y divide-ink-900/10 overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft"
		>
			{#each students as student (student.id)}
				<li>
					<button
						type="button"
						onclick={() => openModal(student)}
						class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-ink-900/[0.03]"
					>
						<div class="min-w-0">
							<p class="truncate text-[13.5px] font-medium text-ink-900">
								{student.name}
								{#if student.ramaId}
									<span
										class="ml-2 font-mono text-[12px] font-normal text-ink-400"
										>{student.ramaId}</span
									>
								{/if}
							</p>
							<p class="truncate text-[12px] text-ink-500">{student.email}</p>
						</div>
						<span
							class="inline-flex shrink-0 items-center gap-1 rounded-md bg-iris-500/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-iris-700"
						>
							<ClipboardList class="h-3 w-3" />
							{t('dashboard.viewAssessment')}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<Modal
	open={selectedStudent != null}
	title={selectedStudent?.name ?? ''}
	class="max-w-lg"
	onclose={() => {
		selectedStudent = null;
		uploadError = null;
		uploadSuccess = false;
	}}
>
	{#if modalLoading}
		<div class="flex items-center justify-center gap-2 py-10">
			<LoaderCircle class="h-4 w-4 animate-spin text-iris-600" />
			<span class="text-[13px] text-ink-500">{t('common.loading')}</span>
		</div>
	{:else if modalError}
		<p class="py-6 text-center text-[13px] text-red-600">{modalError}</p>
	{:else if performance}
		<div class="space-y-5">
			<section>
				<p class="text-[12px] font-semibold uppercase tracking-wider text-ink-400">
					{t('dashboard.attendance')}
				</p>
				<p class="mt-1 text-[13px] font-medium text-ink-900">
					{t('dashboard.attendanceSummary', {
						count: performance.attended,
						total: performance.total,
					})}
				</p>
				<div class="mt-2 overflow-hidden rounded-lg border border-ink-900/10">
					<div
						class="grid grid-cols-[1fr_96px_96px] items-center gap-2 bg-ink-900/[0.03] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400"
					>
						<span>{t('dashboard.lecture')}</span>
						<span class="text-center">{t('dashboard.checkIn')}</span>
						<span class="text-center">{t('dashboard.postTest')}</span>
					</div>
					<ul class="divide-y divide-ink-900/5">
						{#each lectures as lec (lec.id)}
							{@const attended = lec.hasMeet
								? performance.activities[lec.id]?.hasMeetSession
								: performance.activities[lec.id]?.checkedInAt != null}
							{@const post = performance.postTestsByLecture[lec.id]}
							<li
								class="grid grid-cols-[1fr_96px_96px] items-center gap-2 px-3 py-2 text-[12.5px]"
							>
								<span
									class="flex min-w-0 items-center gap-1.5 font-semibold text-ink-900"
								>
									{#if lec.hasMeet}
										<GoogleMeetIcon class="h-4 w-4 shrink-0 text-emerald-600" />
									{/if}
									<span class="truncate">{lec.title}</span>
								</span>
								<span class="text-center">
									{#if attended}
										<span
											class="inline-flex items-center gap-1 font-medium text-emerald-600"
										>
											<CheckCircle2 class="h-3.5 w-3.5" />
											{t('dashboard.attended')}
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1 font-medium text-red-400"
										>
											<XCircle class="h-3.5 w-3.5" />
											{t('dashboard.absent')}
										</span>
									{/if}
								</span>
								<span class="text-center">
									{#if !post}
										<span class="text-ink-300">—</span>
									{:else if post.scorePct != null}
										<span
											class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold {post.scorePct >=
											60
												? 'bg-emerald-50 text-emerald-700'
												: 'bg-red-50 text-red-600'}"
										>
											{post.scorePct}%
										</span>
									{:else}
										<span class="text-[11.5px] text-ink-400">
											{t('dashboard.notAttempted')}
										</span>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			</section>

			<section class="border-t border-ink-900/10 pt-4">
				<p class="text-[12px] font-semibold uppercase tracking-wider text-ink-400">
					{t('dashboard.assessmentForm')}
				</p>
				{#if performance.assessmentFormUrl}
					<a
						href={performance.assessmentFormUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-iris-500/10 px-3 py-2 text-[12px] font-semibold text-iris-700 transition hover:bg-iris-500/15"
					>
						<Download class="h-3.5 w-3.5" />
						{t('dashboard.downloadAssessmentForm')}
					</a>
				{:else}
					<p class="mt-2 text-[12.5px] text-ink-400">
						{t('dashboard.noAssessmentForm')}
					</p>
				{/if}

				<div class="mt-4 border-t border-ink-900/10 pt-3">
					<p class="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-400">
						{t('dashboard.uploadAssessmentForm')}
					</p>
					<FileUpload
						accept="application/pdf,.pdf"
						disabled={uploading}
						onupload={(file) => uploadAssessmentForm(file as File)}
					/>
					{#if uploading}
						<p class="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-500">
							<LoaderCircle class="h-3.5 w-3.5 animate-spin text-iris-600" />
							{t('dashboard.uploadingAssessmentForm')}
						</p>
					{/if}
					{#if uploadError}
						<p class="mt-1.5 text-[12px] text-red-600">{uploadError}</p>
					{/if}
					{#if uploadSuccess}
						<p class="mt-1.5 text-[12px] text-emerald-600">
							{t('dashboard.uploadedAssessmentForm')}
						</p>
					{/if}
				</div>
			</section>
		</div>
	{/if}
</Modal>
