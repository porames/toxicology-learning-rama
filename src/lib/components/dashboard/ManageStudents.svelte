<script lang="ts">
	import { db } from '$lib/firebase';
	import { collection, getDocs } from 'firebase/firestore';
	import type { Student } from '$lib/dashboard/types';
	import GoogleSheetsImport from '$lib/components/dashboard/GoogleSheetsImport.svelte';
	import StudentTable from '$lib/components/dashboard/StudentTable.svelte';
	import { t } from '$lib/i18n';

	let {
		enableSelection = false,
		classId,
		setSelectedStudents,
		showImportedStudents = true,
	}: {
		enableSelection?: boolean;
		classId?: string;
		setSelectedStudents?: (students: Student[]) => void;
		showImportedStudents?: boolean;
	} = $props();

	let students: Student[] | undefined = $state(undefined);
	let error: string | null = $state(null);

	async function loadUsers() {
		try {
			error = null;
			const snapshot = await getDocs(collection(db, 'users'));
			const loaded = snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					rama_id: data?.rama_id,
					name: data.name,
					email: data.email,
					role: data.role ?? '',
					year: data.year ?? '',
					phone: data.phone ?? '',
					lineId: data?.lineId,
					enroledClasses: data.enroledClasses ?? [],
					electiveStart: data.electiveStart ? new Date(data.electiveStart) : new Date(0),
					electiveEnd: data.electiveEnd ? new Date(data.electiveEnd) : new Date(0),
				} as Student;
			});
			students = loaded;
		} catch (err) {
			error = t('students.couldNotLoadStudents');
			console.error(err);
		}
	}

	$effect(() => {
		loadUsers();
	});
</script>

<div class="w-full min-w-0 space-y-8">
	{#if error}
		<div class="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
			{error}
		</div>
	{/if}

	<section class="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft">
		<div class="flex items-center justify-between border-b border-ink-900/5 px-4 py-3">
			<div>
				<p class="text-[13.5px] font-semibold text-ink-900">
					{t('students.importFromFormsResponse')}
				</p>
				<p class="text-[12.5px] text-ink-500">
					{t('students.importFromFormsHint')}
				</p>
			</div>
		</div>
		<div class="p-3">
			<GoogleSheetsImport {classId} onEnrolled={loadUsers} />
		</div>
	</section>

	{#if showImportedStudents}
		<section class="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft">
			<div class="flex items-center justify-between border-b border-ink-900/5 px-4 py-3">
				<div>
					<p class="text-[13.5px] font-semibold text-ink-900">
						{t('students.importedStudents')}
						<span class="ml-1.5 font-normal text-ink-300"
							>({students?.length ?? 0})</span
						>
					</p>
					<p class="text-[12.5px] text-ink-500">
						{t('students.importedStudentsHint')}
					</p>
				</div>
			</div>
			<div class="p-3">
				<StudentTable
					{students}
					{enableSelection}
					{setSelectedStudents}
					onChanged={loadUsers}
				/>
			</div>
		</section>
	{/if}
</div>
