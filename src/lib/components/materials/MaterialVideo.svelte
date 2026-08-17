<script lang="ts">
	import MaterialBadge from './MaterialBadge.svelte';
	import { materialTypeLabel } from './utils';
	import type { Component } from 'svelte';

	const PLAYER_JS_SRC = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js';

	let {
		icon: IconComponent,
		title,
		type,
		bg,
		text: textColor,
		embedUrl,
		onPositionChange,
	}: {
		icon: Component;
		title: string;
		type: string;
		bg: string;
		text: string;
		embedUrl?: string;
		onPositionChange?: (seconds: number) => void;
	} = $props();

	let iframeEl = $state<HTMLIFrameElement | null>(null);
	let maxPosition = $state(0);

	const cacheBuster = $state(() => crypto.randomUUID());

	const src = $derived(
		embedUrl ? `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}_=${cacheBuster}` : '',
	);

	function loadPlayerJs(): Promise<void> {
		return new Promise((resolve, reject) => {
			const existing = document.querySelector(`script[src="${PLAYER_JS_SRC}"]`);
			if (existing) {
				resolve();
				return;
			}
			const script = document.createElement('script');
			script.src = PLAYER_JS_SRC;
			script.async = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Failed to load player.js'));
			document.head.appendChild(script);
		});
	}

	$effect(() => {
		if (!iframeEl || !embedUrl) return;

		let disposed = false;
		let player: any;

		async function init() {
			try {
				await loadPlayerJs();
				if (disposed || !iframeEl) return;
				const Player = (window as any).playerjs?.Player;
				if (!Player) throw new Error('player.js not available');
				player = new Player(iframeEl);
				player.on('ready', () => {
					if (disposed) return;
					if (player.supports('event', 'timeupdate')) {
						player.on('timeupdate', (data: { seconds?: number }) => {
							const seconds = typeof data?.seconds === 'number' ? data.seconds : 0;
							if (seconds > maxPosition) {
								maxPosition = seconds;
								onPositionChange?.(seconds);
							}
						});
					}
					if (player.supports('event', 'seeked')) {
						player.on('seeked', () => {});
					}
					if (player.supports('event', 'ended')) {
						player.on('ended', () => {});
					}
				});
			} catch (err) {
				console.error(err);
			}
		}

		init();

		return () => {
			disposed = true;
			if (player) {
				try {
					player.off('timeupdate');
					player.off('seeked');
					player.off('ended');
				} catch {
					// ignore teardown errors
				}
			}
		};
	});
</script>

<div class="overflow-hidden rounded-lg border border-ink-900/8 bg-white shadow">
	<div class="flex items-center gap-2 border-b border-ink-900/8 px-3 py-2">
		<div
			class={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${bg} ${textColor}`}
		>
			<IconComponent class="h-3 w-3 shrink-0" />
		</div>
		<p class="truncate text-sm font-medium text-ink-900">{title}</p>
		<MaterialBadge label={materialTypeLabel(type)} {bg} text={textColor} />
	</div>
	<div class="aspect-video">
		{#if src}
			<iframe
				bind:this={iframeEl}
				{src}
				class="h-full w-full"
				allow="encrypted-media; picture-in-picture"
				allowfullscreen
			/>
		{/if}
	</div>
</div>
