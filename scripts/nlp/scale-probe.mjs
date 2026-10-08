/**
 * Goal: Harvest every Josh site listed on joshing.you (not the directory
 * itself), treat them as synthetic members under .tmp, run the same parsers
 * as nlp:sync, then replay thousands of offline parse passes. Does not write
 * repo _data or topics/*.md. Excluded from coverage.
 *
 * Usage: npm run nlp:scale-probe -- --runs 3000 --seed 1
 *        npm run nlp:scale-probe -- --replay-only
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  aggregateConnectionEdges,
  connectionObservations,
} from "../network/connections.mjs";
import { sparseCollectionDocument } from "../network/collections.mjs";
import { assertPublicURL } from "../network/lib.mjs";
import { applyCatalogMatches, networkCatalog } from "./catalog.mjs";
import {
  buildTopicCommunities,
  loadAliasMap,
  loadDenylist,
} from "./communities.mjs";
import {
  contentItemsFromJsonFeed,
  contentItemsFromRssOrAtom,
  joinContentWithPageSignals,
  mergeContentItems,
} from "./content.mjs";
import {
  DIRECTORY_ORIGIN,
  FEED_ACCEPT,
  MAX_DIRECTORY_PAGES,
  accumulateListedOrigins,
  advertisedFeeds,
  directoryPageUrls,
  flagValue,
  mulberry32,
  shuffle,
} from "./directory.mjs";
import {
  isDiscoveryOnlySource,
  isNonSubjectSlug,
  isParserArtifactSlug,
  isSensitiveHeuristicSlug,
  legacySubjectsFromSignals,
} from "./evidence.mjs";
import { extractTopicsFromPages } from "./extract.mjs";
import {
  USER_AGENT,
  fetchPublicText,
  readJSONIfExists,
  writeJSONAtomic,
} from "./lib.mjs";
import {
  allowsCommunityTopics,
  allowsHeuristicTopics,
  classifyPageRole,
} from "./page-role.mjs";
import { collectPortfolio } from "./portfolio.mjs";
import { buildDataManifest, semanticHash } from "./publish.mjs";
import { robotsAllowsPath } from "./robots.mjs";
import {
  mergeSubjects,
  splitDeclaredAndSignals,
  subjectsFromHtml,
} from "./subjects.mjs";
import { isEnglishLanguage, parseHtmlRegions } from "./text.mjs";
import { buildViewProjections } from "../views/build.mjs";

const ROOT = process.cwd();
const HARVEST_DIR = path.join(ROOT, ".tmp", "scale-harvest");
const SCALE_ROOT = path.join(ROOT, ".tmp", "scale-root");
const DEFAULT_RUNS = 3000;
const DEFAULT_SEED = 1;
const SCHEMA_FILES = {
  network: "network.schema.json",
  site_signals: "site-signals.schema.json",
  content: "content.schema.json",
  topics: "topics.schema.json",
  connections: "connections.schema.json",
  blogrolls: "blogrolls.schema.json",
  data_manifest: "data-manifest.schema.json",
};

/**
 * @param {string} origin
 * @returns {string}
 */
function originKey(origin) {
  return createHash("sha256").update(origin).digest("hex").slice(0, 16);
}

/**
 * @param {unknown} topic
 * @returns {string}
 */
