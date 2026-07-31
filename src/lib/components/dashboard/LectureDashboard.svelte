<script lang="ts">
	import type { ClassItem, Lecture, Material, Selection } from '$lib/dashboard/types';
	import TreeView from '$lib/components/dashboard/TreeView.svelte';
	import ManageStudents from '$lib/components/dashboard/ManageStudents.svelte';
	import EnrolStudents from '$lib/components/dashboard/EnrolStudents.svelte';
	import LectureEditor from '$lib/components/dashboard/LectureEditor.svelte';
	import ClassEditor from '$lib/components/dashboard/ClassEditor.svelte';
	import DashboardLayout from '$lib/components/DashboardLayout.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import { db } from '$lib/firebase';
	import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
	import { Plus, UserRound, ChevronRight, Folder } from '@lucide/svelte';
	import * as Utils from '$lib/dashboard/utils';
	import * as Selectors from '$lib/dashboard/selectors';

	let classes: ClassItem[] = $state([]);
	let selection: Selection = $state(null);
	let loading = $state(true);
	let lectureLoading = $state(false);
	let expanded: Set<string> = $state(new Set<string>());

	$effect(() => {
		async function loadClasses() {
			loading = true;
			try {
				const snapshot = await getDocs(collection(db, 'classes'));
				const classesData = snapshot.docs.map((d) => ({
					id: d.id,
					name: d.data()['name'],
					code: d.data()['code'],
					lectures: undefined,
					students: d.data()['enroledStudents'],
				}));
				classes = classesData;
			} catch (err) {
				console.log(err);
			} finally {
				loading = false;
			}
		}
		loadClasses();
	});

	async function toggleExpand(classId: string, isCurrentlyExpanded: boolean) {
		const next = new Set(expanded);
		if (isCurrentlyExpanded) {
			next.delete(classId);
		} else {
			next.add(classId);
		}
		expanded = next;

		if (!isCurrentlyExpanded) {
			const currentClass = classes.find((cls) => cls.id === classId);
			const alreadyLoaded = currentClass?.lectures !== undefined;
			if (!alreadyLoaded) {
				const snapshot = await getDocs(collection(db, 'classes', classId, 'lectures'));
				const loadedLecs = snapshot.docs.map((d) => ({
					id: d.id,
					title: d.data()['title'],
					startTime: d.data()['startTime'].toDate(),
					endTime: d.data()['endTime'].toDate(),
					materials: [] as Material[],
					materialsOrder: (d.data()['materialsOrder'] as string[]) || [],
				}));
				classes = classes.map((cls) =>
					cls.id === classId ? { ...cls, lectures: loadedLecs } : cls,
				);
			}
		}
	}

	function expandIds(ids: string[]) {
		const next = new Set(expanded);
		ids.forEach((id) => next.add(id));
		expanded = next;
	}

	async function addClass() {
		const snapshot = await addDoc(collection(db, 'classes'), {
			name: 'New class',
			code: '',
			createdAt: serverTimestamp(),
		});
		const newClass: ClassItem = { id: snapshot.id, name: 'New class', code: '', lectures: [] };
		classes = [...classes, newClass];
		expandIds([snapshot.id]);
		selection = { level: 'class', classId: snapshot.id };
	}

	function manageStudents() {
		selection = { level: 'manage_students' };
	}

	function renameClass(classId: string, patch: Partial<Pick<ClassItem, 'name' | 'code'>>) {
		classes = classes.map((c) => (c.id === classId ? { ...c, ...patch } : c));
	}

	function deleteClass(classId: string) {
		classes = classes.filter((c) => c.id !== classId);
		if (selection && 'classId' in selection && selection.classId === classId) {
			selection = null;
		}
	}

	async function addLecture(classId: string) {
		const { startTime, endTime } = Utils.defaultTimes();
		const snapshot = await addDoc(collection(db, 'classes', classId, 'lectures'), {
			title: 'New lecture',
			startTime,
			endTime,
			createdAt: serverTimestamp(),
		});
		const newLecture: Lecture = {
			id: snapshot.id,
			title: 'New lecture',
			startTime,
			endTime,
			materials: [],
		};
		classes = classes.map((c) =>
			c.id === classId ? { ...c, lectures: [...(c.lectures ?? []), newLecture] } : c,
		);
		expandIds([classId, snapshot.id]);
		selection = { level: 'lecture', classId, lectureId: snapshot.id };
	}

	function updateLecture(
		classId: string,
		lectureId: string,
		patch: Partial<Pick<Lecture, 'title' | 'startTime' | 'endTime'>>,
	) {
		classes = classes.map((c) =>
			c.id !== classId
				? c
				: {
						...c,
						lectures: (c.lectures ?? []).map((l) =>
							l.id === lectureId ? { ...l, ...patch } : l,
						),
					},
		);
	}

	async function loadLectureForClass(sel: Selection) {
		selection = sel;
		if (sel && 'classId' in sel && sel.level === 'class') {
			lectureLoading = true;
			try {
				const snapshot = await getDocs(collection(db, 'classes', sel.classId, 'lectures'));
				const loadedLecs = snapshot.docs.map((d) => ({
					id: d.id,
					title: d.data()['title'],
					startTime: d.data()['startTime'].toDate(),
					endTime: d.data()['endTime'].toDate(),
					materials: [] as Material[],
					materialsOrder: (d.data()['materialsOrder'] as string[]) || [],
				}));
				classes = classes.map((cls) =>
					cls.id === sel.classId ? { ...cls, lectures: loadedLecs } : cls,
				);
				const next = new Set(expanded);
				if (next.has(sel.classId)) {
					next.delete(sel.classId);
				} else {
					next.add(sel.classId);
				}
				expanded = next;
			} finally {
				lectureLoading = false;
			}
		}
	}

	function deleteLecture(classId: string, lectureId: string) {
		classes = classes.map((c) =>
			c.id === classId
				? { ...c, lectures: (c.lectures ?? []).filter((l) => l.id !== lectureId) }
				: c,
		);
		if (selection && 'lectureId' in selection && selection.lectureId === lectureId) {
			selection = { level: 'class', classId };
		}
	}

	const selectedClass = $derived(Selectors.getSelectedClass(selection, classes));
	const selectedLecture = $derived(Selectors.getSelectedLecture(selection, selectedClass));
	const highlightMaterialId = $derived(Selectors.getHighlightMaterialId(selection));
