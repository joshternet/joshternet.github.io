/**
 * Goal & Constraints:
 * Bounded same-origin BFS crawl for NLP topic extraction. Seeds from homepage,
 * advertised topic hubs (/topics/, /tags/, …) and common writing indexes
 * (/notes/, /blog/, /posts/, …) even when those URLs are absent from
 * sitemap.xml, sitemap locs, and optional feed entry URLs. Skips
 * /.well-known/josh. Failures for one origin never abort the run.
 */

import { originFromHttpUrl } from "../network/blogroll.mjs";
import {
  HUB_ORIGIN,
  hasDerivedAnalysisMarker,
  isHubDirectoryPage,
  isParticipationDeclarationPath,
} from "../network/connections.mjs";
import { isNonSubjectSlug } from "./evidence.mjs";
import {
  MAX_CRAWL_DEPTH,
  MAX_PAGES_PER_ORIGIN,
  fetchPublicText,
  parseHtmlDocument,
} from "./lib.mjs";
import { classifyPageRole } from "./page-role.mjs";

/** Publisher topic directories that often omit themselves from sitemap.xml. */
export const TOPIC_HUB_INDEX_PATHS = [
  "/topics/",
  "/topic/",
  "/tags/",
  "/tag/",
  "/categories/",
  "/category/",
];

/** Same-origin topic pages followed from a hub listing. */
export const MAX_TOPIC_HUB_CHILDREN = 32;

/** Publisher writing indexes that often omit themselves from sitemap.xml. */
export const CONTENT_INDEX_PATHS = [
  "/notes/",
  "/blog/",
  "/posts/",
  "/post/",
  "/writing/",
  "/articles/",
  "/article/",
  "/now/",
  "/friends/",
  "/about/",
  "/work/",
  "/projects/",
  "/archive/",
  "/essays/",
  "/journal/",
  "/log/",
  "/weeknotes/",
];

/** Same-origin article pages followed from a writing index. */
export const MAX_CONTENT_INDEX_CHILDREN = 32;

const STATIC_PATH =
  /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|xml|json|txt|zip|woff2?)$/i;

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
export function urlsFromSitemap(xml, origin, limit = 30) {
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
 *   cache?: Map<string, unknown>,
 * }} [options]
 * @returns {Promise<{origin: string, pages: CrawledPage[], outbound_links: Array<{href: string, text: string, page: string}>, html_subjects: Array<Record<string, unknown>>}>}
 */
export async function crawlOrigin(origin, options = {}) {
  const cache = options.cache || new Map();
  /** @type {Array<{url: string, depth: number}>} */
  const queue = [{ url: `${origin}/`, depth: 0 }];
  const seen = new Set();
  /** @type {CrawledPage[]} */
  const pages = [];
  /** @type {Array<{href: string, text: string, page: string}>} */
  const outbound = [];

  if (typeof options.aboutUrl === "string" && options.aboutUrl) {
    const about = resolveSameOrigin(origin, options.aboutUrl);

    if (about) {
      queue.push({ url: about, depth: 0 });
    }
  }

  for (const url of topicHubSeedUrls(origin)) {
    queue.push({ url, depth: 0 });
  }

  for (const url of contentIndexSeedUrls(origin)) {
    queue.push({ url, depth: 0 });
  }

  for (const feedUrl of options.feedEntryUrls || []) {
    const resolved = resolveSameOrigin(origin, feedUrl);

    if (resolved) {
      queue.push({ url: resolved, depth: 0 });
    }
  }

  try {
    const sitemap = await fetchPublicText(`${origin}/sitemap.xml`, {
      cache,
      accept: "application/xml,text/xml,*/*;q=0.8",
    });

    for (const url of urlsFromSitemap(sitemap.body, origin)) {
      queue.push({ url, depth: 0 });
    }
  } catch {
    // Sitemap is optional.
  }

  while (queue.length > 0 && pages.length < MAX_PAGES_PER_ORIGIN) {
    const next = queue.shift();

    if (!next || seen.has(next.url) || next.depth > MAX_CRAWL_DEPTH) {
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
    const role = classifyPageRole(fetched.url, {
      title: document.title,
      derived: document.derived,
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
      } else {
        outbound.push({
          href: absolute,
          text: link.text,
          rel: link.rel,
          classNames: link.classNames,
          page: fetched.url,
        });
      }
    }

    for (const child of topicHubChildUrls(
      origin,
      fetched.url,
      document.links,
    )) {
      if (!seen.has(child)) {
        queue.push({ url: child, depth: 0 });
      }
    }

    for (const child of contentIndexChildUrls(
      origin,
      fetched.url,
      document.links,
    )) {
      if (!seen.has(child)) {
        queue.push({ url: child, depth: 0 });
      }
    }
  }

  return {
    origin,
    pages,
    outbound_links: outbound,
    html_subjects: [],
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
      fetch_limit: MAX_PAGES_PER_ORIGIN,
      limit_reached: false,
      selection_strategy: "bounded-site-crawl-v1",
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
