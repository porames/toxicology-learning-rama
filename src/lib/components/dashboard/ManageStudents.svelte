<script lang="ts">
	import { db } from '$lib/firebase';
	import { collection, getDocs, query, where } from 'firebase/firestore';
	import type { Student } from '$lib/dashboard/types';
	import StudentTable from '$lib/components/dashboard/StudentTable.svelte';
	import { Modal, SearchableSelect, Button } from '$lib/components/ui';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { t } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';
	import { UserPlus, Loader2, CheckCircle2 } from '@lucide/svelte';
	import moment from 'moment';

	let { classId, onEnrolled }: { classId?: string; onEnrolled?: () => void } = $props();

	let students: Student[] | undefined = $state(undefined);
	let classes = $state<{ id: string; name: string }[]>([]);
	let selectedClassId = $state(classId ?? '');
	let enrolling = $state(false);
	let error: string | null = $state(null);
	let success: string | null = $state(null);
	let enrollingStudent: Student | null = $state(null);
	let modalError: string | null = $state(null);

	const classOptions = $derived(classes.map((c) => ({ value: c.id, label: c.name })));

	const ROLE_LABELS = $derived<Record<string, string>>({
		student: t('students.roleStudent'),
		resident: t('students.roleResident'),
		teacher: t('students.roleTeacher'),
		admin: t('students.roleAdmin'),
	});

	const YEAR_LABELS: Record<string, string> = {
		y4: t('students.yearY4'),
		y5: t('students.yearY5'),
		y6: t('students.yearY6'),
		r1: t('students.yearR1'),
		r2: t('students.yearR2'),
		r3: t('students.yearR3'),
	};

	function toDate(value: unknown): Date | null {
		if (!value) return null;
		const ts = value as { toDate?: () => Date };
		if (typeof ts.toDate === 'function') return ts.toDate();
		const d = new Date(value as string | number);
		return isNaN(d.getTime()) ? null : d;
	}

	function fmtDay(d?: Date | null): string {
		if (!d || d.getTime() === 0) return '—';
		return moment(d).format('MMM D, YYYY');
	}

	async function loadUsers() {
		try {
			error = null;
			const q = query(collection(db, 'users'), where('role', 'in', ['student', 'resident']));
			const snapshot = await getDocs(q);
			const loaded = snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					rama_id: data?.rama_id,
					name: data.name,
					firstName: data?.firstName ?? '',
					lastName: data?.lastName ?? '',
					email: data.email,
					role: data.role ?? '',
					year: data.year ?? '',
					phone: data.phone ?? '',
					lineId: data?.lineId,
					hospital: data?.hospital ?? '',
					department: data?.department ?? '',
					createdAt: toDate(data?.createdAt),
					enroledClasses: data.enroledClasses ?? [],
					electiveStart: toDate(data?.electiveStart) ?? new Date(0),
					electiveEnd: toDate(data?.electiveEnd) ?? new Date(0),
				} as Student;
			});
			students = loaded.sort(
				(a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
			);
		} catch (err) {
			error = t('students.couldNotLoadStudents');
			console.error(err);
		}
	}

	async function loadClasses() {
		try {
			const snap = await getDocs(collection(db, 'classes'));
			classes = snap.docs
				.map((d) => ({
					id: d.id,
					name: (d.data()?.name as string) || t('common.untitled'),
				}))
				.sort((a, b) => a.name.localeCompare(b.name));
		} catch (err) {
			console.error(err);
			classes = [];
		}
	}

	$effect(() => {
		loadUsers();
	});

	$effect(() => {
		loadClasses();
	});

	async function enrol(classId: string, studentIds: string[]) {
		enrolling = true;
		error = null;
		success = null;
		try {
			const user = authState.user;
			if (!user) throw new Error(t('common.notLoggedIn'));
			const token = await user.getIdToken();

			const res = await fetch(functionsUrl('enrolStudents'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ classId, studentIds }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.error || t('common.somethingWentWrong'));
			}

			success = t('students.enrolledSuccessfully', { count: studentIds.length });
			onEnrolled?.();
			await loadUsers();
		} catch (err) {
			error =
				err instanceof Error
					? translateApiError(err.message)
					: t('common.somethingWentWrong');
		} finally {
			enrolling = false;
		}
	}

	async function enrolOne() {
		if (!enrollingStudent) return;
		if (!selectedClassId) {
			modalError = t('students.chooseClass');
			return;
		}
		modalError = null;
		await enrol(selectedClassId, [enrollingStudent.id]);
		if (error) {
			modalError = error;
		} else {
			enrollingStudent = null;
		}
	}
