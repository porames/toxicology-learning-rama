<script lang="ts">
	import { db } from '$lib/firebase';
	import {
		collection,
		doc,
		updateDoc,
		writeBatch,
		getDocs,
		arrayRemove,
	} from 'firebase/firestore';
	import type { Student } from '$lib/dashboard/types';
	import { Modal, Button, Input, Select } from '$lib/components/ui';
	import { CircleMinus } from '@lucide/svelte';
	import { t } from '$lib/i18n';

	const ROLE_LABELS = $derived<Record<string, string>>({
		student: t('students.roleStudentShort'),
		resident: t('students.roleResidentShort'),
		teacher: t('students.roleTeacherShort'),
		admin: t('students.roleAdminShort'),
	});

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

	let {
		student,
		onclose,
		onchanged = () => {},
	}: {
		student: Student | null;
		onclose: () => void;
		onchanged?: () => void;
	} = $props();

	let ramaId = $state('');
	let name = $state('');
	let email = $state('');
	let role = $state('');
	let year = $state('');
	let saving = $state(false);
	let error: string | null = $state(null);

	const roleOptions = $derived(
		Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
	);
	const yearOptions = $derived(YEAR_OPTIONS[role] ?? []);

	let classes = $state<{ id: string; name: string }[]>([]);
	let classesLoading = $state(false);
	let classUpdating = $state(false);
	let classError: string | null = $state(null);

	$effect(() => {
		ramaId = student?.rama_id ?? '';
		name = student?.name ?? '';
		email = student?.email ?? '';
		role = student?.role ?? '';
		year = student?.year ?? '';
		error = null;
		classError = null;
	});

	$effect(() => {
		if (!student) return;
		loadClasses();
	});

	async function loadClasses() {
		classesLoading = true;
		try {
			const snap = await getDocs(collection(db, 'classes'));
			classes = snap.docs.map((d) => ({ id: d.id, name: d.data()['name'] ?? d.id }));
		} catch (err) {
			console.error(err);
		} finally {
			classesLoading = false;
		}
	}

	const enrolledClasses = $derived(
		(student?.enroledClasses ?? [])
			.map((id) => classes.find((c) => c.id === id))
			.filter((c): c is { id: string; name: string } => Boolean(c)),
	);

	async function syncEnrolment(classId: string) {
		if (!student) return;
		classUpdating = true;
		classError = null;
		try {
			const batch = writeBatch(db);
			const userRef = doc(db, 'users', student.id);
			const classRef = doc(db, 'classes', classId);
			batch.update(userRef, { enroledClasses: arrayRemove(classId) });
			batch.update(classRef, { enroledStudents: arrayRemove(student.id) });
			await batch.commit();
			student.enroledClasses = (student.enroledClasses ?? []).filter((id) => id !== classId);
			onchanged();
		} catch (err) {
			console.error(err);
			classError = t('students.couldNotUpdateEnrolment');
		} finally {
			classUpdating = false;
		}
	}

	async function handleSave() {
		if (!student) return;
		const needsYear = role === 'student' || role === 'resident';
		if (!name || !email || !role || (needsYear && !year)) {
			error = t('students.pleaseFillRequired');
			return;
		}
		saving = true;
		error = null;
		try {
			await updateDoc(doc(db, 'users', student.id), {
				...(ramaId && { rama_id: ramaId }),
				name,
				email,
				role,
				...(needsYear && { year }),
			});
			onchanged();
			onclose();
		} catch (err) {
			console.error(err);
			error = t('students.couldNotSaveChanges');
		} finally {
			saving = false;
		}
	}
</script>

<Modal open title={t('students.editStudent')} {onclose} class="max-w-lg">
	<div class="space-y-2.5">
		<Input
			label={t('students.studentIdOptional')}
			bind:value={ramaId}
			placeholder="รหัสนักศึกษา"
			compact
		/>
		<Input label={t('students.fullName')} bind:value={name} placeholder="ชื่อ สกุล" compact />
		<Input label={t('students.email')} bind:value={email} placeholder="Email" compact />
		<Select label={t('students.role')} options={roleOptions} bind:value={role} compact />
		{#if yearOptions.length > 0}
			<Select
				label={t('students.year')}
				options={yearOptions}
				bind:value={year}
				placeholder={t('students.selectYear')}
				compact
			/>
		{:else}
			<Select
				label={t('students.year')}
				options={[]}
				bind:value={year}
				placeholder="—"
				disabled
				compact
			/>
		{/if}
		{#if error}
			<div class="rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] text-red-600">
				{error}
			</div>
		{/if}

		<div class="border-t border-ink-900/10 pt-2.5">
			<p class="mb-1.5 text-[13px] font-medium text-ink-700">
				{t('students.enrolledClasses')}
			</p>
			{#if classesLoading}
				<div class="space-y-1">
					{#each Array(2) as _, i}
						<div
							class="h-8 w-full animate-pulse rounded-md bg-ink-900/5"
							style={`animation-delay: ${i * 100}ms`}
						></div>
					{/each}
				</div>
			{:else if enrolledClasses.length > 0}
				<div class="space-y-1">
					{#each enrolledClasses as cls}
						<div
							class="flex items-center justify-between gap-2 rounded-md border border-ink-900/10 bg-ink-900/[0.02] px-2.5 py-1.5"
						>
							<span class="truncate text-[13px] text-ink-800">{cls.name}</span>
							<button
								type="button"
								onclick={() => syncEnrolment(cls.id)}
								disabled={classUpdating}
								class="rounded p-0.5 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
								aria-label={t('students.removeFromClass', { name: cls.name })}
							>
								<CircleMinus size={16} />
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-[12.5px] text-ink-400">{t('students.notEnrolledAny')}</p>
			{/if}
			{#if classError}
				<p class="mt-1.5 text-[12.5px] text-red-600">{classError}</p>
			{/if}
		</div>
	</div>
	{#snippet footer()}
		<Button variant="ghost" onclick={onclose}>{t('common.cancel')}</Button>
		<Button onclick={handleSave} disabled={saving}>
			{saving ? t('common.savingEllipsis') : t('common.save')}
		</Button>
	{/snippet}
</Modal>
