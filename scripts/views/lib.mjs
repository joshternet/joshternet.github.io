/**
 * Goal & Constraints:
 * Deterministic UI projections from canonical graph data. Never invent
 * communities, directed connections, scores, or friendship. Shared topics
 * on /connections/ are neighborhood overlaps, not connections.json edges.
 * Public neighborhoods come only from topics.communities. Visitor copy never
 * includes tfidf-v1.
 */

import { itemsFromCollection } from "../network/collections.mjs";
import { isNonSubjectSlug } from "../nlp/evidence.mjs";
import { itemMentionsTopic, textMentionsSlug } from "../nlp/match.mjs";

export { itemMentionsTopic, textMentionsSlug };

export const RELATION_LABELS = {
  "content-link": "linked to",
  "homepage-link": "links to from the homepage",
  blogroll: "includes in a blogroll",
  "reply-to": "replied to",
  "repost-of": "reposted",
  syndication: "syndicated to",
};

/** Pair overlays on /connections/; evidence stays in connections.json. */
export const MAX_CONNECTION_TOPIC_PAIRS = 400;

/** Topic co-occurrence chips on topic views. */
export const MAX_COOCCURRENCE_PAIRS = 200;

/** Search documents (sites + topics + content). */
export const MAX_SEARCH_INDEX_DOCUMENTS = 2500;

/**
 * Truncates a presentation list. Does not drop canonical graph evidence.
 * @template T
 * @param {T[]} list
 * @param {number} max
 * @returns {T[]}
 */
export function capPresentationList(list, max) {
  const rows = Array.isArray(list) ? list : [];
  const limit = Number(max);

  if (!Number.isFinite(limit) || limit < 0 || rows.length <= limit) {
    return rows;
  }

  return rows.slice(0, limit);
}

export const SOURCE_LABELS = {
  "microformat:p-category": "Microformats category",
  "rss:category": "RSS category",
  "atom:category": "Atom category",
  "json-feed:tag": "JSON Feed tag",
  "article:tag": "Article tag",
  "article:section": "Article section",
  "meta:keywords": "Keywords",
  "schema:keywords": "Schema keywords",
  "topic-hub:link": "Topic directory",
  "topic-hub:page": "Topic directory",
  "portfolio:index": "Online portfolio",
  "portfolio:sector": "Portfolio sector",
  "catalog-match": "Related writing",
  "visible-text": "Published content",
  nlp: "Published content",
};

/**
 * Visitor-facing relation phrase. Unknown types fall back to the raw token.
 * @param {string} relation
 * @returns {string}
 */
export function relationLabel(relation) {
  if (typeof relation !== "string" || !relation) {
    return "linked to";
  }

  return RELATION_LABELS[relation] || relation;
}

/**
 * Visitor-facing evidence source. Never returns extractor internals.
 * @param {string} source
 * @returns {string}
 */
export function sourceLabel(source) {
  if (typeof source !== "string" || !source) {
    return "Topic evidence";
  }

  if (SOURCE_LABELS[source]) {
    return SOURCE_LABELS[source];
  }

  if (
    source.includes("tfidf") ||
    source === "visible-text" ||
    source === "nlp"
  ) {
    return "Published content";
  }

  return source.replace(/[_:]+/g, " ");
}

/**
 * @param {unknown} topicsDoc
 * @returns {Array<Record<string, unknown>>}
 */
export function publicCommunities(topicsDoc) {
  return itemsFromCollection(topicsDoc, "communities").filter(
    (item) =>
      item &&
      typeof item.slug === "string" &&
      item.slug &&
      !isNonSubjectSlug(item.slug) &&
      Array.isArray(item.sites) &&
      (item.sites.length >= 2 ||
        item.sites.some((site) => site && site.membership === "declared")),
  );
}

/**
 * @param {Array<Record<string, unknown>>} communities
 * @returns {Set<string>}
 */
export function publicCommunitySlugSet(communities) {
  return new Set(communities.map((community) => String(community.slug)));
}

