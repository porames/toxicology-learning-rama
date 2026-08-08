<script lang="ts">
	import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
	import { auth } from '$lib/firebase';
	import { functionsUrl } from '$lib/functionsUrl';
	import { getAuthErrorMessage } from '$lib/authErrors';
	import { goto } from '$app/navigation';
	import { Eye, EyeOff, LoaderCircle } from '@lucide/svelte';

	type Mode = 'sign-in' | 'sign-up';

	let mode = $state<Mode>('sign-in');
	let email = $state('');
	let password = $state('');
	let ramaId = $state('');
	let showPassword = $state(false);
	let loading = $state<'email' | 'google' | null>(null);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);

	let isSignUp = $derived(mode === 'sign-up');

	async function handleEmailSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		notice = null;
		loading = 'email';
		try {
			if (isSignUp) {
				const res = await fetch(functionsUrl('signUp'), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						email: email,
						rama_id: ramaId,
						pw: password,
					}),
				});
				if (!res.ok) {
					const body = await res.json().catch(() => null);
					throw new Error(body?.message || 'Failed to sign up');
				}
				ramaId = '';
				email = '';
				password = '';
			} else {
				await signInWithEmailAndPassword(auth, email, password);
				goto('/classes');
			}
			notice = isSignUp ? 'Account created.' : 'Signed in. Redirecting…';
		} catch (err: any) {
			error = getAuthErrorMessage(err?.code ?? '');
		} finally {
			loading = null;
		}
	}

	async function handleForgotPassword() {
		error = null;
		notice = null;
		if (!email) {
			error = 'Enter your email above first, then click \u201cForgot password\u201d.';
			return;
		}
		try {
			await sendPasswordResetEmail(auth, email);
			notice = `Password reset email sent to ${email}.`;
		} catch (err: any) {
			error = getAuthErrorMessage(err?.code ?? '');
		}
	}
</script>

<div class="w-full max-w-[380px]">
	<h2 class="text-[26px] font-semibold tracking-tight text-ink-900">
		{isSignUp ? 'Create your account' : 'Sign in'}
	</h2>
	<p class="mt-2 text-[14.5px] text-ink-500">
		{isSignUp ? 'ลงทะเบียนกรณียังไม่มีรหัสผ่าน' : 'เข้าสู่ระบบ'}
	</p>

	<form onsubmit={handleEmailSubmit} class="mt-5 space-y-4" novalidate>
		<div>
			<label for="email" class="mb-1.5 block text-[13px] font-medium text-ink-700">
				Email address
			</label>
			<input
				id="email"
				type="email"
				required
				autocomplete="email"
				bind:value={email}
				placeholder="you@company.com"
				class="w-full rounded-lg border border-ink-900/12 bg-white px-3.5 py-2.5 text-[14.5px] text-ink-900 placeholder:text-ink-300 transition focus:border-iris-500 focus:ring-4 focus:ring-iris-500/15"
			/>
		</div>

		{#if isSignUp}
			<div>
				<label for="ramaId" class="mb-1.5 block text-[13px] font-medium text-ink-700">
					รหัสนักศึกษา
				</label>
				<input
					id="ramaId"
					type="text"
					required
					bind:value={ramaId}
					placeholder="รหัสนักศึกษาเฉพาะตัวเลข (ไม่ต้องมี u นำหน้า)"
					class="w-full rounded-lg border border-ink-900/12 bg-white px-3.5 py-2.5 text-[14.5px] text-ink-900 placeholder:text-ink-300 transition focus:border-iris-500 focus:ring-4 focus:ring-iris-500/15"
				/>
			</div>
		{/if}

		<div>
			<div class="mb-1.5 flex items-center justify-between">
				<label for="password" class="block text-[13px] font-medium text-ink-700">
					Password
				</label>
				{#if !isSignUp}
					<button
						type="button"
						onclick={handleForgotPassword}
						class="text-[13px] font-medium text-iris-600 hover:text-iris-700"
					>
						Forgot password?
					</button>
				{/if}
			</div>
			<div class="relative">
				<input
					id="password"
					type={showPassword ? 'text' : 'password'}
					required
					minlength="6"
					autocomplete={isSignUp ? 'new-password' : 'current-password'}
					bind:value={password}
					placeholder="••••••••"
					class="w-full rounded-lg border border-ink-900/12 bg-white px-3.5 py-2.5 pr-10 text-[14.5px] text-ink-900 placeholder:text-ink-300 transition focus:border-iris-500 focus:ring-4 focus:ring-iris-500/15"
				/>
				<button
					type="button"
					onclick={() => (showPassword = !showPassword)}
					class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500"
					aria-label={showPassword ? 'Hide password' : 'Show password'}
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
			disabled={loading !== null}
			class="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 py-2.5 text-[14.5px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
		>
			{#if loading === 'email'}
				<LoaderCircle class="h-4 w-4 animate-spin text-white" />
			{/if}
			{isSignUp ? 'Create account' : 'Sign in'}
		</button>
	</form>

	<p class="mt-7 text-center text-[14px] text-ink-500">
		{isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
		<button
			type="button"
			onclick={() => {
				mode = isSignUp ? 'sign-in' : 'sign-up';
				error = null;
				notice = null;
			}}
			class="font-medium text-iris-600 hover:text-iris-700"
		>
			{isSignUp ? 'Sign in' : 'Sign up'}
		</button>
	</p>
</div>
