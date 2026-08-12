<script lang="ts">
	import { db, storage } from '$lib/firebase';
	import { doc, getDoc, collection, getDocs, query, where, documentId } from 'firebase/firestore';
	import { ref, getDownloadURL } from 'firebase/storage';
	import {
		ChevronDown,
		ChevronRight,
		ClipboardList,
		FileIcon,
		FileText,
		Users,
		Inbox,
		Download,
	} from '@lucide/svelte';
	import type {
		Assignment,
		AssignmentSubmission,
		RequiredAttachment,
		Student,
		SubmissionAttachment,
	} from '$lib/dashboard/types';
	import { Button } from '$lib/components/ui';
	import { t, tn } from '$lib/i18n';
	import moment from 'moment';

	let { classId, assignmentId }: { classId: string; assignmentId: string } = $props();

	let assignment = $state<Assignment | null>(null);
	let className = $state('');
	let students = $state<Student[]>([]);
	let submissions = $state<Record<string, AssignmentSubmission>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);
	let expanded = $state<Set<string>>(new Set());
	let fileUrls = $state<Record<string, string>>({});
	let exporting = $state(false);

	async function load() {
		loading = true;
		error = null;
		try {
			const assignmentSnap = await getDoc(
				doc(db, 'classes', classId, 'assignments', assignmentId),
			);
			if (!assignmentSnap.exists()) {
				error = t('common.assignmentNotFound');
				return;
			}
			assignment = {
				id: assignmentSnap.id,
				...assignmentSnap.data(),
				requiredAttachments: (assignmentSnap.data()?.requiredAttachments ??
					[]) as RequiredAttachment[],
				assignedStudentIds: (assignmentSnap.data()?.assignedStudentIds ?? []) as string[],
			} as Assignment;

			const classSnap = await getDoc(doc(db, 'classes', classId));
			className = classSnap.exists() ? (classSnap.data()?.name ?? '') : '';

			const assignedIds = assignment.assignedStudentIds;
			if (assignedIds.length > 0) {
				const chunkSize = 30;
				const chunks = [];
				for (let i = 0; i < assignedIds.length; i += chunkSize) {
					chunks.push(assignedIds.slice(i, i + chunkSize));
				}
				const snaps = await Promise.all(
					chunks.map((chunk) =>
						getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk))),
					),
				);
				students = snaps
					.flatMap((s) => s.docs)
					.map((d) => ({ id: d.id, ...d.data() })) as Student[];
			}

			const submissionsSnap = await getDocs(
				collection(db, 'classes', classId, 'assignments', assignmentId, 'submissions'),
			);
			submissions = submissionsSnap.docs.reduce<Record<string, AssignmentSubmission>>(
				(map, d) => {
					map[d.id] = {
						id: d.id,
						studentUserId: d.data()?.studentUserId ?? d.id,
						submittedAt: d.data()?.submittedAt ?? null,
						updatedAt: d.data()?.updatedAt ?? null,
						requirementsMet: d.data()?.requirementsMet,
						missingAttachmentIds: d.data()?.missingAttachmentIds ?? [],
						attachments: (d.data()?.attachments ?? []) as SubmissionAttachment[],
					};
					return map;
				},
				{},
			);
		} catch (err) {
			console.error(err);
			error = t('common.somethingWentWrong');
		} finally {
			loading = false;
		}
	}

	function toggleExpand(id: string) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expanded = next;
	}

	async function getUrl(submissionId: string, att: SubmissionAttachment) {
		const key = `${submissionId}/${att.filePath}`;
		if (fileUrls[key]) {
			fileUrls = { ...fileUrls, [key]: '' };
			return;
		}
		try {
			const storageRef = ref(
				storage,
				`assignments/${assignmentId}/submissions/${submissionId}/${att.filePath}`,
			);
			const url = await getDownloadURL(storageRef);
			fileUrls = { ...fileUrls, [key]: url };
		} catch (err) {
			console.error(err);
		}
	}

	function fmtDate(d?: { toDate?: () => Date } | Date | null): string {
		if (!d) return '—';
		const date = (d as any).toDate ? (d as any).toDate() : d;
		return moment(date).format('MMM D, YYYY · hh:mm A');
	}

	async function fileDownloadUrl(studentId: string, att: SubmissionAttachment): Promise<string> {
		try {
			const storageRef = ref(
				storage,
				`assignments/${assignmentId}/submissions/${studentId}/${att.filePath}`,
			);
			return await getDownloadURL(storageRef);
		} catch (err) {
			console.error(err);
			return '';
		}
	}

	async function exportCsv() {
		if (exporting) return;
		exporting = true;
		try {
			const header = [
				t('export.studentId'),
				t('export.fullName'),
				t('export.email'),
				t('export.status'),
				t('export.submittedAt'),
				t('export.lastSaved'),
				t('export.fileCount'),
				t('export.files'),
			];
			const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
			const lines: string[] = [];
			for (const student of students) {
				const submission = submissions[student.id];
				const files = submission?.attachments ?? [];
				const fileEntries: string[] = [];
				for (const f of files) {
					const url = await fileDownloadUrl(student.id, f);
					fileEntries.push(url ? `${f.name}: ${url}` : f.name);
				}
				lines.push(
					[
						student.rama_id ?? '',
						student.name,
						student.email,
						submission
							? submission.requirementsMet === false
								? t('export.incomplete')
								: t('export.submitted')
							: t('export.noSubmission'),
						submission?.submittedAt ? fmtDate(submission.submittedAt) : '',
						submission?.updatedAt ? fmtDate(submission.updatedAt) : '',
						files.length,
						fileEntries.join('; '),
					]
						.map(escape)
						.join(','),
				);
			}
			const csv = [header.join(','), ...lines].join('\n');
			const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${(
				assignment?.title ||
				assignment?.instructions.split('\n')[0] ||
				'assignment'
			).replace(/[^a-z0-9]+/gi, '_')}_submissions.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exporting = false;
		}
	}

	$effect(() => {
		load();
	});
