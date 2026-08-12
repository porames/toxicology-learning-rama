<script lang="ts">
	import { sendPasswordResetEmail } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { functionsUrl } from '$lib/functionsUrl';
	import { getAuthErrorMessage } from '$lib/authErrors';
	import { translateApiError } from '$lib/i18n/apiErrors';
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n';
	import { LoaderCircle } from '@lucide/svelte';

	let email = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);

	async function handleActivate(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		notice = null;
		loading = true;
		try {
			const res = await fetch(functionsUrl('activate'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim() }),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.error || t('auth.failedToActivate'));
			}
			await sendPasswordResetEmail(auth, email.trim());
			notice = t('auth.activationEmailSent', { email: email.trim() });
		} catch (err: any) {
			error = err?.code
				? getAuthErrorMessage(err.code)
				: translateApiError(err?.message) || t('common.somethingWentWrong');
		} finally {
			loading = false;
		}
	}
</script>

<div class="w-full max-w-[380px]">
	<h2 class="text-[26px] font-semibold tracking-tight text-ink-900">
		{t('auth.activateAccount')}
	</h2>
	<p class="mt-2 text-[14.5px] text-ink-500">
		{t('auth.activateSubtitle')}
	</p>

	<form onsubmit={handleActivate} class="mt-5 space-y-4" novalidate>
		<div>
			<label for="email" class="mb-1.5 block text-[13px] font-medium text-ink-700">
				{t('auth.emailAddress')}
			</label>
			<input
				id="email"
				type="email"
				required
				autocomplete="email"
				bind:value={email}
				placeholder={t('auth.emailPlaceholder')}
				class="w-full rounded-lg border border-ink-900/12 bg-white px-3.5 py-2.5 text-[14.5px] text-ink-900 placeholder:text-ink-300 transition focus:border-iris-500 focus:ring-4 focus:ring-iris-500/15"
			/>
		</div>

		{#if error}
			<div
				class="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13.5px] text-red-700"
			>
				{error}
			</div>
		{/if}
		{#if notice}
			<div
				class="rounded-lg border border-mesh-teal/30 bg-mesh-teal/10 px-3.5 py-2.5 text-[13.5px] text-emerald-700"
			>
				{notice}
			</div>
		{/if}

		<button
			type="submit"
			disabled={loading}
			class="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 py-2.5 text-[14.5px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
		>
			{#if loading}
				<LoaderCircle class="h-4 w-4 animate-spin text-white" />
			{/if}
			{t('auth.activate')}
		</button>
	</form>

	<p class="mt-7 text-center text-[14px] text-ink-500">
		{t('auth.alreadyHavePassword')}
		<button
			type="button"
			onclick={() => goto('/')}
			class="font-medium text-iris-600 hover:text-iris-700"
		>
			{t('auth.goToSignIn')}
		</button>
	</p>
</div>
