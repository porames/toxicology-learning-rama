import { t } from './index';

const API_ERROR_KEYS: Record<string, () => string> = {
	'Missing email': () => t('api.missingEmail'),
	'No account registered for this email.': () => t('api.noAccount'),
	'This account is already activated.': () => t('api.alreadyActivated'),
	'Internal server error': () => t('api.internalServerError'),
	'Missing data points': () => t('api.missingData'),
	'Something went wrong': () => t('api.somethingWentWrong'),
	'Missing or empty students array': () => t('api.missingStudents'),
	'Invalid image data. Must be a base64-encoded data URL.': () => t('api.invalidImage'),
	'Missing required fields: imageData, caseId, investigationId': () =>
		t('api.missingImageFields'),
	'No approved user found': () => t('api.noApprovedUser'),
	'Submission not found': () => t('api.submissionNotFound'),
	Unauthorized: () => t('api.unauthorized'),
	'electiveStart and electiveEnd must be valid dates': () => t('api.invalidDates'),
	'videoId is required': () => t('api.videoIdRequired'),
};

export function translateApiError(message: string | null | undefined): string {
	if (!message) return t('api.somethingWentWrong');
	const key = API_ERROR_KEYS[message];
	if (key) return key();

	const emailInUse = message.match(/Email "([^"]+)" is already in use\./);
	if (emailInUse) return t('api.emailAlreadyInUse', { email: emailInUse[1] });

	const templateNotFound = message.match(/Template not found: (.+)/);
	if (templateNotFound) return t('api.templateNotFound', { value: templateNotFound[1] });

	const alreadyInUse = message.match(/^(.+) is already in use\.$/);
	if (alreadyInUse) return t('api.alreadyInUse', { value: alreadyInUse[1] });

	const mustBeOneOf = message.match(/Must be one of (.+)/);
	if (mustBeOneOf) return `${t('api.missingFields', { name: message, missing: mustBeOneOf[1] })}`;

	return message;
}
