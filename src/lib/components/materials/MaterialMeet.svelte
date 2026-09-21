<script lang="ts">
	import { Info, UserRound } from '@lucide/svelte';
	import GoogleMeetIcon from '$lib/components/GoogleMeetIcon.svelte';
	import MaterialBadge from './MaterialBadge.svelte';
	import { materialTypeLabel } from './utils';
	import type { Component } from 'svelte';
	import { t } from '$lib/i18n';

	let {
		icon: IconComponent,
		title,
		type,
		bg,
		text: textColor,
		url,
		host = null,
	}: {
		icon: Component;
		title: string;
		type: string;
		bg: string;
		text: string;
		url: string;
		host?: { displayName: string; email: string } | null;
	} = $props();
</script>

<div class="overflow-hidden rounded-md border border-ink-900/8 bg-white shadow">
	<a
		href={url}
		target="_blank"
		rel="noopener noreferrer"
		class="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-ink-900/5"
	>
		<div
			class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${bg} ${textColor}`}
		>
			<IconComponent class="h-4 w-4 shrink-0" />
		</div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<p class="truncate text-sm font-medium text-ink-900">{title}</p>
				<MaterialBadge label={materialTypeLabel(type)} {bg} text={textColor} />
			</div>
			<p class="truncate text-xs text-ink-900/40">{url}</p>
		</div>
		<span
			class="shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[12px] font-semibold text-emerald-700"
		>
			<GoogleMeetIcon class="h-3.5 w-3.5" />
			{t('materials.joinMeet')}
		</span>
	</a>
	{#if host}
		<p
			class="flex items-center gap-1.5 border-t border-ink-900/8 px-3 py-1.5 text-[12px] text-ink-500"
		>
			<UserRound class="h-3.5 w-3.5 shrink-0 text-ink-400" />
			<span class="truncate">{t('materials.hostTeacher')} · {host.displayName || host.email}</span>
		</p>
	{/if}
	<p
		class="flex items-start gap-1.5 border-t border-ink-900/8 bg-iris-500/10 px-2.5 py-1.5 text-[12px] text-iris-700"
	>
		<Info class="mt-0.5 h-3.5 w-3.5 shrink-0" />
		<span>{t('materials.autoCheckInNote')}</span>
	</p>
</div>
