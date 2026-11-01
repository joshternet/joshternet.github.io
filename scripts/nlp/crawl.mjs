/**
 * Goal & Constraints:
 * Uncapped same-origin BFS crawl for NLP topic extraction. Seeds from homepage,
 * blind catalog slash probes (even when absent from menus), topic hubs, writing
 * and creative indexes, sitemap locs, and feed entry URLs. Soft-404 duplicates
 * of the homepage are not retained. Skips /.well-known/josh. No per-origin page
 * count stop. Failures for one origin never abort the run.
 */

import { originFromHttpUrl } from "../network/blogroll.mjs";
import {
  HUB_ORIGIN,
  hasDerivedAnalysisMarker,
  isHubDirectoryPage,
  isParticipationDeclarationPath,
} from "../network/connections.mjs";
import {
  IDENTITY_SLASH_PATHS,
  PROBE_SLASH_PATHS,
  contentIndexPaths,
} from "../network/slash-pages.mjs";
import { isNonSubjectSlug } from "./evidence.mjs";
import { MAX_CRAWL_DEPTH, fetchPublicText, parseHtmlDocument } from "./lib.mjs";
import { classifyPageRole } from "./page-role.mjs";
import {
  canonicalHrefFromHtml,
  htmlBodyFingerprint,
  normalizeExtractedText,
  schemaTypesFromHtml,
} from "./text.mjs";

export { IDENTITY_SLASH_PATHS };

/** Publisher topic directories that often omit themselves from sitemap.xml. */
export const TOPIC_HUB_INDEX_PATHS = [
  "/topics/",
  "/topic/",
  "/tags/",
  "/tag/",
  "/categories/",
  "/category/",
];

/** Same-origin topic pages followed from a hub listing (uncapped). */
export const MAX_TOPIC_HUB_CHILDREN = Number.POSITIVE_INFINITY;

/** Writing indexes plus indieweb identity slash pages (sitemap-independent). */
export const CONTENT_INDEX_PATHS = contentIndexPaths();

/** Same-origin article pages followed from a writing index (uncapped). */
export const MAX_CONTENT_INDEX_CHILDREN = Number.POSITIVE_INFINITY;

const STATIC_PATH =
  /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|xml|json|txt|zip|woff2?)$/i;

/**
 * Per-photo HTML pages (joshbeard-style galleries) starve the crawl budget.
 * Keep album indexes; skip individual image attachment pages.
 * @param {string} url
 * @returns {boolean}
 */
export function isPhotoAttachmentUrl(url) {
  try {
    const path = new URL(url).pathname;
    return /\/photos\/(?:all\/)?(?:\d{4}\/)?[^/]*img_[^/]+\.html?$/i.test(path);
  } catch {
    return false;
  }
}

/**
 * @typedef {{
 *   url: string,
 *   title: string,
 *   text: string,
 *   links: Array<{href: string, text: string}>,
 * }} CrawledPage
 */

/**
 * @param {string} origin
 * @param {string} href
 * @returns {string}
 */
