<script lang="ts">
	import { db } from '$lib/firebase';
	import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
	import {
		Pencil,
		Check,
		PlusCircle,
		Trash2,
		Upload,
		ChevronDown,
		ChevronRight,
		X,
		AlertCircle,
	} from '@lucide/svelte';
	import Papa from 'papaparse';
	import type { Student } from '$lib/dashboard/types';
	import { authState } from '$lib/auth.svelte';
	import { Modal } from '$lib/components/ui';

	const ROLE_LABELS: Record<string, string> = {
		student: 'นศพ.',
		resident: 'Resident',
		teacher: 'อาจารย์',
		admin: 'Admin',
	};

	const YEAR_LABELS: Record<string, string> = {
		y4: 'ปี 4',
		y5: 'ปี 5',
		y6: 'ปี 6',
		r1: 'R1',
		r2: 'R2',
		r3: 'R3',
	};

	const YEAR_OPTIONS: Record<string, { value: string; label: string }[]> = {
		student: [
			{ value: 'y4', label: 'ปี 4' },
			{ value: 'y5', label: 'ปี 5' },
			{ value: 'y6', label: 'ปี 6' },
		],
		resident: [
			{ value: 'r1', label: 'R1' },
			{ value: 'r2', label: 'R2' },
			{ value: 'r3', label: 'R3' },
		],
	};

	let {
		enableSelection = false,
		setSelectedStudents,
	}: {
		enableSelection?: boolean;
		setSelectedStudents?: (students: Student[]) => void;
	} = $props();

	let students: Student[] | undefined = $state(undefined);
	let error: string | null = $state(null);

	let csvExpanded = $state(false);
	let csvData:
		{ rama_id: string; name: string; email: string; role: string; year: string }[] | null =
		$state(null);
	let csvParsing = $state(false);
	let csvError: string | null = $state(null);
	let csvUploading = $state(false);
	let csvSuccess: string | null = $state(null);

	let fileInputRef: HTMLInputElement | undefined = $state();

	let editingId: string | null = $state(null);
	let editRamaId = $state('');
	let editName = $state('');
	let editEmail = $state('');
	let editRole = $state('');
	let editYear = $state('');
	let editSaving = $state(false);
	let editError: string | null = $state(null);

	let confirmingDeleteId: string | null = $state(null);
	let editDeleting = $state(false);

	let newUserId = $state('');
	let newFullName = $state('');
	let newEmail = $state('');
	let newRole = $state('');
	let newYear = $state('');
	let newSubmitting = $state(false);
	let newError: string | null = $state(null);
	let showAddModal = $state(false);

	let checkedStudents: string[] = $state([]);

	type CsvRow = {
		rama_id: string;
		name: string;
		email: string;
		role: string;
		year: string;
	};

	async function validateCsv(rows: CsvRow[]): Promise<string | null> {
		const seenRama = new Map<string, number>();
		const seenEmail = new Map<string, number>();
		for (let i = 0; i < rows.length; i++) {
			const r = rows[i];
			const ramaKey = String(r.rama_id ?? '')
				.trim()
				.toLowerCase();
			const emailKey = String(r.email ?? '')
				.trim()
				.toLowerCase();
			if (ramaKey && seenRama.has(ramaKey)) {
				return `Duplicate RAMA ID "${r.rama_id}" in row ${i + 2}.`;
			}
			if (emailKey && seenEmail.has(emailKey)) {
				return `Duplicate email "${r.email}" in row ${i + 2}.`;
			}
			if (ramaKey) seenRama.set(ramaKey, i);
			if (emailKey) seenEmail.set(emailKey, i);
		}

		try {
			const usersSnap = await getDocs(collection(db, 'users'));
			const existingRama = new Set<string>();
			const existingEmail = new Set<string>();
			usersSnap.docs.forEach((d) => {
				const data = d.data();
				if (data.rama_id) existingRama.add(String(data.rama_id).trim().toLowerCase());
				if (data.email) existingEmail.add(String(data.email).trim().toLowerCase());
			});
			for (const r of rows) {
				if (existingRama.has(String(r.rama_id).trim().toLowerCase())) {
					return `RAMA ID "${r.rama_id}" is already in use by an existing student.`;
				}
				if (existingEmail.has(String(r.email).trim().toLowerCase())) {
					return `Email "${r.email}" is already in use by an existing student.`;
				}
			}
		} catch (err) {
			console.error(err);
			return "Couldn't validate the file against existing students. Try again.";
		}
		return null;
	}

	function isChecked(id: string) {
		return checkedStudents.includes(id);
	}

	function toggleChecked(student: Student) {
		if (checkedStudents.includes(student.id)) {
			checkedStudents = checkedStudents.filter((id) => id !== student.id);
		} else {
			checkedStudents = [...checkedStudents, student.id];
		}
		const selected: Student[] = [];
		if (students) {
			for (const s of students) {
				if (checkedStudents.includes(s.id)) {
					selected.push(s);
				}
			}
		}
		setSelectedStudents?.(selected);
	}

	function handleCsvFile(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		csvError = null;
		csvSuccess = null;
		csvData = null;
		csvParsing = true;

		const reader = new FileReader();
		reader.onload = async (evt) => {
			const text = evt.target?.result as string;

			const result = Papa.parse<CsvRow>(text, {
				header: true,
				skipEmptyLines: true,
			});

			if (result.errors.length > 0) {
				csvError = `CSV error: ${result.errors[0].message}`;
				csvParsing = false;
				return;
			}

			const headers = result.meta.fields ?? [];
			const required: (keyof CsvRow)[] = ['rama_id', 'name', 'email', 'role', 'year'];
			const missing = required.filter((h) => !headers.includes(h));
			if (missing.length > 0) {
				csvError = `Missing columns in CSV: ${missing.join(', ')}`;
				csvParsing = false;
				return;
			}

			const rows = result.data.filter((r) => r.rama_id || r.name || r.email);
			if (rows.length === 0) {
				csvError = 'CSV file contains no data rows.';
				csvParsing = false;
				return;
			}

			const validationError = await validateCsv(rows);
			if (validationError) {
				csvError = validationError;
				csvParsing = false;
				return;
			}

			csvData = rows;
			csvParsing = false;
		};
		reader.onerror = () => {
			csvError = 'Failed to read file.';
			csvParsing = false;
		};
		reader.readAsText(file);
	}

	function resetCsv() {
		csvData = null;
		csvError = null;
		csvSuccess = null;
		if (fileInputRef) fileInputRef.value = '';
	}

	async function handleCsvUpload() {
		if (!csvData || csvData.length === 0) return;
		csvUploading = true;
		csvError = null;
		csvSuccess = null;

		try {
			const user = authState.user;
			if (!user) throw new Error('Not logged in');
			const token = await user.getIdToken();

			const res = await fetch(
				'https://us-central1-rama-toxico-edu.cloudfunctions.net/createUsers',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ students: csvData }),
				},
			);

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.error || 'Failed to create users');
			}

			const data = await res.json();
			csvSuccess = `Successfully created ${data.count} student(s).`;
			resetCsv();
			csvExpanded = false;
			await loadUsers();
		} catch (err) {
			csvError = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			csvUploading = false;
		}
	}

	async function loadUsers() {
		try {
			error = null;
			const snapshot = await getDocs(collection(db, 'users'));
			const loaded = snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					rama_id: data.rama_id,
					name: data.name,
					email: data.email,
					role: data.role ?? '',
					year: data.year ?? '',
				} as Student;
			});
			students = loaded;
		} catch (err) {
			error = "Couldn't load students. Try refreshing the page.";
			console.error(err);
		}
	}

	$effect(() => {
		loadUsers();
	});

	function handleDeleted(id: string) {
		students = students?.filter((s) => s.id !== id);
	}

	function startEdit(student: Student) {
		editingId = student.id;
		editRamaId = student.rama_id;
		editName = student.name;
		editEmail = student.email;
		editRole = student.role || '';
		editYear = student.year;
		editError = null;
	}

	function cancelEdit() {
		editingId = null;
	}

	async function handleSave(student: Student) {
		if (!editRamaId || !editName || !editEmail || !editRole || !editYear) {
			editError = 'All fields are required.';
			return;
		}
		editSaving = true;
		editError = null;
		try {
			await updateDoc(doc(db, 'users', student.id), {
				rama_id: editRamaId,
				name: editName,
				email: editEmail,
				role: editRole,
				year: editYear,
			});
			editingId = null;
			await loadUsers();
		} catch (err) {
			editError = "Couldn't save changes. Try again.";
			console.error(err);
		} finally {
			editSaving = false;
		}
	}

	async function handleDelete(student: Student) {
		editDeleting = true;
		try {
			const user = authState.user;
			if (!user) throw new Error('Not logged in');
			const token = await user.getIdToken();

			const res = await fetch(
				'https://us-central1-rama-toxico-edu.cloudfunctions.net/deleteUser',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ id: student.id }),
				},
			);

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.message || 'Failed to delete student');
			}

			handleDeleted(student.id);
			confirmingDeleteId = null;
		} catch (err) {
			confirmingDeleteId = null;
			editError = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			editDeleting = false;
		}
	}

	function openAddModal() {
		newUserId = '';
		newFullName = '';
		newEmail = '';
		newRole = '';
		newYear = '';
		newError = null;
		showAddModal = true;
	}

	async function handleAddStudent() {
		newError = null;

		const needsYear = newRole === 'student' || newRole === 'resident';
		if (!newUserId || !newFullName || !newEmail || !newRole || (needsYear && !newYear)) {
			newError = 'Please fill in every field before adding a student.';
			return;
		}

		newSubmitting = true;
		try {
			const user = authState.user;
			if (!user) throw new Error('Not logged in');
			const token = await user.getIdToken();

			const res = await fetch(
				'https://us-central1-rama-toxico-edu.cloudfunctions.net/createUser',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						email: newEmail,
						name: newFullName,
						year: newYear,
						role: newRole,
						rama_id: newUserId,
					}),
				},
			);

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(
					body?.message ||
						'Failed to add student. Make sure student ID or Email is not duplicate to existing users.',
				);
			}

			showAddModal = false;
			await loadUsers();
		} catch (err) {
			console.log(err);
			newError = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			newSubmitting = false;
		}
	}
