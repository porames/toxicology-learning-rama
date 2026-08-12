<script lang="ts">
	import { db, storage } from '$lib/firebase';
	import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
	import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import type {
		Assignment,
		AssignmentSubmission,
		SubmissionAttachment,
	} from '$lib/dashboard/types';
	import { Button, FileUpload } from '$lib/components/ui';
	import {
		ClipboardList,
		FileIcon,
		Trash2,
		AlertCircle,
		CheckCircle2,
		Upload,
	} from '@lucide/svelte';
	import moment from 'moment';
	import { t } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';

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
	type UploadState = { id: string; status: boolean };
	type UploadProgressState = { id: string; percent: number };
	let uploading = $state<Record<string, UploadState>>({});
	let uploadProgress = $state<Record<string, UploadProgressState>>({});
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let saved = $state(false);
	let savingDraft = $state(false);
	let draftSaved = $state(false);

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
			console.log(attachments);
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
	const attachmentsFor = $derived((reqId: string) =>
		attachments.filter((a) => a.attachmentId === reqId),
	);
	const isUploading = $derived((reqId: string) => uploading[reqId]?.status ?? false);
	const progressFor = $derived((reqId: string) => uploadProgress[reqId]?.percent ?? 0);
	const anyUploading = $derived(Object.values(uploading).some((u) => u.status));
	const hasAttachmentChanges = $derived.by(() => {
		const current = attachments.map((a) => a.filePath).sort();
		const saved = (submission?.attachments ?? []).map((a) => a.filePath).sort();
		if (current.length !== saved.length) return true;
		return current.some((p, i) => p !== saved[i]);
	});

	async function saveAttachments() {
		const docId = authState.profile?.docId;
		if (!docId) return;
		await setDoc(
			doc(db, 'classes', classId, 'assignments', assignment.id, 'submissions', docId),
			{
				studentUserId: docId,
				updatedAt: serverTimestamp(),
				attachments: attachments.map((a) => ({
					name: a.name,
					filePath: a.filePath,
					attachmentId: a.attachmentId,
					uploadedAt: a.uploadedAt ?? Timestamp.now(),
				})),
			},
			{ merge: true },
		);
	}

	async function handleSave() {
		const docId = authState.profile?.docId;
		if (!docId || !canSubmit) return;
		savingDraft = true;
		saveError = null;
		draftSaved = false;
		try {
			await saveAttachments();
			draftSaved = true;
			window.setTimeout(() => (draftSaved = false), 2000);
			await loadSubmission();
		} catch (err) {
			console.error(err);
			saveError = t('assignmentDetail.couldNotSave');
		} finally {
			savingDraft = false;
		}
	}

	async function handleFileUpload(file: File, attachmentId: string) {
		const docId = authState.profile?.docId;
		if (!docId) return;
		uploading = {
			...uploading,
			[attachmentId]: { id: attachmentId, status: true },
		};
		uploadProgress = {
			...uploadProgress,
			[attachmentId]: { id: attachmentId, percent: 0 },
		};
		saveError = null;
		try {
			const ext = file.name.split('.').pop() ?? '';
			const filePath = `${crypto.randomUUID()}.${ext}`;
			const storageRef = ref(
				storage,
				`assignments/${assignment.id}/submissions/${docId}/${filePath}`,
			);
			const uploadTask = uploadBytesResumable(storageRef, file);
			uploadTask.on('state_changed', (snapshot) => {
				uploadProgress = {
					...uploadProgress,
					[attachmentId]: {
						id: attachmentId,
						percent: Math.round(
							(snapshot.bytesTransferred / snapshot.totalBytes) * 100,
						),
					},
				};
			});
			await uploadTask;
			attachments = [
				...attachments,
				{ name: file.name, filePath, attachmentId, uploadedAt: Timestamp.now() },
			];
			await saveAttachments();
		} catch (err) {
			console.error(err);
			saveError = t('assignmentDetail.couldNotUpload');
		} finally {
			const { [attachmentId]: _removed, ...restUploading } = uploading;
			const { [attachmentId]: _removedProgress, ...restProgress } = uploadProgress;
			uploading = restUploading;
			uploadProgress = restProgress;
		}
	}

	async function removeAttachment(att: SubmissionAttachment) {
		const docId = authState.profile?.docId;
		if (!docId) return;
		try {
			await deleteObject(
				ref(storage, `assignments/${assignment.id}/submissions/${docId}/${att.filePath}`),
			);
		} catch (err) {
			console.error(err);
		}
		attachments = attachments.filter((a) => a.filePath !== att.filePath);
		await saveAttachments();
	}

	async function getUrl(att: SubmissionAttachment): Promise<string | null> {
		const docId = authState.profile?.docId;
		if (!docId) return null;
		try {
			const storageRef = ref(
				storage,
				`assignments/${assignment.id}/submissions/${docId}/${att.filePath}`,
			);
			return await getDownloadURL(storageRef);
		} catch (err) {
			console.error(err);
			return null;
		}
	}

	async function handleSubmit() {
		const user = authState.user;
		if (!user || !canSubmit) return;
		saving = true;
		saveError = null;
		saved = false;
		try {
			const token = await user.getIdToken();
			const res = await fetch(functionsUrl('submitAssignment'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ classId, assignmentId: assignment.id }),
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(translateApiError(err.error));
			}
			saved = true;
			window.setTimeout(() => (saved = false), 2000);
			await loadSubmission();
		} catch (err) {
			console.error(err);
			saveError = t('assignmentDetail.couldNotSubmit');
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
					{assignment.title ||
						assignment.instructions.split('\n')[0] ||
						t('classes.assignment')}
				</h1>
				<div
					class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-500"
				>
					<span>{t('classes.opens', { time: fmtDate(assignment.opensAt) })}</span>
					<span>{t('classes.due', { time: fmtDate(assignment.dueDate) })}</span>
				</div>
			</div>
			{#if submission?.submittedAt}
				<span
					class="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700"
				>
					<CheckCircle2 class="h-3.5 w-3.5" />
					{t('assignmentDetail.saved')}
				</span>
			{/if}
		</div>
		<div class="border-t border-ink-900/5 px-5 py-4 md:px-6">
			<p class="text-[13px] text-ink-600">{assignment.instructions}</p>
		</div>
	</div>

	<div class="mt-5 rounded-xl border border-ink-900/10 bg-white p-5 shadow-soft md:p-6">
		<div class="flex items-center gap-2">
			<Upload class="h-4 w-4 text-iris-600" />
			<p class="text-[14px] font-semibold text-ink-900">
				{t('assignmentDetail.yourSubmission')}
			</p>
		</div>
		{#if assignment.requiredAttachments.length === 0}
			<p class="text-[13px] text-ink-500">{t('assignmentDetail.noRequiredFiles')}</p>
		{:else}
			<ul class="space-y-1">
				{#each assignment.requiredAttachments as req}
					{@const reqFiles = attachmentsFor(req.id)}
					<li class={`py-3 border-b-1 last:border-b-0 border-ink-900/5`}>
						<div
							class="flex flex-row justify-between items-center gap-2 text-[13px] text-ink-600"
						>
							<div class="flex flex-row items-center gap-2">
								<FileIcon size={16} class={`shrink-0 'text-ink-400'}`} />
								<span>{req.instruction || t('common.untitledRequiredFile')}</span>
							</div>
							{#if reqFiles.length > 0}
								<span
									class="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
								>
									<CheckCircle2 class="h-3 w-3" />
									{t('assignmentDetail.saved')}
								</span>
							{/if}
						</div>
						<div class="mt-2 flex flex-row items-center justify-between gap-3">
							<div class="min-w-0 flex-1">
								{#if reqFiles.length > 0}
									<div class="space-y-1.5">
										{#each reqFiles as att}
											<div class="rounded-lg bg-ink-900/[0.03] px-3 py-2">
												<div class="flex items-center gap-2">
													<span
														class="min-w-0 flex-1 truncate text-[13px] text-ink-700"
													>
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
														{t('assignmentDetail.view')}
													</button>
													{#if canSubmit}
														<button
															type="button"
															onclick={() => removeAttachment(att)}
															aria-label={t(
																'assignmentDetail.removeFile',
															)}
															class="shrink-0 rounded p-1 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
														>
															<Trash2 class="h-3.5 w-3.5" />
														</button>
													{/if}
												</div>
												{#if att.uploadedAt?.toDate?.()}
													<p class="mt-1 text-[11.5px] text-ink-400">
														{t('assignmentDetail.uploadedAt', {
															time: moment(
																att.uploadedAt.toDate(),
															).format('MMM D, YYYY · hh:mm A'),
														})}
													</p>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
							{#if canSubmit}
								<FileUpload
									disabled={isUploading(req.id)}
									label={isUploading(req.id)
										? t('assignmentDetail.uploadingPercent', {
												percent: progressFor(req.id),
											})
										: t('assignmentDetail.chooseFile')}
									onupload={(file) => {
										if (file instanceof File) handleFileUpload(file, req.id);
									}}
								/>
							{/if}
						</div>
						{#if isUploading(req.id)}
							<div class="mt-2 flex items-center gap-3">
								<div class="h-2 flex-1 overflow-hidden rounded-full bg-ink-900/10">
									<div
										class="h-full rounded-full bg-iris-500 transition-all duration-300"
										style="width: {progressFor(req.id)}%"
									></div>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if submissionLoading}
			<div class="mt-4 h-8 w-full animate-pulse rounded-md bg-ink-900/5"></div>
		{:else if isNotOpen}
			<p
				class="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] font-medium text-amber-700"
			>
				{t('assignmentDetail.submissionsOpen', { time: fmtDate(assignment.opensAt) })}
			</p>
		{:else if isPastDue}
			<p class="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-600">
				{t('assignmentDetail.pastDue')}
			</p>
		{:else}
			<p class="mt-2 text-[12.5px] text-ink-500">
				{t('assignmentDetail.uploadFilesHint')}
			</p>

			{#if saveError}
				<p
					class="mt-4 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600"
				>
					<AlertCircle class="h-4 w-4 shrink-0" />
					{saveError}
				</p>
			{/if}

			<div class="mt-5 flex items-center gap-3 border-t border-ink-900/5 pt-4">
				<Button
					variant="ghost"
					disabled={savingDraft || anyUploading || !hasAttachmentChanges}
					onclick={handleSave}
				>
					{#if savingDraft}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/20 border-t-ink-700"
						></div>
						{t('common.saving')}
					{:else if draftSaved}
						{t('assignmentDetail.saved')}
					{:else}
						{t('common.save')}
					{/if}
				</Button>
				<Button
					variant="accent"
					disabled={saving || anyUploading || !hasAttachmentChanges}
					onclick={handleSubmit}
				>
					{#if saving}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></div>
						{t('common.submitting')}
					{:else if saved}
						{t('assignmentDetail.saved')}
					{:else}
						{t('common.submit')}
					{/if}
				</Button>
				<div class="flex flex-col">
					{#if submission?.submittedAt}
						<div class="text-[12.5px] text-ink-500">
							{t('assignmentDetail.lastSubmitted', {
								time: moment(submission.submittedAt.toDate()).format(
									'MMM D, YYYY · hh:mm A',
								),
							})}
						</div>
					{/if}
					{#if submission?.updatedAt}
						<div class="text-[12.5px] text-ink-500">
							{t('assignmentDetail.lastSaved', {
								time: moment(submission.updatedAt.toDate()).format(
									'MMM D, YYYY · hh:mm A',
								),
							})}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
