# Tag Organizer Plugin Design

## Purpose

Enhance the native "Pages tagged with" section in Logseq to visually distinguish which tagged pages have already been organized (referenced in the current page's blocks) vs not.

## User Flow

1. User navigates to a tag page (e.g. `[[Programming]]`)
2. The "Pages tagged with" section shows all pages tagged with `#Programming`
3. Plugin automatically checks which of those pages are referenced (`[[page]]`) anywhere in the current page's block tree
4. Visual indicators appear:
   - Green bullet: page is already organized (referenced in current page)
   - Red bullet: page is not yet organized
5. List is reordered: unorganized pages on top, organized pages on bottom

## Architecture

### Trigger Mechanism

- `MutationObserver` on `#main-content-container` to detect when `.references.page-tags` appears in the DOM
- `logseq.App.onRouteChanged` to re-trigger on page navigation
- 300ms debounce on MutationObserver callback
- Idempotency via `data-tag-organizer` attribute on processed containers; cleared on route change

### Core Logic (organize.ts)

1. `logseq.Editor.getCurrentPage()` to get current page
2. `logseq.Editor.getPageBlocksTree()` to get all blocks
3. Recursively traverse block tree, extract all `[[...]]` references from block content via regex `\[\[(.+?)\]\]`
4. Build a `Set<string>` of referenced page names (lowercased for case-insensitive comparison)
5. In DOM, find all items in `.references.page-tags` list, extract page name from each
6. Compare against the Set, apply CSS classes, reorder DOM nodes

### DOM Manipulation

- Add class `tag-org-organized` or `tag-org-unorganized` to each list item
- CSS injected via `logseq.provideStyle`:
  - `.tag-org-organized` bullet color: `#22c55e` (green)
  - `.tag-org-unorganized` bullet color: `#ef4444` (red)
- Reorder by moving unorganized items before organized items (preserving relative order within each group)

### Entry Point (main.ts)

- No React rendering — pure TS plugin
- Register MutationObserver and route change listener in `main()`
- Inject CSS via `logseq.provideStyle`

## Project Structure

```
src/
  main.ts        — plugin entry, lifecycle, observers
  organize.ts    — core logic: block traversal, DOM updates, sorting
```

Remove from template: `App.tsx`, `utils.ts`, `index.css`, tailwind/postcss configs.

## Edge Cases

- Page names are compared case-insensitively
- Nested `[[references]]` within child blocks at any depth are included
- If "Pages tagged with" section is not present, plugin does nothing
- Multiple rapid navigations are handled by debounce + idempotency marker
