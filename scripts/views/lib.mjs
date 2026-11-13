/**
 * Goal & Constraints:
 * Deterministic UI projections from canonical graph data. Never invent
 * communities, directed connections, scores, or friendship. Shared topics
 * on /connections/ are neighborhood overlaps, not connections.json edges.
 * Public neighborhoods come only from topics.communities. Visitor copy never
 * includes tfidf-v1.
 */

import { itemsFromCollection } from "../network/collections.mjs";
import {
  decodeHtmlEntities,
  personNameFromSelfIntro,
} from "../network/lib.mjs";
import {
  destinationOriginsFromEntry,
  isNetworkEntryPromoted,
  promoteNetworkOrigin,
  secondaryToPrimaryFromNetwork,
} from "../network/site-families.mjs";
import { isShowcaseChromePath } from "../network/slash-pages.mjs";
import { isEmptyAppearanceTitle } from "../nlp/appearance-title.mjs";
import { isEpisodeAnnouncement } from "../nlp/content.mjs";
import { isNonSubjectSlug } from "../nlp/evidence.mjs";
import { itemMentionsTopic, textMentionsSlug } from "../nlp/match.mjs";
import { isCssBattleShowTitle } from "../nlp/show-classification.mjs";
import { youtubeVideoIdFromHref } from "../nlp/youtube-feeds.mjs";
import { normalizeLanguageTag, readableSummary } from "../nlp/text.mjs";
import {
  normalizeUnicodeText,
  unicodeLetterTokens,
} from "../nlp/unicode-text.mjs";

/** Live What's New / Activity window (publisher publish dates). */
export const ACTIVITY_WINDOW_DAYS_LIVE = 14;

/**
 * Local-dev Activity window — full writing retention band in `_data/content.json`.
 * Live stays at {@link ACTIVITY_WINDOW_DAYS_LIVE}.
 */
export const ACTIVITY_WINDOW_DAYS_DEV = 30;

/**
 * Resolve Activity window days for views:build.
 * Development (`JEKYLL_ENV=development`) or `JOSHTERNET_ACTIVITY_WINDOW_DAYS=30`
 * → 30 days; otherwise production 14. Tests and CI keep the live default.
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {number}
 */
export function resolveActivityWindowDays(env = process.env) {
  const source = env && typeof env === "object" ? env : {};
  const override = String(source.JOSHTERNET_ACTIVITY_WINDOW_DAYS || "").trim();

  if (override === "30") {
    return ACTIVITY_WINDOW_DAYS_DEV;
  }

  if (override === "14") {
    return ACTIVITY_WINDOW_DAYS_LIVE;
  }

  if (String(source.JEKYLL_ENV || "").toLowerCase() === "development") {
    return ACTIVITY_WINDOW_DAYS_DEV;
  }

  return ACTIVITY_WINDOW_DAYS_LIVE;
}

/**
 * Default Activity window (live / tests). Prefer {@link resolveActivityWindowDays}
 * at views:build so local previews can use the 30-day retention band.
 */
export const ACTIVITY_WINDOW_DAYS = ACTIVITY_WINDOW_DAYS_LIVE;

/** Showcase Books eligibility window (publisher publish dates only). */
export const BOOKS_WINDOW_DAYS = 365;

/**
 * Showcase window for dated portfolio/project archive rows
 * (`/projects|/portfolio|/work` children and portfolio-sourced items).
 * Mirrors books: Year: 2022 stays out of the catalog.
 */
export const PROJECTS_WINDOW_DAYS = 365;

/**
 * Max Showcase cards from one origin inside a single kind section.
 * Keeps large catalogs (year albums, daily uploads) from crowding out peers.
 */
export const SHOWCASE_MAX_PER_ORIGIN_PER_KIND = 2;

/**
 * Max What's New primary rows from one origin (feed + Showcase combined).
 */
export const ACTIVITY_MAX_PER_ORIGIN = 2;

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
  "comic",
  "game",
  "collection",
  "project",
  "presentation",
];

/**
 * Default Showcase section order: A–Z by kind key; `other` stays last.
 * Only kinds with items are emitted; later these become /showcase/ subpages.
 * @type {readonly string[]}
 */
