/**
 * Goal & Constraints:
 * When a homepage advertises no feed alternates, probe common indie feed paths
 * so non-Josh / artlung-shaped sites still seed NLP. Generic paths only—no
 * host allowlists. Inject fetchImpl in tests (no live network).
 */

import dns from "node:dns/promises";

import { USER_AGENT } from "../nlp/lib.mjs";
import { createOriginRobotsGate } from "../nlp/origin-robots.mjs";
import { assertPublicURL, normalizeText } from "./lib.mjs";
import {
  MAX_PUBLIC_FETCH_REDIRECTS,
  readCappedResponseBytes,
} from "./public-fetch-guard.mjs";

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
 * Fetches one URL with a byte cap and manual public redirect checks.
 * @param {string} href
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   cache?: Map<string, unknown>,
 *   lookup?: unknown,
 *   maxRedirects?: number,
 * }} [options]
 * @returns {Promise<{ contentType: string, body: string } | null>}
 */
async function fetchFeedCandidate(href, options = {}) {
  const fetchImpl =
    typeof options.fetchImpl === "function" ? options.fetchImpl : fetch;
  const timeoutMs =
    typeof options.timeoutMs === "number" && options.timeoutMs >= 0
      ? options.timeoutMs
      : FEED_PROBE_TIMEOUT_MS;
  const maxRedirects =
    typeof options.maxRedirects === "number" && options.maxRedirects >= 0
      ? options.maxRedirects
      : MAX_PUBLIC_FETCH_REDIRECTS;
  const dnsOptions = {
    cache: options.cache,
    lookup: options.lookup,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    let current = href;
    let hops = 0;

    while (true) {
      const response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept:
            "application/rss+xml, application/atom+xml, application/feed+json, application/xml, text/xml, */*;q=0.8",
          "User-Agent": USER_AGENT,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location =
          typeof response.headers?.get === "function"
            ? response.headers.get("location")
            : null;

        if (!location) {
          clearTimeout(timer);
          return null;
        }

        hops += 1;

        if (hops > maxRedirects) {
          clearTimeout(timer);
          return null;
        }

        current = new URL(location, current).href;
        await assertPublicURL(current, dnsOptions);
        continue;
      }

      if (!response.ok) {
        clearTimeout(timer);
        return null;
      }

      const contentType =
        (typeof response.headers?.get === "function"
          ? response.headers.get("content-type")
          : "") || "";
      const buffer = await readCappedResponseBytes(
        response,
        FEED_PROBE_MAX_BYTES,
        { overflow: "truncate" },
      );
      clearTimeout(timer);
      return { contentType, body: buffer.toString("utf8") };
    }
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
 *   maxRedirects?: number,
 *   robotsGate?: import("../nlp/origin-robots.mjs").OriginRobotsGate,
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
  const robotsGate =
    options.robotsGate ||
    createOriginRobotsGate({
      cache,
      userAgent: USER_AGENT,
    });
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

    if (!(await robotsGate.allows(href))) {
      continue;
    }

    const fetched = await fetchFeedCandidate(href, {
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      maxRedirects: options.maxRedirects,
      cache,
      lookup,
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
