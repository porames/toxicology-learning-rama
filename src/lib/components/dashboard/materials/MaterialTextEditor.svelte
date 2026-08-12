<script lang="ts">
	import { Textarea } from '$lib/components/ui';
	import type { Material } from '$lib/dashboard/types';
	import { t } from '$lib/i18n';

	let {
		material,
		onValueChange,
	}: {
		material: Material;
		onValueChange: (value: string) => void;
	} = $props();
</script>

<Textarea
	value={material.value}
	oninput={(e) => {
		const target = e.target as HTMLTextAreaElement;
		onValueChange(target.value);
	}}
	placeholder={t('common.noContent')}
	rows={3}
/>
