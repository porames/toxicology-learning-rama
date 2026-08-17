<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { authState } from '$lib/auth.svelte';
	import ActivateAccount from '$lib/components/ActivateAccount.svelte';
	import MeshPanel from '$lib/components/MeshPanel.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';

	$effect(() => {
		if (authState.profile) {
			goto(`${base}/#/classes`, { replaceState: true });
		}
	});
</script>

<svelte:head>
	<title>RAMA Toxico | Activate Account</title>
</svelte:head>

{#if !authState.profile}
	<main class="flex min-h-screen bg-canvas">
		<MeshPanel />

		<div class="relative flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10">
			<div class="absolute right-6 top-6">
				<LanguageSwitcher />
			</div>
			<div class="mb-10 flex items-center gap-2.5 lg:hidden">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-iris-600 shadow-lg"
				>
					<svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none">
						<path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" fill="white" />
					</svg>
				</div>
				<span class="text-[15px] font-semibold tracking-tight text-ink-900"
					>RAMA Toxico</span
				>
			</div>

			<ActivateAccount />
		</div>
	</main>
{/if}
