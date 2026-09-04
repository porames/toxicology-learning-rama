<script lang="ts">
	import { Check, LoaderCircle, ExternalLink } from '@lucide/svelte';
	import GoogleMeetIcon from '$lib/components/GoogleMeetIcon.svelte';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { t } from '$lib/i18n';

	let connected = $state(false);
	let loading = $state(true);
	let connecting = $state(false);
	let banner = $state<'success' | 'error' | null>(null);
	let error = $state('');

	async function loadStatus() {
		loading = true;
		try {
			const token = await authState.user?.getIdToken();
			const res = await fetch(functionsUrl('meetOAuthStatus'), {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			connected = !!data.connected;
		} catch (err) {
			console.error(err);
		} finally {
			loading = false;
		}
	}

	async function connect() {
		connecting = true;
		error = '';
		try {
			const token = await authState.user?.getIdToken();
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
			error = t('settings.meetConnectError');
			connecting = false;
		}
	}

	$effect(() => {
		if (authState.profile) loadStatus();
	});

	$effect(() => {
		const m = page.url.searchParams.get('meet');
		if (m === 'success' || m === 'error') {
			banner = m;
			loadStatus();
			goto(`${base}/settings`, { replaceState: true });
		}
	});
</script>

<div class="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft">
	<div class="flex items-center gap-3 border-b border-ink-900/8 px-5 py-4">
		<span
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"
		>
			<GoogleMeetIcon class="h-5 w-5" />
		</span>
		<div class="min-w-0">
			<h2 class="text-sm font-semibold text-ink-900">{t('settings.googleMeet')}</h2>
			<p class="text-xs text-ink-500">{t('settings.googleMeetDescription')}</p>
		</div>
	</div>

	<div class="p-5">
		{#if banner === 'success'}
			<p class="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-emerald-600">
				<Check class="h-4 w-4" />
				{t('settings.meetConnected')}
			</p>
		{:else if banner === 'error'}
			<p class="mb-3 text-[13px] font-medium text-red-600">
				{t('settings.meetConnectError')}
			</p>
		{/if}

		{#if loading}
			<div class="flex items-center gap-2 text-[13px] text-ink-500">
				<LoaderCircle class="h-4 w-4 animate-spin" />
				{t('common.loading')}
			</div>
		{:else if connected}
			<div class="flex items-center justify-between">
				<span class="flex items-center gap-1.5 text-[13px] font-medium text-emerald-600">
					<Check class="h-4 w-4" />
					{t('settings.meetConnected')}
				</span>
				<button
					type="button"
					onclick={connect}
					disabled={connecting}
					class="rounded-lg border border-ink-900/15 px-3 py-1.5 text-[12.5px] font-medium text-ink-700 transition hover:bg-ink-900/[0.03] disabled:opacity-50"
				>
					{t('settings.meetReconnect')}
				</button>
			</div>
		{:else}
			<button
				type="button"
				onclick={connect}
				disabled={connecting}
				class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-700 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:from-emerald-500 hover:to-emerald-800 disabled:opacity-60"
			>
				{#if connecting}
					<LoaderCircle class="h-4 w-4 animate-spin" />
					{t('settings.meetConnecting')}
				{:else}
					<ExternalLink class="h-4 w-4" />
					{t('settings.connectGoogleMeet')}
				{/if}
			</button>
		{/if}

		{#if error}
			<p class="mt-2 text-[12px] text-red-500">{error}</p>
		{/if}
	</div>
</div>