function visitorFacingTopicIssue(topic) {
  if (!topic || typeof topic !== "object") {
    return "empty";
  }

  const label = String(topic.label || "");
  const slug = String(topic.slug || "");

  if (/<!\[CDATA/i.test(label) || /[\\/]/.test(label)) {
    return "path-or-cdata";
  }

  if (
    !slug ||
    isParserArtifactSlug(slug) ||
    isNonSubjectSlug(slug) ||
    (topic.community_eligible === true &&
      isDiscoveryOnlySource(String(topic.source || "")))
  ) {
    return "non-subject";
  }

  return "";
}

/**
 * @param {Record<string, unknown>} parsed
 * @returns {{ ok: boolean, issues: Array<Record<string, string>> }}
 */
function auditParsedOrigin(parsed) {
  const issues = [];
  const origin = String(parsed.origin || "");

  /**
   * @param {unknown} topic
   * @param {string} surface
   */
  function note(topic, surface) {
    if (
      !topic ||
      typeof topic !== "object" ||
      topic.community_eligible !== true
    ) {
      return;
    }

    const reason = visitorFacingTopicIssue(topic);

    if (reason) {
      issues.push({
        origin,
        surface,
        slug: String(topic.slug || ""),
        reason,
        source: String(topic.source || ""),
      });
    }
  }

  for (const topic of parsed.declared_topics || []) {
    note(topic, "declared");
  }

  for (const item of parsed.contentDrafts || []) {
    for (const topic of item?.declared_topics || []) {
      note(topic, "content");
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * @param {string} origin
 * @returns {string}
 */
function originFolder(origin) {
  return path.join(HARVEST_DIR, "origins", originKey(origin));
}

/**
 * @param {unknown} data
 * @param {import("ajv").ValidateFunction} validate
 * @param {string} name
 */
function assertSchema(name, data, validate) {
  if (!validate(data)) {
    const detail = (validate.errors || [])
      .slice(0, 5)
      .map((error) => `${error.instancePath || "/"} ${error.message}`)
      .join("; ");
    throw new Error(`${name} failed schema validation: ${detail}`);
  }
}

/**
 * @param {Map<string, unknown>} dnsCache
 * @returns {Promise<{ listed: string[], allowed: string[], skippedRobots: number, skippedSsrf: number }>}
 */
async function listAllowedOrigins(dnsCache) {
  let listed = [];

  for (let page = 1; page <= MAX_DIRECTORY_PAGES; page += 1) {
    let added = 0;

    for (const href of directoryPageUrls(page)) {
      try {
        const fetched = await fetchPublicText(href, { cache: dnsCache });
        const next = accumulateListedOrigins(
          listed,
          fetched.body,
          fetched.url || DIRECTORY_ORIGIN,
        );
        listed = next.origins;
        added += next.added;
      } catch {
        continue;
      }
    }

    if (page > 1 && added === 0) {
      break;
    }
  }

  const allowed = [];
  let skippedRobots = 0;
  let skippedSsrf = 0;

  for (const origin of listed) {
    try {
      await assertPublicURL(origin, { cache: dnsCache });
    } catch {
      skippedSsrf += 1;
      continue;
    }

    let robotsBody = "";

    try {
      const robots = await fetchPublicText(`${origin}/robots.txt`, {
        cache: dnsCache,
        accept: "text/plain,*/*;q=0.1",
      });
      robotsBody = robots.body;
    } catch {
      robotsBody = "";
    }

    if (!robotsAllowsPath(robotsBody, "/", USER_AGENT)) {
      skippedRobots += 1;
      continue;
    }

    allowed.push(origin);
  }

  return { listed, allowed, skippedRobots, skippedSsrf };
}

/**
 * @param {string[]} allowed
 * @param {Map<string, unknown>} dnsCache
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function harvestOrigins(allowed, dnsCache) {
  const records = [];

  for (const origin of allowed) {
    const folder = originFolder(origin);
    await fs.mkdir(folder, { recursive: true });

    try {
      const home = await fetchPublicText(`${origin}/`, { cache: dnsCache });
      await fs.writeFile(path.join(folder, "home.html"), home.body, "utf8");
      const feeds = advertisedFeeds(home.body, origin);
      const savedFeeds = [];

      for (const [index, feed] of feeds.entries()) {
        try {
          const fetched = await fetchPublicText(feed.url, {
            cache: dnsCache,
            accept: FEED_ACCEPT,
          });
          const file = `feed-${index}.txt`;
          await fs.writeFile(path.join(folder, file), fetched.body, "utf8");
          savedFeeds.push({
            url: feed.url,
            type: feed.type,
            file,
            contentType: fetched.contentType,
          });
        } catch {
          continue;
        }
      }

      const title =
        parseHtmlRegions(home.body).title || new URL(origin).hostname;
      const meta = { origin, title, feeds: savedFeeds };
      await writeJSONAtomic(path.join(folder, "meta.json"), meta);
      records.push(meta);
    } catch {
      continue;
    }
  }

  return records;
}

/**
 * @param {Record<string, unknown>} meta
 * @param {string} now
 * @returns {Promise<{
 *   origin: string,
 *   title: string,
 *   domain: string,
 *   pageRecords: Array<Record<string, unknown>>,
 *   outbound: Array<Record<string, unknown>>,
 *   declared_topics: Array<Record<string, unknown>>,
 *   subject_signals: Array<Record<string, unknown>>,
 *   contentDrafts: Array<Record<string, unknown>>,
 * } | null>}
 */
async function parseHarvestedOrigin(meta, now) {
  if (!meta || typeof meta.origin !== "string") {
    return null;
  }

  const origin = meta.origin;
  const folder = originFolder(origin);
  const html = await fs
    .readFile(path.join(folder, "home.html"), "utf8")
    .catch(() => "");

  if (!html) {
    return null;
  }

  const pageUrl = `${origin}/`;
  const regions = parseHtmlRegions(html);
  const role = classifyPageRole(pageUrl, { title: regions.title });
  const noindex = Boolean(regions.noindex);
  const pageRecords = [
    {
      url: pageUrl,
      title: regions.title || meta.title || "",
      page_role: role,
      noindex,
      lang: regions.lang || "",
    },
  ];
  const htmlSubjects = allowsCommunityTopics(role, { noindex })
    ? subjectsFromHtml(html, pageUrl, { observedAt: now, allowCommunity: true })
    : [];
  const portfolio = collectPortfolio([{ url: pageUrl, html }], {
    siteOrigin: origin,
    observedAt: now,
  });
  htmlSubjects.push(...portfolio.subjects);
  const nlpPages =
    allowsHeuristicTopics(role, { noindex }) && isEnglishLanguage(regions.lang)
      ? [
          {
            url: pageUrl,
            title: regions.title || "",
            text: regions.textForTopics,
          },
        ]
      : [];
  const nlpSubjects = extractTopicsFromPages(nlpPages, {
    observedAt: now,
    minCount: 2,
  });
  const subjects = mergeSubjects(nlpSubjects, htmlSubjects, portfolio.subjects);
  const split = splitDeclaredAndSignals(subjects);
  const declared_topics = split.declared_topics;
  const subject_signals = split.subject_signals.filter(
    (signal) =>
      !(
        signal.evidence_class === "heuristic" &&
        isSensitiveHeuristicSlug(String(signal.slug || ""))
      ),
  );
  const outbound = (regions.links || []).map((link) => ({
    href: link.href,
    text: link.text,
    rel: link.rel || [],
    classNames: link.classNames || [],
    page: pageUrl,
  }));
  const contentDrafts = [...portfolio.items];

  for (const feed of meta.feeds || []) {
    if (!feed || typeof feed.file !== "string") {
      continue;
    }

    const body = await fs
      .readFile(path.join(folder, feed.file), "utf8")
      .catch(() => "");

    if (!body) {
      continue;
    }

    const kind = String(feed.type || "").toLowerCase();
    const feedUrl = typeof feed.url === "string" ? feed.url : `${origin}/feed`;
    try {
      const items =
        kind.includes("json") || String(feed.contentType || "").includes("json")
          ? contentItemsFromJsonFeed(body, {
              feedUrl,
              siteOrigin: origin,
              observedAt: now,
            })
          : contentItemsFromRssOrAtom(body, {
              feedUrl,
              feedKind: kind.includes("atom") ? "atom" : "rss",
              siteOrigin: origin,
              observedAt: now,
            });
      contentDrafts.push(...items);
    } catch {
      continue;
    }
  }

  let domain = "";

  try {
    domain = new URL(origin).hostname;
  } catch {
    domain = String(meta.title || origin);
  }

  return {
    origin,
    title: regions.title || meta.title || domain,
    domain,
    pageRecords,
    outbound,
    declared_topics,
    subject_signals,
    contentDrafts,
  };
}

/**
 * @param {Array<Awaited<ReturnType<typeof parseHarvestedOrigin>>>} parsed
 * @param {string} now
 * @param {Map<string, string>} aliases
 * @param {Set<string>} denylist
 * @returns {Promise<{
 *   network: unknown,
 *   signalsDoc: Record<string, unknown>,
 *   contentDoc: Record<string, unknown>,
 *   topicsDoc: Record<string, unknown>,
 *   connectionsDoc: Record<string, unknown>,
 *   blogrollsDoc: Record<string, unknown>,
 *   manifest: Record<string, unknown>,
 *   members: number,
 *   items: number,
 *   communities: number,
 *   edges: number,
 * }>}
 */
async function writeSyntheticGraph(parsed, now, aliases, denylist) {
  const members = parsed.filter(Boolean);
  const network = members.map((entry) => ({
    origin: entry.origin,
    domain: entry.domain,
    title: entry.title,
    identity: "undeclared",
  }));
  const participantOrigins = new Set(members.map((entry) => entry.origin));
  const originSignals = members.map((entry) => ({
    origin: entry.origin,
    crawled_at: now,
    coverage: {
      pages_discovered: 1,
      pages_fetched: 1,
      fetch_limit: 1,
      limit_reached: false,
      selection_strategy: "bounded-site-crawl-v1",
    },
    pages: entry.pageRecords,
    declared_topics: entry.declared_topics,
    subject_signals: entry.subject_signals,
    subjects: legacySubjectsFromSignals(entry.subject_signals),
    outbound_links: entry.outbound,
    community_slugs: [],
    stats: {
      pages_fetched: 1,
      declared_topic_count: entry.declared_topics.length,
      subject_signal_count: entry.subject_signals.length,
      outbound_link_count: entry.outbound.length,
    },
  }));
  const communityOrigins = members.map((entry) => ({
    origin: entry.origin,
    title: entry.title,
    domain: entry.domain,
    declared_topics: entry.declared_topics,
    subject_signals: entry.subject_signals,
  }));
  const contentDrafts = members.flatMap((entry) => entry.contentDrafts);
  const draftItems = mergeContentItems(contentDrafts);
  const catalog = networkCatalog(communityOrigins, draftItems);
  const matchedOrigins = applyCatalogMatches(
    communityOrigins,
    draftItems,
    catalog,
    { observedAt: now },
  );
  const { communities } = buildTopicCommunities(matchedOrigins, {
    aliases,
    denylist,
    previousTopics: [],
    now,
  });
  const communitySlugSet = new Set(communities.map((topic) => topic.slug));

  for (const signal of originSignals) {
    const matched = matchedOrigins.find(
      (entry) => entry.origin === signal.origin,
    );

    if (matched) {
      signal.subject_signals = matched.subject_signals;
      signal.subjects = legacySubjectsFromSignals(
        matched.subject_signals || [],
      );
    }

    const declared = (signal.declared_topics || [])
      .map((topic) => topic.slug)
      .filter((slug) => communitySlugSet.has(slug));
    const heuristic = (signal.subject_signals || [])
      .filter(
        (topic) =>
          topic.evidence_class === "heuristic" &&
          topic.community_eligible === true &&
          communitySlugSet.has(topic.slug),
      )
      .map((topic) => topic.slug);
    signal.community_slugs = [...new Set([...declared, ...heuristic])].sort();
  }

  const contentItems = joinContentWithPageSignals(draftItems, originSignals);
  const connections = aggregateConnectionEdges([
    ...members.flatMap((entry) =>
      connectionObservations({
        sourceOrigin: entry.origin,
        pageUrl: `${entry.origin}/`,
        links: entry.outbound,
        participantOrigins,
      }),
    ),
  ]);
  const dataDir = path.join(SCALE_ROOT, "_data");
  await fs.mkdir(dataDir, { recursive: true });
  const topicsDoc = sparseCollectionDocument({
    generatedAt: now,
    key: "communities",
    items: communities,
    extra: {
      community_count: communities.length,
      membership_rule:
        "Public topics require at least one current participating origin with qualifying declared or heuristic evidence, and topic pages only list members that have matching articles.",
    },
  });
  const connectionsDoc = sparseCollectionDocument({
    generatedAt: now,
    key: "edges",
    items: connections,
    extra: { edge_count: connections.length },
  });
  const contentDoc = sparseCollectionDocument({
    generatedAt: now,
    key: "items",
    items: contentItems,
    extra: { item_count: contentItems.length },
  });
  const signalsDoc = {
    schema_version: 1,
    generated_at: now,
    origins: originSignals,
  };
  const blogrollsDoc = sparseCollectionDocument({
    generatedAt: now,
    key: "edges",
    items: [],
    extra: { edge_count: 0 },
  });
  const hashes = {
    network: semanticHash(network),
    site_signals: semanticHash(signalsDoc),
    content: semanticHash(contentDoc),
    topics: semanticHash(topicsDoc),
    connections: semanticHash(connectionsDoc),
    blogrolls: semanticHash(blogrollsDoc),
  };
  const manifest = buildDataManifest({ generatedAt: now, hashes });

  await writeJSONAtomic(path.join(dataDir, "network.json"), network);
  await writeJSONAtomic(path.join(dataDir, "site_signals.json"), signalsDoc);
  await writeJSONAtomic(path.join(dataDir, "content.json"), contentDoc);
  await writeJSONAtomic(path.join(dataDir, "topics.json"), topicsDoc);
  await writeJSONAtomic(path.join(dataDir, "connections.json"), connectionsDoc);
  await writeJSONAtomic(path.join(dataDir, "blogrolls.json"), blogrollsDoc);
  await writeJSONAtomic(path.join(dataDir, "data_manifest.json"), manifest);
  await buildViewProjections(SCALE_ROOT);

  return {
    network,
    signalsDoc,
    contentDoc,
    topicsDoc,
    connectionsDoc,
    blogrollsDoc,
    manifest,
    members: members.length,
    items: contentItems.length,
    communities: communities.length,
    edges: connections.length,
  };
}

/**
 * @param {Record<string, unknown>} graph
 */
async function validateGraph(graph) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validators = {};

  for (const [name, fileName] of Object.entries(SCHEMA_FILES)) {
    const schema = JSON.parse(
      await fs.readFile(path.join(ROOT, "schemas", fileName), "utf8"),
    );
    validators[name] = ajv.compile(schema);
  }

  assertSchema("network", graph.network, validators.network);
  assertSchema("site_signals", graph.signalsDoc, validators.site_signals);
  assertSchema("content", graph.contentDoc, validators.content);
  assertSchema("topics", graph.topicsDoc, validators.topics);
  assertSchema("connections", graph.connectionsDoc, validators.connections);
  assertSchema("blogrolls", graph.blogrollsDoc, validators.blogrolls);
  assertSchema("data_manifest", graph.manifest, validators.data_manifest);
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const argv = process.argv.slice(2);
  const runs = Math.max(
    1,
    Number.parseInt(flagValue(argv, "--runs", String(DEFAULT_RUNS)), 10) ||
      DEFAULT_RUNS,
  );
  const seed = Number.parseInt(
    flagValue(argv, "--seed", String(DEFAULT_SEED)),
    10,
  );
  const replayOnly = argv.includes("--replay-only");
  const forceHarvest = argv.includes("--harvest");
  const dnsCache = new Map();
  const started = Date.now();
  const manifestPath = path.join(HARVEST_DIR, "manifest.json");
  let manifest = await readJSONIfExists(manifestPath, null);

  if (replayOnly) {
    if (
      !manifest ||
      !Array.isArray(manifest.records) ||
      !manifest.records.length
    ) {
      throw new Error(
        "replay-only requires an existing harvest at .tmp/scale-harvest",
      );
    }
  } else if (forceHarvest || !manifest) {
    const listed = await listAllowedOrigins(dnsCache);
    process.stdout.write(
      `listed=${listed.listed.length} allowed=${listed.allowed.length} skipped_robots=${listed.skippedRobots} skipped_ssrf=${listed.skippedSsrf}\n`,
    );
    const records = await harvestOrigins(listed.allowed, dnsCache);
    manifest = {
      listed: listed.listed.length,
      allowed: listed.allowed.length,
      harvested: records.length,
      skipped_robots: listed.skippedRobots,
      skipped_ssrf: listed.skippedSsrf,
      records,
    };
    await fs.mkdir(HARVEST_DIR, { recursive: true });
    await writeJSONAtomic(manifestPath, manifest);
  }

  const records = Array.isArray(manifest.records) ? manifest.records : [];

  if (records.length === 0) {
    throw new Error("no harvested member sites; listing is empty");
  }

  const aliases = loadAliasMap(
    await readJSONIfExists(path.join(ROOT, "_data", "topic_aliases.json"), {
      aliases: [],
    }),
  );
  const denylist = loadDenylist(
    await readJSONIfExists(path.join(ROOT, "_data", "topic_denylist.json"), {
      entries: [],
    }),
  );
  const now = new Date().toISOString();
  const parsed = [];
  const auditIssues = [];

  for (const meta of records) {
    const originParse = await parseHarvestedOrigin(meta, now);
    parsed.push(originParse);

    if (!originParse) {
      continue;
    }

    const audit = auditParsedOrigin(originParse);

    if (!audit.ok) {
      auditIssues.push(...audit.issues);
      process.stdout.write(
        `audit fail ${originParse.origin}: ${audit.issues
          .map((issue) => `${issue.slug}:${issue.reason}`)
          .slice(0, 8)
          .join(", ")}\n`,
      );
    }
  }

  if (auditIssues.length > 0) {
    await writeJSONAtomic(path.join(HARVEST_DIR, "audit.json"), {
      fail_count: auditIssues.length,
      issues: auditIssues.slice(0, 500),
    });
    throw new Error(
      `visitor-facing topic audit failed for ${auditIssues.length} labels`,
    );
  }

  const graph = await writeSyntheticGraph(parsed, now, aliases, denylist);
  await validateGraph(graph);
  process.stdout.write(
    `members=${graph.members} items=${graph.items} communities=${graph.communities} edges=${graph.edges}\n`,
  );

  const order = shuffle(
    records,
    mulberry32(Number.isNaN(seed) ? DEFAULT_SEED : seed),
  );
  let parses = 0;

  for (let run = 0; run < runs; run += 1) {
    const meta = order[run % order.length];
    const again = await parseHarvestedOrigin(meta, now);

    if (!again) {
      continue;
    }

    const slot = parsed.findIndex(
      (entry) => entry && entry.origin === again.origin,
    );

    if (slot >= 0) {
      parsed[slot] = again;
    }

    parses += 1;

    if ((run + 1) % order.length === 0) {
      const rebuilt = await writeSyntheticGraph(parsed, now, aliases, denylist);
      await validateGraph(rebuilt);
    }
  }

  process.stdout.write(
    `replay_parses=${parses} runs=${runs} listed_members=${records.length} ms=${Date.now() - started} scale-probe ok\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack || error.message : error}\n`,
  );
  process.exitCode = 1;
});
