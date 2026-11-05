/**
 * Goal & Constraints:
 * Conditional HTTP fetch cache for crawl/gather. Bodies live under
 * `.tmp/http-cache/` (gitignored); never committed. The first complete body
 * for a URL is kept as an original backup and is never overwritten or pruned.
 * Later crawls update the current body. Current entries older than
 * CONTENT_CACHE_DAYS lose their validators so the next crawl refetches.
 * Supports If-None-Match / If-Modified-Since and body sha reuse.
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { CONTENT_CACHE_DAYS } from "./content-retention.mjs";

const DEFAULT_ROOT = path.join(process.cwd(), ".tmp/http-cache");
const META_NAME = "meta.json";

/**
 * @typedef {{
 *   url: string,
 *   etag?: string,
 *   lastModified?: string,
 *   bodySha256: string,
 *   contentType?: string,
 *   cachedAt: string,
 *   bodyFile: string,
 *   bodyComplete?: boolean,
 *   originalBodyFile?: string,
 *   originalBodySha256?: string,
 *   originalCachedAt?: string,
 * }} FetchCacheEntry
 */

/**
 * @typedef {{
 *   root: string,
 *   entries: Map<string, FetchCacheEntry>,
 *   bypass: boolean,
 * }} FetchCache
 */

/**
 * Stable body filename for one URL.
 * @param {string} url
 * @param {boolean} [original]
 * @returns {string}
 */
function bodyFileForUrl(url, original = false) {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 32);
  return original ? `${hash}.original.body` : `${hash}.body`;
}

/**
 * Keeps a stored timestamp and drops anything else.
 * @param {unknown} value
 * @returns {string}
 */
function dated(value) {
  return typeof value === "string" && value ? value : "";
}

/**
 * SHA-256 hex of a UTF-8 body.
 * @param {string} body
 * @returns {string}
 */
export function bodySha256(body) {
  return createHash("sha256")
    .update(String(body == null ? "" : body), "utf8")
    .digest("hex");
}

/**
 * True when NETWORK_REFRESH_ALL (or explicit bypass) disables the fetch cache.
 * @param {{ bypass?: boolean }} [options]
 * @returns {boolean}
 */
export function fetchCacheBypassed(options = {}) {
  if (options.bypass === true) {
    return true;
  }

  const flag = String(process.env.NETWORK_REFRESH_ALL || "")
    .trim()
    .toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/**
 * Loads meta from disk into memory.
 * @param {string} [root]
 * @param {{ bypass?: boolean }} [options]
 * @returns {Promise<FetchCache>}
 */
export async function openFetchCache(root = DEFAULT_ROOT, options = {}) {
  const bypass = fetchCacheBypassed(options);
  /** @type {Map<string, FetchCacheEntry>} */
  const entries = new Map();

  if (!bypass) {
    try {
      const raw = await fs.readFile(path.join(root, META_NAME), "utf8");
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed?.entries) ? parsed.entries : [];

      for (const entry of list) {
        if (
          entry &&
          typeof entry.url === "string" &&
          entry.url &&
          typeof entry.bodySha256 === "string" &&
          typeof entry.bodyFile === "string"
        ) {
          entries.set(entry.url, entry);
        }
      }
    } catch (error) {
      if (
        !error ||
        /** @type {{ code?: string }} */ (error).code !== "ENOENT"
      ) {
        // Corrupt meta: start empty rather than abort the sync.
      }
    }
  }

  return { root, entries, bypass };
}

/**
 * Drops current entries whose cachedAt is older than cacheDays.
 * An entry with an original capture stays, and its validators are cleared
 * so the next crawl fetches an update. The original file is left on disk.
 * @param {FetchCache} cache
 * @param {Date | string} now
 * @param {number} [cacheDays]
 * @returns {number} Evicted count
 */
