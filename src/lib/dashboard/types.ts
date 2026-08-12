export type MaterialType = 'youtube' | 'pdf' | 'link' | 'text' | 'file' | 'video' | 'quiz';

import { t } from '$lib/i18n';

export interface Material {
	id: string;
	type: MaterialType;
	title: string;
	value: string;
	requiredPostTest?: boolean;
}

export interface Lecture {
	id: string;
	title: string;
	startTime: Date;
	endTime: Date;
	materials: Material[];
	materialsOrder?: string[];
}

export interface ClassItem {
	id: string;
	name: string;
	code: string;
	lectures?: Lecture[];
	students?: string[];
	classStart?: Date | null;
	classEnd?: Date | null;
}

export type Selection =
	| { level: 'class'; classId: string }
	| { level: 'manage_students' }
	| { level: 'enrol_student'; classId: string }
	| { level: 'lecture'; classId: string; lectureId: string }
	| { level: 'material'; classId: string; lectureId: string; materialId: string }
	| null;

export interface Activity {
	id: string;
	classId: string;
	lectureId: string;
	checkedInAt: { toDate: () => Date } | null;
	completedAt: { toDate: () => Date } | null;
}

export interface Student {
	email: string;
	name: string;
	role: string;
	phone: string;
	lineId?: string;
	electiveStart: Date;
	electiveEnd: Date;
	rama_id?: string;
	year?: string;
	enroledClasses?: string[];
	id: string; // authId
}

export interface RequiredAttachment {
	id: string;
	instruction: string;
}

export interface Assignment {
	id: string;
	title: string;
	instructions: string;
	dueDate: { toDate: () => Date };
	opensAt: { toDate: () => Date };
	requiredAttachments: RequiredAttachment[];
	assignedStudentIds: string[];
	createdAt: { toDate: () => Date } | null;
}

export interface SubmissionAttachment {
	name: string;
	filePath: string;
	attachmentId: string;
	uploadedAt: { toDate: () => Date } | null;
}

export interface AssignmentSubmission {
	id: string;
	studentUserId: string;
	submittedAt: { toDate: () => Date } | null;
	updatedAt: { toDate: () => Date } | null;
	attachments: SubmissionAttachment[];
	requirementsMet?: boolean;
	missingAttachmentIds?: string[];
}

export interface TemplateTime {
	week: number;
	day: number;
	time: Date;
}

export interface TemplateLecture {
	id: string;
	title: string;
	startTime: TemplateTime;
	endTime: TemplateTime;
	materials: Material[];
	materialsOrder?: string[];
}

export interface CourseTemplate {
	id: string;
	name: string;
	code?: string;
	description?: string;
	lectures?: TemplateLecture[];
	createdAt?: { toDate: () => Date } | null;
}

export interface ScheduleEvent {
	id: string;
	date: Date;
	startTime: Date;
	endTime: Date;
	title?: string;
	lectureTemplateId?: string;
	color?: string;
}

export function getMaterialLabel(type: MaterialType): string {
	switch (type) {
		case 'youtube':
			return t('materials.youtubeVideo');
		case 'pdf':
			return t('materials.pdfFile');
		case 'link':
			return t('materials.link');
		case 'text':
			return t('materials.note');
		case 'file':
			return t('materials.attachedFile');
		case 'video':
			return t('materials.video');
		case 'quiz':
			return t('materials.quiz');
	}
}
