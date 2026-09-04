import { Video, Link as LinkIcon, MessageCircleWarning, FileQuestion, File } from '@lucide/svelte';
import type { Component } from 'svelte';
import { t } from '$lib/i18n';
import GoogleMeetIcon from '$lib/components/GoogleMeetIcon.svelte';

export function materialTypeLabel(type: string): string {
	switch (type) {
		case 'video':
			return t('materials.video');
		case 'youtube':
			return t('materials.youtube');
		case 'link':
			return t('materials.link');
		case 'text':
			return t('materials.note');
		case 'quiz':
			return t('materials.quiz');
		case 'meet':
			return t('materials.googleMeet');
		default:
			return t('materials.file');
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
		case 'text':
			return MessageCircleWarning;
		case 'quiz':
			return FileQuestion;
		case 'meet':
			return GoogleMeetIcon;
		default:
			return File;
	}
}
