const PROJECT_ID = 'rama-toxico-edu';
const REGION = 'us-central1';

export const FUNCTIONS_BASE_URL: string =
	import.meta.env.VITE_FUNCTIONS_URL ??
	(import.meta.env.DEV
		? `http://localhost:5001/${PROJECT_ID}/${REGION}`
		: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`);

export function functionsUrl(name: string): string {
	return `${FUNCTIONS_BASE_URL}/${name}`;
}
