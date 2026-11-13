/**
 * Goal & Constraints:
 * Extract explicitly marked Seeking requests (h-listing + action wanted) from
 * eligible /seeking pages. Keep extraction testable without network access.
 * Listing u-url is contact only — never the source permalink. Request text
 * must not enter content/topics/search projections. Public view is build-local
 * (gitignored). Local crawls write real excerpts for preview; CI stays shadow
 * unless JOSHTERNET_SEEKING_PUBLISH opts in (staging still never commits them).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isHubParticipantOrigin } from "../network/connections.mjs";
import { secondaryToPrimaryFromNetwork } from "../network/site-families.mjs";
import { fetchPublicText, writeJSONAtomic } from "./lib.mjs";
import { resolvePreviewPublish } from "./preview-publish.mjs";
import { decodeCrawlValue } from "./site-record.mjs";
import {
  MAX_SUMMARY_CHARS,
  MAX_TITLE_CHARS,
  capRemoteString,
  normalizeExtractedText,
  normalizeLanguageTag,
} from "./text.mjs";

/**
 * True when Seeking must ignore this origin or page URL.
 * The hub `/seeking/` page aggregates member requests; crawling it would
 * duplicate those listings as if they were hub-owned observations.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSeekingHubOrigin(value) {
  return isHubParticipantOrigin(typeof value === "string" ? value : "");
}

/** Days without a successful complete source check before hiding a request. */
export const SEEKING_FRESHNESS_DAYS = 30;

/** Build-local public Seeking view (must not be committed). */
export const SEEKING_PUBLIC_RELATIVE = path.join("_data", "seeking.json");

/** Ephemeral observation state under the existing gitignored sync cache. */
export const SEEKING_STATE_RELATIVE = path.join(
  ".network-sync",
  "seeking-state.json",
);

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * True when a URL path is a Seeking requests page (not /seeking/docs).
 * @param {string} url
 * @returns {boolean}
 */
export function isSeekingPageUrl(url) {
  if (typeof url !== "string" || !url) {
    return false;
  }

  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";
    const lower = pathname.toLowerCase();

    if (/^\/seeking\/docs(?:\/|$)/.test(lower)) {
      return false;
    }

    return /^\/seeking(?:\/|\.html?)?$/.test(lower);
  } catch {
    return false;
  }
}

/**
 * Whether Seeking excerpts are treated as publish-enabled for metrics/logging.
 * Local (non-CI) defaults on so `/seeking/` can show crawl results; CI defaults
 * off. The public JSON file is always written when state exists (gitignored).
 * @param {boolean} [explicit]
 * @returns {boolean}
 */
export function isSeekingPublishEnabled(explicit) {
  return resolvePreviewPublish("JOSHTERNET_SEEKING_PUBLISH", explicit);
}

/**
 * Same-origin Seeking page candidates for a site origin.
 * @param {string} origin - Absolute origin.
 * @returns {string[]} Absolute URLs.
 */
export function seekingCandidateUrls(origin) {
  if (isSeekingHubOrigin(origin)) {
    return [];
  }

  let base;

  try {
    base = new URL(origin);
  } catch {
    return [];
  }

  const root = `${base.protocol}//${base.host}`;
  return [`${root}/seeking/`, `${root}/seeking`, `${root}/seeking.html`];
}

/**
 * Fetches the first available Seeking page HTML for an origin.
 * Used when deep crawl is short-circuited (or missed /seeking) so Seeking
 * datasets still refresh without waiting for feed/sitemap churn.
 * @param {string} origin
 * @param {{
 *   cache?: object,
 *   httpCache?: import("./fetch-cache.mjs").FetchCache,
 *   fetchText?: typeof fetchPublicText,
 * }} [options]
 * @returns {Promise<Array<{ url: string, html: string, lang: string }>>}
 */
