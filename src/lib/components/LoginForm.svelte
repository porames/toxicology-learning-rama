<script lang="ts">
	import { signInWithPopup, signOut } from 'firebase/auth';
	import { auth, googleProvider } from '$lib/firebase';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { getAuthErrorMessage } from '$lib/authErrors';
	import { translateApiError } from '$lib/i18n/apiErrors';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { t } from '$lib/i18n';
	import { LoaderCircle } from '@lucide/svelte';

	let loading = $state(false);
	let error = $state<string | null>(null);

	async function handleGoogleSignIn() {
		error = null;
		loading = true;
		try {
			const result = await signInWithPopup(auth, googleProvider);
			const user = result.user;
			const token = await user.getIdToken();

			const res = await fetch(functionsUrl('googleSignIn'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				await signOut(auth);
				throw new Error(body?.error || t('auth.notEnrolled'));
			}

			const data = await res.json();
			if (data.pendingTeacher || data.role === 'teacher') {
				await user.getIdToken(true);
				await authState.refreshProfile();
				goto(`${base}/dashboard`);
				return;
			}
			if (!data.enrolled) {
				goto(`${base}/signup`);
				return;
			}

			await user.getIdToken(true);
			await authState.refreshProfile();
			goto(`${base}/classes`);
		} catch (err: any) {
			if (err?.code) {
				error = getAuthErrorMessage(err.code);
			} else {
				error = translateApiError(err?.message) || t('common.somethingWentWrong');
			}
		} finally {
			loading = false;
		}
	}
</script>

<div class="w-full max-w-[380px]">
	<h2 class="text-[26px] font-semibold tracking-tight text-ink-900">{t('auth.signIn')}</h2>
	<p class="mt-2 text-[14.5px] text-ink-500">{t('auth.signInSubtitle')}</p>

	<button
		type="button"
		onclick={handleGoogleSignIn}
		disabled={loading}
		class="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-ink-900/15 bg-white px-3.5 py-2.5 text-[14.5px] font-semibold text-ink-800 transition hover:bg-ink-900/[0.03] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
	>
		{#if loading}
			<LoaderCircle class="h-4 w-4 animate-spin text-ink-500" />
		{:else}
			<svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" aria-hidden="true">
				<path
					fill="#4285F4"
					d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87Z"
				/>
				<path
					fill="#34A853"
					d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
				/>
				<path
					fill="#FBBC05"
					d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.63H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.37l3.98-3.09Z"
				/>
				<path
					fill="#EA4335"
					d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.29 6.63l3.98 3.09C6.22 6.87 8.87 4.76 12 4.76Z"
				/>
			</svg>
		{/if}
		{t('auth.signInWithGoogle')}
	</button>

	{#if error}
		<div
			class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13.5px] text-red-700"
		>
			{error}
		</div>
	{/if}

	<p class="mt-7 text-center text-[14px] text-ink-500">
		<button
			type="button"
			onclick={() => goto(`${base}/login`)}
			class="font-medium text-ink-400 hover:text-iris-700"
		>
			{t('auth.staffLogin')}
		</button>
	</p>
</div>
