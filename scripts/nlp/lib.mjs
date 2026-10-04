/**
 * Goal & Constraints:
 * Shared helpers for full-site NLP crawl and topic sync. SSRF-safe fetches,
 * caps, and deterministic slugify. Works for any future registry origin.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { assertPublicURL, normalizeText } from "../network/lib.mjs";
import { slugifyTopic } from "../network/connections.mjs";
import { parseHtmlRegions } from "./text.mjs";

export const MAX_PAGES_PER_ORIGIN = 80;
export const MAX_BYTES_PER_RESPONSE = 1_500_000;
export const MAX_CRAWL_DEPTH = 4;
export const MAX_TOPICS_PER_ORIGIN = 24;
export const FETCH_TIMEOUT_MS = 12_000;
export const USER_AGENT =
  "JoshternetNLP/1.0 (+https://joshternet.org; topic-hub build crawl)";

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
 * @param {string} filePath
 * @param {unknown} value
 * @returns {Promise<void>}
 */
export async function writeJSONAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, filePath);
}

/**
 * @param {string} filePath
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function writeTextAtomic(filePath, text) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, text, "utf8");
  await fs.rename(temporary, filePath);
}

/**
 * Fetches a public URL with timeout and byte cap. Oversized bodies are
 * truncated so a huge feed or homepage does not abort the crawl.
 * @param {string} href
 * @param {{
 *   cache?: Map<string, unknown>,
 *   accept?: string,
 *   maxBytes?: number,
 *   overflow?: "truncate" | "throw",
 * }} [options]
 * @returns {Promise<{url: string, contentType: string, body: string}>}
 */
export async function fetchPublicText(href, options = {}) {
  const url = await assertPublicURL(href, { cache: options.cache });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const maxBytes =
    typeof options.maxBytes === "number" && options.maxBytes > 0
      ? options.maxBytes
      : MAX_BYTES_PER_RESPONSE;
  const overflow = options.overflow === "throw" ? "throw" : "truncate";

  try {
    const response = await fetch(url.href, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: options.accept || "text/html,application/xhtml+xml,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");

      if (!location) {
        throw new Error(`redirect without location from ${url.href}`);
      }

      const next = new URL(location, url.href).href;
      await assertPublicURL(next, { cache: options.cache });
      return fetchPublicText(next, options);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url.href}`);
    }

    const contentType = response.headers.get("content-type") || "";
    let buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength > maxBytes) {
      if (overflow === "throw") {
        throw new Error(`response too large for ${url.href}`);
      }

      buffer = buffer.subarray(0, maxBytes);
    }

    return {
      url: url.href,
      contentType,
      body: buffer.toString("utf8"),
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
