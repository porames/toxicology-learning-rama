<script lang="ts">
	import { Check, LoaderCircle, X } from '@lucide/svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { db } from '$lib/firebase';
	import { collection, getDocs, query, where } from 'firebase/firestore';
	import { translateApiError } from '$lib/i18n/apiErrors';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { t } from '$lib/i18n';

	export type HostPick = {
		key: string;
		email: string;
		displayName: string;
		role: string;
		source: 'registered' | 'directory';
		photoUrl?: string | null;
		department?: string | null;
	};

	interface Props {
		selected?: HostPick | null;
		label?: string;
		hint?: string;
		placeholder?: string;
		disabled?: boolean;
	}

	let {
		selected = $bindable<HostPick | null>(null),
		label = '',
		hint = '',
		placeholder = '',
		disabled = false,
	}: Props = $props();

	let hosts = $state<HostPick[]>([]);
	let loadingHosts = $state(false);
	let hostQuery = $state('');
	let hostOpen = $state(false);
	let highlightIndex = $state(0);
	let root = $state<HTMLDivElement>();

	let dirContacts = $state<HostPick[]>([]);
	let dirLoading = $state(false);
	let dirError: string | null = $state(null);
	let dirNeedsReconnect = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let requestSeq = $state(0);

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
	const merged = $derived([...registeredMatches, ...dirMatches]);
	const loading = $derived(loadingHosts || dirLoading);
	const inputDisabled = $derived(disabled || loadingHosts);

	function onInput() {
		highlightIndex = 0;
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

	function onFocus() {
		if (hostQuery.trim() && (merged.length > 0 || loading)) hostOpen = true;
	}

	function onClearQuery() {
		highlightIndex = 0;
		dirContacts = [];
		dirError = null;
		dirNeedsReconnect = false;
	}

	function clearSelected() {
		selected = null;
		hostQuery = '';
		dirContacts = [];
		dirError = null;
		dirNeedsReconnect = false;
		hostOpen = true;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!hostOpen) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightIndex = Math.min(highlightIndex + 1, Math.max(merged.length - 1, 0));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightIndex = Math.max(highlightIndex - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const item = merged[highlightIndex];
			if (item !== undefined) select(item);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			hostOpen = false;
		}
	}

	function onOutside(e: PointerEvent) {
		if (root && !root.contains(e.target as Node)) hostOpen = false;
	}

	function select(item: HostPick) {
		selected = item;
		hostQuery = item.displayName || item.email;
		hostOpen = false;
		dirError = null;
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
			highlightIndex = 0;
		} catch (err) {
			if (seq !== requestSeq) return;
			dirError = err instanceof Error ? err.message : t('common.somethingWentWrong');
		} finally {
			if (seq === requestSeq) dirLoading = false;
		}
	}

	async function loadHosts() {
		loadingHosts = true;
		try {
			const snap = await getDocs(
				query(collection(db, 'users'), where('role', 'in', ['teacher', 'admin'])),
			);
			const loaded: HostPick[] = snap.docs.map((d) => {
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

	$effect(() => {
		loadHosts();
	});
</script>

<svelte:window onpointerdown={onOutside} />

<div bind:this={root} class="relative">
	{#if label}
		<span class="mb-1.5 block text-[13px] font-medium text-ink-700">{label}</span>
	{/if}

	<SearchInput
		bind:value={hostQuery}
		{placeholder}
		{loading}
		disabled={inputDisabled}
		oninput={onInput}
		onkeydown={onKeydown}
		onfocus={onFocus}
		onclear={onClearQuery}
	/>

	{#if selected}
		<div
			class="mt-2 flex items-center gap-2.5 rounded-xl border border-iris-200 bg-iris-50 px-3 py-2"
		>
			<span
				class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-iris-600 text-[12px] font-semibold text-white"
			>
				{(selected.displayName || selected.email || '?').trim().charAt(0).toUpperCase() ||
					'?'}
				{#if selected.photoUrl}
					<img
						src={selected.photoUrl}
						alt=""
						loading="lazy"
						onerror={(e) =>
							((e.currentTarget as HTMLImageElement).style.display = 'none')}
						class="absolute inset-0 h-full w-full rounded-full object-cover"
					/>
				{/if}
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-[13.5px] font-semibold text-ink-900">
					{selected.displayName || selected.email}
				</span>
				<span class="block truncate text-[12px] text-ink-500">
					{[selected.email, selected.department].filter(Boolean).join(' · ') || '—'}
				</span>
			</span>
			<span
				class="shrink-0 rounded-full bg-iris-600/10 px-2 py-0.5 text-[10.5px] font-semibold text-iris-700"
			>
				{selected.source === 'registered'
					? t('materials.registeredHosts')
					: t('materials.directoryMatches')}
			</span>
			<button
				type="button"
				onclick={clearSelected}
				aria-label={t('materials.clearHost')}
				class="shrink-0 rounded-full p-1 text-iris-400 transition hover:bg-iris-600/10 hover:text-iris-700"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/if}

	{#if hostOpen}
		<div
			class="absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-ink-900/12 bg-white shadow-lg"
		>
			{#if loading}
				<div
					class="flex items-center justify-center gap-2 px-3 py-5 text-[12.5px] text-ink-400"
				>
					<LoaderCircle class="h-4 w-4 animate-spin text-iris-500" />
					{t('common.loading')}
				</div>
			{:else if merged.length === 0}
				<div class="px-3 py-3 text-[12.5px] text-ink-400">
					{t('materials.noHostsFound')}
				</div>
			{:else}
				<ul class="max-h-72 overflow-y-auto py-1">
					{#each merged as host, i (host.key)}
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
								onclick={() => select(host)}
								onmouseenter={() => (highlightIndex = i)}
								class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[14px] transition {host.key ===
								selected?.key
									? 'bg-iris-50 text-iris-700'
									: i === highlightIndex
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
												((
													e.currentTarget as HTMLImageElement
												).style.display = 'none')}
											class="absolute inset-0 h-full w-full rounded-full object-cover"
										/>
									{/if}
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate font-medium"
										>{host.displayName || host.email}</span
									>
									<span class="block truncate text-[12px] opacity-70">
										{[host.email, host.department]
											.filter(Boolean)
											.join(' · ') || '—'}
									</span>
								</span>
								{#if host.key === selected?.key}
									<Check class="h-4 w-4 shrink-0" />
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	{#if dirError}
		<p class="mt-1 text-[12px] text-red-500">{dirError}</p>
	{:else if hint}
		<p class="mt-1 text-[12.5px] text-ink-500">{hint}</p>
	{/if}
	{#if dirNeedsReconnect}
		<p class="mt-1 text-[12px] text-amber-600">
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
</div>
