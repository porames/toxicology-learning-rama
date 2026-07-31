<script lang="ts">
	import type { ClassItem, Lecture, Material, MaterialType, Selection } from '$lib/dashboard/types';
	import { MATERIAL_LABELS } from '$lib/dashboard/types';
	import { MATERIAL_ICON, MATERIAL_COLOR } from '$lib/dashboard/icons';
	import TreeView from '$lib/components/dashboard/TreeView.svelte';
	import ManageStudents from '$lib/components/dashboard/ManageStudents.svelte';
	import EnrolStudents from '$lib/components/dashboard/EnrolStudents.svelte';
	import DashboardLayout from '$lib/components/DashboardLayout.svelte';
	import formatTimeRange from '$lib/formatTimeRange';
	import { authState } from '$lib/auth.svelte';
	import { db, auth, storage } from '$lib/firebase';
	import {
		collection,
		getDocs,
		addDoc,
		serverTimestamp,
		updateDoc,
		deleteDoc,
		doc,
	} from 'firebase/firestore';
	import {
		ref,
		uploadBytesResumable,
		getDownloadURL,
	} from 'firebase/storage';
	import { signOut } from 'firebase/auth';
	import {
		Plus,
		UserRound,
		LogOut,
		ChevronRight,
		GripVertical,
		FileQuestion,
		X,
		Folder,
		Check,
		Trash2,
		Upload,
	} from '@lucide/svelte';
	import moment from 'moment';

	function makeId() {
		return typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	function defaultMaterialTitle(type: MaterialType) {
		switch (type) {
			case 'youtube':
				return 'New video';
			case 'pdf':
				return 'New file';
			case 'file':
				return 'New file';
			case 'link':
				return 'New link';
			case 'text':
				return 'New note';
			case 'video':
				return 'New video';
			case 'quiz':
				return 'New quiz';
		}
	}

	function getYoutubeVideoId(url: string): string | null {
		if (!url) return null;
		const patterns = [
			/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
			/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
			/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
			/(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
		];
		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match) return match[1];
		}
		return null;
	}

	function dateToStringInput(date: Date) {
		const offset = date.getTimezoneOffset();
		const localDate = new Date(date.getTime() - offset * 60 * 1000);
		return localDate.toISOString().slice(0, 16);
	}

	function stringInputToDate(strDate: string) {
		return new Date(strDate);
	}

	function defaultTimes() {
		const start = new Date();
		start.setMinutes(0, 0, 0);
		start.setHours(start.getHours() + 1);
		const end = new Date(start.getTime() + 90 * 60 * 1000);
		return { startTime: start, endTime: end };
	}

	const fieldClass =
		'w-full rounded-md bg-white px-3 py-2 text-[14px] text-ink-900 placeholder:text-ink-300 outline-1 -outline-offset-1 outline-ink-900/15 focus:outline-2 focus:-outline-offset-2 focus:outline-iris-500 transition';
	const labelClass = 'mb-1.5 block text-[12.5px] font-medium text-ink-700';

	let classes: ClassItem[] = $state([]);
	let selection: Selection = $state(null);
	let loading = $state(true);
	let lectureLoading = $state(false);
	let expanded: Set<string> = $state(new Set<string>());

	$effect(() => {
		async function loadClasses() {
			loading = true;
			try {
				const snapshot = await getDocs(collection(db, 'classes'));
				const classesData = snapshot.docs.map((d) => ({
					id: d.id,
					name: d.data()['name'],
					code: d.data()['code'],
					lectures: undefined,
					students: d.data()['enroledStudents'],
				}));
				classes = classesData;
				expanded = new Set(classesData.map((c) => c.id));
			} catch (err) {
				console.log(err);
			} finally {
				loading = false;
			}
		}
		loadClasses();
	});

	async function toggleExpand(classId: string, isCurrentlyExpanded: boolean) {
		const next = new Set(expanded);
		if (isCurrentlyExpanded) {
			next.delete(classId);
		} else {
			next.add(classId);
		}
		expanded = next;

		if (!isCurrentlyExpanded) {
			const currentClass = classes.find((cls) => cls.id === classId);
			const alreadyLoaded = currentClass?.lectures !== undefined;
			if (!alreadyLoaded) {
				const snapshot = await getDocs(collection(db, 'classes', classId, 'lectures'));
				const loadedLecs = snapshot.docs.map((d) => ({
					id: d.id,
					title: d.data()['title'],
					startTime: d.data()['startTime'].toDate(),
					endTime: d.data()['endTime'].toDate(),
					materials: [] as Material[],
					materialsOrder: (d.data()['materialsOrder'] as string[]) || [],
				}));
				classes = classes.map((cls) =>
					cls.id === classId ? { ...cls, lectures: loadedLecs } : cls
				);
			}
		}
	}

	function expandIds(ids: string[]) {
		const next = new Set(expanded);
		ids.forEach((id) => next.add(id));
		expanded = next;
	}

	async function addClass() {
		const snapshot = await addDoc(collection(db, 'classes'), {
			name: 'New class',
			code: '',
			createdAt: serverTimestamp(),
		});
		const newClass: ClassItem = { id: snapshot.id, name: 'New class', code: '', lectures: [] };
		classes = [...classes, newClass];
		expandIds([snapshot.id]);
		selection = { level: 'class', classId: snapshot.id };
	}

	function manageStudents() {
		selection = { level: 'manage_students' };
	}

	function renameClass(classId: string, patch: Partial<Pick<ClassItem, 'name' | 'code'>>) {
		classes = classes.map((c) => (c.id === classId ? { ...c, ...patch } : c));
	}

	function deleteClass(classId: string) {
		classes = classes.filter((c) => c.id !== classId);
		if (selection && 'classId' in selection && selection.classId === classId) {
			selection = null;
		}
	}

	async function addLecture(classId: string) {
		const { startTime, endTime } = defaultTimes();
		const snapshot = await addDoc(collection(db, 'classes', classId, 'lectures'), {
			title: 'New lecture',
			startTime,
			endTime,
			createdAt: serverTimestamp(),
		});
		const newLecture: Lecture = {
			id: snapshot.id,
			title: 'New lecture',
			startTime,
			endTime,
			materials: [],
		};
		classes = classes.map((c) =>
			c.id === classId
				? { ...c, lectures: [...(c.lectures ?? []), newLecture] }
				: c
		);
		expandIds([classId, snapshot.id]);
		selection = { level: 'lecture', classId, lectureId: snapshot.id };
	}

	function updateLecture(
		classId: string,
		lectureId: string,
		patch: Partial<Pick<Lecture, 'title' | 'startTime' | 'endTime'>>
	) {
		classes = classes.map((c) =>
			c.id !== classId
				? c
				: {
						...c,
						lectures: (c.lectures ?? []).map((l) =>
							l.id === lectureId ? { ...l, ...patch } : l
						),
					}
		);
	}

	async function loadLectureForClass(sel: Selection) {
		if (sel && 'classId' in sel && sel.level === 'class') {
			lectureLoading = true;
			try {
				const snapshot = await getDocs(
					collection(db, 'classes', sel.classId, 'lectures')
				);
				const loadedLecs = snapshot.docs.map((d) => ({
					id: d.id,
					title: d.data()['title'],
					startTime: d.data()['startTime'].toDate(),
					endTime: d.data()['endTime'].toDate(),
					materials: [] as Material[],
					materialsOrder: (d.data()['materialsOrder'] as string[]) || [],
				}));
				classes = classes.map((cls) =>
					cls.id === sel.classId ? { ...cls, lectures: loadedLecs } : cls
				);
				const next = new Set(expanded);
				if (next.has(sel.classId)) {
					next.delete(sel.classId);
				} else {
					next.add(sel.classId);
				}
				expanded = next;
			} finally {
				lectureLoading = false;
			}
		}
		selection = sel;
	}

	function deleteLecture(classId: string, lectureId: string) {
		classes = classes.map((c) =>
			c.id === classId
				? { ...c, lectures: (c.lectures ?? []).filter((l) => l.id !== lectureId) }
				: c
		);
		if (
			selection &&
			'lectureId' in selection &&
			selection.lectureId === lectureId
		) {
			selection = { level: 'class', classId };
		}
	}

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
				videoId: mat.type === 'video' ? (mat.value || '') : '',
				embedUrl: null,
				deleting: false,
				requiredPostTest: mat.requiredPostTest ?? false,
				pdfUrl: mat.type === 'pdf' ? (mat.value || '') : '',
				fileUploading: false,
				fileProgress: 0,
				fileUrl: mat.type === 'file' ? (mat.value || '') : '',
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
				}
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
				collection(db, 'classes', classId, 'lectures', lectureId, 'materials')
			);
			const mats: Material[] = snapshot.docs.map((d) => ({
				id: d.id,
				type: d.data()?.type,
				title: d.data()?.title,
				value: d.data()?.value,
				requiredPostTest: d.data()?.requiredPostTest ?? false,
			}));
			const selClass = classes.find((c) => c.id === classId);
			const selLect = selClass?.lectures?.find((l) => l.id === lectureId);
			const lecOrder = selLect?.materialsOrder;
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
		const sel = selection;
		if (sel && 'lectureId' in sel) {
			loadMaterialsForLecture(sel.classId, sel.lectureId);
		} else {
			lectureMaterials = [];
			materialsOrder = [];
		}
	});

	function updateMaterialLocal(
		materialId: string,
		patch: Partial<Pick<Material, 'title' | 'value'>>
	) {
		lectureMaterials = lectureMaterials.map((m) =>
			m.id === materialId ? { ...m, ...patch } : m
		);
	}

	async function addMaterialOp(type: MaterialType) {
		if (!selection || !('lectureId' in selection)) return;
		const { classId, lectureId } = selection;
		const docRef = await addDoc(
			collection(db, 'classes', classId, 'lectures', lectureId, 'materials'),
			{
				type,
				title: defaultMaterialTitle(type),
				value: '',
				createdAt: serverTimestamp(),
			}
		);
		const newMat: Material = { id: docRef.id, type, title: defaultMaterialTitle(type), value: '' };
		const newOrder = [...materialsOrder, docRef.id];
		materialsOrder = newOrder;
		lectureMaterials = [...lectureMaterials, newMat];
		initMaterialState(newMat);
		await updateDoc(doc(db, 'classes', classId, 'lectures', lectureId), {
			materialsOrder: newOrder,
		});
	}

	async function addMaterialWithQuiz(quizId: string, quizTitle: string) {
		if (!selection || !('lectureId' in selection)) return;
		const { classId, lectureId } = selection;
		const docRef = await addDoc(
			collection(db, 'classes', classId, 'lectures', lectureId, 'materials'),
			{
				type: 'quiz',
				title: quizTitle,
				value: quizId,
				createdAt: serverTimestamp(),
			}
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
		if (!selection || !('lectureId' in selection)) return;
		const { classId, lectureId } = selection;
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
		if (!selection || !('lectureId' in selection)) return;
		const { classId, lectureId } = selection;

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
			doc(db, 'classes', classId, 'lectures', lectureId, 'materials', materialId)
		).catch(console.error);
	}

	async function saveLectureChanges() {
		if (!selection || !('lectureId' in selection)) return;
		const { classId, lectureId } = selection;
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
						patch
					);
				})
			);
		} catch (err) {
			console.error(err);
		} finally {
			leSaving = false;
		}
	}

	async function handleDeleteLecture() {
		if (!selection || !('lectureId' in selection)) return;
		const { classId, lectureId } = selection;
		leDeleteLecture = true;
		try {
			await deleteDoc(doc(db, 'classes', classId, 'lectures', lectureId));
			deleteLecture(classId, lectureId);
		} catch (err) {
			console.error(err);
		} finally {
			leDeleteLecture = false;
		}
	}

	// Class editor state
	let ceSaving = $state(false);
	let ceDeleting = $state(false);
	let ceShowConfirm = $state(false);

	async function handleSaveClass(classId: string) {
		ceSaving = true;
		try {
			const cls = classes.find((c) => c.id === classId);
			if (!cls) return;
			await updateDoc(doc(db, 'classes', classId), {
				name: cls.name,
				code: cls.code,
			});
		} catch (err) {
			console.error(err);
		} finally {
			ceSaving = false;
		}
	}

	async function handleDeleteClass(classId: string) {
		ceDeleting = true;
		try {
			await deleteDoc(doc(db, 'classes', classId));
			deleteClass(classId);
		} catch (err) {
			console.error(err);
		} finally {
			ceDeleting = false;
			ceShowConfirm = false;
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
		if (!selection || !('lectureId' in selection)) return;
		const { classId, lectureId } = selection;
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
				}
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
				{ value: videoId }
			);
		} catch (err) {
			console.error(err);
		} finally {
			state.uploading = false;
		}
	}

	// File upload handler (Firebase Storage)
	async function handleFileUpload(matId: string, file: File) {
		if (!selection || !('lectureId' in selection)) return;
		const { classId, lectureId } = selection;
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
					(snapshot.bytesTransferred / snapshot.totalBytes) * 100
				);
			});
			await uploadTask;
			const downloadUrl = await getDownloadURL(storageRef);
			state.fileUrl = downloadUrl;
			updateMaterialLocal(matId, { value: downloadUrl });
			await updateDoc(
				doc(db, 'classes', classId, 'lectures', lectureId, 'materials', matId),
				{ value: downloadUrl }
			);
		} catch (err) {
			console.error(err);
		} finally {
			state.fileUploading = false;
		}
	}

	function getSelectedClass(sel: Selection, clss: ClassItem[]): ClassItem | null {
		if (!sel || sel.level === 'manage_students') return null;
		return clss.find((c) => c.id === sel.classId) ?? null;
	}
	function getSelectedLecture(sel: Selection, cls: ClassItem | null): Lecture | null {
		if (!sel || (sel.level !== 'lecture' && sel.level !== 'material')) return null;
		return cls?.lectures?.find((l) => l.id === sel.lectureId) ?? null;
	}
	function getHighlightMaterialId(sel: Selection): string | undefined {
		if (!sel || sel.level !== 'material') return undefined;
		return sel.materialId;
	}

	const selectedClass = $derived(getSelectedClass(selection, classes));
	const selectedLecture = $derived(getSelectedLecture(selection, selectedClass));
	const highlightMaterialId = $derived(getHighlightMaterialId(selection));

	function groupedLectures(lects: Lecture[]): [string, Lecture[]][] {
		const groups = new Map<string, Lecture[]>();
		for (const lec of lects) {
			const key = moment(lec.startTime).format('YYYY-MM-DD');
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(lec);
		}
		return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
	}

	const materialTypes: MaterialType[] = ['video', 'file', 'link', 'text', 'quiz'];
