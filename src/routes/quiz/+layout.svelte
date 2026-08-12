<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { collection, getDocs } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import { authState } from '$lib/auth.svelte';
	import DashboardLayout from '$lib/components/DashboardLayout.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import type { Quiz } from '$lib/quiz-types';
	import type { Snippet } from 'svelte';
	import { t } from '$lib/i18n';

	let { children }: { children: Snippet } = $props();
	const isAdmin = $derived(
		authState.profile?.role === 'admin' || authState.profile?.role === 'teacher',
	);

	let allQuizzes = $state<Quiz[]>([]);
	let loaded = $state(false);

	$effect(() => {
		if (!isAdmin) {
			goto('/dashboard');
			return;
		}
		async function load() {
			try {
				const snapshot = await getDocs(collection(db, 'quizzes'));
				allQuizzes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Quiz);
			} catch (err) {
				console.error(err);
			} finally {
				loaded = true;
			}
		}
		load();
	});

	const segments = $derived(page.url.pathname.split('/').filter(Boolean));
	const quizId = $derived(segments[1] && segments[1] !== 'new' ? segments[1] : null);
	const currentQuiz = $derived(quizId ? allQuizzes.find((q) => q.id === quizId) : null);

	const breadcrumbs = $derived.by(() => {
		const crumbs: { label: string; href: string | null }[] = [];

		if (segments.length === 1) {
			crumbs.push({ label: t('nav.quizzes'), href: null });
		} else {
			crumbs.push({ label: t('nav.quizzes'), href: '/quiz' });

			if (segments[1] === 'new') {
				crumbs.push({ label: t('quiz.newQuiz'), href: null });
			} else if (currentQuiz) {
				crumbs.push({
					label: currentQuiz.title || t('common.untitledQuiz'),
					href: segments.length > 2 ? `/quiz/${quizId}` : null,
				});
				if (segments[2] === 'edit') {
					crumbs.push({ label: t('quiz.edit'), href: null });
				} else if (segments[2] === 'take') {
					crumbs.push({ label: t('quiz.takeQuiz'), href: null });
				} else if (segments[2] === 'preview') {
					crumbs.push({ label: t('quiz.preview'), href: null });
				} else if (segments[2] === 'results') {
					crumbs.push({ label: t('quiz.results'), href: null });
				}
			}
		}

		return crumbs;
	});
</script>

{#if !isAdmin || !loaded}
	<div class="flex h-screen items-center justify-center">
		<div
			class="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-iris-600"
		></div>
	</div>
{:else}
	<DashboardLayout>
		{#snippet headerLeft()}
			<Breadcrumbs
				crumbs={breadcrumbs.map((crumb) =>
					crumb.href
						? { label: crumb.label, href: crumb.href }
						: { label: crumb.label, active: true },
				)}
			/>
		{/snippet}
		{@render children()}
	</DashboardLayout>
{/if}
