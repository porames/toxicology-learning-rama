<script lang="ts">
	import { signInWithPopup, signOut } from 'firebase/auth';
	import { auth, storage, googleProvider } from '$lib/firebase';
	import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { getAuthErrorMessage } from '$lib/authErrors';
	import { translateApiError } from '$lib/i18n/apiErrors';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { t } from '$lib/i18n';
	import { LoaderCircle, FileText, X } from '@lucide/svelte';
	import { Input, Select, DateTimeInput, Button, FileUpload } from '$lib/components/ui';

	let stage = $state<'connect' | 'form'>('connect');
	let connecting = $state(false);
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);

	let firstName = $state('');
	let lastName = $state('');
	let gender = $state('');
	let role = $state('');
	let year = $state('');
	let hospital = $state('');
	let department = $state('');
	let phone = $state('');
	let lineId = $state('');
	let electiveStart = $state<Date | null>(null);
	let electiveEnd = $state<Date | null>(null);
	let assessmentFile = $state<File | null>(null);
	let assessmentFileError = $state<string | null>(null);

	const MAX_FILE_BYTES = 10 * 1024 * 1024;

	const GENDER_OPTIONS = $derived<{ value: string; label: string }[]>([
		{ value: 'male', label: t('signup.male') },
		{ value: 'female', label: t('signup.female') },
	]);

	const STATUS_OPTIONS = $derived<{ value: string; label: string }[]>([
		{ value: 'student', label: t('signup.medicalStudent') },
		{ value: 'resident', label: t('signup.resident') },
	]);

	const YEAR_OPTIONS = $derived<Record<string, { value: string; label: string }[]>>({
		student: [
			{ value: 'y4', label: t('students.yearY4') },
			{ value: 'y5', label: t('students.yearY5') },
			{ value: 'y6', label: t('students.yearY6') },
		],
		resident: [
			{ value: 'r1', label: t('students.yearR1') },
			{ value: 'r2', label: t('students.yearR2') },
			{ value: 'r3', label: t('students.yearR3') },
		],
	});

	const email = $derived(authState.user?.email ?? '');

	const isGoogleConnected = $derived(
		authState.user?.providerData?.some((p) => p.providerId === 'google.com') ?? false,
	);

	$effect(() => {
		if (isGoogleConnected && !authState.profile) {
			stage = 'form';
		}
	});

	function dateYearError(d: Date | null): string {
		if (!d) return '';
		return d.getFullYear() > 2100 ? t('utils.buddhistYearNote') : '';
	}

	const electiveStartError = $derived(dateYearError(electiveStart));
	const electiveEndError = $derived(dateYearError(electiveEnd));

	async function handleConnect() {
		error = null;
		connecting = true;
		try {
			await signInWithPopup(auth, googleProvider);
			stage = 'form';
		} catch (err: any) {
			error = err?.code
				? getAuthErrorMessage(err.code)
				: translateApiError(err?.message) || t('common.somethingWentWrong');
		} finally {
			connecting = false;
		}
	}

	function handleAssessmentFile(file: File) {
		const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
		if (!isPdf) {
			assessmentFileError = t('signup.assessmentFormInvalidType');
			return;
		}
		if (file.size >= MAX_FILE_BYTES) {
			assessmentFileError = t('signup.assessmentFormTooLarge');
			return;
		}
		assessmentFileError = null;
		assessmentFile = file;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		notice = null;

		const needsDepartment = role === 'resident';
		if (
			!firstName ||
			!lastName ||
			!gender ||
			!role ||
			!year ||
			!hospital ||
			!phone ||
			(needsDepartment && !department) ||
			!electiveStart ||
			!electiveEnd ||
			!assessmentFile
		) {
			error = t('signup.pleaseFillRequired');
			return;
		}
		const file = assessmentFile;

		if (
			(electiveStart && electiveStart.getFullYear() > 2100) ||
			(electiveEnd && electiveEnd.getFullYear() > 2100)
		) {
			error = t('utils.buddhistYearNote');
			return;
		}

		submitting = true;
		let fileRef: ReturnType<typeof ref> | null = null;
		try {
			const user = authState.user;
			if (!user) throw new Error(t('common.notLoggedIn'));
			const token = await user.getIdToken();

			const ext = file.name.split('.').pop() || 'pdf';
			fileRef = ref(storage, `assessment-forms/${user.uid}/${crypto.randomUUID()}.${ext}`);
			await uploadBytes(fileRef, file);
			const assessmentFormUrl = await getDownloadURL(fileRef);
			const assessmentFormPath = fileRef.fullPath;

			const res = await fetch(functionsUrl('signUpGoogle'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					firstName,
					lastName,
					gender,
					role,
					year,
					hospital,
					...(needsDepartment && { department }),
					phone,
					...(lineId && { lineId }),
					electiveStart: electiveStart.toISOString(),
					electiveEnd: electiveEnd.toISOString(),
					assessmentFormUrl,
					assessmentFormPath,
					assessmentFormName: file.name,
				}),
			});

			if (!res.ok) {
				await deleteObject(fileRef).catch(() => {});
				const body = await res.json().catch(() => null);
				await signOut(auth);
				throw new Error(body?.error || t('common.somethingWentWrong'));
			}

			await user.getIdToken(true);
			await authState.refreshProfile();
			goto(`${base}/classes`);
		} catch (err: any) {
			if (fileRef) await deleteObject(fileRef).catch(() => {});
			error = err?.code
				? getAuthErrorMessage(err.code)
				: translateApiError(err?.message) || t('common.somethingWentWrong');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="w-full max-w-[420px]">
	<h2 class="text-[26px] font-semibold tracking-tight text-ink-900">{t('signup.title')}</h2>
	<p class="mt-2 text-[14.5px] text-ink-500">{t('signup.subtitle')}</p>

	{#if stage === 'connect'}
		<button
			type="button"
			onclick={handleConnect}
			disabled={connecting}
			class="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-ink-900/15 bg-white px-3.5 py-2.5 text-[14.5px] font-semibold text-ink-800 transition hover:bg-ink-900/[0.03] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
		>
			{#if connecting}
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
			{connecting ? t('signup.connectingGoogle') : t('signup.signUpWithGoogle')}
		</button>
	{:else}
		<p
			class="mt-4 flex items-center gap-2 rounded-lg border border-mesh-teal/30 bg-mesh-teal/10 px-3.5 py-2.5 text-[13.5px] text-emerald-700"
		>
			<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" aria-hidden="true">
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
			{t('signup.connectedAs', { email })}
		</p>

		<form onsubmit={handleSubmit} class="mt-5 space-y-4" novalidate>
			<div class="grid grid-cols-2 gap-3">
				<Input
					placeholder={t('signup.firstName')}
					label={t('signup.firstName')}
					bind:value={firstName}
				/>
				<Input
					placeholder={t('signup.lastName')}
					label={t('signup.lastName')}
					bind:value={lastName}
				/>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<Select
					label={t('signup.gender')}
					options={GENDER_OPTIONS}
					bind:value={gender}
					placeholder={t('signup.selectGender')}
				/>
				<Select
					label={t('signup.status')}
					options={STATUS_OPTIONS}
					bind:value={role}
					placeholder={t('signup.selectStatus')}
					onchange={() => {
						const valid = YEAR_OPTIONS[role]?.map((o) => o.value) ?? [];
						if (!valid.includes(year)) year = '';
					}}
				/>
			</div>

			<Select
				label={t('signup.year')}
				options={YEAR_OPTIONS[role] ?? []}
				bind:value={year}
				placeholder={t('signup.selectYear')}
				disabled={!role}
			/>

			<Input
				label={t('signup.hospital')}
				bind:value={hospital}
				placeholder={t('signup.hospitalPlaceholder')}
			/>

			{#if role === 'resident'}
				<Input
					label={t('signup.department')}
					bind:value={department}
					placeholder={t('signup.departmentPlaceholder')}
				/>
			{/if}

			<div class="grid grid-cols-2 gap-3">
				<Input
					placeholder={t('signup.phone')}
					label={t('signup.phone')}
					type="tel"
					bind:value={phone}
				/>
				<Input
					placeholder={t('signup.lineId')}
					label={t('signup.lineId')}
					bind:value={lineId}
				/>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<DateTimeInput
					mode="date"
					label={t('signup.electiveStart')}
					bind:value={electiveStart}
					error={electiveStartError}
				/>
				<DateTimeInput
					mode="date"
					label={t('signup.electiveEnd')}
					bind:value={electiveEnd}
					error={electiveEndError}
				/>
			</div>

			<div>
				<label
					for="assessment-form"
					class="mb-1.5 block text-[13px] font-medium text-ink-700"
				>
					{t('signup.assessmentForm')}
				</label>
				<FileUpload
					id="assessment-form"
					accept="application/pdf,.pdf"
					disabled={submitting}
					onupload={(f) => handleAssessmentFile(f as File)}
				/>
				{#if assessmentFile}
					<div
						class="mt-2 flex items-center justify-between gap-2 rounded-lg border border-ink-900/10 bg-ink-900/[0.02] px-3 py-2"
					>
						<span class="flex min-w-0 items-center gap-2 text-[13px] text-ink-700">
							<FileText class="h-4 w-4 shrink-0 text-ink-400" />
							<span class="truncate">{assessmentFile.name}</span>
						</span>
						<button
							type="button"
							onclick={() => {
								assessmentFile = null;
								assessmentFileError = null;
							}}
							disabled={submitting}
							aria-label={t('common.remove')}
							class="shrink-0 rounded p-1 text-ink-400 transition hover:bg-ink-900/5 hover:text-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<X size={14} />
						</button>
					</div>
				{:else if !assessmentFileError}
					<p class="mt-1.5 text-[12px] text-ink-400">{t('signup.assessmentFormHint')}</p>
				{/if}
				{#if assessmentFileError}
					<p class="mt-1.5 text-[12.5px] text-red-600">{assessmentFileError}</p>
				{/if}
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

			<Button
				type="submit"
				disabled={submitting}
				class="w-full py-2.5 text-[14.5px] font-semibold"
			>
				{#if submitting}
					<LoaderCircle class="mr-2 inline h-4 w-4 animate-spin text-white" />
					{t('signup.submitting')}
				{:else}
					{t('signup.submit')}
				{/if}
			</Button>
		</form>
	{/if}

	<p class="mt-7 text-center text-[14px] text-ink-500">
		<button
			type="button"
			onclick={() => signOut(auth)}
			class="font-medium text-iris-600 hover:text-iris-700"
		>
			{t('nav.signOut')}
		</button>
	</p>
</div>
