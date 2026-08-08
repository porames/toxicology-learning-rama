<script lang="ts">
	import { db } from '$lib/firebase';
	import {
		collection,
		getDocs,
		addDoc,
		deleteDoc,
		doc,
		serverTimestamp,
	} from 'firebase/firestore';
	import { goto } from '$app/navigation';
	import { Library, Plus, Trash2, Pencil, Boxes, Loader2 } from '@lucide/svelte';
	import type { CourseTemplate } from '$lib/dashboard/types';
	import { Button, Modal } from '$lib/components/ui';
	import BuildClassFromTemplate from './BuildClassFromTemplate.svelte';

	let templates = $state<CourseTemplate[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let confirmingDelete = $state<CourseTemplate | null>(null);
	let deleting = $state(false);
	let buildingFrom = $state<CourseTemplate | null>(null);
	let creating = $state(false);

	async function handleCreate() {
		if (creating) return;
		creating = true;
		try {
			const ref = await addDoc(collection(db, 'courseTemplates'), {
				name: 'New course template',
				code: '',
				description: '',
				createdAt: serverTimestamp(),
			});
			goto(`/dashboard/templates/${ref.id}`);
		} catch (err) {
			console.error(err);
			error = "Couldn't create the template. Please try again.";
			creating = false;
		}
	}

	async function load() {
		loading = true;
		error = null;
		try {
			const snap = await getDocs(collection(db, 'courseTemplates'));
			templates = snap.docs.map(
				(d) =>
					({
						id: d.id,
						...d.data(),
						lectures: d.data()?.lectures ?? [],
					}) as unknown as CourseTemplate,
			);
			templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
			console.log(templates);
		} catch (err) {
			console.error(err);
			error = "Couldn't load templates. Try refreshing the page.";
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		const target = confirmingDelete;
		if (!target) return;
		deleting = true;
		try {
			await deleteDoc(doc(db, 'courseTemplates', target.id));
			templates = templates.filter((t) => t.id !== target.id);
			confirmingDelete = null;
		} catch (err) {
			console.error(err);
		} finally {
			deleting = false;
		}
	}

	function lectureCount(t: CourseTemplate): number {
		return t.lectures?.length ?? 0;
	}

	$effect(() => {
		load();
	});
</script>

<div class="mx-auto w-full min-w-0 max-w-4xl px-4 py-10 md:px-8">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="min-w-0 flex-1">
			<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">Templates</p>
			<h1
				class="mt-1 flex items-center gap-2 truncate text-[18px] font-semibold text-ink-900"
			>
				<Library class="h-4 w-4 shrink-0 text-iris-600" />
				<span class="truncate">Course templates</span>
			</h1>
			<p class="mt-0.5 text-[13px] text-ink-500">
				Reusable course schedules. Build a new class from a template when a student joins.
			</p>
		</div>
		<Button variant="primary" disabled={creating} onclick={handleCreate}>
			{#if creating}
				<Loader2 class="h-3.5 w-3.5 animate-spin" />
				Creating…
			{:else}
				<Plus class="h-3.5 w-3.5" />
				New template
			{/if}
		</Button>
	</div>

	{#if loading}
		<div class="mt-8 space-y-2">
			{#each Array(3) as _}
				<div class="h-20 w-full animate-pulse rounded-lg bg-ink-900/5"></div>
			{/each}
		</div>
	{:else if error}
		<p class="mt-8 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>
	{:else if templates.length === 0}
		<div class="mt-16 flex flex-col items-center justify-center px-8 text-center">
			<div
				class="flex h-12 w-12 items-center justify-center rounded-xl bg-iris-50 text-iris-600"
			>
				<Library class="h-6 w-6" />
			</div>
			<p class="mt-4 text-[15px] font-medium text-ink-900">No templates yet</p>
			<p class="mt-1 max-w-xs text-[13.5px] text-ink-500">
				Create a course template with lectures and materials, then build classes from it for
				new students.
			</p>
		</div>
	{:else}
		<div class="mt-8 space-y-3">
			{#each templates as template (template.id)}
				<div class="rounded-xl border border-ink-900/10 bg-white shadow-soft">
					<div class="flex items-start justify-between gap-3 p-4">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<Library class="h-4 w-4 shrink-0 text-ink-400" />
								<p class="truncate text-[14.5px] font-semibold text-ink-900">
									{template.name || 'Untitled template'}
								</p>
								{#if template.code}
									<span
										class="shrink-0 rounded bg-ink-900/[0.05] px-1.5 py-0.5 text-[11px] font-medium text-ink-500"
									>
										{template.code}
									</span>
								{/if}
							</div>
							{#if template.description}
								<p class="mt-1 line-clamp-2 text-[13px] text-ink-500">
									{template.description}
								</p>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<Button variant="primary" onclick={() => (buildingFrom = template)}>
								<Boxes class="h-3.5 w-3.5" />
								Build class
							</Button>
							<Button
								variant="ghost"
								onclick={() => goto(`/dashboard/templates/${template.id}`)}
							>
								<Pencil class="h-3.5 w-3.5" />
								Edit
							</Button>
							<button
								type="button"
								onclick={() => (confirmingDelete = template)}
								aria-label="Delete template"
								class="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if buildingFrom}
	<BuildClassFromTemplate
		template={buildingFrom}
		onClose={() => (buildingFrom = null)}
		onBuilt={(classId) => {
			buildingFrom = null;
			goto(`/dashboard/${classId}`);
		}}
	/>
{/if}

{#if confirmingDelete}
	<Modal open title="Delete template?" onclose={() => (confirmingDelete = null)}>
		<p class="text-[13px] text-ink-500">
			This will permanently delete "{confirmingDelete.name}" and all its lecture templates.
			Existing classes built from it are not affected. This action cannot be undone.
		</p>
		{#snippet footer()}
			<Button variant="ghost" onclick={() => (confirmingDelete = null)}>Cancel</Button>
			<Button variant="danger-solid" disabled={deleting} onclick={handleDelete}>
				{deleting ? 'Deleting...' : 'Delete'}
			</Button>
		{/snippet}
	</Modal>
{/if}
