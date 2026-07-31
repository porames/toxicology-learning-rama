import type { MaterialType, Lecture } from './types';
import moment from 'moment';

export function makeId() {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultMaterialTitle(type: MaterialType) {
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

export function defaultTimes() {
	const start = new Date();
	start.setMinutes(0, 0, 0);
	start.setHours(start.getHours() + 1);
	const end = new Date(start.getTime() + 90 * 60 * 1000);
	return { startTime: start, endTime: end };
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
