# Tag Organizer Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the native "Pages tagged with" section in Logseq with green/red bullet indicators and sorting based on whether tagged pages are already referenced in the current page's blocks.

**Architecture:** Pure TypeScript plugin (no React). MutationObserver + route change listener detect when "Pages tagged with" appears, then Logseq Editor API fetches the current page's block tree. References are extracted, compared against tagged page names, and DOM is updated with color classes and reordered.

**Tech Stack:** TypeScript, @logseq/libs, Vite + vite-plugin-logseq

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/main.ts` | Plugin entry: register observers, route listener, inject CSS |
| `src/organize.ts` | Core logic: fetch blocks, extract refs, update DOM, sort |

**Files to delete** (unused template code):
- `src/App.tsx`
- `src/utils.ts`
- `src/index.css`
- `tailwind.config.js`
- `postcss.config.js`

---

### Task 1: Clean Up Template and Set Up Entry Point

**Files:**
- Delete: `src/App.tsx`, `src/utils.ts`, `src/index.css`, `tailwind.config.js`, `postcss.config.js`
- Rewrite: `src/main.ts`
- Modify: `package.json` (update plugin id and name)

- [ ] **Step 1: Delete unused template files**

```bash
rm src/App.tsx src/utils.ts src/index.css tailwind.config.js postcss.config.js
```

- [ ] **Step 2: Update package.json plugin metadata**

Change the `logseq` section in `package.json`:

```json
{
  "logseq": {
    "id": "logseq-tag-organizer",
    "icon": "./logo.svg"
  }
}
```

Also remove unused dependencies from `dependencies` and `devDependencies`:
- Remove: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `autoprefixer`, `postcss`, `tailwindcss`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `@vitejs/plugin-react`

- [ ] **Step 3: Update vite.config.ts to remove React plugin**

Replace `vite.config.ts` with:

```typescript
import { defineConfig } from "vite";
import logseqDevPlugin from "vite-plugin-logseq";

export default defineConfig({
  plugins: [logseqDevPlugin()],
  build: {
    target: "esnext",
    minify: "esbuild",
  },
});
```

- [ ] **Step 4: Update tsconfig.json to remove JSX settings**

In `tsconfig.json`, change `"jsx": "react-jsx"` to remove it (or set to `"preserve"` if needed). Remove `react` and `react-dom` from types if present.

- [ ] **Step 5: Rewrite src/main.ts as minimal plugin skeleton**

```typescript
import "@logseq/libs";

const PLUGIN_ID = "logseq-tag-organizer";

function main() {
  console.info(`#${PLUGIN_ID}: loaded`);
  // TODO: will be filled in Task 2 and Task 3
}

logseq.ready(main).catch(console.error);
```

- [ ] **Step 6: Update index.html to remove React references**

Replace the body content of `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Logseq Tag Organizer</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Verify build succeeds**

Run: `pnpm build`
Expected: Build completes without errors, `dist/` directory created.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: strip React template, set up pure TS plugin skeleton"
```

---

### Task 2: Implement Core Logic (organize.ts)

**Files:**
- Create: `src/organize.ts`

- [ ] **Step 1: Create organize.ts with reference extraction**

Create `src/organize.ts`:

```typescript
import type { BlockEntity } from "@logseq/libs/dist/LSPlugin";

const REF_REGEX = /\[\[(.+?)\]\]/g;
const ORGANIZED_CLASS = "tag-org-organized";
const UNORGANIZED_CLASS = "tag-org-unorganized";
const PROCESSED_ATTR = "data-tag-organizer";

/**
 * Recursively extract all [[page]] references from a block tree.
 */
function extractRefsFromBlocks(blocks: BlockEntity[]): Set<string> {
  const refs = new Set<string>();

  function walk(block: BlockEntity) {
    if (block.content) {
      let match: RegExpExecArray | null;
      while ((match = REF_REGEX.exec(block.content)) !== null) {
        refs.add(match[1].toLowerCase());
      }
    }
    if (block.children) {
      for (const child of block.children) {
        if ("content" in child) {
          walk(child as BlockEntity);
        }
      }
    }
  }

  for (const block of blocks) {
    walk(block);
  }

  return refs;
}

/**
 * Find the "Pages tagged with" container in the DOM.
 */
function findTaggedPagesContainer(): Element | null {
  return document.querySelector(".references.page-tags");
}

/**
 * Extract page name from a tagged page list item.
 * The page name is in an <a> with data-ref attribute, or in the text content.
 */
function getPageNameFromItem(item: Element): string | null {
  const link = item.querySelector("a[data-ref]");
  if (link) {
    return link.getAttribute("data-ref");
  }
  // Fallback: try .page-ref text
  const pageRef = item.querySelector(".page-ref");
  if (pageRef) {
    return pageRef.textContent?.trim() ?? null;
  }
  return null;
}

/**
 * Main function: process the "Pages tagged with" section.
 */
