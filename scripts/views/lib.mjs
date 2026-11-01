/**
 * Goal & Constraints:
 * Deterministic UI projections from canonical graph data. Never invent
 * communities, directed connections, scores, or friendship. Shared topics
 * on /connections/ are neighborhood overlaps, not connections.json edges.
 * Public neighborhoods come only from topics.communities. Visitor copy never
 * includes tfidf-v1.
 */

import { itemsFromCollection } from "../network/collections.mjs";
import { decodeHtmlEntities } from "../network/lib.mjs";
import { isShowcaseChromePath } from "../network/slash-pages.mjs";
import { isNonSubjectSlug } from "../nlp/evidence.mjs";
import { itemMentionsTopic, textMentionsSlug } from "../nlp/match.mjs";
import { normalizeLanguageTag } from "../nlp/text.mjs";
import {
  normalizeUnicodeText,
  unicodeLetterTokens,
} from "../nlp/unicode-text.mjs";

/** What's New / Activity primary window (publisher publish dates). */
export const ACTIVITY_WINDOW_DAYS = 14;

export { itemMentionsTopic, textMentionsSlug };

export const RELATION_LABELS = {
  "content-link": "linked to",
  "homepage-link": "links to from the homepage",
  blogroll: "includes in a blogroll",
  "reply-to": "replied to",
  "repost-of": "reposted",
  syndication: "syndicated to",
  credit: "credits",
};

/** Creative work content_type values eligible for /showcase/. */
export const SHOWCASE_CONTENT_TYPES = [
  "photograph",
  "visual_artwork",
  "music_recording",
  "music_album",
  "podcast_episode",
  "sheet_music",
  "video",
  "game",
  "collection",
  "project",
];

/**
 * Stable Showcase section order (projects → games → photos → music, then the
 * rest). Only kinds with items are emitted; later these become /showcase/
 * subpages.
 * @type {readonly string[]}
 */
export const SHOWCASE_KIND_ORDER = Object.freeze([
  "project",
  "games",
  "photography",
  "music",
  "podcasts",
  "art",
  "comics",
  "sheet music",
  "video",
  "education",
  "apps",
  "software",
  "design",
  "books",
  "guides",
  "other",
]);

/**
 * Singular / plural display labels for Showcase section and filter titles.
 * Mass nouns keep one form. Count === 1 uses singular; otherwise plural.
 * @type {Readonly<Record<string, readonly [string, string]>>}
 */
export const SHOWCASE_KIND_LABELS = Object.freeze({
  project: Object.freeze(["Project", "Projects"]),
  games: Object.freeze(["Game", "Games"]),
  photography: Object.freeze(["Photography", "Photography"]),
  music: Object.freeze(["Music", "Music"]),
  podcasts: Object.freeze(["Podcast", "Podcasts"]),
  art: Object.freeze(["Art", "Art"]),
  comics: Object.freeze(["Comic", "Comics"]),
  "sheet music": Object.freeze(["Sheet music", "Sheet music"]),
  video: Object.freeze(["Video", "Videos"]),
  education: Object.freeze(["Education", "Education"]),
  apps: Object.freeze(["App", "Apps"]),
  software: Object.freeze(["Software", "Software"]),
  design: Object.freeze(["Design", "Design"]),
  books: Object.freeze(["Book", "Books"]),
  guides: Object.freeze(["Guide", "Guides"]),
  other: Object.freeze(["Other", "Other"]),
});

/**
 * Human Showcase kind title. Plural when {@link count} is not exactly 1.
 * @param {unknown} kind
 * @param {number} count
 * @returns {string}
 */
