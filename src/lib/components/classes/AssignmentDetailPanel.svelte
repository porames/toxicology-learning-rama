<script lang="ts">
	import { db, storage } from '$lib/firebase';
	import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
	import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
	import { authState } from '$lib/auth.svelte';
	import type {
		Assignment,
		AssignmentSubmission,
		SubmissionAttachment,
	} from '$lib/dashboard/types';
	import { Button, FileUpload } from '$lib/components/ui';
	import {
		ClipboardList,
		FileIcon,
		X,
		AlertCircle,
		CheckCircle2,
		Upload,
	} from '@lucide/svelte';
	import moment from 'moment';

	let {
		classId,
		assignment,
	}: {
		classId: string;
		assignment: Assignment;
	} = $props();

	let submission = $state<AssignmentSubmission | null>(null);
	let submissionLoading = $state(true);

	let attachments = $state<SubmissionAttachment[]>([]);
	let uploading = $state(false);
	let uploadProgress = $state(0);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let saved = $state(false);

	let now = $state(new Date());

	$effect(() => {
		const timer = setInterval(() => {
			now = new Date();
		}, 1000);
		return () => clearInterval(timer);
	});

	async function loadSubmission() {
		const docId = authState.profile?.docId;
		if (!docId) return;
		submissionLoading = true;
		try {
			const subSnap = await getDoc(
				doc(db, 'classes', classId, 'assignments', assignment.id, 'submissions', docId),
			);
			if (subSnap.exists()) {
				submission = {
					id: subSnap.id,
					...subSnap.data(),
					attachments: subSnap.data()?.attachments ?? [],
				} as AssignmentSubmission;
				attachments = [...(submission?.attachments ?? [])];
			} else {
				submission = null;
				attachments = [];
			}
		} catch (err) {
			console.error(err);
		} finally {
			submissionLoading = false;
		}
	}

	const nowTime = $derived(now.getTime());
	const opensAt = $derived(assignment.opensAt?.toDate?.()?.getTime?.() ?? 0);
	const dueAt = $derived(assignment.dueDate?.toDate?.()?.getTime?.() ?? 0);
	const isNotOpen = $derived(nowTime < opensAt);
	const isPastDue = $derived(nowTime > dueAt);
	const canSubmit = $derived(nowTime >= opensAt && nowTime <= dueAt);

	async function handleFileUpload(file: File) {
		const docId = authState.profile?.docId;
		if (!docId) return;
		uploading = true;
		uploadProgress = 0;
		saveError = null;
		try {
			const ext = file.name.split('.').pop() ?? '';
			const refId = `${crypto.randomUUID()}.${ext}`;
			const storageRef = ref(
				storage,
				`assignments/${assignment.id}/submissions/${docId}/${refId}`,
			);
			const uploadTask = uploadBytesResumable(storageRef, file);
			uploadTask.on('state_changed', (snapshot) => {
				uploadProgress = Math.round(
					(snapshot.bytesTransferred / snapshot.totalBytes) * 100,
				);
			});
			await uploadTask;
			attachments = [...attachments, { name: file.name, refId, uploadedAt: null }];
		} catch (err) {
			console.error(err);
			saveError = "Couldn't upload file. Please try again.";
		} finally {
			uploading = false;
		}
	}

	async function removeAttachment(att: SubmissionAttachment) {
		const docId = authState.profile?.docId;
		if (!docId) return;
		try {
			await deleteObject(
				ref(storage, `assignments/${assignment.id}/submissions/${docId}/${att.refId}`),
			);
		} catch (err) {
			console.error(err);
		}
		attachments = attachments.filter((a) => a.refId !== att.refId);
	}

	async function getUrl(att: SubmissionAttachment): Promise<string | null> {
		const docId = authState.profile?.docId;
		if (!docId) return null;
		try {
			const storageRef = ref(
				storage,
				`assignments/${assignment.id}/submissions/${docId}/${att.refId}`,
			);
			return await getDownloadURL(storageRef);
		} catch (err) {
			console.error(err);
			return null;
		}
	}

	async function handleSubmit() {
		const docId = authState.profile?.docId;
		if (!docId || !canSubmit) return;
		saving = true;
		saveError = null;
		saved = false;
		try {
			await setDoc(
				doc(db, 'classes', classId, 'assignments', assignment.id, 'submissions', docId),
				{
					studentUserId: docId,
					submittedAt: submission?.submittedAt ?? serverTimestamp(),
					updatedAt: serverTimestamp(),
					attachments: attachments.map((a) => ({
						name: a.name,
						refId: a.refId,
						uploadedAt: serverTimestamp(),
					})),
				},
				{ merge: true },
			);
			saved = true;
			window.setTimeout(() => (saved = false), 2000);
			await loadSubmission();
		} catch (err) {
			console.error(err);
			saveError = "Couldn't submit your assignment. Please try again.";
		} finally {
			saving = false;
		}
	}

	function fmtDate(d?: { toDate?: () => Date } | Date | null): string {
		if (!d) return '—';
		const date = (d as any).toDate ? (d as any).toDate() : d;
		return moment(date).format('ddd, MMM D, YYYY · hh:mm A');
	}

	$effect(() => {
		loadSubmission();
	});