</script>

<DashboardLayout sidebarClass="w-[300px]">
	{#snippet headerLeft()}
		<button
			type="button"
			onclick={() => (selection = null)}
			class="shrink-0 text-sm font-semibold tracking-tight text-ink-900 hover:text-iris-600 transition-colors"
		>
			All Classes
		</button>
		{#if selectedClass}
			<ChevronRight size={14} class="hidden md:inline text-ink-900/20 shrink-0" />
			<button
				type="button"
				onclick={() => (selection = { level: 'class', classId: selectedClass.id })}
				class="hidden md:block truncate text-sm text-ink-900/60 hover:text-iris-600 transition-colors"
			>
				{selectedClass.name}
			</button>
		{/if}
		{#if selectedLecture}
			<ChevronRight size={14} class="hidden md:inline text-ink-900/20 shrink-0" />
			<span class="hidden md:block truncate text-sm font-medium text-ink-900">
				{selectedLecture.title}
			</span>
		{/if}
	{/snippet}

	{#snippet sidebarBottom()}
		<div class="flex-1 overflow-y-auto px-2 pt-3">
			<div class="border-t border-ink-900/8 mx-2 my-2"></div>
			<p class="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
				All classes
			</p>
			<TreeView
				{classes}
				{selection}
				{expanded}
				onToggle={toggleExpand}
				onSelect={loadLectureForClass}
			/>
			<div class="flex flex-col gap-1.5 pb-3">
				<button
					type="button"
					onclick={addClass}
					class="flex w-full items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-iris-600 transition hover:bg-iris-50"
				>
					<Plus class="h-3.5 w-3.5" />
					New class
				</button>
				<button
					type="button"
					onclick={manageStudents}
					class="flex w-full items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-teal-600 transition hover:bg-teal-50"
				>
					<UserRound class="h-3.5 w-3.5" />
					Manage Students
				</button>
			</div>
		</div>
		<div class="border-t border-ink-900/8 px-2 py-2">
			<button
				type="button"
				onclick={() => signOut(auth)}
				class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-500 transition hover:bg-red-50 hover:text-red-600"
			>
				<LogOut class="h-4 w-4" />
				Sign out
			</button>
		</div>
	{/snippet}

	{#if loading}
				<div class="flex h-full items-center justify-center">
					<div class="flex flex-col items-center gap-3">
						<div class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"></div>
						<span class="text-[13px] text-ink-500">Loading classes…</span>
					</div>
				</div>
			{:else if !selectedClass && !selection}
				<!-- Mobile class list -->
				<div class="block md:hidden overflow-y-auto px-6 py-5">
					<h2 class="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-ink-300">
						All Classes
					</h2>
					{#if classes.length === 0}
						<p class="px-2 text-sm text-ink-900/40">No classes yet.</p>
					{:else}
						<div class="space-y-2">
							{#each classes as cls}
								<button
									type="button"
									onclick={() => loadLectureForClass({ level: 'class', classId: cls.id })}
									class="flex w-full items-center gap-3 rounded-lg border border-ink-900/10 bg-white px-4 py-3 text-left shadow-soft transition hover:border-iris-400 hover:bg-iris-50"
								>
									<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-iris-50 text-iris-500">
										<Folder class="h-4 w-4" />
									</span>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium text-ink-900">{cls.name}</p>
										{#if cls.code}
											<p class="truncate text-xs text-ink-400">{cls.code}</p>
										{/if}
									</div>
									<ChevronRight class="h-4 w-4 shrink-0 text-ink-300" />
								</button>
							{/each}
							<button
								type="button"
								onclick={addClass}
								class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-900/15 px-4 py-3 text-sm font-medium text-iris-600 transition hover:border-iris-400 hover:bg-iris-50"
							>
								<Plus class="h-4 w-4" />
								New class
							</button>
						</div>
					{/if}
				</div>
				<!-- Desktop empty state -->
				<div class="hidden md:flex h-full items-center justify-center">
					<div class="flex h-full flex-col items-center justify-center px-8 text-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-iris-50 text-iris-500">
							<Folder class="h-6 w-6" />
						</div>
						<p class="mt-4 text-[15px] font-medium text-ink-900">
							{classes.length > 0 ? 'Nothing selected yet' : 'No classes yet'}
						</p>
						<p class="mt-1 max-w-xs text-[13.5px] text-ink-500">
							{classes.length > 0
								? 'Pick a class, lecture, or material from the tree to view and edit its details here.'
								: 'Create your first class to start building out lectures and materials.'}
						</p>
						{#if classes.length === 0}
							<button
								type="button"
								onclick={addClass}
								class="mt-5 flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-4 py-2 text-[13.5px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800"
							>
								<Plus class="h-3.5 w-3.5" />
								New class
							</button>
						{/if}
					</div>
				</div>
			{:else if !selectedClass && selection?.level === 'manage_students'}
				<div class="mx-auto max-w-full px-4 py-10">
					<div class="grid grid-row gap-3">
						<h1 class="text-lg font-semibold">Manage students</h1>
						<ManageStudents enableSelection={false} />
					</div>
				</div>
			{:else if selectedClass && selection?.level === 'class'}
				{#if lectureLoading}
					<div class="flex h-full items-center justify-center">
						<div class="flex flex-col items-center gap-3">
							<div class="h-8 w-8 animate-spin rounded-full border-4 border-ink-900/10 border-t-iris-600"></div>
							<span class="text-[13px] text-ink-500">Loading lectures…</span>
						</div>
					</div>
				{:else}
					<!-- ClassEditor -->
					<div class="mx-auto max-w-xl px-8 py-10">
						<div class="md:hidden flex items-center gap-1.5 mb-4">
							<button
								type="button"
								onclick={() => (selection = null)}
								class="text-[12px] text-ink-400 hover:text-iris-600 transition-colors"
							>
								All Classes
							</button>
							<ChevronRight class="h-3 w-3 text-ink-300" />
							<span class="text-[12px] font-medium text-ink-900">{selectedClass.name}</span>
						</div>
						<p class="text-[12px] font-medium uppercase tracking-wider text-ink-300">Class</p>
						<div class="mt-4 grid grid-cols-[1fr_auto] gap-3">
							<div>
								<label class={labelClass}>Class name</label>
								<input
									bind:value={selectedClass.name}
									oninput={(e) => {
										const target = e.target as HTMLInputElement;
										renameClass(selectedClass.id, { name: target.value });
									}}
									class={fieldClass}
									placeholder="e.g. Introduction to Algorithms"
								/>
							</div>
							<div class="w-28">
								<label class={labelClass}>Code</label>
								<input
									bind:value={selectedClass.code}
									oninput={(e) => {
										const target = e.target as HTMLInputElement;
										renameClass(selectedClass.id, { code: target.value });
									}}
									class={fieldClass}
									placeholder="CS 201"
								/>
							</div>
						</div>
						<button
							type="button"
							disabled={ceSaving}
							class="mt-4 flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
							onclick={() => handleSaveClass(selectedClass.id)}
						>
							{#if ceSaving}
								<div class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
								Saving…
							{:else}
								Save changes
							{/if}
						</button>

						<div class="mt-8 flex items-center justify-between border-t border-ink-900/10 pt-6">
							<div>
								<p class="text-[13.5px] font-medium text-ink-900">
									{selectedClass.students ? (selectedClass.students as unknown[]).length : 0} students enroled in this class
								</p>
								<p class="text-[12.5px] text-ink-500">Manage students enrolment.</p>
							</div>
							<button
								type="button"
								onclick={() =>
									(selection = { level: 'enrol_student', classId: selectedClass.id })
								}
								class="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800"
							>
								<Plus class="h-3.5 w-3.5" />
								Enrol students
							</button>
						</div>
						<div class="mt-8 flex items-center justify-between border-t border-ink-900/10 pt-6">
							<div>
								<p class="text-[13.5px] font-medium text-ink-900">
									{selectedClass.lectures?.length ?? 0} lecture
									{(selectedClass.lectures?.length ?? 0) === 1 ? '' : 's'}
								</p>
								<p class="text-[12.5px] text-ink-500">
									Add a lecture to start scheduling materials.
								</p>
							</div>
							<button
								type="button"
								onclick={() => addLecture(selectedClass.id)}
								class="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-iris-500 to-iris-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-button transition hover:from-iris-500 hover:to-iris-800"
							>
								<Plus class="h-3.5 w-3.5" />
								Add lecture
							</button>
						</div>
						<div class="mt-2 flex-row border-b border-ink-900/10 pt-6 pb-8 text-sm">
							{#if selectedClass.lectures}
								{#each groupedLectures(selectedClass.lectures) as [key, lecs]}
									<div class="mb-4">
										<p class="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-2">
											{moment(lecs[0].startTime).format('ddd, MMM D, YYYY')}
										</p>
										<div class="space-y-2">
											{#each lecs as lec}
												<button
													onclick={() =>
														loadLectureForClass({
															level: 'lecture',
															classId: selectedClass.id,
															lectureId: lec.id,
														})
													}
													class="w-full text-left rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
												>
													<div class="flex items-center justify-between gap-3">
														<p class="font-medium text-gray-900 truncate">
															{lec.title || 'Untitled lecture'}
														</p>
														<p class="shrink-0 text-sm text-gray-500">
															{formatTimeRange(lec.startTime, lec.endTime)}
														</p>
													</div>
												</button>
											{/each}
										</div>
									</div>
								{/each}
							{/if}
						</div>

						<button
							type="button"
							onclick={() => (ceShowConfirm = true)}
							class="mt-8 text-[13px] font-medium text-red-500 hover:text-red-600"
						>
							Delete this class
						</button>

						{#if ceShowConfirm}
							<div
								class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
								onclick={() => (ceShowConfirm = false)}
								role="none"
							>
								<div
									class="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
									onclick={(e) => e.stopPropagation()}
									role="none"
								>
									<p class="text-[15px] font-semibold text-ink-900">Delete class?</p>
									<p class="mt-2 text-[13px] text-ink-500">
										This will permanently delete "{selectedClass.name}" and all its lectures
										and materials. This action cannot be undone.
									</p>
									<div class="mt-5 flex items-center gap-2 justify-end">
										<button
											type="button"
											onclick={() => (ceShowConfirm = false)}
											class="rounded-lg px-3.5 py-2 text-[13px] font-medium text-ink-600 transition hover:bg-ink-900/5"
										>
											Cancel
										</button>
										<button
											type="button"
											disabled={ceDeleting}
											onclick={() => handleDeleteClass(selectedClass.id)}
											class="flex items-center gap-1.5 rounded-lg bg-red-500 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
										>
											{ceDeleting ? 'Deleting...' : 'Delete'}
										</button>
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			{:else if selectedClass && selection?.level === 'enrol_student'}
				<EnrolStudents classId={selectedClass.id} />
			{:else if selectedClass && selectedLecture && (selection?.level === 'lecture' || selection?.level === 'material')}
				<!-- LectureEditor -->
				<div class="mx-auto max-w-xl px-8 py-10">
					<div class="md:hidden flex items-center gap-1.5 mb-4">
						<button
							type="button"
							onclick={() => (selection = null)}
							class="text-[12px] text-ink-400 hover:text-iris-600 transition-colors"
						>
							All Classes
						</button>
						<ChevronRight class="h-3 w-3 text-ink-300" />
						<button
							type="button"
							onclick={() => (selection = { level: 'class', classId: selectedClass.id })}
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
						<button
							type="button"
							disabled={leSaving}
							class="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
							onclick={saveLectureChanges}
						>
							{#if leSaving}
								<div class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
								Saving…
							{:else}
								Save changes
							{/if}
						</button>
					</div>
					<div class="mt-4">
						<label class={labelClass}>Lecture title</label>
						<input
							bind:value={selectedLecture.title}
							oninput={(e) => {
								const target = e.target as HTMLInputElement;
								updateLecture(selectedClass.id, selectedLecture.id, { title: target.value });
							}}
							class={fieldClass}
							placeholder="e.g. Sorting Algorithms"
						/>
					</div>

					<div class="mt-4 grid grid-cols-2 gap-3">
						<div>
							<label class={labelClass}>Start time</label>
							<input
								type="datetime-local"
								value={dateToStringInput(selectedLecture.startTime)}
								oninput={(e) => {
									const target = e.target as HTMLInputElement;
									updateLecture(selectedClass.id, selectedLecture.id, {
										startTime: stringInputToDate(target.value),
									});
								}}
								class={fieldClass}
							/>
						</div>
						<div>
							<label class={labelClass}>End time</label>
							<input
								type="datetime-local"
								value={dateToStringInput(selectedLecture.endTime)}
								oninput={(e) => {
									const target = e.target as HTMLInputElement;
									updateLecture(selectedClass.id, selectedLecture.id, {
										endTime: stringInputToDate(target.value),
									});
								}}
								class={fieldClass}
							/>
						</div>
					</div>

					<div class="mt-9 border-t border-ink-900/10 pt-6">
						<p class="text-[13.5px] font-medium text-ink-900">
							Class materials
							<span class="ml-1.5 font-normal text-ink-300">({lectureMaterials.length})</span>
						</p>

						{#if materialsLoading}
							<div class="flex items-center justify-center gap-2 py-8">
								<div class="h-5 w-5 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"></div>
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
												<span class={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${color.bg} ${color.text}`}>
													<Icon class="h-3.5 w-3.5" />
												</span>

												<div class="min-w-0 flex-1 space-y-2">
													<input
														bind:value={mat.title}
														oninput={(e) => {
															const target = e.target as HTMLInputElement;
															updateMaterialLocal(mat.id, { title: target.value });
														}}
														placeholder="Material title"
														class="w-full rounded-md bg-white px-3 py-2 text-[13.5px] font-medium text-ink-900 placeholder:text-ink-300 outline-1 -outline-offset-1 outline-ink-900/15 focus:outline-2 focus:-outline-offset-2 focus:outline-iris-500 transition"
													/>

													{#if mat.type === 'youtube'}
														<div class="space-y-2">
															<input
																bind:value={mat.value}
																oninput={(e) => {
																	const target = e.target as HTMLInputElement;
																	updateMaterialLocal(mat.id, { value: target.value });
																}}
																placeholder="https://youtube.com/watch?v=..."
																class={`${fieldClass} !py-1.5 !text-[13px] ${
																	mat.value && !getYoutubeVideoId(mat.value)
																		? 'outline-red-400 focus:outline-red-500'
																		: ''
																}`}
															/>
															{#if mat.value && !getYoutubeVideoId(mat.value)}
																<p class="text-[12px] text-red-500">
																	Please enter a valid YouTube link
																</p>
															{/if}
															{#if getYoutubeVideoId(mat.value)}
																<div class="overflow-hidden rounded-lg border border-ink-900/8">
																	<div class="aspect-video">
												<iframe
													title="YouTube video"
													src={`https://www.youtube.com/embed/${getYoutubeVideoId(mat.value)}`}
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
														<input
															bind:value={mat.value}
															oninput={(e) => {
																const target = e.target as HTMLInputElement;
																updateMaterialLocal(mat.id, { value: target.value });
															}}
															placeholder="https://example.com/resource"
															class={`${fieldClass} !py-1.5 !text-[13px]`}
														/>
													{/if}

													{#if mat.type === 'text'}
														<textarea
															bind:value={mat.value}
															oninput={(e) => {
																const target = e.target as HTMLTextAreaElement;
																updateMaterialLocal(mat.id, { value: target.value });
															}}
															placeholder="Write the note or instructions here…"
															rows={3}
															class={`${fieldClass} resize-none !py-1.5 !text-[13px]`}
														></textarea>
													{/if}

													{#if mat.type === 'pdf' && pdfUrl}
														<div class="flex items-center gap-2 text-[12.5px] text-emerald-600">
															<svg
																viewBox="0 0 24 24"
																class="h-4 w-4"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
															>
																<path d="M20 6L9 17l-5-5" />
															</svg>
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
																	<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-900/15 bg-ink-900/[0.015] px-3 py-2 text-[12.5px] text-ink-500 hover:border-iris-400 hover:text-iris-600 transition-colors">
																		<svg
																			class="h-4 w-4 shrink-0"
																			viewBox="0 0 24 24"
																			fill="none"
																			stroke="currentColor"
																			stroke-width="1.8"
																		>
																			<path
																				d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
																				stroke-linecap="round"
																				stroke-linejoin="round"
																			/>
																			<polyline
																				points="14 2 14 8 20 8"
																				stroke-linecap="round"
																				stroke-linejoin="round"
																			/>
																			<line
																				x1="12"
																				y1="18"
																				x2="12"
																				y2="12"
																				stroke-linecap="round"
																				stroke-linejoin="round"
																			/>
																			<line
																				x1="9"
																				y1="15"
																				x2="12"
																				y2="12"
																				stroke-linecap="round"
																				stroke-linejoin="round"
																			/>
																			<line
																				x1="15"
																				y1="15"
																				x2="12"
																				y2="12"
																				stroke-linecap="round"
																				stroke-linejoin="round"
																			/>
																		</svg>
																		{fileUploading
																			? `Uploading ${fileProgress}%`
																			: 'Choose file'}
																		<input
																			type="file"
																			accept="image/*,.ppt,.pptx,.docx,.pdf"
																			class="hidden"
																			disabled={fileUploading}
																			onchange={(e) => {
																				const file = (e.target as HTMLInputElement)
																					.files?.[0];
																				if (file) handleFileUpload(mat.id, file);
																			}}
																		/>
																	</label>
																	{#if fileUploading}
																		<div class="flex-1 h-2 rounded-full bg-ink-900/10 overflow-hidden">
																			<div
																				class="h-full rounded-full bg-iris-500 transition-all duration-300"
																				style="width: {fileProgress}%"
																			></div>
																		</div>
																	{/if}
																</div>
															{:else}
																<div class="flex items-center gap-2 text-[12.5px] text-emerald-600">
																	<svg
																		viewBox="0 0 24 24"
																		class="h-4 w-4"
																		fill="none"
																		stroke="currentColor"
																		stroke-width="2"
																	>
																		<path d="M20 6L9 17l-5-5" />
																	</svg>
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
																			updateMaterialLocal(mat.id, { value: '' });
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
																<FileQuestion class="h-5 w-5 shrink-0 text-iris-500" />
																<span class="text-[13px] text-ink-700">
																	{mat.title || 'Untitled quiz'}
																</span>
																{#if mat.value}
																	<button
																		type="button"
																		onclick={() => {
																			window.open(
																				`/quiz/${mat.value}/edit`,
																				'_blank'
																			);
																		}}
																		class="ml-auto text-[12px] font-medium text-iris-600 underline hover:text-iris-700"
																	>
																		Edit quiz
																	</button>
																{/if}
															</div>
															<label class="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-600">
																<input
																	type="checkbox"
																	checked={requiredPostTest}
																	onchange={async (e) => {
																		const checked = (e.target as HTMLInputElement).checked;
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
																					mat.id
																				),
																				{ requiredPostTest: checked }
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
																		<div class="overflow-hidden rounded-lg border border-ink-900/8">
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
																		<div class="flex items-center gap-2 text-[12.5px] text-ink-500">
																			<div class="h-4 w-4 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"></div>
																			Loading video…
																		</div>
																	{/if}
																	<div class="flex items-center gap-2 text-[12.5px] text-emerald-600">
																		<svg
																			viewBox="0 0 24 24"
																			class="h-4 w-4"
																			fill="none"
																			stroke="currentColor"
																			stroke-width="2"
																		>
																			<path d="M20 6L9 17l-5-5" />
																		</svg>
																		Video uploaded
																		<button
																			type="button"
																			onclick={() => {
																				if (ms) {
																					ms.videoId = '';
																					ms.embedUrl = null;
																				}
																				updateMaterialLocal(mat.id, { value: '' });
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
																		<input
																			bind:value={mat.value}
																			oninput={(e) => {
																				const target = e.target as HTMLInputElement;
																				updateMaterialLocal(mat.id, {
																					value: target.value,
																				});
																			}}
																			placeholder="https://youtube.com/watch?v=..."
																			class={`${fieldClass} !py-1.5 !text-[13px] ${
																				mat.value &&
																				!getYoutubeVideoId(mat.value)
																					? 'outline-red-400 focus:outline-red-500'
																					: ''
																			}`}
																		/>
																		{#if mat.value && !getYoutubeVideoId(mat.value)}
																			<p class="text-[12px] text-red-500">
																				Please enter a valid YouTube link
																			</p>
																		{/if}
																		{#if getYoutubeVideoId(mat.value)}
																			<div class="overflow-hidden rounded-lg border border-ink-900/8">
																				<div class="aspect-video">
														<iframe
															title="YouTube video"
															src={`https://www.youtube.com/embed/${getYoutubeVideoId(mat.value)}`}
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
																		<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-900/15 bg-ink-900/[0.015] px-3 py-2 text-[12.5px] text-ink-500 hover:border-iris-400 hover:text-iris-600 transition-colors">
																			<svg
																				class="h-4 w-4 shrink-0"
																				viewBox="0 0 24 24"
																				fill="none"
																				stroke="currentColor"
																				stroke-width="1.8"
																			>
																				<path
																					d="M12 3v12m0 0-4-4m4 4 4-4M5 19h14"
																					stroke-linecap="round"
																					stroke-linejoin="round"
																				/>
																			</svg>
																			{uploading
																				? `Uploading ${progress}%`
																				: 'Choose video file'}
																			<input
																				type="file"
																				accept="video/*"
																				class="hidden"
																				disabled={uploading}
																				onchange={(e) => {
																					const file = (
																						e.target as HTMLInputElement
																					).files?.[0];
																					if (file)
																						handleVideoUpload(mat.id, file);
																				}}
																			/>
																		</label>
																		{#if uploading}
																			<div class="flex-1 h-2 rounded-full bg-ink-900/10 overflow-hidden">
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
														<div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-900/10 border-t-red-500"></div>
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
										<span class={`flex h-4 w-4 items-center justify-center rounded ${color.bg} ${color.text}`}>
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
											<div class="h-5 w-5 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"></div>
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
			{/if}
</DashboardLayout>
