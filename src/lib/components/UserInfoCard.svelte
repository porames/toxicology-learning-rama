<script lang="ts">
	import { UserRound } from '@lucide/svelte';
	import { t } from '$lib/i18n';

	interface Props {
		name: string;
		email: string;
		photoURL?: string | null;
		year?: string;
		role?: string;
		class?: string;
	}

	let { name, email, photoURL, year, role, class: className = '' }: Props = $props();

	const isAdmin = $derived(role === 'admin' || role === 'teacher');
</script>

<div class="flex items-center gap-3 px-2 pb-4 mb-2 border-b border-ink-900/8 {className}">
	{#if photoURL}
		<img src={photoURL} alt="" class="h-10 w-10 shrink-0 rounded-full object-cover" />
	{:else}
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-iris-600 text-sm font-semibold text-white"
		>
			{#if name}
				{name.charAt(0).toUpperCase()}
			{:else}
				<UserRound class="h-5 w-5" />
			{/if}
		</div>
	{/if}
	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<p class="truncate text-sm font-medium text-ink-900">{name}</p>
			{#if role}
				<span
					class={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
						isAdmin
							? 'bg-iris-500/10 text-iris-600'
							: 'bg-emerald-500/10 text-emerald-600'
					}`}
				>
					{role}
				</span>
			{/if}
		</div>
		<p class="truncate text-xs text-ink-900/50">{email}</p>
		{#if year}
			<p class="text-xs text-ink-900/40">{t('common.yearLabel', { year })}</p>
		{/if}
	</div>
</div>
