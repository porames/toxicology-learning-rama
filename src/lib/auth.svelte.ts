import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '$lib/firebase';
import { goto } from '$app/navigation';
import { base } from '$app/paths';

export interface UserProfile {
	name: string;
	email: string;
	role: string;
	photoURL: string | null;
	year: string;
	uid: string;
	docId: string;
}

function createAuthState() {
	let user = $state<User | null>(null);
	let profile = $state<UserProfile | null>(null);
	let loading = $state(true);
	let wasSignedIn = false;

	async function loadProfile(currentUser: User) {
		user = currentUser;
		try {
			await currentUser.getIdToken(true);
			const q = query(collection(db, 'users'), where('authId', '==', currentUser.uid));
			const snap = await getDocs(q);
			if (!snap.empty) {
				const userDoc = snap.docs[0];
				const data = userDoc.data();
				profile = {
					name: data.name ?? currentUser.displayName ?? 'User',
					email: data.email ?? currentUser.email ?? '',
					photoURL: currentUser.photoURL,
					role: data.role ?? 'student',
					year: data.year ?? '',
					uid: currentUser.uid,
					docId: userDoc.id,
				};
			} else {
				profile = null;
			}
		} catch (err) {
			console.error(err);
		}
	}

	onAuthStateChanged(auth, async (currentUser) => {
		if (!currentUser) {
			const redirectToLogin = wasSignedIn;
			user = null;
			profile = null;
			loading = false;
			wasSignedIn = false;
			if (redirectToLogin) {
				goto(`${base}/`);
			}
			return;
		}
		wasSignedIn = true;
		try {
			await loadProfile(currentUser);
		} finally {
			loading = false;
		}
	});

	async function refreshProfile() {
		if (!user) return;
		loading = true;
		try {
			await loadProfile(user);
		} finally {
			loading = false;
		}
	}

	return {
		get user() {
			return user;
		},
		get profile() {
			return profile;
		},
		get loading() {
			return loading;
		},
		refreshProfile,
	};
}

export const authState = createAuthState();