export function pruneFetchCache(cache, now, cacheDays = CONTENT_CACHE_DAYS) {
  if (!cache || cache.bypass) {
    return 0;
  }

  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now));
  const windowMs = cacheDays * 24 * 60 * 60 * 1000;
  let evicted = 0;

  for (const [url, entry] of cache.entries) {
    const cachedMs = Date.parse(String(entry.cachedAt || ""));
    const stale =
      !Number.isFinite(nowMs) ||
      !Number.isFinite(cachedMs) ||
      nowMs - cachedMs > windowMs;

    if (!stale) {
      continue;
    }

    if (typeof entry.originalBodyFile === "string" && entry.originalBodyFile) {
      delete entry.etag;
      delete entry.lastModified;
      continue;
    }

    cache.entries.delete(url);
    evicted += 1;
  }

  return evicted;
}

/**
 * Conditional request headers from a cache entry.
 * @param {FetchCacheEntry | null | undefined} entry
 * @returns {Record<string, string>}
 */
export function conditionalHeadersFromEntry(entry) {
  /** @type {Record<string, string>} */
  const headers = {};

  if (!entry) {
    return headers;
  }

  if (typeof entry.etag === "string" && entry.etag) {
    headers["If-None-Match"] = entry.etag;
  }

  if (typeof entry.lastModified === "string" && entry.lastModified) {
    headers["If-Modified-Since"] = entry.lastModified;
  }

  return headers;
}

/**
 * Reads a cached body when the entry exists on disk.
 * @param {FetchCache} cache
 * @param {string} url
 * @returns {Promise<{ body: string, entry: FetchCacheEntry, unchanged: true } | null>}
 */
export async function readFetchCacheBody(cache, url) {
  if (!cache || cache.bypass || typeof url !== "string" || !url) {
    return null;
  }

  const entry = cache.entries.get(url);

  if (!entry) {
    return null;
  }

  try {
    const body = await fs.readFile(
      path.join(cache.root, entry.bodyFile),
      "utf8",
    );
    return { body, entry, unchanged: true };
  } catch {
    cache.entries.delete(url);
    return null;
  }
}

/**
 * Reads the frozen original capture. A missing backup does not drop the
 * current entry.
 * @param {FetchCache} cache
 * @param {string} url
 * @returns {Promise<{ body: string, entry: FetchCacheEntry } | null>}
 */
export async function readOriginalFetchCacheBody(cache, url) {
  if (!cache || cache.bypass || typeof url !== "string" || !url) {
    return null;
  }

  const entry = cache.entries.get(url);

  if (
    !entry ||
    typeof entry.originalBodyFile !== "string" ||
    !entry.originalBodyFile
  ) {
    return null;
  }

  const body = await readIfPresent(
    path.join(cache.root, entry.originalBodyFile),
  );

  if (body == null) {
    return null;
  }

  return { body, entry };
}

/**
 * Reads a file when it exists.
 * @param {string} filePath
 * @returns {Promise<string | null>}
 */
