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
