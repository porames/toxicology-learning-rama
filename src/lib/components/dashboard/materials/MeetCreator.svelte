<script lang="ts">
	import { LoaderCircle, Users, Check } from '@lucide/svelte';
	import { Button, Modal, AsyncSearchDropdown } from '$lib/components/ui';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { db } from '$lib/firebase';
	import { collection, getDocs, query, where } from 'firebase/firestore';
	import type { MeetingHost } from '$lib/dashboard/types';
	import { translateApiError } from '$lib/i18n/apiErrors';
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

	type HostItem = {
		key: string;
		email: string;
		displayName: string;
		role: string;
		source: 'registered' | 'directory';
		photoUrl?: string | null;
		department?: string | null;
	};

	let loadingHosts = $state(false);
	let hosts = $state<HostItem[]>([]);
	let selected = $state<HostItem | null>(null);
	let hostQuery = $state('');
	let hostOpen = $state(false);
	let hostHighlight = $state(0);

	let dirContacts = $state<HostItem[]>([]);
	let dirLoading = $state(false);
	let dirError: string | null = $state(null);
	let dirNeedsReconnect = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let requestSeq = $state(0);

	const selectedHost = $derived(selected);
	const registeredMatches = $derived(
		hostQuery.trim()
			? hosts.filter((h) =>
					`${h.displayName} ${h.email}`
						.toLowerCase()
						.includes(hostQuery.trim().toLowerCase()),
				)
			: hosts,
	);
	const registeredEmails = $derived(
		new Set(hosts.map((h) => h.email.toLowerCase()).filter(Boolean)),
	);
	const dirMatches = $derived(
		dirContacts.filter((c) => {
			const email = c.email.toLowerCase();
			return !email || !registeredEmails.has(email);
		}),
	);
	const mergedHosts = $derived([...registeredMatches, ...dirMatches]);
	const hostLoading = $derived(loadingHosts || dirLoading);

	function onHostInput() {
		if (hostQuery.trim()) hostOpen = true;
		if (debounceTimer) clearTimeout(debounceTimer);
		if (!hostQuery.trim()) {
			dirContacts = [];
			dirError = null;
			dirNeedsReconnect = false;
			return;
		}
		debounceTimer = setTimeout(searchDirectory, 350);
	}

	async function searchDirectory() {
		const q = hostQuery.trim();
		if (!q) return;
		const seq = ++requestSeq;
		dirLoading = true;
		dirError = null;
		dirNeedsReconnect = false;
		hostOpen = true;
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
					if (seq === requestSeq) {
						dirNeedsReconnect = true;
						dirContacts = [];
					}
					return;
				}
				throw new Error(translateApiError(body?.error));
			}
			const data = await res.json();
			if (seq !== requestSeq) return;
			dirContacts = (
				(data.contacts ?? []) as {
					resourceName: string;
					name: string | null;
					email: string | null;
					department?: string | null;
					photoUrl?: string | null;
				}[]
			)
				.filter((c) => c.email)
				.map((c) => ({
					key: c.resourceName || (c.email as string),
					email: c.email as string,
					displayName: c.name ?? (c.email as string),
					role: 'teacher',
					source: 'directory' as const,
					department: c.department ?? null,
					photoUrl: c.photoUrl ?? null,
				}));
			hostHighlight = 0;
		} catch (err) {
			if (seq !== requestSeq) return;
			dirError = err instanceof Error ? err.message : t('common.somethingWentWrong');
		} finally {
			if (seq === requestSeq) dirLoading = false;
		}
	}

	function selectHost(host: HostItem) {
		selected = host;
		hostQuery = host.displayName || host.email;
		hostOpen = false;
		dirError = null;
	}

	async function loadHosts() {
		loadingHosts = true;
		try {
			const snap = await getDocs(
				query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin'])),
			);
			const loaded: HostItem[] = snap.docs.map((d) => {
				const data = d.data();
				return {
					key: d.id,
					email: data.email ?? '',
					displayName: data.displayName ?? data.name ?? '',
					role: data.role ?? '',
					source: 'registered' as const,
				};
			});
			const profile = authState.profile;
			if (profile && !loaded.some((h) => h.key === profile.uid)) {
				loaded.unshift({
					key: profile.uid,
					email: profile.email,
					displayName: profile.name,
					role: profile.role,
					source: 'registered' as const,
				});
			}
			hosts = loaded;
			if (!selected && profile) {
				selected = hosts.find((h) => h.key === profile.uid) ?? hosts[0] ?? null;
			}
			if (!hostQuery && selected) {
				hostQuery = selected.displayName || selected.email;
			}
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
							key: authState.profile.uid,
							email: authState.profile.email,
							displayName: authState.profile.name,
							role: authState.profile.role,
							source: 'registered' as const,
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

		<AsyncSearchDropdown
			items={mergedHosts}
			bind:query={hostQuery}
			bind:open={hostOpen}
			bind:highlightIndex={hostHighlight}
			loading={hostLoading}
			label={t('materials.hostTeacher')}
			placeholder={t('materials.hostTeacher')}
			loadingText={t('common.loading')}
			emptyText={t('materials.noHostsFound')}
			disabled={loadingHosts || hosts.length === 0}
			oninput={onHostInput}
			onselect={selectHost}
		>
			{#each mergedHosts as host, i (host.key)}
				{#if i === 0 && registeredMatches.length > 0 && host.source === 'registered'}
					<li
						aria-hidden="true"
						class="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-300 uppercase"
					>
						{t('materials.registeredHosts')}
					</li>
				{/if}
				{#if dirMatches.length > 0 && i === registeredMatches.length}
					<li
						aria-hidden="true"
						class="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-ink-300 uppercase"
					>
						{t('materials.directoryMatches')}
					</li>
				{/if}
				<li>
					<button
						type="button"
						role="option"
						aria-selected={host.key === selected?.key}
						onclick={() => selectHost(host)}
						onmouseenter={() => (hostHighlight = i)}
						class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[14px] transition {host.key ===
						selected?.key
							? 'bg-iris-50 text-iris-700'
							: i === hostHighlight
								? 'bg-ink-900/[0.04] text-ink-900'
								: 'text-ink-900'}"
					>
						<span
							class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-iris-100 text-[11px] font-semibold text-iris-700"
						>
							{(host.displayName || host.email || '?')
								.trim()
								.charAt(0)
								.toUpperCase() || '?'}
							{#if host.photoUrl}
								<img
									src={host.photoUrl}
									alt=""
									loading="lazy"
									onerror={(e) =>
										((e.currentTarget as HTMLImageElement).style.display =
											'none')}
									class="absolute inset-0 h-full w-full rounded-full object-cover"
								/>
							{/if}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium"
								>{host.displayName || host.email}</span
							>
							<span class="block truncate text-[12px] opacity-70">
								{[host.email, host.department].filter(Boolean).join(' · ') || '—'}
							</span>
						</span>
						{#if host.key === selected?.key}
							<Check class="h-4 w-4 shrink-0" />
						{/if}
					</button>
				</li>
			{/each}
		</AsyncSearchDropdown>
		{#if dirError}
			<p class="text-[12px] text-red-500">{dirError}</p>
		{/if}
		{#if dirNeedsReconnect}
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
