import "@logseq/libs";
import { processTaggedPages, clearProcessedMarker } from "./organize";

const PLUGIN_ID = "logseq-tag-organizer";
const DEBOUNCE_MS = 300;
const STYLE_ID = "logseq-tag-organizer-style";

const CSS = `
  .references.page-tags .initial ul > li.tag-org-organized,
  .references.page-tags .initial ul > li.tag-org-unorganized {
    list-style: none;
    position: relative;
    padding-left: 16px;
  }
  .references.page-tags .initial ul > li.tag-org-organized::before,
  .references.page-tags .initial ul > li.tag-org-unorganized::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .references.page-tags .initial ul > li.tag-org-organized::before {
    background-color: #22c55e;
  }
  .references.page-tags .initial ul > li.tag-org-unorganized::before {
    background-color: #ef4444;
  }
`;

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

function injectStyleToMainDocument() {
  const mainDoc = top?.document ?? document;
  if (mainDoc.getElementById(STYLE_ID)) return;
  const style = mainDoc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  mainDoc.head.appendChild(style);
}

function main() {
  console.info(`#${PLUGIN_ID}: loaded`);

  // Inject CSS into the main Logseq document (not the plugin iframe)
  injectStyleToMainDocument();

  const debouncedProcess = debounce(() => {
    processTaggedPages().catch((err) =>
      console.error(`#${PLUGIN_ID}: error processing tagged pages`, err)
    );
  }, DEBOUNCE_MS);

  // Watch for DOM changes in the main document
  const mainDoc = top?.document ?? document;
  const target = mainDoc.getElementById("main-content-container");
  if (target) {
    const observer = new MutationObserver(() => {
      debouncedProcess();
    });
    observer.observe(target, { childList: true, subtree: true });
  } else {
  }

  // Re-process on route change
  logseq.App.onRouteChanged(() => {
    clearProcessedMarker();
    debouncedProcess();
  });

  // Initial run
  debouncedProcess();
}

logseq.ready(main).catch(console.error);
