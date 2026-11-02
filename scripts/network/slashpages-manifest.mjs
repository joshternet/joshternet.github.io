/**
 * Goal & Constraints:
 * Optional `/.well-known/slashpages` OPML 2.0 reader for crawl seeds. Robots-
 * gated, SSRF-safe (`assertPublicURL`), size/timeout/redirect limits. Same-
 * origin outline URLs may seed the crawl; cross-origin outlines stay evidence
 * links only (never auto-promote participants, Showcase works, or edges).
 * No XXE / external DTD — regex attribute parse only. Includes are depth- and
 * count-bounded with loop detection.
 */

import { USER_AGENT } from "../nlp/lib.mjs";
import { createOriginRobotsGate } from "../nlp/origin-robots.mjs";
import { assertPublicURL, normalizeText } from "./lib.mjs";

export const SLASHPAGES_MANIFEST_PATH = "/.well-known/slashpages";
export const MAX_SLASHPAGES_OPML_BYTES = 256 * 1024;
export const MAX_SLASHPAGES_INCLUDES = 4;
export const MAX_SLASHPAGES_INCLUDE_DEPTH = 2;
export const MAX_SLASHPAGES_OUTLINES = 200;

/**
 * @typedef {{
 *   text: string,
 *   url: string,
 *   categories: string[],
 *   same_origin: boolean,
 * }} SlashpagesOutline
 */

/**
 * @typedef {{
 *   outlines: SlashpagesOutline[],
 *   cross_origin: SlashpagesOutline[],
 *   includes_fetched: string[],
 *   errors: string[],
 * }} SlashpagesManifest
 */

/**
 * Splits a comma-separated OPML category / categories attribute.
 * @param {string} raw
 * @returns {string[]}
 */
export function splitSlashpagesCategories(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  return raw
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

/**
 * Reads a named attribute from an OPML outline attribute blob.
 * @param {string} attributes
 * @param {string} name
 * @returns {string}
 */
function outlineAttribute(attributes, name) {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`,
    "i",
  ).exec(attributes);

  if (!match) {
    return "";
  }

  const raw = match[2] !== undefined ? match[2] : match[3];
  return normalizeText(raw || "");
}

/**
 * Resolves an http(s) outline URL against a base origin without DNS.
 * @param {string} rawUrl
 * @param {string} baseOrigin
 * @returns {{ href: string, sameOrigin: boolean } | null}
 */
function resolveOutlineUrl(rawUrl, baseOrigin) {
  try {
    const absolute = new URL(rawUrl, baseOrigin);

    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") {
      return null;
    }

    return {
      href: absolute.href,
      sameOrigin: absolute.origin === new URL(baseOrigin).origin,
    };
  } catch {
    return null;
  }
}

/**
 * Parses OPML 2.0 link outlines (no entity expansion / DTD).
 * @param {string} opmlText
 * @param {{ baseOrigin: string }} options
 * @returns {SlashpagesOutline[]}
 */
export function parseSlashpagesOpml(opmlText, options) {
  if (typeof opmlText !== "string" || !opmlText || !options?.baseOrigin) {
    return [];
  }

  // Reject DOCTYPE / ENTITY declarations that could imply XXE intent.
  if (/<!DOCTYPE/i.test(opmlText) || /<!ENTITY/i.test(opmlText)) {
    return [];
  }

  const outlines = [];
  const outlinePattern = /<outline\b([^>]*)\/?>/gi;
  let match;

  while ((match = outlinePattern.exec(opmlText))) {
    if (outlines.length >= MAX_SLASHPAGES_OUTLINES) {
      break;
    }

    const attributes = match[1];
    const type = outlineAttribute(attributes, "type");

    // Include outlines are fetched separately; do not treat them as page seeds.
    if (isSlashpagesIncludeOutline(type, outlineAttribute(attributes, "url"))) {
      continue;
    }

    const text =
      outlineAttribute(attributes, "text") ||
      outlineAttribute(attributes, "title");
    const url =
      outlineAttribute(attributes, "url") ||
      outlineAttribute(attributes, "htmlUrl") ||
      outlineAttribute(attributes, "xmlUrl");

    if (!url) {
      continue;
    }

    const resolved = resolveOutlineUrl(url, options.baseOrigin);

    if (!resolved) {
      continue;
    }

    const categories = splitSlashpagesCategories(
      outlineAttribute(attributes, "category") ||
        outlineAttribute(attributes, "categories"),
    );

    outlines.push({
      text,
      url: resolved.href,
      categories,
      same_origin: resolved.sameOrigin,
    });
  }

  return outlines;
}

/**
 * True when an outline should be treated as an OPML include.
 * @param {string} type
 * @param {string} url
 * @returns {boolean}
 */
export function isSlashpagesIncludeOutline(type, url) {
  const normalized = String(type || "").toLowerCase();

  if (normalized === "include") {
    return true;
  }

  return normalized === "" && /\.opml(?:$|[?#])/i.test(String(url || ""));
}

/**
 * Collects include URLs declared on outline elements.
 * @param {string} opmlText
 * @param {string} baseOrigin
 * @returns {string[]}
 */
export function slashpagesIncludeUrls(opmlText, baseOrigin) {
  if (typeof opmlText !== "string" || !opmlText) {
    return [];
  }

  const includes = [];
  const outlinePattern = /<outline\b([^>]*)\/?>/gi;
  let match;

  while ((match = outlinePattern.exec(opmlText))) {
    const attributes = match[1];
    const type = outlineAttribute(attributes, "type");
    const url =
      outlineAttribute(attributes, "url") ||
      outlineAttribute(attributes, "xmlUrl");

    if (!url || !isSlashpagesIncludeOutline(type, url)) {
      continue;
    }

    const resolved = resolveOutlineUrl(url, baseOrigin);

    if (resolved) {
      includes.push(resolved.href);
    }
  }

  return includes;
}

/**
 * Fetches OPML text with SSRF, size, redirect, and timeout limits.
 * @param {string} url
 * @param {{
 *   cache: Map<string, unknown>,
 *   fetchImpl?: typeof fetch,
 *   maxBytes: number,
 * }} options
 * @returns {Promise<string>}
 */
async function fetchSlashpagesOpmlText(url, options) {
  await assertPublicURL(url, { cache: options.cache });

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(url, {
    headers: {
      Accept: "text/x-opml, text/xml, application/xml, */*;q=0.1",
      "User-Agent": USER_AGENT,
    },
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`slashpages request failed with ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.byteLength > options.maxBytes) {
    throw new Error("slashpages OPML exceeds size limit");
  }

  return buffer.toString("utf8");
}

