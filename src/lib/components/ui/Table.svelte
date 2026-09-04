<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		headers: Snippet;
		body: Snippet;
		class?: string;
		maxHeight?: string;
		compact?: boolean;
	}

	let { headers, body, class: className = '', maxHeight, compact = false }: Props = $props();
</script>

<div class="overflow-x-auto {className}">
	<div
		class="rounded-md border border-gray-200"
		style={maxHeight ? `max-height: ${maxHeight}; overflow-y: auto;` : ''}
	>
		<table class="ui-table min-w-full {compact ? 'ui-table-compact text-[11px]' : 'text-xs'}">
			<thead>
				<tr
					class="border-b border-gray-200 bg-gray-100 uppercase tracking-wide text-gray-600"
				>
					{@render headers()}
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100 text-gray-800">
				{@render body()}
			</tbody>
		</table>
	</div>
</div>

<style>
	:global(.ui-table th) {
		padding: 0.375rem 0.75rem;
		text-align: left;
		font-weight: 500;
		white-space: nowrap;
	}

	:global(.ui-table td) {
		padding: 0.25rem 0.75rem;
		white-space: nowrap;
	}

	:global(.ui-table-compact th) {
		padding: 0.25rem 0.5rem;
	}

	:global(.ui-table-compact td) {
		padding: 0.125rem 0.5rem;
	}
</style>
