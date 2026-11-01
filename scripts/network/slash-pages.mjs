/**
 * Goal & Constraints:
 * Shared indieweb slash-page path lists for NLP crawl seeds and network
 * identity-page visits. Derived from slash-page-catalog.mjs. Keep
 * trailing-slash form; consumers normalize. Do not add runtime fetches here.
 */

import {
  creativeIndexSlashPaths,
  identityLikeSlashPaths,
  probeSlashPaths,
  writingIndexSlashPaths,
} from "./slash-page-catalog.mjs";

export {
  SLASH_PAGE_CATALOG,
  SLASH_PAGE_CATALOG_REVIEWED_AT,
  SLASH_PAGE_CATALOG_VERSION,
  isNonHighlightSlashPath,
  normalizeSlashPath,
  pathsForEntry,
  probeSlashPaths,
} from "./slash-page-catalog.mjs";

/** Indieweb / about / link-directory pages that often hold member-to-member links. */
export const IDENTITY_SLASH_PATHS = identityLikeSlashPaths();

/** Publisher writing indexes that often omit themselves from sitemap.xml. */
export const WRITING_INDEX_PATHS = writingIndexSlashPaths();

/** Creative portfolio / gallery / music / game indexes. */
export const CREATIVE_INDEX_PATHS = creativeIndexSlashPaths();

/** Every catalog path marked for blind probing (including aliases). */
export const PROBE_SLASH_PATHS = probeSlashPaths();

/**
 * Deduped content-index seeds: writing indexes plus identity slash pages.
 * @returns {string[]}
 */
export function contentIndexPaths() {
  return [
    ...new Set([
      ...WRITING_INDEX_PATHS,
      ...IDENTITY_SLASH_PATHS,
      ...CREATIVE_INDEX_PATHS,
    ]),
  ];
}

/**
 * Path roots that are site chrome / writing / topic taxonomies—never Showcase
 * creative works (hub or any child under the root).
 * @type {readonly string[]}
 */
export const SHOWCASE_CHROME_TREE_ROOTS = Object.freeze([
  "topics",
  "topic",
  "tags",
  "tag",
  "categories",
  "category",
  "notes",
  "reading",
  "posts",
  "blog",
  "writings",
  "webring",
  "webrings",
]);

/**
 * Extra single-segment nav labels not always present as identity slash paths.
 * @type {ReadonlySet<string>}
 */
const SHOWCASE_CHROME_EXTRA_SEGMENTS = new Set([
  "about",
  "me",
  "now",
  "uses",
  "links",
  "more",
  "buttons",
  "referrals",
  "dedication",
  "friends",
  "feeds",
  "hello",
  "cal",
  "say-hi",
  "sayhi",
  "why",
  "seeking",
  "wander",
  "ai",
  "rss",
  "feed",
  "atom",
  "newsletter",
  "subscribe",
  "sitemap",
  "contact",
  "privacy",
  "terms",
  "legal",
  "login",
  "search",
  "home",
  "archive",
  "archives",
  "cv",
  "resume",
  "hire",
  "colophon",
  "credits",
  "indieweb",
  "neighborhood",
  "recipes",
  "things",
  "hustles",
  "code",
  "unoffice-hours",
  "unofficehours",
]);

const IDENTITY_SLASH_SET = new Set(
  IDENTITY_SLASH_PATHS.map((path) => path.replace(/\/+$/, "").toLowerCase()),
);

const WRITING_INDEX_SET = new Set(
  WRITING_INDEX_PATHS.map((path) => path.replace(/\/+$/, "").toLowerCase()),
);

/**
 * True when a URL pathname is site chrome, a writing/topic tree, a feed, or an
 * identity slash page—not a Showcase creative work.
 * @param {unknown} pathnameOrUrl - Pathname (`/now/`) or absolute URL.
 * @returns {boolean}
 */
export function isShowcaseChromePath(pathnameOrUrl) {
  let pathname = String(pathnameOrUrl || "");

  try {
    if (/^https?:\/\//i.test(pathname)) {
      pathname = new URL(pathname).pathname;
    }
  } catch {
    return false;
  }

  const normalized = `/${pathname
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase()}`;

  if (normalized === "/") {
    return false;
  }

  if (/\.(xml|json|atom)$/i.test(normalized)) {
    return true;
  }

  const parts = normalized.split("/").filter(Boolean);

  // normalized === "/" already returned; parts is non-empty here.
  if (SHOWCASE_CHROME_TREE_ROOTS.includes(parts[0])) {
    return true;
  }

  if (parts.length === 1) {
    const segment = parts[0];
    const asPath = `/${segment}`;

    if (SHOWCASE_CHROME_EXTRA_SEGMENTS.has(segment)) {
      return true;
    }

    if (IDENTITY_SLASH_SET.has(asPath) || WRITING_INDEX_SET.has(asPath)) {
      return true;
    }
  }

  return false;
}
