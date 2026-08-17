<script lang="ts">
	import { Check, FolderOpen } from '@lucide/svelte';
	import { FileUpload, Button } from '$lib/components/ui';
	import { authState } from '$lib/auth.svelte';
	import { functionsUrl } from '$lib/functionsUrl';
	import { doc, updateDoc } from 'firebase/firestore';
	import { ref, getDownloadURL } from 'firebase/storage';
	import { db, storage } from '$lib/firebase';
	import type { Material } from '$lib/dashboard/types';
	import type { MaterialState } from '$lib/dashboard/materialState';
	import { t } from '$lib/i18n';
	import FilePicker, { type UploadedFile } from './FilePicker.svelte';

	const MAX_FILE_BYTES = 10 * 1024 * 1024;

	let {
		material,
		state: mstate,
		classId,
		lectureId,
		onValueChange,
		persistValue,
	}: {
		material: Material;
		state: MaterialState;
		classId: string;
		lectureId: string;
		onValueChange: (value: string) => void;
		persistValue?: (value: string) => Promise<void>;
	} = $props();

	let fileError = $state('');
	let showFilePicker = $state(false);

	function applyUrl(url: string) {
		mstate.fileUrl = url;
		onValueChange(url);
		if (persistValue) {
			void persistValue(url);
		} else {
			void updateDoc(
				doc(db, 'classes', classId, 'lectures', lectureId, 'materials', material.id),
				{ value: url },
			);
		}
	}

	async function handleSelectFile(file: UploadedFile) {
		showFilePicker = false;
		try {
			const url = await getDownloadURL(ref(storage, file.storagePath));
			applyUrl(url);
		} catch (err) {
			console.error(err);
			fileError = t('common.somethingWentWrong');
		}
	}

	async function handleFileUpload(file: File) {
		if (file.size > MAX_FILE_BYTES) {
			fileError = t('materials.fileTooLarge');
			return;
		}
		fileError = '';
		mstate.fileUploading = true;
		mstate.fileProgress = 0;
		try {
			const user = authState.user;
			if (!user) throw new Error('Not signed in');
			const token = await user.getIdToken();

			const fileData = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = () => reject(reader.error);
				reader.readAsDataURL(file);
			});

			const { downloadUrl } = await new Promise<{ downloadUrl: string }>(
				(resolve, reject) => {
					const xhr = new XMLHttpRequest();
					xhr.upload.onprogress = (e) => {
						if (e.lengthComputable) {
							mstate.fileProgress = Math.round((e.loaded / e.total) * 100);
						}
					};
					xhr.onload = () => {
						if (xhr.status >= 200 && xhr.status < 300) {
							resolve(JSON.parse(xhr.responseText));
						} else {
							reject(new Error(`Upload failed: ${xhr.status}`));
						}
					};
					xhr.onerror = () => reject(new Error('Upload failed'));
					xhr.open('POST', functionsUrl('uploadMaterial'));
					xhr.setRequestHeader('Content-Type', 'application/json');
					xhr.setRequestHeader('Authorization', `Bearer ${token}`);
					xhr.send(
						JSON.stringify({
							originalName: file.name,
							description: material.title || file.name,
							fileData,
						}),
					);
				},
			);

			applyUrl(downloadUrl);
		} catch (err) {
			console.error(err);
			fileError = t('common.somethingWentWrong');
		} finally {
			mstate.fileUploading = false;
		}
	}
</script>

<div class="space-y-2">
	{#if !mstate.fileUrl}
		<div class="flex items-center gap-3">
			<FileUpload
				accept="image/*,.ppt,.pptx,.docx,.pdf"
				disabled={mstate.fileUploading}
				label={mstate.fileUploading
					? t('assignmentDetail.uploadingPercent', { percent: mstate.fileProgress })
					: t('assignmentDetail.chooseFile')}
				onupload={(file) => {
					if (file instanceof File) handleFileUpload(file);
				}}
			/>
			<Button variant="ghost" onclick={() => (showFilePicker = true)}>
				<FolderOpen class="h-4 w-4" />
				{t('materials.chooseUploadedFiles')}
			</Button>
			{#if mstate.fileUploading}
				<div class="flex-1 h-2 rounded-full bg-ink-900/10 overflow-hidden">
					<div
						class="h-full rounded-full bg-iris-500 transition-all duration-300"
						style="width: {mstate.fileProgress}%"
					></div>
				</div>
			{/if}
		</div>
		{#if fileError}
			<p class="text-[12px] text-red-500">{fileError}</p>
		{/if}
	{:else}
		<div class="flex items-center gap-2 text-[12.5px] text-emerald-600">
			<Check class="h-4 w-4" />
			<a
				href={mstate.fileUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="underline hover:text-emerald-700 truncate max-w-[200px]"
			>
				{t('materials.viewFile')}
			</a>
			<button
				type="button"
				onclick={() => {
					mstate.fileUrl = '';
					onValueChange('');
				}}
				class="text-[12px] text-ink-400 hover:text-red-500 underline ml-auto"
			>
				{t('materials.remove')}
			</button>
		</div>
	{/if}
</div>

{#if showFilePicker}
	<FilePicker onSelect={handleSelectFile} onClose={() => (showFilePicker = false)} />
{/if}
