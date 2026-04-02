import "@logseq/libs";

const PLUGIN_ID = "logseq-tag-organizer";

function main() {
  console.info(`#${PLUGIN_ID}: loaded`);
}

logseq.ready(main).catch(console.error);
