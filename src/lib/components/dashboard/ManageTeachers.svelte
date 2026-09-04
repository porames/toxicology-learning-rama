<script lang="ts">
	import { db } from '$lib/firebase';
	import { collection, getDocs, query, where } from 'firebase/firestore';
	import type { Student } from '$lib/dashboard/types';
	import { Table, Modal } from '$lib/components/ui';
	import EditStudentModal from '$lib/components/dashboard/EditStudentModal.svelte';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { t } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';
	import { Pencil, Trash2 } from '@lucide/svelte';
	import moment from 'moment';

	const ROLE_LABELS = $derived<Record<string, string>>({
		student: t('students.roleStudentShort'),
		resident: t('students.roleResidentShort'),
		teacher: t('students.roleTeacherShort'),
		admin: t('students.roleAdminShort'),
	});

	let teachers: Student[] | undefined = $state(undefined);
	let error: string | null = $state(null);
	let editingTeacher: Student | null = $state(null);
	let confirmingDeleteId: string | null = $state(null);
	let deleteError: string | null = $state(null);
	let deleting = $state(false);

	function toDate(value: unknown): Date | null {
		if (!value) return null;
		const ts = value as { toDate?: () => Date };
		if (typeof ts.toDate === 'function') return ts.toDate();
		const d = new Date(value as string | number);
		return isNaN(d.getTime()) ? null : d;
	}

	function fmtDateTime(d?: Date | null): string {
		if (!d || d.getTime() === 0) return '—';
		return moment(d).format('MMM D, YYYY · hh:mm A');
	}

	async function loadTeachers() {
		try {
			error = null;
			const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
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
			teachers = loaded.sort(
				(a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
			);
		} catch (err) {
			error = t('teachers.couldNotLoadTeachers');
			console.error(err);
		}
	}

	$effect(() => {
		loadTeachers();
	});

	async function handleDelete(teacher: Student) {
		deleting = true;
		deleteError = null;
		try {
			const user = authState.user;
			if (!user) throw new Error(t('common.notLoggedIn'));
			const token = await user.getIdToken();

			const res = await fetch(functionsUrl('deleteUser'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ id: teacher.id }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(translateApiError(body?.message));
			}

			confirmingDeleteId = null;
			await loadTeachers();
		} catch (err) {
			confirmingDeleteId = null;
			deleteError = err instanceof Error ? err.message : t('common.somethingWentWrong');
		} finally {
			deleting = false;
		}
	}
</script>

<div class="w-full min-w-0 space-y-8">
	{#if error}
		<div class="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</div>
	{/if}
	{#if deleteError}
		<div class="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{deleteError}</div>
	{/if}

	<section class="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft">
		<div class="flex items-center justify-between border-b border-ink-900/5 px-4 py-3">
			<div>
				<p class="text-[13.5px] font-semibold text-ink-900">
					{t('teachers.registeredTeachers')}
					<span class="ml-1.5 font-normal text-ink-300">({teachers?.length ?? 0})</span>
				</p>
				<p class="text-[12.5px] text-ink-500">{t('teachers.registeredTeachersHint')}</p>
			</div>
		</div>

		<div class="p-3">
			{#if teachers === undefined}
				<div class="flex items-center justify-center gap-2 py-12 text-[12px] text-ink-400">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
					></div>
					{t('common.loading')}
				</div>
			{:else}
				<Table compact>
					{#snippet headers()}
						<th>{t('teachers.timestamp')}</th>
						<th>{t('teachers.fullName')}</th>
						<th>{t('teachers.email')}</th>
						<th>{t('teachers.role')}</th>
						<th>{t('teachers.department')}</th>
						<th>{t('teachers.phoneNumber')}</th>
						<th>{t('teachers.actions')}</th>
					{/snippet}
					{#snippet body()}
						{#if teachers !== undefined && teachers.length === 0}
							<tr>
								<td colspan={7} class="py-6 text-center text-gray-400">
									{t('teachers.noTeachersYetAdd')}
								</td>
							</tr>
						{/if}
						{#each teachers ?? [] as teacher, idx (teacher.id)}
							{@const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
							<tr class={`${rowBg} transition-colors hover:bg-gray-50`}>
								<td class="text-gray-500">{fmtDateTime(teacher.createdAt)}</td>
								<td>{teacher.name}</td>
								<td class="text-gray-500">{teacher.email}</td>
								<td class="text-gray-500">
									{ROLE_LABELS[teacher.role ?? ''] ?? teacher.role}
								</td>
								<td class="text-gray-500">{teacher.department || '—'}</td>
								<td class="text-gray-500">{teacher.phone || '—'}</td>
								<td>
									<div class="my-1 flex items-center gap-2">
										<button
											type="button"
											onclick={() => (editingTeacher = teacher)}
										>
											<Pencil size={16} class="text-gray-600" />
										</button>
										<button
											type="button"
											onclick={() => (confirmingDeleteId = teacher.id)}
										>
											<Trash2 size={16} class="ml-3 text-red-600" />
										</button>
									</div>
								</td>
							</tr>
						{/each}
					{/snippet}
				</Table>
			{/if}
		</div>
	</section>

	{#if editingTeacher}
		<EditStudentModal
			student={editingTeacher}
			onclose={() => (editingTeacher = null)}
			onchanged={loadTeachers}
		/>
	{/if}

	{#if confirmingDeleteId !== null}
		{@const deletingTeacher = teachers?.find((s) => s.id === confirmingDeleteId)}
		<Modal
			open
			title={t('teachers.deleteTeacherTitle')}
			onclose={() => (confirmingDeleteId = null)}
		>
			<p class="text-[13px] text-ink-500">
				{t('teachers.deleteTeacherConfirm', {
					name: deletingTeacher?.name ?? t('teachers.thisTeacher'),
					email: deletingTeacher?.email ?? '',
				})}
			</p>
			{#snippet footer()}
				<button
					type="button"
					onclick={() => (confirmingDeleteId = null)}
					disabled={deleting}
					class="rounded-md border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{t('common.cancel')}
				</button>
				<button
					type="button"
					onclick={() => deletingTeacher && handleDelete(deletingTeacher)}
					disabled={deleting || !deletingTeacher}
					class="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if deleting}
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
</div>
