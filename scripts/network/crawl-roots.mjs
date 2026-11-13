/**
 * Goal & Constraints: Curated crawl roots for participants whose Josh site
 * lives under a path (not the apex homepage). Clear JSON survives sync;
 * registry origins stay path-free. Temporary until JoshBot owns path scope.
 */

import { canonicalOrigin, normalizeText } from "./lib.mjs";

/**
 * @typedef {{ origin: string, path: string }} CrawlRoot
 */

/**
 * Normalizes a crawl path prefix to a leading-slash, trailing-slash form.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCrawlPath(value) {
  const raw = normalizeText(value);

  if (!raw || !raw.startsWith("/") || raw.includes("?") || raw.includes("#")) {
    return "";
  }

  if (raw === "/") {
    return "/";
  }

  return raw.endsWith("/") ? raw : `${raw}/`;
}

/**
 * Reads curated crawl roots from a clear JSON document.
 * @param {unknown} doc
 * @returns {CrawlRoot[]}
 */
export function crawlRootsFromDocument(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return [];
  }

  const roots = /** @type {{ roots?: unknown }} */ (doc).roots;

  if (!roots || typeof roots !== "object" || Array.isArray(roots)) {
    return [];
  }

  /** @type {CrawlRoot[]} */
  const parsed = [];

  for (const [originKey, row] of Object.entries(roots)) {
    let origin = "";

    try {
      origin = canonicalOrigin(normalizeText(originKey));
    } catch {
      continue;
    }

    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }

    const pathPrefix = normalizeCrawlPath(
      /** @type {{ path?: unknown }} */ (row).path,
    );

    if (!pathPrefix || pathPrefix === "/") {
      continue;
    }

    parsed.push({ origin, path: pathPrefix });
  }

  return parsed;
}

/**
 * Builds origin → path prefix map from crawl roots.
 * @param {CrawlRoot[]} roots
 * @returns {Map<string, string>}
 */
export function crawlRootPathByOrigin(roots) {
  /** @type {Map<string, string>} */
  const map = new Map();

  for (const root of roots) {
    map.set(root.origin, root.path);
  }

  return map;
}

/**
 * Absolute start URL for capture/crawl when a path root is configured.
 * @param {string} origin
 * @param {string} pathPrefix
 * @returns {string}
 */
export function crawlStartUrl(origin, pathPrefix) {
  const normalizedOrigin = normalizeText(origin);
  const path = normalizeCrawlPath(pathPrefix);

  if (!normalizedOrigin || !path || path === "/") {
    return normalizedOrigin;
  }

  return `${normalizedOrigin}${path}`;
}

/**
 * Resolves the crawl start URL for an origin from a path map.
 * @param {string} origin
 * @param {Map<string, string>} pathByOrigin
 * @returns {string}
 */
export function crawlStartUrlForOrigin(origin, pathByOrigin) {
  const normalizedOrigin = normalizeText(origin);
  const path = pathByOrigin.get(normalizedOrigin) || "";

  if (!path) {
    return normalizedOrigin;
  }

  return crawlStartUrl(normalizedOrigin, path);
}

/**
 * True when url is same-origin and under the configured path prefix.
 * Empty pathPrefix means the whole origin is in scope.
 * @param {string} origin
 * @param {string} url
 * @param {string} pathPrefix
 * @returns {boolean}
 */
export function urlMatchesCrawlRoot(origin, url, pathPrefix) {
  const normalizedOrigin = normalizeText(origin);
  const path = normalizeCrawlPath(pathPrefix);

  if (!normalizedOrigin) {
    return false;
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.origin !== normalizedOrigin) {
    return false;
  }

  if (!path || path === "/") {
    return true;
  }

  const pathname = parsed.pathname;
  const base = path.replace(/\/+$/, "");

  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Validates crawl roots (paths only; origins may precede registry membership).
 * @param {CrawlRoot[]} roots
 * @returns {void}
 * @throws {Error} When a root is malformed or duplicated.
 */
export function assertValidCrawlRoots(roots) {
  const seen = new Set();

  for (const root of roots) {
    if (seen.has(root.origin)) {
      throw new Error(`network_crawl_roots: duplicate origin ${root.origin}`);
    }

    seen.add(root.origin);

    const path = normalizeCrawlPath(root.path);

    if (!path || path === "/") {
      throw new Error(
        `network_crawl_roots: origin ${root.origin} needs a non-root path`,
      );
    }

    try {
      canonicalOrigin(root.origin);
    } catch {
      throw new Error(`network_crawl_roots: invalid origin ${root.origin}`);
    }
  }
}
