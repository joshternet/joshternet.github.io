/**
 * Goal & Constraints: Curated crawl roots for participants whose Josh site
 * lives under a path (not the apex homepage). Clear JSON survives sync;
 * registry origins stay path-free. Capture, feed probes, identity pages, and
 * NLP crawl all resolve under the configured path. Temporary until JoshBot
 * owns path-scoped membership.
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
 * Origin spellings to try when looking up a crawl root (apex ↔ www).
 * @param {string} origin
 * @returns {string[]}
 */
export function originLookupKeys(origin) {
  const normalized = normalizeText(origin);

  if (!normalized) {
    return [];
  }

  /** @type {string[]} */
  const keys = [normalized];

  try {
    const url = new URL(normalized);
    const host = url.hostname;

    if (host) {
      url.hostname = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
      const alternate = url.origin;

      if (alternate !== normalized) {
        keys.push(alternate);
      }
    }
  } catch {
    // Non-URL origins keep the single normalized key.
  }

  return keys;
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
 * Looks up a crawl path for an origin, including www ↔ apex aliases.
 * @param {string} origin
 * @param {Map<string, string>} pathByOrigin
 * @returns {string}
 */
export function lookupCrawlRootPath(origin, pathByOrigin) {
  for (const key of originLookupKeys(origin)) {
    const pathPrefix = pathByOrigin.get(key);

    if (pathPrefix) {
      return pathPrefix;
    }
  }

  return "";
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
  const path = lookupCrawlRootPath(normalizedOrigin, pathByOrigin);

  if (!path) {
    return normalizedOrigin;
  }

  return crawlStartUrl(normalizedOrigin, path);
}

/**
 * Resolves a path or href under a crawl start URL.
 * Root-absolute paths (`/about/`) stay under the crawl root, not the apex.
 * @param {string} baseUrl - Origin or crawl start URL.
 * @param {string} href
 * @returns {string}
 */
export function resolveUnderCrawlRoot(baseUrl, href) {
  const base = normalizeText(baseUrl);
  const ref = normalizeText(href);

  if (!base || !ref) {
    return "";
  }

  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref)) {
      return new URL(ref).href;
    }

    const baseUrlObj = new URL(base.endsWith("/") ? base : `${base}/`);

    if (ref.startsWith("/")) {
      const rootPath = baseUrlObj.pathname.replace(/\/+$/, "");
      const suffix = ref.replace(/^\/+/, "");
      baseUrlObj.pathname = rootPath ? `${rootPath}/${suffix}` : `/${suffix}`;
      baseUrlObj.search = "";
      baseUrlObj.hash = "";
      return baseUrlObj.href;
    }

    return new URL(ref, baseUrlObj).href;
  } catch {
    return "";
  }
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
  const pathBase = path.replace(/\/+$/, "");

  return pathname === pathBase || pathname.startsWith(`${pathBase}/`);
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
