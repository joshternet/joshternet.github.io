/**
 * Goal & Constraints:
 * Full-site crawl + evidence-aware topic/content/connection rebuild.
 * Catalog lexicon from the richest publisher (joshuamorris.info when present)
 * is matched onto other members, including sites without structured metadata.
 * One-way pipeline: derived hub pages never become semantic evidence.
 * Does not commit. Semantic hash skips timestamp-only churn when unchanged.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  HUB_ORIGIN,
  aggregateConnectionEdges,
  blogrollConnectionObservations,
  hasDerivedAnalysisMarker,
  isHubDirectoryPage,
} from "../network/connections.mjs";
import {
  itemsFromCollection,
  sparseCollectionDocument,
} from "../network/collections.mjs";
import { buildViewProjections } from "../views/build.mjs";
import {
  applyCatalogMatches,
  mergeCatalogs,
  selectCatalogOrigin,
} from "./catalog.mjs";
import {
  buildTopicCommunities,
  loadAliasMap,
  loadDenylist,
  topicCollectionMarkdown,
} from "./communities.mjs";
import {
  contentItemsFromJsonFeed,
  contentItemsFromRssOrAtom,
  joinContentWithPageSignals,
  mergeContentItems,
} from "./content.mjs";
import { crawlOrigin } from "./crawl.mjs";
import {
  isSensitiveHeuristicSlug,
  legacySubjectsFromSignals,
} from "./evidence.mjs";
import { extractTopicsFromPages } from "./extract.mjs";
import { subjectsFromFeeds } from "./feeds.mjs";
import {
  MAX_PAGES_PER_ORIGIN,
  fetchPublicText,
  readJSONIfExists,
  writeJSONAtomic,
  writeTextAtomic,
} from "./lib.mjs";
import { collectPortfolio } from "./portfolio.mjs";
import {
  allowsCommunityTopics,
  allowsHeuristicTopics,
  classifyPageRole,
} from "./page-role.mjs";
import {
  buildDataManifest,
  semanticHash,
  shouldPublishSemanticChange,
} from "./publish.mjs";
import {
  buildAllConnections,
  mergeSubjects,
  splitDeclaredAndSignals,
  subjectsFromHtml,
} from "./subjects.mjs";
import { isEnglishLanguage, parseHtmlRegions } from "./text.mjs";

/**
 * Topic and relationship evidence must come from public information Joshternet
 * directly observes on participating sites or from Joshternet-owned data.
 * External semantic-enrichment providers require an explicit architectural
 * decision and must not be added incidentally. Joshternet infrastructure
 * choices do not constrain technologies used by independent participating sites.
 */

const ROOT = process.cwd();
const NETWORK_PATH = path.join(ROOT, "_data/network.json");
const CONNECTIONS_PATH = path.join(ROOT, "_data/connections.json");
const SIGNALS_PATH = path.join(ROOT, "_data/site_signals.json");
const TOPICS_PATH = path.join(ROOT, "_data/topics.json");
const CONTENT_PATH = path.join(ROOT, "_data/content.json");
const BLOGROLLS_PATH = path.join(ROOT, "_data/blogrolls.json");
const MANIFEST_PATH = path.join(ROOT, "_data/data_manifest.json");
const ALIASES_PATH = path.join(ROOT, "_data/topic_aliases.json");
const DENYLIST_PATH = path.join(ROOT, "_data/topic_denylist.json");
const TOPICS_DIR = path.join(ROOT, "topics");
const CANDIDATES_DIR = path.join(ROOT, ".tmp");
const CANDIDATES_PATH = path.join(CANDIDATES_DIR, "topic_candidates.json");
const SITE_URL = "https://joshternet.org";

/**
 * @returns {Promise<void>}
 */
