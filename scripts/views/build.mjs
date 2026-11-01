/**
 * Goal & Constraints:
 * Write compact UI projections from canonical _data JSON. Does not rewrite
 * network, topics, connections, content, or site_signals. Aligns topics/*.md
 * stubs with neighborhood slugs so topic cards have pages. connection_topics
 * is a presentation overlay for /connections/, not a graph edge file.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { topicCollectionMarkdown } from "../nlp/communities.mjs";
import { formatGeneratedOutputs } from "../format-written.mjs";
import {
  readJSONIfExists,
  writeJSONAtomic,
  writeTextAtomic,
} from "../nlp/lib.mjs";
import { semanticallyEqual } from "../nlp/publish.mjs";
import {
  buildActivityAtomXml,
  buildEventIcs,
  buildViewDocuments,
} from "./lib.mjs";
import { materializeActivityPosters } from "./posters.mjs";
import {
  captureMissingWorkScreenshots,
  collectProjectionItemsNeedingPosters,
} from "./work-screenshots.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Reads canonical graph files and writes presentation documents.
 * @param {string} [root]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function buildViewProjections(root = ROOT) {
  const dataDir = path.join(root, "_data");
  const network = await readJSONIfExists(
    path.join(dataDir, "network.json"),
    [],
  );
  const content = await readJSONIfExists(
    path.join(dataDir, "content.json"),
    {},
  );
  const topics = await readJSONIfExists(path.join(dataDir, "topics.json"), {});
  const connections = await readJSONIfExists(
    path.join(dataDir, "connections.json"),
    {},
  );
  const siteSignals = await readJSONIfExists(
    path.join(dataDir, "site_signals.json"),
    {},
  );
  const channelPublish = await readJSONIfExists(
    path.join(dataDir, "channel_publish.json"),
    {},
  );
  const generatedAt = new Date().toISOString();
  const views = buildViewDocuments({
    network: Array.isArray(network) ? network : [],
    content,
    topics,
    connections,
    siteSignals,
    generatedAt,
    channelPublishByUrl:
      channelPublish &&
      typeof channelPublish === "object" &&
      !Array.isArray(channelPublish)
        ? channelPublish
        : {},
  });

  if (!views.activity.primary.length) {
    delete views.activity.primary;
  }

  if (!views.topic_views.neighborhoods.length) {
    delete views.topic_views.neighborhoods;
  }

  if (!views.topic_views.cooccurrence.length) {
    delete views.topic_views.cooccurrence;
  }

  if (!views.site_views.sites.length) {
    delete views.site_views.sites;
  }

  if (!views.search_index.documents.length) {
    delete views.search_index.documents;
  }

  if (!views.showcase.items.length) {
    delete views.showcase.items;
  }

  if (!views.showcase.home.length) {
    delete views.showcase.home;
  }

  if (!views.showcase.kinds.length) {
    delete views.showcase.kinds;
  }

  if (
    !views.showcase.kind_labels ||
    Object.keys(views.showcase.kind_labels).length === 0
  ) {
    delete views.showcase.kind_labels;
  }

  if (!views.happening.items.length) {
    delete views.happening.items;
  }

  if (!views.connection_topics.pairs.length) {
    delete views.connection_topics.pairs;
  }

  if (!views.connection_topics.sites.length) {
    delete views.connection_topics.sites;
  }

  // Channel cards (and any other projected Showcase/Activity rows) are built
  // after content harvest screenshots. Attach/capture missing posters here so
  // YouTube/Vimeo/Twitch channels get a viewport image when OG is absent.
  const projectionPosterTargets = collectProjectionItemsNeedingPosters(views);
  await captureMissingWorkScreenshots(projectionPosterTargets, { root });

  await materializeActivityPosters(views, root);

  await writeStableJSON(path.join(dataDir, "activity.json"), views.activity);

  const atomPath = path.join(root, "assets/activity/atom.xml");
  const atomXml = buildActivityAtomXml(views.activity);
  const previousAtom = await fs.readFile(atomPath, "utf8").catch(() => "");

  if (previousAtom !== atomXml) {
    await fs.mkdir(path.dirname(atomPath), { recursive: true });
    await writeTextAtomic(atomPath, atomXml);
  }

  await writeStableJSON(path.join(dataDir, "explore.json"), views.explore);
  await writeStableJSON(
    path.join(dataDir, "topic_views.json"),
    views.topic_views,
  );
  await writeStableJSON(
    path.join(dataDir, "connection_topics.json"),
    views.connection_topics,
  );
  await writeStableJSON(
    path.join(dataDir, "site_views.json"),
    views.site_views,
  );
  await writeStableJSON(
    path.join(dataDir, "search_index.json"),
    views.search_index,
  );
  // made.json is a stable alias for showcase.json (same data, same path).
  await writeStableJSON(path.join(dataDir, "made.json"), views.showcase);
  await writeStableJSON(path.join(dataDir, "showcase.json"), views.showcase);
  await writeStableJSON(path.join(dataDir, "happening.json"), views.happening);

  // Generate iCalendar file when upcoming events exist.
  const happeningItems = Array.isArray(views.happening.items)
    ? views.happening.items
    : [];

  if (happeningItems.length > 0) {
    const icsPath = path.join(root, "assets/events/joshternet.ics");
    const icsContent = buildEventIcs(happeningItems);
    await fs.mkdir(path.dirname(icsPath), { recursive: true });
    await writeTextAtomic(icsPath, icsContent);
  }

  const topicsDir = path.join(root, "topics");
  await fs.mkdir(topicsDir, { recursive: true });
  const neighborhoods = Array.isArray(views.topic_views.neighborhoods)
    ? views.topic_views.neighborhoods
    : [];
  const keep = new Set(neighborhoods.map((topic) => `${topic.slug}.md`));
  keep.add("index.md");
  const existing = await fs.readdir(topicsDir).catch(() => []);

  for (const file of existing) {
    if (!file.endsWith(".md") || keep.has(file)) {
      continue;
    }

    await fs.unlink(path.join(topicsDir, file));
  }

  for (const topic of neighborhoods) {
    if (typeof topic.slug !== "string" || !topic.slug) {
      continue;
    }

    const pagePath = path.join(topicsDir, `${topic.slug}.md`);
    const markdown = topicCollectionMarkdown(topic);
    const current = await fs.readFile(pagePath, "utf8").catch(() => "");

    if (current !== markdown) {
      await writeTextAtomic(pagePath, markdown);
    }
  }

  return views;
}

/**
 * Rewrites a dataset only when its content changed. Timestamp-only rebuilds
 * leave the previous file in place so a repeat build stays identical.
 * @param {string} filePath
 * @param {Record<string, unknown>} document
 * @returns {Promise<void>}
 */
async function writeStableJSON(filePath, document) {
  const previous = await readJSONIfExists(filePath, null);

  if (previous && semanticallyEqual(previous, document)) {
    return;
  }

  await writeJSONAtomic(filePath, document);
}

async function main() {
  const views = await buildViewProjections();
  await formatGeneratedOutputs();
  process.stdout.write(
    `Wrote view projections: ${views.activity.primary_count} activity rows, ${views.explore.community_count} neighborhoods, ${views.search_index.document_count} search documents, ${views.showcase.item_count} showcase items, ${views.happening.item_count} upcoming events.\n`,
  );
}

const invoked = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === invoked) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}
