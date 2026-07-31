<script lang="ts">
	import { Input } from '$lib/components/ui';
	import type { Material } from '$lib/dashboard/types';

	let {
		material,
		onValueChange,
	}: {
		material: Material;
		onValueChange: (value: string) => void;
	} = $props();
</script>

<Input
	value={material.value}
	oninput={(e) => {
		const target = e.target as HTMLInputElement;
		onValueChange(target.value);
	}}
	placeholder="https://example.com/resource"
/>