export const SHOWCASE_KIND_ORDER = Object.freeze([
  "apps",
  "art",
  "books",
  "comics",
  "design",
  "education",
  "games",
  "guides",
  "music",
  "photography",
  "podcasts",
  "project",
  "sheet music",
  "software",
  "talks",
  "video",
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
  podcasts: Object.freeze([
    "Podcasts and live streams",
    "Podcasts and live streams",
  ]),
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
  talks: Object.freeze(["Talks & Presentations", "Talks & Presentations"]),
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
 * Publisher name for Activity / Showcase attribution.
 * Prefer Network card title; when that is still a host label, lift a person
 * name from the self-intro description (e.g. “I’m Chris Minnick…”).
 * @param {Record<string, unknown> | null | undefined} site
 * @param {string} origin
 * @returns {string}
 */
export function publisherDisplayTitle(site, origin = "") {
  const record = site && typeof site === "object" ? site : {};
  const domain = String(record.domain || "");
  const title = String(record.title || "").trim();
  // Person-shaped titles include whitespace ("Chris Minnick"). Host labels and
  // domain restatements do not — try a self-intro before falling back.
  if (title && /\s/.test(title)) {
    return title;
  }

  let hostLabel = domain;

  if (!hostLabel && typeof origin === "string" && origin) {
    hostLabel = origin.replace(/^https?:\/\//i, "").split("/")[0] || origin;
  }

  const description = String(record.description || "");
  const fromIntro = personNameFromSelfIntro(description, hostLabel);

  if (fromIntro) {
    return fromIntro;
  }

  return title || domain || origin || "";
}

/**
 * Title key for cross-post dedupe (blog vs podcast / video of the same piece).
 * @param {unknown} title
 * @returns {string}
 */
export function contentTitleDedupeKey(title) {
  return String(title || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rank cross-posted variants so a written article or note beats a same-title
 * video or podcast. An episode announcement loses to the episode.
 * @param {Record<string, unknown>} item
 * @returns {number}
 */
function crosspostPreferenceScore(item) {
  const type = String(item.content_type || "");
  let score = 0;

  if (type === "podcast_episode" || type === "video") {
    score += 40;
  } else if (
    type === "episode_announcement" ||
    isEpisodeAnnouncement(item.title, item.summary, item.url)
  ) {
    score += 0;
  } else if (type === "article" || type === "note") {
    score += 50;
  } else {
    score += 20;
  }

  if (typeof item.image === "string" && item.image.startsWith("https://")) {
    score += 5;
  }

  return score;
}

/**
 * Group key for one dedupe pass. Empty keys are not collapsed.
 * @param {Array<Record<string, unknown>>} list
 * @param {(item: Record<string, unknown>) => string} keyFor
 * @param {(item: Record<string, unknown>) => number} [scoreFor]
 * @returns {Map<string, Record<string, unknown>>}
 */
function crosspostWinners(list, keyFor, scoreFor = crosspostPreferenceScore) {
  /** @type {Map<string, Record<string, unknown>>} */
  const winners = new Map();

  for (const item of list) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const key = keyFor(item);

    if (!key) {
      continue;
    }

    const existing = winners.get(key);

    if (!existing || scoreFor(item) > scoreFor(existing)) {
      winners.set(key, item);
    }
  }

  return winners;
}

/**
 * Hash-stripped absolute URL for cross-source Showcase dedupe.
 * @param {unknown} url
 * @returns {string}
 */
function hashStrippedContentUrl(url) {
  if (typeof url !== "string" || !url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url.split("#")[0] || "";
  }
}

/**
 * Prefer the identity without a URL fragment when two url: rows share a page.
 * @param {Record<string, unknown>} item
 * @returns {number}
 */
function urlIdentityFragmentScore(item) {
  const identity = String(item.identity);
  let score = crosspostPreferenceScore(item) * 10;

  if (identity.startsWith("url:") && !identity.includes("#")) {
    score += 3;
  }

  return score;
}

/**
 * Drop same-origin same-title crossposts, same-origin YouTube watch ids, and
 * url:-identity twins that differ only by a hash fragment (#gallery).
 * Presentation/event identities that share an archive URL stay distinct.
 * @param {Array<Record<string, unknown>>} items
 * @returns {Array<Record<string, unknown>>}
 */
export function dedupeCrosspostedContentItems(items) {
  const list = Array.isArray(items) ? items : [];
  const byTitle = crosspostWinners(list, (item) => {
    const origin = String(item.site_origin || "");
    const key = contentTitleDedupeKey(item.title);

    return origin && key ? `${origin}\0${key}` : "";
  });
  const byVideo = crosspostWinners(list, (item) => {
    const origin = String(item.site_origin || "");
    const videoId = youtubeVideoIdFromHref(item.url);

    return origin && videoId ? `${origin}\0video:${videoId}` : "";
  });
  // Only url: identities — presentation:/event: keys sharing /speaking/ stay.
  const byHashStrippedUrl = crosspostWinners(
    list,
    (item) => {
      const identity = String(item.identity || "");

      if (!identity.startsWith("url:")) {
        return "";
      }

      const origin = String(item.site_origin || "");
      const key = hashStrippedContentUrl(item.url);

      return origin && key ? `${origin}\0url:${key}` : "";
    },
    urlIdentityFragmentScore,
  );

  return list.filter((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const origin = String(item.site_origin || "");
    const titleKey = contentTitleDedupeKey(item.title);
    const videoId = youtubeVideoIdFromHref(item.url);
    const identity = String(item.identity || "");
    const urlKey =
      identity.startsWith("url:") && hashStrippedContentUrl(item.url)
        ? hashStrippedContentUrl(item.url)
        : "";

    if (!origin || (!titleKey && !videoId && !urlKey)) {
      return true;
    }

    if (titleKey && byTitle.get(`${origin}\0${titleKey}`) !== item) {
      return false;
    }

    if (videoId && byVideo.get(`${origin}\0video:${videoId}`) !== item) {
      return false;
    }

    if (urlKey && byHashStrippedUrl.get(`${origin}\0url:${urlKey}`) !== item) {
      return false;
    }

    return true;
  });
}

/**
 * True when a row is writing for What's New: an article or note, or an
 * untyped post, that is not an episode announcement.
 * @param {unknown} item
 * @returns {boolean}
 */
export function isWritingActivityItem(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const record = /** @type {Record<string, unknown>} */ (item);
  const type = String(record.content_type || "");

  if (type && type !== "article" && type !== "note") {
    return false;
  }

  return !isEpisodeAnnouncement(record.title, record.summary, record.url);
}

/**
 * Keep at most `maxPerOrigin` items per `site_origin` (input order preserved).
 * @param {Array<Record<string, unknown>>} items
 * @param {number} [maxPerOrigin]
 * @returns {Array<Record<string, unknown>>}
 */
export function fairPerOriginLimit(
  items,
  maxPerOrigin = SHOWCASE_MAX_PER_ORIGIN_PER_KIND,
) {
  const parsed = Number(maxPerOrigin);
  const max =
    Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed)
      : SHOWCASE_MAX_PER_ORIGIN_PER_KIND;
  /** @type {Map<string, number>} */
  const counts = new Map();
  /** @type {Array<Record<string, unknown>>} */
  const out = [];

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const origin = String(item.site_origin || "");
    const used = counts.get(origin) || 0;

    if (used >= max) {
      continue;
    }

    counts.set(origin, used + 1);
    out.push(item);
  }

  return out;
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
 * Strip HTML tags from harvested titles/summaries (e.g. Astro span wrappers).
 * @param {unknown} value
 * @returns {string}
 */
export function stripHtmlToText(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when a URL points at a static media file or CMS upload asset, not a work page.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isStaticMediaFileUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    const path = parsed.pathname;

    if (
      /\.(jpe?g|png|gif|webp|avif|svg|mp3|m4a|aac|ogg|flac|wav|opus|mp4|webm|mov)(\?|$)/i.test(
        path,
      )
    ) {
      return true;
    }

    // Extension-less CMS uploads (figures linked without a file suffix).
    if (/\/wp-content\/uploads\//i.test(path)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
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
  const strippedTitle = stripHtmlToText(rawTitle) || String(rawTitle);
  const title =
    photoAlbumDisplayTitle(strippedTitle, item.content_type, item.url) ||
    strippedTitle;
  const rawSummary = typeof item.summary === "string" ? item.summary : "";
  const decodedSummary = stripHtmlToText(rawSummary);
  // Title-echo summaries (common on year albums) add noise on Showcase cards.
  const summaryEqualsTitle =
    decodedSummary.trim().toLowerCase() ===
      String(title).trim().toLowerCase() ||
    decodedSummary.trim().toLowerCase() ===
      String(strippedTitle).trim().toLowerCase();
  const summary = summaryEqualsTitle ? "" : readableSummary(decodedSummary);

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
    site_title: publisherDisplayTitle(site, origin),
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

  if (typeof item.start_precision === "string" && item.start_precision) {
    compact.start_precision = item.start_precision;
  }

  if (typeof item.conference === "string" && item.conference) {
    compact.conference = item.conference;
  }

  if (typeof item.identity === "string" && item.identity) {
    compact.identity = item.identity;
  }

  if (Array.isArray(item.resources) && item.resources.length > 0) {
    compact.resources = item.resources;
  }

  if (Array.isArray(item.related) && item.related.length > 0) {
    compact.related = item.related;
  }

  // Prefer a concrete card target when the work URL is only the speaking
  // archive index (many talks otherwise share one /speaking/ link): slides or
  // recording first, then action_url, then a distinct #identity hash.
  if (String(item.content_type || "") === "presentation") {
    const onArchiveIndex = /\/(speaking|talks)\/?$/i.test(String(item.url));
    const resources = Array.isArray(item.resources) ? item.resources : [];
    const slides = resources.find(
      (resource) =>
        resource &&
        typeof resource === "object" &&
        /** @type {{ kind?: unknown }} */ (resource).kind === "slides" &&
        typeof (/** @type {{ url?: unknown }} */ (resource).url) === "string",
    );
    const recording = resources.find(
      (resource) =>
        resource &&
        typeof resource === "object" &&
        /** @type {{ kind?: unknown }} */ (resource).kind === "recording" &&
        typeof (/** @type {{ url?: unknown }} */ (resource).url) === "string",
    );
    const preferred = slides || recording;
    const actionUrl =
      typeof item.action_url === "string" ? item.action_url.trim() : "";

    if (
      preferred &&
      onArchiveIndex &&
      typeof (/** @type {{ url?: unknown }} */ (preferred).url) === "string"
    ) {
      compact.url = /** @type {{ url: string }} */ (preferred).url;
    } else if (
      onArchiveIndex &&
      actionUrl &&
      !/\/(speaking|talks)\/?$/i.test(actionUrl)
    ) {
      compact.url = actionUrl;
    } else if (
      onArchiveIndex &&
      typeof item.identity === "string" &&
      item.identity
    ) {
      // Distinct card targets when many talks share one archive index URL.
      const slug = item.identity.split(":").filter(Boolean).pop() || "";

      if (slug && !String(item.url).includes("#")) {
        compact.url = `${String(item.url).replace(/\/?$/, "/")}#${slug}`;
      }
    }
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
    case "comic":
      return "comics";
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
    case "presentation":
      return "talks";
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
  /^(gallery|galleries|albums|photography|photos|art|illustration|artwork|paintings?|graphics?|fiction|comics?|webcomics|toys?|play|reels?|shorts|cssbattles?|music|discography|tracks|videos|film|animation|games|game|interactive|exhibitions|design|portfolio|work|projects?|experiments?|sounds?|apps?|software|books?|guides?|resources?|shows?|concerts?|events?|podcasts?|study-hall|frontend-study-hall|front-end-study-hall|fresh|education|learn|classes?|courses?)$/i;

/**
 * Showcase kind inferred from a creative child path (e.g. /experiments/corkboard/).
 * Bare `/painting(s)/` is treated as an art album hub.
 * @param {unknown} url
 * @returns {string} Kind slug, or "" when not a creative child URL.
 */
export function creativePathKind(url) {
  try {
    const parts = new URL(String(url || "")).pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

    // Painting gallery hubs are themselves Showcase Art albums.
    if (parts.length === 1 && /^paintings?$/i.test(parts[0])) {
      return "art";
    }

    if (parts.length < 2 || !CREATIVE_INDEX_ROOT.test(parts[0])) {
      return "";
    }

    const root = parts[0].toLowerCase();

    // `/film/` is film-stock photography (e.g. joshozuna.com), not motion video.
    if (/^(gallery|galleries|albums|photography|photos|film)$/.test(root)) {
      return "photography";
    }

    if (/^(art|illustration|artwork|paintings?|graphics?)$/.test(root)) {
      return "art";
    }

    if (/^fiction$/.test(root)) {
      return "books";
    }

    if (/^(comics?|webcomics)$/.test(root)) {
      return "comics";
    }

    if (/^(toys?|play)$/.test(root)) {
      return "project";
    }

    if (/^(reels?|shorts)$/.test(root)) {
      return "video";
    }

    // CSS Battle pages are a recurring show, filed with podcasts and live streams.
    if (/^cssbattles?$/.test(root)) {
      return "podcasts";
    }

    if (/^(music|discography|tracks|sounds?)$/.test(root)) {
      return "music";
    }

    if (/^podcasts?$/.test(root)) {
      return "podcasts";
    }

    if (/^(videos|animation)$/.test(root)) {
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

/**
 * Kind for a Showcase card from content_type, categories, and creative path.
 * CSS Battle recordings join podcasts and live streams.
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
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

  // `/film/…` galleries must stay Photography even when harvest typed them video.
  // Do not blanket-prefer photography paths: `/albums/` can be music albums.
  if (fromPath === "photography" && String(item.content_type) === "video") {
    return "photography";
  }

  const fromType = showcaseKind(
    item.content_type,
    Array.isArray(item.categories) ? item.categories : [],
  );

  // YouTube watches, first-party /videos/ works, show paths, and CSS Battle
  // recordings live under Podcasts and live streams—not a separate Videos kind.
  if (fromType === "video") {
    const sourceKind =
      item.source && typeof item.source === "object"
        ? String(/** @type {{ kind?: unknown }} */ (item.source).kind || "")
        : typeof item.source_kind === "string"
          ? item.source_kind
          : "";

    if (
      fromPath === "podcasts" ||
      fromPath === "video" ||
      isCssBattleShowTitle(item.title) ||
      isYoutubeWatchUrl(item.url) ||
      sourceKind === "elsewhere-youtube-video" ||
      sourceKind.startsWith("youtube-show-")
    ) {
      return "podcasts";
    }
  }

  // Prefer path over a generic project/other type so /books/… → books,
  // /painting/… → art, comics/education paths, etc.
  if ((fromType === "project" || fromType === "other") && fromPath) {
    return fromPath;
  }

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

    // Bare /painting(s)/ is an Art album card, not an empty index shell.
    if (/^paintings?$/i.test(leaf)) {
      return false;
    }

    return CREATIVE_INDEX_ROOT.test(leaf);
  } catch {
    return false;
  }
}

/**
 * Licensing / reuse / permissions pages are never Showcase works.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isCreativeUtilityPath(url) {
  try {
    const parts = new URL(String(url || "")).pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean)
      .map((part) => part.replace(/\.(html?|php|aspx?)$/i, "").toLowerCase());

    if (parts.length === 0) {
      return false;
    }

    return /^(image-use|imageuse|licensing|license|attribution|copyright|reuse|permissions)$/i.test(
      parts[parts.length - 1],
    );
  } catch {
    return false;
  }
}

/**
 * True when a bare `/sounds|music|tracks|discography` URL is itself a music work.
 * @param {unknown} item
 * @returns {boolean}
 */
export function isMusicIndexWorkItem(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const type = String(
    /** @type {{ content_type?: unknown }} */ (item).content_type || "",
  );

  if (type !== "music_recording" && type !== "music_album") {
    return false;
  }

  try {
    const parts = new URL(String(item.url || "")).pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

    if (parts.length !== 1) {
      return false;
    }

    return /^(music|discography|tracks|sounds?)$/i.test(parts[0]);
  } catch {
    return false;
  }
}

/**
 * Expand bare year album titles (`2026`) to visitor-facing `2026 photos`.
 * @param {unknown} title
 * @param {unknown} contentType
 * @param {unknown} url
 * @returns {string}
 */
export function photoAlbumDisplayTitle(title, contentType, url) {
  const text = String(title || "").trim();

  if (!/^\d{4}$/.test(text)) {
    return text;
  }

  const type = String(contentType || "");
  const pathKind = creativePathKind(url);
  const photoShaped =
    type === "photograph" ||
    type === "collection" ||
    pathKind === "photography";

  if (!photoShaped) {
    return text;
  }

  return `${text} photos`;
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
 * "02 M.A. Thesis · Installation ProductName …" (zero-padded portfolio chrome).
 * Single leading digits alone are ordinary prose ("4 Hours for This…"), not
 * portfolio indexes.
 * @param {unknown} title
 * @returns {boolean}
 */
export function isPortfolioIndexedProjectTitle(title) {
  return /^\d{2}\s+\S/.test(String(title || "").trim());
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
 * (homepage link text like a product name, not a blog sentence).
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
 * (numbered portfolio cards, schema SoftwareApplication rows, or short
 * homepage link titles that match the slug).
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

  // Schema.org markup does not by itself make a single-segment URL a product.
  // A sitemap ItemList can carry creative-schema and still be a directory.
  return isExactSlugProductTitle(item.title, item.url);
}

/**
 * True when a project was harvested from a member Projects/Products shelf and
 * the work URL lives off-origin (shelf app links).
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
 * ("… Product Webcams…" + `/product` → "Product").
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

/** Leading articles / small counts stripped before summary title modifiers. */
const SLUG_TITLE_SUMMARY_LEADING_DROP = new Set([
  "a",
  "an",
  "the",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
]);

/**
 * When a bare slug product title (e.g. "Skills") appears in the summary with
 * short Title Case modifiers ("Nine Claude Code skills…"), return the fuller
 * product name ("Claude Code Skills").
 * @param {unknown} title
 * @param {unknown} summary
 * @returns {string} Expanded title, or "" when no safe expansion exists.
 */
export function expandSlugTitleFromSummary(title, summary) {
  const head = String(title || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!head || /\s/.test(head)) {
    return "";
  }

  const text = decodeHtmlEntities(
    String(summary || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();

  if (!text) {
    return "";
  }

  const words = text.split(/\s+/).filter(Boolean);
  const headLower = head.toLowerCase();
  /** @type {string[] | null} */
  let best = null;

  for (let index = 0; index < words.length; index += 1) {
    const token = words[index].replace(/[^A-Za-z0-9+]/g, "");

    if (!token || token.toLowerCase() !== headLower) {
      continue;
    }

    /** @type {string[]} */
    const modifiers = [];
    let cursor = index - 1;

    while (cursor >= 0 && modifiers.length < 4) {
      const clean = words[cursor].replace(/[^A-Za-z0-9+]/g, "");

      if (!clean) {
        cursor -= 1;
        continue;
      }

      const isTitleCase = /^[A-Z][A-Za-z0-9+]*$/.test(clean);
      const isDrop =
        SLUG_TITLE_SUMMARY_LEADING_DROP.has(clean.toLowerCase()) ||
        /^\d+$/.test(clean);

      if (!isTitleCase && !isDrop) {
        break;
      }

      modifiers.unshift(clean);
      cursor -= 1;

      if (
        modifiers.filter(
          (word) =>
            !SLUG_TITLE_SUMMARY_LEADING_DROP.has(word.toLowerCase()) &&
            !/^\d+$/.test(word),
        ).length >= 3
      ) {
        break;
      }
    }

    while (
      modifiers.length > 0 &&
      (SLUG_TITLE_SUMMARY_LEADING_DROP.has(modifiers[0].toLowerCase()) ||
        /^\d+$/.test(modifiers[0]))
    ) {
      modifiers.shift();
    }

    if (modifiers.length < 1) {
      continue;
    }

    const titledHead =
      head.charAt(0).toUpperCase() + head.slice(1).toLowerCase();
    const candidate = [...modifiers, titledHead];

    if (!best || candidate.length < best.length) {
      best = candidate;
    }
  }

  return best ? best.join(" ") : "";
}

/**
 * Showcase card title: strip HTML, experiment day numbers ("4 Plastic" →
 * "Plastic"), and portfolio card chrome so numbered titles become the product
 * name only. Bare slug titles may expand from summary modifiers
 * ("Skills" + "Nine Claude Code skills…" → "Claude Code Skills").
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function showcaseCardTitle(item) {
  let title = stripHtmlToText(item?.title);
  title = photoAlbumDisplayTitle(title, item?.content_type, item?.url) || title;

  const url = String(item?.url || "");
  const parts = pathnameParts(url);

  if (parts?.length === 1) {
    const slug = parts[0].replace(/\.(html?|php|aspx?)$/i, "");
    const fromSlug = projectTitleMatchingSlug(title, slug);

    if (fromSlug) {
      if (fromSlug.toLowerCase() === title.toLowerCase()) {
        const expanded = expandSlugTitleFromSummary(fromSlug, item?.summary);

        if (expanded) {
          return expanded;
        }
      }

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
  "painting",
  "paintings",
  // Film-stock galleries (e.g. /film/kodak-portra), not motion video.
  "film",
]);

/**
 * True when the URL is a photo/art album or year collection (e.g. `/photos/2014/`),
 * not an individual image page under that tree. Bare `/painting(s)/` hubs count.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isPhotoOrArtCollectionUrl(url) {
  const parts = pathnameParts(url);

  if (!parts || parts.length === 0) {
    return false;
  }

  const root = parts[0].toLowerCase();

  if (parts.length === 1) {
    return root === "painting" || root === "paintings";
  }

  if (parts.length !== 2) {
    return false;
  }

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
 * Also treats `/work/?work=…` query-style case studies (Baker-style).
 * @param {unknown} url
 * @returns {boolean}
 */
export function isClientCaseStudyUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    const parts = parsed.pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean);

    if (parts.length >= 2 && /^(work|portfolio)$/i.test(parts[0])) {
      return true;
    }

    // Single-segment /work with a work= (or project=) query is a case study card.
    if (
      parts.length === 1 &&
      /^(work|portfolio)$/i.test(parts[0]) &&
      (parsed.searchParams.has("work") || parsed.searchParams.has("project"))
    ) {
      return true;
    }

    return false;
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
    typeof item.source_kind === "string" && item.source_kind
      ? item.source_kind
      : item.source && typeof item.source === "object"
        ? String(/** @type {{ kind?: unknown }} */ (item.source).kind || "")
        : "";

  // Channel cards and external watch/listen/project links may lack posters.
  if (
    sourceKind === "elsewhere-channel" ||
    sourceKind === "videos-watch-link" ||
    sourceKind === "elsewhere-youtube-video" ||
    sourceKind === "sounds-listen-link" ||
    sourceKind === "sounds-project-link"
  ) {
    return title.length >= 4 || hasHttpsPoster(item);
  }

  if (kind === "comics" || kind === "education" || kind === "talks") {
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
 * True when a content item is a comics-hub strip (often under `/blog/…`).
 * These bypass the writing-tree Showcase chrome gate. Harvest always sets
 * `content_type: "comic"` for hub-listed posts.
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
function isComicsHubShowcaseItem(item) {
  return item.content_type === "comic";
}

/**
 * True when a compact content item belongs in the creative Showcase.
 * Individual experiments under /experiments/… are eligible; the folder is not.
 * Client portfolio case studies are never Showcase cards.
 * @param {Record<string, unknown> | null | undefined} item
 * @param {{
 *   siblingUrls?: Iterable<string>,
 *   now?: Date | string,
 *   activityWindowDays?: number,
 * }} [options]
 * @returns {boolean}
 */
export function isMadeContentItem(item, options = {}) {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (typeof item.url !== "string" || !item.url) {
    return false;
  }

  const earlyType = String(item.content_type || "");

  // Speaking/event chrome titles ("2 min read", ", 2026") are never Showcase.
  if (
    (earlyType === "presentation" || earlyType === "event") &&
    isEmptyAppearanceTitle(item.title)
  ) {
    return false;
  }

  if (isJoshternetHubContentUrl(item.url)) {
    return false;
  }

  // YouTube Elsewhere channel pages are never Showcase cards—episode/watch
  // uploads only (Podcasts and live streams).
  if (shouldOmitYoutubeChannelCard(item)) {
    return false;
  }

  // Licensing / image-use / permissions pages are never Showcase works.
  if (isCreativeUtilityPath(item.url)) {
    return false;
  }

  // Direct media / CMS uploads are never Showcase works.
  if (isStaticMediaFileUrl(item.url)) {
    return false;
  }

  // A member homepage is not a Showcase project. External product roots
  // (themorning.app) attributed to a member stay eligible.
  if (isMemberSiteHomeItem(item)) {
    return false;
  }

  const type = String(item.content_type);
  const educationPast = isPastEducationShowcaseEvent(item);
  const clock =
    options.now instanceof Date
      ? options.now
      : typeof options.now === "string" && options.now
        ? new Date(options.now)
        : new Date();

  // Identity/nav, topics, notes, reading, webrings, feeds—never Showcase,
  // except past education gatherings and comics-hub strips that live under
  // writing trees (`/blog/…` listed from `/comics/`).
  if (
    isShowcaseChromePath(item.url) &&
    !educationPast &&
    !isComicsHubShowcaseItem(item) &&
    type !== "presentation"
  ) {
    return false;
  }

  if (isBareCreativeIndexUrl(item.url) && !isMusicIndexWorkItem(item)) {
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

  // Client case studies stay out. Portfolio table rows on creative paths
  // (e.g. /projects/8bip) remain eligible; bare portfolio indexes do not.
  if (isClientCaseStudyUrl(item.url)) {
    return false;
  }

  if (isPortfolioSourcedItem(item) && !isCreativePathWorkUrl(item.url)) {
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
  // (/projects/…, /experiments/…, /games/…, …), be a named-root studio product,
  // or an off-origin Projects-shelf app. Bare `/work` indexes and member
  // homepages are never projects.
  if (
    (type === "project" || type === "collection") &&
    !isCreativePathWorkUrl(item.url) &&
    !isNamedRootCreativeProduct(item) &&
    !isExternalShelfProject(item)
  ) {
    return false;
  }

  // Portfolio archives, books, and /experiments/ children need a real
  // publisher date inside the Showcase window. Never invent dates.
  if (isOutsideCreativeDatingWindow(item, clock)) {
    return false;
  }

  const publishedAt =
    typeof item.published_at === "string" && item.published_at.trim()
      ? item.published_at.trim()
      : "";

  const activityWindowDays =
    typeof options.activityWindowDays === "number" &&
    Number.isFinite(options.activityWindowDays) &&
    options.activityWindowDays > 0
      ? Math.floor(options.activityWindowDays)
      : ACTIVITY_WINDOW_DAYS;

  // Podcast episodes: only the Activity window (new videos), not the back catalog.
  if (type === "podcast_episode") {
    if (
      !publishedAt ||
      !publishedWithinDays(publishedAt, clock, activityWindowDays)
    ) {
      return false;
    }
  }

  // YouTube watch URLs under Videos: same Activity window as podcast episodes.
  if (type === "video" && isYoutubeWatchUrl(item.url)) {
    if (
      !publishedAt ||
      !publishedWithinDays(publishedAt, clock, activityWindowDays)
    ) {
      return false;
    }
  }

  // Photography without a poster (and other empty shells) must not fill Showcase.
  return showcaseItemHasSubstance(item);
}

/**
 * True when the URL is a YouTube watch / youtu.be video page.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isYoutubeWatchUrl(url) {
  if (typeof url !== "string") {
    return false;
  }

  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname;

    if (host === "youtu.be") {
      return path.length > 1;
    }

    if (host !== "youtube.com" && !host.endsWith(".youtube.com")) {
      return false;
    }

    if (path === "/watch") {
      return true;
    }

    if (path.startsWith("/watch/")) {
      return true;
    }

    return path.startsWith("/shorts/");
  } catch {
    return false;
  }
}

/**
 * Site origins that already have YouTube watch rows inside the Activity window
 * (video or podcast_episode). Kept for callers that still key off watch
 * presence; Showcase drops YouTube channel pages unconditionally.
 * @param {unknown} items
 * @param {Date | string} clock
 * @param {number} [windowDays]
 * @returns {Set<string>}
 */
export function youtubeWatchOriginsInWindow(
  items,
  clock,
  windowDays = ACTIVITY_WINDOW_DAYS,
) {
  /** @type {Set<string>} */
  const origins = new Set();
  const list = Array.isArray(items) ? items : [];
  const days =
    typeof windowDays === "number" &&
    Number.isFinite(windowDays) &&
    windowDays > 0
      ? Math.floor(windowDays)
      : ACTIVITY_WINDOW_DAYS;

  for (const item of list) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const type = String(
      /** @type {{ content_type?: unknown }} */ (item).content_type || "",
    );

    if (type !== "video" && type !== "podcast_episode") {
      continue;
    }

    if (!isYoutubeWatchUrl(item.url)) {
      continue;
    }

    if (!publishedWithinDays(item.published_at, clock, days)) {
      continue;
    }

    if (typeof item.site_origin !== "string" || !item.site_origin) {
      continue;
    }

    origins.add(item.site_origin);
  }

  return origins;
}

/**
 * True when a YouTube Elsewhere channel card should be omitted from Showcase.
 * Channel pages never appear as cards—only episode/watch uploads do.
 * @param {unknown} item
 * @param {Set<string>} [_watchOrigins] Unused; retained for call-site compat.
 * @returns {boolean}
 */
export function shouldOmitYoutubeChannelCard(item, _watchOrigins) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const source = /** @type {{ source?: unknown }} */ (item).source;

  if (!source || typeof source !== "object") {
    return false;
  }

  const typed = /** @type {{ kind?: unknown, network?: unknown }} */ (source);

  if (typed.kind !== "elsewhere-channel") {
    return false;
  }

  return typed.network === "youtube";
}

/**
 * True when the URL is an /experiments/ (or /experiment/) child work page,
 * not the index hub itself.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isExperimentChildUrl(url) {
  try {
    const path = new URL(String(url || "")).pathname.toLowerCase();
    return /\/experiments?\/[^/]+/i.test(path);
  } catch {
    return false;
  }
}

/**
 * True when the item is a portfolio/project archive row that needs a recent
 * publisher date for Showcase (undated and aged years are excluded).
 * Live shelf apps, named-root products, and art/photo albums are not archive
 * rows. Experiment children are dated separately via
 * {@link isOutsideCreativeDatingWindow}.
 * @param {Record<string, unknown>} item
 * @param {string} pathKind
 * @returns {boolean}
 */
function isProjectArchiveShowcaseRow(item, pathKind) {
  if (isPhotoOrArtCollectionUrl(item.url)) {
    return false;
  }

  if (
    pathKind === "art" ||
    pathKind === "photography" ||
    pathKind === "comics"
  ) {
    return false;
  }

  // First-party shelf apps and named studio products may omit publish dates.
  if (isExternalShelfProject(item) || isNamedRootCreativeProduct(item)) {
    return false;
  }

  if (isPortfolioSourcedItem(item)) {
    return true;
  }

  // /projects|/portfolio|/work children (Drake / Stübner-shaped archives).
  try {
    const path = new URL(String(item.url)).pathname.toLowerCase();
    return /\/(projects?|portfolio|work)\/[^/]+/i.test(path);
  } catch {
    return false;
  }
}

/**
 * True when dated creative (project archive, books, experiment children) is
 * undated or outside the Showcase year window. Does not invent publish dates.
 * Named-root products, shelf apps, and art/photo albums are not gated here.
 * @param {Record<string, unknown> | null | undefined} item
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isOutsideCreativeDatingWindow(item, now = new Date()) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const clock =
    now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const pathKind = creativePathKind(item.url);
  const publishedAt =
    typeof item.published_at === "string" && item.published_at.trim()
      ? item.published_at.trim()
      : "";

  if (isProjectArchiveShowcaseRow(item, pathKind)) {
    if (
      !publishedAt ||
      !publishedWithinDays(publishedAt, clock, PROJECTS_WINDOW_DAYS)
    ) {
      return true;
    }
  }

  if (pathKind === "books" || showcaseKindForItem(item) === "books") {
    if (
      !publishedAt ||
      !publishedWithinDays(publishedAt, clock, BOOKS_WINDOW_DAYS)
    ) {
      return true;
    }
  }

  // Undated /experiments/ leaves are archival — never invent dates from
  // observed_at or sequence slugs.
  if (isExperimentChildUrl(item.url)) {
    if (
      !publishedAt ||
      !publishedWithinDays(publishedAt, clock, PROJECTS_WINDOW_DAYS)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Alias kept for backward compatibility. Prefer {@link isMadeContentItem}.
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {boolean}
 */
export const isShowcaseContentItem = isMadeContentItem;

/**
 * Prefer publisher date, else crawl observation (for display gates).
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function contentDisplayTimestamp(item) {
  if (typeof item.published_at === "string" && item.published_at) {
    return item.published_at;
  }

  if (typeof item.observed_at === "string" && item.observed_at) {
    return item.observed_at;
  }

  return "";
}

/**
 * True when a content row may appear on visitor writing surfaces (Activity
 * window) or is durable Showcase creative (catalog stays visible). Live uses
 * 14 days; local views:build may pass 30 so the retention band is previewable.
 * @param {Record<string, unknown> | null | undefined} item
 * @param {Date | string} now
 * @param {number} [windowDays]
 * @returns {boolean}
 */
export function isVisitorFacingContentItem(
  item,
  now,
  windowDays = ACTIVITY_WINDOW_DAYS,
) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const type = String(
    typeof item.content_type === "string" ? item.content_type : "",
  ).trim();

  if (
    SHOWCASE_CONTENT_TYPES.includes(type) ||
    type === "event" ||
    isMadeContentItem(item)
  ) {
    return true;
  }

  let sourceKind = "";

  if (typeof item.source_kind === "string") {
    sourceKind = item.source_kind;
  } else if (item.source && typeof item.source === "object") {
    const kind = /** @type {{ kind?: unknown }} */ (item.source).kind;
    if (typeof kind === "string") {
      sourceKind = kind;
    }
  }

  if (sourceKind === "portfolio" || sourceKind.startsWith("creative-")) {
    return true;
  }

  const days =
    typeof windowDays === "number" &&
    Number.isFinite(windowDays) &&
    windowDays > 0
      ? Math.floor(windowDays)
      : ACTIVITY_WINDOW_DAYS;

  return publishedWithinDays(contentDisplayTimestamp(item), now, days);
}

/**
 * True when a Showcase/content row is a portfolio project. Undated projects
 * must not use crawl `observed_at` as freshness (archives look brand-new).
 * @param {Record<string, unknown> | null | undefined} item
 * @returns {boolean}
 */
export function isShowcasePortfolioProject(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  return (
    item.kind === "project" ||
    item.content_type === "project" ||
    item.page_role === "project" ||
    item.source_kind === "portfolio"
  );
}

/**
 * Crawl observation time used for Showcase ranking. Empty for undated
 * portfolio/project rows so they sort as archival instead of "just crawled."
 * @param {Record<string, unknown> | null | undefined} item
 * @param {string} publishedAt
 * @returns {string}
 */
function showcaseObservedAtForRecency(item, publishedAt) {
  if (publishedAt) {
    return typeof item?.observed_at === "string" && item.observed_at
      ? item.observed_at
      : "";
  }

  if (isShowcasePortfolioProject(item)) {
    return "";
  }

  return typeof item?.observed_at === "string" && item.observed_at
    ? item.observed_at
    : "";
}

/**
 * Newest Showcase work first. Real `published_at` always ranks above undated
 * crawl-time items. Undated portfolio/project rows ignore `observed_at`
 * (assume archival). Among other undated peers, newer `observed_at` then URL.
 * @param {Record<string, unknown>} left
 * @param {Record<string, unknown>} right
 * @returns {number}
 */
export function compareShowcaseRecency(left, right) {
  const leftPublished =
    typeof left?.published_at === "string" && left.published_at
      ? left.published_at
      : "";
  const rightPublished =
    typeof right?.published_at === "string" && right.published_at
      ? right.published_at
      : "";

  if (leftPublished || rightPublished) {
    if (leftPublished && rightPublished) {
      const published = rightPublished.localeCompare(leftPublished);

      if (published !== 0) {
        return published;
      }
    } else if (leftPublished) {
      return -1;
    } else {
      return 1;
    }
  }

  const leftObserved = showcaseObservedAtForRecency(left, leftPublished);
  const rightObserved = showcaseObservedAtForRecency(right, rightPublished);

  if (leftObserved || rightObserved) {
    const observed = rightObserved.localeCompare(leftObserved);

    if (observed !== 0) {
      return observed;
    }
  }

  return String(right?.url || "").localeCompare(String(left?.url || ""));
}

/**
 * Label eligible Showcase rows and interleave posters per origin.
 * Each origin’s works are newest-first before interleave.
 * @param {Array<Record<string, unknown>>} compactItems
 * @param {Date | string} [now]
 * @returns {Array<Record<string, unknown>>}
 */
function eligibleShowcaseItems(compactItems, now, activityWindowDays) {
  const list = dedupeCrosspostedContentItems(
    Array.isArray(compactItems) ? compactItems : [],
  );
  const siblingUrls = list
    .map((item) => (typeof item?.url === "string" ? item.url : ""))
    .filter(Boolean);
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const byOrigin = new Map();
  /** @type {{ siblingUrls: string[], now?: Date | string, activityWindowDays?: number }} */
  const madeOptions = { siblingUrls };

  if (now) {
    madeOptions.now = now;
  }

  if (
    typeof activityWindowDays === "number" &&
    Number.isFinite(activityWindowDays) &&
    activityWindowDays > 0
  ) {
    madeOptions.activityWindowDays = Math.floor(activityWindowDays);
  }

  /** Presentation identities in this pass — education events defer to them. */
  const presentationIds = new Set(
    list
      .filter((item) => String(item.content_type) === "presentation")
      .map((item) => String(item.identity || ""))
      .filter(Boolean),
  );

  for (const raw of list) {
    if (!isMadeContentItem(raw, madeOptions)) {
      continue;
    }

    // Prefer the presentation card over a related past education event.
    // Same-title pairs are already collapsed by dedupeCrosspostedContentItems.
    if (
      String(raw.content_type) === "event" &&
      isPastEducationShowcaseEvent(raw, now || new Date())
    ) {
      const related = Array.isArray(raw.related) ? raw.related : [];
      const coveredByRelated = related.some(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          /** @type {{ relation?: unknown }} */ (entry).relation ===
            "presentation" &&
          presentationIds.has(
            String(/** @type {{ id?: unknown }} */ (entry).id || ""),
          ),
      );

      if (coveredByRelated) {
        continue;
      }
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
 * Optional publishByUrl maps channel URL → latest upload ISO time (from
 * channel-publish enrich). Undated channels are still returned here; callers
 * that build Showcase / Activity must gate with publishedWithinDays.
 * @param {unknown} network
 * @param {string} [observedAt]
 * @param {Record<string, string> | null | undefined} [publishByUrl]
 * @returns {Array<Record<string, unknown>>}
 */
export function channelItemsFromNetwork(
  network,
  observedAt = "",
  publishByUrl = null,
) {
  /** @type {Array<Record<string, unknown>>} */
  const items = [];
  const channelNetworks = new Set(["youtube", "vimeo", "twitch"]);
  const list = Array.isArray(network) ? network : [];
  const dates =
    publishByUrl &&
    typeof publishByUrl === "object" &&
    !Array.isArray(publishByUrl)
      ? publishByUrl
      : {};

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

    const siteTitle = publisherDisplayTitle(
      /** @type {Record<string, unknown>} */ (site),
      origin,
    );
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
      const published =
        typeof dates[href] === "string" && dates[href] ? dates[href] : "";

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
        ...(published ? { published_at: published } : {}),
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
 * Showcase strip grouped by kind (A–Z sections). Includes every eligible work
 * (no global max). Within each kind, items are newest `published_at` first
 * ({@link compareShowcaseRecency}). Fair-per-origin selection still applies
 * when a limit is set. Optional `now` pins age gates for tests.
 * @param {Array<Record<string, unknown>>} compactItems
 * @param {number} [limit]
 * @param {Date | string} [now]
 * @returns {Array<Record<string, unknown>>}
 */
export function buildMadeItems(compactItems, limit, now, activityWindowDays) {
  const eligible = eligibleShowcaseItems(compactItems, now, activityWindowDays);
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
    /** @type {Array<Record<string, unknown>>} */ (byKind.get(kind)).push(item);
  }

  // Newest publish first within each kind, then cap per origin so one catalog
  // cannot fill a whole Showcase section.
  for (const kind of SHOWCASE_KIND_ORDER) {
    const list = /** @type {Array<Record<string, unknown>>} */ (
      byKind.get(kind)
    );

    if (list.length === 0) {
      continue;
    }

    list.sort(compareShowcaseRecency);
    byKind.set(
      kind,
      fairPerOriginLimit(list, SHOWCASE_MAX_PER_ORIGIN_PER_KIND),
    );
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

    const kindItems = /** @type {Array<Record<string, unknown>>} */ (
      byKind.get(kind)
    );

    // Limited: fair-per-origin across kinds for short lists, then re-sort.
    // Uncapped: already origin-capped per kind above; keep publish order.
    if (typeof limit === "number" && Number.isFinite(limit)) {
      result.push(
        ...fairTopicArticles(kindItems, Math.min(perKind, remaining)).sort(
          compareShowcaseRecency,
        ),
      );
    } else {
      result.push(...kindItems.slice(0, Math.min(perKind, remaining)));
    }
  }

  if (result.length < maxItems) {
    const seen = new Set(result.map((item) => String(item.url)));
    // Only refill from origin-capped kind lists — never reintroduce overflow rows.
    const rest = SHOWCASE_KIND_ORDER.flatMap(
      (kind) =>
        /** @type {Array<Record<string, unknown>>} */ (byKind.get(kind)),
    )
      .filter((item) => !seen.has(String(item.url)))
      .sort(compareShowcaseRecency);

    if (typeof limit === "number" && Number.isFinite(limit)) {
      result.push(
        ...fairTopicArticles(rest, maxItems - result.length).sort(
          compareShowcaseRecency,
        ),
      );
    } else {
      result.push(...rest.slice(0, maxItems - result.length));
    }
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
  "talks",
]);

/**
 * Homepage “Things people are making” card cap.
 * `/showcase/` uses {@link buildMadeItems} and stays uncapped.
 */
export const HOME_SHOWCASE_LIMIT = 6;

/**
 * Homepage creative strip: one newest game, project, photograph, or music
 * work per member × kind. No publish-date window—undated works compete via
 * {@link compareShowcaseRecency} (`published_at`, then `observed_at`, then
 * URL). After that pick, an omitted or non-finite `limit` keeps at most
 * {@link HOME_SHOWCASE_LIMIT} cards in that same order. Pass a finite limit
 * to override, including a larger one. Optional `now` pins age gates for
 * tests and views:build.
 * @param {Array<Record<string, unknown>>} compactItems
 * @param {number} [limit] - Card cap. Defaults to {@link HOME_SHOWCASE_LIMIT}.
 * @param {Date | string} [now]
 * @param {number} [activityWindowDays]
 * @returns {Array<Record<string, unknown>>}
 */
export function buildShowcaseHomeItems(
  compactItems,
  limit,
  now,
  activityWindowDays,
) {
  const eligible = eligibleShowcaseItems(compactItems, now, activityWindowDays)
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
      : HOME_SHOWCASE_LIMIT;

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
  const showcase = buildMadeItems(compactItems, undefined, now, windowDays);
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
 * The Joshternet hub is omitted: it publishes the directory, so pairing it
 * with members only restates that every site is on the network.
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

    if (isJoshternetHubContentUrl(member.origin)) {
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
    if (!isListedEvent(item)) {
      return false;
    }

    const state = eventScheduleState(item, nowMs);

    return state === "upcoming" || state === "ongoing";
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
 * True when a compact item is an event the public calendar may consider.
 * Mentions, cancellations, and hub URLs stay out of both upcoming and past.
 * @param {unknown} item
 * @returns {boolean}
 */
function isListedEvent(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const record = /** @type {Record<string, unknown>} */ (item);

  if (String(record.content_type) !== "event") {
    return false;
  }

  if (isJoshternetHubContentUrl(record.url)) {
    return false;
  }

  if (isEmptyAppearanceTitle(record.title)) {
    return false;
  }

  const role =
    typeof record.attribution_role === "string" ? record.attribution_role : "";

  if (role === "mention") {
    return false;
  }

  const status = typeof record.status === "string" ? record.status : "";

  if (/cancelled|canceled/i.test(status)) {
    return false;
  }

  return true;
}

/**
 * True when the start is a calendar date with no clock time.
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
function isDateOnlyStart(item) {
  if (item.start_precision === "date") {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(String(item.start));
}

/**
 * Upcoming, ongoing, past, or invalid relative to `nowMs`.
 * Date-only events compare calendar days and do not invent a clock time.
 * @param {Record<string, unknown>} item
 * @param {number} nowMs
 * @returns {'upcoming'|'ongoing'|'past'|'invalid'}
 */
function eventScheduleState(item, nowMs) {
  const startStr = typeof item.start === "string" ? item.start : "";

  if (!startStr) {
    return "invalid";
  }

  if (isDateOnlyStart(item)) {
    const today = new Date(nowMs).toISOString().slice(0, 10);
    const startDay = startStr.slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) {
      return "invalid";
    }

    const endStr = typeof item.end === "string" ? item.end : "";
    const endDay = /^\d{4}-\d{2}-\d{2}/.test(endStr) ? endStr.slice(0, 10) : "";

    if (startDay > today) {
      return "upcoming";
    }

    if (startDay === today || (endDay && endDay >= today)) {
      return "ongoing";
    }

    return "past";
  }

  const startMs = Date.parse(startStr);

  if (!Number.isFinite(startMs)) {
    return "invalid";
  }

  if (startMs > nowMs) {
    return "upcoming";
  }

  const endStr = typeof item.end === "string" ? item.end : "";
  const endMs = endStr ? Date.parse(endStr) : NaN;

  if (Number.isFinite(endMs) && endMs > nowMs) {
    return "ongoing";
  }

  return "past";
}

/**
 * Historical events with a verified start, newest first.
 * Upcoming and in-progress events are omitted. Date-only values stay date-only.
 * @param {Array<Record<string, unknown>>} compactItems
 * @param {Date} [now]
 * @returns {Array<Record<string, unknown>>}
 */
export function buildPastEventItems(compactItems, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now));

  if (!Number.isFinite(nowMs)) {
    return [];
  }

  const past = (compactItems || []).filter((item) => {
    if (!isListedEvent(item)) {
      return false;
    }

    return eventScheduleState(item, nowMs) === "past";
  });

  past.sort((left, right) => {
    const leftMs = Date.parse(String(left.start));
    const rightMs = Date.parse(String(right.start));
    const diff = rightMs - leftMs;

    if (diff !== 0) {
      return diff;
    }

    return String(left.url ?? "").localeCompare(String(right.url ?? ""));
  });

  return past;
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
 * iCalendar DATE value (YYYYMMDD) for a date-only start. Empty when invalid.
 * @param {string} value
 * @returns {string}
 */
function icsDateOnly(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  return `${match[1]}${match[2]}${match[3]}`;
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
    const dateOnly =
      item.start_precision === "date" ||
      /^\d{4}-\d{2}-\d{2}$/.test(String(item.start || ""));
    let dtstart = "";
    let dtstartLine = "";
    let dtendLine = "";

    if (dateOnly) {
      dtstart = icsDateOnly(String(item.start || "").slice(0, 10));

      if (!dtstart) {
        continue;
      }

      dtstartLine = `DTSTART;VALUE=DATE:${dtstart}`;
      const endDay = icsDateOnly(
        typeof item.end === "string" ? item.end.slice(0, 10) : "",
      );

      if (endDay) {
        dtendLine = `DTEND;VALUE=DATE:${endDay}`;
      }
    } else {
      dtstart = icsDateTime(item.start ? String(item.start) : "");

      if (!dtstart) {
        continue;
      }

      dtstartLine = `DTSTART:${dtstart}`;
      const dtend = icsDateTime(item.end ? String(item.end) : "");

      if (dtend) {
        dtendLine = `DTEND:${dtend}`;
      }
    }

    let uidBase;

    if (typeof item.identity === "string" && item.identity) {
      uidBase = item.identity;
    } else if (item.url) {
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
    lines.push(dtstartLine);

    if (dtendLine) {
      lines.push(dtendLine);
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
 *   activityWindowDays?: number,
 *   channelPublishByUrl?: Record<string, string>,
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
  const network = Array.isArray(input.network) ? input.network : [];
  const sites = sitesByOrigin(network);
  const secondaryToPrimary = secondaryToPrimaryFromNetwork(network);
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
  const windowDays =
    typeof input.activityWindowDays === "number" &&
    Number.isFinite(input.activityWindowDays) &&
    input.activityWindowDays > 0
      ? Math.floor(input.activityWindowDays)
      : ACTIVITY_WINDOW_DAYS;
  const compactFromContent = dedupeCrosspostedContentItems(
    contentItems
      .map((item) => compactContentItem(item, sites, publicSlugs))
      .filter(Boolean)
      .filter((item) => isVisitorFacingContentItem(item, clock, windowDays)),
  );
  // Elsewhere channels join search when their latest upload published_at
  // falls in the Activity window (undated omitted). YouTube channel pages
  // stay out of Showcase via isMadeContentItem (shouldOmitYoutubeChannelCard)
  // so only watch and episode rows appear under Podcasts and live streams.
  const channelCompact = channelItemsFromNetwork(
    input.network || [],
    input.generatedAt,
    /** @type {Record<string, string> | null | undefined} */ (
      input.channelPublishByUrl
    ),
  ).filter((item) => publishedWithinDays(item.published_at, clock, windowDays));
  const compactItems = [...compactFromContent, ...channelCompact];
  const recentItems = contentItems.filter(
    (item) =>
      item &&
      publishedWithinDays(item.published_at, clock, windowDays) &&
      !isJoshternetHubContentUrl(item.url),
  );
  // What's New is writing only. Episodes, videos, and projects stay on Showcase.
  const writingPrimary = dedupeCrosspostedContentItems(
    recentItems
      .filter(
        (item) =>
          typeof item.site_origin === "string" &&
          item.site_origin &&
          isWritingActivityItem(item),
      )
      .map((item) => compactContentItem(item, sites, publicSlugs))
      .filter(Boolean),
  ).sort((left, right) => {
    const date = activityTimestamp(right).localeCompare(
      activityTimestamp(left),
    );

    if (date !== 0) {
      return date;
    }

    return String(left.url).localeCompare(String(right.url));
  });
  const primary = fairPerOriginLimit(
    uniqueActivityItemsByUrl(writingPrimary),
    ACTIVITY_MAX_PER_ORIGIN,
  );

  const types = [
    ...new Set(
      primary.map((item) => String(item.content_type || "")).filter(Boolean),
    ),
  ].sort();

  const activity = {
    schema_version: 1,
    generated_at: input.generatedAt,
    window_days: windowDays,
    primary_count: primary.length,
    item_count: compactItems.length,
    content_types: types,
    primary,
  };

  const cooccurrence = topicCooccurrence(
    contentItems.filter((item) =>
      isVisitorFacingContentItem(item, clock, windowDays),
    ),
    publicSlugs,
  );
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
        memberOrigins.add(
          promoteNetworkOrigin(member.origin, secondaryToPrimary),
        );
      }
    }

    for (const item of matching) {
      if (typeof item.site_origin === "string" && item.site_origin) {
        memberOrigins.add(
          promoteNetworkOrigin(item.site_origin, secondaryToPrimary),
        );
      }
    }

    const members = [...memberOrigins]
      .map((origin) => {
        const listed = community.sites.find(
          (member) =>
            promoteNetworkOrigin(member?.origin, secondaryToPrimary) === origin,
        );
        const signal = signalsOrigins.find(
          (entry) =>
            promoteNetworkOrigin(entry?.origin, secondaryToPrimary) === origin,
        );
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
        const articles = matching.filter(
          (item) =>
            promoteNetworkOrigin(item.site_origin, secondaryToPrimary) ===
            origin,
        );

        return {
          origin,
          domain: site?.domain || listed?.domain || "",
          title: site?.title || listed?.title || site?.domain || origin,
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
        (member) =>
          member.articles.length > 0 &&
          sites.has(member.origin) &&
          isNetworkEntryPromoted(sites.get(member.origin)),
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

  const siteViews = [...sites.values()]
    .filter((site) => isNetworkEntryPromoted(site))
    .map((site) => {
      const origin = site.origin;
      const familyOrigins = new Set([
        origin,
        ...destinationOriginsFromEntry(site),
      ]);
      const signal = signalsOrigins.find(
        (entry) =>
          promoteNetworkOrigin(entry?.origin, secondaryToPrimary) === origin,
      );
      const outgoing = edges.filter((edge) => familyOrigins.has(edge.from));
      const incoming = edges.filter((edge) => familyOrigins.has(edge.to));
      const communityTopics = communities
        .filter((community) =>
          community.sites.some(
            (member) =>
              promoteNetworkOrigin(member?.origin, secondaryToPrimary) ===
              origin,
          ),
        )
        .map((community) => ({ slug: community.slug, label: community.label }));
      const recent = compactItems.find(
        (item) =>
          promoteNetworkOrigin(item.site_origin, secondaryToPrimary) === origin,
      );

      return {
        origin,
        domain: site.domain,
        title: site.title || site.domain,
        description: site.description || "",
        identity: site.identity,
        feeds: site.feeds || [],
        elsewhere: site.elsewhere || [],
        destinations: Array.isArray(site.destinations) ? site.destinations : [],
        community_topics: communityTopics,
        recent_content: recent || null,
        outgoing: outgoing.map((edge) => ({
          to: promoteNetworkOrigin(edge.to, secondaryToPrimary),
          relation: edge.relation,
          label: relationLabel(String(edge.relation)),
          href: edge.href,
          page: edge.page,
          evidence_count:
            edge.evidence_count || (edge.evidence || []).length || 1,
        })),
        incoming: incoming.map((edge) => ({
          from: promoteNetworkOrigin(edge.from, secondaryToPrimary),
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
    if (!isNetworkEntryPromoted(site)) {
      continue;
    }

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
  const showcaseItemsRaw = buildShowcaseItems(
    compactItems,
    undefined,
    clock,
    windowDays,
  );
  const showcaseHome = buildShowcaseHomeItems(
    compactItems,
    HOME_SHOWCASE_LIMIT,
    clock,
    windowDays,
  );
  /** @type {Map<string, number>} */
  const kindCounts = new Map();

  for (const item of showcaseItemsRaw) {
    // eligibleShowcaseItems always assigns `kind` via showcaseKindForItem.
    const kind = String(item.kind);
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
  const pastEventItems = buildPastEventItems(
    compactItems,
    input.now || new Date(input.generatedAt),
  );
  const pastYears = new Set(
    pastEventItems.map((item) => String(item.start).slice(0, 4)),
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
    past_events: {
      schema_version: 1,
      generated_at: input.generatedAt,
      item_count: pastEventItems.length,
      group_by_year: pastYears.size > 1,
      items: pastEventItems,
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
  <subtitle>A selection of recent writing and creative work from independent websites participating in the Joshternet. Entries link to the original publishers.</subtitle>
  <generator uri="${escapeAtomText(hubOrigin)}/">Joshternet views:build</generator>
${entries.join("\n")}
</feed>
`;
}
