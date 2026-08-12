<script lang="ts">
	import MaterialBadge from './MaterialBadge.svelte';
	import { materialTypeLabel } from './utils';
	import type { Component } from 'svelte';

	let {
		icon: IconComponent,
		title,
		type,
		bg,
		text: textColor,
	}: {
		icon: Component;
		title: string;
		type: string;
		bg: string;
		text: string;
	} = $props();
</script>

<div class="flex items-center gap-3 rounded-md border border-ink-900/8 bg-white shadow px-3 py-2.5">
	<div class={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${bg} ${textColor}`}>
		<IconComponent class="h-4 w-4 shrink-0" />
	</div>
	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<p class="truncate text-sm font-medium text-ink-900">{title}</p>
			<MaterialBadge label={materialTypeLabel(type)} {bg} text={textColor} />
		</div>
	</div>
</div>
