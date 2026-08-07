<script lang="ts">
	import type {
		ClassItem,
		Lecture,
		Material,
		MaterialType,
	} from '$lib/dashboard/types';
	import { MATERIAL_LABELS } from '$lib/dashboard/types';
	import { MATERIAL_ICON, MATERIAL_COLOR } from '$lib/dashboard/icons';
	import { authState } from '$lib/auth.svelte';
	import { db } from '$lib/firebase';
	import {
		collection,
		getDocs,
		addDoc,
		serverTimestamp,
		updateDoc,
		deleteDoc,
		doc,
	} from 'firebase/firestore';
	import { ChevronRight } from '@lucide/svelte';
	import { Button, Input, Modal } from '$lib/components/ui';
	import { DragDropProvider, DragOverlay } from '@dnd-kit/svelte';
	import { initMaterialState, type MaterialState } from '$lib/dashboard/materialState';
	import * as Utils from '$lib/dashboard/utils';
	import MaterialItem from './materials/MaterialItem.svelte';
	import QuizPicker from './materials/QuizPicker.svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let {
		selectedClass,
		selectedLecture,
		highlightMaterialId = undefined,
		onUpdateLecture,
		onBackToClasses,
		onBackToClass,
		onDeleteLecture,
	}: {
		selectedClass: ClassItem;
		selectedLecture: Lecture;
		highlightMaterialId: string | undefined;
		onUpdateLecture: (patch: Partial<Pick<Lecture, 'title' | 'startTime' | 'endTime'>>) => void;
		onBackToClasses: () => void;
		onBackToClass: () => void;
		onDeleteLecture: (classId: string, lectureId: string) => void;
	} = $props();

	let lectureMaterials: Material[] = $state([]);
	let materialsOrder: string[] = $state([]);
	let materialsLoading = $state(false);
	let leSaving = $state(false);
	let showQuizPicker = $state(false);
	let leDeleteLecture = $state(false);
	let leShowConfirm = $state(false);

	let materialStates = $state<Record<string, MaterialState>>({});

	let lastLectureId = $state<string | null>(null);
	let baselineReady = $state(false);
	let baselineLecture = $state({ title: '', startTime: 0, endTime: 0 });
	let baselineMaterials = $state<
		{ id: string; type: string; title: string; value: string; requiredPostTest: boolean }[]
	>([]);
	let baselineOrder = $state<string[]>([]);
	let allowLeave = $state(false);
	let showLeaveWarning = $state(false);
	let pendingUrl = $state<string | null>(null);

	function syncBaseline() {
		baselineLecture = {
			title: selectedLecture.title,
			startTime: new Date(selectedLecture.startTime).getTime(),
			endTime: new Date(selectedLecture.endTime).getTime(),
		};
		baselineMaterials = lectureMaterials.map((m) => ({
			id: m.id,
			type: m.type,
			title: m.title,
			value: m.value,
			requiredPostTest: m.requiredPostTest ?? false,
		}));
		baselineOrder = [...materialsOrder];
	}

	const lectureChanged = $derived(
		baselineReady &&
			(baselineLecture.title !== selectedLecture.title ||
				baselineLecture.startTime !== new Date(selectedLecture.startTime).getTime() ||
				baselineLecture.endTime !== new Date(selectedLecture.endTime).getTime()),
	);
	const materialsChanged = $derived(
		baselineReady &&
			(baselineOrder.join('\x00') !== materialsOrder.join('\x00') ||
				baselineMaterials.length !== lectureMaterials.length ||
				baselineMaterials.some((b, i) => {
					const m = lectureMaterials[i];
					return (
						!m ||
						m.id !== b.id ||
						m.type !== b.type ||
						m.title !== b.title ||
						m.value !== b.value ||
						(m.requiredPostTest ?? false) !== b.requiredPostTest
					);
				})),
	);
	const dirty = $derived(lectureChanged || materialsChanged);
	const timeInvalid = $derived(
		new Date(selectedLecture.startTime).getTime() >= new Date(selectedLecture.endTime).getTime(),
	);
	const startTimeError = $derived(
		Utils.validateDateTimeInput(Utils.dateToStringInput(selectedLecture.startTime)),
	);
	const endTimeError = $derived(
		Utils.validateDateTimeInput(Utils.dateToStringInput(selectedLecture.endTime)),
	);

	$effect(() => {
		if (lastLectureId !== selectedLecture.id) {
			lastLectureId = selectedLecture.id;
			baselineReady = false;
			allowLeave = false;
		}
	});

	beforeNavigate((navigation) => {
		if (allowLeave || !dirty) return;
		const url = navigation.to?.url;
		if (!url) return;
		navigation.cancel();
		pendingUrl = url.pathname + url.search;
		showLeaveWarning = true;
	});

	onMount(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (dirty) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	function confirmLeave() {
		allowLeave = true;
		showLeaveWarning = false;
		onUpdateLecture({
			title: baselineLecture.title,
			startTime: new Date(baselineLecture.startTime),
			endTime: new Date(baselineLecture.endTime),
		});
		if (pendingUrl) {
			goto(pendingUrl);
		}
	}

	function ensureMaterialState(mat: Material) {
		if (!materialStates[mat.id]) {
			materialStates[mat.id] = initMaterialState(mat);
		}
	}

	async function loadMaterialsForLecture(classId: string, lectureId: string) {
		materialsLoading = true;
		try {
			const snapshot = await getDocs(
				collection(db, 'classes', classId, 'lectures', lectureId, 'materials'),
			);
			const mats: Material[] = snapshot.docs.map((d) => ({
				id: d.id,
				type: d.data()?.type,
				title: d.data()?.title,
				value: d.data()?.value,
				requiredPostTest: d.data()?.requiredPostTest ?? false,
			}));
			const lecOrder = selectedLecture.materialsOrder;
			if (lecOrder && lecOrder.length > 0) {
				mats.sort((a, b) => {
					const aIdx = lecOrder.indexOf(a.id);
					const bIdx = lecOrder.indexOf(b.id);
					return (aIdx === -1 ? Infinity : aIdx) - (bIdx === -1 ? Infinity : bIdx);
				});
				materialsOrder = lecOrder;
			} else {
				materialsOrder = mats.map((m) => m.id);
			}
			lectureMaterials = mats;
			for (const mat of mats) {
				ensureMaterialState(mat);
			}
		} catch (err) {
			console.error(err);
		} finally {
			materialsLoading = false;
			syncBaseline();
			baselineReady = true;
		}
	}

	const classId = $derived(selectedClass.id);
	const lectureId = $derived(selectedLecture.id);

	$effect(() => {
		loadMaterialsForLecture(classId, lectureId);
	});

	function updateMaterialLocal(
		materialId: string,
		patch: Partial<Pick<Material, 'title' | 'value'>>,
	) {
		lectureMaterials = lectureMaterials.map((m) =>
			m.id === materialId ? { ...m, ...patch } : m,
		);
	}

	function persistMaterialsOrder(classId: string, lectureId: string, order: string[]) {
		return updateDoc(doc(db, 'classes', classId, 'lectures', lectureId), {
			materialsOrder: order,
		});
	}

	async function addMaterialOp(type: MaterialType) {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		const docRef = await addDoc(
			collection(db, 'classes', classId, 'lectures', lectureId, 'materials'),
			{
				type,
				title: Utils.defaultMaterialTitle(type),
				value: '',
				createdAt: serverTimestamp(),
			},
		);
		const newMat: Material = {
			id: docRef.id,
			type,
			title: Utils.defaultMaterialTitle(type),
			value: '',
		};
		const newOrder = [...materialsOrder, docRef.id];
		materialsOrder = newOrder;
		lectureMaterials = [...lectureMaterials, newMat];
		ensureMaterialState(newMat);
		await persistMaterialsOrder(classId, lectureId, newOrder);
	}

	async function addMaterialWithQuiz(quizId: string, quizTitle: string) {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		const docRef = await addDoc(
			collection(db, 'classes', classId, 'lectures', lectureId, 'materials'),
			{
				type: 'quiz',
				title: quizTitle,
				value: quizId,
				createdAt: serverTimestamp(),
			},
		);
		const newMat: Material = { id: docRef.id, type: 'quiz', title: quizTitle, value: quizId };
		const newOrder = [...materialsOrder, docRef.id];
		materialsOrder = newOrder;
		lectureMaterials = [...lectureMaterials, newMat];
		ensureMaterialState(newMat);
		await persistMaterialsOrder(classId, lectureId, newOrder);
	}

	function handleAddMaterial(type: MaterialType) {
		if (type === 'quiz') {
			showQuizPicker = true;
		} else {
			addMaterialOp(type);
		}
	}

	async function handleMaterialDragEnd(draggedId: string, targetId: string) {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		const oldIndex = materialsOrder.indexOf(draggedId);
		const newIndex = materialsOrder.indexOf(targetId);
		if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

		const newOrder = [...materialsOrder];
		const [moved] = newOrder.splice(oldIndex, 1);
		newOrder.splice(newIndex, 0, moved);
		materialsOrder = newOrder;

		lectureMaterials = [...lectureMaterials].sort((a, b) => {
			const aIdx = newOrder.indexOf(a.id);
			const bIdx = newOrder.indexOf(b.id);
			return aIdx - bIdx;
		});

		await persistMaterialsOrder(classId, lectureId, newOrder);
	}

	function handleDragEnd(event: {
		operation: {
			source: { id: string | number } | null;
			target: { id: string | number } | null;
		};
		canceled: boolean;
	}) {
		if (event.canceled) return;
		const sourceId = event.operation.source?.id;
		const targetId = event.operation.target?.id;
		if (sourceId != null && targetId != null && sourceId !== targetId) {
			handleMaterialDragEnd(String(sourceId), String(targetId));
		}
	}

	async function deleteMaterialOp(materialId: string) {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;

		const mat = lectureMaterials.find((m) => m.id === materialId);
		const state = materialStates[materialId];
		if (mat?.type === 'video' && state?.videoId) {
			try {
				const user = authState.user;
				const token = await user?.getIdToken();
				await fetch('https://us-central1-rama-toxico-edu.cloudfunctions.net/deleteVideo', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ videoId: state.videoId }),
				});
			} catch (err) {
				console.error(err);
			}
		}

		const newOrder = materialsOrder.filter((id) => id !== materialId);
		materialsOrder = newOrder;
		lectureMaterials = lectureMaterials.filter((m) => m.id !== materialId);

		await persistMaterialsOrder(classId, lectureId, newOrder);
		deleteDoc(
			doc(db, 'classes', classId, 'lectures', lectureId, 'materials', materialId),
		).catch(console.error);
	}

	async function toggleRequiredPostTest(mat: Material, checked: boolean) {
		lectureMaterials = lectureMaterials.map((m) =>
			m.id === mat.id ? { ...m, requiredPostTest: checked } : m,
		);
		await updateDoc(
			doc(
				db,
				'classes',
				selectedClass.id,
				'lectures',
				selectedLecture.id,
				'materials',
				mat.id,
			),
			{ requiredPostTest: checked },
		);
	}

	async function saveLectureChanges() {
		if (timeInvalid) return;
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		leSaving = true;
		try {
			const lec = selectedLecture;
			if (!lec) return;
			await updateDoc(doc(db, 'classes', classId, 'lectures', lectureId), {
				title: lec.title,
				startTime: lec.startTime,
				endTime: lec.endTime,
			});
			await Promise.all(
				lectureMaterials.map((mat) => {
					const patch: Record<string, unknown> = {};
					if (mat.type !== undefined) patch.type = mat.type;
					if (mat.title !== undefined) patch.title = mat.title;
					if (mat.value !== undefined) patch.value = mat.value;
					if (mat.requiredPostTest !== undefined)
						patch.requiredPostTest = mat.requiredPostTest;
					return updateDoc(
						doc(db, 'classes', classId, 'lectures', lectureId, 'materials', mat.id),
						patch,
					);
				}),
			);
			syncBaseline();
		} catch (err) {
			console.error(err);
		} finally {
			leSaving = false;
		}
	}

	async function handleDeleteLecture() {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		leDeleteLecture = true;
		try {
			await deleteDoc(doc(db, 'classes', classId, 'lectures', lectureId));
			leShowConfirm = false;
			onDeleteLecture(classId, lectureId);
		} catch (err) {
			console.error(err);
		} finally {
			leDeleteLecture = false;
		}
	}

	const materialTypes: MaterialType[] = ['video', 'file', 'link', 'text', 'quiz'];
