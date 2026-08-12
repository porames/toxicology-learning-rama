<script lang="ts">
	import { Languages } from '@lucide/svelte';
	import { i18n } from '$lib/i18n';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<button
	type="button"
	onclick={() => i18n.toggle()}
	title={i18n.locale === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
	class={`inline-flex items-center gap-1.5 rounded-lg border border-ink-900/10 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-700 shadow-soft transition hover:border-iris-400 hover:text-iris-600 ${className}`}
>
	<Languages class="h-4 w-4" />
	{i18n.locale === 'th' ? 'EN' : 'ไทย'}
</button>
