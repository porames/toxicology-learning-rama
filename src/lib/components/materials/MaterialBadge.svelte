<script lang="ts">
	let { label, bg, text }: { label: string; bg: string; text: string } = $props();
</script>

<span class={`shrink-0 rounded-full ${bg} ${text} px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide`}>
	{label}
</span>