</script>

<DashboardLayout sidebarClass="w-[300px]">
	{#snippet headerLeft()}
		<Breadcrumbs
			crumbs={[
				{ label: 'All Classes', onclick: () => (selection = null) },
				...(selectedClass
					? [
							{
								label: selectedClass.name,
								onclick: () =>
									(selection = { level: 'class', classId: selectedClass.id }),
							},
						]
					: []),
				...(selectedLecture
					? [{ label: selectedLecture.title || 'Untitled lecture', active: true }]
					: []),
			]}
		/>
	{/snippet}

	{#snippet sidebarBottom()}
		<div class="flex-1 overflow-y-auto px-2 pt-3">
			<div class="border-t border-ink-900/8 mx-2 my-2"></div>
			<p class="pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
				All classes
			</p>
			<TreeView
				{classes}
				{selection}
				{expanded}
				onToggle={toggleExpand}
				onSelect={loadLectureForClass}
			/>
			<div class="flex flex-col gap-1.5 pb-3">
				<button
					type="button"
					onclick={addClass}
					class="flex w-full items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-iris-600 transition hover:bg-iris-50"
				>
					<Plus class="h-3.5 w-3.5" />
					New class
				</button>
				<button
					type="button"
					onclick={manageStudents}
					class="flex w-full items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-teal-600 transition hover:bg-teal-50"
				>
					<UserRound class="h-3.5 w-3.5" />
					Manage Students
				</button>
			</div>
		</div>
	{/snippet}

	{#if loading}
		<div class="flex h-full items-center justify-center w-full">
			<div class="flex flex-col items-center gap-3">
				<div
					class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"
				></div>
				<span class="text-[13px] text-ink-500">Loading classes…</span>
			</div>
		</div>
	{:else if !selectedClass && !selection}
		<div class="block overflow-y-auto px-6 py-5 w-xl">
			<h2 class="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
				All Classes
			</h2>
			{#if classes.length === 0}
				<p class="px-2 text-sm text-ink-900/40">No classes yet.</p>
			{:else}
				<div class="space-y-2">
					{#each classes as cls}
						<button
							type="button"
							onclick={() => loadLectureForClass({ level: 'class', classId: cls.id })}
							class="flex w-full items-center gap-3 rounded-lg border border-ink-900/10 bg-white px-4 py-3 text-left shadow-soft transition hover:border-iris-400 hover:bg-iris-50"
						>
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-iris-50 text-iris-500"
							>
								<Folder class="h-4 w-4" />
							</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-ink-900">{cls.name}</p>
								{#if cls.code}
									<p class="truncate text-xs text-ink-400">{cls.code}</p>
								{/if}
							</div>
							<ChevronRight class="h-4 w-4 shrink-0 text-ink-300" />
						</button>
					{/each}
					<button
						type="button"
						onclick={addClass}
						class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-900/15 px-4 py-3 text-sm font-medium text-iris-600 transition hover:border-iris-400 hover:bg-iris-50"
					>
						<Plus class="h-4 w-4" />
						New class
					</button>
				</div>
			{/if}
		</div>
	{:else if !selectedClass && selection?.level === 'manage_students'}
		<div class="mx-auto max-w-full px-4 py-10">
			<div class="grid grid-row gap-3">
				<h1 class="text-lg font-semibold">Manage students</h1>
				<ManageStudents enableSelection={false} />
			</div>
		</div>
	{:else if selectedClass && selection?.level === 'class'}
		{#if lectureLoading}
			<div class="flex h-full w-full items-center justify-center">
				<div class="flex flex-col items-center gap-3">
					<div
						class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"
					></div>
					<span class="text-[13px] text-ink-500">Loading lectures…</span>
				</div>
			</div>
		{:else}
			<ClassEditor
				{selectedClass}
				onRename={(patch) => renameClass(selectedClass.id, patch)}
				onAddLecture={addLecture}
				onDeleteClass={deleteClass}
				onSelectLecture={loadLectureForClass}
				onNavigate={(sel) => (selection = sel)}
			/>
		{/if}
	{:else if selectedClass && selection?.level === 'enrol_student'}
		<EnrolStudents classId={selectedClass.id} />
	{:else if selectedClass && selectedLecture && (selection?.level === 'lecture' || selection?.level === 'material')}
		<LectureEditor
			{selectedClass}
			{selectedLecture}
			{highlightMaterialId}
			onUpdateLecture={(patch) => updateLecture(selectedClass.id, selectedLecture.id, patch)}
			onNavigate={(sel) => (selection = sel)}
			onDeleteLecture={deleteLecture}
		/>
	{/if}
</DashboardLayout>
