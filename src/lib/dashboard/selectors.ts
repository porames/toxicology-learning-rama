import type { ClassItem, Lecture, Selection } from './types';

export function getSelectedClass(sel: Selection, clss: ClassItem[]): ClassItem | null {
	if (!sel || sel.level === 'manage_students') return null;
	return clss.find((c) => c.id === sel.classId) ?? null;
}

export function getSelectedLecture(sel: Selection, cls: ClassItem | null): Lecture | null {
	if (!sel || (sel.level !== 'lecture' && sel.level !== 'material')) return null;
	return cls?.lectures?.find((l) => l.id === sel.lectureId) ?? null;
}

export function getHighlightMaterialId(sel: Selection): string | undefined {
	if (!sel || sel.level !== 'material') return undefined;
	return sel.materialId;
}