export async function fetchSeekingHtmlPages(origin, options = {}) {
  const fetchText =
    typeof options.fetchText === "function"
      ? options.fetchText
      : fetchPublicText;
  const pages = [];

  for (const candidate of seekingCandidateUrls(origin)) {
    try {
      const fetched = await fetchText(candidate, {
        cache: options.cache,
        httpCache: options.httpCache,
      });
      const finalUrl = String(fetched?.url || candidate);

      if (
        typeof fetched?.body === "string" &&
        fetched.body &&
        isSeekingPageUrl(finalUrl)
      ) {
        pages.push({
          url: finalUrl,
          html: fetched.body,
          lang: "",
        });
        break;
      }
    } catch {
      // Try the next candidate path.
    }
  }

  return pages;
}

/**
 * Strips tags from an HTML fragment and normalizes text.
 * @param {string} html
 * @returns {string}
 */
function plainFromHtml(html) {
  return normalizeExtractedText(String(html || "").replace(/<[^>]+>/g, " "));
}

/**
 * Reads a microformats class property value from an HTML chunk.
 * Prefers `value` / `datetime` attributes, then element text.
 * @param {string} chunk
 * @param {string} className
 * @returns {string}
 */
function mf2Property(chunk, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const attrPattern = new RegExp(
    `<[^>]*class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*(?:value|datetime)=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const attrMatch = chunk.match(attrPattern);

  if (attrMatch) {
    return normalizeExtractedText(attrMatch[1]);
  }

  const textPattern = new RegExp(
    `<[^>]*class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\w+>`,
    "i",
  );
  const textMatch = chunk.match(textPattern);

  if (!textMatch) {
    return "";
  }

  return plainFromHtml(textMatch[1]);
}

/**
 * Collects all p-category labels from a listing chunk.
 * @param {string} chunk
 * @returns {string[]}
 */
function mf2Categories(chunk) {
  const categories = [];
  const openPattern = /<[^>]*class=["'][^"']*\bp-category\b[^"']*["'][^>]*>/gi;
  let openMatch;

  while ((openMatch = openPattern.exec(chunk))) {
    const openTag = openMatch[0];
    const valueMatch = openTag.match(/\bvalue=["']([^"']+)["']/i);
    let label = valueMatch ? normalizeExtractedText(valueMatch[1]) : "";

    if (!label) {
      const closeMatch = chunk
        .slice(openMatch.index + openTag.length)
        .match(/^([\s\S]*?)<\/\w+>/);
      label = plainFromHtml(closeMatch ? closeMatch[1] : "");
    }

    if (label && !categories.includes(label)) {
      categories.push(label);
    }
  }

  return categories;
}

/**
 * Resolves a href against a page URL. Allows http(s) and mailto.
 * @param {string} raw
 * @param {string} base
 * @returns {string}
 */
function resolveHref(raw, base) {
  const href = String(raw || "").trim();

  if (!href) {
    return "";
  }

  try {
    const url = new URL(href, base);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:" &&
      url.protocol !== "mailto:"
    ) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

/**
 * Reads id attribute from an opening tag string.
 * @param {string} openTag
 * @returns {string}
 */
function elementIdFromOpenTag(openTag) {
  const match = String(openTag || "").match(/\bid=["']([^"']+)["']/i);
  return match ? normalizeExtractedText(match[1]) : "";
}

/**
 * Finds the matching closing tag index for a nested HTML element, counting
 * same-tag depth so inner `<div>` wrappers do not truncate an outer listing.
 * @param {string} html
 * @param {string} tagName
 * @param {number} innerStart
 * @returns {number} Index of the closing tag start, or -1
 */
function findMatchingCloseIndex(html, tagName, innerStart) {
  const lower = html.toLowerCase();
  const openToken = `<${tagName}`;
  const closeToken = `</${tagName}>`;
  let depth = 1;
  let cursor = innerStart;
  let matchClose = -1;

  while (cursor < html.length && depth > 0) {
    const nextOpen = lower.indexOf(openToken, cursor);
    const nextClose = lower.indexOf(closeToken, cursor);

    if (nextClose === -1) {
      return -1;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      const after = lower[nextOpen + openToken.length];
      const tagEnd = lower.indexOf(">", nextOpen);

      if (
        tagEnd !== -1 &&
        (after === ">" ||
          after === " " ||
          after === "\n" ||
          after === "\t" ||
          after === "/")
      ) {
        const openTag = lower.slice(nextOpen, tagEnd + 1);

        // Self-closing tags do not nest.
        if (!openTag.endsWith("/>")) {
          depth += 1;
        }

        cursor = tagEnd + 1;
        continue;
      }

      cursor = nextOpen + openToken.length;
      continue;
    }

    depth -= 1;

    if (depth === 0) {
      matchClose = nextClose;
      break;
    }

    cursor = nextClose + closeToken.length;
  }

  return matchClose;
}

/**
 * Extracts the inner HTML of the first e-description in a chunk, excluding
 * nested h-* roots so nested products do not contaminate the request text.
 * @param {string} chunk
 * @returns {string}
 */
function extractDescriptionHtml(chunk) {
  const openMatch = chunk.match(
    /<(\w+)\b[^>]*class=["'][^"']*\be-description\b[^"']*["'][^>]*>/i,
  );

  if (!openMatch) {
    return "";
  }

  const tagName = openMatch[1].toLowerCase();
  const innerStart = openMatch.index + openMatch[0].length;
  const closeTag = `</${tagName}>`;
  const closePos = chunk.toLowerCase().indexOf(closeTag, innerStart);

  if (closePos === -1) {
    return "";
  }

  return chunk.slice(innerStart, closePos);
}

/**
 * Nested p-item name for optional item metadata (does not replace description).
 * @param {string} chunk
 * @returns {string}
 */
function nestedItemName(chunk) {
  const itemOpen = chunk.match(
    /<(\w+)\b[^>]*class=["'][^"']*\bp-item\b[^"']*["'][^>]*>/i,
  );

  if (!itemOpen) {
    return "";
  }

  const tagName = itemOpen[1].toLowerCase();
  const innerStart = itemOpen.index + itemOpen[0].length;
  const closePos = chunk.toLowerCase().indexOf(`</${tagName}>`, innerStart);

  if (closePos === -1) {
    return "";
  }

  const itemChunk = chunk.slice(innerStart, closePos);
  return capRemoteString(mf2Property(itemChunk, "p-name"), MAX_TITLE_CHARS);
}

/**
 * Page-level update date from common visible date patterns.
 * @param {string} html
 * @returns {string}
 */
export function pageUpdatedFromHtml(html) {
  const patterns = [
    /<time\b[^>]*class=["'][^"']*\bdt-updated\b[^"']*["'][^>]*datetime=["']([^"']+)["']/i,
    /<time\b[^>]*datetime=["']([^"']+)["'][^>]*class=["'][^"']*\bdt-updated\b[^"']*["']/i,
    /(?:page\s+updated|last\s+updated|updated)\s*:?\s*<time\b[^>]*datetime=["']([^"']+)["']/i,
    /<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = String(html || "").match(pattern);

    if (match?.[1]) {
      return normalizeExtractedText(match[1]);
    }
  }

  return "";
}

/**
 * Extract wanted h-listing requests from a Seeking page HTML document.
 * @param {string} html
 * @param {string} pageUrl
 * @param {{ siteOrigin: string, siteTitle?: string, observedAt?: string, language?: string }} meta
 * @returns {{ page: Record<string, unknown>, requests: Array<Record<string, unknown>> }}
 */
export function seekingFromHtml(html, pageUrl, meta) {
  const siteOrigin = String(meta?.siteOrigin || "");
  const observedAt = String(meta?.observedAt || "");
  const siteTitle = capRemoteString(
    String(meta?.siteTitle || ""),
    MAX_TITLE_CHARS,
  );
  const language = normalizeLanguageTag(String(meta?.language || "")) || "";
  const requests = [];

  if (!siteOrigin || typeof html !== "string" || !html || !pageUrl) {
    return {
      page: {
        page_url: pageUrl || "",
        site_origin: siteOrigin,
        site_title: siteTitle,
        domain: "",
        page_updated: "",
        last_checked: observedAt,
        language,
        complete: false,
      },
      requests,
    };
  }

  let domain = "";

  try {
    domain = new URL(siteOrigin).hostname;
  } catch {
    domain = "";
  }

  const pageUpdated = pageUpdatedFromHtml(html);
  const openPattern =
    /<(\w+)\b[^>]*class=["'][^"']*\bh-listing\b[^"']*["'][^>]*>/gi;
  let match;

  while ((match = openPattern.exec(html))) {
    const tagName = match[1].toLowerCase();
    const openTag = match[0];
    const innerStart = match.index + match[0].length;
    const closePos = findMatchingCloseIndex(html, tagName, innerStart);

    if (closePos === -1) {
      continue;
    }

    const chunk = html.slice(innerStart, closePos);
    const action = mf2Property(chunk, "p-action").toLowerCase();

    if (action !== "wanted") {
      continue;
    }

    const description = capRemoteString(
      plainFromHtml(extractDescriptionHtml(chunk)),
      MAX_SUMMARY_CHARS,
    );

    if (!description) {
      continue;
    }

    const fragment = elementIdFromOpenTag(openTag);
    let sourceUrl = pageUrl;

    try {
      const source = new URL(pageUrl);

      if (fragment) {
        source.hash = fragment;
      }

      sourceUrl = source.href;
    } catch {
      sourceUrl = pageUrl;
    }

    const contactHrefMatch = chunk.match(
      /<a\b[^>]*class=["'][^"']*\bu-url\b[^"']*["'][^>]*href=["']([^"']*)["']/i,
    );
    const contactUrl = resolveHref(
      contactHrefMatch ? contactHrefMatch[1] : "",
      pageUrl,
    );

    const title = capRemoteString(
      mf2Property(chunk, "p-name"),
      MAX_TITLE_CHARS,
    );
    const categories = mf2Categories(chunk);
    const itemName = nestedItemName(chunk);
    const requestPublished = mf2Property(chunk, "dt-published");
    const requestUpdated =
      mf2Property(chunk, "dt-updated") || mf2Property(chunk, "dt-modified");
    const identity = `seeking:${siteOrigin}:${fragment || description.slice(0, 80)}`;

    requests.push({
      identity,
      description,
      title,
      categories,
      item_name: itemName,
      request_published: requestPublished,
      request_updated: requestUpdated,
      source_url: sourceUrl,
      contact_url: contactUrl,
      site_origin: siteOrigin,
      page_url: pageUrl,
    });
  }

  return {
    page: {
      page_url: pageUrl,
      site_origin: siteOrigin,
      site_title: siteTitle,
      domain,
      page_updated: pageUpdated,
      last_checked: observedAt,
      language,
      complete: true,
    },
    requests,
  };
}

/**
 * Collect Seeking observations from crawled page records.
 * @param {Array<{url?: string, html?: string, lang?: string, title?: string}>} pages
 * @param {{ siteOrigin: string, siteTitle?: string, observedAt?: string }} meta
 * @returns {{ pages: Array<Record<string, unknown>>, requests: Array<Record<string, unknown>> }}
 */
export function collectSeeking(pages, meta) {
  const siteOrigin = String(meta?.siteOrigin || "");
  const observedAt = String(meta?.observedAt || "");
  const siteTitle = String(meta?.siteTitle || "");
  const pageRows = [];
  const requests = [];

  if (!siteOrigin || isSeekingHubOrigin(siteOrigin)) {
    return { pages: pageRows, requests };
  }

  for (const page of Array.isArray(pages) ? pages : []) {
    if (!page || typeof page.html !== "string" || !page.html || !page.url) {
      continue;
    }

    if (isSeekingHubOrigin(page.url) || !isSeekingPageUrl(page.url)) {
      continue;
    }

    const extracted = seekingFromHtml(page.html, page.url, {
      siteOrigin,
      siteTitle,
      observedAt,
      language: page.lang || "",
    });
    pageRows.push(extracted.page);
    requests.push(...extracted.requests);
  }

  return { pages: pageRows, requests };
}

/**
 * @param {string} iso
 * @param {Date} now
 * @returns {boolean}
 */
function isFreshObservation(iso, now) {
  if (!iso) {
    return false;
  }

  const checked = Date.parse(iso);

  if (Number.isNaN(checked)) {
    return false;
  }

  const ageMs = now.getTime() - checked;
  return ageMs <= SEEKING_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Reconcile prior Seeking state with this crawl's observations.
 * Successful complete refresh with absent listings removes those requests.
 * Failed/incomplete crawls keep prior requests until freshness expires.
 * @param {Record<string, unknown>|null|undefined} prior
 * @param {Array<{origin: string, title?: string, pages: Array<{url?: string, html?: string, lang?: string}>, complete?: boolean, failed?: boolean}>} originInputs
 * @param {{ observedAt?: string, now?: Date }} [options]
 * @returns {Record<string, unknown>}
 */
export function reconcileSeekingState(prior, originInputs, options = {}) {
  const observedAt = String(options.observedAt || new Date().toISOString());
  const now = options.now instanceof Date ? options.now : new Date(observedAt);
  /** @type {Map<string, Record<string, unknown>>} */
  const byOrigin = new Map();

  const priorOrigins = Array.isArray(prior?.origins) ? prior.origins : [];

  for (const row of priorOrigins) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const origin = String(row.origin || "");

    if (!origin || isSeekingHubOrigin(origin)) {
      continue;
    }

    byOrigin.set(origin, {
      origin,
      title: String(row.title || ""),
      page_url: String(row.page_url || ""),
      page_updated: String(row.page_updated || ""),
      last_checked: String(row.last_checked || ""),
      language: String(row.language || ""),
      complete: Boolean(row.complete),
      requests: Array.isArray(row.requests)
        ? row.requests.map((request) => ({ ...request }))
        : [],
    });
  }

  for (const input of Array.isArray(originInputs) ? originInputs : []) {
    const origin = String(input?.origin || "");

    if (!origin || isSeekingHubOrigin(origin)) {
      continue;
    }

    if (input.failed || input.complete === false) {
      // Keep prior observation; do not claim withdrawal or fulfillment.
      continue;
    }

    const collected = input.collected
      ? input.collected
      : collectSeeking(input.pages || [], {
          siteOrigin: origin,
          siteTitle: input.title || "",
          observedAt,
        });

    if (collected.pages.length === 0) {
      // Complete origin crawl without a Seeking page fetch is not confirmation
      // that requests were withdrawn — keep prior observations until freshness
      // expires or a Seeking page is successfully re-read.
      continue;
    }

    const page = collected.pages[0];
    byOrigin.set(origin, {
      origin,
      title: String(input.title || page.site_title || ""),
      page_url: String(page.page_url || ""),
      page_updated: String(page.page_updated || ""),
      last_checked: observedAt,
      language: String(page.language || ""),
      complete: true,
      requests: collected.requests,
    });
  }

  const origins = [...byOrigin.values()]
    .filter((row) => isFreshObservation(String(row.last_checked || ""), now))
    .sort((a, b) => String(a.origin).localeCompare(String(b.origin)));

  return {
    generated_at: observedAt,
    freshness_days: SEEKING_FRESHNESS_DAYS,
    origins,
  };
}

/**
 * Build the public Seeking collection document from reconciled state.
 * @param {Record<string, unknown>|null|undefined} state
 * @param {{ unavailable?: boolean, generatedAt?: string }} [options]
 * @returns {Record<string, unknown>}
 */
export function buildSeekingView(state, options = {}) {
  const generatedAt = String(
    options.generatedAt || state?.generated_at || new Date().toISOString(),
  );

  if (options.unavailable) {
    return {
      generated_at: generatedAt,
      status: "unavailable",
      request_count: 0,
      website_count: 0,
      categories: [],
      sites: [],
    };
  }

  const origins = Array.isArray(state?.origins) ? state.origins : [];
  /** @type {Map<string, string>} */
  const secondaryToPrimary =
    options.secondaryToPrimary instanceof Map
      ? options.secondaryToPrimary
      : new Map();
  /** @type {Map<string, Record<string, unknown>>} */
  const networkByOrigin =
    options.networkByOrigin instanceof Map
      ? options.networkByOrigin
      : new Map();
  /** @type {Map<string, string>} */
  const categorySet = new Map();
  /** @type {Map<string, Record<string, unknown>>} */
  const sitesByPromotedOrigin = new Map();

  for (const originRow of origins) {
    const requests = Array.isArray(originRow.requests)
      ? originRow.requests
      : [];

    if (requests.length === 0) {
      continue;
    }

    const rawOrigin = String(originRow.origin || "");
    const promotedOrigin = secondaryToPrimary.get(rawOrigin) || rawOrigin || "";

    if (!promotedOrigin) {
      continue;
    }

    const promotedSite = networkByOrigin.get(promotedOrigin);
    let domain = "";

    try {
      domain = new URL(String(promotedSite?.origin || promotedOrigin)).hostname;
    } catch {
      domain = String(promotedSite?.domain || promotedOrigin);
    }

    const siteRequests = requests.map((request) => {
      for (const category of Array.isArray(request.categories)
        ? request.categories
        : []) {
        const label = String(category || "").trim();

        if (label) {
          categorySet.set(label.toLowerCase(), label);
        }
      }

      return {
        identity: String(request.identity || ""),
        description: String(request.description || ""),
        title: String(request.title || ""),
        categories: Array.isArray(request.categories)
          ? request.categories.map(String)
          : [],
        item_name: String(request.item_name || ""),
        request_published: String(request.request_published || ""),
        request_updated: String(request.request_updated || ""),
        source_url: String(request.source_url || originRow.page_url || ""),
        // contact_url intentionally omitted from public view to avoid building
        // a Joshternet contact directory; visitors use the source page.
      };
    });

    const existing = sitesByPromotedOrigin.get(promotedOrigin);

    if (existing) {
      existing.requests = [
        ...(Array.isArray(existing.requests) ? existing.requests : []),
        ...siteRequests,
      ];
      continue;
    }

    sitesByPromotedOrigin.set(promotedOrigin, {
      origin: promotedOrigin,
      domain,
      site_title: String(promotedSite?.title || originRow.title || domain),
      page_url: String(originRow.page_url || ""),
      page_updated: String(originRow.page_updated || ""),
      last_checked: String(originRow.last_checked || ""),
      language: String(originRow.language || ""),
      requests: siteRequests,
    });
  }

  const sites = [...sitesByPromotedOrigin.values()];

  sites.sort((a, b) =>
    String(a.site_title || a.domain).localeCompare(
      String(b.site_title || b.domain),
      undefined,
      { sensitivity: "base" },
    ),
  );

  const requestCount = sites.reduce(
    (sum, site) => sum + site.requests.length,
    0,
  );
  const categories = [...categorySet.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );

  return {
    generated_at: generatedAt,
    status: requestCount > 0 ? "ok" : "empty",
    request_count: requestCount,
    website_count: sites.length,
    categories,
    sites,
  };
}

/**
 * Formats visitor-facing request/website counts.
 * @param {number} requestCount
 * @param {number} websiteCount
 * @returns {string}
 */
export function formatSeekingCounts(requestCount, websiteCount) {
  const requests = Number(requestCount) || 0;
  const websites = Number(websiteCount) || 0;
  const requestLabel = requests === 1 ? "request" : "requests";
  const websiteLabel = websites === 1 ? "website" : "websites";
  return `${requests} ${requestLabel} from ${websites} ${websiteLabel}`;
}

/**
 * Approved visitor-facing status strings for Seeking UI.
 */
export const SEEKING_COPY = Object.freeze({
  empty:
    "No requests to show yet. Explore the Network to see what people are sharing on their own websites.",
  filterEmpty: "No requests match these filters. Clear them to see the rest.",
  unavailable:
    "Requests aren’t available right now. You can still explore the Network and visit participating websites.",
  loading: "Loading requests…",
  readRequest: "Read the request",
  browseByTopic: "Browse by topic",
  clearFilters: "Clear filters",
  aboutLink: "About Seeking pages",
  resultsHeading: "Requests from around the network",
});

/**
 * Build and optionally write Seeking state + public view.
 * Public JSON is always written locally for preview; callers must not commit it.
 * @param {{
 *   repoRoot?: string,
 *   origins: Array<{origin: string, title?: string, pages: Array<{url?: string, html?: string, lang?: string}>, complete?: boolean, failed?: boolean}>,
 *   observed_at?: string,
 *   publish?: boolean,
 *   unavailable?: boolean,
 * }} input
 * @returns {Promise<{ state: Record<string, unknown>, view: Record<string, unknown>, publish: boolean, publicPath: string, statePath: string }>}
 */
export async function buildSeekingDatasets(input) {
  const repoRoot = input.repoRoot || ROOT;
  const observedAt = String(input.observed_at || new Date().toISOString());
  const publish = isSeekingPublishEnabled(input.publish);
  const statePath = path.join(repoRoot, SEEKING_STATE_RELATIVE);
  const publicPath = path.join(repoRoot, SEEKING_PUBLIC_RELATIVE);

  let prior = null;

  try {
    prior = decodeCrawlValue(JSON.parse(await fs.readFile(statePath, "utf8")));
  } catch {
    prior = null;
  }

  const state = input.unavailable
    ? {
        generated_at: observedAt,
        freshness_days: SEEKING_FRESHNESS_DAYS,
        origins: [],
        unavailable: true,
      }
    : reconcileSeekingState(prior, input.origins || [], {
        observedAt,
      });

  const network = Array.isArray(input.network) ? input.network : [];
  /** @type {Map<string, Record<string, unknown>>} */
  const networkByOrigin = new Map();

  for (const site of network) {
    if (site && typeof site.origin === "string" && site.origin) {
      networkByOrigin.set(site.origin, site);
    }
  }

  const view = buildSeekingView(state, {
    generatedAt: observedAt,
    unavailable: Boolean(input.unavailable || state.unavailable),
    secondaryToPrimary: secondaryToPrimaryFromNetwork(network),
    networkByOrigin,
  });

  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await writeJSONAtomic(statePath, state);

  // Always write the current public view. The file is gitignored; network-sync
  // never stages it. Local crawls need real excerpts so /seeking/ is verifiable.
  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await writeJSONAtomic(publicPath, {
    ...view,
    publish_enabled: publish,
  });

  return { state, view, publish, publicPath, statePath };
}

/**
 * Refresh `_data/seeking.json` from ephemeral state during views:build.
 * @param {string} [repoRoot]
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function writeSeekingViewFromState(repoRoot = ROOT) {
  const statePath = path.join(repoRoot, SEEKING_STATE_RELATIVE);
  const publicPath = path.join(repoRoot, SEEKING_PUBLIC_RELATIVE);
  const publish = isSeekingPublishEnabled();

  let state = null;

  try {
    state = decodeCrawlValue(JSON.parse(await fs.readFile(statePath, "utf8")));
  } catch {
    state = null;
  }

  let network = [];

  try {
    network = decodeCrawlValue(
      JSON.parse(
        await fs.readFile(path.join(repoRoot, "_data", "network.json"), "utf8"),
      ),
    );
  } catch {
    network = [];
  }

  if (!Array.isArray(network)) {
    network = [];
  }

  /** @type {Map<string, Record<string, unknown>>} */
  const networkByOrigin = new Map();

  for (const site of network) {
    if (site && typeof site.origin === "string" && site.origin) {
      networkByOrigin.set(site.origin, site);
    }
  }

  const view = buildSeekingView(state, {
    unavailable: Boolean(state?.unavailable),
    secondaryToPrimary: secondaryToPrimaryFromNetwork(network),
    networkByOrigin,
  });

  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await writeJSONAtomic(publicPath, {
    ...view,
    publish_enabled: publish,
  });
  return view;
}
