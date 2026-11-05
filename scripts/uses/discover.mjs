/**
 * Goal & Constraints:
 * Discover eligible /uses page URLs from crawl retention, slash paths, OPML,
 * and validated nav labels. Never invent pages; reject off-origin redirects.
 */

import { fetchPublicText } from "../nlp/lib.mjs";
import { htmlBodyFingerprint } from "../nlp/text.mjs";

import { isHubOrigin, USES_NAV_LABELS } from "./constants.mjs";

/**
 * @typedef {object} DiscoveredUsesPage
 * @property {string} origin
 * @property {string} page_url
 * @property {string} discovery_method
 * @property {string} [declared_url]
 * @property {string} [canonical_url]
 * @property {string} [final_url]
 * @property {string[]} [redirect_chain]
 */

/**
 * Canonical same-origin /uses candidate paths.
 * @param {string} origin - Absolute origin.
 * @returns {string[]} Absolute URLs.
 */
export function defaultUsesCandidates(origin) {
  let base;
  try {
    base = new URL(origin);
  } catch {
    return [];
  }
  const root = `${base.protocol}//${base.host}`;
  return [`${root}/uses/`, `${root}/uses`, `${root}/uses.html`];
}

/**
 * Returns whether a URL path looks like an explicit /uses page.
 * @param {string} href - Absolute or path URL.
 * @returns {boolean}
 */
export function isUsesPath(href) {
  try {
    const url = new URL(href, "https://example.invalid");
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return /^\/uses(?:\.html?)?$/i.test(path);
  } catch {
    return false;
  }
}

/**
 * Normalizes an origin string to `protocol://host` without trailing slash.
 * @param {string} origin
 * @returns {string}
 */