</script>

<div class="w-full min-w-0">
	<div class="mb-2 flex items-center justify-between">
		{#if students !== undefined}
			<span class="text-xs text-gray-400">
				{students.length}
				{students.length === 1 ? 'student' : 'students'}
			</span>
		{/if}
	</div>

	<div class="mb-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
		<button
			type="button"
			onclick={() => (csvExpanded = !csvExpanded)}
			class="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
		>
			<span class="flex items-center gap-2">
				<Upload size={14} />
				Import from CSV
			</span>
			{#if csvExpanded}
				<ChevronDown size={14} />
			{:else}
				<ChevronRight size={14} />
			{/if}
		</button>

		{#if csvExpanded}
			<div class="border-t border-gray-200 px-4 pb-4 pt-3">
				{#if !csvData}
					<div
						class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-4 py-5 text-center"
					>
						<Upload size={20} class="text-gray-400" />
						<p class="mt-2 text-xs text-gray-600">
							Upload a CSV file with student data
						</p>
						<p class="mt-0.5 text-[11px] text-gray-400">
							Expected columns: rama_id, name, email, role, year
						</p>
						<label
							class="mt-3 cursor-pointer rounded-md bg-iris-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-iris-700"
						>
							Choose CSV file
							<input
								type="file"
								accept=".csv"
								onchange={handleCsvFile}
								class="hidden"
								bind:this={fileInputRef}
							/>
						</label>
					</div>

					{#if csvParsing}
						<div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
							<div
								class="h-3 w-3 animate-spin rounded-full border-2 border-iris-600/30 border-t-iris-600"
							></div>
							Parsing file…
						</div>
					{/if}

					{#if csvError}
						<div class="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">
							{csvError}
						</div>
					{/if}
				{:else}
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-medium text-gray-700">
							{csvData.length} student{csvData.length === 1 ? '' : 's'} found
						</span>
						<button
							type="button"
							onclick={resetCsv}
							class="rounded p-0.5 text-gray-400 transition hover:text-gray-600"
						>
							<X size={14} />
						</button>
					</div>

					<div
						class="max-h-56 overflow-x-auto overflow-y-auto rounded-md border border-gray-200"
					>
						<table class="min-w-full text-xs">
							<thead>
								<tr
									class="border-b border-gray-200 bg-gray-100 uppercase tracking-wide text-gray-600"
								>
									<th class="px-3 py-1.5 text-left font-medium">Student ID</th>
									<th class="px-3 py-1.5 text-left font-medium">Full name</th>
									<th class="px-3 py-1.5 text-left font-medium">Email</th>
									<th class="px-3 py-1.5 text-left font-medium">Role</th>
									<th class="px-3 py-1.5 text-left font-medium">Year</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 text-gray-800">
								{#each csvData as row, i}
									<tr class={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
										<td class="whitespace-nowrap px-3 py-1 font-mono"
											>{row.rama_id}</td
										>
										<td class="whitespace-nowrap px-3 py-1">{row.name}</td>
										<td class="whitespace-nowrap px-3 py-1 text-gray-500"
											>{row.email}</td
										>
										<td class="whitespace-nowrap px-3 py-1 text-gray-500"
											>{row.role}</td
										>
										<td class="whitespace-nowrap px-3 py-1 text-gray-500"
											>{row.year}</td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="mt-3 flex items-center gap-3">
						<button
							type="button"
							onclick={handleCsvUpload}
							disabled={csvUploading}
							class="inline-flex items-center gap-1.5 rounded-md bg-iris-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-iris-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if csvUploading}
								<div
									class="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
								></div>
							{/if}
							{csvUploading
								? 'Uploading…'
								: `Upload ${csvData.length} student${csvData.length === 1 ? '' : 's'}`}
						</button>
						<button
							type="button"
							onclick={resetCsv}
							disabled={csvUploading}
							class="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Cancel
						</button>
					</div>

					{#if csvError}
						<div class="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700">
							{csvError}
						</div>
					{/if}
					{#if csvSuccess}
						<div class="mt-2 rounded-md bg-green-50 px-3 py-1.5 text-xs text-green-700">
							{csvSuccess}
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	{#if error}
		<div class="mb-3 rounded-md bg-red-50 px-3 py-1 text-xs text-red-700">
			{error}
		</div>
	{/if}

	<div class="overflow-x-auto">
		<table class="min-w-full text-xs">
			<thead>
				<tr
					class="border-b border-gray-200 bg-gray-100 uppercase tracking-wide text-gray-600"
				>
					{#if enableSelection}
						<th style="width: 32px" class="px-3 py-1 text-left font-medium"></th>
					{/if}
					<th class="px-3 py-1 text-left font-medium">Student ID</th>
					<th class="px-3 py-1 text-left font-medium">Full name</th>
					<th class="px-3 py-1 text-left font-medium">Email</th>
					<th class="px-3 py-1 text-left font-medium">Role</th>
					<th class="px-3 py-1 text-left font-medium">Year</th>
					<th class="px-3 py-1 text-left font-medium">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100 text-gray-800">
				{#if students === undefined}
					{#each Array(3) as _, i}
						<tr class={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
							{#each Array(enableSelection ? 8 : 7) as _, j}
								<td class="px-3 py-1.5">
									<div class="h-3 w-20 animate-pulse rounded bg-gray-200"></div>
								</td>
							{/each}
						</tr>
					{/each}
				{/if}

				{#if students !== undefined && students.length === 0}
					<tr>
						<td
							colspan={enableSelection ? 7 : 6}
							class="px-3 py-6 text-center text-gray-400"
						>
							No students yet. Add a new student to get started.
						</td>
					</tr>
				{/if}

				{#if students !== undefined}
					{#each students as student, idx (student.id)}
						{@const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
						{@const isEditing = editingId === student.id}

						{#if isEditing}
							<tr class={rowBg}>
								{#if enableSelection}
									<td></td>
								{/if}
								<td class="px-3 py-1">
									<input
										bind:value={editRamaId}
										class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-iris-500 focus:outline-none focus:ring-1 focus:ring-iris-500"
									/>
								</td>
								<td class="px-3 py-1">
									<input
										bind:value={editName}
										class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-iris-500 focus:outline-none focus:ring-1 focus:ring-iris-500"
									/>
								</td>
								<td class="px-3 py-1">
									<input
										bind:value={editEmail}
										class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-iris-500 focus:outline-none focus:ring-1 focus:ring-iris-500"
									/>
								</td>
								<td class="px-3 py-1">
									<select
										bind:value={editRole}
										onchange={() => {
											const validYears =
												YEAR_OPTIONS[editRole]?.map((o) => o.value) ?? [];
											if (!validYears.includes(editYear)) editYear = '';
										}}
										class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-iris-500 focus:outline-none focus:ring-1 focus:ring-iris-500"
									>
										<option value="student">นศพ.</option>
										<option value="resident">Resident</option>
										<option value="teacher">อาจารย์</option>
										<option value="admin">Admin</option>
									</select>
								</td>
								<td class="px-3 py-1">
									<select
										bind:value={editYear}
										class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-iris-500 focus:outline-none focus:ring-1 focus:ring-iris-500"
									>
										{#if editRole !== 'student' && editRole !== 'resident'}
											<option value="">—</option>
										{:else}
											{#each YEAR_OPTIONS[editRole] ?? [] as opt}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										{/if}
									</select>
								</td>
								<td class="whitespace-nowrap px-3 py-1">
									<div class="flex items-center gap-2">
										<button
											type="button"
											onclick={() => handleSave(student)}
											disabled={editSaving}
											class="rounded-md bg-iris-600 px-2.5 py-1 text-[12px] font-semibold text-white transition hover:bg-iris-700 disabled:cursor-not-allowed disabled:opacity-60"
										>
											{editSaving ? 'Saving...' : 'Save'}
										</button>
										<button
											type="button"
											onclick={cancelEdit}
											disabled={editSaving}
											class="rounded-md border border-gray-300 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition hover:bg-gray-100"
										>
											Cancel
										</button>
									</div>
									{#if editError}
										<p class="mt-1 text-[11px] text-red-600">{editError}</p>
									{/if}
								</td>
							</tr>
						{:else}
							<tr class={`${rowBg} transition-colors hover:bg-blue-50`}>
								{#if enableSelection}
									<td class="whitespace-nowrap px-3 py-1 font-mono">
										<button
											type="button"
											onclick={() => toggleChecked(student)}
											class={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
												isChecked(student.id)
													? 'bg-blue-600 border-blue-600'
													: 'bg-white border-gray-300 hover:border-gray-400'
											}`}
										>
											{#if isChecked(student.id)}
												<Check size={14} class="text-white" />
											{/if}
										</button>
									</td>
								{/if}
								<td class="whitespace-nowrap px-3 py-1 font-mono"
									>{student.rama_id}</td
								>
								<td class="whitespace-nowrap px-3 py-1">{student.name}</td>
								<td class="whitespace-nowrap px-3 py-1 text-gray-500"
									>{student.email}</td
								>
								<td class="whitespace-nowrap px-3 py-1 text-gray-500">
									{ROLE_LABELS[student.role ?? ''] ?? student.role}
								</td>
								<td class="whitespace-nowrap px-3 py-1">
									{YEAR_LABELS[student.year] ?? student.year}
								</td>
								<td class="whitespace-nowrap px-3 py-1">
									<div class="my-1 flex items-center gap-2">
										<button type="button" onclick={() => startEdit(student)}>
											<Pencil size={16} class="text-gray-600" />
										</button>
										<button
											type="button"
											onclick={() => (confirmingDeleteId = student.id)}
										>
											<Trash2 size={16} class="ml-3 text-red-600" />
										</button>
									</div>
									{#if editError}
										<p class="mt-1 text-[11px] text-red-600">{editError}</p>
									{/if}
								</td>
							</tr>
						{/if}
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<button
		type="button"
		onclick={openAddModal}
		class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-[13px] font-semibold text-iris-600 transition hover:border-iris-400 hover:bg-iris-50/50"
	>
		<PlusCircle size={16} />
		Add a new student
	</button>
</div>

<Modal
	open={showAddModal}
	title="Add a new student"
	onclose={() => (showAddModal = false)}
	class="max-w-md"
>
	<div class="space-y-3">
		<div>
			<label for="new-student-id" class="mb-1 block text-[12.5px] font-medium text-gray-700"
				>Student ID</label
			>
			<input
				id="new-student-id"
				type="text"
				bind:value={newUserId}
				placeholder="รหัสนักศึกษา"
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-iris-500 focus:outline-none focus:ring-1 focus:ring-iris-500"
			/>
		</div>
		<div>
			<label for="new-student-name" class="mb-1 block text-[12.5px] font-medium text-gray-700"
				>Full name</label
			>
			<input
				id="new-student-name"
				type="text"
				bind:value={newFullName}
				placeholder="ชื่อ สกุล"
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-iris-500 focus:outline-none focus:ring-1 focus:ring-iris-500"
			/>
		</div>
		<div>
			<label
				for="new-student-email"
				class="mb-1 block text-[12.5px] font-medium text-gray-700">Email</label
			>
			<input
				id="new-student-email"
				type="text"
				bind:value={newEmail}
				placeholder="Email"
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-iris-500 focus:outline-none focus:ring-1 focus:ring-iris-500"
			/>
		</div>
		<div>
			<label for="new-student-role" class="mb-1 block text-[12.5px] font-medium text-gray-700"
				>Role</label
			>
			<select
				id="new-student-role"
				bind:value={newRole}
				onchange={() => {
					const validYears = YEAR_OPTIONS[newRole]?.map((o) => o.value) ?? [];
					if (!validYears.includes(newYear)) newYear = '';
				}}
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-iris-500 focus:outline-none focus:ring-1 focus:ring-iris-500"
			>
				<option value="" disabled hidden>Select role</option>
				<option value="student">นศพ.</option>
				<option value="resident">Resident</option>
				<option value="teacher">อาจารย์</option>
				<option value="admin">Admin</option>
			</select>
		</div>
		<div>
			<label for="new-student-year" class="mb-1 block text-[12.5px] font-medium text-gray-700"
				>Year</label
			>
			<select
				id="new-student-year"
				bind:value={newYear}
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-iris-500 focus:outline-none focus:ring-1 focus:ring-iris-500"
			>
				{#if newRole === 'student' || newRole === 'resident'}
					<option value="" disabled hidden>
						{newRole === 'resident' ? 'Residency year' : 'ชั้นปี'}
					</option>
					{#each YEAR_OPTIONS[newRole] ?? [] as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				{:else}
					<option value="">—</option>
				{/if}
			</select>
		</div>
		{#if newError}
			<div
				class="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] text-red-600"
			>
				<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
				<span>{newError}</span>
			</div>
		{/if}
	</div>
	{#snippet footer()}
		<button
			type="button"
			onclick={() => (showAddModal = false)}
			disabled={newSubmitting}
			class="rounded-md border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Cancel
		</button>
		<button
			type="button"
			onclick={handleAddStudent}
			disabled={newSubmitting}
			class="inline-flex items-center gap-1.5 rounded-md bg-iris-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-iris-700 disabled:cursor-not-allowed disabled:opacity-60"
		>
			{#if newSubmitting}
				<div
					class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></div>
				Adding…
			{:else}
				<PlusCircle size={14} /> Add student
			{/if}
		</button>
	{/snippet}
</Modal>

{#if confirmingDeleteId !== null}
	{@const deletingStudent = students?.find((s) => s.id === confirmingDeleteId)}
	<Modal open title="Delete student?" onclose={() => (confirmingDeleteId = null)}>
		<p class="text-[13px] text-ink-500">
			This will permanently delete
			<span class="font-medium text-ink-900">{deletingStudent?.name ?? 'this student'}</span>
			({deletingStudent?.rama_id}). This action cannot be undone.
		</p>
		{#snippet footer()}
			<button
				type="button"
				onclick={() => (confirmingDeleteId = null)}
				disabled={editDeleting}
				class="rounded-md border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={() => deletingStudent && handleDelete(deletingStudent)}
				disabled={editDeleting || !deletingStudent}
				class="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if editDeleting}
					<div
						class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
					></div>
					Deleting…
				{:else}
					Delete
				{/if}
			</button>
		{/snippet}
	</Modal>
{/if}
