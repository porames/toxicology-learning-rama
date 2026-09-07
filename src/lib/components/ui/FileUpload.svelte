<script lang="ts">
	import { Upload, File as FileIcon } from '@lucide/svelte';
	import { t } from '$lib/i18n';

	interface Props {
		accept?: string;
		label?: string;
		disabled?: boolean;
		multiple?: boolean;
		onupload?: (files: FileList | File) => void;
		id?: string;
		class?: string;
	}

	let {
		accept,
		label = t('assignmentDetail.chooseFile'),
		disabled = false,
		multiple = false,
		onupload,
		id = undefined,
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
		class="btn btn-dash btn-sm gap-2 text-[13px] font-medium transition-colors {disabled
			? 'btn-disabled opacity-50'
			: dragging
				? 'btn-primary'
				: 'text-ink-500 hover:border-iris-400 hover:text-iris-600'}"
	>
		{#if dragging}
			<FileIcon class="h-4 w-4 shrink-0" />
			<span>{t('assignmentDetail.dropFilesHere')}</span>
		{:else}
			<Upload class="h-4 w-4 shrink-0" />
			<span>{label}</span>
		{/if}
	</div>
	<input
		bind:this={fileInput}
		type="file"
		{id}
		{accept}
		{multiple}
		{disabled}
		onchange={handleChange}
		class="hidden"
	/>
</div>
