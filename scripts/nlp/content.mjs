/**
 * Goal & Constraints:
 * Normalize feed entries into content.json with canonical URL identity and
 * cross-feed dedupe. Never mirror full article bodies. After join, creative
 * works still missing images fetch the publisher page once for og:image so
 * Showcase can use the site's existing posters (nlp:sync / GitHub Actions).
 */

import { originFromHttpUrl } from "../network/blogroll.mjs";
import { slugifyTopic } from "../network/connections.mjs";
import { SHOWCASE_CONTENT_TYPES } from "../views/lib.mjs";
import { buildTopicEvidence, isCommunityEligibleSource } from "./evidence.mjs";
import { fetchPublicText } from "./lib.mjs";
import { createOriginRobotsGate } from "./origin-robots.mjs";
import {
  MAX_SUMMARY_CHARS,
  MAX_TITLE_CHARS,
  capRemoteString,
  decodeHtmlEntities,
  decodeHrefForParse,
  normalizeExtractedText,
  normalizeLanguageTag,
  posterImageFromHtml,
  shareDescriptionFromHtml,
} from "./text.mjs";

/**
 * Creative index child paths whose publisher pages usually declare og:image.
 * @type {RegExp}
 */
const CREATIVE_WORK_PATH =
  /\/(gallery|galleries|albums|photography|photos|art|illustration|artwork|paintings?|fiction|comics?|webcomics|toys?|play|reels?|shorts|cssbattles?|music|discography|tracks|videos|film|animation|games|game|interactive|exhibitions|design|portfolio|work|projects?|experiments?|sounds?|apps?|software|books?|guides?|resources?|shows?|concerts?|events?|study-hall|frontend-study-hall|front-end-study-hall|fresh|education|learn|classes?|courses?)\/.+/i;

/**
 * First regex capture group, or empty string when absent.
 * Avoids optional-chaining index branches that Node coverage reports flakily.
 * @param {string} text
 * @param {RegExp} pattern
 * @returns {string}
 */
function firstCapture(text, pattern) {
  const match = text.match(pattern);
  return match && match[1] ? match[1] : "";
}

/**
 * Prefers entry-level language, then channel/feed language.
 * @param {string} xml
 * @param {string} chunk
 * @param {boolean} isAtom
 * @returns {string}
 */
function languageFromRssOrAtom(xml, chunk, isAtom) {
  const entryLang =
    firstCapture(chunk, /\bxml:lang=["']([^"']+)["']/i) ||
    firstCapture(chunk, /\blang=["']([^"']+)["']/i) ||
    "";
  const fromEntry = normalizeLanguageTag(entryLang);

  if (fromEntry) {
    return fromEntry;
  }

  if (isAtom) {
    return normalizeLanguageTag(
      firstCapture(xml, /<feed\b[^>]*\bxml:lang=["']([^"']+)["']/i) ||
        firstCapture(xml, /<feed\b[^>]*\blang=["']([^"']+)["']/i) ||
        "",
    );
  }

  return normalizeLanguageTag(
    firstCapture(xml, /<language[^>]*>([\s\S]*?)<\/language>/i) || "",
  );
}

/**
 * Canonical content identity key.
 * @param {{ url?: string, id?: string, feed?: string, siteOrigin?: string }} input
 * @returns {string}
 */
export function contentIdentityKey(input) {
  const url =
    typeof input.url === "string" ? decodeHrefForParse(input.url) : "";

  if (url) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      return `url:${parsed.href}`;
    } catch {
      // fall through
    }
  }

  const id = typeof input.id === "string" ? input.id.trim() : "";
  const site = typeof input.siteOrigin === "string" ? input.siteOrigin : "";
  const feed = typeof input.feed === "string" ? input.feed : "";

  if (id && (site || feed)) {
    return `id:${site || feed}:${id}`;
  }

  return "";
}

/**
 * Strips markup and entities from feed summaries. Never persist HTML.
 * @param {string} htmlOrText
 * @returns {string}
 */
export function plainTextSummary(htmlOrText) {
  if (typeof htmlOrText !== "string" || !htmlOrText) {
    return "";
  }

  const withoutCdata = htmlOrText.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const decoded = decodeHtmlEntities(withoutCdata);
  const withoutTags = decoded.replace(/<[^>]*>/g, " ").replace(/<[^>]*$/g, " ");
  return capRemoteString(withoutTags, MAX_SUMMARY_CHARS);
}

/**
 * Returns an ISO timestamp when value parses as a date, otherwise empty.
 * @param {unknown} value
 * @returns {string}
 */
export function isoDateString(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const time = Date.parse(value);

  if (Number.isNaN(time)) {
    return "";
  }

  return new Date(time).toISOString();
}

/** English month names → 1-based month index for book “Coming …” badges. */
const MONTH_NAME_TO_NUMBER = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/**
 * Maps a 4-digit calendar year to January 1 UTC ISO.
 * @param {unknown} year
 * @returns {string}
 */
export function publishedAtFromYear(year) {
  if (typeof year !== "string") {
    return "";
  }

  const trimmed = year.trim();

  if (!/^(?:19|20)\d{2}$/.test(trimmed)) {
    return "";
  }

  return isoDateString(`${trimmed}-01-01T00:00:00.000Z`);
}

/**
 * Maps a calendar month name + year to the first day of that month (UTC).
 * @param {unknown} monthName
 * @param {unknown} year
 * @returns {string}
 */
export function publishedAtFromMonthYear(monthName, year) {
  if (typeof monthName !== "string" || typeof year !== "string") {
    return "";
  }

  const month = MONTH_NAME_TO_NUMBER[monthName.trim().toLowerCase()];
  const yearIso = publishedAtFromYear(year);

  if (!month || !yearIso) {
    return "";
  }

  const monthToken = String(month).padStart(2, "0");
  return isoDateString(`${year.trim()}-${monthToken}-01T00:00:00.000Z`);
}

/**
 * “Coming April 2027” / “Coming 2027” release badges on member book pages.
 * @param {unknown} text
 * @returns {string}
 */
export function publishedAtFromComingBadge(text) {
  if (typeof text !== "string" || !text) {
    return "";
  }

  const withMonth = text.match(
    /\bComing\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+((?:19|20)\d{2})\b/i,
  );

  if (withMonth) {
    return publishedAtFromMonthYear(withMonth[1], withMonth[2]);
  }

  const yearOnly = firstCapture(text, /\bComing\s+((?:19|20)\d{2})\b/i);

  return publishedAtFromYear(yearOnly);
}

/**
 * “By Author · Publisher · 2026” (or en-dash) credit lines on book detail pages.
 * @param {unknown} text
 * @returns {string}
 */
export function publishedAtFromBookByline(text) {
  if (typeof text !== "string" || !text) {
    return "";
  }

  const year = firstCapture(
    text,
    /\bBy\s+[^<\n]{1,120}?[·•]\s*[^<\n·•]{1,80}?[·•]\s*((?:19|20)\d{2})\b/i,
  );

  return publishedAtFromYear(year);
}

/**
 * First Amazon product / short-link URL in HTML (Buy / Pre-order buttons).
 * @param {unknown} html
 * @returns {string}
 */
export function amazonProductUrlFromHtml(html) {
  if (typeof html !== "string" || !html) {
    return "";
  }

  for (const match of html.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    const href = match[2] || "";

    if (!href) {
      continue;
    }

    try {
      const parsed = new URL(href, "https://www.amazon.com");
      const host = parsed.hostname;

      if (/(^|\.)amzn\.to$/i.test(host)) {
        return parsed.href;
      }

      if (!/(^|\.)amazon\.[a-z.]+$/i.test(host)) {
        continue;
      }

      // Author storefronts are not a single title’s publication date.
      if (
        /\/e\//i.test(parsed.pathname) ||
        /\/stores\//i.test(parsed.pathname)
      ) {
        continue;
      }

      if (/\/(?:dp|gp\/product)\//i.test(parsed.pathname)) {
        return parsed.href;
      }
    } catch {
      // skip bad href
    }
  }

  return "";
}

