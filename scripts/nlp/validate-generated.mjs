/**
 * Goal & Constraints:
 * Validate committed NLP/network JSON against schemas/*.schema.json (Ajv draft
 * 2020-12) plus graph invariants. Used by CI after nlp:sync / network:sync.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { itemsFromCollection } from "../network/collections.mjs";
import { loadAliasMap, resolveAlias } from "./communities.mjs";
import { evidenceIdentityKey } from "./evidence.mjs";
import { foldPluralSlug } from "./normalize.mjs";

const ROOT = process.cwd();
const SCHEMAS_DIR = path.join(ROOT, "schemas");

/**
 * @param {string} relativePath
 * @returns {unknown}
 */
function readJSON(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  throw new Error(message);
}

/**
 * @param {string} fileName
 * @returns {object}
 */
function loadSchema(fileName) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, fileName), "utf8"));
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const schemaFiles = {
  network: "network.schema.json",
  site_signals: "site-signals.schema.json",
  content: "content.schema.json",
  topics: "topics.schema.json",
  connections: "connections.schema.json",
  blogrolls: "blogrolls.schema.json",
  data_manifest: "data-manifest.schema.json",
};

/** @type {Record<string, ReturnType<typeof ajv.compile>>} */
const validators = {};

for (const [key, fileName] of Object.entries(schemaFiles)) {
  validators[key] = ajv.compile(loadSchema(fileName));
}

/**
 * @param {string} name
 * @param {unknown} data
 */
function assertSchema(name, data) {
  const validate = validators[name];

  if (!validate(data)) {
    const items =
      name === "content" && data && typeof data === "object"
        ? /** @type {{ items?: Array<{ identity?: string, url?: string }> }} */ (
            data
          ).items
        : null;
    const detail = (validate.errors || [])
      .slice(0, 5)
      .map((error) => {
        const match = /^\/items\/(\d+)/.exec(error.instancePath || "");
        const item =
          match && Array.isArray(items) ? items[Number(match[1])] : null;
        const who = item?.identity || item?.url;
        const suffix = who ? ` (${who})` : "";
        return `${error.instancePath || "/"} ${error.message}${suffix}`;
      })
      .join("; ");
    fail(`${name} failed schema validation: ${detail}`);
  }
}

const network = readJSON("_data/network.json");
const topics = readJSON("_data/topics.json");
const connections = readJSON("_data/connections.json");
const signals = readJSON("_data/site_signals.json");
const blogrolls = readJSON("_data/blogrolls.json");
const content = readJSON("_data/content.json");
const manifest = readJSON("_data/data_manifest.json");

assertSchema("network", network);
assertSchema("topics", topics);
assertSchema("connections", connections);
assertSchema("site_signals", signals);
assertSchema("blogrolls", blogrolls);
assertSchema("content", content);
assertSchema("data_manifest", manifest);

const aliases = loadAliasMap(readJSON("_data/topic_aliases.json"));

/**
 * Community slugs are folded and aliased. Publisher evidence keeps the
 * original slug, so membership checks use the same canonical form.
 * @param {unknown} slug
 * @returns {string}
 */
function canonicalTopicSlug(slug) {
  return resolveAlias(foldPluralSlug(String(slug || "")), aliases);
}

const topicList = itemsFromCollection(topics, "communities");
const connectionList = itemsFromCollection(connections, "edges");
const blogrollList = itemsFromCollection(blogrolls, "edges");
const contentList = itemsFromCollection(content, "items");

if (!topics || typeof topics !== "object" || Array.isArray(topics)) {
  fail("topics.json must be a collection document");
}

const signalsByOrigin = new Map(
  (signals.origins || []).map((origin) => [origin.origin, origin]),
);

for (const topic of topicList) {
  if (!topic || typeof topic.slug !== "string") {
    fail(`invalid topic: ${JSON.stringify(topic)}`);
  }

  if (!Array.isArray(topic.sites) || topic.sites.length < 1) {
    fail(`public topic must have ≥1 site: ${topic.slug}`);
  }

  if (
    typeof topic.member_count === "number" &&
    topic.member_count !== topic.sites.length
  ) {
    fail(`member_count mismatch for ${topic.slug}`);
  }

  if (/^(quot|x27|nbsp|amp|class-quot|span|div)$/.test(topic.slug)) {
    fail(`parser artifact topic leaked: ${topic.slug}`);
  }

  const sources = Array.isArray(topic.sources) ? topic.sources : [];

  for (const source of sources) {
    if (source === "nlp" || source === "visible-text") {
      const heuristicMembers = (topic.sites || []).filter(
        (site) => site && site.membership === "heuristic",
      );

      if (heuristicMembers.length === 0) {
        fail(
          `public topic ${topic.slug} includes non-community source ${source} without heuristic members`,
        );
      }
    }
  }

  for (const site of topic.sites || []) {
    const origin = signalsByOrigin.get(site.origin);

    if (!origin) {
      fail(
        `public topic ${topic.slug} member missing site_signals ${site.origin}`,
      );
    }

    const topicSlug = canonicalTopicSlug(topic.slug);
    const declared = (origin.declared_topics || []).some(
      (item) =>
        item &&
        canonicalTopicSlug(item.slug) === topicSlug &&
        item.community_eligible === true,
    );
    const heuristic = (origin.subject_signals || []).some(
      (item) =>
        item &&
        canonicalTopicSlug(item.slug) === topicSlug &&
        item.evidence_class === "heuristic" &&
        item.community_eligible === true,
    );

    if (site.membership === "declared" && !declared) {
      fail(
        `public topic ${topic.slug} declared member lacks qualifying declared evidence: ${site.origin}`,
      );
    }

    if (site.membership === "heuristic" && !heuristic) {
      fail(
        `public topic ${topic.slug} heuristic member lacks qualifying heuristic evidence: ${site.origin}`,
      );
    }

    if (!declared && !heuristic) {
      fail(
        `public topic ${topic.slug} member lacks qualifying evidence: ${site.origin}`,
      );
    }
  }
}