/**
 * @param {Array<Record<string, unknown>>} network
 * @returns {Map<string, Record<string, unknown>>}
 */
export function sitesByOrigin(network) {
  const map = new Map();

  for (const site of network || []) {
    if (site && typeof site.origin === "string" && site.origin) {
      map.set(site.origin, site);
    }
  }

  return map;
}

/**
 * Publisher tags on a content item. Neighborhoods are the subset that are
 * public communities.
 * @param {Record<string, unknown>} item
 * @param {Set<string>} publicSlugs
 * @returns {{ tags: Array<{slug: string, label: string}>, neighborhoods: Array<{slug: string, label: string}> }}
 */
export function contentTopicLabels(item, publicSlugs) {
  const tags = [];
  const seen = new Set();

  for (const topic of item?.declared_topics || []) {
    if (
      !topic ||
      topic.community_eligible !== true ||
      typeof topic.slug !== "string"
    ) {
      continue;
    }

    if (seen.has(topic.slug)) {
      continue;
    }

    seen.add(topic.slug);
    tags.push({
      slug: topic.slug,
      label:
        typeof topic.label === "string" && topic.label
          ? topic.label
          : topic.slug,
    });
  }

  return {
    tags,
    neighborhoods: tags.filter((topic) => publicSlugs.has(topic.slug)),
  };
}

/**
 * Compact content card for lists.
 * @param {Record<string, unknown>} item
 * @param {Map<string, Record<string, unknown>>} sites
 * @param {Set<string>} publicSlugs
 * @returns {Record<string, unknown> | null}
 */
export function compactContentItem(item, sites, publicSlugs) {
  if (!item || typeof item.url !== "string" || !item.url) {
    return null;
  }

  const origin = typeof item.site_origin === "string" ? item.site_origin : "";
  const site = origin ? sites.get(origin) : undefined;
  const labels = contentTopicLabels(item, publicSlugs);
  const image =
    typeof item.image === "string" && item.image.startsWith("https://")
      ? item.image
      : "";
  let imageOrigin = "";

  if (image) {
    try {
      imageOrigin = new URL(image).origin;
    } catch {
      imageOrigin = "";
    }
  }

  return {
    url: item.url,
    title: typeof item.title === "string" && item.title ? item.title : item.url,
    summary: typeof item.summary === "string" ? item.summary : "",
    published_at:
      typeof item.published_at === "string" ? item.published_at : "",
    content_type:
      typeof item.content_type === "string" ? item.content_type : "",
    language: typeof item.language === "string" ? item.language : "",
    site_origin: origin,
    site_title:
      (typeof site?.title === "string" && site.title) ||
      (typeof site?.domain === "string" && site.domain) ||
      origin,
    domain: typeof site?.domain === "string" ? site.domain : "",
    tags: labels.tags,
    neighborhoods: labels.neighborhoods,
    image,
    image_origin: imageOrigin,
  };
}

/**
 * True when published_at falls in the closed window ending at now.
 * @param {unknown} publishedAt
 * @param {Date | string} now
 * @param {number} [days]
 * @returns {boolean}
 */
export function publishedWithinDays(publishedAt, now, days = 7) {
  if (typeof publishedAt !== "string" || !publishedAt) {
    return false;
  }

  const published = Date.parse(publishedAt);
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now));

  if (!Number.isFinite(published) || !Number.isFinite(nowMs)) {
    return false;
  }

  const windowMs = days * 24 * 60 * 60 * 1000;

  return published <= nowMs && nowMs - published <= windowMs;
}

/**
 * One latest item per origin, then newest first.
 * @param {Array<Record<string, unknown>>} items
 * @returns {Array<Record<string, unknown>>}
 */