async function readIfPresent(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Freezes the first complete body. Later writes must not replace it.
 * @param {FetchCache} cache
 * @param {FetchCacheEntry | undefined} prior
 * @param {string} url
 * @param {string} body
 * @param {string} cachedAt
 * @param {boolean} complete
 * @returns {Promise<{ bodyFile: string, bodySha256: string, cachedAt: string } | null>}
 */
async function freezeOriginal(cache, prior, url, body, cachedAt, complete) {
  if (
    prior &&
    typeof prior.originalBodyFile === "string" &&
    prior.originalBodyFile &&
    typeof prior.originalBodySha256 === "string" &&
    prior.originalBodySha256
  ) {
    return {
      bodyFile: prior.originalBodyFile,
      bodySha256: prior.originalBodySha256,
      cachedAt:
        dated(prior.originalCachedAt) || dated(prior.cachedAt) || cachedAt,
    };
  }

  if (!complete) {
    return null;
  }

  const originalFile = bodyFileForUrl(url, true);
  const originalPath = path.join(cache.root, originalFile);
  const onDisk = await readIfPresent(originalPath);

  if (onDisk != null) {
    return {
      bodyFile: originalFile,
      bodySha256: bodySha256(onDisk),
      cachedAt:
        dated(prior?.originalCachedAt) || dated(prior?.cachedAt) || cachedAt,
    };
  }

  let frozen = body;
  let frozenAt = cachedAt;

  if (prior && typeof prior.bodyFile === "string" && prior.bodyFile) {
    const previousBody = await readIfPresent(
      path.join(cache.root, prior.bodyFile),
    );

    if (previousBody != null) {
      frozen = previousBody;
      frozenAt = dated(prior.cachedAt) || cachedAt;
    }
  }

  await fs.writeFile(originalPath, frozen, "utf8");

  return {
    bodyFile: originalFile,
    bodySha256: bodySha256(frozen),
    cachedAt: frozenAt,
  };
}

/**
 * Stores a successful fetch in the cache.
 * A complete body freezes the original capture the first time. Updates replace
 * only the current body.
 * @param {FetchCache} cache
 * @param {{
 *   url: string,
 *   body: string,
 *   contentType?: string,
 *   etag?: string | null,
 *   lastModified?: string | null,
 *   cachedAt?: string,
 *   bodyComplete?: boolean,
 * }} input
 * @returns {Promise<FetchCacheEntry | null>}
 */
export async function writeFetchCacheEntry(cache, input) {
  if (!cache || cache.bypass) {
    return null;
  }

  if (!input || typeof input.url !== "string" || !input.url) {
    return null;
  }

  const body = String(input.body == null ? "" : input.body);
  const sha = bodySha256(body);
  const cachedAt =
    typeof input.cachedAt === "string" && input.cachedAt
      ? input.cachedAt
      : new Date().toISOString();
  const prior = cache.entries.get(input.url);
  await fs.mkdir(cache.root, { recursive: true });
  const original = await freezeOriginal(
    cache,
    prior,
    input.url,
    body,
    cachedAt,
    input.bodyComplete === true,
  );
  const bodyFile =
    original && original.bodySha256 === sha
      ? original.bodyFile
      : bodyFileForUrl(input.url);

  if (!original || original.bodySha256 !== sha) {
    await fs.writeFile(path.join(cache.root, bodyFile), body, "utf8");
  }

  /** @type {FetchCacheEntry} */
  const entry = {
    url: input.url,
    bodySha256: sha,
    bodyFile,
    cachedAt,
  };

  if (original) {
    entry.originalBodyFile = original.bodyFile;
    entry.originalBodySha256 = original.bodySha256;
    entry.originalCachedAt = original.cachedAt;
  }

  if (typeof input.contentType === "string" && input.contentType) {
    entry.contentType = input.contentType;
  }

  if (typeof input.etag === "string" && input.etag) {
    entry.etag = input.etag;
  }

  if (typeof input.lastModified === "string" && input.lastModified) {
    entry.lastModified = input.lastModified;
  }

  if (input.bodyComplete === true) {
    entry.bodyComplete = true;
  }

  cache.entries.set(input.url, entry);
  return entry;
}

/**
 * Persists meta.json for the next sync / Actions cache restore.
 * @param {FetchCache} cache
 * @returns {Promise<void>}
 */
export async function saveFetchCache(cache) {
  if (!cache || cache.bypass) {
    return;
  }

  await fs.mkdir(cache.root, { recursive: true });
  const entries = [...cache.entries.values()].sort((left, right) =>
    left.url.localeCompare(right.url),
  );
  const payload = `${JSON.stringify({ schema_version: 1, entries }, null, 2)}\n`;
  const temporary = path.join(cache.root, `${META_NAME}.${process.pid}.tmp`);
  await fs.writeFile(temporary, payload, "utf8");
  await fs.rename(temporary, path.join(cache.root, META_NAME));
}
