<script lang="ts">
	import type { Material, MaterialType, TemplateLecture } from '$lib/dashboard/types';
	import { getMaterialLabel } from '$lib/dashboard/types';
	import { MATERIAL_ICON, MATERIAL_COLOR } from '$lib/dashboard/icons';
	import { DragDropProvider, DragOverlay } from '@dnd-kit/svelte';
	import { Button, Input, Modal, Select } from '$lib/components/ui';
	import { Plus } from '@lucide/svelte';
	import * as Utils from '$lib/dashboard/utils';
	import TemplateMaterialEditor from './TemplateMaterialEditor.svelte';
	import QuizPicker from '../materials/QuizPicker.svelte';
	import moment from 'moment';
	import { t } from '$lib/i18n';

	let {
		templateId,
		lecture,
		onUpdateLecture,
		onDelete,
		bare = false,
		deleteConfirmOpen = $bindable(false),
	}: {
		templateId: string;
		lecture: TemplateLecture;
		onUpdateLecture: (
			patch: Partial<Pick<TemplateLecture, 'title' | 'startTime' | 'endTime'>>,
		) => void;
		onDelete: () => void;
		bare?: boolean;
		deleteConfirmOpen?: boolean;
	} = $props();

	const materialTypes: MaterialType[] = ['video', 'file', 'link', 'text', 'quiz'];

	const DAY_OPTIONS = $derived([
		{ value: '1', label: t('templates.daySunday') },
		{ value: '2', label: t('templates.dayMonday') },
		{ value: '3', label: t('templates.dayTuesday') },
		{ value: '4', label: t('templates.dayWednesday') },
		{ value: '5', label: t('templates.dayThursday') },
		{ value: '6', label: t('templates.dayFriday') },
		{ value: '7', label: t('templates.daySaturday') },
	]);

	let lectureMaterials = $state<Material[]>([...(lecture.materials ?? [])]);
	let materialsOrder = $state<string[]>([...(lecture.materialsOrder ?? [])]);
	let materialsLoading = $state(false);
	let showQuizPicker = $state(false);
	let deleting = $state(false);

	const timeInvalid = $derived(
		Utils.templateTimeToMs(lecture.startTime) >= Utils.templateTimeToMs(lecture.endTime),
	);

	$effect(() => {
		lecture.materials = lectureMaterials;
		lecture.materialsOrder = materialsOrder;
	});

	async function addMaterialOp(type: MaterialType) {
		const newMat: Material = {
			id: Utils.makeId(),
			type,
			title: Utils.defaultMaterialTitle(type),
			value: '',
		};
		materialsOrder = [...materialsOrder, newMat.id];
		lectureMaterials = [...lectureMaterials, newMat];
	}

	async function addMaterialWithQuiz(quizId: string, quizTitle: string) {
		const newMat: Material = {
			id: Utils.makeId(),
			type: 'quiz',
			title: quizTitle,
			value: quizId,
		};
		materialsOrder = [...materialsOrder, newMat.id];
		lectureMaterials = [...lectureMaterials, newMat];
	}

	function handleAddMaterial(type: MaterialType) {
		if (type === 'quiz') {
			showQuizPicker = true;
		} else {
			addMaterialOp(type);
		}
	}

	function updateMaterialLocal(id: string, patch: Partial<Material>) {
		lectureMaterials = lectureMaterials.map((m) => (m.id === id ? { ...m, ...patch } : m));
	}

	async function handleTitleChange(id: string, title: string) {
		updateMaterialLocal(id, { title });
	}

	async function handleValueChange(id: string, value: string) {
		updateMaterialLocal(id, { value });
	}

	async function toggleRequiredPostTest(mat: Material, checked: boolean) {
		updateMaterialLocal(mat.id, { requiredPostTest: checked });
	}

	async function deleteMaterialOp(id: string) {
		materialsOrder = materialsOrder.filter((mid) => mid !== id);
		lectureMaterials = lectureMaterials.filter((m) => m.id !== id);
	}

	async function handleMaterialDragEnd(draggedId: string, targetId: string) {
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

	async function handleDelete() {
		deleting = true;
		try {
			onDelete();
		} finally {
			deleting = false;
		}
	}

	function updateLectureFields(
		patch: Partial<Pick<TemplateLecture, 'title' | 'startTime' | 'endTime'>>,
	) {
		Object.assign(lecture, patch);
		onUpdateLecture(patch);
	}

	function handleDayChange(e: Event) {
		const day = Number((e.target as HTMLSelectElement).value);
		if (Number.isNaN(day) || day < 1 || day > 7) return;
		updateLectureFields({
			startTime: { ...lecture.startTime, day },
			endTime: { ...lecture.endTime, day },
		});
	}

	function applyTime(existing: Date, value: string): Date {
		const [h, m] = value.split(':').map(Number);
		const d = new Date(existing);
		if (!Number.isNaN(h)) d.setHours(h);
		if (!Number.isNaN(m)) d.setMinutes(m);
		d.setSeconds(0, 0);
		return d;
	}
</script>

<div class={bare ? '' : 'rounded-xl border border-ink-900/10 bg-white shadow-soft'}>
	<div class="flex items-start justify-between gap-3 border-b border-ink-900/5 p-4">
		<div class="min-w-0 flex-1">
			<Input
				label={t('templates.lectureTemplateTitle')}
				value={lecture.title}
				oninput={(e) =>
					updateLectureFields({ title: (e.target as HTMLInputElement).value })}
				placeholder="e.g. Introduction to Toxicology"
			/>
			<div class="mt-3 grid grid-cols-3 gap-3">
				<Select
					label={t('templates.dayOfWeek')}
					options={DAY_OPTIONS}
					value={String(lecture.startTime.day ?? 1)}
					onchange={handleDayChange}
				/>
				<Input
					type="time"
					label={t('lectureEditor.startTime')}
					value={moment(lecture.startTime.time).format('HH:mm')}
					error={timeInvalid ? t('lectureEditor.endAfterStart') : ''}
					oninput={(e) =>
						updateLectureFields({
							startTime: {
								week: lecture.startTime.week,
								day: lecture.startTime.day,
								time: applyTime(
									lecture.startTime.time,
									(e.target as HTMLInputElement).value,
								),
							},
						})}
				/>
				<Input
					type="time"
					label={t('lectureEditor.endTime')}
					value={moment(lecture.endTime.time).format('HH:mm')}
					oninput={(e) =>
						updateLectureFields({
							endTime: {
								week: lecture.endTime.week,
								day: lecture.endTime.day,
								time: applyTime(
									lecture.endTime.time,
									(e.target as HTMLInputElement).value,
								),
							},
						})}
				/>
			</div>
		</div>
	</div>

	<div class="p-4">
		{#if lectureMaterials.length === 0}
			<p class="py-4 text-center text-[13px] text-ink-400">
				{t('lectureEditor.noMaterialsYet')}
			</p>
		{:else}
			<DragDropProvider onDragEnd={handleDragEnd}>
				<div class="space-y-3">
					{#each lectureMaterials as mat, i (mat.id)}
						<TemplateMaterialEditor
							material={mat}
							index={i}
							{templateId}
							lectureId={lecture.id}
							onTitleChange={(t) => handleTitleChange(mat.id, t)}
							onValueChange={(v) => handleValueChange(mat.id, v)}
							onTogglePostTest={(checked) => toggleRequiredPostTest(mat, checked)}
							onDelete={() => deleteMaterialOp(mat.id)}
							persistValue={(v) => handleValueChange(mat.id, v)}
						/>
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
								{data.title || t('lectureEditor.material')}
							</span>
						</div>
					{/snippet}
				</DragOverlay>
			</DragDropProvider>
		{/if}

		<div class="mt-4">
			<p class="mb-2 text-[12.5px] font-medium text-ink-500">
				{t('lectureEditor.addMaterial')}
			</p>
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
						{getMaterialLabel(type)}
					</button>
				{/each}
			</div>
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

{#if deleteConfirmOpen}
	<Modal
		open
		title={t('templates.deleteLectureTemplateTitle')}
		onclose={() => (deleteConfirmOpen = false)}
	>
		<p class="text-[13px] text-ink-500">
			{t('templates.deleteLectureTemplateConfirm', { title: lecture.title })}
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (deleteConfirmOpen = false)}
				>{t('common.cancel')}</Button
			>
			<Button variant="danger-solid" disabled={deleting} onclick={handleDelete}>
				{deleting ? t('common.deletingEllipsis') : t('common.delete')}
			</Button>
		{/snippet}
	</Modal>
{/if}