function resolveSameOrigin(origin, href) {
  try {
    const absolute = new URL(href, origin).href;

    if (isParticipationDeclarationPath(absolute)) {
      return "";
    }

    if (originFromHttpUrl(absolute) !== origin) {
      return "";
    }

    const url = new URL(absolute);
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

/**
 * Topic-directory prefix for a pathname, or empty when the path is not a hub.
 * @param {string} pathname
 * @returns {string}
 */
export function topicHubPrefix(pathname) {
  const normalized =
    String(pathname || "")
      .replace(/\/+$/, "")
      .toLowerCase() || "/";

  for (const path of TOPIC_HUB_INDEX_PATHS) {
    const prefix = path.replace(/\/+$/, "");

    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return prefix;
    }
  }

  return "";
}

/**
 * True when the URL is a topic/tag/category index, not a child topic page.
 * @param {string} href
 * @returns {boolean}
 */
export function isTopicHubIndexUrl(href) {
  try {
    const path = new URL(href).pathname.replace(/\/+$/, "") || "/";
    const prefix = topicHubPrefix(path);

    return Boolean(prefix) && path.toLowerCase() === prefix;
  } catch {
    return false;
  }
}

/**
 * One-segment topic slug under a hub prefix, or empty.
 * @param {string} pathname
 * @returns {string}
 */
export function topicSlugFromHubChild(pathname) {
  const prefix = topicHubPrefix(pathname);

  if (!prefix) {
    return "";
  }

  const rest = String(pathname)
    .replace(/\/+$/, "")
    .toLowerCase()
    .slice(prefix.length)
    .replace(/^\//, "");

  if (!rest || rest.includes("/")) {
    return "";
  }

  return rest;
}

/**
 * Well-known topic hub URLs for an origin, independent of sitemap.xml.
 * @param {string} origin
 * @returns {string[]}
 */
export function topicHubSeedUrls(origin) {
  const urls = [];
  const seen = new Set();

  for (const path of TOPIC_HUB_INDEX_PATHS) {
    const href = resolveSameOrigin(origin, path);

    if (!href || seen.has(href)) {
      continue;
    }

    seen.add(href);
    urls.push(href);
  }

  return urls;
}

/**
 * Child topic pages linked from a hub listing.
 * @param {string} origin
 * @param {string} hubUrl
 * @param {Array<{href?: string} | string>} links
 * @param {number} [limit]
 * @returns {string[]}
 */
export function topicHubChildUrls(
  origin,
  hubUrl,
  links,
  limit = MAX_TOPIC_HUB_CHILDREN,
) {
  if (!isTopicHubIndexUrl(hubUrl)) {
    return [];
  }

  const children = [];
  const seen = new Set();

  for (const link of links || []) {
    const href = typeof link === "string" ? link : link?.href;
    const resolved = resolveSameOrigin(origin, href || "");

    if (!resolved || seen.has(resolved)) {
      continue;
    }

    // resolveSameOrigin already validated the URL; new URL() cannot throw here.
    const path = new URL(resolved).pathname;

    const slug = topicSlugFromHubChild(path);

    if (!slug || isNonSubjectSlug(slug)) {
      continue;
    }

    seen.add(resolved);
    children.push(resolved);

    if (children.length >= limit) {
      break;
    }
  }

  return children;
}

/**
 * True when the URL is a common writing/about index.
 * @param {string} href
 * @returns {boolean}
 */
export function isContentIndexUrl(href) {
  try {
    const path = new URL(href).pathname.replace(/\/+$/, "") || "/";

    return CONTENT_INDEX_PATHS.some((entry) => {
      const prefix = entry.replace(/\/+$/, "");
      return path.toLowerCase() === prefix;
    });
  } catch {
    return false;
  }
}

/**
 * Well-known writing-index URLs for an origin, independent of sitemap.xml.
 * @param {string} origin
 * @returns {string[]}
 */
export function contentIndexSeedUrls(origin) {
  const urls = [];
  const seen = new Set();

  for (const path of CONTENT_INDEX_PATHS) {
    const href = resolveSameOrigin(origin, path);

    if (!href || seen.has(href)) {
      continue;
    }

    seen.add(href);
    urls.push(href);
  }

  return urls;
}

/**
 * Indieweb identity / link-directory slash pages for an origin.
 * @param {string} origin
 * @returns {string[]}
 */
export function identitySlashSeedUrls(origin) {
  return slashSeedUrls(origin, IDENTITY_SLASH_PATHS);
}

/**
 * Blind-probe catalog paths (including aliases) for an origin.
 * @param {string} origin
 * @returns {string[]}
 */
export function probeSlashSeedUrls(origin) {
  return slashSeedUrls(origin, PROBE_SLASH_PATHS);
}

/**
 * @param {string} origin
 * @param {string[]} paths
 * @returns {string[]}
 */
function slashSeedUrls(origin, paths) {
  const urls = [];

  for (const path of paths) {
    const href = resolveSameOrigin(origin, path);

    if (!href) {
      continue;
    }

    urls.push(href);
  }

  return urls;
}

/**
 * True when a path is an indieweb identity / slash seed (soft-404 prone).
 * @param {string} pathname
 * @returns {boolean}
 */
export function isIdentitySlashPath(pathname) {
  const normalized = `/${String(pathname || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase()}`;

  if (normalized === "/") {
    return false;
  }

  // Soft-404 detection covers every blind-probe catalog path (identity +
  // creative indexes), not only the narrower identity-like list.
  const candidates = [...IDENTITY_SLASH_PATHS, ...PROBE_SLASH_PATHS];

  return candidates.some((path) => {
    const candidate = path.replace(/\/+$/, "").toLowerCase();
    return Boolean(candidate) && normalized === candidate;
  });
}

/**
 * True when a fetched URL is a soft-404 that repeats the homepage.
 * Title match alone is not enough: canonical must point at home, or the path
 * must be an identity slash page whose body fingerprint matches home.
 * @param {{
 *   pageUrl: string,
 *   homeUrl: string,
 *   title?: string,
 *   homeTitle?: string,
 *   canonical?: string,
 *   homeCanonical?: string,
 *   bodyFingerprint?: string,
 *   homeBodyFingerprint?: string,
 * }} input
 * @returns {boolean}
 */
export function isSoft404Duplicate(input) {
  const pageUrl = String(input.pageUrl || "");
  const homeUrl = String(input.homeUrl || "");

  if (!pageUrl || !homeUrl) {
    return false;
  }

  let pagePath = "";
  let homePath = "/";

  try {
    pagePath = new URL(pageUrl).pathname.replace(/\/+$/, "") || "/";
    homePath = new URL(homeUrl).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return false;
  }

  if (pagePath === homePath) {
    return false;
  }

  const title = normalizeExtractedText(input.title || "");
  const homeTitle = normalizeExtractedText(input.homeTitle || "");

  if (!title || !homeTitle || title !== homeTitle) {
    return false;
  }

  const canonical = String(input.canonical || "");
  const homeCanonical = String(input.homeCanonical || homeUrl);
  const bodyFingerprint = String(input.bodyFingerprint || "");
  const homeBodyFingerprint = String(input.homeBodyFingerprint || "");

  if (canonical && homeCanonical) {
    try {
      const canonicalPath =
        new URL(canonical).pathname.replace(/\/+$/, "") || "/";
      const homeCanonicalPath =
        new URL(homeCanonical).pathname.replace(/\/+$/, "") || "/";

      if (canonicalPath === homeCanonicalPath) {
        return true;
      }

      // Distinct self-canonical with a matching title is still a real page.
      return false;
    } catch {
      // Fall through to identity+fingerprint.
    }
  }

  const fingerprintMatch = Boolean(
    bodyFingerprint &&
    homeBodyFingerprint &&
    bodyFingerprint === homeBodyFingerprint,
  );

  return fingerprintMatch && isIdentitySlashPath(pagePath);
}

/**
 * Cross-origin http(s) links from one page, with absolute hrefs.
 * Drops same-origin nav, participation declarations, and non-http URLs.
 * @param {string} origin
 * @param {string} pageUrl
 * @param {Array<{href?: string, text?: string, rel?: string[], classNames?: string[]} | string>} links
 * @returns {Array<{href: string, text: string, rel: string[], classNames: string[], page: string}>}
 */
export function externalOutboundLinks(origin, pageUrl, links) {
  /** @type {Array<{href: string, text: string, rel: string[], classNames: string[], page: string}>} */
  const outbound = [];

  if (typeof origin !== "string" || !origin || typeof pageUrl !== "string") {
    return outbound;
  }

  let pageCanonical = "";

  try {
    pageCanonical = new URL(pageUrl).href;
  } catch {
    return outbound;
  }

  for (const link of links || []) {
    const raw = typeof link === "string" ? link : link?.href;

    if (typeof raw !== "string" || !raw) {
      continue;
    }

    let absolute = "";

    try {
      absolute = new URL(raw, pageCanonical).href;
    } catch {
      continue;
    }

    if (isParticipationDeclarationPath(absolute)) {
      continue;
    }

    let linkOrigin = "";

    try {
      linkOrigin = originFromHttpUrl(absolute);
    } catch {
      continue;
    }

    if (!linkOrigin || linkOrigin === origin) {
      continue;
    }

    outbound.push({
      href: absolute,
      text:
        typeof link === "object" && typeof link?.text === "string"
          ? link.text
          : "",
      rel: typeof link === "object" && Array.isArray(link?.rel) ? link.rel : [],
      classNames:
        typeof link === "object" && Array.isArray(link?.classNames)
          ? link.classNames
          : [],
      page: pageCanonical,
    });
  }

  return outbound;
}

/**
 * Same-origin pages linked from a writing index.
 * @param {string} origin
 * @param {string} indexUrl
 * @param {Array<{href?: string} | string>} links
 * @param {number} [limit]
 * @returns {string[]}
 */
export function contentIndexChildUrls(
  origin,
  indexUrl,
  links,
  limit = MAX_CONTENT_INDEX_CHILDREN,
) {
  if (!isContentIndexUrl(indexUrl)) {
    return [];
  }

  const children = [];
  const seen = new Set();
  // isContentIndexUrl already validated indexUrl; new URL() cannot throw here.
  const indexPath = new URL(indexUrl).pathname.replace(/\/+$/, "");

  for (const link of links || []) {
    const href = typeof link === "string" ? link : link?.href;
    const resolved = resolveSameOrigin(origin, href || "");

    if (!resolved || seen.has(resolved)) {
      continue;
    }

    // resolveSameOrigin already validated the URL; new URL() cannot throw here.
    const pathname = new URL(resolved).pathname;

    const normalized = pathname.replace(/\/+$/, "") || "/";

    if (normalized === indexPath || STATIC_PATH.test(pathname)) {
      continue;
    }

    seen.add(resolved);
    children.push(resolved);

    if (children.length >= limit) {
      break;
    }
  }

  return children;
}

/**
 * Parses loc entries from a sitemap XML body.
 * @param {string} xml
 * @param {string} origin
 * @param {number} limit
 * @returns {string[]}
 */
export function urlsFromSitemap(xml, origin, limit = Number.POSITIVE_INFINITY) {
  const urls = [];
  const seen = new Set();
  const pattern = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let match;

  while ((match = pattern.exec(xml)) && urls.length < limit) {
    const href = resolveSameOrigin(origin, match[1].trim());

    if (!href || seen.has(href)) {
      continue;
    }

    seen.add(href);
    urls.push(href);
  }

  return urls;
}

/**
 * Crawls one participant origin.
 * @param {string} origin
 * @param {{
 *   feedEntryUrls?: string[],
 *   aboutUrl?: string,
 *   aboutUrls?: string[],
 *   cache?: Map<string, unknown>,
 * }} [options]
 * @returns {Promise<{origin: string, pages: CrawledPage[], outbound_links: Array<{href: string, text: string, page: string}>, html_subjects: Array<Record<string, unknown>>, selection_reasons: Record<string, string>}>}
 */
export async function crawlOrigin(origin, options = {}) {
  const cache = options.cache || new Map();
  /** @type {Array<{url: string, depth: number}>} */
  const queue = [];
  const seedSeen = new Set();
  const seen = new Set();
  /** @type {CrawledPage[]} */
  const pages = [];
  /** @type {Array<{href: string, text: string, page: string}>} */
  const outbound = [];
  /** @type {Record<string, string>} */
  const selectionReasons = {};

  /**
   * Enqueues a depth-0 seed once with a selection reason.
   * @param {string} url
   * @param {string} reason
   */
  function enqueueSeed(url, reason = "seed") {
    if (!url || seedSeen.has(url)) {
      return;
    }

    seedSeen.add(url);
    selectionReasons[url] = reason;
    queue.push({ url, depth: 0 });
  }

  const homeUrl = `${origin}/`;
  enqueueSeed(homeUrl, "home");

  if (typeof options.aboutUrl === "string" && options.aboutUrl) {
    enqueueSeed(resolveSameOrigin(origin, options.aboutUrl), "about");
  }

  for (const aboutHref of options.aboutUrls || []) {
    if (typeof aboutHref === "string" && aboutHref) {
      enqueueSeed(resolveSameOrigin(origin, aboutHref), "about");
    }
  }

  // Recent feed posts before slash soft-404s / hubs / sitemap.
  for (const feedUrl of options.feedEntryUrls || []) {
    enqueueSeed(resolveSameOrigin(origin, feedUrl), "feed");
  }

  for (const url of probeSlashSeedUrls(origin)) {
    enqueueSeed(url, "blind-probe");
  }

  for (const url of topicHubSeedUrls(origin)) {
    enqueueSeed(url, "topic-hub");
  }

  for (const url of contentIndexSeedUrls(origin)) {
    enqueueSeed(url, "content-index");
  }

  try {
    const sitemap = await fetchPublicText(`${origin}/sitemap.xml`, {
      cache,
      accept: "application/xml,text/xml,*/*;q=0.8",
    });

    for (const url of urlsFromSitemap(sitemap.body, origin)) {
      enqueueSeed(url, "sitemap");
    }
  } catch {
    // Sitemap is optional.
  }

  /** @type {{ title: string, canonical: string, fingerprint: string } | null} */
  let homeSignature = null;

  while (queue.length > 0) {
    const next = queue.shift();

    if (!next || seen.has(next.url) || next.depth > MAX_CRAWL_DEPTH) {
      continue;
    }

    if (isPhotoAttachmentUrl(next.url)) {
      seen.add(next.url);
      continue;
    }

    seen.add(next.url);

    let fetched;

    try {
      fetched = await fetchPublicText(next.url, { cache });
    } catch {
      continue;
    }

    if (!/text\/html|application\/xhtml\+xml/i.test(fetched.contentType)) {
      continue;
    }

    if (origin === HUB_ORIGIN && isHubDirectoryPage(fetched.url)) {
      continue;
    }

    if (hasDerivedAnalysisMarker(fetched.body)) {
      continue;
    }

    const document = parseHtmlDocument(fetched.body);
    const canonical = canonicalHrefFromHtml(fetched.body, fetched.url);
    const fingerprint = htmlBodyFingerprint(fetched.body);
    // fetchPublicText always returns an absolute http(s) URL.
    const pagePath = new URL(fetched.url).pathname.replace(/\/+$/, "") || "/";

    if (pagePath === "/") {
      homeSignature = {
        title: document.title,
        canonical: canonical || homeUrl,
        fingerprint,
      };
    } else if (
      homeSignature &&
      isSoft404Duplicate({
        pageUrl: fetched.url,
        homeUrl,
        title: document.title,
        homeTitle: homeSignature.title,
        canonical,
        homeCanonical: homeSignature.canonical,
        bodyFingerprint: fingerprint,
        homeBodyFingerprint: homeSignature.fingerprint,
      })
    ) {
      // Soft-404: skip retention so blind probe misses do not amplify NLP.
      continue;
    }

    const schemaTypes = schemaTypesFromHtml(fetched.body);
    const role = classifyPageRole(fetched.url, {
      title: document.title,
      derived: document.derived,
      schemaTypes,
    });
    pages.push({
      url: fetched.url,
      title: document.title,
      text: document.text,
      links: document.links,
      html: fetched.body,
      noindex: document.noindex,
      derived: document.derived,
      lang: document.lang,
      page_role: role,
    });

    for (const link of document.links) {
      let absolute = "";

      try {
        absolute = new URL(link.href, fetched.url).href;
      } catch {
        continue;
      }

      if (isParticipationDeclarationPath(absolute)) {
        continue;
      }

      let linkOrigin = "";

      try {
        linkOrigin = originFromHttpUrl(absolute);
      } catch {
        continue;
      }

      if (linkOrigin === origin) {
        if (next.depth < MAX_CRAWL_DEPTH) {
          const same = resolveSameOrigin(origin, absolute);

          if (same && !seen.has(same)) {
            queue.push({ url: same, depth: next.depth + 1 });
          }
        }
      }
    }

    outbound.push(
      ...externalOutboundLinks(origin, fetched.url, document.links),
    );

    for (const child of topicHubChildUrls(
      origin,
      fetched.url,
      document.links,
    )) {
      if (!seen.has(child)) {
        queue.push({ url: child, depth: 0 });
      }
    }

    // Creative/writing index children (experiments, games, photos, …) go to
    // the front of the queue so OG posters are retained even when a large
    // archive or sitemap would otherwise starve them.
    const indexChildren = contentIndexChildUrls(
      origin,
      fetched.url,
      document.links,
    );

    for (let index = indexChildren.length - 1; index >= 0; index -= 1) {
      const child = indexChildren[index];

      if (!seen.has(child)) {
        selectionReasons[child] = selectionReasons[child] || "content-index";
        queue.unshift({ url: child, depth: 0 });
      }
    }

    // A published /slashes index expands additional same-origin slash links.
    if (pagePath.replace(/\/+$/, "").endsWith("/slashes")) {
      for (const link of document.links) {
        const same = resolveSameOrigin(origin, link.href);

        if (same && !seen.has(same)) {
          selectionReasons[same] = "slashes-index";
          queue.push({ url: same, depth: 0 });
        }
      }
    }
  }

  return {
    origin,
    pages,
    outbound_links: outbound,
    html_subjects: [],
    selection_reasons: selectionReasons,
  };
}

/**
 * Record for one origin that failed to crawl. Other origins keep their data.
 * @param {string} origin
 * @param {string} now
 * @param {unknown} error
 * @returns {Record<string, unknown>}
 */
export function originFailureSignal(origin, now, error) {
  return {
    origin,
    crawled_at: now,
    coverage: {
      pages_discovered: 0,
      pages_fetched: 0,
      fetch_limit: null,
      limit_reached: false,
      selection_strategy: "uncapped-site-crawl-v1",
    },
    pages: [],
    declared_topics: [],
    subject_signals: [],
    subjects: [],
    outbound_links: [],
    community_slugs: [],
    stats: {},
    error: error instanceof Error ? error.message : String(error),
  };
}