export function oneLatestPerOrigin(items) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byOrigin = new Map();

  for (const item of items || []) {
    if (!item || typeof item.site_origin !== "string" || !item.site_origin) {
      continue;
    }

    const published =
      typeof item.published_at === "string" ? item.published_at : "";
    const previous = byOrigin.get(item.site_origin);

    if (!previous) {
      byOrigin.set(item.site_origin, item);
      continue;
    }

    const previousPublished =
      typeof previous.published_at === "string" ? previous.published_at : "";

    if (
      published > previousPublished ||
      (published === previousPublished &&
        String(item.url || "") < String(previous.url || ""))
    ) {
      byOrigin.set(item.site_origin, item);
    }
  }

  return [...byOrigin.values()].sort((left, right) => {
    const date = String(right.published_at || "").localeCompare(
      String(left.published_at || ""),
    );

    if (date !== 0) {
      return date;
    }

    return String(left.site_origin).localeCompare(String(right.site_origin));
  });
}

/**
 * UTC-date rotation over alphabetically sorted community slugs.
 * @param {Array<Record<string, unknown>>} communities
 * @param {Date} [now]
 * @returns {Record<string, unknown> | null}
 */
export function pickFeaturedCommunity(communities, now = new Date()) {
  if (!Array.isArray(communities) || communities.length === 0) {
    return null;
  }

  const sorted = [...communities].sort((left, right) =>
    String(left.slug).localeCompare(String(right.slug)),
  );
  const day = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) /
      86_400_000,
  );

  return sorted[Math.abs(day) % sorted.length];
}

/**
 * First edge after stable from/to/relation sort.
 * @param {Array<Record<string, unknown>>} edges
 * @returns {Record<string, unknown> | null}
 */
export function pickFeaturedConnection(edges) {
  if (!Array.isArray(edges) || edges.length === 0) {
    return null;
  }

  const sorted = [...edges].sort((left, right) => {
    const from = String(left.from || "").localeCompare(
      String(right.from || ""),
    );

    if (from !== 0) {
      return from;
    }

    const to = String(left.to || "").localeCompare(String(right.to || ""));

    if (to !== 0) {
      return to;
    }

    return String(left.relation || "").localeCompare(
      String(right.relation || ""),
    );
  });

  return sorted[0];
}

/**
 * Publisher-declared co-occurrence among public community slugs.
 * @param {Array<Record<string, unknown>>} contentItems
 * @param {Set<string>} publicSlugs
 * @returns {Array<{left: string, right: string, content_count: number}>}
 */
