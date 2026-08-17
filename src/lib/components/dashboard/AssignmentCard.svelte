<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import type { Assignment } from '$lib/dashboard/types';
	import { fmtDate } from '$lib/dashboard/utils';
	import { Button } from '$lib/components/ui';
	import { FileText, CalendarClock, FileIcon, Users, Trash2 } from '@lucide/svelte';
	import { t, tn } from '$lib/i18n';

	let {
		classId,
		assignment,
		onDelete,
		showAssignedCount = false,
	}: {
		classId: string;
		assignment: Assignment;
		onDelete: () => void;
		showAssignedCount?: boolean;
	} = $props();
</script>

<div class="rounded-xl border border-ink-900/10 bg-white shadow-soft">
	<div class="flex items-start justify-between gap-3 p-4">
		<button
			type="button"
			onclick={() => goto(`${base}/#/dashboard/${classId}/assignments/${assignment.id}`)}
			class="min-w-0 flex-1 text-left"
		>
			<div class="flex items-center gap-2">
				<FileText class="h-4 w-4 shrink-0 text-ink-400" />
				<p class="truncate text-[14.5px] font-semibold text-ink-900">
					{assignment.title ||
						assignment.instructions.split('\n')[0] ||
						t('common.untitledAssignment')}
				</p>
			</div>
			{#if assignment.instructions}
				<p class="mt-1 line-clamp-2 text-[13px] text-ink-500">
					{assignment.instructions}
				</p>
			{/if}
			<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-500">
				<span class="inline-flex items-center gap-1">
					<CalendarClock class="h-3.5 w-3.5 text-iris-500" />
					{t('classes.opens', { time: fmtDate(assignment.opensAt) })}
				</span>
				<span class="inline-flex items-center gap-1">
					<CalendarClock class="h-3.5 w-3.5 text-red-500" />
					{t('classes.due', { time: fmtDate(assignment.dueDate) })}
				</span>
				<span
					>{tn(
						assignment.requiredAttachments.length,
						'assignmentCard.requiredFilesCount',
						'assignmentCard.requiredFilesCountPlural',
					)}</span
				>
				{#if showAssignedCount}
					<span
						>{tn(
							assignment.assignedStudentIds.length,
							'assignmentCard.studentsAssigned',
							'assignmentCard.studentsAssignedPlural',
						)}</span
					>
				{/if}
			</div>
		</button>
		<div class="flex shrink-0 items-center gap-1">
			<Button
				variant="ghost"
				onclick={() =>
					goto(`${base}/#/dashboard/${classId}/assignments/${assignment.id}/submissions`)}
			>
				<Users class="h-3.5 w-3.5" />
				{t('assignmentCard.viewSubmissions')}
			</Button>
			<button
				type="button"
				onclick={onDelete}
				aria-label={t('assignmentCard.deleteAssignmentAria')}
				class="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
			>
				<Trash2 class="h-4 w-4" />
			</button>
		</div>
	</div>
	{#if assignment.requiredAttachments.length > 0}
		<div class="border-t border-ink-900/5 px-4 py-2.5">
			<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
				{t('assignmentEditor.requiredAttachments')}
			</p>
			<ul class="space-y-1">
				{#each assignment.requiredAttachments as req}
					<li class="flex items-start gap-2 text-[12.5px] text-ink-600">
						<FileIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
						<span>{req.instruction || t('common.untitledRequiredFile')}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
