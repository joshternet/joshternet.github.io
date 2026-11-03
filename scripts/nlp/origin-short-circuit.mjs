/**
 * Goal & Constraints:
 * After prune, skip deep HTML crawl when primary feeds and sitemap probes are
 * unchanged (conditional fetch / 304)—but only after a prior deep crawl
 * baseline exists for that origin. Feed bodies are fetched once via
 * subjectsFromFeeds; this module only probes sitemap freshness and carries
 * prior site_signals forward on skip.
 */

import { fetchPublicText } from "./lib.mjs";

/**
 * Whether prior site_signals for an origin include a real deep crawl.
 * Short-circuit-only empties (pages_fetched 0, no pages) do not count.
 * @param {Record<string, unknown> | null | undefined} prior
 * @returns {boolean}
 */
export function originHasDeepCrawlBaseline(prior) {
  if (!prior || typeof prior !== "object") {
    return false;
  }

  const coverage =
    prior.coverage && typeof prior.coverage === "object"
      ? /** @type {Record<string, unknown>} */ (prior.coverage)
      : {};
  const stats =
    prior.stats && typeof prior.stats === "object"
      ? /** @type {Record<string, unknown>} */ (prior.stats)
      : {};
  const fromCoverage = Number(coverage.pages_fetched);
  const fromStats = Number(stats.pages_fetched);

  if (Number.isFinite(fromCoverage) && fromCoverage > 0) {
    return true;
  }

  if (Number.isFinite(fromStats) && fromStats > 0) {
    return true;
  }

  return Array.isArray(prior.pages) && prior.pages.length > 0;
}

/**
 * Clone a prior origin signal for a short-circuit skip, preserving pages.
 * @param {Record<string, unknown> | null | undefined} prior
 * @param {{ origin: string, crawledAt: string }} meta
 * @returns {Record<string, unknown>}
 */
export function carryForwardOriginSignal(prior, meta) {
  const origin =
    typeof meta?.origin === "string" && meta.origin ? meta.origin : "";
  const crawledAt =
    typeof meta?.crawledAt === "string" && meta.crawledAt
      ? meta.crawledAt
      : new Date().toISOString();

  /** @type {Record<string, unknown>} */
  let base;

  if (prior && typeof prior === "object") {
    base = /** @type {Record<string, unknown>} */ (
      JSON.parse(JSON.stringify(prior))
    );
  } else {
    base = {
      origin,
      pages: [],
      declared_topics: [],
      subject_signals: [],
      subjects: [],
      descriptions: [],
      locales: [],
      schema_types: [],
      content_types: [],
      outbound_links: [],
      community_slugs: [],
      coverage: {
        pages_discovered: 0,
        pages_fetched: 0,
        fetch_limit: null,
        limit_reached: false,
        selection_strategy: "uncapped-site-crawl-v1",
        selection_reasons: {},
      },
      stats: {
        pages_fetched: 0,
        declared_topic_count: 0,
        subject_signal_count: 0,
        outbound_link_count: 0,
      },
    };
  }

  base.origin = origin || String(base.origin || "");
  base.crawled_at = crawledAt;

  const coverage =
    base.coverage && typeof base.coverage === "object"
      ? /** @type {Record<string, unknown>} */ (base.coverage)
      : {};
  const priorReasons =
    coverage.selection_reasons && typeof coverage.selection_reasons === "object"
      ? /** @type {Record<string, unknown>} */ (coverage.selection_reasons)
      : {};
  coverage.selection_reasons = {
    ...priorReasons,
    [base.origin]: "short-circuit-unchanged",
  };
  base.coverage = coverage;

  return base;
}

/**
 * Whether deep crawl can be skipped given feed probe results + sitemap.
 * Requires a prior deep-crawl baseline; otherwise monitors only after the
 * first full crawl.
 * @param {{
 *   origin: string,
 *   feedsFetched: number,
 *   feedsUnchanged: boolean,
 *   hasDeepCrawlBaseline?: boolean,
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
  const hasDeepCrawlBaseline = Boolean(input?.hasDeepCrawlBaseline);

  if (!hasDeepCrawlBaseline || feedsFetched <= 0 || !feedsUnchanged) {
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
