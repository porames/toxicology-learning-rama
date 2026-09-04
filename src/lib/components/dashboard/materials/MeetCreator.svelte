<script lang="ts">
	import { LoaderCircle, Users } from '@lucide/svelte';
	import { Button, Modal, SearchableSelect } from '$lib/components/ui';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { db } from '$lib/firebase';
	import { collection, getDocs, query, where } from 'firebase/firestore';
	import type { MeetingHost } from '$lib/dashboard/types';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import moment from 'moment';
	import { t } from '$lib/i18n';

	let {
		classId,
		title,
		startTime,
		endTime,
		onClose,
		onCreated,
	}: {
		classId?: string;
		title?: string;
		startTime?: Date;
		endTime?: Date;
		onClose: () => void;
		onCreated: (meetingUri: string, host?: MeetingHost) => void;
	} = $props();

	let loadingInvitees = $state(false);
	let invitees = $state<{ name: string; email: string }[]>([]);
	let creating = $state(false);
	let error = $state('');
	let needsConnect = $state(false);

	let loadingHosts = $state(false);
	let hosts = $state<{ id: string; email: string; displayName: string; role: string }[]>([]);
	let hostUid = $state(authState.profile?.uid ?? '');

	const hostOptions = $derived(hosts.map((h) => ({ value: h.id, label: h.displayName || h.id })));
	const selectedHost = $derived(hosts.find((h) => h.id === hostUid));

	async function loadHosts() {
		loadingHosts = true;
		try {
			const snap = await getDocs(
				query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin'])),
			);
			const loaded = snap.docs.map((d) => {
				const data = d.data();
				return {
					id: d.id,
					email: data.email ?? '',
					displayName: data.displayName ?? data.name ?? '',
					role: data.role ?? '',
				};
			});
			const profile = authState.profile;
			if (profile && !loaded.some((h) => h.id === profile.uid)) {
				loaded.unshift({
					id: profile.uid,
					email: profile.email,
					displayName: profile.name,
					role: profile.role,
				});
			}
			hosts = loaded;
			if (!hostUid && profile) hostUid = profile.uid;
		} catch (err) {
			console.error(err);
			hosts = [];
		} finally {
			loadingHosts = false;
		}
	}

	async function loadInvitees() {
		if (!classId) return;
		loadingInvitees = true;
		invitees = [];
		try {
			const user = authState.user;
			const token = await user?.getIdToken();
			const res = await fetch(functionsUrl('getMeetInvitees'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ classId }),
			});
			const data = await res.json();
			invitees = data.invitees ?? [];
		} catch (err) {
			console.error(err);
			invitees = [];
		} finally {
			loadingInvitees = false;
		}
	}

	$effect(() => {
		loadHosts();
	});

	$effect(() => {
		loadInvitees();
	});

	async function confirm() {
		creating = true;
		error = '';
		needsConnect = false;
		try {
			const user = authState.user;
			if (!user) throw new Error('Not signed in');
			const token = await user.getIdToken();
			const res = await fetch(functionsUrl('createMeetSpace'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ classId, title, startTime, endTime }),
			});
			const data = await res.json();
			if (data.error === 'connect_google_meet') {
				needsConnect = true;
				return;
			}
			if (!res.ok || !data.meetingUri) {
				throw new Error(data.error || 'Failed to create meeting');
			}
			const host =
				selectedHost ??
				(authState.profile
					? {
							id: authState.profile.uid,
							email: authState.profile.email,
							displayName: authState.profile.name,
							role: authState.profile.role,
						}
					: undefined);
			onCreated(
				data.meetingUri,
				host
					? { email: host.email, displayName: host.displayName, role: host.role }
					: undefined,
			);
		} catch (err) {
			console.error(err);
			error = t('materials.couldNotCreateMeet');
		} finally {
			creating = false;
		}
	}
</script>

<Modal open title={t('materials.confirmCreateMeet')} onclose={onClose} class="max-w-md">
	<div class="space-y-3">
		<div class="rounded-lg bg-ink-900/[0.03] px-3 py-2">
			<p class="text-[13px] font-semibold text-ink-900">
				{title || t('common.untitledLecture')}
			</p>
			<p class="text-[12px] text-ink-500">
				{moment(startTime).format('ddd, MMM D · hh:mm A')} – {moment(endTime).format(
					'hh:mm A',
				)}
			</p>
		</div>

		<SearchableSelect
			label={t('materials.hostTeacher')}
			hint={t('materials.hostTeacherHint')}
			options={hostOptions}
			bind:value={hostUid}
			placeholder={t('materials.hostTeacher')}
			disabled={loadingHosts || hosts.length === 0}
			compact
		/>

		<p class="text-[12.5px] font-medium text-ink-600">{t('materials.inviteesHint')}</p>

		{#if loadingInvitees}
			<div class="flex items-center gap-2 text-[12.5px] text-ink-500">
				<LoaderCircle class="h-4 w-4 animate-spin" />
				{t('common.loading')}
			</div>
		{:else if invitees.length === 0}
			<p class="text-[12.5px] text-amber-600">{t('materials.noStudentsToInvite')}</p>
		{:else}
			<ul
				class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-ink-900/10 px-3 py-2"
			>
				{#each invitees as inv (inv.email)}
					<li class="flex items-center gap-2 text-[12.5px]">
						<Users class="h-3.5 w-3.5 shrink-0 text-ink-300" />
						<span class="truncate font-medium text-ink-900"
							>{inv.name || inv.email}</span
						>
						<span class="truncate text-ink-400">{inv.email}</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if needsConnect}
			<p class="text-[12px] text-amber-600">
				{t('materials.meetConnectRequired')}
				<button
					type="button"
					onclick={() => goto(`${base}/settings`)}
					class="ml-1 font-medium underline hover:text-amber-700"
				>
					{t('nav.settings')}
				</button>
			</p>
		{/if}
		{#if error}
			<p class="text-[12px] text-red-500">{error}</p>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={onClose} disabled={creating}>
			{t('common.cancel')}
		</Button>
		<Button variant="accent" onclick={confirm} disabled={creating || loadingInvitees}>
			{#if creating}
				<LoaderCircle class="h-4 w-4 animate-spin" />
				{t('materials.creatingMeet')}
			{:else}
				{t('materials.confirmAndInvite')}
			{/if}
		</Button>
	{/snippet}
</Modal>
