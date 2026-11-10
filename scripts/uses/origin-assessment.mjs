/**
 * Goal & Constraints:
 * Decide a Uses page outcome while the HTML is still in memory, then drop it.
 * The rollup reads this assessment and does not keep the page body.
 */

import {
  discoverUsesPages,
  homeHtmlFromPages,
  usesHtmlRepeatsHomepage,
} from "./discover.mjs";
import { extractUsesFromHtml } from "./extract.mjs";

/**
 * @param {string} origin
 * @param {Array<{ url?: string, html?: string, outcome?: string }> | undefined} pages
 * @returns {{
 *   page_url: string,
 *   page_status: string,
 *   homepage_duplicate: boolean,
 *   extracted: ReturnType<typeof extractUsesFromHtml> | null,
 * }}
 */
export function assessUsesPages(origin, pages) {
  const list = Array.isArray(pages) ? pages : [];
  const discovered = discoverUsesPages({ origin, pages: list });
  let pageUrl = discovered[0]?.page_url || `${origin}/uses/`;
  let homepageDuplicate = false;
  let html = "";

  for (const page of list) {
    if (page?.outcome === "out_of_scope") {
      homepageDuplicate = true;
      if (typeof page.url === "string" && page.url) {
        pageUrl = page.url;
      }
      break;
    }
    if (!page?.html || typeof page.url !== "string") {
      continue;
    }
    if (/\/uses(?:\/|\.html?)?(?:$|\?)/i.test(page.url)) {
      html = page.html;
      pageUrl = page.url;
      break;
    }
  }

  if (
    !homepageDuplicate &&
    html &&
    usesHtmlRepeatsHomepage(html, homeHtmlFromPages(list))
  ) {
    homepageDuplicate = true;
    html = "";
  }

  if (homepageDuplicate) {
    return {
      page_url: pageUrl,
      page_status: "out_of_scope",
      homepage_duplicate: true,
      extracted: null,
    };
  }

  if (!html) {
    return {
      page_url: pageUrl,
      page_status: discovered.length ? "not_checked" : "not_found",
      homepage_duplicate: false,
      extracted: null,
    };
  }

  const extracted = extractUsesFromHtml(html);
  return {
    page_url: pageUrl,
    page_status: extracted.outcome,
    homepage_duplicate: false,
    extracted,
  };
}
