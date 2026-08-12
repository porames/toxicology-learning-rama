<script lang="ts">
	import type { ClassItem } from '$lib/dashboard/types';
	import { ChevronRight, Folder } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n';
	let { classes }: { classes: ClassItem[] } = $props();
</script>

<div class="block overflow-y-auto px-6 py-5 w-xl">
	<h2 class="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
		{t('nav.allClasses')}
	</h2>
	{#if classes.length === 0}
		<p class="px-2 text-sm text-ink-900/40">{t('dashboard.noClassesYet')}</p>
	{:else}
		<div class="space-y-2">
			{#each classes as cls}
				<button
					type="button"
					onclick={() => goto(`/classes/${cls.id}`)}
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
		</div>
	{/if}
</div>
