<script lang="ts">
	import MaterialBadge from './MaterialBadge.svelte';
	import { materialTypeLabel } from './utils';
	import type { Component } from 'svelte';

	let { icon: IconComponent, title, type, bg, text: textColor, url }: {
		icon: Component;
		title: string;
		type: string;
		bg: string;
		text: string;
		url: string;
	} = $props();

	function parseYouTubeId(u: string): string | null {
		const match = u.match(
			/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
		);
		return match ? match[1] : null;
	}

	const videoId = $derived(parseYouTubeId(url));
	const embedSrc = $derived(videoId ? `https://www.youtube.com/embed/${videoId}` : url);
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
		<iframe
			src={embedSrc}
			class="h-full w-full"
			allow="autoplay; encrypted-media; picture-in-picture"
			allowfullscreen
		/>
	</div>
</div>