async function main() {
  const network = await readJSONIfExists(NETWORK_PATH, []);
  const aliases = loadAliasMap(
    await readJSONIfExists(ALIASES_PATH, { aliases: [] }),
  );
  const denylist = loadDenylist(
    await readJSONIfExists(DENYLIST_PATH, { entries: [] }),
  );
  const previousTopics = itemsFromCollection(
    await readJSONIfExists(TOPICS_PATH, {}),
    "communities",
  );
  const previousManifest = await readJSONIfExists(MANIFEST_PATH, null);
  const now = new Date().toISOString();

  if (!Array.isArray(network) || network.length === 0) {
    process.stderr.write(
      "No network participants found; writing empty outputs.\n",
    );
    await writeJSONAtomic(SIGNALS_PATH, {
      schema_version: 1,
      generated_at: now,
      origins: [],
      coverage: {
        pages_discovered: 0,
        pages_fetched: 0,
        fetch_limit: 40,
        limit_reached: false,
        selection_strategy: "bounded-site-crawl-v1",
      },
    });
    await writeJSONAtomic(
      TOPICS_PATH,
      sparseCollectionDocument({
        generatedAt: now,
        key: "communities",
        items: [],
        extra: {
          community_count: 0,
          membership_rule:
            "Public topics require at least one current participating origin with qualifying declared or heuristic evidence, and topic pages only list members that have matching articles.",
        },
      }),
    );
    await writeJSONAtomic(
      CONNECTIONS_PATH,
      sparseCollectionDocument({
        generatedAt: now,
        key: "edges",
        items: [],
        extra: {
          edge_count: 0,
        },
      }),
    );
    await writeJSONAtomic(
      CONTENT_PATH,
      sparseCollectionDocument({
        generatedAt: now,
        key: "items",
        items: [],
        extra: {
          item_count: 0,
        },
      }),
    );
    await buildViewProjections();
    return;
  }

  const dnsCache = new Map();
  const participantOrigins = new Set(
    network
      .map((entry) =>
        entry && typeof entry.origin === "string" ? entry.origin : "",
      )
      .filter(Boolean),
  );

  /** @type {Array<Record<string, unknown>>} */
  const originSignals = [];
  /** @type {Array<{origin: string, links: Array<Record<string, unknown>>}>} */
  const originLinks = [];
  /** @type {Array<Record<string, unknown>>} */
  const communityOrigins = [];
  /** @type {Array<Record<string, unknown>>} */
  const contentDrafts = [];

  for (const participant of network) {
    if (!participant || typeof participant.origin !== "string") {
      continue;
    }

    const origin = participant.origin;
    process.stdout.write(`nlp crawl ${origin}\n`);

    try {
      const feeds = Array.isArray(participant.feeds) ? participant.feeds : [];
      const feedData = await subjectsFromFeeds(feeds, dnsCache, {
        observedAt: now,
      });
      const crawled = await crawlOrigin(origin, {
        cache: dnsCache,
        feedEntryUrls: feedData.entryUrls,
      });

      /** @type {Array<Record<string, unknown>>} */
      const pageRecords = [];
      /** @type {Array<Record<string, unknown>>} */
      const htmlSubjects = [];
      /** @type {Array<{url: string, title: string, text: string}>} */
      const nlpPages = [];
      /** @type {Array<{url: string, html: string}>} */
      const portfolioPages = [];
      const outbound = [];
      let discovered = crawled.pages.length;
      const descriptions = [];
      const locales = new Set();
      const schemaTypes = new Set();

      for (const page of crawled.pages) {
        const regions = {
          title: page.title,
          textForTopics: page.text,
          links: page.links || [],
          noindex: false,
          derived: false,
          lang: "",
        };

        // Re-parse raw body when available on crawl result
        if (typeof page.html === "string" && page.html) {
          Object.assign(regions, parseHtmlRegions(page.html));
        }

        if (origin === HUB_ORIGIN && isHubDirectoryPage(page.url)) {
          continue;
        }

        if (regions.derived || hasDerivedAnalysisMarker(page.html || "")) {
          continue;
        }

        const role = classifyPageRole(page.url, {
          title: regions.title || page.title,
          derived: regions.derived,
        });
        const noindex = Boolean(regions.noindex);

        pageRecords.push({
          url: page.url,
          title: regions.title || page.title,
          page_role: role,
          noindex,
          lang: regions.lang || "",
        });

        if (regions.lang) {
          locales.add(regions.lang);
        }

        if (allowsCommunityTopics(role, { noindex })) {
          htmlSubjects.push(
            ...subjectsFromHtml(page.html || "", page.url, {
              observedAt: now,
              allowCommunity: true,
            }),
          );
        }

        if (
          role === "portfolio" &&
          typeof page.html === "string" &&
          page.html
        ) {
          portfolioPages.push({ url: page.url, html: page.html });
        }

        if (
          allowsHeuristicTopics(role, { noindex }) &&
          isEnglishLanguage(regions.lang)
        ) {
          nlpPages.push({
            url: page.url,
            title: regions.title || page.title,
            text: regions.textForTopics || page.text,
          });
        }

        for (const link of regions.links.length
          ? regions.links
          : page.links || []) {
          outbound.push({
            href: link.href,
            text: link.text,
            rel: link.rel || [],
            classNames: link.classNames || [],
            page: page.url,
          });
        }
      }

      const portfolio = collectPortfolio(portfolioPages, {
        siteOrigin: origin,
        observedAt: now,
      });
      htmlSubjects.push(...portfolio.subjects);
      contentDrafts.push(...portfolio.items);

      const nlpSubjects = extractTopicsFromPages(nlpPages, {
        observedAt: now,
        minCount: 2,
      });
      const subjects = mergeSubjects(
        nlpSubjects,
        feedData.subjects,
        htmlSubjects,
      );
      const split = splitDeclaredAndSignals(subjects);
      const declared_topics = split.declared_topics;
      const subject_signals = split.subject_signals.filter(
        (signal) =>
          !(
            signal.evidence_class === "heuristic" &&
            isSensitiveHeuristicSlug(String(signal.slug || ""))
          ),
      );

      for (const feed of feeds.slice(0, 3)) {
        if (!feed || typeof feed.url !== "string") {
          continue;
        }

        try {
          const fetched = await fetchPublicText(feed.url, {
            cache: dnsCache,
            accept:
              "application/feed+json, application/json, application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.1",
          });
          const kind = String(feed.type || "").toLowerCase();
          let drafts = [];

          if (kind.includes("json") || fetched.contentType.includes("json")) {
            drafts = contentItemsFromJsonFeed(fetched.body, {
              feedUrl: fetched.url,
              siteOrigin: origin,
              observedAt: now,
            });
          } else {
            drafts = contentItemsFromRssOrAtom(fetched.body, {
              feedUrl: fetched.url,
              feedKind: kind.includes("atom") ? "atom" : "rss",
              siteOrigin: origin,
              observedAt: now,
            });
          }

          contentDrafts.push(...drafts);
        } catch (error) {
          process.stderr.write(
            `content feed failed ${origin} (${feed.url}): ${error instanceof Error ? error.message : error}\n`,
          );
        }
      }

      const coverage = {
        pages_discovered: discovered,
        pages_fetched: crawled.pages.length,
        fetch_limit: MAX_PAGES_PER_ORIGIN,
        limit_reached: crawled.pages.length >= MAX_PAGES_PER_ORIGIN,
        selection_strategy: "bounded-site-crawl-v1",
      };

      originSignals.push({
        origin,
        crawled_at: now,
        coverage,
        pages: pageRecords,
        declared_topics,
        subject_signals,
        subjects: legacySubjectsFromSignals(subject_signals),
        descriptions,
        locales: [...locales].sort(),
        schema_types: [...schemaTypes].sort(),
        content_types: [],
        outbound_links: outbound,
        community_slugs: [],
        ...(portfolio.profile ? { portfolio: portfolio.profile } : {}),
        stats: {
          pages_fetched: crawled.pages.length,
          declared_topic_count: declared_topics.length,
          subject_signal_count: subject_signals.length,
          outbound_link_count: outbound.length,
        },
      });
      originLinks.push({ origin, links: outbound });
      communityOrigins.push({
        origin,
        title: participant.title || participant.domain || origin,
        domain: participant.domain || new URL(origin).hostname,
        declared_topics,
        subject_signals,
      });
      process.stdout.write(
        `nlp ok ${origin}: ${crawled.pages.length} pages, ${declared_topics.length} declared, ${subject_signals.length} signals\n`,
      );
    } catch (error) {
      process.stderr.write(
        `nlp failed ${origin}: ${error instanceof Error ? error.message : error}\n`,
      );
      originSignals.push({
        origin,
        crawled_at: now,
        coverage: {
          pages_discovered: 0,
          pages_fetched: 0,
          fetch_limit: MAX_PAGES_PER_ORIGIN,
          limit_reached: false,
          selection_strategy: "bounded-site-crawl-v1",
        },
        pages: [],
        declared_topics: [],
        subject_signals: [],
        subjects: [],
        outbound_links: [],
        community_slugs: [],
        stats: {},
        error: error instanceof Error ? error.message : String(error),
      });
      originLinks.push({ origin, links: [] });
      communityOrigins.push({
        origin,
        title: participant.title || participant.domain || origin,
        domain: participant.domain || "",
        declared_topics: [],
        subject_signals: [],
      });
    }
  }

  const draftItems = mergeContentItems(contentDrafts);
  const catalogOrigin = selectCatalogOrigin(communityOrigins);
  const catalog = mergeCatalogs(communityOrigins, draftItems, catalogOrigin);
  const matchedOrigins = applyCatalogMatches(
    communityOrigins,
    draftItems,
    catalog,
    { observedAt: now },
  );

  const { communities, candidates } = buildTopicCommunities(matchedOrigins, {
    aliases,
    denylist,
    previousTopics: Array.isArray(previousTopics) ? previousTopics : [],
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
  const previousConnections = itemsFromCollection(
    await readJSONIfExists(CONNECTIONS_PATH, {}),
    "edges",
  );
  const preservedEdges = Array.isArray(previousConnections)
    ? previousConnections.filter((edge) => {
        if (!edge || typeof edge !== "object") {
          return false;
        }

        const relation = edge.relation || edge.kind || "";

        if (
          relation === "friend" ||
          relation === "topic" ||
          relation === "link"
        ) {
          // Only preserve observed homepage/content links from legacy link.
          if (relation !== "link") {
            return false;
          }
        }

        if (
          relation !== "homepage-link" &&
          relation !== "content-link" &&
          relation !== "link" &&
          relation !== "blogroll" &&
          relation !== "reply-to" &&
          relation !== "repost-of" &&
          relation !== "syndication"
        ) {
          return false;
        }

        if (typeof edge.href !== "string" || !edge.href) {
          return false;
        }

        if (String(edge.href).includes("/.well-known/josh")) {
          return false;
        }

        const page = typeof edge.page === "string" ? edge.page : "";
        return !isHubDirectoryPage(page);
      })
    : [];

  const connections = aggregateConnectionEdges([
    ...preservedEdges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      relation:
        edge.relation ||
        (edge.kind === "link" ? "content-link" : edge.kind) ||
        "content-link",
      directed: true,
      ...(typeof edge.via === "string" && edge.via ? { via: edge.via } : {}),
      source: edge.source || "content",
      href: edge.href,
      text: edge.text || "",
      rel: edge.rel || [],
      page: edge.page,
      evidence: edge.evidence,
    })),
    ...buildAllConnections({
      participantOrigins,
      originLinks,
      blogrollEdges: blogrollConnectionObservations(
        itemsFromCollection(
          await readJSONIfExists(BLOGROLLS_PATH, {}),
          "edges",
        ),
      ),
    }),
  ]);

  const deduped = connections.filter(
    (edge) => !(edge.from === HUB_ORIGIN && isHubDirectoryPage(edge.page)),
  );

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
    items: deduped,
    extra: {
      edge_count: deduped.length,
    },
  });
  const contentDoc = sparseCollectionDocument({
    generatedAt: now,
    key: "items",
    items: contentItems,
    extra: {
      item_count: contentItems.length,
    },
  });
  const signalsDoc = {
    schema_version: 1,
    generated_at: now,
    origins: originSignals,
  };
  const hashes = {
    network: semanticHash(await readJSONIfExists(NETWORK_PATH, [])),
    site_signals: semanticHash(signalsDoc),
    topics: semanticHash(topicsDoc),
    connections: semanticHash(connectionsDoc),
    content: semanticHash(contentDoc),
    blogrolls: semanticHash(await readJSONIfExists(BLOGROLLS_PATH, {})),
  };
  const previousHashes =
    previousManifest && typeof previousManifest === "object"
      ? previousManifest.semantic_hashes || {}
      : {};
  const changed = Object.keys(hashes).some((key) =>
    shouldPublishSemanticChange(previousHashes[key], hashes[key]),
  );

  await fs.mkdir(CANDIDATES_DIR, { recursive: true });
  await writeJSONAtomic(CANDIDATES_PATH, {
    generated_at: now,
    candidates,
  });

  if (!changed && previousManifest) {
    process.stdout.write(
      "Semantic hash unchanged; leaving committed public artifacts untouched.\n",
    );
    await buildViewProjections();
    return;
  }

  await writeJSONAtomic(SIGNALS_PATH, signalsDoc);
  await writeJSONAtomic(TOPICS_PATH, topicsDoc);
  await writeJSONAtomic(CONNECTIONS_PATH, connectionsDoc);
  await writeJSONAtomic(CONTENT_PATH, contentDoc);
  await writeJSONAtomic(
    MANIFEST_PATH,
    buildDataManifest({ generatedAt: now, hashes }),
  );

  await fs.mkdir(TOPICS_DIR, { recursive: true });
  const existing = await fs.readdir(TOPICS_DIR).catch(() => []);
  const desired = new Set(communities.map((topic) => `${topic.slug}.md`));

  for (const file of existing) {
    if (file === "index.md") {
      continue;
    }

    if (file.endsWith(".md") && !desired.has(file)) {
      await fs.unlink(path.join(TOPICS_DIR, file));
    }
  }

  for (const topic of communities) {
    await writeTextAtomic(
      path.join(TOPICS_DIR, `${topic.slug}.md`),
      topicCollectionMarkdown(topic),
    );
  }

  await buildViewProjections();

  process.stdout.write(
    `Wrote signals for ${originSignals.length} origins, ${communities.length} communities, ${contentItems.length} content items, ${deduped.length} connections.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