export async function processTaggedPages(): Promise<void> {
  const container = findTaggedPagesContainer();
  if (!container || container.hasAttribute(PROCESSED_ATTR)) {
    return;
  }

  const currentPage = await logseq.Editor.getCurrentPage();
  if (!currentPage) {
    return;
  }

  const pageName =
    "originalName" in currentPage
      ? (currentPage as any).originalName
      : (currentPage as any).name;

  if (!pageName) {
    return;
  }

  const blocks = await logseq.Editor.getPageBlocksTree(pageName);
  const refs = extractRefsFromBlocks(blocks);

  // Find all tagged page items
  // The structure is: .references.page-tags > .references-blocks > .references-blocks-item
  // Or it may use: .references.page-tags .ref-block
  const items = container.querySelectorAll(".references-blocks-item");
  if (items.length === 0) {
    return;
  }

  const organized: Element[] = [];
  const unorganized: Element[] = [];

  items.forEach((item) => {
    const name = getPageNameFromItem(item);
    // Clean up any previous classes
    item.classList.remove(ORGANIZED_CLASS, UNORGANIZED_CLASS);

    if (name && refs.has(name.toLowerCase())) {
      item.classList.add(ORGANIZED_CLASS);
      organized.push(item);
    } else {
      item.classList.add(UNORGANIZED_CLASS);
      unorganized.push(item);
    }
  });

  // Reorder: unorganized first, then organized
  const parent = items[0].parentElement;
  if (parent) {
    for (const item of [...unorganized, ...organized]) {
      parent.appendChild(item);
    }
  }

  container.setAttribute(PROCESSED_ATTR, "true");
}

/**
 * Clear the processed marker so next mutation triggers reprocessing.
 */
export function clearProcessedMarker(): void {
  const container = findTaggedPagesContainer();
  if (container) {
    container.removeAttribute(PROCESSED_ATTR);
  }
}
```

- [ ] **Step 2: Verify build succeeds**

Run: `pnpm build`
Expected: Build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add src/organize.ts
git commit -m "feat: implement core organize logic — ref extraction, DOM update, sorting"
```

---

### Task 3: Wire Up Observers and CSS in main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace src/main.ts with full implementation**

Replace `src/main.ts` with:

```typescript
import "@logseq/libs";
import { processTaggedPages, clearProcessedMarker } from "./organize";

const PLUGIN_ID = "logseq-tag-organizer";
const DEBOUNCE_MS = 300;

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

function main() {
  console.info(`#${PLUGIN_ID}: loaded`);

  // Inject CSS for bullet colors
  logseq.provideStyle(`
    .tag-org-organized .bullet-container .bullet {
      background-color: #22c55e !important;
      opacity: 1 !important;
    }
    .tag-org-unorganized .bullet-container .bullet {
      background-color: #ef4444 !important;
      opacity: 1 !important;
    }
  `);

  const debouncedProcess = debounce(() => {
    processTaggedPages().catch((err) =>
      console.error(`#${PLUGIN_ID}: error processing tagged pages`, err)
    );
  }, DEBOUNCE_MS);

  // Watch for DOM changes to detect "Pages tagged with" appearing
  const observer = new MutationObserver(() => {
    debouncedProcess();
  });

  const target = document.getElementById("main-content-container");
  if (target) {
    observer.observe(target, { childList: true, subtree: true });
  }

  // Re-process on route change
  logseq.App.onRouteChanged(() => {
    clearProcessedMarker();
    debouncedProcess();
  });
}

logseq.ready(main).catch(console.error);
```

- [ ] **Step 2: Verify build succeeds**

Run: `pnpm build`
Expected: Build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire up MutationObserver, route listener, and CSS injection"
```

---

### Task 4: Manual Testing and DOM Selector Tuning

**Files:**
- May modify: `src/organize.ts` (selector adjustments)

- [ ] **Step 1: Load plugin in Logseq**

1. Run `pnpm build`
2. In Logseq, enable Developer Mode (Settings > Advanced > Developer mode)
3. Go to Plugins > Load unpacked plugin
4. Select the project root directory
5. Verify console shows `#logseq-tag-organizer: loaded`

- [ ] **Step 2: Test on a tag page**

1. Navigate to a page that has "Pages tagged with" entries
2. Open browser DevTools, inspect the "Pages tagged with" section
3. Verify the DOM structure matches our selectors:
   - Container: `.references.page-tags`
   - Items: `.references-blocks-item`
   - Page name link: `a[data-ref]` or `.page-ref`
4. If selectors don't match, update them in `src/organize.ts`

- [ ] **Step 3: Test organize detection**

1. On the tag page, add `[[some-tagged-page]]` reference in a block
2. The referenced page should show a green bullet in "Pages tagged with"
3. Pages not referenced should show red bullets
4. Unorganized (red) pages should appear above organized (green) pages

- [ ] **Step 4: Test page navigation**

1. Navigate to a different tag page
2. Verify bullets update correctly for the new page
3. Navigate back, verify state is correct

- [ ] **Step 5: Fix any selector issues found and rebuild**

If any selectors needed adjustment:

Run: `pnpm build`
Expected: Build succeeds, reload plugin in Logseq, re-verify.

- [ ] **Step 6: Commit any fixes**

```bash
git add src/organize.ts
git commit -m "fix: adjust DOM selectors based on actual Logseq structure"
```

---

### Task 5: Final Cleanup

**Files:**
- Modify: `package.json` (remove unused eslint configs if needed)
- Delete: `.eslintrc.json` (optional, if not needed)

- [ ] **Step 1: Remove unused eslint config for React**

In `.eslintrc.json`, remove `eslint-plugin-react` and `eslint-plugin-react-hooks` references if present.

- [ ] **Step 2: Run final build**

Run: `pnpm build`
Expected: Clean build, no warnings.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: final cleanup of unused React/eslint configs"
```
