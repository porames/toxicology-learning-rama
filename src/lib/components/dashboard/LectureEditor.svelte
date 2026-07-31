<script lang="ts">
	import type {
		ClassItem,
		Lecture,
		Material,
		MaterialType,
		Selection,
	} from '$lib/dashboard/types';
	import { MATERIAL_LABELS } from '$lib/dashboard/types';
	import { MATERIAL_ICON, MATERIAL_COLOR } from '$lib/dashboard/icons';
	import { authState } from '$lib/auth.svelte';
	import { db, storage } from '$lib/firebase';
	import {
		collection,
		getDocs,
		addDoc,
		serverTimestamp,
		updateDoc,
		deleteDoc,
		doc,
	} from 'firebase/firestore';
	import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
	import {
		Plus,
		ChevronRight,
		GripVertical,
		FileQuestion,
		X,
		Check,
		Trash2,
	} from '@lucide/svelte';
	import { Button, FileUpload, Input, Textarea } from '$lib/components/ui';
	import * as Utils from '$lib/dashboard/utils';

	let {
		selectedClass,
		selectedLecture,
		highlightMaterialId = undefined,
		onUpdateLecture,
		onNavigate,
		onDeleteLecture,
	}: {
		selectedClass: ClassItem;
		selectedLecture: Lecture;
		highlightMaterialId: string | undefined;
		onUpdateLecture: (patch: Partial<Pick<Lecture, 'title' | 'startTime' | 'endTime'>>) => void;
		onNavigate: (selection: Selection) => void;
		onDeleteLecture: (classId: string, lectureId: string) => void;
	} = $props();

	// Lecture editor materials state
	let lectureMaterials: Material[] = $state([]);
	let materialsOrder: string[] = $state([]);
	let materialsLoading = $state(false);
	let leSaving = $state(false);
	let showQuizPicker = $state(false);
	let leDeleteLecture = $state(false);

	// per-material UI state
	let materialStates = $state<
		Record<
			string,
			{
				videoMode: 'youtube' | 'upload';
				uploading: boolean;
				progress: number;
				videoId: string;
				embedUrl: string | null;
				deleting: boolean;
				requiredPostTest: boolean;
				pdfUrl: string;
				fileUploading: boolean;
				fileProgress: number;
				fileUrl: string;
			}
		>
	>({});

	function initMaterialState(mat: Material) {
		if (!materialStates[mat.id]) {
			materialStates[mat.id] = {
				videoMode: 'youtube',
				uploading: false,
				progress: 0,
				videoId: mat.type === 'video' ? mat.value || '' : '',
				embedUrl: null,
				deleting: false,
				requiredPostTest: mat.requiredPostTest ?? false,
				pdfUrl: mat.type === 'pdf' ? mat.value || '' : '',
				fileUploading: false,
				fileProgress: 0,
				fileUrl: mat.type === 'file' ? mat.value || '' : '',
			};
		}
	}

	async function fetchVideoEmbed(matId: string, vid: string) {
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
				if (materialStates[matId]) {
					materialStates[matId].embedUrl = data.embedUrl;
				}
			}
		} catch (err) {
			console.error(err);
		}
	}

	async function loadMaterialsForLecture(classId: string, lectureId: string) {
		materialsLoading = true;
		try {
			const snapshot = await getDocs(
				collection(db, 'classes', classId, 'lectures', lectureId, 'materials'),
			);
			const mats: Material[] = snapshot.docs.map((d) => ({
				id: d.id,
				type: d.data()?.type,
				title: d.data()?.title,
				value: d.data()?.value,
				requiredPostTest: d.data()?.requiredPostTest ?? false,
			}));
			const lecOrder = selectedLecture.materialsOrder;
			if (lecOrder && lecOrder.length > 0) {
				mats.sort((a, b) => {
					const aIdx = lecOrder.indexOf(a.id);
					const bIdx = lecOrder.indexOf(b.id);
					return (aIdx === -1 ? Infinity : aIdx) - (bIdx === -1 ? Infinity : bIdx);
				});
				materialsOrder = lecOrder;
			} else {
				materialsOrder = mats.map((m) => m.id);
			}
			lectureMaterials = mats;
			for (const mat of mats) {
				initMaterialState(mat);
				if (mat.type === 'video' && mat.value) {
					fetchVideoEmbed(mat.id, mat.value);
				}
			}
		} catch (err) {
			console.error(err);
		} finally {
			materialsLoading = false;
		}
	}

	$effect(() => {
		loadMaterialsForLecture(selectedClass.id, selectedLecture.id);
	});

	function updateMaterialLocal(
		materialId: string,
		patch: Partial<Pick<Material, 'title' | 'value'>>,
	) {
		lectureMaterials = lectureMaterials.map((m) =>
			m.id === materialId ? { ...m, ...patch } : m,
		);
	}

	async function addMaterialOp(type: MaterialType) {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		const docRef = await addDoc(
			collection(db, 'classes', classId, 'lectures', lectureId, 'materials'),
			{
				type,
				title: Utils.defaultMaterialTitle(type),
				value: '',
				createdAt: serverTimestamp(),
			},
		);
		const newMat: Material = {
			id: docRef.id,
			type,
			title: Utils.defaultMaterialTitle(type),
			value: '',
		};
		const newOrder = [...materialsOrder, docRef.id];
		materialsOrder = newOrder;
		lectureMaterials = [...lectureMaterials, newMat];
		initMaterialState(newMat);
		await updateDoc(doc(db, 'classes', classId, 'lectures', lectureId), {
			materialsOrder: newOrder,
		});
	}

	async function addMaterialWithQuiz(quizId: string, quizTitle: string) {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		const docRef = await addDoc(
			collection(db, 'classes', classId, 'lectures', lectureId, 'materials'),
			{
				type: 'quiz',
				title: quizTitle,
				value: quizId,
				createdAt: serverTimestamp(),
			},
		);
		const newMat: Material = { id: docRef.id, type: 'quiz', title: quizTitle, value: quizId };
		const newOrder = [...materialsOrder, docRef.id];
		materialsOrder = newOrder;
		lectureMaterials = [...lectureMaterials, newMat];
		initMaterialState(newMat);
		await updateDoc(doc(db, 'classes', classId, 'lectures', lectureId), {
			materialsOrder: newOrder,
		});
	}

	function handleAddMaterial(type: MaterialType) {
		if (type === 'quiz') {
			showQuizPicker = true;
		} else {
			addMaterialOp(type);
		}
	}

	async function handleMaterialDragEnd(draggedId: string, targetId: string) {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		const oldIndex = materialsOrder.indexOf(draggedId);
		const newIndex = materialsOrder.indexOf(targetId);
		if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

		const newOrder = [...materialsOrder];
		const [moved] = newOrder.splice(oldIndex, 1);
		newOrder.splice(newIndex, 0, moved);
		materialsOrder = newOrder;

		lectureMaterials = [...lectureMaterials].sort((a, b) => {
			const aIdx = newOrder.indexOf(a.id);
			const bIdx = newOrder.indexOf(b.id);
			return aIdx - bIdx;
		});

		await updateDoc(doc(db, 'classes', classId, 'lectures', lectureId), {
			materialsOrder: newOrder,
		});
	}

	async function deleteMaterialOp(materialId: string) {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;

		const mat = lectureMaterials.find((m) => m.id === materialId);
		if (mat?.type === 'video' && materialStates[materialId]?.videoId) {
			try {
				const user = authState.user;
				const token = await user?.getIdToken();
				await fetch('https://us-central1-rama-toxico-edu.cloudfunctions.net/deleteVideo', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ videoId: materialStates[materialId].videoId }),
				});
			} catch (err) {
				console.error(err);
			}
		}

		const newOrder = materialsOrder.filter((id) => id !== materialId);
		materialsOrder = newOrder;
		lectureMaterials = lectureMaterials.filter((m) => m.id !== materialId);

		await updateDoc(doc(db, 'classes', classId, 'lectures', lectureId), {
			materialsOrder: newOrder,
		});
		deleteDoc(
			doc(db, 'classes', classId, 'lectures', lectureId, 'materials', materialId),
		).catch(console.error);
	}

	async function saveLectureChanges() {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		leSaving = true;
		try {
			const lec = selectedLecture;
			if (!lec) return;
			await updateDoc(doc(db, 'classes', classId, 'lectures', lectureId), {
				title: lec.title,
				startTime: lec.startTime,
				endTime: lec.endTime,
			});
			await Promise.all(
				lectureMaterials.map((mat) => {
					const patch: Record<string, unknown> = {};
					if (mat.type !== undefined) patch.type = mat.type;
					if (mat.title !== undefined) patch.title = mat.title;
					if (mat.value !== undefined) patch.value = mat.value;
					if (mat.requiredPostTest !== undefined)
						patch.requiredPostTest = mat.requiredPostTest;
					return updateDoc(
						doc(db, 'classes', classId, 'lectures', lectureId, 'materials', mat.id),
						patch,
					);
				}),
			);
		} catch (err) {
			console.error(err);
		} finally {
			leSaving = false;
		}
	}

	async function handleDeleteLecture() {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		leDeleteLecture = true;
		try {
			await deleteDoc(doc(db, 'classes', classId, 'lectures', lectureId));
			onDeleteLecture(classId, lectureId);
		} catch (err) {
			console.error(err);
		} finally {
			leDeleteLecture = false;
		}
	}

	// Quiz picker state
	let quizPickerQuizzes: { id: string; title: string; questions: unknown[] }[] = $state([]);
	let quizPickerLoading = $state(true);

	async function loadQuizzes() {
		quizPickerLoading = true;
		try {
			const snap = await getDocs(collection(db, 'quizzes'));
			quizPickerQuizzes = snap.docs.map((d) => ({
				id: d.id,
				title: d.data().title || 'Untitled',
				questions: d.data().questions || [],
			}));
		} catch (err) {
			console.error(err);
		} finally {
			quizPickerLoading = false;
		}
	}

	$effect(() => {
		if (showQuizPicker) {
			loadQuizzes();
		}
	});

	// Video upload handler
	async function handleVideoUpload(matId: string, file: File) {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		const state = materialStates[matId];
		if (!state) return;

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
			updateMaterialLocal(matId, { value: videoId });
			fetchVideoEmbed(matId, videoId);
			await updateDoc(
				doc(db, 'classes', classId, 'lectures', lectureId, 'materials', matId),
				{ value: videoId },
			);
		} catch (err) {
			console.error(err);
		} finally {
			state.uploading = false;
		}
	}

	// File upload handler (Firebase Storage)
	async function handleFileUpload(matId: string, file: File) {
		const classId = selectedClass.id;
		const lectureId = selectedLecture.id;
		const state = materialStates[matId];
		if (!state) return;

		state.fileUploading = true;
		state.fileProgress = 0;
		try {
			const ext = file.name.split('.').pop();
			const storageRef = ref(storage, `materials/${matId}.${ext}`);
			const uploadTask = uploadBytesResumable(storageRef, file);
			uploadTask.on('state_changed', (snapshot) => {
				state.fileProgress = Math.round(
					(snapshot.bytesTransferred / snapshot.totalBytes) * 100,
				);
			});
			await uploadTask;
			const downloadUrl = await getDownloadURL(storageRef);
			state.fileUrl = downloadUrl;
			updateMaterialLocal(matId, { value: downloadUrl });
			await updateDoc(
				doc(db, 'classes', classId, 'lectures', lectureId, 'materials', matId),
				{ value: downloadUrl },
			);
		} catch (err) {
			console.error(err);
		} finally {
			state.fileUploading = false;
		}
	}

	const materialTypes: MaterialType[] = ['video', 'file', 'link', 'text', 'quiz'];
