import { i18n } from '$lib/i18n';

export default function formatTimeRange(start: Date, end: Date) {
	try {
		const locale = i18n.locale === 'th' ? 'th-TH' : 'en-US';
		const fmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
		return `${fmt.format(start)} – ${fmt.format(end)}`;
	} catch {
		return i18n.t('utils.timeNotSet');
	}
}
