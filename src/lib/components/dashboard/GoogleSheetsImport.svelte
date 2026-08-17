<script lang="ts">
	import { SquarePen } from '@lucide/svelte';
	import moment from 'moment';
	import type { Student } from '$lib/dashboard/types';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { db } from '$lib/firebase';
	import { collection, getDocs } from 'firebase/firestore';
	import { Table, Modal, Button, DateTimeInput, Select, SearchableSelect } from '$lib/components/ui';
	import { t } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';

	let { classId, onEnrolled }: { classId?: string; onEnrolled?: () => void } = $props();

	const ROLE_OPTIONS = $derived<{ value: string; label: string }[]>([
		{ value: 'student', label: t('students.roleStudent') },
		{ value: 'resident', label: t('students.roleResident') },
		{ value: 'teacher', label: t('students.roleTeacher') },
		{ value: 'admin', label: t('students.roleAdmin') },
	]);

	const YEAR_OPTIONS = $derived<Record<string, { value: string; label: string }[]>>({
		student: [
			{ value: 'y4', label: t('students.yearY4') },
			{ value: 'y5', label: t('students.yearY5') },
			{ value: 'y6', label: t('students.yearY6') },
		],
		resident: [
			{ value: 'r1', label: t('students.yearR1') },
			{ value: 'r2', label: t('students.yearR2') },
			{ value: 'r3', label: t('students.yearR3') },
		],
	});

	let reading = $state(false);
	let error: string | null = $state(null);
	let data: string[][] | null = $state(null);
	let showModal = $state(false);
	let hasAutoLoaded = $state(false);

	type EnrolStudent = Omit<Student, 'electiveStart' | 'electiveEnd' | 'year'> & {
		electiveStart: Date | null;
		electiveEnd: Date | null;
		classId: string;
		year: string;
	};
	let enrolList = $state<EnrolStudent[]>([]);
	let enrolling = $state(false);
	let classes = $state<
		{ id: string; name: string; classStart?: Date | null; classEnd?: Date | null }[]
	>([]);

	const classOptions = $derived(
		classes.map((c) => {
			const start = c.classStart ? moment(c.classStart).format('MMM D, YYYY') : null;
			const end = c.classEnd ? moment(c.classEnd).format('MMM D, YYYY') : null;
			const range =
				start && end
					? ` (${start} – ${end})`
					: start
						? ` (from ${start})`
						: end
							? ` (until ${end})`
							: '';
			return { value: c.id, label: `${c.name}${range}` };
		}),
	);

	$effect(() => {
		async function loadClasses() {
			try {
				const snap = await getDocs(collection(db, 'classes'));
				classes = snap.docs
					.map((d) => ({
						id: d.id,
						name: (d.data()?.name as string) || t('common.untitled'),
						classStart: d.data()?.classStart?.toDate?.() ?? null,
						classEnd: d.data()?.classEnd?.toDate?.() ?? null,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			} catch (err) {
				console.error(err);
				classes = [];
			}
		}
		loadClasses();
	});

	const columnLabels = [
		'ประทับเวลา',
		'ชื่อ-สกุล',
		'สถานะ',
		'ต้นสังกัด',
		'เบอร์โทรศัพท์',
		'Email',
		'Line ID',
		'ระยะเวลา Elective',
		'วันที่เริ่ม',
		'วันสิ้นสุด',
	];
	$effect(() => {
		if (authState.user && !hasAutoLoaded) {
			hasAutoLoaded = true;
			handleRead();
		}
	});

	function parseElectiveDate(value: string | undefined): Date {
		const parsed = moment(value ?? '', 'DD/MM/YYYY', true);
		return parsed.isValid() ? parsed.toDate() : new Date(0);
	}

	function mapStatusToRole(status: string): string {
		const s = (status ?? '').trim();
		if (/นักศึกษาแพทย์/.test(s)) return 'student';
		if (/แพทย์ประจำบ้าน/.test(s)) return 'resident';
		if (/อาจารย์/.test(s)) return 'teacher';
		return 'teacher';
	}

	const sheetStudents = $derived<Student[]>(
		(data ?? []).slice(1).map((row) => {
			const first = row[1] ?? '';
			const last = row[2] ?? '';
			const status = row[3] ?? '';
			const phone = row[5] ?? '';
			const email = row[6] ?? '';
			const lineId = row[7] ?? '';
			const start = row[9];
			const end = row[10];
			return {
				id: '',
				email,
				name: [first, last].filter(Boolean).join(' '),
				role: mapStatusToRole(status),
				phone,
				lineId: lineId || undefined,
				electiveStart: parseElectiveDate(start),
				electiveEnd: parseElectiveDate(end),
			};
		}),
	);

	async function handleRead() {
		reading = true;
		error = null;
		data = null;
		try {
			const user = authState.user;
			if (!user) throw new Error('Not logged in');
			const token = await user.getIdToken();

			const res = await fetch(functionsUrl('readGoogleSheet'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(translateApiError(body?.error));
			}

			const result = await res.json();
			const values: string[][] = (result.values ?? []) as string[][];
			data = values.map((row) => {
				const cells = [...row];
				while (cells.length > 0 && (cells[cells.length - 1] ?? '') === '') cells.pop();
				return cells;
			});
		} catch (err) {
			error = err instanceof Error ? err.message : t('common.somethingWentWrong');
		} finally {
			reading = false;
		}
	}

	function openEnrolModal(student: Student) {
		enrolList = [
			{
				...student,
				electiveStart: student.electiveStart.getTime() === 0 ? null : student.electiveStart,
				electiveEnd: student.electiveEnd.getTime() === 0 ? null : student.electiveEnd,
				year: student.year ?? '',
				classId: classId ?? classes[0]?.id ?? '',
			},
		];
		showModal = true;
	}

	async function handleEnrol() {
		enrolling = true;
		error = null;
		try {
			const user = authState.user;
			if (!user) throw new Error('Not logged in');
			const token = await user.getIdToken();

			const byClass = new Map<string, EnrolStudent[]>();
			for (const s of enrolList) {
				if (!s.classId) throw new Error(t('students.chooseClass'));
				const arr = byClass.get(s.classId) ?? [];
				arr.push(s);
				byClass.set(s.classId, arr);
			}

			for (const [cid, students] of byClass) {
				const res = await fetch(functionsUrl('enrolStudents'), {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						classId: cid,
						studentData: students.map((s) => ({
							email: s.email,
							name: s.name,
							role: s.role,
							year: s.year,
							phone: s.phone,
							electiveStart: s.electiveStart?.toISOString(),
							electiveEnd: s.electiveEnd?.toISOString(),
						})),
					}),
				});

				if (!res.ok) {
					const body = await res.json().catch(() => null);
					throw new Error(translateApiError(body?.error));
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : t('common.somethingWentWrong');
			enrolling = false;
			return;
		}
		enrolling = false;
		showModal = false;
		onEnrolled?.();
	}
</script>

<div>
	{#if reading && !data}
		<div class="flex items-center gap-2 px-3 py-5 text-[12.5px] text-ink-500">
			<div
				class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
			></div>
			{t('students.loadingFormsResponse')}
		</div>
	{/if}

	{#if data}
		{@const rows = data}
		<div>
			<Table maxHeight="16rem">
				{#snippet headers()}
					<th style="width: 32px"></th>
					{#each columnLabels as label}
						<th class="max-w-56 overflow-hidden text-ellipsis">{label}</th>
					{/each}
				{/snippet}
				{#snippet body()}
					{#each rows.slice(1) as row, i}
						{@const student = sheetStudents[i]}
						<tr
							class={i % 2 === 0
								? 'bg-white hover:bg-gray-50'
								: 'bg-gray-50 hover:bg-gray-100'}
						>
							<td class="text-center">
								<button
									type="button"
									onclick={() => openEnrolModal(student)}
									title={t('students.enrol')}
									aria-label={t('students.enrolAria', { name: student.name })}
									class="inline-flex items-center gap-1 rounded-md bg-iris-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-iris-700 active:scale-[0.98]"
								>
									<SquarePen size={13} />
									{t('students.enrol')}
								</button>
							</td>
							{#each row as cell, j}
								{#if j === 1}
									<td
										class="max-w-56 overflow-hidden text-ellipsis"
										title={student.name}>{student.name}</td
									>
								{:else if j !== 2}
									<td
										class="max-w-56 overflow-hidden text-ellipsis text-gray-500"
										title={cell ?? ''}>{cell ?? ''}</td
									>
								{/if}
							{/each}
						</tr>
					{/each}
				{/snippet}
			</Table>
		</div>
	{/if}

	{#if error}
		<div class="rounded-md bg-red-50 px-3 py-2 text-[12.5px] text-red-600">
			{error}
		</div>
	{/if}
	<Modal
		open={showModal}
		title={t('students.enrolStudentTitle', {
			name: enrolList[0]?.name || t('students.thisStudent'),
		})}
		onclose={() => (showModal = false)}
		class="max-w-2xl"
	>
		{#if enrolList.length > 0}
			<div class="max-h-80 space-y-2 overflow-y-auto pr-1">
				{#each enrolList as student, i}
					<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
						<div class="flex items-center justify-between gap-3">
							<p class="truncate text-sm font-semibold text-ink-900">
								{student.name}
							</p>
						</div>
						<div class="mt-1.5 space-y-0.5 text-[12.5px] text-ink-500">
							<p>{student.email || '—'}</p>
							<p>{t('students.phone', { phone: student.phone || '—' })}</p>
							<p>{t('students.lineId', { lineId: student.lineId ?? '—' })}</p>
						</div>
						<div class="mt-2 grid grid-cols-2 gap-2">
							<Select
								label={t('students.role')}
								options={ROLE_OPTIONS}
								bind:value={student.role}
								onchange={() => {
									const validYears =
										YEAR_OPTIONS[student.role]?.map((o) => o.value) ?? [];
									if (!validYears.includes(student.year ?? '')) student.year = '';
								}}
								placeholder={t('students.selectRole')}
								compact
							/>
							<Select
								label={t('students.year')}
								options={YEAR_OPTIONS[student.role] ?? []}
								bind:value={student.year}
								placeholder={student.role === 'student' ||
								student.role === 'resident'
									? student.role === 'resident'
										? t('students.residencyYear')
										: 'ชั้นปี'
									: '—'}
								disabled={!YEAR_OPTIONS[student.role]}
								compact
							/>
						</div>
						<div class="mt-2 grid grid-cols-2 gap-2">
							<DateTimeInput
								mode="date"
								label={t('dashboard.classStart')}
								compact
								bind:value={student.electiveStart}
							/>
							<DateTimeInput
								mode="date"
								label={t('dashboard.classEnd')}
								compact
								bind:value={student.electiveEnd}
							/>
						</div>
						<SearchableSelect
							label={t('students.enrollingInto')}
							options={classOptions}
							bind:value={student.classId}
							placeholder={t('students.chooseClass')}
							compact
							class="mt-2"
						/>
					</div>
				{/each}
			</div>
		{:else}
			<p class="py-4 text-center text-sm text-gray-500">
				{t('students.noStudentSelected')}
			</p>
		{/if}
		{#snippet footer()}
			<Button
				variant="ghost"
				onclick={() => {
					showModal = false;
				}}>{t('common.cancel')}</Button
			>
			<Button disabled={enrolList.length === 0 || enrolling} onclick={handleEnrol}>
				{enrolling ? t('students.enrolling') : t('students.confirmEnrol')}
			</Button>
		{/snippet}
	</Modal>
</div>
