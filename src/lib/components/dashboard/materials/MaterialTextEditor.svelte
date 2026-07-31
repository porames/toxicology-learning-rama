<script lang="ts">
	import { Textarea } from '$lib/components/ui';
	import type { Material } from '$lib/dashboard/types';

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
	placeholder="Write the note or instructions here…"
	rows={3}
/>
