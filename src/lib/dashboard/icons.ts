import type { MaterialType } from './types';
import type { Component } from 'svelte';
import { Video, FileText, Link as LinkIcon, MessageCircleWarning, FileQuestion, File } from '@lucide/svelte';

const ICON_MAP: Record<MaterialType, Component> = {
	youtube: Video,
	pdf: FileText,
	link: LinkIcon,
	text: MessageCircleWarning,
	file: File,
	video: Video,
	quiz: FileQuestion
};

export const MATERIAL_ICON = ICON_MAP;

export const MATERIAL_COLOR: Record<MaterialType, { text: string; bg: string; ring: string }> = {
	youtube: { text: "text-mesh-pink", bg: "bg-mesh-pink/10", ring: "ring-mesh-pink/25" },
	pdf: { text: "text-mesh-amber", bg: "bg-mesh-amber/10", ring: "ring-mesh-amber/25" },
	link: { text: "text-mesh-blue", bg: "bg-mesh-blue/10", ring: "ring-mesh-blue/25" },
	text: { text: "text-mesh-teal", bg: "bg-mesh-teal/10", ring: "ring-mesh-teal/25" },
	file: { text: "text-mesh-amber", bg: "bg-mesh-amber/10", ring: "ring-mesh-amber/25" },
	video: { text: "text-rose-500", bg: "bg-rose-500/10", ring: "ring-rose-500/25" },
	quiz: { text: "text-iris-600", bg: "bg-iris-500/10", ring: "ring-iris-500/25" },
};