</script>

<div class="mx-auto w-full min-w-0 max-w-5xl px-4 py-10 md:px-8">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="min-w-0 flex-1">
			<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">
				{t('dashboard.submissions')}
			</p>
			<h1
				class="mt-1 flex items-center gap-2 truncate text-[18px] font-semibold text-ink-900"
			>
				<ClipboardList class="h-4 w-4 shrink-0 text-iris-600" />
				<span class="truncate">
					{assignment?.title ||
						assignment?.instructions.split('\n')[0] ||
						t('common.untitledAssignment')}
				</span>
			</h1>
			{#if className}
				<p class="mt-0.5 text-[13px] text-ink-500">{className}</p>
			{/if}
		</div>
		<button
			type="button"
			onclick={exportCsv}
			disabled={loading || students.length === 0 || exporting}
			class="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-900/10 bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-700 shadow-soft transition hover:border-iris-400 hover:bg-iris-50 hover:text-iris-600 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if exporting}
				<div
					class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-900/20 border-t-ink-700"
				></div>
				{t('common.saving')}
			{:else}
				<Download class="h-3.5 w-3.5" />
				{t('quiz.exportCsv')}
			{/if}
		</button>
	</div>

	{#if loading}
		<div class="mt-8 space-y-2">
			{#each Array(3) as _}
				<div class="h-20 w-full animate-pulse rounded-lg bg-ink-900/5"></div>
			{/each}
		</div>
	{:else if error}
		<p class="mt-8 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>
	{:else if students.length === 0}
		<div class="mt-16 flex flex-col items-center justify-center px-8 text-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-iris-50 text-iris-600"
			>
				<Users class="h-6 w-6" />
			</div>
			<p class="mt-4 text-[15px] font-medium text-ink-900">No students assigned</p>
			<p class="mt-1 max-w-xs text-[13.5px] text-ink-500">
				Assign students to this assignment to see their submissions.
			</p>
		</div>
	{:else}
		<div class="mt-6 space-y-3">
			{#each students as student (student.id)}
				{@const submission = submissions[student.id]}
				{@const isExpanded = expanded.has(student.id)}
				<div
					class="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft"
				>
					<button
						type="button"
						onclick={() => toggleExpand(student.id)}
						class="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-900/[0.02]"
					>
						{#if isExpanded}
							<ChevronDown class="h-4 w-4 shrink-0 text-ink-400" />
						{:else}
							<ChevronRight class="h-4 w-4 shrink-0 text-ink-400" />
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-[14px] font-medium text-ink-900">
								{student.name}
								<span class="ml-2 font-mono text-[12px] font-normal text-ink-400">
									{student.rama_id}
								</span>
							</p>
							<p class="truncate text-[12.5px] text-ink-500">{student.email}</p>
						</div>
						<div class="flex shrink-0 flex-wrap items-center gap-3">
							{#if submission}
								<span class="text-[12px] text-ink-400">
									{tn(
										submission.attachments.length,
										'export.fileCount',
										'export.fileCount',
									)}
								</span>
								<span
									class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-emerald-700"
								>
									{submission.requirementsMet === false
										? t('export.incomplete')
										: t('export.submitted')}
								</span>
							{:else}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-ink-900/[0.05] px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-500"
								>
									<Inbox class="h-3.5 w-3.5" />
									{t('export.noSubmission')}
								</span>
							{/if}
						</div>
					</button>

					{#if isExpanded}
						<div class="border-t border-ink-900/5 px-4 py-3">
							{#if submission}
								<div
									class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-500"
								>
									<span>
										{t('assignmentDetail.lastSubmitted', {
											time: fmtDate(submission.submittedAt),
										})}
									</span>
									{#if submission.updatedAt}
										<span
											>{t('assignmentDetail.lastSaved', {
												time: fmtDate(submission.updatedAt),
											})}</span
										>
									{/if}
								</div>
								{#if submission.attachments.length === 0}
									<p class="mt-3 text-[12.5px] text-ink-500">
										{t('assignmentDetail.noRequiredFiles')}
									</p>
								{:else}
									<div class="mt-3 space-y-1.5">
										{#each submission.attachments as att}
											{@const key = `${submission.id}/${att.filePath}`}
											{@const fileUrl = fileUrls[key]}
											<div class="rounded-lg bg-ink-900/[0.03] px-3 py-2">
												<div class="flex items-center gap-2">
													<FileIcon
														class="h-4 w-4 shrink-0 text-ink-400"
													/>
													<span
														class="min-w-0 flex-1 truncate text-[13px] text-ink-700"
													>
														{att.name}
													</span>
													<button
														type="button"
														onclick={() => getUrl(submission.id, att)}
														class="shrink-0 text-[12.5px] font-medium text-iris-600 underline hover:text-iris-700"
													>
														{fileUrl
															? t('common.hide')
															: t('common.view')}
													</button>
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
												{#if fileUrl}
													<div class="mt-2">
														<iframe
															src={fileUrl}
															class="h-64 w-full rounded-lg border border-ink-900/10"
															title={att.name}
														></iframe>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							{:else}
								<p class="text-[12.5px] text-ink-500">
									{t('students.thisStudent')} hasn't submitted anything yet.
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