</script>

<div class="flex-1 min-w-0 overflow-y-auto px-6 py-5">
	<div class="rounded-xl border border-ink-900/10 bg-white shadow-soft">
		<div class="flex items-start justify-between gap-3 p-5 md:p-6">
			<div class="min-w-0">
				<h1 class="text-[18px] font-semibold text-ink-900">
					{assignment.instructions.split('\n')[0] || 'Assignment'}
				</h1>
				<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-500">
					<span>Opens {fmtDate(assignment.opensAt)}</span>
					<span>Due {fmtDate(assignment.dueDate)}</span>
				</div>
			</div>
			{#if submission?.submittedAt}
				<span
					class="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700"
				>
					<CheckCircle2 class="h-3.5 w-3.5" />
					Submitted
				</span>
			{/if}
		</div>
		<div class="border-t border-ink-900/5 px-5 py-4 md:px-6">
			<p class="text-[13px] text-ink-600">{assignment.instructions}</p>
		</div>
		<div class="border-t border-ink-900/5 px-5 py-4 md:px-6">
			<p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
				Required attachments
			</p>
			{#if assignment.requiredAttachments.length === 0}
				<p class="text-[13px] text-ink-500">No required files.</p>
			{:else}
				<ul class="space-y-1">
					{#each assignment.requiredAttachments as req}
						<li class="flex items-start gap-2 text-[13px] text-ink-600">
							<FileIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
							<span>{req.instruction || 'Untitled required file'}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<div class="mt-5 rounded-xl border border-ink-900/10 bg-white p-5 shadow-soft md:p-6">
		<div class="flex items-center gap-2">
			<Upload class="h-4 w-4 text-iris-600" />
			<p class="text-[14px] font-semibold text-ink-900">Your submission</p>
		</div>

		{#if submissionLoading}
			<div class="mt-4 h-8 w-full animate-pulse rounded-md bg-ink-900/5"></div>
		{:else if isNotOpen}
			<p class="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] font-medium text-amber-700">
				Submissions open {fmtDate(assignment.opensAt)}.
			</p>
		{:else if isPastDue}
			<p class="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-600">
				This assignment is past due. Submissions are closed.
			</p>
			{#if attachments.length > 0}
				<div class="mt-4 space-y-1.5">
					{#each attachments as att}
						<div class="flex items-center gap-2 rounded-lg bg-ink-900/[0.03] px-3 py-2">
							<FileIcon class="h-4 w-4 shrink-0 text-ink-400" />
							<span class="min-w-0 flex-1 truncate text-[13px] text-ink-700">
								{att.name}
							</span>
							<button
								type="button"
								onclick={async () => {
									const url = await getUrl(att);
									if (url) window.open(url, '_blank');
								}}
								class="shrink-0 text-[12.5px] font-medium text-iris-600 underline hover:text-iris-700"
							>
								View
							</button>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<p class="mt-2 text-[12.5px] text-ink-500">
				Upload the required files. You can update them any time before the due date.
			</p>

			{#if attachments.length > 0}
				<div class="mt-4 space-y-1.5">
					{#each attachments as att}
						<div class="flex items-center gap-2 rounded-lg bg-ink-900/[0.03] px-3 py-2">
							<FileIcon class="h-4 w-4 shrink-0 text-ink-400" />
							<span class="min-w-0 flex-1 truncate text-[13px] text-ink-700">
								{att.name}
							</span>
							<button
								type="button"
								onclick={async () => {
									const url = await getUrl(att);
									if (url) window.open(url, '_blank');
								}}
								class="shrink-0 text-[12.5px] font-medium text-iris-600 underline hover:text-iris-700"
							>
								View
							</button>
							<button
								type="button"
								onclick={() => removeAttachment(att)}
								aria-label="Remove file"
								class="shrink-0 rounded p-1 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
							>
								<X class="h-3.5 w-3.5" />
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<div class="mt-4 flex items-center gap-3">
				<FileUpload
					disabled={uploading}
					label={uploading ? `Uploading ${uploadProgress}%` : 'Choose file'}
					onupload={(file) => {
						if (file instanceof File) handleFileUpload(file);
					}}
				/>
				{#if uploading}
					<div class="h-2 flex-1 overflow-hidden rounded-full bg-ink-900/10">
						<div
							class="h-full rounded-full bg-iris-500 transition-all duration-300"
							style="width: {uploadProgress}%"
						></div>
					</div>
				{/if}
			</div>

			{#if saveError}
				<p
					class="mt-4 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600"
				>
					<AlertCircle class="h-4 w-4 shrink-0" />
					{saveError}
				</p>
			{/if}

			<div class="mt-5 flex items-center gap-3 border-t border-ink-900/5 pt-4">
				<Button variant="accent" disabled={saving || uploading} onclick={handleSubmit}>
					{#if saving}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></div>
						Submitting…
					{:else if saved}
						Submitted
					{:else}
						Submit
					{/if}
				</Button>
				{#if submission?.submittedAt}
					<p class="text-[12.5px] text-ink-500">
						Last submitted {moment(submission.submittedAt.toDate()).format(
							'MMM D, YYYY · hh:mm A',
						)}
					</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
