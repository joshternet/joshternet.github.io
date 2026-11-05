/**
 * Goal & Constraints:
 * Shared helpers for full-site NLP crawl and topic sync. SSRF-safe fetches,
 * caps, and deterministic slugify. Works for any future registry origin.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { formatTextForPath } from "../format-written.mjs";
import { assertPublicURL, normalizeText } from "../network/lib.mjs";
import { slugifyTopic } from "../network/connections.mjs";
import {
  MAX_PUBLIC_FETCH_REDIRECTS,
  readCappedResponseBytes,
} from "../network/public-fetch-guard.mjs";
import {
  conditionalHeadersFromEntry,
  readFetchCacheBody,
  writeFetchCacheEntry,
} from "./fetch-cache.mjs";
import { parseHtmlRegions } from "./text.mjs";

/**
 * Finite per-origin page budget for fair crawls. Override via crawl options
 * `maxPagesPerOrigin`. Large photo archives must not starve creative indexes.
 */
export const MAX_PAGES_PER_ORIGIN = 250;
export const MAX_BYTES_PER_RESPONSE = 1_500_000;
/** Manual redirect hop ceiling (parity with preview/verify and poster fetches). */
export const MAX_FETCH_REDIRECTS = MAX_PUBLIC_FETCH_REDIRECTS;
export const MAX_CRAWL_DEPTH = 4;
export const MAX_TOPICS_PER_ORIGIN = 24;
/** Same-origin topic pages followed from a hub listing. */
export const MAX_TOPIC_HUB_CHILDREN = 40;
/** Same-origin article/creative pages followed from a content index. */
export const MAX_CONTENT_INDEX_CHILDREN = 80;
export const FETCH_TIMEOUT_MS = 12_000;
/** Canonical crawl UA — same identity as JoshBot (`/joshbot/`). */
export const USER_AGENT =
  "Joshternet-Joshbot (+https://joshternet.org/joshbot)";

export { slugifyTopic, normalizeText };

/**
 * English stopwords for keyphrase filtering (first-party list).
 */
export const STOPWORDS = new Set(
  `
a about above after again against all am an and another any are as at be because
been before being below between both but by can could did do does doing down
during each every few for from further had has have having he her here hers
herself him himself his how i if in into is it its itself just me more most my
myself no nor not of off on once one only or other our ours ourselves out over
own same she should so some such than that the their theirs them themselves then
there these they this those through to too under until up very was we were what
when where which while who whom why will with without you your yours yourself
yourselves also via etc com www http https html made may need now
`
    .trim()
    .split(/\s+/),
);

/**
 * @param {string} filePath
 * @param {unknown} fallback
 * @returns {Promise<unknown>}
 */
export async function readJSONIfExists(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

/**
 * Atomically writes JSON after Prettier-formatting when the path is supported.
 * @param {string} filePath - Destination path (used for Prettier parser/ignore).
 * @param {unknown} value - Value passed to JSON.stringify.
 * @returns {Promise<void>}
 */
export async function writeJSONAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  const raw = `${JSON.stringify(value, null, 2)}\n`;
  const formatted = await formatTextForPath(filePath, raw);
  await fs.writeFile(temporary, formatted, "utf8");
  await fs.rename(temporary, filePath);
}

/**
 * Atomically writes text after Prettier-formatting when the path is supported.
 * @param {string} filePath - Destination path (used for Prettier parser/ignore).
 * @param {string} text - Raw file body before formatting.
 * @returns {Promise<void>}
 */
export async function writeTextAtomic(filePath, text) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  const formatted = await formatTextForPath(filePath, text);
  await fs.writeFile(temporary, formatted, "utf8");
  await fs.rename(temporary, filePath);
}

/**
 * Fetches a public URL with timeout and byte cap. Oversized bodies are
 * truncated so a huge feed or homepage does not abort the crawl.
 * When `httpCache` is set, sends conditional headers and reuses bodies on 304.
 * @param {string} href
 * @param {{
 *   cache?: Map<string, unknown>,
 *   accept?: string,
 *   maxBytes?: number,
 *   overflow?: "truncate" | "throw",
 *   httpCache?: import("./fetch-cache.mjs").FetchCache,
 *   redirectsRemaining?: number,
 *   captureHttpErrors?: boolean,
 *   unconditional?: boolean,
 *   deadlineAt?: number,
 * }} [options]
 * @returns {Promise<{
 *   url: string,
 *   requested_url: string,
 *   final_url: string,
 *   contentType: string,
 *   body: string,
 *   status: number,
 *   body_complete: boolean,
 *   bytes_received: number,
 *   byte_limit: number,
 *   from_cache: boolean,
 *   unchanged?: boolean,
 *   retry_after?: string,
 * }>}
 */
