<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
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
			goto(`${base}/#/dashboard`);
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

	const routeId = $derived(page.route.id ?? '');
	const quizId = $derived(page.params.id ?? null);
	const currentQuiz = $derived(quizId ? allQuizzes.find((q) => q.id === quizId) : null);

	const breadcrumbs = $derived.by(() => {
		const crumbs: { label: string; href: string | null }[] = [];

		if (routeId === '/quiz') {
			crumbs.push({ label: t('nav.quizzes'), href: null });
		} else {
			crumbs.push({ label: t('nav.quizzes'), href: '/quiz' });

			if (routeId === '/quiz/new') {
				crumbs.push({ label: t('quiz.newQuiz'), href: null });
			} else if (currentQuiz) {
				crumbs.push({
					label: currentQuiz.title || t('common.untitledQuiz'),
					href: routeId === '/quiz/[id]' ? null : `/quiz/${quizId}`,
				});
				if (routeId === '/quiz/[id]/edit') {
					crumbs.push({ label: t('quiz.edit'), href: null });
				} else if (routeId === '/quiz/[id]/take') {
					crumbs.push({ label: t('quiz.takeQuiz'), href: null });
				} else if (routeId === '/quiz/[id]/preview') {
					crumbs.push({ label: t('quiz.preview'), href: null });
				} else if (routeId.startsWith('/quiz/[id]/results')) {
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
