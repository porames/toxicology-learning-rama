// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
interface ImportMetaEnv {
	/** Override the Cloud Functions base URL (e.g. a custom emulator port). */
	VITE_FUNCTIONS_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