export function normalizeOrigin(origin) {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

/**
 * Same-origin check for two absolute URLs.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function sameOrigin(a, b) {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/**
 * Discovers uses page candidates for one eligible origin.
 * Prefers retained crawl pages; also accepts OPML and nav evidence.
 * @param {object} input
 * @param {string} input.origin
 * @param {Array<{ url?: string, html?: string, title?: string }>} [input.pages]
 * @param {Array<{ url?: string, category?: string, text?: string }>} [input.opmlOutlines]
 * @param {Array<{ href?: string, text?: string }>} [input.navLinks]
 * @param {string} [input.declaredUrl]
 * @returns {DiscoveredUsesPage[]}
 */
export function discoverUsesPages(input) {
  const origin = normalizeOrigin(input.origin);
  if (!origin || isHubOrigin(origin)) {
    return [];
  }

  /** @type {Map<string, DiscoveredUsesPage>} */
  const found = new Map();

  /**
   * @param {string} pageUrl
   * @param {string} method
   * @param {Partial<DiscoveredUsesPage>} [extra]
   */
  const add = (pageUrl, method, extra = {}) => {
    let absolute;
    try {
      absolute = new URL(pageUrl, origin).href;
    } catch {
      return;
    }
    if (!sameOrigin(absolute, origin)) {
      return;
    }
    if (!isUsesPath(absolute) && method !== "declared" && method !== "nav") {
      if (method !== "opml") {
        return;
      }
    }
    const key = absolute.replace(/\/$/, "");
    if (found.has(key)) {
      return;
    }
    found.set(key, {
      origin,
      page_url: absolute,
      discovery_method: method,
      ...extra,
    });
  };

  if (typeof input.declaredUrl === "string" && input.declaredUrl) {
    add(input.declaredUrl, "declared", { declared_url: input.declaredUrl });
  }

  for (const page of input.pages || []) {
    if (!page || typeof page.url !== "string") {
      continue;
    }
    if (isUsesPath(page.url) && sameOrigin(page.url, origin)) {
      add(page.url, "crawl", { final_url: page.url });
    }
  }

  for (const outline of input.opmlOutlines || []) {
    if (!outline || typeof outline.url !== "string") {
      continue;
    }
    const category = String(outline.category || "").toLowerCase();
    if (category === "/uses" || category === "uses") {
      add(outline.url, "opml", { declared_url: outline.url });
    }
  }

  for (const link of input.navLinks || []) {
    if (!link || typeof link.href !== "string") {
      continue;
    }
    const text = String(link.text || "")
      .trim()
      .toLowerCase();
    if (!USES_NAV_LABELS.has(text)) {
      continue;
    }
    add(link.href, "nav");
  }

  // Prefer explicit crawl hits; if none, still record default candidates as
  // discovery hints for the extractor status machine (not_checked → fetch).
  if (found.size === 0) {
    for (const candidate of defaultUsesCandidates(origin)) {
      add(candidate, "slash-default");
    }
  }

  return [...found.values()].sort((a, b) =>
    a.page_url.localeCompare(b.page_url),
  );
}

/**
 * Classifies an off-origin final URL as out_of_scope evidence.
 * @param {string} origin
 * @param {string} finalUrl
 * @returns {'ok'|'out_of_scope'}
 */
export function classifyRedirectScope(origin, finalUrl) {
  if (!sameOrigin(origin, finalUrl)) {
    return "out_of_scope";
  }
  return "ok";
}

/**
 * True when a `/uses` response is the homepage served again.
 * @param {string} usesHtml
 * @param {string} homeHtml
 * @returns {boolean}
 */
export function usesHtmlRepeatsHomepage(usesHtml, homeHtml) {
  if (!usesHtml || !homeHtml) {
    return false;
  }
  const usesFingerprint = htmlBodyFingerprint(usesHtml);
  const homeFingerprint = htmlBodyFingerprint(homeHtml);
  return Boolean(usesFingerprint) && usesFingerprint === homeFingerprint;
}

/**
 * Homepage HTML from a crawl page list, when one was fetched.
 * @param {Array<{ url?: string, html?: string }>} pages
 * @returns {string}
 */
export function homeHtmlFromPages(pages) {
  for (const page of pages || []) {
    if (!page?.html || typeof page.url !== "string") {
      continue;
    }
    try {
      const path = new URL(page.url).pathname.replace(/\/+$/, "") || "/";
      if (path === "/") {
        return page.html;
      }
    } catch {
      continue;
    }
  }
  return "";
}

/**
 * Fetches the first available Uses page HTML for an origin.
 * Keeps Uses extraction alive when deep crawl is short-circuited.
 * A `/uses` URL that returns the homepage is `out_of_scope`, not a Uses page.
 * @param {string} origin
 * @param {{
 *   cache?: object,
 *   httpCache?: import("../nlp/fetch-cache.mjs").FetchCache,
 *   fetchText?: typeof fetchPublicText,
 * }} [options]
 * @returns {Promise<Array<{ url: string, html: string, lang: string, outcome?: string }>>}
 */
export async function fetchUsesHtmlPages(origin, options = {}) {
  const fetchText =
    typeof options.fetchText === "function"
      ? options.fetchText
      : fetchPublicText;
  const pages = [];
  let homeHtml = "";

  try {
    const homeUrl = new URL(origin);
    homeUrl.pathname = "/";
    homeUrl.search = "";
    homeUrl.hash = "";
    const home = await fetchText(homeUrl.href, {
      cache: options.cache,
      httpCache: options.httpCache,
    });
    homeHtml = typeof home?.body === "string" ? home.body : "";
  } catch {
    homeHtml = "";
  }

  for (const candidate of defaultUsesCandidates(origin)) {
    try {
      const fetched = await fetchText(candidate, {
        cache: options.cache,
        httpCache: options.httpCache,
      });
      const finalUrl = String(fetched?.url || candidate);
      const body = typeof fetched?.body === "string" ? fetched.body : "";

      if (!body || !isUsesPath(finalUrl)) {
        continue;
      }

      if (usesHtmlRepeatsHomepage(body, homeHtml)) {
        return [
          {
            url: finalUrl,
            html: "",
            lang: "",
            outcome: "out_of_scope",
          },
        ];
      }

      pages.push({
        url: finalUrl,
        html: body,
        lang: "",
      });
      break;
    } catch {
      // Try the next candidate path.
    }
  }

  return pages;
}
