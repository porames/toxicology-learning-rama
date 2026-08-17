import type { MaterialType, Lecture, TemplateTime } from './types';
import { t } from '$lib/i18n';
import moment from 'moment';

export function makeId() {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultMaterialTitle(type: MaterialType) {
	switch (type) {
		case 'youtube':
			return t('materials.newVideo');
		case 'file':
			return t('materials.newFile');
		case 'link':
			return t('materials.newLink');
		case 'text':
			return t('materials.newNote');
		case 'video':
			return t('materials.newVideo');
		case 'quiz':
			return t('materials.newQuiz');
	}
}

export function getYoutubeVideoId(url: string): string | null {
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

export function dateToStringInput(date: Date) {
	const offset = date.getTimezoneOffset();
	const localDate = new Date(date.getTime() - offset * 60 * 1000);
	return localDate.toISOString().slice(0, 16);
}

export function stringInputToDate(strDate: string) {
	return new Date(strDate);
}

export function validateDateTimeInput(value: string): string | null {
	if (!value) return t('utils.requiredField');
	const date = new Date(value);
	if (isNaN(date.getTime())) return t('utils.invalidDate');
	const year = date.getFullYear();
	if (year > 2050) return t('utils.buddhistYearNote');
	return null;
}

export function defaultTimes() {
	const start = new Date();
	start.setMinutes(0, 0, 0);
	start.setHours(start.getHours() + 1);
	const end = new Date(start.getTime() + 90 * 60 * 1000);
	return { startTime: start, endTime: end };
}

export function timeOfDay(date: Date): Date {
	const d = new Date(date);
	return new Date(1970, 0, 1, d.getHours(), d.getMinutes(), d.getSeconds(), 0);
}

export function templateTimeToMs(t: TemplateTime): number {
	return (
		((t.week - 1) * 7 + (t.day - 1)) * 86400000 +
		t.time.getHours() * 3600000 +
		t.time.getMinutes() * 60000
	);
}

export function groupedLectures(lects: Lecture[]): [string, Lecture[]][] {
	const groups = new Map<string, Lecture[]>();
	for (const lec of lects) {
		const key = moment(lec.startTime).format('YYYY-MM-DD');
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(lec);
	}
	return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function fmtDate(d?: { toDate?: () => Date } | Date | null): string {
	if (!d) return '—';
	const date =
		typeof d === 'object' && 'toDate' in d && typeof d.toDate === 'function'
			? d.toDate()
			: (d as Date);
	return moment(date).format('ddd, MMM D, YYYY · hh:mm A');
}
