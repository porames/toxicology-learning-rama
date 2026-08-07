<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import DashboardLayout from '$lib/components/DashboardLayout.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import TreeView from '$lib/components/dashboard/TreeView.svelte';
	import { dashboardStore } from '$lib/dashboard/dashboardStore.svelte';
	import { db } from '$lib/firebase';
	import { doc, getDoc } from 'firebase/firestore';
	import { Plus, UserRound } from '@lucide/svelte';

	let { children }: { children: Snippet } = $props();

	const classId = $derived(page.params.classId);
	const lectureId = $derived(page.params.lectureId);
	const assignmentId = $derived(page.params.assignmentId);
	const isAssignmentsPage = $derived(page.url.pathname.includes('/assignments'));
	const selectedClass = $derived(classId ? dashboardStore.getClass(classId) : null);
	const selectedLecture = $derived(
		classId && lectureId ? dashboardStore.getLecture(classId, lectureId) : null,
	);

	let assignmentTitle = $state<string | null>(null);

	$effect(() => {
		async function loadAssignmentTitle() {
			if (!classId || !assignmentId) {
				assignmentTitle = null;
				return;
			}
			try {
				const snap = await getDoc(doc(db, 'classes', classId, 'assignments', assignmentId));
				const instructions: string = snap.exists() ? (snap.data()?.instructions ?? '') : '';
				assignmentTitle = instructions.split('\n')[0]?.trim() || 'Assignment';
			} catch (err) {
				console.error(err);
				assignmentTitle = null;
			}
		}
		loadAssignmentTitle();
	});

	$effect(() => {
		dashboardStore.loadClasses();
	});

	$effect(() => {
		if (classId) {
			dashboardStore.loadLecturesForClass(classId);
			dashboardStore.expandIds([classId]);
			if (lectureId) dashboardStore.expandIds([lectureId]);
		}
	});

	const crumbs = $derived([
		{ label: 'All Classes', href: '/dashboard' },
		...(selectedClass
			? [{ label: selectedClass.name, href: `/dashboard/${selectedClass.id}` }]
			: []),
		...(isAssignmentsPage
			? [
					{
						label: 'Assignments',
						href: assignmentId ? `/dashboard/${classId}/assignments` : undefined,
						active: !assignmentId,
					},
				]
			: []),
		...(assignmentId
			? [{ label: assignmentTitle ?? 'Assignment', active: true }]
			: []),
		...(selectedLecture
			? [{ label: selectedLecture.title || 'Untitled lecture', active: true }]
			: []),
	]);

	async function handleAddClass() {
		const id = await dashboardStore.addClass();
		goto(`/dashboard/${id}`);
	}
</script>

<DashboardLayout sidebarClass="w-[300px]">
	{#snippet headerLeft()}
		<Breadcrumbs crumbs={crumbs} />
	{/snippet}

	{#snippet sidebarBottom()}
		<div class="flex-1 overflow-y-auto px-2 pt-3">
			<div class="border-t border-ink-900/8 mx-2 my-2"></div>
			<p class="pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
				All classes
			</p>
			<TreeView
				classes={dashboardStore.classes}
				activeClassId={classId}
				activeLectureId={lectureId}
				expanded={dashboardStore.expanded}
				onToggle={(cid, isExpanded) => {
					dashboardStore.toggleExpand(cid, isExpanded);
					if (!isExpanded) dashboardStore.loadLecturesForClass(cid);
				}}
				onSelectClass={(cid) => goto(`/dashboard/${cid}`)}
				onSelectLecture={(cid, lid) => goto(`/dashboard/${cid}/${lid}`)}
			/>
			<div class="flex flex-col gap-1.5 pb-3">
				<button
					type="button"
					onclick={handleAddClass}
					class="flex w-full items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-iris-600 transition hover:bg-iris-50"
				>
					<Plus class="h-3.5 w-3.5" />
					New class
				</button>
				<button
					type="button"
					onclick={() => goto('/dashboard/students')}
					class="flex w-full items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-teal-600 transition hover:bg-teal-50"
				>
					<UserRound class="h-3.5 w-3.5" />
					Manage Students
				</button>
			</div>
		</div>
	{/snippet}

	{@render children()}
</DashboardLayout>
