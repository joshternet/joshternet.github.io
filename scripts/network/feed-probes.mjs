/**
 * Goal & Constraints:
 * When a homepage advertises no feed alternates, probe common indie feed paths
 * so non-Josh / artlung-shaped sites still seed NLP. Generic paths only—no
 * host allowlists. Inject fetchImpl in tests (no live network).
 */

import dns from "node:dns/promises";

import { assertPublicURL, normalizeText } from "./lib.mjs";

/** Probe when fewer than this many sanitized feeds exist. */
export const FEED_PROBE_WHEN_BELOW = 1;

/** Common same-origin feed locations when rel=alternate is empty. */
export const COMMON_FEED_PATHS = [
  "/feed/",
  "/rss.xml",
  "/atom.xml",
  "/index.xml",
];

const FEED_PROBE_TIMEOUT_MS = 8_000;
const FEED_PROBE_MAX_BYTES = 1_500_000;

/**
 * Infers a feed MIME type from Content-Type and a body sniff.
 * @param {string} contentType
 * @param {string} body
 * @returns {string} Empty when not a feed.
 */
export function sniffFeedType(contentType, body) {
  const type = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (
    type === "application/rss+xml" ||
    type === "application/atom+xml" ||
    type === "application/feed+json" ||
    type === "application/json"
  ) {
    return type;
  }

  const sample = String(body || "").slice(0, 4000);

  if (/<rss[\s>]/i.test(sample) || /<rdf:RDF[\s>]/i.test(sample)) {
    return "application/rss+xml";
  }

  if (/<feed[\s>]/i.test(sample)) {
    return "application/atom+xml";
  }

  if (
    /^\s*\{/.test(sample) &&
    /"version"\s*:/.test(sample) &&
    /"items"\s*:/.test(sample)
  ) {
    return "application/feed+json";
  }

  return "";
}

/**
 * Fetches one URL with a byte cap (testable via fetchImpl).
 * @param {string} href
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<{ contentType: string, body: string } | null>}
 */
async function fetchFeedCandidate(href, options = {}) {
  const fetchImpl =
    typeof options.fetchImpl === "function" ? options.fetchImpl : fetch;
  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs >= 0
      ? options.timeoutMs
      : FEED_PROBE_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(href, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, */*;q=0.8",
        "User-Agent":
          "JoshternetNetwork/1.0 (+https://joshternet.org; feed discovery)",
      },
    });

    if (!response.ok) {
      clearTimeout(timer);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const ab = await response.arrayBuffer();
    const buffer = Buffer.from(ab.slice(0, FEED_PROBE_MAX_BYTES));
    clearTimeout(timer);
    return { contentType, body: buffer.toString("utf8") };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Appends probed feed declarations when the homepage advertised none.
 * @param {string} origin
 * @param {Array<{url: string, type: string, title?: string}>} existingFeeds
 * @param {{
 *   lookup?: typeof dns.lookup,
 *   cache?: Map<string, unknown>,
 *   fetchImpl?: typeof fetch,
 *   paths?: string[],
 *   timeoutMs?: number,
 * }} [options]
 * @returns {Promise<Array<{url: string, type: string, title?: string}>>}
 */
export async function probeCommonFeedPaths(
  origin,
  existingFeeds,
  options = {},
) {
  const current = Array.isArray(existingFeeds) ? [...existingFeeds] : [];

  if (current.length >= FEED_PROBE_WHEN_BELOW) {
    return current;
  }

  const paths =
    Array.isArray(options.paths) && options.paths.length > 0
      ? options.paths
      : COMMON_FEED_PATHS;
  const lookup = options.lookup || dns.lookup;
  const cache = options.cache || new Map();
  for (const path of paths) {
    if (current.length >= FEED_PROBE_WHEN_BELOW) {
      break;
    }

    let href = "";

    try {
      href = new URL(path, origin).href;
      await assertPublicURL(href, { lookup, cache });
    } catch {
      continue;
    }

    const fetched = await fetchFeedCandidate(href, {
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });

    if (!fetched) {
      continue;
    }

    const type = sniffFeedType(fetched.contentType, fetched.body);

    if (!type) {
      continue;
    }

    current.push({
      url: href,
      type: normalizeText(type),
      title: "Probed feed",
    });
  }

  return current;
}
