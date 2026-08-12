<script lang="ts">
	import { Pencil, Check, Trash2 } from '@lucide/svelte';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import type { Student } from '$lib/dashboard/types';
	import { Modal, Table } from '$lib/components/ui';
	import EditStudentModal from '$lib/components/dashboard/EditStudentModal.svelte';
	import { t } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';

	const ROLE_LABELS = $derived<Record<string, string>>({
		student: t('students.roleStudentShort'),
		resident: t('students.roleResidentShort'),
		teacher: t('students.roleTeacherShort'),
		admin: t('students.roleAdminShort'),
	});

	const YEAR_LABELS: Record<string, string> = {
		y4: t('students.yearY4'),
		y5: t('students.yearY5'),
		y6: t('students.yearY6'),
		r1: t('students.yearR1'),
		r2: t('students.yearR2'),
		r3: t('students.yearR3'),
	};

	let {
		students,
		enableSelection = false,
		setSelectedStudents,
		onChanged,
	}: {
		students: Student[] | undefined;
		enableSelection?: boolean;
		setSelectedStudents?: (students: Student[]) => void;
		onChanged?: () => void;
	} = $props();

	let editingStudent: Student | null = $state(null);
	let confirmingDeleteId: string | null = $state(null);
	let editDeleting = $state(false);
	let editError: string | null = $state(null);

	let checkedStudents: string[] = $state([]);

	function isChecked(id: string) {
		return checkedStudents.includes(id);
	}

	function toggleChecked(student: Student) {
		if (checkedStudents.includes(student.id)) {
			checkedStudents = checkedStudents.filter((id) => id !== student.id);
		} else {
			checkedStudents = [...checkedStudents, student.id];
		}
		const selected: Student[] = [];
		if (students) {
			for (const s of students) {
				if (checkedStudents.includes(s.id)) {
					selected.push(s);
				}
			}
		}
		setSelectedStudents?.(selected);
	}

	async function handleDelete(student: Student) {
		editDeleting = true;
		try {
			const user = authState.user;
			if (!user) throw new Error('Not logged in');
			const token = await user.getIdToken();

			const res = await fetch(functionsUrl('deleteUser'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ id: student.id }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(translateApiError(body?.message));
			}

			confirmingDeleteId = null;
			onChanged?.();
		} catch (err) {
			confirmingDeleteId = null;
			editError = err instanceof Error ? err.message : t('common.somethingWentWrong');
		} finally {
			editDeleting = false;
		}
	}
</script>

<Table>
	{#snippet headers()}
		{#if enableSelection}
			<th style="width: 32px"></th>
		{/if}
		<th>{t('students.fullName')}</th>
		<th>{t('students.email')}</th>
		<th>{t('students.role')}</th>
		<th>{t('students.actions')}</th>
	{/snippet}
	{#snippet body()}
		{#if students === undefined}
			{#each Array(3) as _, i}
				<tr class={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
					{#each Array(enableSelection ? 7 : 6) as _, j}
						<td class="py-1.5">
							<div class="h-3 w-20 animate-pulse rounded bg-gray-200"></div>
						</td>
					{/each}
				</tr>
			{/each}
		{/if}

		{#if students !== undefined && students.length === 0}
			<tr>
				<td colspan={enableSelection ? 7 : 6} class="py-6 text-center text-gray-400">
					{t('students.noStudentsYetAdd')}
				</td>
			</tr>
		{/if}

		{#if students !== undefined}
			{#each students as student, idx (student.id)}
				{@const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
				<tr class={`${rowBg} transition-colors hover:bg-gray-50`}>
					{#if enableSelection}
						<td>
							<button
								type="button"
								onclick={() => toggleChecked(student)}
								class={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
									isChecked(student.id)
										? 'bg-blue-600 border-blue-600'
										: 'bg-white border-gray-300 hover:border-gray-400'
								}`}
							>
								{#if isChecked(student.id)}
									<Check size={14} class="text-white" />
								{/if}
							</button>
						</td>
					{/if}
					<td>{student.name}</td>
					<td class="text-gray-500">{student.email}</td>
					<td class="text-gray-500">
						{ROLE_LABELS[student.role ?? ''] ?? student.role}
					</td>
					<td>
						<div class="my-1 flex items-center gap-2">
							<button type="button" onclick={() => (editingStudent = student)}>
								<Pencil size={16} class="text-gray-600" />
							</button>
							<button type="button" onclick={() => (confirmingDeleteId = student.id)}>
								<Trash2 size={16} class="ml-3 text-red-600" />
							</button>
						</div>
						{#if editError}
							<p class="mt-1 text-[11px] text-red-600">{editError}</p>
						{/if}
					</td>
				</tr>
			{/each}
		{/if}
	{/snippet}
</Table>

{#if editingStudent}
	<EditStudentModal
		student={editingStudent}
		onclose={() => (editingStudent = null)}
		onchanged={onChanged}
	/>
{/if}

{#if confirmingDeleteId !== null}
	{@const deletingStudent = students?.find((s) => s.id === confirmingDeleteId)}
	<Modal
		open
		title={t('students.deleteStudentTitle')}
		onclose={() => (confirmingDeleteId = null)}
	>
		<p class="text-[13px] text-ink-500">
			{t('students.deleteStudentConfirm', {
				name: deletingStudent?.name ?? t('students.thisStudent'),
				ramaId: deletingStudent?.rama_id ?? '',
			})}
		</p>
		{#snippet footer()}
			<button
				type="button"
				onclick={() => (confirmingDeleteId = null)}
				disabled={editDeleting}
				class="rounded-md border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{t('common.cancel')}
			</button>
			<button
				type="button"
				onclick={() => deletingStudent && handleDelete(deletingStudent)}
				disabled={editDeleting || !deletingStudent}
				class="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if editDeleting}
					<div
						class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
					></div>
					{t('common.deleting')}
				{:else}
					{t('common.delete')}
				{/if}
			</button>
		{/snippet}
	</Modal>
{/if}
