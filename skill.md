---
name: sveltekit-development
description: Build, extend, or refactor SvelteKit web applications. Use this skill whenever the task involves creating a SvelteKit project, adding routes/pages, building UI components, managing state, or fixing bugs in a SvelteKit codebase. Enforces concise, readable, modular code and pushes reusable UI into shared components rather than duplicating markup. Trigger even if the user just says "add a page," "build a form," "make a dashboard," or names a .svelte file, since SvelteKit conventions apply.
---

# SvelteKit Development

Guidance for writing SvelteKit applications that are concise, readable, modular, and built from reusable components. Optimize for a codebase a new contributor could understand in minutes, not one that's merely functional.

## Core principles (apply to every file you touch)

1. **Concise over clever.** Prefer the shortest code that stays readable. Avoid unnecessary wrapper functions, intermediate variables that are only used once, or abstractions with a single call site.
2. **Readable over dense.** Descriptive names, early returns instead of nested conditionals, one clear responsibility per function/component. A reader shouldn't need to hold more than one thing in their head at a time.
3. **Modular by default.** If a piece of markup, logic, or styling could plausibly be reused — or if a `.svelte` file exceeds ~150 lines — split it. Prefer many small files over few large ones.
4. **Componentize repetition immediately.** The moment the same markup pattern appears twice (a card, a button variant, a form field, a list item), extract it into `src/lib/components/` on the spot. Don't wait for a third occurrence.
5. **No dead code, no commented-out blocks, no placeholder TODOs left in delivered code.** Ship it working or don't ship it.

## Project structure

```
src/
├── routes/                  # File-based routing only — pages, layouts, load functions, form actions
│   ├── +layout.svelte
│   ├── +page.svelte
│   └── some-route/
│       ├── +page.svelte
│       ├── +page.server.ts  # server-only load/actions
│       └── +page.ts         # universal load
├── lib/
│   ├── components/          # Reusable, presentational components (Button, Card, Modal, FormField...)
│   │   └── ui/              # Low-level primitives if the app is large enough to warrant the split
│   ├── utils/                 # Pure helper functions, no Svelte imports
│   └── types.ts               # Shared TypeScript types
└── app.d.ts
```

Rules:

- `routes/` files stay thin: layout, data wiring, composing components. Business logic and markup blocks belong in `lib/`.
- A `+page.svelte` that's mostly a wall of markup is a signal to extract components.
- Anything imported by more than one route belongs in `lib/`, not duplicated per-route.

## Components

- **One component, one job.** If you're describing a component with "and," split it (e.g. "shows the user card and handles the edit modal" → `UserCard` + `EditUserModal`).
- **Props in, events/callbacks out.** Keep components dumb where possible — pass data in via props, surface interactions via callback props (Svelte 5) or `createEventDispatcher`. Avoid components reaching into global state unless they genuinely represent shared app state (auth, theme, cart).
- **Naming:** PascalCase filenames matching the component name (`UserCard.svelte`). Co-locate tightly-coupled sub-components in a folder (`UserCard/UserCard.svelte`, `UserCard/UserAvatar.svelte`) only when they're not reused elsewhere.
- **Composition over configuration.** Prefer slots/snippets and composition over a component with 15 boolean props controlling its every variant. If a component needs many flags, it's probably two components.
- **Style locally.** Use scoped `<style>` blocks per component; reach for a shared `app.css` only for true global resets/tokens (colors, spacing scale, typography). Don't repeat magic numbers — extract to CSS custom properties.

### Example: extracting a reusable component

Bad — duplicated markup across routes:

```svelte
<!-- repeated in three +page.svelte files -->
<div class="card">
	<h3>{title}</h3>
	<p>{description}</p>
</div>
```

Good — one component, imported everywhere:

```svelte
<!-- src/lib/components/Card.svelte -->
<script lang="ts">
	let { title, description }: { title: string; description: string } = $props();
</script>

<div class="card">
	<h3>{title}</h3>
	<p>{description}</p>
</div>

<style>
	.card {
		padding: var(--space-4);
		border-radius: var(--radius-md);
	}
</style>
```

```svelte
<!-- any route -->
<script lang="ts">
	import Card from '$lib/components/Card.svelte';
</script>

<Card title="Plan" description="Monthly billing" />
```

## State management (Svelte 5 runes)

- Use `$state`, `$derived`, `$effect` — this is Svelte 5 idiomatic, avoid the old `writable`/`$:` patterns unless the project is explicitly Svelte 4.
- Local, single-component state: `let x = $state(0)` inline in the component.
- Shared state across components: a plain `.svelte.ts` module exporting `$state`, imported where needed. Don't reach for a store/context unless state genuinely crosses component boundaries.
- Derive, don't duplicate: use `$derived` instead of manually syncing a second variable with `$effect`.
- Keep `$effect` usage minimal — it's for syncing with the outside world (DOM, external libs, subscriptions), not for computing values (`$derived` does that).

```ts
// src/lib/stores/cart.svelte.ts
export const cart = $state<{ items: CartItem[] }>({ items: [] });

export function addItem(item: CartItem) {
	cart.items.push(item);
}
```

## Data loading & forms

- Use `+page.server.ts` / `+page.ts` `load` functions for data fetching — never fetch inside a component's `$effect` if a `load` function can do it.
- Use SvelteKit form actions (`+page.server.ts` `actions`) for mutations instead of hand-rolled `fetch` + client state where possible; it keeps progressive enhancement free.
- Validate/parse input in one place (a `utils/validation.ts` or a schema library like `zod`/`valibot`), not scattered inline checks across components.

## TypeScript & code quality checklist

Before considering a piece of code done, check:

- [ ] Would a new teammate understand this file in under a minute?
- [ ] Is any markup block repeated more than once? → extract a component.
- [ ] Is any `+page.svelte` doing more than composing components + light glue logic?
- [ ] Are prop/function names self-explanatory without a comment?
- [ ] Are types explicit on component props and function signatures (no implicit `any`)?
- [ ] Any leftover console.logs, commented-out code, or unused imports? Remove them.
- [ ] Could this function be shorter without losing clarity? (Not "golfed" — just free of unnecessary ceremony.)

## When generating code for a request

1. Identify if the requested UI piece already resembles something reusable — if so, build it in `lib/components/` first, then consume it in the route.
2. Keep route files as thin composition layers.
3. Default to Svelte 5 runes syntax unless the existing project uses Svelte 4 stores (check `package.json`/existing files first and match the project's version).
4. Favor small, focused commits/diffs: don't restructure unrelated files while implementing a feature.