export function topicCooccurrence(contentItems, publicSlugs) {
  /** @type {Map<string, number>} */
  const counts = new Map();

  for (const item of contentItems || []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const slugs = [
      ...new Set(
        (item.declared_topics || [])
          .filter(
            (topic) =>
              topic?.community_eligible === true &&
              typeof topic.slug === "string" &&
              publicSlugs.has(topic.slug),
          )
          .map((topic) => topic.slug),
      ),
    ].sort();

    for (let index = 0; index < slugs.length; index += 1) {
      for (let other = index + 1; other < slugs.length; other += 1) {
        const key = `${slugs[index]}\0${slugs[other]}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }

  const ranked = [...counts.entries()]
    .map(([key, content_count]) => {
      const [left, right] = key.split("\0");
      return { left, right, content_count };
    })
    .sort((a, b) => {
      const count = b.content_count - a.content_count;

      if (count !== 0) {
        return count;
      }

      return `${a.left}:${a.right}`.localeCompare(`${b.left}:${b.right}`);
    });

  return capPresentationList(ranked, MAX_COOCCURRENCE_PAIRS);
}

/**
 * Compact article row for shared-topic lists.
 * @param {unknown} item
 * @returns {{url: string, title: string} | null}
 */
function compactTopicArticle(item) {
  if (!item || typeof item !== "object" || typeof item.url !== "string") {
    return null;
  }

  if (!item.url) {
    return null;
  }

  return {
    url: item.url,
    title: typeof item.title === "string" && item.title ? item.title : item.url,
  };
}

/**
 * Round-robin articles across publishers so one site does not fill the list.
 * Origins are alphabetical. Within an origin, the incoming order is kept.
 * @param {Array<Record<string, unknown>>} items
 * @param {number} limit
 * @returns {Array<Record<string, unknown>>}
 */
export function fairTopicArticles(items, limit) {
  const groups = new Map();

  for (const item of items || []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const key = typeof item.site_origin === "string" ? item.site_origin : "";
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  const keys = [...groups.keys()].sort();
  /** @type {Array<Record<string, unknown>>} */
  const recent = [];
  let index = 0;

  while (recent.length < limit) {
    let added = false;

    for (const key of keys) {
      const list = groups.get(key);
      const item = list[index];

      if (!item) {
        continue;
      }

      recent.push(item);
      added = true;

      if (recent.length >= limit) {
        break;
      }
    }

    if (!added) {
      break;
    }

    index += 1;
  }

  return recent;
}

/**
 * Curated broader and related slugs on a community.
 * These are links, not extra members.
 * @param {Record<string, unknown>} community
 * @returns {string[]}
 */
function relationshipTargets(community) {
  const relationships = community.relationships;

  if (!relationships || typeof relationships !== "object") {
    return [];
  }

  const broader = Array.isArray(relationships.broader)
    ? relationships.broader
    : [];
  const related = Array.isArray(relationships.related)
    ? relationships.related
    : [];

  return [...broader, ...related].filter(
    (slug) => typeof slug === "string" && slug,
  );
}

/**
 * Undirected participant pairs that share a public topic with articles on
 * both sites. Presentation only; never written to connections.json.
 * Groups by topic, with each origin's own posts and the other members indented.
 * @param {Array<Record<string, unknown>>} neighborhoods
 * @returns {{
 *   overlap_count: number,
 *   pairs: Array<{a: string, b: string, topics: Array<{slug: string, label: string}>}>,
 *   sites: Array<{
 *     origin: string,
 *     topics: Array<{
 *       slug: string,
 *       label: string,
 *       articles: Array<{url: string, title: string}>,
 *       sites: Array<{
 *         origin: string,
 *         domain: string,
 *         title: string,
 *         articles: Array<{url: string, title: string}>,
 *       }>,
 *     }>,
 *   }>,
 * }}
 */
export function connectionTopicOverlaps(neighborhoods) {
  /** @type {Map<string, Array<{slug: string, label: string}>>} */
  const pairTopics = new Map();
  /** @type {Map<string, Map<string, {
   *   slug: string,
   *   label: string,
   *   articles: Array<{url: string, title: string}>,
   *   sites: Map<string, {
   *     origin: string,
   *     domain: string,
   *     title: string,
   *     articles: Array<{url: string, title: string}>,
   *   }>,
   * }>>} */
  const byOrigin = new Map();

  /**
   * @param {Record<string, unknown>} member
   * @returns {{origin: string, domain: string, title: string, articles: Array<{url: string, title: string}>} | null}
   */
  function memberRecord(member) {
    if (!member || typeof member.origin !== "string") {
      return null;
    }

    const articles = [];

    for (const item of member.articles || []) {
      const compact = compactTopicArticle(item);

      if (compact) {
        articles.push(compact);
      }

      if (articles.length >= 8) {
        break;
      }
    }

    if (articles.length === 0) {
      return null;
    }

    return {
      origin: member.origin,
      domain: typeof member.domain === "string" ? member.domain : "",
      title:
        typeof member.title === "string" && member.title
          ? member.title
          : typeof member.domain === "string" && member.domain
            ? member.domain
            : member.origin,
      articles,
    };
  }

  for (const neighborhood of neighborhoods || []) {
    if (!neighborhood || typeof neighborhood.slug !== "string") {
      continue;
    }

    const members = [];

    for (const member of neighborhood.members || []) {
      const record = memberRecord(member);

      if (record) {
        members.push(record);
      }
    }

    if (members.length < 2) {
      continue;
    }

    const topic = {
      slug: neighborhood.slug,
      label:
        typeof neighborhood.label === "string" && neighborhood.label
          ? neighborhood.label
          : neighborhood.slug,
    };

    const origins = members.map((member) => member.origin).sort();

    for (let index = 0; index < origins.length; index += 1) {
      for (let other = index + 1; other < origins.length; other += 1) {
        const key = `${origins[index]}\0${origins[other]}`;
        const list = pairTopics.get(key) || [];
        list.push(topic);
        pairTopics.set(key, list);
      }
    }

    for (const self of members) {
      if (!byOrigin.has(self.origin)) {
        byOrigin.set(self.origin, new Map());
      }

      const topics = byOrigin.get(self.origin);
      const existing = topics.get(topic.slug) || {
        slug: topic.slug,
        label: topic.label,
        articles: self.articles,
        sites: new Map(),
      };

      for (const other of members) {
        if (other.origin === self.origin) {
          continue;
        }

        existing.sites.set(other.origin, {
          origin: other.origin,
          domain: other.domain,
          title: other.title,
          articles: other.articles,
        });
      }

      topics.set(topic.slug, existing);
    }
  }

  const pairs = [...pairTopics.entries()]
    .map(([key, topics]) => {
      const [a, b] = key.split("\0");
      return {
        a,
        b,
        topics: [...topics].sort((left, right) =>
          left.slug.localeCompare(right.slug),
        ),
      };
    })
    .sort((left, right) =>
      `${left.a}:${left.b}`.localeCompare(`${right.a}:${right.b}`),
    );
  const cappedPairs = capPresentationList(pairs, MAX_CONNECTION_TOPIC_PAIRS);

  const sites = [...byOrigin.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([origin, topics]) => ({
      origin,
      topics: [...topics.values()]
        .map((topic) => ({
          slug: topic.slug,
          label: topic.label,
          articles: topic.articles,
          sites: [...topic.sites.values()].sort((left, right) =>
            left.title.localeCompare(right.title),
          ),
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    }));

  return {
    overlap_count: cappedPairs.length,
    pairs: cappedPairs,
    sites,
  };
}

/**
 * Bounded why-here evidence from qualifying declared or heuristic records.
 * @param {Array<Record<string, unknown>>} evidence
 * @returns {Array<Record<string, unknown>>}
 */
export function compactWhyHere(evidence) {
  const rows = [];

  for (const item of evidence || []) {
    if (!item || item.community_eligible !== true) {
      continue;
    }

    if (item.class !== "declared" && item.class !== "heuristic") {
      continue;
    }

    rows.push({
      source: sourceLabel(String(item.source || "")),
      page: typeof item.page === "string" ? item.page : "",
      raw_value: typeof item.raw_value === "string" ? item.raw_value : "",
      observed_at: typeof item.observed_at === "string" ? item.observed_at : "",
      evidence_class: item.class,
    });

    if (rows.length >= 4) {
      break;
    }
  }

  return rows;
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function searchTokens(query) {
  if (typeof query !== "string") {
    return [];
  }

  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Textual relevance only. Title > topics > summary > domain.
 * @param {string} query
 * @param {{
 *   type: string,
 *   title: string,
 *   summary?: string,
 *   domain?: string,
 *   topics?: string[],
 *   origin?: string,
 * }} document
 * @returns {number}
 */
export function scoreSearchDocument(query, document) {
  const tokens = searchTokens(query);

  if (tokens.length === 0) {
    return 0;
  }

  const title = String(document.title || "").toLowerCase();
  const summary = String(document.summary || "").toLowerCase();
  const domain = String(document.domain || "").toLowerCase();
  const topics = (document.topics || []).join(" ").toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (title === token || domain === token) {
      score += 12;
    } else if (title.includes(token)) {
      score += 8;
    }

    if (topics.includes(token)) {
      score += 5;
    }

    if (summary.includes(token)) {
      score += 2;
    }

    if (domain.includes(token)) {
      score += 3;
    }
  }

  return score;
}

/**
 * Caps consecutive same-origin content rows after scoring (does not change score).
 * @param {Array<Record<string, unknown> & { score: number, origin?: string, type: string }>} ranked
 * @param {number} [perOrigin]
 * @returns {Array<Record<string, unknown>>}
 */
export function capSameOriginResults(ranked, perOrigin = 3) {
  const counts = new Map();
  const out = [];

  for (const row of ranked) {
    if (row.type !== "content") {
      out.push(row);
      continue;
    }

    const origin = String(row.origin || "");
    const used = counts.get(origin) || 0;

    if (used >= perOrigin) {
      continue;
    }

    counts.set(origin, used + 1);
    out.push(row);
  }

  return out;
}

/**
 * Bounded random walk over observed edges. Never invents hops.
 * @param {Array<{from: string, to: string, relation: string}>} edges
 * @param {() => number} random
 * @param {number} [maxHops]
 * @returns {Array<{from: string, to: string, relation: string}>}
 */
export function randomLinkTrail(edges, random, maxHops = 3) {
  if (!Array.isArray(edges) || edges.length === 0) {
    return [];
  }

  const start = edges[Math.floor(random() * edges.length)];

  if (!start) {
    return [];
  }

  const trail = [start];
  let current = start.to;

  while (trail.length < maxHops) {
    const nextChoices = edges.filter(
      (edge) =>
        edge.from === current &&
        !trail.some(
          (step) =>
            step.from === edge.from &&
            step.to === edge.to &&
            step.relation === edge.relation,
        ),
    );

    if (nextChoices.length === 0) {
      break;
    }

    const next = nextChoices[Math.floor(random() * nextChoices.length)];
    trail.push(next);
    current = next.to;
  }

  return trail;
}

/**
 * Builds all presentation documents from canonical graph files.
 * @param {{
 *   network: Array<Record<string, unknown>>,
 *   content: unknown,
 *   topics: unknown,
 *   connections: unknown,
 *   siteSignals: unknown,
 *   generatedAt: string,
 *   now?: Date,
 * }} input
 * @returns {{
 *   activity: Record<string, unknown>,
 *   explore: Record<string, unknown>,
 *   topic_views: Record<string, unknown>,
 *   site_views: Record<string, unknown>,
 *   search_index: Record<string, unknown>,
 * }}
 */
export function buildViewDocuments(input) {
  const sites = sitesByOrigin(input.network || []);
  const contentItems = itemsFromCollection(input.content, "items");
  const signalsOrigins = Array.isArray(input.siteSignals?.origins)
    ? input.siteSignals.origins
    : [];
  // Topic pages from nlp:sync are the source of truth — do not invent
  // /topics/{slug}/ URLs from content tags that were never published.
  const communities = publicCommunities(input.topics);
  const publicSlugs = publicCommunitySlugSet(communities);
  const edges = itemsFromCollection(input.connections, "edges").filter(
    (edge) =>
      edge && typeof edge.from === "string" && typeof edge.to === "string",
  );
  const clock = input.now || new Date(input.generatedAt);
  const compactItems = contentItems
    .map((item) => compactContentItem(item, sites, publicSlugs))
    .filter(Boolean);
  const recentItems = contentItems.filter(
    (item) => item && publishedWithinDays(item.published_at, clock),
  );
  const primary = oneLatestPerOrigin(recentItems)
    .map((item) => compactContentItem(item, sites, publicSlugs))
    .filter(Boolean);

  const types = [
    ...new Set(
      primary.map((item) => String(item.content_type || "")).filter(Boolean),
    ),
  ].sort();

  const activity = {
    schema_version: 1,
    generated_at: input.generatedAt,
    window_days: 7,
    primary_count: primary.length,
    item_count: compactItems.length,
    content_types: types,
    primary,
  };

  const cooccurrence = topicCooccurrence(contentItems, publicSlugs);
  const featuredCommunity = pickFeaturedCommunity(communities, input.now);
  const featuredEdge = pickFeaturedConnection(edges);

  const topicViews = communities.map((community) => {
    const matching = compactItems
      .filter((item) =>
        itemMentionsTopic(item, community.slug, community.label),
      )
      .sort((left, right) =>
        String(right.published_at).localeCompare(String(left.published_at)),
      );
    const related = cooccurrence
      .filter(
        (pair) => pair.left === community.slug || pair.right === community.slug,
      )
      .map((pair) => {
        const other = pair.left === community.slug ? pair.right : pair.left;
        const otherCommunity = communities.find((item) => item.slug === other);
        return {
          slug: other,
          label: otherCommunity?.label || other,
          content_count: pair.content_count,
        };
      });

    for (const slug of relationshipTargets(community)) {
      if (related.some((item) => item.slug === slug)) {
        continue;
      }

      const otherCommunity = communities.find((item) => item.slug === slug);

      if (!otherCommunity) {
        continue;
      }

      related.push({
        slug,
        label:
          typeof otherCommunity.label === "string" && otherCommunity.label
            ? otherCommunity.label
            : slug,
        content_count: 0,
      });
    }
    const memberOrigins = new Set();

    for (const member of community.sites) {
      if (member && typeof member.origin === "string" && member.origin) {
        memberOrigins.add(member.origin);
      }
    }

    for (const item of matching) {
      if (typeof item.site_origin === "string" && item.site_origin) {
        memberOrigins.add(item.site_origin);
      }
    }

    const members = [...memberOrigins]
      .map((origin) => {
        const listed = community.sites.find(
          (member) => member.origin === origin,
        );
        const signal = signalsOrigins.find((entry) => entry.origin === origin);
        const declared = (signal?.declared_topics || []).find(
          (topic) => topic.slug === community.slug,
        );
        const heuristic = (signal?.subject_signals || []).find(
          (topic) =>
            topic.slug === community.slug &&
            topic.evidence_class === "heuristic",
        );
        const site = sites.get(origin);
        const whyEvidence = declared?.evidence || heuristic?.evidence || [];
        const articles = matching.filter((item) => item.site_origin === origin);

        return {
          origin,
          domain: listed?.domain || site?.domain || "",
          title: listed?.title || site?.title || site?.domain || origin,
          description:
            typeof site?.description === "string" ? site.description : "",
          membership:
            listed?.membership || (declared ? "declared" : "heuristic"),
          why: compactWhyHere(whyEvidence),
          articles,
          occurrence_count: articles.length,
          recent: articles.slice(0, 3),
        };
      })
      .filter(
        (member) => member.articles.length > 0 && sites.has(member.origin),
      );

    members.sort((left, right) =>
      String(left.domain || left.title).localeCompare(
        String(right.domain || right.title),
      ),
    );

    const occurrence_count = members.reduce(
      (total, member) => total + member.occurrence_count,
      0,
    );

    return {
      slug: community.slug,
      label: community.label,
      member_count: members.length,
      occurrence_count,
      last_changed_at: community.last_changed_at || "",
      related_discoveries: community.related_discoveries || [],
      recent: fairTopicArticles(matching, 12),
      recent_count: matching.length,
      members,
      related,
    };
  });

  const neighborhoods = topicViews.filter(
    (neighborhood) => neighborhood.members.length > 0,
  );

  neighborhoods.sort((left, right) =>
    String(left.label).localeCompare(String(right.label)),
  );

  const connectionTopics = connectionTopicOverlaps(neighborhoods);

  const siteViews = [...sites.values()].map((site) => {
    const origin = site.origin;
    const signal = signalsOrigins.find((entry) => entry.origin === origin);
    const outgoing = edges.filter((edge) => edge.from === origin);
    const incoming = edges.filter((edge) => edge.to === origin);
    const communityTopics = communities
      .filter((community) =>
        community.sites.some((member) => member.origin === origin),
      )
      .map((community) => ({ slug: community.slug, label: community.label }));
    const recent = compactItems.find((item) => item.site_origin === origin);

    return {
      origin,
      domain: site.domain,
      title: site.title || site.domain,
      description: site.description || "",
      identity: site.identity,
      feeds: site.feeds || [],
      elsewhere: site.elsewhere || [],
      community_topics: communityTopics,
      recent_content: recent || null,
      outgoing: outgoing.map((edge) => ({
        to: edge.to,
        relation: edge.relation,
        label: relationLabel(String(edge.relation)),
        href: edge.href,
        page: edge.page,
        evidence_count:
          edge.evidence_count || (edge.evidence || []).length || 1,
      })),
      incoming: incoming.map((edge) => ({
        from: edge.from,
        relation: edge.relation,
        label: relationLabel(String(edge.relation)),
        href: edge.href,
        page: edge.page,
        evidence_count:
          edge.evidence_count || (edge.evidence || []).length || 1,
      })),
      coverage: signal?.coverage || null,
      crawled_at:
        typeof signal?.crawled_at === "string" ? signal.crawled_at : "",
      ...(signal?.portfolio && typeof signal.portfolio.url === "string"
        ? { portfolio: signal.portfolio }
        : {}),
    };
  });

  const explore = {
    schema_version: 1,
    generated_at: input.generatedAt,
    participant_count: sites.size,
    community_count: communities.length,
    publication_count: compactItems.length,
    connection_count: edges.length,
    selection: {
      neighborhood: featuredCommunity
        ? "utc-date rotation over alphabetically sorted community slugs"
        : "none",
      connection: featuredEdge
        ? "first edge after stable from, to, relation sort"
        : "none",
    },
    fresh: primary.slice(0, 6),
    ...(featuredCommunity
      ? {
          neighborhood: {
            slug: featuredCommunity.slug,
            label: featuredCommunity.label,
            member_count:
              featuredCommunity.member_count || featuredCommunity.sites.length,
          },
        }
      : {}),
    ...(featuredEdge
      ? {
          connection: {
            from: featuredEdge.from,
            to: featuredEdge.to,
            relation: featuredEdge.relation,
            label: relationLabel(String(featuredEdge.relation)),
            from_title:
              sites.get(featuredEdge.from)?.title || featuredEdge.from,
            to_title: sites.get(featuredEdge.to)?.title || featuredEdge.to,
            href: featuredEdge.href,
            page: featuredEdge.page,
            text: featuredEdge.text || "",
            evidence_count:
              featuredEdge.evidence_count ||
              (featuredEdge.evidence || []).length ||
              1,
          },
        }
      : {}),
  };

  const searchDocuments = [];

  for (const site of sites.values()) {
    searchDocuments.push({
      type: "site",
      title: site.title || site.domain,
      summary: site.description || "",
      domain: site.domain,
      origin: site.origin,
      url: site.origin,
      topics: [],
    });
  }

  // Same neighborhoods as the Topics hub — never link Search to empty
  // communities that have no published matching articles / pages.
  for (const neighborhood of neighborhoods) {
    searchDocuments.push({
      type: "topic",
      title: neighborhood.label,
      summary: `${neighborhood.member_count} participating sites`,
      domain: "",
      origin: "",
      url: `/topics/${neighborhood.slug}/`,
      topics: [neighborhood.slug, neighborhood.label],
    });
  }

  for (const item of compactItems) {
    searchDocuments.push({
      type: "content",
      title: item.title,
      summary: item.summary,
      domain: item.domain,
      origin: item.site_origin,
      url: item.url,
      topics: item.tags.map((topic) => topic.label),
      site_title: item.site_title,
      published_at: item.published_at,
      image: item.image,
      image_origin: item.image_origin,
    });
  }

  const searchIndexDocuments = capPresentationList(
    searchDocuments,
    MAX_SEARCH_INDEX_DOCUMENTS,
  );

  return {
    activity,
    explore,
    topic_views: {
      schema_version: 1,
      generated_at: input.generatedAt,
      community_count: neighborhoods.length,
      neighborhoods,
      cooccurrence,
    },
    connection_topics: {
      schema_version: 1,
      generated_at: input.generatedAt,
      overlap_count: connectionTopics.overlap_count,
      pairs: connectionTopics.pairs,
      sites: connectionTopics.sites,
    },
    site_views: {
      schema_version: 1,
      generated_at: input.generatedAt,
      sites: siteViews,
    },
    search_index: {
      schema_version: 1,
      generated_at: input.generatedAt,
      document_count: searchIndexDocuments.length,
      documents: searchIndexDocuments,
    },
  };
}
