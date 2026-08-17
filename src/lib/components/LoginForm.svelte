<script lang="ts">
	import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { getAuthErrorMessage } from '$lib/authErrors';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { t } from '$lib/i18n';
	import { Eye, EyeOff, LoaderCircle } from '@lucide/svelte';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);

	async function handleEmailSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		notice = null;
		loading = true;
		try {
			await signInWithEmailAndPassword(auth, email, password);
			goto(`${base}/#/classes`);
			notice = t('auth.signedInRedirecting');
		} catch (err: any) {
			error = getAuthErrorMessage(err?.code ?? '');
		} finally {
			loading = false;
		}
	}

	async function handleForgotPassword() {
		error = null;
		notice = null;
		if (!email) {
			error = t('auth.enterEmailFirst');
			return;
		}
		try {
			await sendPasswordResetEmail(auth, email);
			notice = t('auth.passwordResetSent', { email });
		} catch (err: any) {
			error = getAuthErrorMessage(err?.code ?? '');
		}
	}
</script>

<div class="w-full max-w-[380px]">
	<h2 class="text-[26px] font-semibold tracking-tight text-ink-900">{t('auth.signIn')}</h2>
	<p class="mt-2 text-[14.5px] text-ink-500">{t('auth.signInSubtitle')}</p>

	<form onsubmit={handleEmailSubmit} class="mt-5 space-y-4" novalidate>
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

		<div>
			<div class="mb-1.5 flex items-center justify-between">
				<label for="password" class="block text-[13px] font-medium text-ink-700">
					{t('auth.password')}
				</label>
				<button
					type="button"
					onclick={handleForgotPassword}
					class="text-[13px] font-medium text-iris-600 hover:text-iris-700"
				>
					{t('auth.forgotPassword')}
				</button>
			</div>
			<div class="relative">
				<input
					id="password"
					type={showPassword ? 'text' : 'password'}
					required
					minlength="6"
					autocomplete="current-password"
					bind:value={password}
					placeholder="••••••••"
					class="w-full rounded-lg border border-ink-900/12 bg-white px-3.5 py-2.5 pr-10 text-[14.5px] text-ink-900 placeholder:text-ink-300 transition focus:border-iris-500 focus:ring-4 focus:ring-iris-500/15"
				/>
				<button
					type="button"
					onclick={() => (showPassword = !showPassword)}
					class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500"
					aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
				>
					{#if showPassword}
						<EyeOff class="h-[18px] w-[18px]" />
					{:else}
						<Eye class="h-[18px] w-[18px]" />
					{/if}
				</button>
			</div>
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
			{t('auth.signIn')}
		</button>
	</form>

	<p class="mt-7 text-center text-[14px] text-ink-500">
		{t('auth.dontHavePassword')}
		<button
			type="button"
			onclick={() => goto(`${base}/#/activate`)}
			class="font-medium text-iris-600 hover:text-iris-700"
		>
			{t('auth.activateAccount')}
		</button>
	</p>
</div>