</script>

<div class="mx-auto max-w-xl px-8 py-10">
	<div class="md:hidden flex items-center gap-1.5 mb-4">
		<button
			type="button"
			onclick={() => onNavigate(null)}
			class="text-[12px] text-ink-400 hover:text-iris-600 transition-colors"
		>
			All Classes
		</button>
		<ChevronRight class="h-3 w-3 text-ink-300" />
		<button
			type="button"
			onclick={() => onNavigate({ level: 'class', classId: selectedClass.id })}
			class="text-[12px] text-ink-400 hover:text-iris-600 transition-colors"
		>
			{selectedClass.name}
		</button>
		<ChevronRight class="h-3 w-3 text-ink-300" />
		<span class="text-[12px] font-medium text-ink-900">
			{selectedLecture.title || 'Untitled lecture'}
		</span>
	</div>
	<div class="flex item-center justify-between">
		<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">Lecture</p>
		<Button variant="accent" disabled={leSaving} onclick={saveLectureChanges}>
			{#if leSaving}
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
				></div>
				Saving…
			{:else}
				Save changes
			{/if}
		</Button>
	</div>
	<div class="mt-4">
		<Input
			label="Lecture title"
			value={selectedLecture.title}
			oninput={(e) => {
				const target = e.target as HTMLInputElement;
				onUpdateLecture({ title: target.value });
			}}
			placeholder="e.g. Sorting Algorithms"
		/>
	</div>

	<div class="mt-4 grid grid-cols-2 gap-3">
		<Input
			type="datetime-local"
			label="Start time"
			value={Utils.dateToStringInput(selectedLecture.startTime)}
			oninput={(e) => {
				const target = e.target as HTMLInputElement;
				onUpdateLecture({
					startTime: Utils.stringInputToDate(target.value),
				});
			}}
		/>
		<Input
			type="datetime-local"
			label="End time"
			value={Utils.dateToStringInput(selectedLecture.endTime)}
			oninput={(e) => {
				const target = e.target as HTMLInputElement;
				onUpdateLecture({
					endTime: Utils.stringInputToDate(target.value),
				});
			}}
		/>
	</div>

	<div class="mt-9 border-t border-ink-900/10 pt-6">
		<p class="text-[13.5px] font-medium text-ink-900">
			Class materials
			<span class="ml-1.5 font-normal text-ink-300">({lectureMaterials.length})</span>
		</p>

		{#if materialsLoading}
			<div class="flex items-center justify-center gap-2 py-8">
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
				></div>
				<span class="text-[13px] text-ink-500">Loading materials…</span>
			</div>
		{:else if lectureMaterials.length === 0}
			<p class="py-4 text-center text-[13px] text-ink-400">No materials yet.</p>
		{:else}
			<div class="mt-4 space-y-3" ondragover={(e) => e.preventDefault()}>
				{#each lectureMaterials as mat (mat.id)}
					{@const ms = materialStates[mat.id]}
					{@const Icon = MATERIAL_ICON[mat.type]}
					{@const color = MATERIAL_COLOR[mat.type]}
					{@const highlighted = mat.id === highlightMaterialId}

					{@const videoMode = ms?.videoMode ?? 'youtube'}
					{@const uploading = ms?.uploading ?? false}
					{@const progress = ms?.progress ?? 0}
					{@const videoId = ms?.videoId ?? ''}
					{@const embedUrl = ms?.embedUrl ?? null}
					{@const requiredPostTest = ms?.requiredPostTest ?? false}
					{@const fileUrl = ms?.fileUrl ?? ''}
					{@const fileUploading = ms?.fileUploading ?? false}
					{@const fileProgress = ms?.fileProgress ?? 0}
					{@const pdfUrl = ms?.pdfUrl ?? ''}

					<div
						draggable="true"
						ondragstart={(e) => {
							e.dataTransfer?.setData('text/plain', mat.id);
							if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
						}}
						ondrop={(e) => {
							e.preventDefault();
							const draggedId = e.dataTransfer?.getData('text/plain');
							if (draggedId) handleMaterialDragEnd(draggedId, mat.id);
						}}
						ondragover={(e) => e.preventDefault()}
						class={`rounded-xl border bg-white p-3.5 transition ${
							highlighted
								? `border-transparent ring-2 ${color.ring}`
								: 'border-ink-900/10'
						}`}
					>
						<div class="flex items-start gap-1.5">
							<button
								type="button"
								class="mt-1 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-ink-300 transition active:cursor-grabbing hover:text-ink-500"
								aria-label="Drag to reorder"
							>
								<GripVertical class="h-4 w-4" />
							</button>
							<div class="flex items-start gap-2.5 min-w-0 flex-1">
								<span
									class={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${color.bg} ${color.text}`}
								>
									<Icon class="h-3.5 w-3.5" />
								</span>

								<div class="min-w-0 flex-1 space-y-2">
									<Input
										value={mat.title}
										oninput={(e) => {
											const target = e.target as HTMLInputElement;
											updateMaterialLocal(mat.id, { title: target.value });
										}}
										placeholder="Material title"
									/>

									{#if mat.type === 'youtube'}
										<div class="space-y-2">
											<Input
												value={mat.value}
												oninput={(e) => {
													const target = e.target as HTMLInputElement;
													updateMaterialLocal(mat.id, {
														value: target.value,
													});
												}}
												placeholder="https://youtube.com/watch?v=..."
												error={mat.value &&
												!Utils.getYoutubeVideoId(mat.value)
													? 'Please enter a valid YouTube link'
													: ''}
											/>
											{#if Utils.getYoutubeVideoId(mat.value)}
												<div
													class="overflow-hidden rounded-lg border border-ink-900/8"
												>
													<div class="aspect-video">
														<iframe
															title="YouTube video"
															src={`https://www.youtube.com/embed/${Utils.getYoutubeVideoId(mat.value)}`}
															class="h-full w-full"
															allow="autoplay; encrypted-media; picture-in-picture"
															allowfullscreen
														></iframe>
													</div>
												</div>
											{/if}
										</div>
									{/if}

									{#if mat.type === 'link'}
										<Input
											value={mat.value}
											oninput={(e) => {
												const target = e.target as HTMLInputElement;
												updateMaterialLocal(mat.id, {
													value: target.value,
												});
											}}
											placeholder="https://example.com/resource"
										/>
									{/if}

									{#if mat.type === 'text'}
										<Textarea
											value={mat.value}
											oninput={(e) => {
												const target = e.target as HTMLTextAreaElement;
												updateMaterialLocal(mat.id, {
													value: target.value,
												});
											}}
											placeholder="Write the note or instructions here…"
											rows={3}
										/>
									{/if}

									{#if mat.type === 'pdf' && pdfUrl}
										<div
											class="flex items-center gap-2 text-[12.5px] text-emerald-600"
										>
											<Check class="h-4 w-4" />
											<a
												href={pdfUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="underline hover:text-emerald-700 truncate max-w-[200px]"
											>
												View PDF
											</a>
											<button
												type="button"
												onclick={() => {
													if (ms) ms.pdfUrl = '';
													updateMaterialLocal(mat.id, { value: '' });
												}}
												class="text-[12px] text-ink-400 hover:text-red-500 underline ml-auto"
											>
												Remove
											</button>
										</div>
									{/if}

									{#if mat.type === 'file'}
										<div class="space-y-2">
											{#if !fileUrl}
												<div class="flex items-center gap-3">
													<FileUpload
														accept="image/*,.ppt,.pptx,.docx,.pdf"
														disabled={fileUploading}
														label={fileUploading
															? `Uploading ${fileProgress}%`
															: 'Choose file'}
														onupload={(file) => {
															if (file instanceof File)
																handleFileUpload(mat.id, file);
														}}
													/>
													{#if fileUploading}
														<div
															class="flex-1 h-2 rounded-full bg-ink-900/10 overflow-hidden"
														>
															<div
																class="h-full rounded-full bg-iris-500 transition-all duration-300"
																style="width: {fileProgress}%"
															></div>
														</div>
													{/if}
												</div>
											{:else}
												<div
													class="flex items-center gap-2 text-[12.5px] text-emerald-600"
												>
													<Check class="h-4 w-4" />
													<a
														href={fileUrl}
														target="_blank"
														rel="noopener noreferrer"
														class="underline hover:text-emerald-700 truncate max-w-[200px]"
													>
														View file
													</a>
													<button
														type="button"
														onclick={() => {
															if (ms) ms.fileUrl = '';
															updateMaterialLocal(mat.id, {
																value: '',
															});
														}}
														class="text-[12px] text-ink-400 hover:text-red-500 underline ml-auto"
													>
														Remove
													</button>
												</div>
											{/if}
										</div>
									{/if}

									{#if mat.type === 'quiz'}
										<div class="space-y-2">
											<div class="flex items-center gap-2">
												<FileQuestion
													class="h-5 w-5 shrink-0 text-iris-500"
												/>
												<span class="text-[13px] text-ink-700">
													{mat.title || 'Untitled quiz'}
												</span>
												{#if mat.value}
													<button
														type="button"
														onclick={() => {
															window.open(
																`/quiz/${mat.value}/edit`,
																'_blank',
															);
														}}
														class="ml-auto text-[12px] font-medium text-iris-600 underline hover:text-iris-700"
													>
														Edit quiz
													</button>
												{/if}
											</div>
											<label
												class="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-600"
											>
												<input
													type="checkbox"
													checked={requiredPostTest}
													onchange={async (e) => {
														const checked = (
															e.target as HTMLInputElement
														).checked;
														if (ms) ms.requiredPostTest = checked;
														try {
															await updateDoc(
																doc(
																	db,
																	'classes',
																	selectedClass.id,
																	'lectures',
																	selectedLecture.id,
																	'materials',
																	mat.id,
																),
																{ requiredPostTest: checked },
															);
														} catch (err) {
															console.error(err);
															if (ms) ms.requiredPostTest = !checked;
														}
													}}
													class="h-3.5 w-3.5 rounded border-ink-900/20 text-iris-500"
												/>
												Required post-test
											</label>
										</div>
									{/if}

									{#if mat.type === 'video'}
										<div class="space-y-2">
											{#if videoId}
												<div class="space-y-2">
													{#if embedUrl}
														<div
															class="overflow-hidden rounded-lg border border-ink-900/8"
														>
															<div class="aspect-video">
																<iframe
																	title="Video player"
																	src={embedUrl}
																	class="h-full w-full"
																	allow="autoplay; encrypted-media; picture-in-picture"
																	allowfullscreen
																></iframe>
															</div>
														</div>
													{:else}
														<div
															class="flex items-center gap-2 text-[12.5px] text-ink-500"
														>
															<div
																class="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
															></div>
															Loading video…
														</div>
													{/if}
													<div
														class="flex items-center gap-2 text-[12.5px] text-emerald-600"
													>
														<Check class="h-4 w-4" />
														Video uploaded
														<button
															type="button"
															onclick={() => {
																if (ms) {
																	ms.videoId = '';
																	ms.embedUrl = null;
																}
																updateMaterialLocal(mat.id, {
																	value: '',
																});
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
															if (ms) ms.videoMode = 'youtube';
														}}
														class={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
															videoMode === 'youtube'
																? 'bg-iris-600 text-white'
																: 'bg-ink-900/5 text-ink-700 hover:bg-ink-900/10'
														}`}
													>
														YouTube
													</button>
													<button
														type="button"
														onclick={() => {
															if (ms) ms.videoMode = 'upload';
														}}
														class={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
															videoMode === 'upload'
																? 'bg-iris-600 text-white'
																: 'bg-ink-900/5 text-ink-700 hover:bg-ink-900/10'
														}`}
													>
														Upload
													</button>
												</div>

												{#if videoMode === 'youtube'}
													<div class="space-y-2">
														<Input
															value={mat.value}
															oninput={(e) => {
																const target =
																	e.target as HTMLInputElement;
																updateMaterialLocal(mat.id, {
																	value: target.value,
																});
															}}
															placeholder="https://youtube.com/watch?v=..."
															error={mat.value &&
															!Utils.getYoutubeVideoId(mat.value)
																? 'Please enter a valid YouTube link'
																: ''}
														/>
														{#if Utils.getYoutubeVideoId(mat.value)}
															<div
																class="overflow-hidden rounded-lg border border-ink-900/8"
															>
																<div class="aspect-video">
																	<iframe
																		title="YouTube video"
																		src={`https://www.youtube.com/embed/${Utils.getYoutubeVideoId(mat.value)}`}
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
															disabled={uploading}
															label={uploading
																? `Uploading ${progress}%`
																: 'Choose video file'}
															onupload={(file) => {
																if (file instanceof File)
																	handleVideoUpload(mat.id, file);
															}}
														/>
														{#if uploading}
															<div
																class="flex-1 h-2 rounded-full bg-ink-900/10 overflow-hidden"
															>
																<div
																	class="h-full rounded-full bg-iris-500 transition-all duration-300"
																	style="width: {progress}%"
																></div>
															</div>
														{/if}
													</div>
												{/if}
											{/if}
										</div>
									{/if}
								</div>

								<button
									type="button"
									disabled={ms?.deleting ?? false}
									onclick={() => deleteMaterialOp(mat.id)}
									aria-label="Delete material"
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-300 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
								>
									{#if ms?.deleting}
										<div
											class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-900/10 border-t-red-500"
										></div>
									{:else}
										<Trash2 class="h-3.5 w-3.5" />
									{/if}
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-4">
			<p class="mb-2 text-[12.5px] font-medium text-ink-500">Add material</p>
			<div class="flex flex-wrap gap-2">
				{#each materialTypes as type}
					{@const Icon = MATERIAL_ICON[type]}
					{@const color = MATERIAL_COLOR[type]}
					<button
						type="button"
						disabled={materialsLoading}
						onclick={() => handleAddMaterial(type)}
						class={`flex items-center gap-1.5 rounded-lg border border-ink-900/10 bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-700 shadow-soft transition hover:border-transparent hover:${color.bg} disabled:cursor-not-allowed disabled:opacity-40`}
					>
						<span
							class={`flex h-4 w-4 items-center justify-center rounded ${color.bg} ${color.text}`}
						>
							<Icon class="h-2.5 w-2.5" />
						</span>
						{MATERIAL_LABELS[type]}
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if showQuizPicker}
		<!-- QuizPickerModal -->
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
			onclick={() => (showQuizPicker = false)}
			role="none"
		>
			<div
				class="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl"
				onclick={(e) => e.stopPropagation()}
				role="none"
			>
				<div class="flex items-center justify-between border-b border-ink-900/10 px-5 py-4">
					<p class="text-[15px] font-semibold text-ink-900">Link a quiz</p>
					<button
						onclick={() => (showQuizPicker = false)}
						class="flex h-7 w-7 items-center justify-center rounded text-ink-400 hover:bg-ink-900/5 hover:text-ink-700"
					>
						<X class="h-4 w-4" />
					</button>
				</div>
				<div class="max-h-80 overflow-y-auto px-5 py-3">
					{#if quizPickerLoading}
						<div class="flex items-center justify-center py-8">
							<div
								class="h-5 w-5 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
							></div>
						</div>
					{:else if quizPickerQuizzes.length === 0}
						<p class="py-8 text-center text-[13px] text-ink-400">
							No quizzes yet.&nbsp;
							<button
								onclick={() => {
									showQuizPicker = false;
									window.open('/quiz/new', '_blank');
								}}
								class="text-iris-600 underline hover:text-iris-700"
							>
								Create one
							</button>
						</p>
					{:else}
						<div class="space-y-2">
							{#each quizPickerQuizzes as q (q.id)}
								<button
									onclick={() => {
										addMaterialWithQuiz(q.id, q.title);
										showQuizPicker = false;
									}}
									class="flex w-full items-center gap-3 rounded-lg border border-ink-900/10 px-4 py-3 text-left transition hover:border-iris-400 hover:bg-iris-50"
								>
									<FileQuestion class="h-5 w-5 shrink-0 text-iris-500" />
									<div class="min-w-0 flex-1">
										<p class="truncate text-[14px] font-medium text-ink-900">
											{q.title}
										</p>
										<p class="text-[12px] text-ink-400">
											{q.questions.length} questions
										</p>
									</div>
								</button>
							{/each}
						</div>
					{/if}
					<div class="border-t border-ink-900/10 mt-3 pt-3">
						<button
							onclick={() => {
								showQuizPicker = false;
								window.open('/quiz/new', '_blank');
							}}
							class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-900/15 px-3 py-2 text-[13px] font-medium text-iris-600 transition hover:border-iris-400 hover:bg-iris-50"
						>
							<Plus class="h-3.5 w-3.5" />
							Create new quiz
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<button
		type="button"
		onclick={handleDeleteLecture}
		disabled={leDeleteLecture}
		class="mt-9 text-[13px] font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
	>
		{#if leDeleteLecture}
			Deleting...
		{:else}
			Delete this lecture
		{/if}
	</button>
</div>
