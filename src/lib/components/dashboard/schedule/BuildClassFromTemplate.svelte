<script lang="ts">
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { db } from '$lib/firebase';
	import { collection, getDocs, where, query } from 'firebase/firestore';
	import type { CourseTemplate, Student } from '$lib/dashboard/types';
	import { Button, Input, Modal } from '$lib/components/ui';
	import { AlertCircle, Loader2, CalendarCheck } from '@lucide/svelte';
	import moment from 'moment';
	import { t } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';

	let {
		template,
		onClose,
		onBuilt,
	}: {
		template: CourseTemplate;
		onClose: () => void;
		onBuilt: (classId: string) => void;
	} = $props();

	let name = $state(`${template.name || 'Class'} - ${moment().format('MMM D, YYYY')}`);
	let code = $state(template.code ?? '');
	let startDate = $state(moment().add(1, 'day').format('YYYY-MM-DD'));
	let students = $state<Student[]>([]);
	let studentsLoading = $state(false);
	let selectedStudentIds = $state<string[]>([]);
	let building = $state(false);
	let error = $state<string | null>(null);

	async function loadStudents() {
		studentsLoading = true;
		try {
			const snap = await getDocs(
				query(collection(db, 'users'), where('role', 'in', ['student', 'resident'])),
			);
			students = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Student[];
			students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
		} catch (err) {
			console.error(err);
			error = t('templates.couldNotLoadStudents');
		} finally {
			studentsLoading = false;
		}
	}

	function toggleStudent(id: string) {
		if (selectedStudentIds.includes(id)) {
			selectedStudentIds = selectedStudentIds.filter((s) => s !== id);
		} else {
			selectedStudentIds = [...selectedStudentIds, id];
		}
	}

	async function handleBuild() {
		const user = authState.user;
		if (!user) return;
		if (!name.trim()) {
			error = t('templates.classRequired');
			return;
		}
		building = true;
		error = null;
		try {
			const token = await user.getIdToken();
			const res = await fetch(functionsUrl('createClassFromTemplate'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					templateId: template.id,
					name: name.trim(),
					code: code.trim(),
					startDate,
					studentIds: selectedStudentIds,
				}),
			});
			if (!res.ok) {
				const body = await res.json();
				throw new Error(translateApiError(body?.error));
			}
			const data = await res.json();
			onBuilt(data.classId);
		} catch (err) {
			console.error(err);
			error = err instanceof Error ? err.message : t('templates.couldNotBuildClass');
		} finally {
			building = false;
		}
	}

	$effect(() => {
		loadStudents();
	});
</script>

<Modal open title={t('templates.buildClassFromTemplate')} onclose={onClose}>
	<div class="space-y-4">
		<div class="rounded-lg bg-iris-50 px-3 py-2.5 text-[13px] text-iris-700">
			{t('templates.buildingFrom', {
				name: template.name || t('common.untitledTemplate'),
				count: template.lectures?.length ?? 0,
			})}
		</div>

		<Input
			label={t('dashboard.className')}
			bind:value={name}
			placeholder="e.g. Toxicology Rotation"
		/>
		<Input label={t('dashboard.code')} bind:value={code} placeholder="TOX 101" />
		<Input
			type="date"
			label={t('templates.startDate')}
			bind:value={startDate}
			hint={t('templates.startDateHint')}
		/>

		<div>
			<p class="mb-1.5 text-[13px] font-medium text-ink-700">
				{t('dashboard.enrolStudents')}
			</p>
			{#if studentsLoading}
				<div class="space-y-1.5">
					{#each Array(3) as _}
						<div class="h-8 w-full animate-pulse rounded-md bg-ink-900/5"></div>
					{/each}
				</div>
			{:else if students.length === 0}
				<p class="rounded-lg bg-ink-900/[0.03] px-3 py-2 text-[12.5px] text-ink-500">
					{t('templates.noStudentsFound')}
				</p>
			{:else}
				<div
					class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-ink-900/10 p-2"
				>
					{#each students as student (student.id)}
						<label
							class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition hover:bg-ink-900/[0.03]"
						>
							<input
								type="checkbox"
								checked={selectedStudentIds.includes(student.id)}
								onchange={() => toggleStudent(student.id)}
								class="h-4 w-4 rounded border-ink-900/20 text-iris-600 focus:ring-iris-500"
							/>
							<span class="min-w-0 flex-1 truncate font-medium text-ink-700">
								{student.name}
							</span>
							<span class="shrink-0 font-mono text-[11.5px] text-ink-400">
								{student.rama_id}
							</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>

		{#if error}
			<p
				class="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600"
			>
				<AlertCircle class="h-4 w-4 shrink-0" />
				{error}
			</p>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={onClose}>{t('common.cancel')}</Button>
		<Button variant="accent" disabled={building} onclick={handleBuild}>
			{#if building}
				<Loader2 class="h-4 w-4 animate-spin" />
				{t('templates.building')}
			{:else}
				<CalendarCheck class="h-4 w-4" />
				{t('templates.buildClass')}
			{/if}
		</Button>
	{/snippet}
</Modal>