export function showcaseKindLabel(kind, count) {
  const key = String(kind || "other");
  const forms = SHOWCASE_KIND_LABELS[key];
  const singular = forms?.[0] || key.charAt(0).toUpperCase() + key.slice(1);
  const plural = forms?.[1] || singular;

  return Number(count) === 1 ? singular : plural;
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
 * BCP 47 language subtags that use a right-to-left script by default.
 * Only the primary language subtag is checked (e.g. "ar" from "ar-SA").
 * @type {ReadonlySet<string>}
 */
const RTL_PRIMARY_SUBTAGS = new Set([
  "ar",
  "arc",
  "dv",
  "fa",
  "ha",
  "he",
  "khw",
  "ks",
  "ku",
  "ps",
  "sd",
  "ur",
  "uz",
  "yi",
]);

/**
 * Returns "rtl" for right-to-left language tags, otherwise empty string.
 * Used to set an explicit `dir` attribute when auto-detection is unreliable.
 * @param {string} language - BCP 47 language tag (may be empty).
 * @returns {"rtl" | ""}
 */
export function dirForLanguage(language) {
  if (!language) {
    return "";
  }

  const primary = language.split("-")[0].toLowerCase();
  return RTL_PRIMARY_SUBTAGS.has(primary) ? "rtl" : "";
}

/**
 * Compact content card for lists.
 * Passes through creative-specific fields (`categories`, `availability`,
 * `action_label`, `action_url`) and event fields (`start`, `end`, `venue`,
 * `location`, `status`, `attribution_role`) when present on the source item.
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
  const rawImage = typeof item.image === "string" ? item.image : "";
  const image =
    rawImage.startsWith("https://") ||
    rawImage.startsWith("/assets/activity/posters/")
      ? rawImage
      : "";
  let imageOrigin = "";

  if (image.startsWith("https://")) {
    try {
      imageOrigin = new URL(image).origin;
    } catch {
      imageOrigin = "";
    }
  }

  const language = normalizeLanguageTag(item.language);
  const rawTitle =
    typeof item.title === "string" && item.title ? item.title : item.url;
  const title = decodeHtmlEntities(String(rawTitle));
  const rawSummary = typeof item.summary === "string" ? item.summary : "";
  const decodedSummary = decodeHtmlEntities(rawSummary);
  // Title-echo summaries (common on year albums) add noise on Showcase cards.
  const summaryEqualsTitle =
    decodedSummary.trim().toLowerCase() === String(title).trim().toLowerCase();
  const summary = summaryEqualsTitle ? "" : decodedSummary;

  /** @type {Record<string, unknown>} */
  const compact = {
    url: item.url,
    title,
    summary,
    published_at:
      typeof item.published_at === "string" ? item.published_at : "",
    observed_at: typeof item.observed_at === "string" ? item.observed_at : "",
    content_type:
      typeof item.content_type === "string" ? item.content_type : "",
    language,
    dir: dirForLanguage(language),
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

  // Creative-specific optional fields.
  if (Array.isArray(item.categories) && item.categories.length > 0) {
    compact.categories = item.categories;
  }

  if (typeof item.availability === "string" && item.availability) {
    compact.availability = item.availability;
  }

  if (typeof item.action_label === "string" && item.action_label) {
    compact.action_label = item.action_label;
  }

  if (typeof item.action_url === "string" && item.action_url) {
    compact.action_url = item.action_url;
  }

  // Event-specific optional fields.
  if (typeof item.start === "string" && item.start) {
    compact.start = item.start;
  }

  if (typeof item.end === "string" && item.end) {
    compact.end = item.end;
  }

  if (typeof item.venue === "string" && item.venue) {
    compact.venue = item.venue;
  }

  if (typeof item.location === "string" && item.location) {
    compact.location = item.location;
  }

  if (typeof item.status === "string" && item.status) {
    compact.status = item.status;
  }

  if (typeof item.attribution_role === "string" && item.attribution_role) {
    compact.attribution_role = item.attribution_role;
  }

  // Preserve crawl source so Showcase can exclude client portfolio tables.
  const sourceKind =
    item.source && typeof item.source === "object"
      ? /** @type {{ kind?: unknown }} */ (item.source).kind
      : "";
  const feedIsPortfolio =
    Array.isArray(item.source_feeds) &&
    item.source_feeds.some(
      (feed) =>
        feed &&
        typeof feed === "object" &&
        /** @type {{ type?: unknown }} */ (feed).type === "portfolio",
    );

  if (feedIsPortfolio || sourceKind === "portfolio") {
    compact.source_kind = "portfolio";
  } else if (typeof sourceKind === "string" && sourceKind) {
    compact.source_kind = sourceKind;
  }

  // Preserve page_role so writing-shaped "project" shells stay out of Showcase.
  if (typeof item.page_role === "string" && item.page_role) {
    compact.page_role = item.page_role;
  }

  return compact;
}

/**
 * Best timestamp for What's New ordering: publisher date, else crawl observe time.
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {string}
 */
export function activityTimestamp(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  if (typeof item.published_at === "string" && item.published_at) {
    return item.published_at;
  }

  if (typeof item.observed_at === "string" && item.observed_at) {
    return item.observed_at;
  }

  return "";
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
 * True when an item’s activity timestamp falls in the closed window ending at now.
 * @param {Record<string, unknown> | null | undefined} item
 * @param {Date | string} now
 * @param {number} [days]
 * @returns {boolean}
 */
export function activityWithinDays(item, now, days = 7) {
  return publishedWithinDays(activityTimestamp(item), now, days);
}

/**
 * True when a content URL is on the Joshternet hub.
 * Member “link” posts that only point at the hub are not useful to feature
 * on joshternet.org itself.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isJoshternetHubContentUrl(value) {
  if (typeof value !== "string" || !value) {
    return false;
  }

  try {
    const hostname = new URL(value).hostname.toLocaleLowerCase("en-US");
    return hostname === "joshternet.org" || hostname === "www.joshternet.org";
  } catch {
    return false;
  }
}

/**
 * Deduplicate by URL, then newest {@link activityTimestamp} first.
 * @param {Array<Record<string, unknown>>} items
 * @returns {Array<Record<string, unknown>>}
 */
export function uniqueActivityItemsByUrl(items) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byUrl = new Map();

  for (const item of items || []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const url = typeof item.url === "string" ? item.url : "";

    if (!url || byUrl.has(url)) {
      continue;
    }

    byUrl.set(url, item);
  }

  return [...byUrl.values()].sort((left, right) => {
    const date = activityTimestamp(right).localeCompare(
      activityTimestamp(left),
    );

    if (date !== 0) {
      return date;
    }

    // url is always a non-empty string here (guarded when inserting into byUrl).
    return String(left.url).localeCompare(String(right.url));
  });
}

/**
 * One latest item per origin, then newest first.
 * Uses {@link activityTimestamp} so undated creative works can still compete
 * via crawl `observed_at`.
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

    const published = activityTimestamp(item);
    const previous = byOrigin.get(item.site_origin);

    if (!previous) {
      byOrigin.set(item.site_origin, item);
      continue;
    }

    const previousPublished = activityTimestamp(previous);

    if (
      published > previousPublished ||
      (published === previousPublished &&
        String(item.url || "") < String(previous.url || ""))
    ) {
      byOrigin.set(item.site_origin, item);
    }
  }

  return [...byOrigin.values()].sort((left, right) => {
    const date = activityTimestamp(right).localeCompare(
      activityTimestamp(left),
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

  return ranked;
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
 * Kind label for a creative content_type on the Showcase / Made page.
 * Uses finer categories (photography, art, music, video, games, apps,
 * software, books, guides, design, project, other) by considering
 * `categories` in addition to `content_type`.
 * @param {unknown} contentType
 * @param {unknown[]} [categories]
 * @returns {string}
 */
export function showcaseKind(contentType, categories = []) {
  const type = String(contentType || "").toLowerCase();
  const cats = (Array.isArray(categories) ? categories : [])
    .map((cat) => String(cat || "").toLowerCase())
    .join(" ");

  switch (type) {
    case "photograph":
      return "photography";
    case "visual_artwork":
      return "art";
    case "music_recording":
    case "music_album":
      return "music";
    case "podcast_episode":
      return "podcasts";
    case "sheet_music":
      return "sheet music";
    case "video":
      return "video";
    case "game":
      if (/\bapp\b|\bios\b|\bandroid\b|\bmobile\b/.test(cats)) {
        return "apps";
      }

      if (/\bsoftware\b/.test(cats)) {
        return "software";
      }

      return "games";
    case "collection":
    case "project":
      if (/\bbook\b/.test(cats)) {
        return "books";
      }

      if (/\bguide\b/.test(cats)) {
        return "guides";
      }

      if (/\bdesign\b/.test(cats)) {
        return "design";
      }

      if (/\bapp\b|\bios\b|\bandroid\b|\bmobile\b/.test(cats)) {
        return "apps";
      }

      if (/\bsoftware\b/.test(cats)) {
        return "software";
      }

      return "project";
    case "article":
      // Writing is not a Showcase project; creative-path articles use
      // showcaseKindForItem → creativePathKind instead.
      return "other";
    default: {
      const _exhaustive = type;
      void _exhaustive;
      return "other";
    }
  }
}

/**
 * Alias for {@link showcaseKind}; use on the Made page.
 * @param {unknown} contentType
 * @param {unknown[]} [categories]
 * @returns {string}
 */
export const madeKind = showcaseKind;

/** Path segment that marks a creative index root. */
const CREATIVE_INDEX_ROOT =
  /^(gallery|galleries|albums|photography|photos|art|illustration|artwork|comics?|webcomics|toys?|play|reels?|shorts|cssbattles?|music|discography|tracks|videos|film|animation|games|game|interactive|exhibitions|design|portfolio|work|projects?|experiments?|sounds?|apps?|software|books?|guides?|resources?|shows?|concerts?|events?|podcasts?|study-hall|frontend-study-hall|front-end-study-hall|fresh|education|learn|classes?|courses?)$/i;

/**
 * Showcase kind inferred from a creative child path (e.g. /experiments/corkboard/).
 * @param {unknown} url
 * @returns {string} Kind slug, or "" when not a creative child URL.
 */
export function creativePathKind(url) {
  try {
    const parts = new URL(String(url || "")).pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

    if (parts.length < 2 || !CREATIVE_INDEX_ROOT.test(parts[0])) {
      return "";
    }

    const root = parts[0].toLowerCase();

    if (/^(gallery|galleries|albums|photography|photos)$/.test(root)) {
      return "photography";
    }

    if (/^(art|illustration|artwork)$/.test(root)) {
      return "art";
    }

    if (/^(comics?|webcomics)$/.test(root)) {
      return "comics";
    }

    if (/^(toys?|play)$/.test(root)) {
      return "project";
    }

    if (/^(reels?|shorts|cssbattles?)$/.test(root)) {
      return "video";
    }

    if (/^(music|discography|tracks|sounds?)$/.test(root)) {
      return "music";
    }

    if (/^podcasts?$/.test(root)) {
      return "podcasts";
    }

    if (/^(videos|film|animation)$/.test(root)) {
      return "video";
    }

    if (
      /^(study-hall|frontend-study-hall|front-end-study-hall|fresh|education|learn|classes?|courses?)$/.test(
        root,
      )
    ) {
      return "education";
    }

    if (/^(games|game|interactive)$/.test(root)) {
      return "games";
    }

    if (/^apps?$/.test(root)) {
      return "apps";
    }

    if (/^software$/.test(root)) {
      return "software";
    }

    if (/^design$/.test(root)) {
      return "design";
    }

    if (/^books?$/.test(root)) {
      return "books";
    }

    if (/^guides?$/.test(root)) {
      return "guides";
    }

    return "project";
  } catch {
    return "";
  }
}

/**
 * True when the URL is an individual work under a creative index
 * (e.g. /experiments/corkboard/), not the index root itself.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isCreativePathWorkUrl(url) {
  return Boolean(creativePathKind(url));
}

/**
 * Kind for a Showcase card from content_type, categories, and creative path.
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
/**
 * True when an event or page is education / study-hall shaped (FrESH-like).
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function isEducationGatheringItem(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (creativePathKind(item.url) === "education") {
    return true;
  }

  const url = String(item.url || "").toLowerCase();

  if (
    /\/(study-hall|frontend-study-hall|front-end-study-hall|fresh|education|learn|classes?|courses?)(\/|$)/.test(
      url,
    )
  ) {
    return true;
  }

  const blob = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  return /study hall|front[\s-]?end study|education event|\bfresh\s*#?\d+/i.test(
    blob,
  );
}

/**
 * True when a past education event should appear in Showcase Education
 * (upcoming stay on Happening only).
 * @param {Record<string, unknown>} item
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isPastEducationShowcaseEvent(item, now = new Date()) {
  if (String(item?.content_type) !== "event") {
    return false;
  }

  if (!isEducationGatheringItem(item)) {
    return false;
  }

  const startMs = Date.parse(String(item.start || ""));

  if (!Number.isFinite(startMs)) {
    return false;
  }

  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now));
  const endMs = item.end ? Date.parse(String(item.end)) : NaN;

  if (Number.isFinite(endMs) && endMs > nowMs) {
    return false;
  }

  return startMs < nowMs;
}

export function showcaseKindForItem(item) {
  const fromPath = creativePathKind(item.url);

  if (String(item.content_type) === "event") {
    return isEducationGatheringItem(item) ? "education" : "other";
  }

  // Articles are not projects: only creative-path works (e.g. /experiments/…)
  // get a Showcase kind from writing-shaped types.
  if (String(item.content_type) === "article") {
    return fromPath || "other";
  }

  // Year photo albums are collections typed under /photos/ — prefer path kind.
  if (String(item.content_type) === "collection" && fromPath) {
    return fromPath;
  }

  if (fromPath === "comics" || fromPath === "education") {
    return fromPath;
  }

  const fromType = showcaseKind(
    item.content_type,
    Array.isArray(item.categories) ? item.categories : [],
  );

  if (fromType !== "other") {
    return fromType;
  }

  return fromPath || fromType;
}

/**
 * True when a URL is a creative index root (e.g. `/work/`, `/photos/`) rather
 * than an individual work. Query-string case studies (`?work=…`) stay
 * non-index for this helper; Showcase still excludes portfolio-sourced clients.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isBareCreativeIndexUrl(url) {
  try {
    const parsed = new URL(String(url || ""));

    if ([...parsed.searchParams.keys()].length > 0) {
      return false;
    }

    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const parts = path.split("/").filter(Boolean);

    if (parts.length !== 1) {
      return false;
    }

    const leaf = parts[0].replace(/\.(html?|php|aspx?)$/i, "");
    return CREATIVE_INDEX_ROOT.test(leaf);
  } catch {
    return false;
  }
}

/**
 * True when the URL is the site homepage (not a work under /projects/ etc.).
 * @param {unknown} url
 * @returns {boolean}
 */
export function isSiteHomeUrl(url) {
  try {
    const path = new URL(String(url || "")).pathname.replace(/\/+$/, "") || "/";
    return path === "/";
  } catch {
    return false;
  }
}

/**
 * True when a homepage portfolio card title is indexed like
 * "02 M.A. Thesis · Installation SomaSpace …" (Joshua Kim studio style).
 * @param {unknown} title
 * @returns {boolean}
 */
export function isPortfolioIndexedProjectTitle(title) {
  return /^\d{1,2}\s+\S/.test(String(title || "").trim());
}

/**
 * True when the URL is a single-segment product path (e.g. `/somaspace`),
 * not a creative-index root like `/work` and not site chrome.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isNamedRootProjectUrl(url) {
  const parts = pathnameParts(url);

  if (!parts || parts.length !== 1) {
    return false;
  }

  const slug = parts[0].replace(/\.(html?|php|aspx?)$/i, "").toLowerCase();

  if (!slug || CREATIVE_INDEX_ROOT.test(slug)) {
    return false;
  }

  return !isShowcaseChromePath(`/${slug}/`);
}

/**
 * Source kind on a compact or raw content item.
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function creativeSourceKind(item) {
  if (typeof item?.source_kind === "string" && item.source_kind) {
    return item.source_kind;
  }

  const source = item?.source;

  if (source && typeof source === "object" && typeof source.kind === "string") {
    return source.kind;
  }

  return "";
}

/**
 * True when a title reads like a blog/update post rather than a product name
 * ("Personal Data Pipeline Update", "Imagining a …").
 * @param {unknown} title
 * @returns {boolean}
 */
export function isBlogShapedProjectTitle(title) {
  const text = String(title || "").trim();

  if (!text) {
    return false;
  }

  return (
    /\bmin read\b/i.test(text) ||
    /\bupdates?\b/i.test(text) ||
    /\bimagining\b/i.test(text) ||
    /\?/.test(text) ||
    /&middot;|·/.test(text) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i.test(
      text,
    )
  );
}

/**
 * True when the title is exactly the product name recovered from the URL slug
 * (homepage link text like "SomaSpace", not a blog sentence).
 * @param {unknown} title
 * @param {unknown} url
 * @returns {boolean}
 */
export function isExactSlugProductTitle(title, url) {
  const parts = pathnameParts(url);

  if (!parts || parts.length !== 1) {
    return false;
  }

  const cleaned = String(title || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 2 || cleaned.length > 48) {
    return false;
  }

  // Blog posts often mirror their slug ("personal-data-pipeline-update");
  // product apps use short names with at most one hyphen.
  const words = cleaned.split(/\s+/).filter(Boolean);
  const slug = parts[0].replace(/\.(html?|php|aspx?)$/i, "");
  const hyphenCount = (slug.match(/-/g) || []).length;

  if (
    words.length > 3 ||
    hyphenCount > 1 ||
    isBlogShapedProjectTitle(cleaned)
  ) {
    return false;
  }

  const matched = projectTitleMatchingSlug(cleaned, slug);

  return Boolean(matched) && matched.toLowerCase() === cleaned.toLowerCase();
}

/**
 * True when a single-segment URL is a Showcase-eligible studio product
 * (Kim-style numbered portfolio cards, schema SoftwareApplication rows, or
 * short homepage link titles that match the slug).
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function isNamedRootCreativeProduct(item) {
  if (!item || typeof item !== "object" || !isNamedRootProjectUrl(item.url)) {
    return false;
  }

  if (isPortfolioIndexedProjectTitle(item.title)) {
    return true;
  }

  if (creativeSourceKind(item) === "creative-schema") {
    return true;
  }

  return isExactSlugProductTitle(item.title, item.url);
}

/**
 * True when a project was harvested from a member Projects/Products shelf and
 * the work URL lives off-origin (Morning App, MusicX, Seedling, …).
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function isExternalShelfProject(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const kind = creativeSourceKind(item);

  if (
    kind !== "creative-homepage-shelf" &&
    kind !== "creative-projects-shelf"
  ) {
    return false;
  }

  if (typeof item.url !== "string" || typeof item.site_origin !== "string") {
    return false;
  }

  try {
    return new URL(item.url).origin !== new URL(item.site_origin).origin;
  } catch {
    return false;
  }
}

/**
 * True when url is the member's own site homepage (not an external product
 * root such as https://themorning.app/).
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function isMemberSiteHomeItem(item) {
  if (!item || typeof item !== "object" || !isSiteHomeUrl(item.url)) {
    return false;
  }

  if (typeof item.site_origin !== "string" || !item.site_origin) {
    return true;
  }

  try {
    return (
      new URL(String(item.url)).origin === new URL(item.site_origin).origin
    );
  } catch {
    return true;
  }
}

/**
 * Recover a short project name from a portfolio title using the URL slug
 * ("… SomaSpace Webcams…" + `/somaspace` → "SomaSpace").
 * @param {string} title
 * @param {string} slug
 * @returns {string}
 */
export function projectTitleMatchingSlug(title, slug) {
  const target = String(slug || "")
    .replace(/-/g, "")
    .toLowerCase();

  if (!target || !title) {
    return "";
  }

  let targetIndex = 0;
  let start = -1;
  let end = -1;

  for (let index = 0; index < title.length; index += 1) {
    const char = title[index];

    if (!/[a-z0-9]/i.test(char)) {
      continue;
    }

    if (char.toLowerCase() === target[targetIndex]) {
      if (start < 0) {
        start = index;
      }

      targetIndex += 1;
      end = index + 1;

      if (targetIndex === target.length) {
        return extendTitleCaseProductName(title, start, end);
      }

      continue;
    }

    if (start >= 0) {
      targetIndex = 0;
      start = -1;
      end = -1;
      index -= 1;
    }
  }

  return "";
}

/**
 * Keep trailing Title Case name words after a slug match
 * ("Order Pipeline" + " Toolkit Order contents…" → "Order Pipeline Toolkit").
 * Stops before a Title Case word that begins a sentence (next token lowercase).
 * @param {string} title
 * @param {number} start
 * @param {number} end
 * @returns {string}
 */
function extendTitleCaseProductName(title, start, end) {
  let cursor = end;

  while (cursor < title.length) {
    const rest = title.slice(cursor);
    const wordMatch = rest.match(/^\s+([A-Z][A-Za-z0-9+]*)/);

    if (!wordMatch) {
      break;
    }

    const afterWord = rest.slice(wordMatch[0].length);

    // "Toolkit Order contents" — include Toolkit; stop before Order (sentence).
    if (/^\s+[a-z]/.test(afterWord)) {
      break;
    }

    cursor += wordMatch[0].length;
  }

  return title.slice(start, cursor).replace(/\s+/g, " ").trim();
}

/**
 * Showcase card title: strip HTML, experiment day numbers ("4 Plastic" →
 * "Plastic"), and portfolio card chrome so Kim-style titles become the
 * product name only ("SomaSpace").
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function showcaseCardTitle(item) {
  let title = decodeHtmlEntities(
    String(item?.title || "").replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

  const url = String(item?.url || "");
  const parts = pathnameParts(url);

  if (parts?.length === 1) {
    const slug = parts[0].replace(/\.(html?|php|aspx?)$/i, "");
    const fromSlug = projectTitleMatchingSlug(title, slug);

    if (fromSlug) {
      return fromSlug;
    }
  }

  if (/\/experiments\//i.test(url)) {
    title = title.replace(/^\d+\s+/, "");
    const summary = String(item?.summary || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Harvest sometimes concatenates "Corkboard" + summary into title.
    if (summary && title.length > summary.length && title.endsWith(summary)) {
      title = title.slice(0, -summary.length).trim();
    }
  }

  return title;
}

/**
 * True when a URL is a photo “view all” / catch-all album under a photos root.
 * @param {unknown} url
 * @returns {boolean}
 */
const PHOTO_AGGREGATOR_ROOTS = new Set([
  "gallery",
  "galleries",
  "albums",
  "photography",
  "photos",
]);

const PHOTO_AGGREGATOR_LEAVES = new Set([
  "all",
  "view-all",
  "viewall",
  "everything",
  "index",
]);

export function isPhotoAggregatorUrl(url) {
  try {
    const parts = new URL(String(url || "")).pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

    if (parts.length < 2) {
      return false;
    }

    return (
      PHOTO_AGGREGATOR_ROOTS.has(parts[0].toLowerCase()) &&
      PHOTO_AGGREGATOR_LEAVES.has(parts[1].toLowerCase())
    );
  } catch {
    return false;
  }
}

/** Roots that hold photo/art albums (collections), not single-image pages. */
const PHOTO_ART_COLLECTION_ROOTS = new Set([
  ...PHOTO_AGGREGATOR_ROOTS,
  "art",
  "illustration",
  "artwork",
]);

/**
 * True when the URL is a photo/art album or year collection (e.g. `/photos/2014/`),
 * not an individual image page under that tree.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isPhotoOrArtCollectionUrl(url) {
  const parts = pathnameParts(url);

  if (!parts || parts.length !== 2) {
    return false;
  }

  const root = parts[0].toLowerCase();
  const leaf = parts[1].toLowerCase();

  return (
    PHOTO_ART_COLLECTION_ROOTS.has(root) && !PHOTO_AGGREGATOR_LEAVES.has(leaf)
  );
}

/**
 * True when the URL is an individual photo/art work under a gallery root
 * (e.g. `/photos/2017/finch-lake-1_jpg.html`), not the album card itself.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isIndividualPhotoOrArtWorkUrl(url) {
  const parts = pathnameParts(url);

  if (!parts || parts.length < 3) {
    return false;
  }

  return PHOTO_ART_COLLECTION_ROOTS.has(parts[0].toLowerCase());
}

/**
 * Pathname parts for a content URL, or null when unparseable.
 * @param {unknown} url
 * @returns {string[] | null}
 */
function pathnameParts(url) {
  try {
    return new URL(String(url || "")).pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * True when this URL is a creative series folder that only lists child works
 * (e.g. `/experiments/weird-web-october-2026/` with day toys underneath).
 * Individual leaves like `/experiments/corkboard/` stay eligible.
 * @param {unknown} url
 * @param {Iterable<string>} siblingUrls
 * @returns {boolean}
 */
export function isCreativeSeriesHubUrl(url, siblingUrls) {
  const parts = pathnameParts(url);

  if (!parts || parts.length !== 2 || !CREATIVE_INDEX_ROOT.test(parts[0])) {
    return false;
  }

  // Year/album photo and art collections keep a Showcase card even when
  // individual frames under them are also in the content index.
  if (PHOTO_ART_COLLECTION_ROOTS.has(parts[0].toLowerCase())) {
    return false;
  }

  const prefix = `/${parts[0].toLowerCase()}/${parts[1].toLowerCase()}/`;
  const siblings = Array.isArray(siblingUrls) ? siblingUrls : [];

  for (const sibling of siblings) {
    const other = pathnameParts(sibling);

    if (!other || other.length <= 2) {
      continue;
    }

    const otherPath = `/${other.map((part) => part.toLowerCase()).join("/")}/`;

    if (otherPath.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * True when the item came from a client portfolio table crawl.
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function isPortfolioSourcedItem(item) {
  if (item.source_kind === "portfolio") {
    return true;
  }

  if (
    item.source &&
    typeof item.source === "object" &&
    /** @type {{ kind?: unknown }} */ (item.source).kind === "portfolio"
  ) {
    return true;
  }

  if (Array.isArray(item.source_feeds)) {
    return item.source_feeds.some(
      (feed) =>
        feed &&
        typeof feed === "object" &&
        /** @type {{ type?: unknown }} */ (feed).type === "portfolio",
    );
  }

  return false;
}

/**
 * Client case-study URLs under /work/… or /portfolio/… (not public toys).
 * @param {unknown} url
 * @returns {boolean}
 */
export function isClientCaseStudyUrl(url) {
  try {
    const parts = new URL(String(url || "")).pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

    return parts.length >= 2 && /^(work|portfolio)$/i.test(parts[0]);
  } catch {
    return false;
  }
}

/**
 * True when the item has a remote https or local activity poster.
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
function hasHttpsPoster(item) {
  if (typeof item.image !== "string" || !item.image) {
    return false;
  }

  return (
    item.image.startsWith("https://") ||
    item.image.startsWith("/assets/activity/posters/")
  );
}

/**
 * Showcase must have something to see or read—no empty year chips.
 * Photography/art/video require an https poster; other kinds need a real
 * title or summary beyond a bare year.
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function showcaseItemHasSubstance(item) {
  const kind = showcaseKindForItem(item);
  const title = String(item.title || "").trim();
  const summary = String(item.summary || "").trim();
  const yearOnly = /^\d{4}$/.test(title);
  const sourceKind =
    item.source && typeof item.source === "object"
      ? String(/** @type {{ kind?: unknown }} */ (item.source).kind || "")
      : "";

  // Channel cards and external watch links may lack publisher posters.
  if (
    sourceKind === "elsewhere-channel" ||
    sourceKind === "videos-watch-link"
  ) {
    return title.length >= 4;
  }

  if (kind === "comics" || kind === "education") {
    return (
      hasHttpsPoster(item) ||
      summary.length >= 12 ||
      (title.length >= 4 && !yearOnly)
    );
  }

  if (kind === "photography" || kind === "art" || kind === "video") {
    return hasHttpsPoster(item);
  }

  // Sheet music gets a generated score preview during views:build when needed.
  if (kind === "sheet music") {
    return (
      hasHttpsPoster(item) ||
      (typeof item.image === "string" && item.image.startsWith("/assets/")) ||
      title.length >= 8
    );
  }

  if (hasHttpsPoster(item)) {
    return true;
  }

  if (yearOnly && summary.length < 12) {
    return false;
  }

  return summary.length >= 24 || (title.length >= 8 && !yearOnly);
}

/**
 * Interleave imaged and non-imaged cards so Corkboard is not starved when
 * other experiments on the same origin already have OG posters.
 * @param {Array<Record<string, unknown>>} items
 * @returns {Array<Record<string, unknown>>}
 */
function interleaveImagedItems(items) {
  const withImage = [];
  const withoutImage = [];

  for (const item of items) {
    if (hasHttpsPoster(item)) {
      withImage.push(item);
    } else {
      withoutImage.push(item);
    }
  }

  /** @type {Array<Record<string, unknown>>} */
  const out = [];
  const max = Math.max(withImage.length, withoutImage.length);

  for (let index = 0; index < max; index += 1) {
    if (index < withImage.length) {
      out.push(withImage[index]);
    }

    if (index < withoutImage.length) {
      out.push(withoutImage[index]);
    }
  }

  return out;
}

/**
 * True when a compact content item belongs in the creative Showcase.
 * Individual experiments under /experiments/… are eligible; the folder is not.
 * Client portfolio case studies are never Showcase cards.
 * @param {Record<string, unknown> | null | undefined} item
 * @param {{ siblingUrls?: Iterable<string> }} [options]
 * @returns {boolean}
 */
export function isMadeContentItem(item, options = {}) {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (typeof item.url !== "string" || !item.url) {
    return false;
  }

  if (isJoshternetHubContentUrl(item.url)) {
    return false;
  }

  // A member homepage is not a Showcase project. External product roots
  // (themorning.app) attributed to a member stay eligible.
  if (isMemberSiteHomeItem(item)) {
    return false;
  }

  const type = String(item.content_type);
  const educationPast = isPastEducationShowcaseEvent(item);

  // Identity/nav, topics, notes, reading, webrings, feeds—never Showcase,
  // except past education gatherings that live under writing trees.
  if (isShowcaseChromePath(item.url) && !educationPast) {
    return false;
  }

  if (isBareCreativeIndexUrl(item.url)) {
    return false;
  }

  if (isPhotoAggregatorUrl(item.url)) {
    return false;
  }

  // Photography/art Showcase cards are albums/collections only—not single images.
  if (isIndividualPhotoOrArtWorkUrl(item.url)) {
    return false;
  }

  const siblingUrls = Array.isArray(options.siblingUrls)
    ? options.siblingUrls
    : [];

  if (isCreativeSeriesHubUrl(item.url, siblingUrls)) {
    return false;
  }

  if (isPortfolioSourcedItem(item)) {
    return false;
  }

  if (isClientCaseStudyUrl(item.url)) {
    return false;
  }

  const pathKind = creativePathKind(item.url);
  const photoOrArtType =
    type === "photograph" ||
    type === "visual_artwork" ||
    pathKind === "photography" ||
    pathKind === "art";

  // Lone photograph/artwork URLs outside an album path are not Showcase cards.
  if (
    photoOrArtType &&
    !isPhotoOrArtCollectionUrl(item.url) &&
    type !== "collection"
  ) {
    return false;
  }

  // Writing (page_role article or content_type article) is never a Project card
  // unless it lives on a creative path (e.g. /experiments/…).
  const writingShaped =
    type === "article" || String(item.page_role || "") === "article";

  if (writingShaped && !isCreativePathWorkUrl(item.url)) {
    return false;
  }

  const eligibleType =
    SHOWCASE_CONTENT_TYPES.includes(type) ||
    (type === "article" && isCreativePathWorkUrl(item.url)) ||
    educationPast;

  if (!eligibleType) {
    return false;
  }

  // Project/collection cards must live under a creative directory
  // (/projects/…, /experiments/…, /games/…, …), be a named-root studio product
  // (e.g. Kim `/somaspace`), or an off-origin Projects-shelf app (Morning App,
  // MusicX, Seedling). Bare `/work` indexes and member homepages are never
  // projects.
  if (
    (type === "project" || type === "collection") &&
    !isCreativePathWorkUrl(item.url) &&
    !isNamedRootCreativeProduct(item) &&
    !isExternalShelfProject(item)
  ) {
    return false;
  }

  // Photography without a poster (and other empty shells) must not fill Showcase.
  return showcaseItemHasSubstance(item);
}

/**
 * Alias kept for backward compatibility. Prefer {@link isMadeContentItem}.
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {boolean}
 */
export const isShowcaseContentItem = isMadeContentItem;

/**
 * Newest Showcase work first: activity timestamp, then URL descending so year
 * albums without dates still prefer `/photos/2026/` over `/photos/2014/`.
 * @param {Record<string, unknown>} left
 * @param {Record<string, unknown>} right
 * @returns {number}
 */
export function compareShowcaseRecency(left, right) {
  const date = activityTimestamp(right).localeCompare(activityTimestamp(left));

  if (date !== 0) {
    return date;
  }

  return String(right.url || "").localeCompare(String(left.url || ""));
}

/**
 * Label eligible Showcase rows and interleave posters per origin.
 * Each origin’s works are newest-first before interleave.
 * @param {Array<Record<string, unknown>>} compactItems
 * @returns {Array<Record<string, unknown>>}
 */
function eligibleShowcaseItems(compactItems) {
  const list = Array.isArray(compactItems) ? compactItems : [];
  const siblingUrls = list
    .map((item) => (typeof item?.url === "string" ? item.url : ""))
    .filter(Boolean);
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const byOrigin = new Map();

  for (const raw of list) {
    if (!isMadeContentItem(raw, { siblingUrls })) {
      continue;
    }

    const title = showcaseCardTitle(raw);
    const rawSummary = String(raw.summary || "").trim();
    const summary =
      rawSummary.toLowerCase() === title.toLowerCase() ? "" : rawSummary;

    const item = {
      ...raw,
      title,
      summary,
      kind: showcaseKindForItem(raw),
    };
    const key = typeof item.site_origin === "string" ? item.site_origin : "";
    const originList = byOrigin.get(key) || [];
    originList.push(item);
    byOrigin.set(key, originList);
  }

  /** @type {Array<Record<string, unknown>>} */
  const eligible = [];

  for (const key of [...byOrigin.keys()].sort()) {
    const originItems = [...(byOrigin.get(key) || [])].sort(
      compareShowcaseRecency,
    );
    eligible.push(...interleaveImagedItems(originItems));
  }

  return eligible;
}

/**
 * Showcase video cards from member YouTube / Vimeo / Twitch channel profiles.
 * @param {unknown} network
 * @param {string} [observedAt]
 * @returns {Array<Record<string, unknown>>}
 */
export function channelItemsFromNetwork(network, observedAt = "") {
  /** @type {Array<Record<string, unknown>>} */
  const items = [];
  const channelNetworks = new Set(["youtube", "vimeo", "twitch"]);
  const list = Array.isArray(network) ? network : [];

  for (const site of list) {
    if (!site || typeof site !== "object") {
      continue;
    }

    const origin =
      typeof site.origin === "string"
        ? site.origin
        : typeof site.url === "string"
          ? site.url
          : "";

    if (!origin) {
      continue;
    }

    const siteTitle =
      (typeof site.title === "string" && site.title) ||
      (typeof site.domain === "string" && site.domain) ||
      origin;
    const elsewhere = Array.isArray(site.elsewhere) ? site.elsewhere : [];

    for (const link of elsewhere) {
      if (!link || typeof link !== "object") {
        continue;
      }

      const networkId = String(link.network || "");

      if (!channelNetworks.has(networkId)) {
        continue;
      }

      const href = typeof link.url === "string" ? link.url : "";

      if (!href) {
        continue;
      }

      if (networkId === "youtube") {
        try {
          const first = new URL(href).pathname
            .split("/")
            .filter(Boolean)[0]
            ?.toLowerCase();

          if (first === "watch") {
            continue;
          }
        } catch {
          continue;
        }
      }

      const label = (typeof link.label === "string" && link.label) || networkId;

      items.push({
        identity: `channel:${origin}:${networkId}`,
        url: href,
        site_origin: origin,
        title: `${siteTitle} on ${label}`,
        summary: `${label} channel`,
        content_type: "video",
        page_role: "project",
        site_title: siteTitle,
        domain: typeof site.domain === "string" ? site.domain : "",
        source: { kind: "elsewhere-channel", network: networkId },
        observed_at: observedAt || new Date().toISOString(),
        actions: [
          {
            label: "Watch",
            url: href,
            type: "watch",
          },
        ],
      });
    }
  }

  return items;
}

/**
 * Showcase strip grouped by kind. Includes every eligible work (no global max).
 * Within each kind, items are newest-first (published_at / observed_at, then
 * URL). Fair-per-origin selection still applies when a limit is set. An
 * optional `limit` truncates only for tests or callers that ask for a short
 * list.
 * @param {Array<Record<string, unknown>>} compactItems
 * @param {number} [limit]
 * @returns {Array<Record<string, unknown>>}
 */
export function buildMadeItems(compactItems, limit) {
  const eligible = eligibleShowcaseItems(compactItems);
  const maxItems =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(0, Math.floor(limit))
      : eligible.length;
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const byKind = new Map(
    SHOWCASE_KIND_ORDER.map((kind) => [
      kind,
      /** @type {Array<Record<string, unknown>>} */ ([]),
    ]),
  );

  for (const item of eligible) {
    const kind = SHOWCASE_KIND_ORDER.includes(String(item.kind))
      ? String(item.kind)
      : "other";
    byKind.get(kind)?.push(item);
  }

  // byKind is pre-populated for every entry in SHOWCASE_KIND_ORDER, so
  // .get(kind) is always defined here; no || [] fallback needed.
  const kindsPresent = SHOWCASE_KIND_ORDER.filter(
    (kind) =>
      /** @type {Array<Record<string, unknown>>} */ (byKind.get(kind)).length >
      0,
  );
  const perKind = Math.max(
    1,
    Math.floor(maxItems / Math.max(1, kindsPresent.length)),
  );
  /** @type {Array<Record<string, unknown>>} */
  const result = [];

  for (const kind of kindsPresent) {
    const remaining = maxItems - result.length;

    if (remaining <= 0) {
      break;
    }

    result.push(
      ...fairTopicArticles(
        byKind.get(kind) || [],
        Math.min(perKind, remaining),
      ),
    );
  }

  if (result.length < maxItems) {
    const seen = new Set(result.map((item) => String(item.url)));
    const rest = eligible.filter((item) => !seen.has(String(item.url)));
    result.push(...fairTopicArticles(rest, maxItems - result.length));
  }

  const rank = new Map(SHOWCASE_KIND_ORDER.map((kind, index) => [kind, index]));

  return [...result].sort((left, right) => {
    // rank is built from SHOWCASE_KIND_ORDER; all items in result have their kind
    // normalized to a SHOWCASE_KIND_ORDER entry, so .get() is always defined.
    const leftRank = /** @type {number} */ (rank.get(String(left.kind)));
    const rightRank = /** @type {number} */ (rank.get(String(right.kind)));

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return compareShowcaseRecency(left, right);
  });
}

/** Showcase kinds allowed on the homepage creative strip. */
const HOME_SHOWCASE_KINDS = new Set([
  "project",
  "games",
  "photography",
  "music",
  "podcasts",
  "video",
  "comics",
  "education",
]);

/**
 * Homepage creative strip: one newest game, project, photograph, or music
 * work per member × kind. No publish-date window—undated works compete via
 * {@link compareShowcaseRecency} (`published_at`, then `observed_at`, then
 * URL). An optional `limit` truncates after the per-member-per-kind pick.
 * @param {Array<Record<string, unknown>>} compactItems
 * @param {number} [limit]
 * @returns {Array<Record<string, unknown>>}
 */
export function buildShowcaseHomeItems(compactItems, limit) {
  const eligible = eligibleShowcaseItems(compactItems)
    .filter((item) => HOME_SHOWCASE_KINDS.has(String(item.kind)))
    .sort(compareShowcaseRecency);

  /** @type {Map<string, Record<string, unknown>>} */
  const byOriginKind = new Map();

  for (const item of eligible) {
    const origin = typeof item.site_origin === "string" ? item.site_origin : "";
    const key = `${origin}\0${String(item.kind)}`;

    if (!byOriginKind.has(key)) {
      byOriginKind.set(key, item);
    }
  }

  const selected = [...byOriginKind.values()]
    .filter((item) => typeof item.site_origin === "string" && item.site_origin)
    .sort(compareShowcaseRecency);
  const maxItems =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(0, Math.floor(limit))
      : selected.length;

  return selected.slice(0, maxItems);
}

/**
 * Alias kept for backward compatibility. Prefer {@link buildMadeItems}.
 * @param {Array<Record<string, unknown>>} compactItems
 * @param {number} [limit]
 * @returns {Array<Record<string, unknown>>}
 */
export const buildShowcaseItems = buildMadeItems;

/**
 * Showcase rows for What's New: every dated Showcase work inside the activity
 * window (multi-item per origin), so creative latest is not hidden behind a
 * same-origin article and multiple new toys from one site can appear together.
 * Undated works are omitted—crawl `observed_at` is not a publish date.
 * @param {Array<Record<string, unknown>>} compactItems
 * @param {Date | string} now
 * @param {number} [windowDays]
 * @returns {Array<Record<string, unknown>>}
 */
export function showcaseItemsForActivity(
  compactItems,
  now,
  windowDays = ACTIVITY_WINDOW_DAYS,
) {
  const showcase = buildMadeItems(compactItems);
  const inWindow = showcase.filter(
    (item) =>
      typeof item.published_at === "string" &&
      item.published_at &&
      publishedWithinDays(item.published_at, now, windowDays),
  );

  return uniqueActivityItemsByUrl(inWindow);
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
    overlap_count: pairs.length,
    pairs,
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

  return unicodeLetterTokens(query);
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

  const title = normalizeUnicodeText(
    String(document.title || ""),
  ).toLowerCase();
  const summary = normalizeUnicodeText(
    String(document.summary || ""),
  ).toLowerCase();
  const domain = normalizeUnicodeText(
    String(document.domain || ""),
  ).toLowerCase();
  const topics = normalizeUnicodeText(
    (document.topics || []).join(" "),
  ).toLowerCase();
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
 * Filters compact content items down to upcoming or ongoing events,
 * sorted chronologically by start time.
 * Hub items are excluded. Requires a dependable `start` date field.
 * @param {Array<Record<string, unknown>>} compactItems
 * @param {Date} [now]
 * @returns {Array<Record<string, unknown>>}
 */
export function buildHappeningItems(compactItems, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now));

  if (!Number.isFinite(nowMs)) {
    return [];
  }

  const upcoming = (compactItems || []).filter((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    if (String(item.content_type) !== "event") {
      return false;
    }

    if (isJoshternetHubContentUrl(item.url)) {
      return false;
    }

    // Mere mentions (blog cites of someone else's event) stay out of Happening.
    const role =
      typeof item.attribution_role === "string" ? item.attribution_role : "";

    if (role === "mention") {
      return false;
    }

    // Cancelled events are never shown as upcoming.
    const status = typeof item.status === "string" ? item.status : "";

    if (/cancelled|canceled/i.test(status)) {
      return false;
    }

    const startStr = typeof item.start === "string" ? item.start : "";

    if (!startStr) {
      return false;
    }

    const startMs = Date.parse(startStr);

    if (!Number.isFinite(startMs)) {
      return false;
    }

    // Upcoming: start is in the future.
    if (startMs > nowMs) {
      return true;
    }

    // Ongoing: started but not yet ended.
    const endStr = typeof item.end === "string" ? item.end : "";
    const endMs = endStr ? Date.parse(endStr) : NaN;

    return Number.isFinite(endMs) && endMs > nowMs;
  });

  upcoming.sort((left, right) => {
    // Items that reach the sort always have a valid start (filter guarantees it).
    const leftMs = Date.parse(String(left.start));
    const rightMs = Date.parse(String(right.start));
    const diff = leftMs - rightMs;

    if (diff !== 0) {
      return diff;
    }

    return String(left.url ?? "").localeCompare(String(right.url ?? ""));
  });

  return upcoming;
}

/**
 * Returns a stable UID for an iCalendar VEVENT derived from the item URL.
 * @param {string} url
 * @returns {string}
 */
function icsUid(url) {
  // Use a deterministic slug from the URL so UIDs survive rebuilds.
  return `${encodeURIComponent(url)}@joshternet.org`;
}

/**
 * Formats a date string as an iCalendar DATE-TIME value (UTC).
 * Returns an empty string when the value is not parseable.
 * @param {string} value
 * @returns {string}
 */
function icsDateTime(value) {
  if (!value) {
    return "";
  }

  const ms = Date.parse(value);

  if (!Number.isFinite(ms)) {
    return "";
  }

  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/**
 * Generates an iCalendar (RFC 5545) document for upcoming/ongoing events.
 * Entry UIDs are stable (derived from the item URL) so calendar clients can
 * sync without duplicates. Does not embed full descriptions or private data.
 * @param {Array<Record<string, unknown>>} happeningItems
 * @param {{ prodId?: string }} [options]
 * @returns {string}
 */
export function buildEventIcs(happeningItems, options = {}) {
  const prodId = options.prodId
    ? String(options.prodId)
    : "-//Joshternet//Happening//EN";
  const items = Array.isArray(happeningItems) ? happeningItems : [];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Happening on the Joshternet",
  ];

  for (const item of items) {
    const dtstart = icsDateTime(item.start ? String(item.start) : "");

    if (!dtstart) {
      continue;
    }

    const dtend = icsDateTime(item.end ? String(item.end) : "");
    let uidBase;

    if (item.url) {
      uidBase = item.url;
    } else if (item.title) {
      uidBase = item.title;
    } else {
      uidBase = dtstart;
    }

    const uid = icsUid(String(uidBase));
    const rawTitle = item.title ? String(item.title) : "";
    const summary = (rawTitle || "Event").replace(/\r\n|\r|\n/g, " ");
    const url = item.url ? String(item.url) : "";

    let location = "";

    if (item.venue) {
      location = String(item.venue);
    } else if (item.location) {
      location = String(item.location);
    }

    let organizer = "";

    if (item.site_title) {
      organizer = String(item.site_title);
    } else if (item.site_origin) {
      organizer = String(item.site_origin);
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${dtstart}`);

    if (dtend) {
      lines.push(`DTEND:${dtend}`);
    }

    lines.push(`SUMMARY:${summary}`);

    if (url) {
      lines.push(`URL:${url}`);
    }

    if (location) {
      lines.push(`LOCATION:${location}`);
    }

    if (organizer) {
      const siteOrigin = item.site_origin ? String(item.site_origin) : "";
      lines.push(`ORGANIZER;CN=${organizer}:${siteOrigin}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n") + "\r\n";
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
 *   showcase: Record<string, unknown>,
 *   happening: Record<string, unknown>,
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
  const compactFromContent = contentItems
    .map((item) => compactContentItem(item, sites, publicSlugs))
    .filter(Boolean);
  const channelCompact = channelItemsFromNetwork(
    input.network || [],
    input.generatedAt,
  );
  const compactItems = [...compactFromContent, ...channelCompact];
  const recentItems = contentItems.filter(
    (item) =>
      item &&
      publishedWithinDays(item.published_at, clock, ACTIVITY_WINDOW_DAYS) &&
      !isJoshternetHubContentUrl(item.url),
  );
  const feedPrimary = oneLatestPerOrigin(recentItems)
    .map((item) => compactContentItem(item, sites, publicSlugs))
    .filter(Boolean);
  // Showcase creative works join What's New so "latest" is not articles-only.
  // Dated Showcase rows in the window are included in full (not one-per-origin),
  // so a same-origin note cannot hide a newly published experiment/toy.
  const showcasePrimary = showcaseItemsForActivity(
    compactItems,
    clock,
    ACTIVITY_WINDOW_DAYS,
  );
  const primary = uniqueActivityItemsByUrl([
    ...feedPrimary,
    ...showcasePrimary,
  ]);

  const types = [
    ...new Set(
      primary.map((item) => String(item.content_type || "")).filter(Boolean),
    ),
  ].sort();

  const activity = {
    schema_version: 1,
    generated_at: input.generatedAt,
    window_days: ACTIVITY_WINDOW_DAYS,
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
      recent: fairTopicArticles(matching, matching.length),
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
      topics: (Array.isArray(item.tags) ? item.tags : []).map(
        (topic) => topic.label,
      ),
      site_title: item.site_title,
      published_at: item.published_at,
      image: item.image,
      image_origin: item.image_origin,
      language: normalizeLanguageTag(item.language) || "",
      content_type: item.content_type || "",
    });
  }

  const searchIndexDocuments = searchDocuments;
  const showcaseItemsRaw = buildShowcaseItems(compactItems);
  const showcaseHome = buildShowcaseHomeItems(compactItems);
  /** @type {Map<string, number>} */
  const kindCounts = new Map();

  for (const item of showcaseItemsRaw) {
    const kind = String(item.kind || "other");
    kindCounts.set(kind, (kindCounts.get(kind) || 0) + 1);
  }

  const showcaseKinds = SHOWCASE_KIND_ORDER.filter((kind) =>
    kindCounts.has(kind),
  );
  /** @type {Record<string, string>} */
  const kindLabels = {};

  for (const kind of showcaseKinds) {
    kindLabels[kind] = showcaseKindLabel(kind, kindCounts.get(kind));
  }

  const showcaseItems = showcaseItemsRaw.map((item) => ({
    ...item,
    kind_label: kindLabels[String(item.kind)],
  }));

  const happeningItems = buildHappeningItems(
    compactItems,
    input.now || new Date(input.generatedAt),
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
    showcase: {
      schema_version: 1,
      generated_at: input.generatedAt,
      item_count: showcaseItems.length,
      kinds: showcaseKinds,
      kind_labels: kindLabels,
      items: showcaseItems,
      home: showcaseHome,
    },
    happening: {
      schema_version: 1,
      generated_at: input.generatedAt,
      item_count: happeningItems.length,
      items: happeningItems,
    },
  };
}

/**
 * Escapes text for Atom XML element content and attributes.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeAtomText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Builds an Atom 1.0 document from What's New primary items.
 * Entry ids are stable article URLs. Does not republish full article bodies.
 * @param {{
 *   primary?: Array<Record<string, unknown>>,
 *   generated_at?: string,
 * }} activity
 * @param {{ hubOrigin?: string, feedPath?: string }} [options]
 * @returns {string}
 */
export function buildActivityAtomXml(activity, options = {}) {
  const hubOrigin = options.hubOrigin || "https://joshternet.org";
  const feedPath = options.feedPath || "/assets/activity/atom.xml";
  const feedUrl = `${hubOrigin}${feedPath}`;
  const selfHtml = `${hubOrigin}/activity/`;
  const generatedAt =
    typeof activity?.generated_at === "string" && activity.generated_at
      ? activity.generated_at
      : new Date(0).toISOString();
  const primary = Array.isArray(activity?.primary) ? activity.primary : [];

  /** @type {string[]} */
  const entries = [];

  for (const item of primary) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const url = typeof item.url === "string" ? item.url.trim() : "";

    if (!/^https:\/\//i.test(url)) {
      continue;
    }

    const title =
      typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : url;
    const summary =
      typeof item.summary === "string" && item.summary.trim()
        ? item.summary.trim()
        : "";
    const published = activityTimestamp(item) || generatedAt;
    const siteTitle =
      typeof item.site_title === "string" && item.site_title.trim()
        ? item.site_title.trim()
        : typeof item.domain === "string"
          ? item.domain
          : "Independent website";
    const siteOrigin =
      typeof item.site_origin === "string" &&
      item.site_origin.startsWith("https://")
        ? item.site_origin
        : "";
    const language = normalizeLanguageTag(item.language);
    const langAttr = language ? ` xml:lang="${escapeAtomText(language)}"` : "";

    const authorUri = siteOrigin
      ? `\n      <uri>${escapeAtomText(siteOrigin)}</uri>`
      : "";

    const summaryXml = summary
      ? `\n    <summary${langAttr}>${escapeAtomText(summary)}</summary>`
      : "";

    entries.push(`  <entry${langAttr}>
    <id>${escapeAtomText(url)}</id>
    <title${langAttr}>${escapeAtomText(title)}</title>
    <updated>${escapeAtomText(published)}</updated>
    <published>${escapeAtomText(published)}</published>
    <link rel="alternate" href="${escapeAtomText(url)}"/>
    <author>
      <name>${escapeAtomText(siteTitle)}</name>${authorUri}
    </author>${summaryXml}
  </entry>`);
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeAtomText(feedUrl)}</id>
  <title>Joshternet What's New</title>
  <updated>${escapeAtomText(generatedAt)}</updated>
  <link rel="self" type="application/atom+xml" href="${escapeAtomText(feedUrl)}"/>
  <link rel="alternate" type="text/html" href="${escapeAtomText(selfHtml)}"/>
  <subtitle>Recent articles from independent websites participating in the Joshternet. Entries link to the original publishers.</subtitle>
  <generator uri="${escapeAtomText(hubOrigin)}/">Joshternet views:build</generator>
${entries.join("\n")}
</feed>
`;
}