/**
 * Fetches and parses `/.well-known/slashpages` for an origin (optional).
 * @param {string} origin
 * @param {{
 *   cache?: Map<string, unknown>,
 *   robotsGate?: import("../nlp/origin-robots.mjs").OriginRobotsGate,
 *   maxBytes?: number,
 *   fetchImpl?: typeof fetch,
 * }} [options]
 * @returns {Promise<SlashpagesManifest>}
 */
export async function fetchSlashpagesManifest(origin, options = {}) {
  /** @type {SlashpagesManifest} */
  const result = {
    outlines: [],
    cross_origin: [],
    includes_fetched: [],
    errors: [],
  };

  let baseOrigin = "";

  try {
    baseOrigin = new URL(origin).origin;
  } catch {
    result.errors.push("invalid_origin");
    return result;
  }

  const cache = options.cache instanceof Map ? options.cache : new Map();
  const robotsGate =
    options.robotsGate ??
    createOriginRobotsGate({ cache, userAgent: USER_AGENT });
  const manifestUrl = new URL(SLASHPAGES_MANIFEST_PATH, `${baseOrigin}/`).href;

  if (!(await robotsGate.allows(manifestUrl))) {
    result.errors.push("robots_disallow");
    return result;
  }

  /** @type {SlashpagesOutline[]} */
  const allOutlines = [];
  const includeQueue = [{ url: manifestUrl, depth: 0 }];
  const includeSeen = new Set();

  while (includeQueue.length > 0) {
    const next = includeQueue.shift();

    if (includeSeen.has(next.url)) {
      continue;
    }

    if (result.includes_fetched.length >= MAX_SLASHPAGES_INCLUDES) {
      result.errors.push("include_count_cap");
      break;
    }

    includeSeen.add(next.url);

    let body = "";

    try {
      if (!(await robotsGate.allows(next.url))) {
        result.errors.push(`robots_disallow:${next.url}`);
        continue;
      }

      body = await fetchSlashpagesOpmlText(next.url, {
        cache,
        fetchImpl: options.fetchImpl,
        maxBytes: options.maxBytes || MAX_SLASHPAGES_OPML_BYTES,
      });
      result.includes_fetched.push(next.url);
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      continue;
    }

    allOutlines.push(...parseSlashpagesOpml(body, { baseOrigin }));

    if (next.depth < MAX_SLASHPAGES_INCLUDE_DEPTH) {
      for (const includeUrl of slashpagesIncludeUrls(body, baseOrigin)) {
        if (!includeSeen.has(includeUrl)) {
          includeQueue.push({ url: includeUrl, depth: next.depth + 1 });
        }
      }
    }
  }

  const sameOrigin = [];
  const crossOrigin = [];
  const seenUrl = new Set();

  for (const outline of allOutlines) {
    if (seenUrl.has(outline.url)) {
      continue;
    }

    seenUrl.add(outline.url);

    if (outline.same_origin) {
      sameOrigin.push(outline);
    } else {
      crossOrigin.push(outline);
    }
  }

  result.outlines = sameOrigin;
  result.cross_origin = crossOrigin;
  return result;
}

/**
 * Same-origin crawl seed URLs from a slashpages manifest result.
 * @param {SlashpagesManifest | null | undefined} manifest
 * @returns {string[]}
 */
export function collectSlashpagesCrawlSeeds(manifest) {
  if (!manifest || !Array.isArray(manifest.outlines)) {
    return [];
  }

  return manifest.outlines.map((outline) => outline.url).filter(Boolean);
}
