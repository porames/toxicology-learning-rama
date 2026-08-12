<script lang="ts">
	import { Languages, Check } from '@lucide/svelte';
	import { i18n, t, type Locale } from '$lib/i18n';

	const languages: { code: Locale; label: string; native: string }[] = [
		{ code: 'en', label: 'English', native: 'English' },
		{ code: 'th', label: 'ไทย', native: 'ไทย' },
	];
</script>

<svelte:head>
	<title>RAMA Toxico | {t('nav.settings')}</title>
</svelte:head>

<div class="w-full max-w-xl px-6">
	<h1 class="mb-5 text-xl font-bold text-ink-900">{t('nav.settings')}</h1>

	<div class="overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-soft">
		<div class="flex items-center gap-3 border-b border-ink-900/8 px-5 py-4">
			<span
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-iris-50 text-iris-600"
			>
				<Languages class="h-5 w-5" />
			</span>
			<div class="min-w-0">
				<h2 class="text-sm font-semibold text-ink-900">{t('settings.language')}</h2>
				<p class="text-xs text-ink-500">{t('settings.languageDescription')}</p>
			</div>
		</div>
		<div class="p-3">
			{#each languages as lang}
				<button
					type="button"
					onclick={() => i18n.setLocale(lang.code)}
					aria-pressed={i18n.locale === lang.code}
					class="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-ink-900/[0.03]"
				>
					<span class="flex items-baseline gap-2.5">
						<span class="text-[15px] font-semibold text-ink-900">{lang.native}</span>
						<span class="text-xs text-ink-400">{lang.label}</span>
					</span>
					{#if i18n.locale === lang.code}
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full bg-iris-600 text-white"
						>
							<Check class="h-3 w-3" />
						</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</div>
