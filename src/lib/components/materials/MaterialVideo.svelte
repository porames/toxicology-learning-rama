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
		startPosition = 0,
		onPositionChange,
	}: {
		icon: Component;
		title: string;
		type: string;
		bg: string;
		text: string;
		embedUrl?: string;
		startPosition?: number;
		onPositionChange?: (seconds: number) => void;
	} = $props();

	let iframeEl = $state<HTMLIFrameElement | null>(null);
	let duration = $state(0);
	let maxFraction = $state(0);
	let seekApplied = $state(false);

	const cacheBuster = $state(() => crypto.randomUUID());

	const src = $derived(
		embedUrl ? `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}_=${cacheBuster}` : '',
	);

	const progress = $derived(
		Math.min(1, Math.max(maxFraction, startPosition > 0 ? startPosition : 0)),
	);
	const progressPct = $derived(Math.round(progress * 100));

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
					if (!seekApplied) {
						seekApplied = true;
						try {
							if (player.supports('method', 'getDuration')) {
								player.getDuration((d: number) => {
									if (disposed) return;
									if (typeof d === 'number' && d > 0) duration = d;
									if (startPosition > 0 && startPosition < 1 && duration > 0) {
										try {
											if (player.supports('method', 'setCurrentTime')) {
												player.setCurrentTime(startPosition * duration);
											}
										} catch {
											// ignore seek errors
										}
									}
								});
							} else {
								console.warn('video tracking disabled: player has no getDuration');
							}
						} catch {
							// ignore duration errors
						}
					}
					if (player.supports('event', 'timeupdate')) {
						player.on('timeupdate', (data: { seconds?: number }) => {
							const seconds = typeof data?.seconds === 'number' ? data.seconds : 0;
							if (duration <= 0) return;
							const fraction = Math.min(1, seconds / duration);
							if (fraction > maxFraction) {
								maxFraction = fraction;
								onPositionChange?.(fraction);
							}
						});
					} else {
						console.warn('video tracking disabled: player has no timeupdate event');
					}
					if (player.supports('event', 'seeked')) {
						player.on('seeked', () => {});
					}
					if (player.supports('event', 'ended')) {
						player.on('ended', () => {
							maxFraction = 1;
							onPositionChange?.(1);
						});
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
	<div class="flex items-center gap-2 border-t border-ink-900/8 px-3 py-2">
		<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900/10">
			<div
				class="h-full rounded-full bg-emerald-500 transition-[width]"
				style={`width:${progressPct}%`}
			></div>
		</div>
		<p
			class={`text-[11.5px] font-semibold ${progressPct >= 100 ? 'text-emerald-600' : 'text-ink-500'}`}
		>
			{progressPct}%
		</p>
	</div>
</div>