</script>

<div class="w-full min-w-0 space-y-8">
	{#if error}
		<div class="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</div>
	{/if}
	{#if success}
		<div
			class="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700"
		>
			<CheckCircle2 class="h-4 w-4 shrink-0" />
			{success}
		</div>
	{/if}

	<section class="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft">
		<div class="flex items-center justify-between border-b border-ink-900/5 px-4 py-3">
			<div>
				<p class="text-[13.5px] font-semibold text-ink-900">
					{t('students.registeredStudents')}
					<span class="ml-1.5 font-normal text-ink-300">({students?.length ?? 0})</span>
				</p>
				<p class="text-[12.5px] text-ink-500">{t('students.registeredStudentsHint')}</p>
			</div>
		</div>

		<div class="p-3">
			{#if students === undefined}
				<div class="flex items-center justify-center gap-2 py-12 text-[12px] text-ink-400">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
					></div>
					{t('common.loading')}
				</div>
			{:else}
				<StudentTable
					{students}
					onChanged={loadUsers}
					onEnrol={(student) => {
						enrollingStudent = student;
						modalError = null;
					}}
				/>
			{/if}
		</div>
	</section>

	{#if enrollingStudent}
		<Modal
			open
			title={t('students.enrolStudentTitle', { name: enrollingStudent.name })}
			class="max-w-md"
			onclose={() => (enrollingStudent = null)}
		>
			<div class="space-y-4">
				<div class="rounded-lg bg-ink-900/[0.03] px-3.5 py-3">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-[15px] font-semibold text-ink-900">
								{enrollingStudent.name}
							</p>
							<p class="truncate text-[12.5px] text-ink-500">
								{enrollingStudent.email}
							</p>
						</div>
						<span
							class="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink-600"
						>
							{ROLE_LABELS[enrollingStudent.role ?? ''] ?? enrollingStudent.role}
						</span>
					</div>
					<div class="mt-2.5 grid grid-cols-1 gap-y-1.5 text-[12.5px]">
						{#snippet detail(label: string, value?: string)}
							<div class="flex items-center justify-between gap-2">
								<span class="shrink-0 font-semibold text-ink-700">{label}</span>
								<span class="truncate text-right text-ink-500">{value || '—'}</span>
							</div>
						{/snippet}
						{@render detail(t('students.firstName'), enrollingStudent.firstName)}
						{@render detail(t('students.lastName'), enrollingStudent.lastName)}
						{@render detail(
							t('students.role'),
							ROLE_LABELS[enrollingStudent.role ?? ''] ?? enrollingStudent.role,
						)}
						{@render detail(
							t('students.year'),
							YEAR_LABELS[enrollingStudent.year ?? ''] ?? enrollingStudent.year,
						)}
						{@render detail(t('students.department'), enrollingStudent.department)}
						{@render detail(
							t('students.electiveStart'),
							fmtDay(enrollingStudent.electiveStart),
						)}
						{@render detail(
							t('students.electiveEnd'),
							fmtDay(enrollingStudent.electiveEnd),
						)}
						{@render detail(t('students.phoneNumber'), enrollingStudent.phone)}
						{@render detail(t('students.lineIdLabel'), enrollingStudent.lineId)}
					</div>
				</div>

				<SearchableSelect
					label={t('students.enrollingInto')}
					options={classOptions}
					bind:value={selectedClassId}
					placeholder={t('students.chooseClass')}
				/>
				{#if modalError}
					<p class="text-[12.5px] text-red-600">{modalError}</p>
				{/if}
			</div>

			{#snippet footer()}
				<Button
					variant="ghost"
					onclick={() => (enrollingStudent = null)}
					disabled={enrolling}
				>
					{t('common.cancel')}
				</Button>
				<Button onclick={enrolOne} disabled={enrolling || !selectedClassId}>
					{#if enrolling}
						<Loader2 class="h-4 w-4 animate-spin" />
						{t('students.enrolling')}
					{:else}
						<UserPlus class="h-4 w-4" />
						{t('students.confirmEnrol')}
					{/if}
				</Button>
			{/snippet}
		</Modal>
	{/if}
</div>
