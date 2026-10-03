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
import {
  readJSONIfExists,
  writeJSONAtomic,
  writeTextAtomic,
} from "../nlp/lib.mjs";
import { semanticallyEqual } from "../nlp/publish.mjs";
import { buildViewDocuments } from "./lib.mjs";

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
  const generatedAt = new Date().toISOString();
  const views = buildViewDocuments({
    network: Array.isArray(network) ? network : [],
    content,
    topics,
    connections,
    siteSignals,
    generatedAt,
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

  if (!views.connection_topics.pairs.length) {
    delete views.connection_topics.pairs;
  }

  if (!views.connection_topics.sites.length) {
    delete views.connection_topics.sites;
  }

  await writeStableJSON(path.join(dataDir, "activity.json"), views.activity);
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
  process.stdout.write(
    `Wrote view projections: ${views.activity.primary_count} activity rows, ${views.explore.community_count} neighborhoods, ${views.search_index.document_count} search documents.\n`,
  );
}

const invoked = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === invoked) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}
