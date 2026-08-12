import { t } from '$lib/i18n';

export function getAuthErrorMessage(code: string): string {
	switch (code) {
		case 'auth/invalid-email':
			return t('auth.invalidEmail');
		case 'auth/user-disabled':
			return t('auth.userDisabled');
		case 'auth/user-not-found':
		case 'auth/wrong-password':
		case 'auth/invalid-credential':
			return t('auth.invalidCredential');
		case 'auth/email-already-in-use':
			return t('auth.emailAlreadyInUse');
		case 'auth/weak-password':
			return t('auth.weakPassword');
		case 'auth/too-many-requests':
			return t('auth.tooManyRequests');
		case 'auth/popup-closed-by-user':
			return t('auth.popupClosedByUser');
		case 'auth/network-request-failed':
			return t('auth.networkRequestFailed');
		default:
			return t('common.somethingWentWrong');
	}
}
