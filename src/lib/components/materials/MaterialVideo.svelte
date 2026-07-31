<script lang="ts">
	import MaterialBadge from './MaterialBadge.svelte';
	import { materialTypeLabel } from './utils';
	import type { Component } from 'svelte';

	let { icon: IconComponent, title, type, bg, text: textColor, embedUrl }: {
		icon: Component;
		title: string;
		type: string;
		bg: string;
		text: string;
		embedUrl?: string;
	} = $props();
</script>

<div class="overflow-hidden rounded-lg border border-ink-900/8 bg-white shadow">
	<div class="flex items-center gap-2 border-b border-ink-900/8 px-3 py-2">
		<div class={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${bg} ${textColor}`}>
			<IconComponent class="h-3 w-3 shrink-0" />
		</div>
		<p class="truncate text-sm font-medium text-ink-900">{title}</p>
		<MaterialBadge label={materialTypeLabel(type)} {bg} text={textColor} />
	</div>
	<div class="aspect-video">
		{#if embedUrl}
			<iframe
				src={embedUrl}
				class="h-full w-full"
				allow="encrypted-media; picture-in-picture"
				allowfullscreen
			/>
		{/if}
	</div>
</div>
