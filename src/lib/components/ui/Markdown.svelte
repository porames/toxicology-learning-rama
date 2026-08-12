<script lang="ts">
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';

	let { value = '', class: className = '' }: { value?: string; class?: string } = $props();

	const html = $derived(DOMPurify.sanitize(marked.parse(value) as string));
</script>

<div class={`markdown-body text-[14px] leading-relaxed text-ink-900 {className}`}>{@html html}</div>

<style>
	.markdown-body :global(p) {
		margin: 0.4em 0;
	}
	.markdown-body :global(p:first-child) {
		margin-top: 0;
	}
	.markdown-body :global(p:last-child) {
		margin-bottom: 0;
	}
	.markdown-body :global(h1),
	.markdown-body :global(h2),
	.markdown-body :global(h3),
	.markdown-body :global(h4) {
		font-weight: 600;
		color: #1a1523;
		margin: 0.75em 0 0.35em;
		line-height: 1.3;
	}
	.markdown-body :global(h1) {
		font-size: 1.3em;
	}
	.markdown-body :global(h2) {
		font-size: 1.15em;
	}
	.markdown-body :global(h3) {
		font-size: 1.05em;
	}
	.markdown-body :global(ul),
	.markdown-body :global(ol) {
		padding-left: 1.4em;
		margin: 0.4em 0;
	}
	.markdown-body :global(li) {
		margin: 0.2em 0;
	}
	.markdown-body :global(strong) {
		font-weight: 600;
		color: #1a1523;
	}
	.markdown-body :global(code) {
		background: rgba(26, 21, 35, 0.06);
		border-radius: 4px;
		padding: 0.1em 0.35em;
		font-size: 0.9em;
	}
	.markdown-body :global(pre) {
		background: #1a1523;
		color: #fafaf9;
		border-radius: 8px;
		padding: 0.75em 1em;
		overflow-x: auto;
		margin: 0.5em 0;
	}
	.markdown-body :global(pre code) {
		background: transparent;
		padding: 0;
	}
	.markdown-body :global(a) {
		color: #7c5cfc;
		text-decoration: underline;
	}
	.markdown-body :global(blockquote) {
		border-left: 3px solid rgba(124, 92, 252, 0.4);
		padding-left: 0.75em;
		color: #6b6480;
		margin: 0.5em 0;
	}
	.markdown-body :global(hr) {
		border: none;
		border-top: 1px solid rgba(26, 21, 35, 0.1);
		margin: 0.75em 0;
	}
	.markdown-body :global(table) {
		border-collapse: collapse;
		margin: 0.5em 0;
		font-size: 0.95em;
	}
	.markdown-body :global(th),
	.markdown-body :global(td) {
		border: 1px solid rgba(26, 21, 35, 0.12);
		padding: 0.35em 0.6em;
	}
	.markdown-body :global(th) {
		background: rgba(26, 21, 35, 0.04);
		font-weight: 600;
	}
</style>