</script>

<div class="mx-auto max-w-xl px-8 py-10">
	<div class="flex item-center justify-between">
		<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">Lecture</p>
		<Button variant="accent" disabled={leSaving || !dirty || timeInvalid} onclick={saveLectureChanges}>
			{#if leSaving}
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></div>
				Saving…
			{:else}
				Save changes
			{/if}
		</Button>
	</div>
	<div class="mt-4">
		<Input
			label="Lecture title"
			value={selectedLecture.title}
			oninput={(e) => {
				const target = e.target as HTMLInputElement;
				onUpdateLecture({ title: target.value });
			}}
			placeholder="e.g. Sorting Algorithms"
		/>
	</div>

	<div class="mt-4 grid grid-cols-2 gap-3">
		<Input
			type="datetime-local"
			label="Start time"
			value={Utils.dateToStringInput(selectedLecture.startTime)}
			error={startTimeError ?? ''}
			oninput={(e) => {
				const target = e.target as HTMLInputElement;
				onUpdateLecture({
					startTime: Utils.stringInputToDate(target.value),
				});
			}}
		/>
		<Input
			type="datetime-local"
			label="End time"
			value={Utils.dateToStringInput(selectedLecture.endTime)}
			error={endTimeError ?? (timeInvalid ? 'End time must be after the start time.' : '')}
			oninput={(e) => {
				const target = e.target as HTMLInputElement;
				onUpdateLecture({
					endTime: Utils.stringInputToDate(target.value),
				});
			}}
		/>
	</div>

	{#if timeInvalid}
		<p
			class="mt-2 rounded-md bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-600"
		>
			End time must be after the start time.
		</p>
	{/if}

	<div class="mt-9 border-t border-ink-900/10 pt-6">
		<p class="text-[13.5px] font-medium text-ink-900">
			Class materials
			<span class="ml-1.5 font-normal text-ink-300">({lectureMaterials.length})</span>
		</p>

		{#if materialsLoading}
			<div class="flex items-center justify-center gap-2 py-8">
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
				></div>
				<span class="text-[13px] text-ink-500">Loading materials…</span>
			</div>
		{:else if lectureMaterials.length === 0}
			<p class="py-4 text-center text-[13px] text-ink-400">No materials yet.</p>
		{:else}
			<DragDropProvider onDragEnd={handleDragEnd}>
				<div class="mt-4 space-y-3">
					{#each lectureMaterials as mat, i (mat.id)}
						{@const state = materialStates[mat.id]}
						{@const highlighted = mat.id === highlightMaterialId}
						{#if state}
							<MaterialItem
								material={mat}
								{state}
								index={i}
								classId={selectedClass.id}
								lectureId={selectedLecture.id}
								{highlighted}
								onTitleChange={(title) => updateMaterialLocal(mat.id, { title })}
								onValueChange={(value) => updateMaterialLocal(mat.id, { value })}
								onDelete={() => deleteMaterialOp(mat.id)}
								onTogglePostTest={(checked) => toggleRequiredPostTest(mat, checked)}
							/>
						{/if}
					{/each}
				</div>
				<DragOverlay>
					{#snippet children(dragSource)}
						{@const data = dragSource.data as { title?: string; type?: MaterialType }}
						<div
							class="flex items-center gap-2.5 rounded-xl border border-ink-900/10 bg-white p-3.5 shadow-xl"
						>
							<span
								class={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
									MATERIAL_COLOR[data.type ?? 'link'].bg
								} ${MATERIAL_COLOR[data.type ?? 'link'].text}`}
							>
								<svelte:component
									this={MATERIAL_ICON[data.type ?? 'link']}
									class="h-3.5 w-3.5"
								/>
							</span>
							<span class="text-[13px] font-medium text-ink-900">
								{data.title || 'Material'}
							</span>
						</div>
					{/snippet}
				</DragOverlay>
			</DragDropProvider>
		{/if}

		<div class="mt-4">
			<p class="mb-2 text-[12.5px] font-medium text-ink-500">Add material</p>
			<div class="flex flex-wrap gap-2">
				{#each materialTypes as type}
					{@const Icon = MATERIAL_ICON[type]}
					{@const color = MATERIAL_COLOR[type]}
					<button
						type="button"
						disabled={materialsLoading}
						onclick={() => handleAddMaterial(type)}
						class={`flex items-center gap-1.5 rounded-lg border border-ink-900/10 bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-700 shadow-soft transition hover:border-transparent hover:${color.bg} disabled:cursor-not-allowed disabled:opacity-40`}
					>
						<span
							class={`flex h-4 w-4 items-center justify-center rounded ${color.bg} ${color.text}`}
						>
							<Icon class="h-2.5 w-2.5" />
						</span>
						{MATERIAL_LABELS[type]}
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if showQuizPicker}
		<QuizPicker
			onSelect={(quizId, quizTitle) => {
				addMaterialWithQuiz(quizId, quizTitle);
				showQuizPicker = false;
			}}
			onClose={() => (showQuizPicker = false)}
		/>
	{/if}

	<button
		type="button"
		onclick={() => (leShowConfirm = true)}
		disabled={leDeleteLecture}
		class="mt-12 mb-4 text-[13px] font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
	>
		{#if leDeleteLecture}
			Deleting...
		{:else}
			Delete this lecture
		{/if}
	</button>

	<Modal open={leShowConfirm} title="Delete lecture?" onclose={() => (leShowConfirm = false)}>
		<p class="text-[13px] text-ink-500">
			This will permanently delete "{selectedLecture.title}" and all its materials. This
			action cannot be undone.
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (leShowConfirm = false)}>Cancel</Button>
			<Button variant="danger-solid" disabled={leDeleteLecture} onclick={handleDeleteLecture}>
				{leDeleteLecture ? 'Deleting...' : 'Delete'}
			</Button>
		{/snippet}
	</Modal>

	<Modal
		open={showLeaveWarning}
		title="Unsaved changes"
		onclose={() => (showLeaveWarning = false)}
	>
		<p class="text-[13px] text-ink-500">
			You have unsaved changes to this lecture. If you leave now, your changes will be lost.
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (showLeaveWarning = false)}>
				Keep editing
			</Button>
			<Button variant="danger-solid" onclick={confirmLeave}>
				Discard &amp; leave
			</Button>
		{/snippet}
	</Modal>
</div>
