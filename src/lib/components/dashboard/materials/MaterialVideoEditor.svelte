<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { FileUpload, Input } from '$lib/components/ui';
	import { authState } from '$lib/auth.svelte';
	import { doc, updateDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import * as Utils from '$lib/dashboard/utils';
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

	async function fetchVideoEmbed(vid: string) {
		try {
			const user = authState.user;
			const token = await user?.getIdToken();
			const res = await fetch(
				'https://us-central1-rama-toxico-edu.cloudfunctions.net/getVideoPlaybackUrl',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ videoId: vid }),
				},
			);
			if (res.ok) {
				const data = await res.json();
				state.embedUrl = data.embedUrl;
			}
		} catch (err) {
			console.error(err);
		}
	}

	$effect(() => {
		if (state.videoId && !state.embedUrl) {
			fetchVideoEmbed(state.videoId);
		}
	});

	async function handleVideoUpload(file: File) {
		state.uploading = true;
		state.progress = 0;
		try {
			const user = authState.user;
			const token = await user?.getIdToken();
			const uploadRes = await fetch(
				'https://us-central1-rama-toxico-edu.cloudfunctions.net/getVideoUploadUrl',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ title: file.name }),
				},
			);
			if (!uploadRes.ok) throw new Error('Failed to get upload URL');
			const { apiKey, libraryId, videoId } = await uploadRes.json();
			const uploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`;
			const xhr = new XMLHttpRequest();
			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) {
					state.progress = Math.round((e.loaded / e.total) * 100);
				}
			};
			await new Promise<void>((resolve, reject) => {
				xhr.onload = () => resolve();
				xhr.onerror = () => reject(new Error('Upload failed'));
				xhr.open('PUT', uploadUrl);
				xhr.setRequestHeader('AccessKey', apiKey);
				xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
				xhr.send(file);
			});

			state.videoId = videoId;
			onValueChange(videoId);
			await updateDoc(
				doc(db, 'classes', classId, 'lectures', lectureId, 'materials', material.id),
				{ value: videoId },
			);
		} catch (err) {
			console.error(err);
		} finally {
			state.uploading = false;
		}
	}
</script>

<div class="space-y-2">
	{#if state.videoId}
		<div class="space-y-2">
			{#if state.embedUrl}
				<div class="overflow-hidden rounded-lg border border-ink-900/8">
					<div class="aspect-video">
						<iframe
							title="Video player"
							src={state.embedUrl}
							class="h-full w-full"
							allow="autoplay; encrypted-media; picture-in-picture"
							allowfullscreen
						></iframe>
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-2 text-[12.5px] text-ink-500">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
					></div>
					Loading video…
				</div>
			{/if}
			<div class="flex items-center gap-2 text-[12.5px] text-emerald-600">
				<Check class="h-4 w-4" />
				Video uploaded
				<button
					type="button"
					onclick={() => {
						state.videoId = '';
						state.embedUrl = null;
						onValueChange('');
					}}
					class="text-[12px] text-ink-400 hover:text-red-500 underline ml-2"
				>
					Remove
				</button>
			</div>
		</div>
	{:else}
		<div class="flex gap-1">
			<button
				type="button"
				onclick={() => {
					state.videoMode = 'youtube';
				}}
				class={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
					state.videoMode === 'youtube'
						? 'bg-iris-600 text-white'
						: 'bg-ink-900/5 text-ink-700 hover:bg-ink-900/10'
				}`}
			>
				YouTube
			</button>
			<button
				type="button"
				onclick={() => {
					state.videoMode = 'upload';
				}}
				class={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
					state.videoMode === 'upload'
						? 'bg-iris-600 text-white'
						: 'bg-ink-900/5 text-ink-700 hover:bg-ink-900/10'
				}`}
			>
				Upload
			</button>
		</div>

		{#if state.videoMode === 'youtube'}
			<div class="space-y-2">
				<Input
					value={material.value}
					oninput={(e) => {
						const target = e.target as HTMLInputElement;
						onValueChange(target.value);
					}}
					placeholder="https://youtube.com/watch?v=..."
					error={
						material.value && !Utils.getYoutubeVideoId(material.value)
							? 'Please enter a valid YouTube link'
							: ''
					}
				/>
				{#if Utils.getYoutubeVideoId(material.value)}
					<div class="overflow-hidden rounded-lg border border-ink-900/8">
						<div class="aspect-video">
							<iframe
								title="YouTube video"
								src={`https://www.youtube.com/embed/${Utils.getYoutubeVideoId(material.value)}`}
								class="h-full w-full"
								allow="autoplay; encrypted-media; picture-in-picture"
								allowfullscreen
							></iframe>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex items-center gap-3">
				<FileUpload
					accept="video/*"
					disabled={state.uploading}
					label={state.uploading ? `Uploading ${state.progress}%` : 'Choose video file'}
					onupload={(file) => {
						if (file instanceof File) handleVideoUpload(file);
					}}
				/>
				{#if state.uploading}
					<div class="flex-1 h-2 rounded-full bg-ink-900/10 overflow-hidden">
						<div
							class="h-full rounded-full bg-iris-500 transition-all duration-300"
							style="width: {state.progress}%"
						></div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
