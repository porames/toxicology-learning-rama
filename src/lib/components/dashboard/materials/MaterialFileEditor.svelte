<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { FileUpload } from '$lib/components/ui';
	import { storage } from '$lib/firebase';
	import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
	import { doc, updateDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import type { Material } from '$lib/dashboard/types';
	import type { MaterialState } from '$lib/dashboard/materialState';

	let {
		material,
		state,
		classId,
		lectureId,
		onValueChange,
	}: {
		material: Material;
		state: MaterialState;
		classId: string;
		lectureId: string;
		onValueChange: (value: string) => void;
	} = $props();

	async function handleFileUpload(file: File) {
		state.fileUploading = true;
		state.fileProgress = 0;
		try {
			const ext = file.name.split('.').pop();
			const storageRef = ref(storage, `materials/${material.id}.${ext}`);
			const uploadTask = uploadBytesResumable(storageRef, file);
			uploadTask.on('state_changed', (snapshot) => {
				state.fileProgress = Math.round(
					(snapshot.bytesTransferred / snapshot.totalBytes) * 100,
				);
			});
			await uploadTask;
			const downloadUrl = await getDownloadURL(storageRef);
			state.fileUrl = downloadUrl;
			onValueChange(downloadUrl);
			await updateDoc(
				doc(db, 'classes', classId, 'lectures', lectureId, 'materials', material.id),
				{ value: downloadUrl },
			);
		} catch (err) {
			console.error(err);
		} finally {
			state.fileUploading = false;
		}
	}
</script>

<div class="space-y-2">
	{#if !state.fileUrl}
		<div class="flex items-center gap-3">
			<FileUpload
				accept="image/*,.ppt,.pptx,.docx,.pdf"
				disabled={state.fileUploading}
				label={state.fileUploading ? `Uploading ${state.fileProgress}%` : 'Choose file'}
				onupload={(file) => {
					if (file instanceof File) handleFileUpload(file);
				}}
			/>
			{#if state.fileUploading}
				<div class="flex-1 h-2 rounded-full bg-ink-900/10 overflow-hidden">
					<div
						class="h-full rounded-full bg-iris-500 transition-all duration-300"
						style="width: {state.fileProgress}%"
					></div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex items-center gap-2 text-[12.5px] text-emerald-600">
			<Check class="h-4 w-4" />
			<a
				href={state.fileUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="underline hover:text-emerald-700 truncate max-w-[200px]"
			>
				View file
			</a>
			<button
				type="button"
				onclick={() => {
					state.fileUrl = '';
					onValueChange('');
				}}
				class="text-[12px] text-ink-400 hover:text-red-500 underline ml-auto"
			>
				Remove
			</button>
		</div>
	{/if}
</div>