if (
  !connections ||
  typeof connections !== "object" ||
  Array.isArray(connections)
) {
  fail("connections.json must be a collection document");
}

const allowedRelations = new Set([
  "homepage-link",
  "content-link",
  "blogroll",
  "reply-to",
  "repost-of",
  "syndication",
]);

for (const edge of connectionList) {
  const relation = edge.relation || edge.kind;

  if (relation === "friend" || relation === "topic") {
    fail(`forbidden connection relation: ${relation}`);
  }

  if (edge.kind === "friend" || edge.kind === "topic") {
    fail(`forbidden legacy kind: ${edge.kind}`);
  }

  if (edge.relation && !allowedRelations.has(edge.relation)) {
    fail(`unknown relation: ${edge.relation}`);
  }

  if (edge.via === "") {
    fail("connections must omit empty via");
  }

  if (String(edge.href || "").includes("/.well-known/josh")) {
    fail("well-known josh href in connections");
  }

  if (
    Array.isArray(edge.evidence) &&
    typeof edge.evidence_count === "number" &&
    edge.evidence_count !== edge.evidence.length
  ) {
    fail(`connection evidence_count mismatch ${edge.from} → ${edge.to}`);
  }
}

const connectionKeys = new Set();

for (const edge of connectionList) {
  const key = `${edge.from}\0${edge.to}\0${edge.relation}`;

  if (connectionKeys.has(key)) {
    fail(`duplicate semantic connection: ${key}`);
  }

  connectionKeys.add(key);
}

if (!signals || !Array.isArray(signals.origins)) {
  fail("site_signals.json must have origins[]");
}

if (signals.schema_version !== 1) {
  fail("site_signals.json must declare schema_version 1");
}

for (const origin of signals.origins) {
  if (!origin || typeof origin.origin !== "string") {
    fail("site_signals origin missing origin field");
  }

  if (!origin.coverage || typeof origin.coverage !== "object") {
    fail(`site_signals ${origin.origin} missing coverage`);
  }

  if (!Array.isArray(origin.declared_topics)) {
    fail(`site_signals ${origin.origin} missing declared_topics`);
  }

  if (!Array.isArray(origin.subject_signals)) {
    fail(`site_signals ${origin.origin} missing subject_signals`);
  }

  if (!Array.isArray(origin.pages)) {
    fail(`site_signals ${origin.origin} missing pages`);
  }

  const declaredSlugs = new Set();

  for (const signal of [
    ...(origin.declared_topics || []),
    ...(origin.subject_signals || []),
  ]) {
    if (Object.hasOwn(signal, "score")) {
      fail(`canonical score leaked on ${origin.origin} ${signal.slug}`);
    }

    if (
      typeof signal.evidence_count === "number" &&
      Array.isArray(signal.evidence) &&
      signal.evidence_count !== signal.evidence.length
    ) {
      fail(`evidence_count mismatch for ${origin.origin} ${signal.slug}`);
    }

    const seenKeys = new Set();

    for (const item of signal.evidence || []) {
      if (item.observed_at === "") {
        fail(`empty observed_at on ${origin.origin} ${signal.slug}`);
      }

      const key = evidenceIdentityKey(item);

      if (key && seenKeys.has(key)) {
        fail(`duplicate evidence on ${origin.origin} ${signal.slug}`);
      }

      if (key) {
        seenKeys.add(key);
      }
    }
  }

  for (const topic of origin.declared_topics || []) {
    declaredSlugs.add(topic.slug);
  }

  for (const signal of origin.subject_signals || []) {
    if (declaredSlugs.has(signal.slug)) {
      fail(
        `declared slug also listed in subject_signals: ${origin.origin} ${signal.slug}`,
      );
    }
  }
}

if (!blogrolls || typeof blogrolls !== "object" || Array.isArray(blogrolls)) {
  fail("blogrolls.json must be a collection document");
}

for (const edge of blogrollList) {
  if (
    typeof edge.blogroll === "string" &&
    edge.blogroll.includes("/assets/network/joshternet.opml")
  ) {
    fail("generated hub OPML must not appear as blogroll evidence");
  }
}

if (!Array.isArray(contentList)) {
  fail("content.json items must be an array when present");
}

for (const item of contentList) {
  if (item && Object.prototype.hasOwnProperty.call(item, "content_html")) {
    fail("content.json must not mirror content_html");
  }

  if (typeof item.summary === "string" && /<[a-zA-Z]/.test(item.summary)) {
    fail(`content summary must be plain text: ${item.url}`);
  }
}

if (
  !manifest?.semantic_hashes?.network ||
  !manifest?.semantic_hashes?.blogrolls
) {
  fail("data_manifest semantic_hashes must include network and blogrolls");
}

if (fs.existsSync(path.join(ROOT, "_data/topic_candidates.json"))) {
  fail("topic_candidates.json must not be committed under _data/");
}

process.stdout.write("Generated data schemas + invariants OK.\n");