/**
 * Parses Amazon-style “July 1, 2025” / “1 July 2025” into UTC midnight ISO.
 * Avoids Date.parse local-timezone drift for date-only publisher strings.
 * @param {unknown} value
 * @returns {string}
 */
export function publishedAtFromAmazonDateText(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const text = value.trim();
  const us = text.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+((?:19|20)\d{2})$/i,
  );

  if (us) {
    const month = MONTH_NAME_TO_NUMBER[us[1].toLowerCase()];
    const day = Number(us[2]);
    const year = us[3];

    if (!month || !Number.isFinite(day) || day < 1 || day > 31) {
      return "";
    }

    return isoDateString(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    );
  }

  const eu = text.match(
    /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+((?:19|20)\d{2})$/i,
  );

  if (eu) {
    const day = Number(eu[1]);
    const month = MONTH_NAME_TO_NUMBER[eu[2].toLowerCase()];
    const year = eu[3];

    if (!month || !Number.isFinite(day) || day < 1 || day > 31) {
      return "";
    }

    return isoDateString(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    );
  }

  return isoDateString(text);
}

/**
 * Publication date from an Amazon product HTML body.
 * @param {unknown} html
 * @returns {string}
 */
export function publishedAtFromAmazonHtml(html) {
  if (typeof html !== "string" || !html) {
    return "";
  }

  const fromCarousel = firstCapture(
    html,
    /book_details-publication_date[\s\S]{0,500}?rpi-attribute-value[^>]*>\s*<span>\s*([^<]+)/i,
  );
  const fromCarouselIso = publishedAtFromAmazonDateText(fromCarousel);

  if (fromCarouselIso) {
    return fromCarouselIso;
  }

  const labeled = firstCapture(
    html,
    /Publication date[\s\S]{0,200}?<span[^>]*>\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*</i,
  );

  return publishedAtFromAmazonDateText(labeled);
}

/**
 * Stable lookup key so trailing-slash variants of the same path match.
 * @param {unknown} value
 * @returns {string}
 */
function contentUrlLookupKey(value) {
  const url = httpContentUrl(value);

  if (!url) {
    return "";
  }

  // httpContentUrl already accepted this href; strip a non-root trailing slash.
  const parsed = new URL(url);
  parsed.hash = "";

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.href;
}

/**
 * Publisher date from project/article HTML. Prefers Status Completed YEAR,
 * then article:published_time, time[datetime], JSON-LD datePublished,
 * then labeled Year:/Published years (incl. &nbsp; / sibling-span markup).
 * Does not invent dates from free-prose year mentions.
 * @param {unknown} html
 * @returns {string}
 */
export function publishedAtFromPageHtml(html) {
  if (typeof html !== "string" || !html) {
    return "";
  }

  const statusYear = firstCapture(
    html,
    /\bStatus:\s*Complete[d]?\s+((?:19|20)\d{2})\b/i,
  );
  const fromStatus = publishedAtFromYear(statusYear);

  if (fromStatus) {
    return fromStatus;
  }

  const metaPublished =
    firstCapture(
      html,
      /<meta\b[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
    ) ||
    firstCapture(
      html,
      /<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
    ) ||
    firstCapture(
      html,
      /<meta\b[^>]*property=["']book:release_date["'][^>]*content=["']([^"']+)["']/i,
    ) ||
    firstCapture(
      html,
      /<meta\b[^>]*name=["']date["'][^>]*content=["']([^"']+)["']/i,
    );
  const fromMeta = isoDateString(metaPublished);

  if (fromMeta) {
    return fromMeta;
  }

  const timeDatetime = firstCapture(
    html,
    /<time\b[^>]*datetime=["']([^"']+)["']/i,
  );
  const fromTime = isoDateString(timeDatetime);

  if (fromTime) {
    return fromTime;
  }

  const jsonLdPublished =
    firstCapture(html, /"datePublished"\s*:\s*"([^"]+)"/i) ||
    firstCapture(html, /"dateCreated"\s*:\s*"([^"]+)"/i);

  const fromJsonLd = isoDateString(jsonLdPublished);

  if (fromJsonLd) {
    return fromJsonLd;
  }

  // Member book badges / bylines (Chris Minnick–shaped pages).
  const fromComing = publishedAtFromComingBadge(html);

  if (fromComing) {
    return fromComing;
  }

  const fromByline = publishedAtFromBookByline(html);

  if (fromByline) {
    return fromByline;
  }

  // Portfolio detail labels: "Year: 2022" (Stübner-shaped &nbsp; + spans).
  const labeledYear = firstCapture(
    html,
    /\bYear:\s*(?:(?:&nbsp;|\u00a0|\s|<\/?[a-z][^>]*>)*)((?:19|20)\d{2})\b/i,
  );
  const fromLabeledYear = publishedAtFromYear(labeledYear);

  if (fromLabeledYear) {
    return fromLabeledYear;
  }

  // Labeled book/project years on the page (not “Coming …” blurbs).
  if (
    !/\bComing\b/i.test(
      firstCapture(html, /(.{0,40}\bPublished\b.{0,40})/i) || "",
    )
  ) {
    const publishedYear = firstCapture(
      html,
      /\bPublished(?:\s+in)?\s*:?\s*((?:19|20)\d{2})\b/i,
    );
    const fromPublishedYear = publishedAtFromYear(publishedYear);

    if (fromPublishedYear) {
      return fromPublishedYear;
    }
  }

  return "";
}

/**
 * Fills missing `published_at` on content drafts from matching crawled page HTML.
 * Mutates items in place and returns the same array reference.
 * @param {unknown} items
 * @param {unknown} pages
 * @returns {unknown}
 */
export function enrichPublishedAtFromPages(items, pages) {
  if (!Array.isArray(items)) {
    return items;
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    return items;
  }

  /** @type {Map<string, string>} */
  const htmlByUrl = new Map();

  for (const page of pages) {
    if (!page || typeof page !== "object") {
      continue;
    }

    const key = contentUrlLookupKey(
      /** @type {{ url?: unknown }} */ (page).url,
    );
    const html = /** @type {{ html?: unknown }} */ (page).html;

    if (!key || typeof html !== "string" || !html) {
      continue;
    }

    if (!htmlByUrl.has(key)) {
      htmlByUrl.set(key, html);
    }
  }

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = /** @type {Record<string, unknown>} */ (item);

    if (typeof record.published_at === "string" && record.published_at.trim()) {
      continue;
    }

    const key = contentUrlLookupKey(record.url);

    if (!key) {
      continue;
    }

    const html = htmlByUrl.get(key);

    if (!html) {
      continue;
    }

    const published = publishedAtFromPageHtml(html);

    if (published) {
      record.published_at = published;
    }
  }

  return items;
}

/** Max book detail/Amazon fetches per sync for missing publication dates. */
export const MAX_BOOK_PUBLISHED_AT_FETCHES = 40;

/**
 * True when a content URL is a books/fiction work page that may declare a date.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isBookWorkUrl(url) {
  if (typeof url !== "string" || !url.startsWith("https://")) {
    return false;
  }

  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\/(books?|fiction)\/[^/]+/i.test(path);
  } catch {
    return false;
  }
}

/**
 * True when a Showcase book candidate still needs a publisher date lookup.
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function contentItemNeedsBookPublishedAtEnrichment(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (typeof item.published_at === "string" && item.published_at.trim()) {
    return false;
  }

  return isBookWorkUrl(item.url);
}

/**
 * Fills missing `published_at` for book/fiction works by fetching the member
 * page (Coming / By · Publisher · YYYY) and, when still undated, the Amazon
 * Buy/Pre-order target. Fail closed: no inventing dates when lookups miss.
 * @param {Array<Record<string, unknown>>} items
 * @param {{
 *   cache?: Map<string, unknown>,
 *   fetchText?: typeof fetchPublicText,
 *   fetchRobotsText?: typeof fetchPublicText,
 *   robotsGate?: import("./origin-robots.mjs").OriginRobotsGate,
 *   limit?: number,
 * }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function enrichPublishedAtForBookItems(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return Array.isArray(items) ? items : [];
  }

  const fetchText = options.fetchText || fetchPublicText;
  const cache = options.cache || new Map();
  const limit =
    typeof options.limit === "number" && options.limit > 0
      ? options.limit
      : MAX_BOOK_PUBLISHED_AT_FETCHES;

  /** @type {import("./origin-robots.mjs").OriginRobotsGate} */
  let robotsGate;
  if (options.robotsGate) {
    robotsGate = options.robotsGate;
  } else if (typeof options.fetchRobotsText === "function") {
    robotsGate = createOriginRobotsGate({
      cache,
      fetchPublicText: options.fetchRobotsText,
    });
  } else {
    robotsGate = createOriginRobotsGate({ cache });
  }

  let fetches = 0;

  for (const item of items) {
    if (fetches >= limit) {
      break;
    }

    if (!contentItemNeedsBookPublishedAtEnrichment(item)) {
      continue;
    }

    const workUrl = String(item.url);

    if (!(await robotsGate.allows(workUrl))) {
      continue;
    }

    let pageHtml = "";

    try {
      const fetched = await fetchText(workUrl, {
        cache,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      });
      fetches += 1;
      pageHtml = typeof fetched?.body === "string" ? fetched.body : "";
      const fromPage = publishedAtFromPageHtml(pageHtml);

      if (fromPage) {
        item.published_at = fromPage;
        continue;
      }
    } catch {
      continue;
    }

    const amazonUrl = amazonProductUrlFromHtml(pageHtml);

    if (!amazonUrl || !(await robotsGate.allows(amazonUrl))) {
      continue;
    }

    if (fetches >= limit) {
      break;
    }

    try {
      const amazon = await fetchText(amazonUrl, {
        cache,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      });
      fetches += 1;
      const fromAmazon = publishedAtFromAmazonHtml(amazon?.body || "");

      if (fromAmazon) {
        item.published_at = fromAmazon;
      }
    } catch {
      // Leave undated; Showcase books gate excludes them.
    }
  }

  return items;
}

/**
 * Returns an http(s) URL without credentials or hash, otherwise empty.
 * @param {unknown} value
 * @returns {string}
 */
export function httpContentUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const parsed = new URL(value);

    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password
    ) {
      return "";
    }

    parsed.hash = "";
    return parsed.href;
  } catch {
    return "";
  }
}

