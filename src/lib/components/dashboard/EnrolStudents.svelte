<script lang="ts">
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import type { Student } from '$lib/dashboard/types';
	import ManageStudents from '$lib/components/dashboard/ManageStudents.svelte';
	import {
		Users,
		UserPlus,
		AlertCircle,
		CheckCircle2,
		Loader2,
		GraduationCap,
	} from '@lucide/svelte';

	import { t, tn } from '$lib/i18n';
	import { translateApiError } from '$lib/i18n/apiErrors';

	let { classId }: { classId: string } = $props();

	let students: Student[] | undefined = $state(undefined);
	let studentsLoading = $state(false);
	let selectedStudents: Student[] = $state([]);
	let enrolling = $state(false);
	let error: string | null = $state(null);
	let success: string | null = $state(null);

	async function loadStudents() {
		error = null;
		studentsLoading = true;
		try {
			const user = authState.user;
			if (!user) throw new Error('Not logged in');
			const token = await user.getIdToken();

			const res = await fetch(functionsUrl('getStudents'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ classId }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(translateApiError(body?.message));
			}

			const data = await res.json();
			students = data.students;
		} catch (err) {
			error = err instanceof Error ? err.message : t('common.somethingWentWrong');
			students = [];
		} finally {
			studentsLoading = false;
		}
	}

	$effect(() => {
		loadStudents();
	});

	async function addStudents() {
		if (selectedStudents.length === 0) {
			error = t('students.selectAtLeastOne');
			return;
		}

		enrolling = true;
		error = null;
		success = null;

		try {
			const user = authState.user;
			if (!user) throw new Error('Not logged in');
			const token = await user.getIdToken();

			const res = await fetch(functionsUrl('enrolStudents'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					classId,
					studentIds: selectedStudents.map((s) => s.id),
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(translateApiError(body?.message));
			}

			success = t('students.enrolledSuccessfully', { count: selectedStudents.length });
			selectedStudents = [];
			await loadStudents();
		} catch (err) {
			error = err instanceof Error ? err.message : t('common.somethingWentWrong');
		} finally {
			enrolling = false;
		}
	}

	const columnCount = 5;

	function handleSelectedStudents(s: Student[]) {
		selectedStudents = s;
	}
</script>

<div class="mx-auto w-full min-w-0 max-w-5xl px-4 py-10">
	<section class="rounded-lg border border-gray-200 bg-white shadow-sm">
		<div class="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
			<div class="flex items-center gap-2.5">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600"
				>
					<Users size={16} />
				</div>
				<div>
					<h1 class="text-sm font-semibold text-gray-900">
						{t('students.enrolledStudents')}
					</h1>
					<p class="text-xs text-gray-500">
						{students === undefined || studentsLoading
							? t('students.loadingRoster')
							: tn(
									students.length,
									'students.enrolledCount',
									'students.enrolledCountPlural',
								)}
					</p>
				</div>
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="min-w-full text-sm">
				<thead>
					<tr
						class="border-b border-gray-100 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500"
					>
						<th class="px-5 py-2.5 text-left font-medium">{t('students.studentId')}</th>
						<th class="px-5 py-2.5 text-left font-medium">{t('students.fullName')}</th>
						<th class="px-5 py-2.5 text-left font-medium">{t('students.email')}</th>
						<th class="px-5 py-2.5 text-left font-medium">{t('students.role')}</th>
						<th class="px-5 py-2.5 text-left font-medium">{t('students.year')}</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#if studentsLoading || students === undefined}
						{#each Array(4) as _, i}
							<tr>
								<td colspan={columnCount} class="px-5 py-3">
									<div
										class="h-4 w-full max-w-md animate-pulse rounded bg-gray-100"
									></div>
								</td>
							</tr>
						{/each}
					{:else if students.length === 0}
						<tr>
							<td colspan={columnCount} class="px-5 py-10">
								<div
									class="flex flex-col items-center justify-center gap-2 text-center"
								>
									<GraduationCap size={22} class="text-gray-300" />
									<p class="text-sm font-medium text-gray-600">
										{t('students.noStudentsEnrolledYet')}
									</p>
									<p class="text-xs text-gray-400">
										{t('students.importStudentsHint')}
									</p>
								</div>
							</td>
						</tr>
					{:else}
						{#each students as user, idx (user.id)}
							<tr
								class={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} transition-colors hover:bg-blue-50/60`}
							>
								<td
									class="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-gray-500"
								>
									{user.rama_id}
								</td>
								<td class="whitespace-nowrap px-5 py-2.5">
									<div class="flex items-center gap-2.5">
										<span class="font-medium text-gray-800">{user.name}</span>
									</div>
								</td>
								<td class="whitespace-nowrap px-5 py-2.5 text-gray-500"
									>{user.email}</td
								>
								<td class="whitespace-nowrap px-5 py-2.5">
									<span
										class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-600"
									>
										{user.role}
									</span>
								</td>
								<td class="whitespace-nowrap px-5 py-2.5 text-gray-500"
									>{user.year}</td
								>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	<section class="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
		<div class="flex items-center gap-2.5 border-b border-gray-100 px-5 py-4">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600"
			>
				<UserPlus size={16} />
			</div>
			<div>
				<h1 class="text-sm font-semibold text-gray-900">
					{t('students.importFromStudentList')}
				</h1>
				<p class="text-xs text-gray-500">
					{t('students.selectStudentsHint')}
				</p>
			</div>
		</div>

		<div class="px-5 py-4">
			<ManageStudents showImportedStudents={false} />
		</div>
	</section>
</div>
