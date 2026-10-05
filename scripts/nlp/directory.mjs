/**
 * Goal: Parse joshing.you listing HTML for member site origins (never the
 * directory host itself) and advertised feeds. Used by local probe CLIs.
 */

import { originFromHttpUrl } from "../network/blogroll.mjs";
import { parseHtmlDocument } from "./lib.mjs";

export const DIRECTORY_ORIGIN = "https://joshing.you";
export const MAX_DIRECTORY_PAGES = 24;
export const MAX_FEEDS_PER_ORIGIN = 2;
export const FEED_ACCEPT =
  "application/feed+json, application/json, application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.1";

/**
 * True when hostname is the Josh directory, not a listed member site.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isJoshDirectoryHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "joshing.you" || host === "www.joshing.you";
}

/**
 * URLs to try for one listing page number. Page 1 is the index; later pages
 * try query and path forms.
 * @param {number} page
 * @returns {string[]}
 */
export function directoryPageUrls(page) {
  const n = Number(page);

  if (!Number.isFinite(n) || n < 1) {
    return [`${DIRECTORY_ORIGIN}/`];
  }

  if (n === 1) {
    return [`${DIRECTORY_ORIGIN}/`];
  }

  return [`${DIRECTORY_ORIGIN}/?page=${n}`, `${DIRECTORY_ORIGIN}/page/${n}`];
}

/**
 * @param {string[]} argv
 * @param {string} flag
 * @param {string} fallback
 * @returns {string}
 */
export function flagValue(argv, flag, fallback) {
  const index = argv.indexOf(flag);

  if (index < 0 || !argv[index + 1]) {
    return fallback;
  }

  return argv[index + 1];
}

/**
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @template T
 * @param {T[]} list
 * @param {() => number} random
 * @returns {T[]}
 */
export function shuffle(list, random) {
  const copy = [...(list || [])];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swap];
    copy[swap] = temp;
  }

  return copy;
}

/**
 * Member origins linked from a directory listing page.
 * @param {string} html
 * @param {string} base
 * @returns {string[]}
 */
export function originsFromDirectoryHtml(html, base) {
  const origins = [];
  const seen = new Set();
  const pageBase = typeof base === "string" && base ? base : DIRECTORY_ORIGIN;

  for (const link of parseHtmlDocument(html).links) {
    try {
      const parsed = new URL(link.href, pageBase);

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }

      if (isJoshDirectoryHost(parsed.hostname)) {
        continue;
      }

      const origin = originFromHttpUrl(parsed.href);

      if (!seen.has(origin)) {
        seen.add(origin);
        origins.push(origin);
      }
    } catch {
      continue;
    }
  }

  return origins;
}

/**
 * Appends newly found member origins. Returns how many were new.
 * @param {string[]} existing
 * @param {string} html
 * @param {string} base
 * @returns {{ origins: string[], added: number }}
 */
export function accumulateListedOrigins(existing, html, base) {
  const origins = Array.isArray(existing) ? [...existing] : [];
  const seen = new Set(origins);
  let added = 0;

  for (const origin of originsFromDirectoryHtml(html, base)) {
    if (!seen.has(origin)) {
      seen.add(origin);
      origins.push(origin);
      added += 1;
    }
  }

  return { origins, added };
}

/**
 * Feed URLs advertised on a member homepage.
 * @param {string} html
 * @param {string} origin
 * @returns {Array<{ url: string, type: string }>}
 */
export function advertisedFeeds(html, origin) {
  const feeds = [];
  const seen = new Set();
  const pageOrigin =
    typeof origin === "string" && origin ? origin : DIRECTORY_ORIGIN;

  for (const link of parseHtmlDocument(html).links) {
    const rel = link.rel.join(" ").toLowerCase();
    const href = String(link.href);

    if (
      !/\balternate\b/.test(rel) &&
      !/\.(rss|atom|xml|json)(?:$|[?#])/i.test(href) &&
      !/\/feed\b/i.test(href)
    ) {
      continue;
    }

    try {
      const url = new URL(href, pageOrigin).href;

      if (seen.has(url)) {
        continue;
      }

      seen.add(url);
      const blob = `${rel} ${href}`;
      const type = /json/i.test(blob)
        ? "json"
        : /atom/i.test(blob)
          ? "atom"
          : "rss";
      feeds.push({ url, type });
    } catch {
      continue;
    }
  }

  return feeds.slice(0, MAX_FEEDS_PER_ORIGIN);
}
