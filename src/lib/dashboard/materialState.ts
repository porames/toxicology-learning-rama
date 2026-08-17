import type { Material } from './types';

export interface MaterialState {
	videoMode: 'youtube' | 'upload';
	uploading: boolean;
	progress: number;
	videoId: string;
	embedUrl: string | null;
	deleting: boolean;
	requiredPostTest: boolean;
	fileUploading: boolean;
	fileProgress: number;
	fileUrl: string;
}

export function initMaterialState(mat: Material): MaterialState {
	return {
		videoMode: 'youtube',
		uploading: false,
		progress: 0,
		videoId: mat.type === 'video' ? mat.value || '' : '',
		embedUrl: null,
		deleting: false,
		requiredPostTest: mat.requiredPostTest ?? false,
		fileUploading: false,
		fileProgress: 0,
		fileUrl: mat.type === 'file' ? mat.value || '' : '',
	};
}
