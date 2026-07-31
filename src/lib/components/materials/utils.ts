import { Video, FileText, Link as LinkIcon, MessageCircleWarning, FileQuestion, File } from '@lucide/svelte';
import type { Component } from 'svelte';

export function materialTypeLabel(type: string): string {
	switch (type) {
		case 'video': return 'Video';
		case 'youtube': return 'YouTube';
		case 'link': return 'Link';
		case 'pdf': return 'PDF';
		case 'text': return 'Note';
		case 'quiz': return 'Quiz';
		default: return 'File';
	}
}

export function getFileNameFromUrl(url: string): string {
	try {
		const pathname = new URL(url).pathname;
		const segments = pathname.split('/');
		const last = segments[segments.length - 1] || url;
		return decodeURIComponent(last);
	} catch {
		return url;
	}
}

export function materialIcon(type: string) {
	switch (type) {
		case 'video':
		case 'youtube':
			return Video;
		case 'link':
			return LinkIcon;
		case 'pdf':
			return FileText;
		case 'text':
			return MessageCircleWarning;
		case 'quiz':
			return FileQuestion;
		default:
			return File;
	}
}
