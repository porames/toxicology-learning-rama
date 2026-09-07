<script lang="ts">
	import { db } from '$lib/firebase';
	import { collection, getDocs, query, where } from 'firebase/firestore';
	import type { Student } from '$lib/dashboard/types';
	import { Table, Modal, AsyncSearchDropdown } from '$lib/components/ui';
	import EditStudentModal from '$lib/components/dashboard/EditStudentModal.svelte';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { t } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';
	import { Pencil, Trash2, LoaderCircle, ExternalLink, Plus, Check } from '@lucide/svelte';
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

	type DirectoryContact = {
		resourceName: string;
		name: string | null;
		email: string | null;
		photoUrl: string | null;
	};
	let directoryContacts: DirectoryContact[] | undefined = $state(undefined);
	let directoryQuery = $state('');
	let directoryLoading = $state(false);
	let directoryError: string | null = $state(null);
	let needReconnect = $state(false);
	let connectingGoogle = $state(false);
	let addingEmail: string | null = $state(null);
	let addedEmails: Set<string> = $state(new Set());
	let addError: string | null = $state(null);
	let inviteNotice: string | null = $state(null);
	let confirmingAddContact: DirectoryContact | null = $state(null);
	let dropdownOpen = $state(false);
	let highlightIndex = $state(0);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	const teacherEmails = $derived(
		new Set((teachers ?? []).map((s: Student) => (s.email ?? '').toLowerCase())),
	);

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

	function initials(name: string | null): string {
		const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '?';
		return parts
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '')
			.join('');
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
					signedUp: data.signedUp ?? true,
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

	async function searchDirectory() {
		const q = directoryQuery.trim();
		if (!q) {
			directoryContacts = undefined;
			dropdownOpen = false;
			return;
		}
		directoryLoading = true;
		directoryError = null;
		addError = null;
		inviteNotice = null;
		needReconnect = false;
		dropdownOpen = true;
		try {
			const user = authState.user;
			if (!user) throw new Error(t('common.notLoggedIn'));
			const token = await user.getIdToken();

			const res = await fetch(functionsUrl('getPeopleDirectory'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ query: q }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				if (body?.error === 'connect_google_meet') {
					needReconnect = true;
					directoryContacts = undefined;
					dropdownOpen = false;
					throw new Error(t('teachers.connectGoogleDirectory'));
				}
				throw new Error(translateApiError(body?.error));
			}

			const data = await res.json();
			directoryContacts = data.contacts ?? [];
			highlightIndex = 0;
		} catch (err) {
			directoryError = err instanceof Error ? err.message : t('teachers.loadDirectoryError');
		} finally {
			directoryLoading = false;
		}
	}

	function onQueryInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (!directoryQuery.trim()) {
			directoryContacts = undefined;
			dropdownOpen = false;
			return;
		}
		debounceTimer = setTimeout(searchDirectory, 350);
	}

	async function handleAddTeacher(contact: DirectoryContact) {
		if (!contact.email) return;
		addingEmail = contact.email;
		addError = null;
		try {
			const user = authState.user;
			if (!user) throw new Error(t('common.notLoggedIn'));
			const token = await user.getIdToken();

			const res = await fetch(functionsUrl('inviteTeacher'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					email: contact.email,
					name: contact.name ?? contact.email,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				if (body?.error === 'connect_google_meet') {
					needReconnect = true;
					throw new Error(t('teachers.connectGoogleDirectory'));
				}
				const msg = translateApiError(body?.error);
				if (/already in use/i.test(body?.error ?? '')) {
					throw new Error(t('teachers.addTeacherErrorExists'));
				}
				throw new Error(msg);
			}

			addedEmails = new Set(addedEmails).add(contact.email);
			inviteNotice = t('teachers.inviteSent', {
				name: contact.name ?? contact.email,
				email: contact.email,
			});
			await loadTeachers();
			confirmingAddContact = null;
		} catch (err) {
			addError = err instanceof Error ? err.message : t('common.somethingWentWrong');
		} finally {
			addingEmail = null;
		}
	}

	async function connectGoogle() {
		connectingGoogle = true;
		try {
			const user = authState.user;
			if (!user) throw new Error(t('common.notLoggedIn'));
			const token = await user.getIdToken();

			const res = await fetch(functionsUrl('meetOAuthUrl'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({}),
			});
			const data = await res.json();
			if (!res.ok || !data.url) throw new Error(data.error || 'failed');
			window.location.href = data.url;
		} catch (err) {
			console.error(err);
			directoryError = t('settings.meetConnectError');
			connectingGoogle = false;
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

	<section class="rounded-xl border border-ink-900/10 bg-white shadow-soft">
		<div class="flex items-center justify-between border-b border-ink-900/5 px-4 py-3">
			<div>
				<p class="text-[13.5px] font-semibold text-ink-900">
					{t('teachers.registeredTeachers')}
					<span class="ml-1.5 font-normal text-ink-300">({teachers?.length ?? 0})</span>
				</p>
				<p class="text-[12.5px] text-ink-500">{t('teachers.registeredTeachersHint')}</p>
			</div>
		</div>

		<div class="border-b border-ink-900/5 px-4 py-3">
			{#if !needReconnect}
				<AsyncSearchDropdown
					bind:query={directoryQuery}
					bind:open={dropdownOpen}
					bind:highlightIndex
					items={directoryContacts ?? []}
					loading={directoryLoading}
					placeholder={t('teachers.directorySearchPlaceholder')}
					loadingText={t('teachers.loadingDirectory')}
					emptyText={t('teachers.directoryEmpty')}
					oninput={onQueryInput}
					onselect={(contact) => (confirmingAddContact = contact)}
				>
					{#each directoryContacts ?? [] as contact, i (contact.resourceName)}
						{@const email = (contact.email ?? '').toLowerCase()}
						{@const isTeacher = teacherEmails.has(email)}
						{@const isAdded = addedEmails.has(contact.email ?? '')}
						{@const adding = addingEmail === contact.email}
						{@const disabled = !contact.email || isTeacher || isAdded || adding}
						<li>
							<button
								type="button"
								onclick={() => (confirmingAddContact = contact)}
								onmouseenter={() => (highlightIndex = i)}
								{disabled}
								class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition {disabled
									? 'cursor-not-allowed opacity-60'
									: i === highlightIndex
										? 'bg-ink-900/[0.05]'
										: 'hover:bg-ink-900/[0.03]'}"
							>
								<span
									class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-iris-100 text-[11px] font-semibold text-iris-700"
								>
									{initials(contact.name)}
									{#if contact.photoUrl}
										<img
											src={contact.photoUrl}
											alt=""
											loading="lazy"
											onerror={(e) =>
												((
													e.currentTarget as HTMLImageElement
												).style.display = 'none')}
											class="absolute inset-0 h-full w-full rounded-full object-cover"
										/>
									{/if}
								</span>
								<span class="min-w-0 flex-1">
									<span
										class="block truncate text-[13.5px] font-medium text-ink-900"
									>
										{contact.name || '—'}
									</span>
									<span class="block truncate text-[12px] text-ink-500">
										{contact.email || '—'}
									</span>
								</span>
								<span
									class="inline-flex shrink-0 items-center gap-1 rounded-md bg-iris-600 px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition {adding
										? ''
										: 'hover:bg-iris-700 active:scale-[0.98]'}"
								>
									{#if adding}
										<LoaderCircle class="h-3 w-3 animate-spin" />
										{t('teachers.addingTeacher')}
									{:else if isTeacher}
										<Check class="h-3 w-3" />
										{t('teachers.alreadyTeacher')}
									{:else if isAdded}
										<Check class="h-3 w-3" />
										{t('teachers.addedTeacher')}
									{:else}
										<Plus class="h-3 w-3" />
										{t('teachers.addTeacher')}
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</AsyncSearchDropdown>
			{/if}

			{#if needReconnect}
				<div
					class="mt-3 flex flex-col items-start gap-3 rounded-lg bg-amber-50 px-3 py-4 text-[13px] text-ink-700"
				>
					<div class="flex items-center gap-2 font-medium">
						<ExternalLink class="h-4 w-4 text-iris-600" />
						{t('teachers.connectGoogleDirectory')}
					</div>
					<p class="text-[12.5px] text-ink-500">
						{t('teachers.connectGoogleDirectoryHint')}
					</p>
					<button
						type="button"
						onclick={connectGoogle}
						disabled={connectingGoogle}
						class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:from-iris-500 hover:to-iris-800 disabled:opacity-60"
					>
						{#if connectingGoogle}
							<LoaderCircle class="h-4 w-4 animate-spin" />
							{t('teachers.reconnecting')}
						{:else}
							<ExternalLink class="h-4 w-4" />
							{t('teachers.connectGoogle')}
						{/if}
					</button>
				</div>
			{/if}
			{#if directoryError && !needReconnect}
				<div class="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12.5px] text-red-600">
					{directoryError}
				</div>
			{/if}
			{#if inviteNotice}
				<div class="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">
					{inviteNotice}
				</div>
			{/if}
			{#if addError}
				<div class="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12.5px] text-red-600">
					{addError}
				</div>
			{/if}
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
								<td>
									<span class="flex items-center gap-2">
										{teacher.name}
										{#if !teacher.signedUp}
											<span
												class="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700"
											>
												{t('teachers.invited')}
											</span>
										{/if}
									</span>
								</td>
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

	{#if confirmingAddContact}
		{@const contact = confirmingAddContact}
		<Modal
			open
			title={t('teachers.addTeacherConfirmTitle')}
			onclose={() => {
				if (!addingEmail) confirmingAddContact = null;
			}}
		>
			<div class="flex items-center gap-3">
				<span
					class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-iris-100 text-[13px] font-semibold text-iris-700"
				>
					{initials(contact.name)}
					{#if contact.photoUrl}
						<img
							src={contact.photoUrl}
							alt=""
							loading="lazy"
							onerror={(e) =>
								((e.currentTarget as HTMLImageElement).style.display = 'none')}
							class="absolute inset-0 h-full w-full rounded-full object-cover"
						/>
					{/if}
				</span>
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold text-ink-900">{contact.name || '—'}</p>
					<p class="truncate text-[12.5px] text-ink-500">{contact.email || '—'}</p>
				</div>
			</div>
			<p class="mt-3 text-[13px] text-ink-500">
				{t('teachers.addTeacherConfirm', {
					name: contact.name ?? t('teachers.thisTeacher'),
					email: contact.email ?? '',
				})}
			</p>
			{#if addError}
				<div class="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12.5px] text-red-600">
					{addError}
				</div>
			{/if}
			{#snippet footer()}
				<button
					type="button"
					onclick={() => (confirmingAddContact = null)}
					disabled={addingEmail !== null}
					class="rounded-md border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{t('common.cancel')}
				</button>
				<button
					type="button"
					onclick={() => handleAddTeacher(contact)}
					disabled={addingEmail !== null || !contact.email}
					class="inline-flex items-center gap-1.5 rounded-md bg-iris-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-iris-700 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if addingEmail === contact.email}
						<div
							class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></div>
						{t('teachers.addingTeacher')}
					{:else}
						{t('teachers.addTeacher')}
					{/if}
				</button>
			{/snippet}
		</Modal>
	{/if}
</div>
