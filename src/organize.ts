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

  const items = container.querySelectorAll(".references-blocks-item");
  if (items.length === 0) {
    return;
  }

  const organized: Element[] = [];
  const unorganized: Element[] = [];

  items.forEach((item) => {
    const name = getPageNameFromItem(item);
    item.classList.remove(ORGANIZED_CLASS, UNORGANIZED_CLASS);

    if (name && refs.has(name.toLowerCase())) {
      item.classList.add(ORGANIZED_CLASS);
      organized.push(item);
    } else {
      item.classList.add(UNORGANIZED_CLASS);
      unorganized.push(item);
    }
  });

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
