<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		headers: Snippet;
		body: Snippet;
		class?: string;
		maxHeight?: string;
		minWidth?: string;
		nowrap?: boolean;
		compact?: boolean;
	}

	let {
		headers,
		body,
		class: className = '',
		maxHeight,
		minWidth,
		nowrap = false,
		compact = false,
	}: Props = $props();
</script>

<div class="overflow-x-auto {className}">
	<div
		class="rounded-md border border-gray-200"
		style={maxHeight ? `max-height: ${maxHeight}; overflow-y: auto;` : ''}
	>
		<table
			class="table min-w-full {compact ? 'table-xs' : 'table-sm'} {nowrap
				? 'whitespace-nowrap'
				: ''}"
			style={minWidth ? `min-width: ${minWidth};` : ''}
		>
			<thead>
				<tr
					class="border-b border-gray-200 bg-gray-100 uppercase tracking-wide text-gray-600"
				>
					{@render headers()}
				</tr>
			</thead>
			<tbody class="text-gray-800">
				{@render body()}
			</tbody>
		</table>
	</div>
</div>
