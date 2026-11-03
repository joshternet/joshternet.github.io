/**
 * Goal & Constraints:
 * After prune, skip deep HTML crawl when primary feeds and sitemap probes are
 * unchanged (conditional fetch / 304). Feed bodies are fetched once via
 * subjectsFromFeeds; this module only probes sitemap freshness.
 */

import { fetchPublicText } from "./lib.mjs";

/**
 * Whether deep crawl can be skipped given feed probe results + sitemap.
 * @param {{
 *   origin: string,
 *   feedsFetched: number,
 *   feedsUnchanged: boolean,
 *   cache?: Map<string, unknown>,
 *   httpCache?: import("./fetch-cache.mjs").FetchCache,
 *   robotsGate?: { allows: (href: string) => Promise<boolean> },
 * }} input
 * @returns {Promise<{
 *   shortCircuit: boolean,
 *   sitemapUnchanged: boolean,
 *   probedSitemap: boolean,
 * }>}
 */
export async function decideOriginShortCircuit(input) {
  const feedsFetched =
    typeof input?.feedsFetched === "number" ? input.feedsFetched : 0;
  const feedsUnchanged = Boolean(input?.feedsUnchanged);

  if (feedsFetched <= 0 || !feedsUnchanged) {
    return {
      shortCircuit: false,
      sitemapUnchanged: false,
      probedSitemap: false,
    };
  }

  const originRaw =
    input.origin === undefined || input.origin === null
      ? ""
      : String(input.origin);
  const origin = originRaw.replace(/\/+$/, "");
  const sitemapUrl = `${origin}/sitemap.xml`;
  let sitemapUnchanged = false;
  let probedSitemap = false;

  if (!input.robotsGate || (await input.robotsGate.allows(sitemapUrl))) {
    try {
      const fetched = await fetchPublicText(sitemapUrl, {
        cache: input.cache,
        httpCache: input.httpCache,
        accept: "application/xml,text/xml,*/*;q=0.8",
      });
      probedSitemap = true;
      sitemapUnchanged = Boolean(fetched.unchanged);
    } catch {
      // No sitemap: feeds alone are enough to short-circuit.
      sitemapUnchanged = true;
      probedSitemap = false;
    }
  } else {
    sitemapUnchanged = true;
  }

  return {
    // feedsUnchanged is already true when we reach this return.
    shortCircuit: sitemapUnchanged,
    sitemapUnchanged,
    probedSitemap,
  };
}