/**
 * True when a content URL is same-origin as the participating publisher.
 * Link-blog feed entries that point at another origin (including the hub)
 * must not be published as that publisher's content URL.
 * @param {string} url
 * @param {unknown} siteOrigin
 * @returns {boolean}
 */
export function contentUrlMatchesSiteOrigin(url, siteOrigin) {
  if (typeof siteOrigin !== "string" || !siteOrigin.trim()) {
    return false;
  }

  try {
    return new URL(url).origin === new URL(siteOrigin).origin;
  } catch {
    return false;
  }
}

/**
 * True when the content URL shares an origin with a recorded source feed
 * (e.g. Substack posts from a participant-card Substack RSS URL).
 * @param {string} url
 * @param {unknown} sourceFeeds
 * @returns {boolean}
 */
export function contentUrlMatchesSourceFeed(url, sourceFeeds) {
  if (!Array.isArray(sourceFeeds) || sourceFeeds.length === 0) {
    return false;
  }

  let contentOrigin = "";

  try {
    contentOrigin = new URL(url).origin;
  } catch {
    return false;
  }

  for (const feed of sourceFeeds) {
    if (!feed || typeof feed !== "object") {
      continue;
    }

    const feedUrl = /** @type {{ url?: unknown }} */ (feed).url;

    if (typeof feedUrl !== "string" || !feedUrl.trim()) {
      continue;
    }

    try {
      if (new URL(feedUrl).origin === contentOrigin) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

/**
 * Shapes a content item for content.schema.json. Drops items without identity
 * or an http(s) url, and drops cross-origin URLs (feed "Link:" posts whose
 * entry link is another site, e.g. a member linking the hub)—unless the entry
 * URL matches a participant feed origin (Substack / hosted newsletter RSS).
 * Empty summaries become "".
 * @param {unknown} item
 * @returns {Record<string, unknown> | null}
 */
export function normalizeContentItemForPublish(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const record = /** @type {Record<string, unknown>} */ (item);

  if (typeof record.identity !== "string" || !record.identity.trim()) {
    return null;
  }

  const url = httpContentUrl(record.url);

  if (!url) {
    return null;
  }

  // Link-blog entries often use the linked page as <link>/<id>. When that
  // page is another participant (including the hub), publishing it under the
  // member's site_origin trips cross-origin-content. Drop those—unless the
  // URL is on the same origin as a source feed listed on the participant card
  // (Substack, Buttondown-hosted RSS, …).
  if (
    typeof record.site_origin === "string" &&
    record.site_origin.trim() &&
    !contentUrlMatchesSiteOrigin(url, record.site_origin) &&
    !contentUrlMatchesSourceFeed(url, record.source_feeds)
  ) {
    return null;
  }

  const title =
    capRemoteString(String(record.title || "").trim(), MAX_TITLE_CHARS) ||
    "Untitled";
  const published = isoDateString(record.published_at);
  const updated = isoDateString(record.updated_at);
  const next = { ...record, identity: record.identity, url, title };
  next.summary = plainTextSummary(
    typeof record.summary === "string" ? record.summary : "",
  );

  if (published) {
    next.published_at = published;
  } else {
    delete next.published_at;
  }

  if (updated) {
    next.updated_at = updated;
  } else {
    delete next.updated_at;
  }

  return next;
}

const FEED_IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;

/** Minimum width for What's New / Search card images when dimensions are known. */
export const ACTIVITY_IMAGE_MIN_WIDTH = 480;

/** Minimum height for What's New / Search card images when dimensions are known. */
export const ACTIVITY_IMAGE_MIN_HEIGHT = 270;

/**
 * Resolves a feed image candidate to an https URL with no credentials.
 * @param {unknown} value
 * @param {string} [base]
 * @returns {string}
 */
export function absoluteHttpsImageUrl(value, base) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const decoded = decodeHrefForParse(
    value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim(),
  );

  try {
    const parsed = base ? new URL(decoded, base) : new URL(decoded);

    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return "";
    }

    return parsed.href;
  } catch {
    return "";
  }
}

/**
 * True when a URL or MIME type is a raster image advertised by a feed.
 * @param {string} url
 * @param {string} [type]
 * @returns {boolean}
 */
function looksLikeFeedImage(url, type = "") {
  if (/^image\//i.test(type) && !/svg/i.test(type)) {
    return true;
  }

  return FEED_IMAGE_EXTENSION.test(url);
}

/**
 * Positive integer from a width/height attribute, else 0.
 * @param {unknown} value
 * @returns {number}
 */
function positiveIntAttr(value) {
  const n = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Width and height from markup attributes when present.
 * @param {string} attrs
 * @returns {{ width: number, height: number }}
 */
export function imageDimensionsFromAttrs(attrs) {
  if (typeof attrs !== "string" || !attrs) {
    return { width: 0, height: 0 };
  }

  return {
    width: positiveIntAttr(firstCapture(attrs, /\bwidth=["']?(\d+)/i)),
    height: positiveIntAttr(firstCapture(attrs, /\bheight=["']?(\d+)/i)),
  };
}

/**
 * Whether advertised pixel size is large enough for an activity card.
 * Unknown dimensions are allowed; undersized known edges are not.
 * @param {number} [width]
 * @param {number} [height]
 * @returns {boolean}
 */
export function isUsableCardImageSize(width = 0, height = 0) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;

  if (w > 0 && w < ACTIVITY_IMAGE_MIN_WIDTH) {
    return false;
  }

  if (h > 0 && h < ACTIVITY_IMAGE_MIN_HEIGHT) {
    return false;
  }

  return true;
}

/**
 * Adds a candidate when the URL looks like a card image and passes size gates.
 * @param {string[]} out
 * @param {string} url
 * @param {number} [width]
 * @param {number} [height]
 * @returns {void}
 */
function pushCardImageCandidate(out, url, width = 0, height = 0) {
  if (!url || out.includes(url)) {
    return;
  }

  if (!isUsableCardImageSize(width, height)) {
    return;
  }

  out.push(url);
}

/**
 * First image URL advertised on an RSS or Atom entry.
 * Skips candidates whose advertised width/height are below card minimums.
 * @param {string} chunk
 * @param {string} feedUrl
 * @returns {string}
 */
export function feedImageFromXml(chunk, feedUrl) {
  if (typeof chunk !== "string" || !chunk) {
    return "";
  }

  /** @type {string[]} */
  const candidates = [];

  for (const match of chunk.matchAll(/<enclosure\b([^>]*)\/?>/gi)) {
    const attrs = match[1] || "";
    const type = firstCapture(attrs, /\btype=["']([^"']+)["']/i) || "";
    const abs = absoluteHttpsImageUrl(
      firstCapture(attrs, /\burl=["']([^"']+)["']/i),
      feedUrl,
    );
    const { width, height } = imageDimensionsFromAttrs(attrs);

    if (abs && looksLikeFeedImage(abs, type)) {
      pushCardImageCandidate(candidates, abs, width, height);
    }
  }

  for (const match of chunk.matchAll(
    /<(?:media:thumbnail|media:content)\b([^>]*)\/?>/gi,
  )) {
    const attrs = match[1] || "";
    const medium = firstCapture(attrs, /\bmedium=["']([^"']+)["']/i) || "";
    const type = firstCapture(attrs, /\btype=["']([^"']+)["']/i) || "";
    const abs = absoluteHttpsImageUrl(
      firstCapture(attrs, /\burl=["']([^"']+)["']/i),
      feedUrl,
    );
    const { width, height } = imageDimensionsFromAttrs(attrs);

    if (!abs || (medium && medium !== "image")) {
      continue;
    }

    if (looksLikeFeedImage(abs, type) || medium === "image") {
      pushCardImageCandidate(candidates, abs, width, height);
    }
  }

  const itunesAttrs =
    firstCapture(chunk, /<itunes:image\b([^>]*)\/?>/i) ||
    firstCapture(chunk, /<itunes:image\b([^>]*)>/i) ||
    "";
  const itunes = absoluteHttpsImageUrl(
    firstCapture(chunk, /<itunes:image\b[^>]*href=["']([^"']+)["']/i),
    feedUrl,
  );
  const itunesSize = imageDimensionsFromAttrs(itunesAttrs);

  if (itunes) {
    pushCardImageCandidate(
      candidates,
      itunes,
      itunesSize.width,
      itunesSize.height,
    );
  }

  for (const match of chunk.matchAll(/<link\b([^>]*)\/?>/gi)) {
    const attrs = match[1] || "";
    const rel = firstCapture(attrs, /\brel=["']([^"']+)["']/i) || "";

    if (!/^(?:enclosure|image)$/i.test(rel)) {
      continue;
    }

    const type = firstCapture(attrs, /\btype=["']([^"']+)["']/i) || "";
    const abs = absoluteHttpsImageUrl(
      firstCapture(attrs, /\bhref=["']([^"']+)["']/i),
      feedUrl,
    );
    const { width, height } = imageDimensionsFromAttrs(attrs);

    if (abs && looksLikeFeedImage(abs, type)) {
      pushCardImageCandidate(candidates, abs, width, height);
    }
  }

  return candidates[0] || "";
}

/**
 * First image URL advertised on a JSON Feed item.
 * @param {Record<string, unknown>} item
 * @param {string} feedUrl
 * @returns {string}
 */
export function feedImageFromJsonItem(item, feedUrl) {
  if (!item || typeof item !== "object") {
    return "";
  }

  /** @type {string[]} */
  const candidates = [];

  for (const candidate of [item.image, item.banner_image]) {
    const raw =
      typeof candidate === "string"
        ? candidate
        : candidate &&
            typeof candidate === "object" &&
            typeof candidate.url === "string"
          ? candidate.url
          : "";
    const abs = absoluteHttpsImageUrl(raw, feedUrl);
    const width =
      candidate && typeof candidate === "object"
        ? positiveIntAttr(candidate.width)
        : 0;
    const height =
      candidate && typeof candidate === "object"
        ? positiveIntAttr(candidate.height)
        : 0;

    if (abs && looksLikeFeedImage(abs, "image/jpeg")) {
      pushCardImageCandidate(candidates, abs, width, height);
    }
  }

  if (Array.isArray(item.attachments)) {
    for (const attachment of item.attachments) {
      if (!attachment || typeof attachment !== "object") {
        continue;
      }

      const mime =
        typeof attachment.mime_type === "string" ? attachment.mime_type : "";
      const abs = absoluteHttpsImageUrl(attachment.url, feedUrl);
      const width = positiveIntAttr(attachment.width);
      const height = positiveIntAttr(attachment.height);

      if (abs && looksLikeFeedImage(abs, mime)) {
        pushCardImageCandidate(candidates, abs, width, height);
      }
    }
  }

  return candidates[0] || "";
}

/**
 * True when a title looks like music listening/curation, not first-party audio.
 * @param {unknown} title
 * @returns {boolean}
 */
export function isListeningCurationTitle(title) {
  return /albums?\s+i\s+(?:listened|loved)|song\s+i'?m\s+loving|listening\s+to\b|playlist\b/i.test(
    String(title || ""),
  );
}

/**
 * First-party content_type override from conventional title prefixes.
 * @param {unknown} title
 * @param {string} currentType
 * @returns {string}
 */
export function firstPartyContentTypeFromTitle(title, currentType) {
  const text = String(title || "").trim();

  if (/^\[photo\]/i.test(text) || /^📷\s*/u.test(text)) {
    return "photograph";
  }

  return currentType;
}

/**
 * Absolute URL for an audio enclosure in an RSS/Atom entry chunk.
 * @param {string} chunk
 * @param {string} feedUrl
 * @returns {string}
 */
export function audioEnclosureUrlFromFeedChunk(chunk, feedUrl) {
  if (typeof chunk !== "string" || !chunk) {
    return "";
  }

  for (const match of chunk.matchAll(/<enclosure\b([^>]*)\/?>/gi)) {
    const attrs = match[1] || "";
    const type = firstCapture(attrs, /\btype=["']([^"']+)["']/i) || "";
    const raw = firstCapture(attrs, /\burl=["']([^"']+)["']/i) || "";

    if (
      !raw ||
      (!/^audio\//i.test(type) &&
        !/\.(mp3|m4a|aac|ogg|flac|wav|opus)(\?|$)/i.test(raw))
    ) {
      continue;
    }

    try {
      return new URL(raw, feedUrl).href;
    } catch {
      return raw;
    }
  }

  for (const match of chunk.matchAll(/<link\b([^>]*)\/?>/gi)) {
    const attrs = match[1] || "";
    const rel = firstCapture(attrs, /\brel=["']([^"']+)["']/i) || "";
    const type = firstCapture(attrs, /\btype=["']([^"']+)["']/i) || "";
    const href = firstCapture(attrs, /\bhref=["']([^"']+)["']/i) || "";

    if (
      !href ||
      !/enclosure/i.test(rel) ||
      (!/^audio\//i.test(type) &&
        !/\.(mp3|m4a|aac|ogg|flac|wav|opus)(\?|$)/i.test(href))
    ) {
      continue;
    }

    try {
      return new URL(href, feedUrl).href;
    } catch {
      return href;
    }
  }

  return "";
}

/**
 * True when an RSS/Atom entry looks like a podcast episode.
 * @param {string} chunk
 * @param {string} feedUrl
 * @returns {boolean}
 */
export function isPodcastFeedItem(chunk, feedUrl) {
  if (typeof chunk !== "string" || !chunk) {
    return false;
  }

  if (audioEnclosureUrlFromFeedChunk(chunk, feedUrl)) {
    return true;
  }

  return (
    /<itunes:episode\b/i.test(chunk) ||
    /<itunes:duration\b/i.test(chunk) ||
    /<itunes:explicit\b/i.test(chunk) ||
    /<itunes:episodeType\b/i.test(chunk)
  );
}

/**
 * Readable title for an RSS/Atom entry; empty/self-closing titles fall back to
 * summary/description then URL slug (PaperMod microblog notes).
 * @param {string} chunk
 * @param {string} absoluteUrl
 * @param {string} [summaryText]
 * @returns {string}
 */
export function rssOrAtomEntryTitle(chunk, absoluteUrl, summaryText = "") {
  const paired = chunk.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i);
  const raw = paired
    ? paired[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    : "";
  const fromTitle = capRemoteString(
    normalizeExtractedText(decodeHtmlEntities(raw)),
    MAX_TITLE_CHARS,
  );

  if (fromTitle) {
    return fromTitle;
  }

  const fromSummary = capRemoteString(
    String(summaryText || "").trim(),
    MAX_TITLE_CHARS,
  );

  if (fromSummary) {
    return fromSummary;
  }

  const encoded =
    firstCapture(
      chunk,
      /<content:encoded\b[^>]*>([\s\S]*?)<\/content:encoded>/i,
    ) ||
    firstCapture(chunk, /<content\b[^>]*>([\s\S]*?)<\/content>/i) ||
    "";
  const fromBody = capRemoteString(plainTextSummary(encoded), MAX_TITLE_CHARS);

  if (fromBody) {
    return fromBody;
  }

  return slugifyTopic(absoluteUrl) || "Untitled";
}

/**
 * Parses RSS/Atom entry blocks into normalized content drafts.
 * @param {string} xml
 * @param {{ feedUrl: string, feedKind: 'rss'|'atom', siteOrigin: string, observedAt: string }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function contentItemsFromRssOrAtom(xml, meta) {
  if (typeof xml !== "string" || !xml) {
    return [];
  }

  const items = [];
  const isAtom = meta.feedKind === "atom" || /<feed[\s>]/i.test(xml);
  const blockPattern = isAtom
    ? /<entry\b[\s\S]*?<\/entry>/gi
    : /<item\b[\s\S]*?<\/item>/gi;
  const sourceKey = isAtom ? "atom:category" : "rss:category";

  for (const block of xml.matchAll(blockPattern)) {
    const chunk = block[0];
    let link = "";

    if (isAtom) {
      link =
        firstCapture(
          chunk,
          /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i,
        ) ||
        firstCapture(chunk, /<link\b[^>]*href=["']([^"']+)["']/i) ||
        "";
    } else {
      link = firstCapture(chunk, /<link[^>]*>([\s\S]*?)<\/link>/i) || "";
    }

    link = decodeHrefForParse(
      link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"),
    );
    const id =
      firstCapture(chunk, /<id[^>]*>([\s\S]*?)<\/id>/i) ||
      firstCapture(chunk, /<guid[^>]*>([\s\S]*?)<\/guid>/i) ||
      "";
    // Publisher dates only for Activity: prefer published/pubDate; Atom
    // updated is last resort when no publish stamp exists.
    const published =
      firstCapture(chunk, /<published[^>]*>([\s\S]*?)<\/published>/i) ||
      firstCapture(chunk, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
      firstCapture(chunk, /<updated[^>]*>([\s\S]*?)<\/updated>/i) ||
      null;
    // Prefer dedicated summary fields over full-content HTML bodies.
    const summary = plainTextSummary(
      firstCapture(chunk, /<summary[^>]*>([\s\S]*?)<\/summary>/i) ||
        firstCapture(
          chunk,
          /<itunes:summary[^>]*>([\s\S]*?)<\/itunes:summary>/i,
        ) ||
        firstCapture(
          chunk,
          /<media:description[^>]*>([\s\S]*?)<\/media:description>/i,
        ) ||
        firstCapture(chunk, /<description[^>]*>([\s\S]*?)<\/description>/i) ||
        "",
    );

    const categories = [];
    const catPattern = isAtom
      ? /<category\b([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/category>)/gi
      : /<category[^>]*>([\s\S]*?)<\/category>/gi;
    let catMatch;

    while ((catMatch = catPattern.exec(chunk))) {
      let raw = "";

      if (isAtom) {
        const attrs = catMatch[1] || "";
        const term =
          firstCapture(attrs, /\bterm=["']([^"']+)["']/i) ||
          firstCapture(attrs, /\blabel=["']([^"']+)["']/i) ||
          "";
        raw = normalizeExtractedText(term || catMatch[2] || "");
      } else {
        raw = normalizeExtractedText(catMatch[1] || "");
      }

      if (raw) {
        categories.push(raw);
      }
    }

    let absoluteUrl = link;

    try {
      absoluteUrl = link ? new URL(link, meta.feedUrl).href : "";
    } catch {
      absoluteUrl = "";
    }

    const key = contentIdentityKey({
      url: absoluteUrl,
      id: normalizeExtractedText(id),
      feed: meta.feedUrl,
      siteOrigin: meta.siteOrigin,
    });

    if (!key) {
      continue;
    }

    const declared_topics = [];

    for (const raw of categories) {
      const evidence = buildTopicEvidence({
        rawValue: raw,
        source: sourceKey,
        page: absoluteUrl || meta.feedUrl,
        evidenceClass: "declared",
        communityEligible: isCommunityEligibleSource(sourceKey),
        observedAt: meta.observedAt,
        feed: meta.feedUrl,
      });

      if (evidence) {
        declared_topics.push({
          slug: evidence.slug,
          label: evidence.value,
          raw_value: evidence.raw_value,
          source: sourceKey,
          community_eligible: evidence.community_eligible === true,
        });
      }
    }

    const title = rssOrAtomEntryTitle(chunk, absoluteUrl, summary);
    const audioUrl = audioEnclosureUrlFromFeedChunk(chunk, meta.feedUrl);
    let contentType = isPodcastFeedItem(chunk, meta.feedUrl)
      ? "podcast_episode"
      : "article";
    contentType = firstPartyContentTypeFromTitle(title, contentType);

    if (isListeningCurationTitle(title) && contentType !== "photograph") {
      contentType = "article";
    }

    /** @type {Array<{ label: string, url: string, type: string }>} */
    const actions = [];

    if (audioUrl) {
      actions.push({
        label: "Listen",
        url: audioUrl,
        type: "listen",
      });
    }

    items.push({
      identity: key,
      url: absoluteUrl || null,
      site_origin: meta.siteOrigin,
      title,
      published_at: isoDateString(published) || null,
      updated_at: null,
      content_type: contentType,
      language: languageFromRssOrAtom(xml, chunk, isAtom) || null,
      summary,
      declared_topics,
      source: { kind: isAtom ? "atom" : "rss", feed: meta.feedUrl },
      source_feeds: [{ type: isAtom ? "atom" : "rss", url: meta.feedUrl }],
      observed_at: meta.observedAt,
      image: feedImageFromXml(chunk, meta.feedUrl) || undefined,
      ...(actions.length ? { actions } : {}),
    });
  }

  return items;
}

/**
 * Parses JSON Feed items.
 * @param {string} jsonText
 * @param {{ feedUrl: string, siteOrigin: string, observedAt: string }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function contentItemsFromJsonFeed(jsonText, meta) {
  let data;

  try {
    data = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  const out = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const url = decodeHrefForParse(
      typeof item.url === "string"
        ? item.url
        : typeof item.external_url === "string"
          ? item.external_url
          : "",
    );
    let absoluteUrl = url;

    try {
      absoluteUrl = url ? new URL(url, meta.feedUrl).href : "";
    } catch {
      absoluteUrl = "";
    }

    const id = typeof item.id === "string" ? item.id : "";
    const key = contentIdentityKey({
      url: absoluteUrl,
      id,
      feed: meta.feedUrl,
      siteOrigin: meta.siteOrigin,
    });

    if (!key) {
      continue;
    }

    const tags = Array.isArray(item.tags) ? item.tags : [];
    const declared_topics = [];

    for (const tag of tags) {
      const evidence = buildTopicEvidence({
        rawValue: String(tag),
        source: "json-feed:tag",
        page: absoluteUrl || meta.feedUrl,
        evidenceClass: "declared",
        communityEligible: true,
        observedAt: meta.observedAt,
        feed: meta.feedUrl,
      });

      if (evidence) {
        declared_topics.push({
          slug: evidence.slug,
          label: evidence.value,
          raw_value: evidence.raw_value,
          source: "json-feed:tag",
          community_eligible: evidence.community_eligible === true,
        });
      }
    }

    out.push({
      identity: key,
      url: absoluteUrl || null,
      site_origin: meta.siteOrigin,
      title: capRemoteString(String(item.title || "Untitled"), MAX_TITLE_CHARS),
      published_at:
        isoDateString(
          typeof item.date_published === "string" ? item.date_published : "",
        ) || null,
      updated_at:
        isoDateString(
          typeof item.date_modified === "string" ? item.date_modified : "",
        ) || null,
      content_type: "article",
      language:
        normalizeLanguageTag(
          typeof item.language === "string"
            ? item.language
            : typeof data.language === "string"
              ? data.language
              : "",
        ) || null,
      summary: plainTextSummary(
        String(
          item.summary ||
            item.content_text ||
            (typeof item.content_html === "string" ? item.content_html : "") ||
            "",
        ),
      ),
      declared_topics,
      source: { kind: "json-feed", feed: meta.feedUrl },
      source_feeds: [{ type: "json-feed", url: meta.feedUrl }],
      observed_at: meta.observedAt,
      image: feedImageFromJsonItem(item, meta.feedUrl) || undefined,
    });
  }

  return out;
}

/**
 * Parses Hugo PaperMod-style /index.json arrays:
 * `[{permalink,title,summary,content}, …]` (not JSON Feed).
 * @param {string} jsonText
 * @param {{ feedUrl: string, siteOrigin: string, observedAt: string }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function contentItemsFromHugoIndexJson(jsonText, meta) {
  let data;

  try {
    data = JSON.parse(jsonText);
  } catch {
    return [];
  }

  if (!Array.isArray(data)) {
    return [];
  }

  const out = [];

  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const permalink =
      typeof item.permalink === "string"
        ? item.permalink
        : typeof item.url === "string"
          ? item.url
          : "";
    let absoluteUrl = "";

    try {
      absoluteUrl = permalink ? new URL(permalink, meta.feedUrl).href : "";
    } catch {
      absoluteUrl = "";
    }

    const key = contentIdentityKey({
      url: absoluteUrl,
      id: typeof item.id === "string" ? item.id : "",
      feed: meta.feedUrl,
      siteOrigin: meta.siteOrigin,
    });

    if (!key) {
      continue;
    }

    const summary = plainTextSummary(
      String(item.summary || item.content || ""),
    );
    const title = rssOrAtomEntryTitle(
      `<title>${String(item.title || "")}</title>`,
      absoluteUrl,
      summary,
    );
    let contentType = firstPartyContentTypeFromTitle(title, "article");

    if (isListeningCurationTitle(title) && contentType !== "photograph") {
      contentType = "article";
    }

    out.push({
      identity: key,
      url: absoluteUrl || null,
      site_origin: meta.siteOrigin,
      title,
      published_at:
        isoDateString(
          typeof item.date === "string"
            ? item.date
            : typeof item.date_published === "string"
              ? item.date_published
              : "",
        ) || null,
      updated_at: null,
      content_type: contentType,
      language: null,
      summary,
      declared_topics: [],
      source: { kind: "hugo-index-json", feed: meta.feedUrl },
      source_feeds: [{ type: "hugo-index-json", url: meta.feedUrl }],
      observed_at: meta.observedAt,
    });
  }

  return out;
}

/**
 * PaperMod /blog/ archive list: `a.archive-entry-title` + `time.dt-published`.
 * @param {string} html
 * @param {{ pageUrl: string, siteOrigin: string, observedAt: string }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function contentItemsFromArchiveEntryList(html, meta) {
  if (typeof html !== "string" || !html) {
    return [];
  }

  const items = [];
  const seen = new Set();
  const entryPattern =
    /<[^>]*class=["'][^"']*archive-entry[^"']*["'][^>]*>[\s\S]*?(?=<[^>]*class=["'][^"']*archive-entry[^"']*["']|$)/gi;
  const blocks = html.match(entryPattern) || [];
  const sources =
    blocks.length > 0
      ? blocks
      : html.includes("archive-entry-title")
        ? [html]
        : [];

  for (const block of sources) {
    const hrefMatch =
      block.match(
        /<(?:h[1-6]|div|span)\b[^>]*class=["'][^"']*archive-entry-title[^"']*["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
      ) ||
      block.match(
        /<a\b[^>]*class=["'][^"']*archive-entry-title[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
      ) ||
      block.match(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*archive-entry-title[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
      );

    if (!hrefMatch) {
      continue;
    }

    let absoluteUrl = "";

    try {
      absoluteUrl = new URL(decodeHrefForParse(hrefMatch[1]), meta.pageUrl)
        .href;
    } catch {
      continue;
    }

    if (!absoluteUrl.startsWith(meta.siteOrigin) || seen.has(absoluteUrl)) {
      continue;
    }

    const title = capRemoteString(
      normalizeExtractedText(hrefMatch[2].replace(/<[^>]+>/g, " ")),
      MAX_TITLE_CHARS,
    );
    const published =
      firstCapture(
        block,
        /<time\b[^>]*class=["'][^"']*dt-published[^"']*["'][^>]*datetime=["']([^"']+)["']/i,
      ) ||
      firstCapture(block, /<time\b[^>]*datetime=["']([^"']+)["']/i) ||
      null;

    if (!title) {
      continue;
    }

    seen.add(absoluteUrl);
    items.push({
      identity: `url:${absoluteUrl}`,
      url: absoluteUrl,
      site_origin: meta.siteOrigin,
      title,
      published_at: isoDateString(published) || null,
      updated_at: null,
      content_type: firstPartyContentTypeFromTitle(title, "article"),
      language: null,
      summary: "",
      declared_topics: [],
      source: { kind: "archive-entry", page: meta.pageUrl },
      source_feeds: [{ type: "archive-entry", url: meta.pageUrl }],
      observed_at: meta.observedAt,
    });
  }

  return items;
}

/**
 * Microblog / notes h-entry lists (PaperMod homepage + /notes/).
 * @param {string} html
 * @param {{ pageUrl: string, siteOrigin: string, observedAt: string }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function contentItemsFromHEntryList(html, meta) {
  if (typeof html !== "string" || !html) {
    return [];
  }

  const items = [];
  const seen = new Set();
  const entryPattern =
    /<(?:article|div|li)\b[^>]*class=["'][^"']*\bh-entry\b[^"']*["'][^>]*>[\s\S]*?<\/(?:article|div|li)>/gi;

  for (const match of html.matchAll(entryPattern)) {
    const block = match[0];
    const urlMatch =
      block.match(
        /<a\b[^>]*class(?:=["'][^"']*\bu-url\b[^"']*["']|=u-url\b)[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
      ) ||
      block.match(
        /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*class(?:=["'][^"']*\bu-url\b[^"']*["']|=u-url\b)/i,
      );
    const href = urlMatch
      ? urlMatch[1] || urlMatch[2] || urlMatch[3] || ""
      : "";
    let absoluteUrl = "";

    try {
      absoluteUrl = href
        ? new URL(decodeHrefForParse(href), meta.pageUrl).href
        : "";
    } catch {
      continue;
    }

    if (!absoluteUrl.startsWith(meta.siteOrigin) || seen.has(absoluteUrl)) {
      continue;
    }

    const name = normalizeExtractedText(
      (
        firstCapture(
          block,
          /<(?:h[1-6]|data|span|p)\b[^>]*class=["'][^"']*\bp-name\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:h[1-6]|data|span|p)>/i,
        ) ||
        firstCapture(
          block,
          /<data\b[^>]*class=["'][^"']*\bp-name\b[^"']*["'][^>]*value=["']([^"']+)["']/i,
        ) ||
        ""
      ).replace(/<[^>]+>/g, " "),
    );
    // Prefer p-summary / dedicated blurb over raw e-content so short notes are
    // not near-fully copied into hub cards (snippet aggregator hygiene).
    const pSummaryHtml =
      firstCapture(
        block,
        /<(?:p|div|span)\b[^>]*class=["'][^"']*\bp-summary\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div|span)>/i,
      ) || "";
    const contentHtml =
      firstCapture(
        block,
        /<(?:div|p)\b[^>]*class=["'][^"']*\be-content\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p)>/i,
      ) || "";
    const fromPSummary = plainTextSummary(pSummaryHtml);
    const summary = fromPSummary || plainTextSummary(contentHtml);
    const title = capRemoteString(name || summary, MAX_TITLE_CHARS);
    const publishedMatch = block.match(
      /<time\b[^>]*datetime\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    const published = publishedMatch
      ? publishedMatch[1] || publishedMatch[2] || publishedMatch[3] || null
      : null;

    if (!title) {
      continue;
    }

    seen.add(absoluteUrl);
    items.push({
      identity: `url:${absoluteUrl}`,
      url: absoluteUrl,
      site_origin: meta.siteOrigin,
      title,
      published_at: isoDateString(published) || null,
      updated_at: null,
      content_type: "article",
      language: null,
      summary: summary && summary !== title ? summary : "",
      declared_topics: [],
      source: { kind: "h-entry", page: meta.pageUrl },
      source_feeds: [{ type: "h-entry", url: meta.pageUrl }],
      observed_at: meta.observedAt,
    });
  }

  return items;
}

/**
 * Merges content drafts by identity, unioning source_feeds and topics.
 * @param {Array<Record<string, unknown>>} drafts
 * @returns {Array<Record<string, unknown>>}
 */
export function mergeContentItems(drafts) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byId = new Map();

  for (const draft of drafts || []) {
    if (!draft || typeof draft.identity !== "string") {
      continue;
    }

    const existing = byId.get(draft.identity);

    if (!existing) {
      byId.set(draft.identity, {
        ...draft,
        source_feeds: [...(draft.source_feeds || [])],
        declared_topics: [...(draft.declared_topics || [])],
      });
      continue;
    }

    const feedKey = new Set(
      existing.source_feeds.map((feed) => `${feed.type}\0${feed.url}`),
    );

    for (const feed of draft.source_feeds || []) {
      const key = `${feed.type}\0${feed.url}`;
      if (!feedKey.has(key)) {
        existing.source_feeds.push(feed);
        feedKey.add(key);
      }
    }

    const topicKey = new Set(
      existing.declared_topics.map(
        (topic) => `${topic.slug}\0${topic.source || ""}`,
      ),
    );

    for (const topic of draft.declared_topics || []) {
      const key = `${topic.slug}\0${topic.source || ""}`;
      if (!topicKey.has(key)) {
        existing.declared_topics.push(topic);
        topicKey.add(key);
      }
    }

    if (!existing.url && draft.url) {
      existing.url = draft.url;
    }

    if (!existing.published_at && draft.published_at) {
      existing.published_at = draft.published_at;
    }

    // Prefer the first non-empty poster; never overwrite an index/feed image
    // with a later empty or duplicate enrich draft.
    if (!existing.image && draft.image) {
      existing.image = draft.image;
    }

    const existingSummary =
      typeof existing.summary === "string" ? existing.summary.trim() : "";
    const draftSummary =
      typeof draft.summary === "string" ? draft.summary.trim() : "";

    if (!existingSummary && draftSummary) {
      existing.summary = draft.summary;
    }

    // Creative index/homepage drafts upgrade thin RSS "article" shells.
    const draftType =
      typeof draft.content_type === "string" ? draft.content_type : "";

    if (
      existing.content_type === "article" &&
      draftType &&
      draftType !== "article"
    ) {
      existing.content_type = draftType;
    }
  }

  return [...byId.values()]
    .map((item) => normalizeContentItemForPublish(item))
    .filter((item) => item !== null)
    .sort((left, right) => String(left.url).localeCompare(String(right.url)));
}

/**
 * Canonical URL string without hash for joining crawl pages to content.
 * @param {string} url
 * @returns {string}
 */
function canonicalPageUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return "";
  }
}

/**
 * Joins crawled page language, page_role, and community-eligible declarations
 * onto feed content items that share a canonical URL.
 * @param {Array<Record<string, unknown>>} items
 * @param {Array<{
 *   pages?: Array<{url?: string, lang?: string, page_role?: string}>,
 *   declared_topics?: Array<Record<string, unknown>>,
 * }>} originSignals
 * @returns {Array<Record<string, unknown>>}
 */
export function joinContentWithPageSignals(items, originSignals) {
  /** @type {Map<string, {lang?: string, page_role?: string}>} */
  const pages = new Map();
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const declaredByUrl = new Map();

  for (const origin of originSignals || []) {
    for (const page of origin.pages || []) {
      if (typeof page?.url !== "string" || !page.url) {
        continue;
      }

      const key = canonicalPageUrl(page.url);

      if (key) {
        pages.set(key, {
          lang: page.lang,
          page_role: page.page_role,
          poster_image:
            typeof page.poster_image === "string" ? page.poster_image : "",
          share_description:
            typeof page.share_description === "string"
              ? page.share_description
              : "",
        });
      }
    }

    for (const topic of origin.declared_topics || []) {
      for (const item of topic.evidence || []) {
        if (
          item?.community_eligible !== true ||
          item.class !== "declared" ||
          typeof item.page !== "string" ||
          !item.page
        ) {
          continue;
        }

        const key = canonicalPageUrl(item.page);

        if (!key) {
          continue;
        }

        const list = declaredByUrl.get(key) || [];
        list.push({
          slug: topic.slug,
          label: topic.label,
          raw_value: item.raw_value || topic.label,
          source: item.source,
          community_eligible: item.community_eligible === true,
        });
        declaredByUrl.set(key, list);
      }
    }
  }

  return (items || []).map((item) => {
    const key = typeof item.url === "string" ? canonicalPageUrl(item.url) : "";
    const page = key ? pages.get(key) : undefined;
    const pageTopics = key ? declaredByUrl.get(key) || [] : [];
    const next = { ...item };
    const topicKey = new Set(
      (next.declared_topics || []).map(
        (topic) => `${topic.slug}\0${topic.source || ""}`,
      ),
    );

    if (next.language) {
      next.language = normalizeLanguageTag(next.language) || null;
    }

    if ((!next.language || next.language === null) && page?.lang) {
      next.language = normalizeLanguageTag(page.lang) || null;
    }

    if (page?.page_role) {
      next.page_role = page.page_role;
    }

    if (!next.image && page?.poster_image) {
      next.image = page.poster_image;
    }

    if (!plainTextSummary(next.summary) && page?.share_description) {
      next.summary = page.share_description;
    }

    // Year-only album titles ("2014") become the publisher's share text when
    // we have it, so Showcase cards are not blank year chips.
    const titleText = typeof next.title === "string" ? next.title.trim() : "";

    if (
      /^\d{4}$/.test(titleText) &&
      typeof page?.share_description === "string" &&
      page.share_description.trim()
    ) {
      next.title = plainTextSummary(page.share_description) || titleText;
    }

    for (const topic of pageTopics) {
      const id = `${topic.slug}\0${topic.source || ""}`;

      if (!topicKey.has(id)) {
        next.declared_topics = [...(next.declared_topics || []), topic];
        topicKey.add(id);
      }
    }

    next.summary = plainTextSummary(
      typeof next.summary === "string" ? next.summary : "",
    );

    return next;
  });
}

/**
 * True when a content item should try the publisher page for a missing poster.
 * Items that already have a non-empty https image (e.g. games index extract)
 * are skipped so enrich never overwrites a good index poster. Creative paths,
 * Projects-shelf drafts, named-root products, Showcase types, and
 * articles/notes (blank type → article) are enrichable so OG runs before
 * Playwright screenshot fallback.
 * @param {Record<string, unknown>} item
 * @returns {boolean}
 */
export function contentItemNeedsPosterEnrichment(item) {
  if (!item || typeof item !== "object") {
    return false;
  }

  if (typeof item.image === "string" && item.image.startsWith("https://")) {
    return false;
  }

  if (typeof item.url !== "string" || !item.url.startsWith("https://")) {
    return false;
  }

  try {
    const parsed = new URL(item.url);

    if (parsed.username || parsed.password) {
      return false;
    }

    // Creative-path works (/games/…, /experiments/…, …) are enrichable whether
    // the feed typed them as game/project/article or left content_type thin.
    if (CREATIVE_WORK_PATH.test(parsed.pathname)) {
      return true;
    }

    const source =
      item.source && typeof item.source === "object"
        ? /** @type {{ kind?: unknown }} */ (item.source).kind
        : undefined;
    const sourceKind =
      typeof item.source_kind === "string"
        ? item.source_kind
        : typeof source === "string"
          ? source
          : "";

    // Homepage / Projects-shelf products (named roots and off-origin apps).
    // Comics-hub blog posts (`/blog/…` listed from `/comics/`) need og:image too.
    if (
      sourceKind === "creative-homepage" ||
      sourceKind === "creative-homepage-shelf" ||
      sourceKind === "creative-projects-shelf" ||
      sourceKind === "creative-comics-hub"
    ) {
      return true;
    }

    const type = String(item.content_type || "").trim() || "article";

    return (
      SHOWCASE_CONTENT_TYPES.includes(type) ||
      type === "article" ||
      type === "note"
    );
  } catch {
    return false;
  }
}

/**
 * Fills missing posters (and empty summaries) from each work page's Open Graph
 * tags. Used by nlp:sync so GitHub Actions Showcase cards get the publisher's
 * existing experiment/game posters even when the feed omitted enclosures and
 * the crawl window missed the detail page.
 *
 * Invariant: never overwrites a non-empty https `image` already set by index
 * extract or feeds (`contentItemNeedsPosterEnrichment` gates that). Enrich only
 * fills when the work page has og:image / share description and the item still
 * lacks them—typical for `/games/…` and `/experiments/…` detail pages.
 * @param {Array<Record<string, unknown>>} items
 * @param {{
 *   cache?: Map<string, unknown>,
 *   fetchText?: typeof fetchPublicText,
 *   fetchRobotsText?: typeof fetchPublicText,
 *   robotsGate?: import("./origin-robots.mjs").OriginRobotsGate,
 * }} [options]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function enrichContentItemPosters(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return Array.isArray(items) ? items : [];
  }

  const fetchText = options.fetchText || fetchPublicText;
  const cache = options.cache || new Map();
  // Prefer an injected gate (nlp:sync). Default gate never reuses enrich
  // fetchText (OG stubs must not answer robots.txt). Offline tests inject
  // fetchRobotsText or robotsGate so allow/deny stays deterministic.
  /** @type {import("./origin-robots.mjs").OriginRobotsGate} */
  let robotsGate;
  if (options.robotsGate) {
    robotsGate = options.robotsGate;
  } else if (typeof options.fetchRobotsText === "function") {
    robotsGate = createOriginRobotsGate({
      cache,
      fetchPublicText: options.fetchRobotsText,
    });
  } else {
    robotsGate = createOriginRobotsGate({ cache });
  }

  for (const item of items) {
    if (!contentItemNeedsPosterEnrichment(item)) {
      continue;
    }

    const workUrl = String(item.url);

    if (!(await robotsGate.allows(workUrl))) {
      continue;
    }

    try {
      const fetched = await fetchText(workUrl, {
        cache,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      });
      const html = typeof fetched?.body === "string" ? fetched.body : "";
      const pageUrl =
        typeof fetched?.url === "string" ? fetched.url : String(item.url);
      const poster = posterImageFromHtml(html, pageUrl);
      const existingImage =
        typeof item.image === "string" ? item.image.trim() : "";

      // Only assign when still empty — belt-and-suspenders with the gate above.
      if (!existingImage && poster) {
        item.image = poster;
      }

      if (!plainTextSummary(String(item.summary || ""))) {
        const share = shareDescriptionFromHtml(html);

        if (share) {
          item.summary = share;
        }
      }

      // Comics-hub blog posts often omit dates on the index; fill from the post.
      const existingPublished =
        typeof item.published_at === "string" ? item.published_at.trim() : "";
      const enrichSource =
        item.source && typeof item.source === "object"
          ? /** @type {{ kind?: unknown }} */ (item.source).kind
          : undefined;
      const enrichSourceKind =
        typeof item.source_kind === "string"
          ? item.source_kind
          : typeof enrichSource === "string"
            ? enrichSource
            : "";
      const isComic =
        String(item.content_type || "") === "comic" ||
        enrichSourceKind === "creative-comics-hub";

      if (!existingPublished && isComic) {
        const published = publishedAtFromPageHtml(html);

        if (published) {
          item.published_at = published;
        }
      }
    } catch {
      // Keep the feed/creative draft; Showcase simply stays without a poster.
    }
  }

  return items;
}

/**
 * Origins from content URLs for connection helpers.
 * @param {string} url
 * @returns {string}
 */
export function siteOriginFromContentUrl(url) {
  try {
    return originFromHttpUrl(url);
  } catch {
    return "";
  }
}