export async function fetchPublicText(href, options = {}) {
  const redirectsRemaining =
    typeof options.redirectsRemaining === "number"
      ? options.redirectsRemaining
      : MAX_FETCH_REDIRECTS;
  const deadlineAt =
    typeof options.deadlineAt === "number"
      ? options.deadlineAt
      : Date.now() + FETCH_TIMEOUT_MS * (redirectsRemaining + 1);
  if (Date.now() > deadlineAt) {
    throw new Error(`fetch deadline exceeded for ${href}`);
  }
  const url = await assertPublicURL(href, { cache: options.cache });
  const controller = new AbortController();
  const hopBudget = Math.max(1, deadlineAt - Date.now());
  const timer = setTimeout(
    () => controller.abort(),
    Math.min(FETCH_TIMEOUT_MS, hopBudget),
  );
  const maxBytes =
    typeof options.maxBytes === "number" && options.maxBytes > 0
      ? options.maxBytes
      : MAX_BYTES_PER_RESPONSE;
  const overflow = options.overflow === "throw" ? "throw" : "truncate";
  const httpCache = options.httpCache;
  const prior =
    httpCache && !httpCache.bypass && options.unconditional !== true
      ? httpCache.entries.get(url.href)
      : null;
  const conditional = conditionalHeadersFromEntry(prior);

  try {
    const response = await fetch(url.href, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: options.accept || "text/html,application/xhtml+xml,*/*;q=0.8",
        "User-Agent": USER_AGENT,
        ...conditional,
      },
    });

    if (response.status === 304) {
      if (httpCache) {
        const cached = await readFetchCacheBody(httpCache, url.href);

        if (cached && cached.entry.bodyComplete === true) {
          return {
            url: url.href,
            requested_url: href,
            final_url: url.href,
            contentType: cached.entry.contentType || "",
            body: cached.body,
            status: 304,
            body_complete: true,
            bytes_received: Buffer.byteLength(cached.body),
            byte_limit: maxBytes,
            from_cache: true,
            unchanged: true,
            retry_after: "",
          };
        }
      }

      if (options.unconditional !== true) {
        return fetchPublicText(href, {
          ...options,
          unconditional: true,
          deadlineAt,
          redirectsRemaining,
        });
      }

      throw new Error(`HTTP 304 without cache for ${url.href}`);
    }

    if (response.status >= 300 && response.status < 400) {
      if (redirectsRemaining <= 0) {
        throw new Error(`Exceeded ${MAX_FETCH_REDIRECTS} redirects`);
      }

      const location = response.headers.get("location");

      if (!location) {
        throw new Error(`redirect without location from ${url.href}`);
      }

      const next = new URL(location, url.href).href;
      await assertPublicURL(next, { cache: options.cache });
      return fetchPublicText(next, {
        ...options,
        redirectsRemaining: redirectsRemaining - 1,
        deadlineAt,
      });
    }

    if (!response.ok) {
      if (options.captureHttpErrors === true) {
        return {
          url: url.href,
          requested_url: href,
          final_url: url.href,
          contentType: response.headers.get("content-type") || "",
          body: "",
          status: response.status,
          body_complete: false,
          bytes_received: 0,
          byte_limit: maxBytes,
          from_cache: false,
          unchanged: false,
          retry_after: response.headers.get("retry-after") || "",
        };
      }
      throw new Error(`HTTP ${response.status} for ${url.href}`);
    }

    const contentType = response.headers.get("content-type") || "";
    /** @type {{ bodyComplete?: boolean, bytesReceived?: number }} */
    const detail = {};
    let buffer;

    try {
      buffer = await readCappedResponseBytes(response, maxBytes, {
        overflow,
        detail,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (/exceeds|too large/i.test(message)) {
        throw new Error(`response too large for ${url.href}`);
      }

      throw error;
    }

    const body = buffer.toString("utf8");
    const bodyComplete = detail.bodyComplete !== false;

    if (httpCache && !httpCache.bypass && bodyComplete) {
      await writeFetchCacheEntry(httpCache, {
        url: url.href,
        body,
        contentType,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        bodyComplete: true,
      });
    }

    return {
      url: url.href,
      requested_url: href,
      final_url: url.href,
      contentType,
      body,
      status: response.status,
      body_complete: bodyComplete,
      bytes_received: detail.bytesReceived,
      byte_limit: maxBytes,
      from_cache: false,
      unchanged: false,
      retry_after: response.headers.get("retry-after") || "",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strips tags and keeps readable text from HTML (semantic regions).
 * @param {string} html
 * @returns {{title: string, text: string, links: Array<{href: string, text: string, rel?: string[]}>, noindex: boolean, derived: boolean, lang: string}}
 */
export function parseHtmlDocument(html) {
  const regions = parseHtmlRegions(html);
  return {
    title: regions.title,
    text: regions.textForTopics,
    links: regions.links,
    noindex: regions.noindex,
    derived: regions.derived,
    lang: regions.lang,
  };
}
