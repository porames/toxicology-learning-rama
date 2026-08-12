<script lang="ts">
	import { goto } from '$app/navigation';
	import { dashboardStore } from '$lib/dashboard/dashboardStore.svelte';
	import { db } from '$lib/firebase';
	import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
	import { Plus, Folder, ChevronRight, Users, Library, Pencil } from '@lucide/svelte';
	import { t, tn } from '$lib/i18n';
	import moment from 'moment';

	async function handleAddClass() {
		const id = await dashboardStore.addClass();
		goto(`/dashboard/${id}`);
	}

	let templates = $state<{ id: string; name: string; code: string; lectureCount: number }[]>([]);
	let templatesLoading = $state(true);

	async function loadTemplates() {
		templatesLoading = true;
		try {
			const snap = await getDocs(collection(db, 'courseTemplates'));
			templates = snap.docs
				.map((d) => {
					const data = d.data();
					return {
						id: d.id,
						name: (data.name as string) || t('common.untitledTemplate'),
						code: (data.code as string) || '',
						lectureCount: Array.isArray(data.lectures) ? data.lectures.length : 0,
					};
				})
				.sort((a, b) => a.name.localeCompare(b.name));
		} catch (err) {
			console.error(err);
			templates = [];
		} finally {
			templatesLoading = false;
		}
	}

	$effect(() => {
		if (!dashboardStore.loading) loadTemplates();
	});

	async function handleAddTemplate() {
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
		}
	}
</script>

<svelte:head>
	<title>RAMA Toxico | {t('nav.dashboard')}</title>
</svelte:head>

{#if dashboardStore.loading}
	<div class="flex h-full items-center justify-center w-full">
		<div class="flex flex-col items-center gap-3">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"
			></div>
			<span class="text-[13px] text-ink-500">{t('common.loading')}</span>
		</div>
	</div>
{:else}
	<div class="block overflow-y-auto px-6 py-5 w-xl">
		<h2 class="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
			{t('nav.allClasses')}
		</h2>
		{#if dashboardStore.classes.length === 0}
			<div class="space-y-2">
				<p class="px-2 text-sm text-ink-900/40">{t('dashboard.noClassesYet')}</p>
				<button
					type="button"
					onclick={handleAddClass}
					class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-900/15 px-4 py-3 text-sm font-medium text-iris-600 transition hover:border-iris-400 hover:bg-iris-50"
				>
					<Plus class="h-4 w-4" />
					{t('dashboard.newClass')}
				</button>
			</div>
		{:else}
			<div class="space-y-2">
				{#each dashboardStore.classes as cls}
					<div
						role="button"
						tabindex="0"
						onclick={() => goto(`/dashboard/${cls.id}`)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								goto(`/dashboard/${cls.id}`);
							}
						}}
						class="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-ink-900/10 bg-white px-4 py-3 text-left shadow-soft transition hover:border-iris-400 hover:bg-iris-50"
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
							{#if cls.classStart || cls.classEnd}
								<p class="truncate text-[11px] text-ink-400">
									{cls.classStart
										? moment(cls.classStart).format('MMM D, YYYY')
										: ''}
									{cls.classStart && cls.classEnd ? ' – ' : ''}
									{cls.classEnd ? moment(cls.classEnd).format('MMM D, YYYY') : ''}
								</p>
							{/if}
							<button
								onclick={(e) => {
									e.stopPropagation();
									goto(`/dashboard/${cls.id}/students`);
								}}
								class="mt-1 flex items-center gap-1 text-[12px] font-medium text-iris-600 hover:text-iris-900 transition"
							>
								<Users class="h-3.5 w-3.5" />
								{tn(
									cls.students?.length ?? 0,
									'dashboard.studentsCount',
									'dashboard.studentsCountPlural',
								)}
							</button>
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									goto(`/dashboard/${cls.id}`);
								}}
								class="flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium text-ink-600 transition hover:bg-ink-900/5 hover:text-ink-900"
							>
								<ChevronRight class="h-4 w-4 shrink-0 text-ink-300" />
							</button>
						</div>
					</div>
				{/each}
				<button
					type="button"
					onclick={handleAddClass}
					class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-900/15 px-4 py-3 text-sm font-medium text-iris-600 transition hover:border-iris-400 hover:bg-iris-50"
				>
					<Plus class="h-4 w-4" />
					{t('dashboard.newClass')}
				</button>
			</div>
		{/if}

		<div class="mt-8 border-t border-ink-900/8 pt-5">
			<div class="mb-3 flex items-center justify-between px-2">
				<h2 class="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
					{t('dashboard.courseTemplates')}
				</h2>
			</div>
			{#if templatesLoading}
				<div class="space-y-2">
					{#each Array(2) as _}
						<div class="h-14 w-full animate-pulse rounded-lg bg-ink-900/5"></div>
					{/each}
				</div>
			{:else if templates.length === 0}
				<div class="space-y-2">
					<p class="px-2 text-sm text-ink-900/40">{t('dashboard.noTemplatesYet')}</p>
					<button
						type="button"
						onclick={handleAddTemplate}
						class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-900/15 px-4 py-3 text-sm font-medium text-iris-600 transition hover:border-iris-400 hover:bg-iris-50"
					>
						<Plus class="h-4 w-4" />
						{t('dashboard.newTemplate')}
					</button>
				</div>
			{:else}
				<div class="space-y-2">
					{#each templates as tpl}
						<button
							type="button"
							onclick={() => goto(`/dashboard/templates/${tpl.id}`)}
							class="flex w-full items-center gap-3 rounded-lg border border-ink-900/10 bg-white px-4 py-3 text-left shadow-soft transition hover:border-iris-400 hover:bg-iris-50"
						>
							<span
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-iris-50 text-iris-500"
							>
								<Library class="h-4 w-4" />
							</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-ink-900">{tpl.name}</p>
								{#if tpl.code}
									<p class="truncate text-xs text-ink-400">{tpl.code}</p>
								{/if}
								<p class="mt-0.5 truncate text-[11px] font-medium text-ink-400">
									{tn(
										tpl.lectureCount,
										'dashboard.lecturesCount',
										'dashboard.lecturesCountPlural',
									)}
								</p>
							</div>
							<ChevronRight class="h-4 w-4 shrink-0 text-ink-300" />
						</button>
					{/each}
					<button
						type="button"
						onclick={handleAddTemplate}
						class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-900/15 px-4 py-3 text-sm font-medium text-iris-600 transition hover:border-iris-400 hover:bg-iris-50"
					>
						<Plus class="h-4 w-4" />
						{t('dashboard.newTemplate')}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
