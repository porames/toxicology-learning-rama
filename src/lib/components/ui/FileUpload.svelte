<script lang="ts">
	import { Upload, File as FileIcon } from '@lucide/svelte';

	interface Props {
		accept?: string;
		label?: string;
		disabled?: boolean;
		multiple?: boolean;
		onupload?: (files: FileList | File) => void;
		class?: string;
	}

	let {
		accept,
		label = 'Choose file',
		disabled = false,
		multiple = false,
		onupload,
		class: className = '',
	}: Props = $props();

	let dragging = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled) dragging = true;
	}

	function handleDragLeave() {
		dragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (disabled || !e.dataTransfer?.files) return;
		const files = e.dataTransfer.files;
		if (files.length > 0) {
			onupload?.(multiple ? files : files[0]);
		}
	}

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			onupload?.(multiple ? target.files : target.files[0]);
			target.value = '';
		}
	}
</script>

<div class={className}>
	<div
		role="button"
		tabindex={disabled ? -1 : 0}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={() => !disabled && fileInput?.click()}
		onkeydown={(e) => {
			if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
				e.preventDefault();
				fileInput?.click();
			}
		}}
		class="flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[13px] font-medium transition-colors {disabled
			? 'cursor-not-allowed opacity-50 border-ink-900/10 bg-ink-900/[0.015] text-ink-400'
			: dragging
				? 'border-iris-500 bg-iris-50 text-iris-700'
				: 'border-dashed border-ink-900/15 bg-ink-900/[0.015] text-ink-500 hover:border-iris-400 hover:text-iris-600'}"
	>
		{#if dragging}
			<FileIcon class="h-4 w-4 shrink-0" />
			<span>Drop files here</span>
		{:else}
			<Upload class="h-4 w-4 shrink-0" />
			<span>{label}</span>
		{/if}
	</div>
	<input
		bind:this={fileInput}
		type="file"
		{accept}
		{multiple}
		{disabled}
		onchange={handleChange}
		class="hidden"
	/>
</div>
