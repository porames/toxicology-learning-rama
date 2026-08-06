<script lang="ts">
	import { goto } from '$app/navigation';
	import { dashboardStore } from '$lib/dashboard/dashboardStore.svelte';
	import { Plus, Folder, ChevronRight } from '@lucide/svelte';

	async function handleAddClass() {
		const id = await dashboardStore.addClass();
		goto(`/dashboard/${id}`);
	}
</script>

<svelte:head>
	<title>RAMA Toxico | Dashboard</title>
</svelte:head>

{#if dashboardStore.loading}
	<div class="flex h-full items-center justify-center w-full">
		<div class="flex flex-col items-center gap-3">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"
			></div>
			<span class="text-[13px] text-ink-500">Loading classes…</span>
		</div>
	</div>
{:else}
	<div class="block overflow-y-auto px-6 py-5 w-xl">
		<h2 class="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
			All Classes
		</h2>
		{#if dashboardStore.classes.length === 0}
			<p class="px-2 text-sm text-ink-900/40">No classes yet.</p>
		{:else}
			<div class="space-y-2">
				{#each dashboardStore.classes as cls}
					<button
						type="button"
						onclick={() => goto(`/dashboard/${cls.id}`)}
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
					onclick={handleAddClass}
					class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-900/15 px-4 py-3 text-sm font-medium text-iris-600 transition hover:border-iris-400 hover:bg-iris-50"
				>
					<Plus class="h-4 w-4" />
					New class
				</button>
			</div>
		{/if}
	</div>
{/if}
