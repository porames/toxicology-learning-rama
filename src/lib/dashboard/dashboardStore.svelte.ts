import { db } from '$lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ClassItem, Lecture, Material } from '$lib/dashboard/types';
import * as Utils from '$lib/dashboard/utils';

function createDashboardStore() {
	let classes: ClassItem[] = $state([]);
	let loading = $state(true);
	let expanded = $state(new Set<string>());

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
		} catch (err) {
			console.log(err);
		} finally {
			loading = false;
		}
	}

	function expandIds(ids: string[]) {
		const missing = ids.filter((id) => !expanded.has(id));
		if (missing.length === 0) return;
		const next = new Set(expanded);
		missing.forEach((id) => next.add(id));
		expanded = next;
	}

	function toggleExpand(classId: string, isCurrentlyExpanded: boolean) {
		const next = new Set(expanded);
		if (isCurrentlyExpanded) {
			next.delete(classId);
		} else {
			next.add(classId);
		}
		expanded = next;
	}

	async function loadLecturesForClass(classId: string) {
		const current = classes.find((c) => c.id === classId);
		if (!current || current.lectures !== undefined) return;
		try {
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
				cls.id === classId ? { ...cls, lectures: loadedLecs } : cls,
			);
		} catch (err) {
			console.log(err);
		}
	}

	async function addClass(): Promise<string> {
		const snapshot = await addDoc(collection(db, 'classes'), {
			name: 'New class',
			code: '',
			createdAt: serverTimestamp(),
		});
		classes = [...classes, { id: snapshot.id, name: 'New class', code: '', lectures: [] }];
		expandIds([snapshot.id]);
		return snapshot.id;
	}

	function renameClass(classId: string, patch: Partial<Pick<ClassItem, 'name' | 'code'>>) {
		classes = classes.map((c) => (c.id === classId ? { ...c, ...patch } : c));
	}

	function deleteClass(classId: string) {
		classes = classes.filter((c) => c.id !== classId);
	}

	async function addLecture(classId: string): Promise<string> {
		const { startTime, endTime } = Utils.defaultTimes();
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
			c.id === classId ? { ...c, lectures: [...(c.lectures ?? []), newLecture] } : c,
		);
		expandIds([classId, snapshot.id]);
		return snapshot.id;
	}

	function insertLecture(classId: string, lecture: Lecture) {
		classes = classes.map((c) =>
			c.id === classId ? { ...c, lectures: [...(c.lectures ?? []), lecture] } : c,
		);
	}

	function updateLecture(
		classId: string,
		lectureId: string,
		patch: Partial<Pick<Lecture, 'title' | 'startTime' | 'endTime'>>,
	) {
		classes = classes.map((c) =>
			c.id !== classId
				? c
				: {
						...c,
						lectures: (c.lectures ?? []).map((l) =>
							l.id === lectureId ? { ...l, ...patch } : l,
						),
					},
		);
	}

	function deleteLecture(classId: string, lectureId: string) {
		classes = classes.map((c) =>
			c.id !== classId
				? c
				: { ...c, lectures: (c.lectures ?? []).filter((l) => l.id !== lectureId) },
		);
	}

	function getClass(classId: string): ClassItem | null {
		return classes.find((c) => c.id === classId) ?? null;
	}

	function getLecture(classId: string, lectureId: string): Lecture | null {
		return getClass(classId)?.lectures?.find((l) => l.id === lectureId) ?? null;
	}

	return {
		get classes() {
			return classes;
		},
		get loading() {
			return loading;
		},
		get expanded() {
			return expanded;
		},
		loadClasses,
		loadLecturesForClass,
		toggleExpand,
		expandIds,
		addClass,
		renameClass,
		deleteClass,
		addLecture,
		insertLecture,
		updateLecture,
		deleteLecture,
		getClass,
		getLecture,
	};
}

export const dashboardStore = createDashboardStore();
