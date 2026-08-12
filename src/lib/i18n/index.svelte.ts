import { en, type MessageKeys } from './messages/en';
import th from './messages/th';

export type { MessageKeys };
export type Locale = 'en' | 'th';

const STORAGE_KEY = 'app-locale';

function detectInitialLocale(): Locale {
	if (typeof localStorage !== 'undefined') {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'en' || stored === 'th') return stored;
	}
	if (typeof navigator !== 'undefined') {
		const lang = navigator.language ?? '';
		if (lang.toLowerCase().startsWith('th')) return 'th';
	}
	return 'en';
}

const messages: Record<Locale, Record<string, Record<string, string>>> = {
	en: en as unknown as Record<string, Record<string, string>>,
	th: th as unknown as Record<string, Record<string, string>>,
};

function getMessage(path: MessageKeys, locale: Locale): string {
	const [section, key] = path.split('.') as [string, string];
	return messages[locale]?.[section]?.[key] ?? messages.en?.[section]?.[key] ?? path;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		params[key] !== undefined ? String(params[key]) : match,
	);
}

function applyLocale(locale: Locale) {
	try {
		localStorage.setItem(STORAGE_KEY, locale);
	} catch {
		// storage unavailable
	}
	if (typeof document !== 'undefined') {
		document.documentElement.lang = locale === 'th' ? 'th' : 'en';
	}

	import('moment').then(({ default: moment }) => {
		if (locale === 'th') {
			import('moment/locale/th').then(() => moment.locale('th'));
		} else {
			moment.locale('en');
		}
	});
}

function createI18n() {
	let locale = $state<Locale>(detectInitialLocale());

	applyLocale(locale);

	function t(path: MessageKeys, params?: Record<string, string | number>): string {
		return interpolate(getMessage(path, locale), params);
	}

	function tn(
		count: number,
		singular: MessageKeys,
		plural: MessageKeys,
		params?: Record<string, string | number>,
	): string {
		return interpolate(getMessage(count === 1 ? singular : plural, locale), {
			count,
			...params,
		});
	}

	function setLocale(next: Locale) {
		locale = next;
		applyLocale(next);
	}

	function toggle() {
		const next = locale === 'th' ? 'en' : 'th';
		setLocale(next);
	}

	return {
		get locale() {
			return locale;
		},
		t,
		tn,
		setLocale,
		toggle,
	};
}

export const i18n = createI18n();
export const t = i18n.t;
export const tn = i18n.tn;
export const setLocale = i18n.setLocale;
export const toggleLocale = i18n.toggle;
