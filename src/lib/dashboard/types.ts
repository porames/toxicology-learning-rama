export type MaterialType = "youtube" | "pdf" | "link" | "text" | "file" | "video" | "quiz";

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
	students?: [];
}

export type Selection =
	| { level: "class"; classId: string }
	| { level: "manage_students" }
	| { level: "enrol_student"; classId: string }
	| { level: "lecture"; classId: string; lectureId: string }
	| { level: "material"; classId: string; lectureId: string; materialId: string }
	| null;

export interface Activity {
	id: string;
	classId: string;
	lectureId: string;
	checkedInAt: { toDate: () => Date } | null;
	completedAt: { toDate: () => Date } | null;
}

export interface Student {
	id: string;
	rama_id: string;
	name: string;
	email: string;
	role?: string;
	year: string;
}

export interface RequiredAttachment {
	id: string;
	instruction: string;
}

export interface Assignment {
	id: string;
	instructions: string;
	dueDate: { toDate: () => Date };
	opensAt: { toDate: () => Date };
	requiredAttachments: RequiredAttachment[];
	assignedStudentIds: string[];
	createdAt: { toDate: () => Date } | null;
}

export interface SubmissionAttachment {
	name: string;
	refId: string;
	uploadedAt: { toDate: () => Date } | null;
}

export interface AssignmentSubmission {
	id: string;
	studentUserId: string;
	submittedAt: { toDate: () => Date } | null;
	updatedAt: { toDate: () => Date } | null;
	attachments: SubmissionAttachment[];
}

export const MATERIAL_LABELS: Record<MaterialType, string> = {
	youtube: "YouTube video",
	pdf: "PDF file",
	link: "Link",
	text: "Note",
	file: "Attached file",
	video: "Video",
	quiz: "Quiz"
};
