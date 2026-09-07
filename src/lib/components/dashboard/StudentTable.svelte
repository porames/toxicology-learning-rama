<script lang="ts">
	import { Pencil, Trash2, UserPlus } from '@lucide/svelte';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import type { Student } from '$lib/dashboard/types';
	import { Modal, Table } from '$lib/components/ui';
	import EditStudentModal from '$lib/components/dashboard/EditStudentModal.svelte';
	import { t } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';
	import moment from 'moment';

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

	function fmtDateTime(d?: Date | null): string {
		if (!d || d.getTime() === 0) return '—';
		return moment(d).format('MMM D, YYYY · hh:mm A');
	}

	function fmtDay(d?: Date | null): string {
		if (!d || d.getTime() === 0) return '—';
		return moment(d).format('MMM D, YYYY');
	}

	let {
		students,
		onChanged,
		onEnrol,
	}: {
		students: Student[] | undefined;
		onChanged?: () => void;
		onEnrol: (student: Student) => void;
	} = $props();

	let editingStudent: Student | null = $state(null);
	let confirmingDeleteId: string | null = $state(null);
	let editDeleting = $state(false);
	let editError: string | null = $state(null);

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

<Table compact nowrap minWidth="1100px">
	{#snippet headers()}
		<th>{t('students.enrol')}</th>
		<th>{t('students.timestamp')}</th>
		<th>{t('students.fullName')}</th>
		<th>{t('students.email')}</th>
		<th>{t('students.role')}</th>
		<th>{t('students.electiveStart')}</th>
		<th>{t('students.electiveEnd')}</th>
		<th>{t('students.hospital')}</th>
		<th>{t('students.actions')}</th>
	{/snippet}
	{#snippet body()}
		{#if students !== undefined && students.length === 0}
			<tr>
				<td colspan={9} class="py-6 text-center text-gray-400">
					{t('students.noStudentsYetAdd')}
				</td>
			</tr>
		{/if}

		{#if students !== undefined}
			{#each students as student, idx (student.id)}
				{@const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
				<tr class={`${rowBg} transition-colors hover:bg-gray-50`}>
					<td>
						<button
							type="button"
							aria-label={t('students.enrolAria', { name: student.name })}
							onclick={() => onEnrol(student)}
							class="inline-flex items-center gap-1 rounded-md bg-gradient-to-b from-iris-500 to-iris-700 px-2 py-1 text-xs my-0.5 font-semibold text-white transition hover:from-iris-500 hover:to-iris-800"
						>
							<UserPlus size={13} />
							{t('students.enrol')}
						</button>
					</td>
					<td class="text-gray-500">{fmtDateTime(student.createdAt)}</td>
					<td>{student.name}</td>
					<td class="text-gray-500">{student.email}</td>
					<td class="text-gray-500">
						{ROLE_LABELS[student.role ?? ''] ?? student.role}
					</td>
					<td class="text-gray-500">{fmtDay(student.electiveStart)}</td>
					<td class="text-gray-500">{fmtDay(student.electiveEnd)}</td>
					<td class="text-gray-500">{student.hospital || '—'}</td>
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
