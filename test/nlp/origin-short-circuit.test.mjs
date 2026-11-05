/**
 * Goal: Origin short-circuit when feeds + sitemap are unchanged,
 * but only after a prior deep crawl baseline exists.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  carryForwardOriginSignal,
  decideOriginShortCircuit,
  originHasDeepCrawlBaseline,
} from "../../scripts/nlp/origin-short-circuit.mjs";
import { dnsCache } from "../helpers/mock-fetch.mjs";

test("originHasDeepCrawlBaseline requires prior pages_fetched or pages", () => {
  assert.equal(originHasDeepCrawlBaseline(undefined), false);
  assert.equal(originHasDeepCrawlBaseline(null), false);
  assert.equal(originHasDeepCrawlBaseline({}), false);
  assert.equal(
    originHasDeepCrawlBaseline({
      coverage: { pages_fetched: 0 },
      pages: [],
    }),
    false,
  );
  assert.equal(
    originHasDeepCrawlBaseline({
      coverage: {
        pages_fetched: 0,
        selection_reasons: {
          "https://a.example": "short-circuit-unchanged",
        },
      },
      pages: [],
    }),
    false,
  );
  assert.equal(
    originHasDeepCrawlBaseline({
      coverage: { pages_fetched: 12 },
      pages: [],
    }),
    true,
  );
  assert.equal(
    originHasDeepCrawlBaseline({
      stats: { pages_fetched: 3 },
      pages: [],
    }),
    true,
  );
  assert.equal(
    originHasDeepCrawlBaseline({
      coverage: { pages_fetched: 0 },
      pages: [{ url: "https://a.example/" }],
    }),
    true,
  );
});

test("decideOriginShortCircuit refuses without a deep-crawl baseline", async () => {
  const result = await decideOriginShortCircuit({
    origin: "https://a.example",
    feedsFetched: 2,
    feedsUnchanged: true,
    hasDeepCrawlBaseline: false,
    robotsGate: { allows: async () => false },
  });
  assert.equal(result.shortCircuit, false);
  assert.equal(result.probedSitemap, false);
});

test("decideOriginShortCircuit refuses when no feeds were fetched", async () => {
  const result = await decideOriginShortCircuit({
    origin: "https://a.example",
    feedsFetched: 0,
    feedsUnchanged: true,
    hasDeepCrawlBaseline: true,
  });
  assert.equal(result.shortCircuit, false);
});

test("decideOriginShortCircuit refuses when feeds changed", async () => {
  const result = await decideOriginShortCircuit({
    origin: "https://a.example",
    feedsFetched: 2,
    feedsUnchanged: false,
    hasDeepCrawlBaseline: true,
  });
  assert.equal(result.shortCircuit, false);
});

test("decideOriginShortCircuit short-circuits when feeds unchanged and sitemap 304", async () => {
  const previousFetch = globalThis.fetch;
  const dns = dnsCache(["a.example"]);

  try {
    globalThis.fetch = async () =>
      new Response(null, { status: 304, headers: { etag: '"s"' } });

    // Seed cache so 304 can return a body.
    const { openFetchCache, writeFetchCacheEntry } =
      await import("../../scripts/nlp/fetch-cache.mjs");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "josh-sc-"));
    const previous = process.env.NETWORK_REFRESH_ALL;
    delete process.env.NETWORK_REFRESH_ALL;
    const httpCache = await openFetchCache(root);
    await writeFetchCacheEntry(httpCache, {
      url: "https://a.example/sitemap.xml",
      body: "<?xml version='1.0'?><urlset></urlset>",
      contentType: "application/xml",
      etag: '"s"',
      cachedAt: new Date().toISOString(),
      bodyComplete: true,
    });

    const result = await decideOriginShortCircuit({
      origin: "https://a.example",
      feedsFetched: 1,
      feedsUnchanged: true,
      hasDeepCrawlBaseline: true,
      cache: dns,
      httpCache,
    });
    assert.equal(result.shortCircuit, true);
    assert.equal(result.sitemapUnchanged, true);
    assert.equal(result.probedSitemap, true);

    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
    await fs.rm(root, { recursive: true, force: true });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("decideOriginShortCircuit treats missing sitemap as unchanged when feeds are", async () => {
  const previousFetch = globalThis.fetch;
  const dns = dnsCache(["b.example"]);

  try {
    globalThis.fetch = async () =>
      new Response("missing", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });

    const result = await decideOriginShortCircuit({
      origin: "https://b.example",
      feedsFetched: 1,
      feedsUnchanged: true,
      hasDeepCrawlBaseline: true,
      cache: dns,
    });
    assert.equal(result.shortCircuit, true);
    assert.equal(result.sitemapUnchanged, true);
    assert.equal(result.probedSitemap, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("decideOriginShortCircuit respects robots disallow on sitemap", async () => {
  const result = await decideOriginShortCircuit({
    origin: "https://c.example",
    feedsFetched: 1,
    feedsUnchanged: true,
    hasDeepCrawlBaseline: true,
    robotsGate: {
      allows: async () => false,
    },
  });
  assert.equal(result.shortCircuit, true);
  assert.equal(result.sitemapUnchanged, true);
  assert.equal(result.probedSitemap, false);
});

test("decideOriginShortCircuit coerces non-number feedsFetched and changed sitemap", async () => {
  const previousFetch = globalThis.fetch;
  const dns = dnsCache(["d.example"]);

  try {
    assert.equal(
      (await decideOriginShortCircuit(/** @type {any} */ (undefined)))
        .shortCircuit,
      false,
    );
    assert.equal(
      (
        await decideOriginShortCircuit({
          origin: null,
          feedsFetched: 1,
          feedsUnchanged: true,
          hasDeepCrawlBaseline: true,
          robotsGate: { allows: async () => false },
        })
      ).shortCircuit,
      true,
    );
    assert.equal(
      (
        await decideOriginShortCircuit({
          origin: undefined,
          feedsFetched: 1,
          feedsUnchanged: true,
          hasDeepCrawlBaseline: true,
          robotsGate: { allows: async () => false },
        })
      ).shortCircuit,
      true,
    );

    globalThis.fetch = async () =>
      new Response("<urlset></urlset>", {
        status: 200,
        headers: { "content-type": "application/xml" },
      });

    const changed = await decideOriginShortCircuit({
      origin: "https://d.example/",
      feedsFetched: 1,
      feedsUnchanged: true,
      hasDeepCrawlBaseline: true,
      cache: dns,
    });
    assert.equal(changed.probedSitemap, true);
    assert.equal(changed.sitemapUnchanged, false);
    assert.equal(changed.shortCircuit, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("carryForwardOriginSignal keeps prior pages and marks short-circuit", () => {
  const prior = {
    origin: "https://a.example",
    crawled_at: "2020-01-01T00:00:00.000Z",
    coverage: {
      pages_discovered: 4,
      pages_fetched: 4,
      selection_reasons: { "https://a.example": "seed" },
    },
    pages: [{ url: "https://a.example/projects/" }],
    declared_topics: [{ slug: "projects" }],
    subject_signals: [{ slug: "projects" }],
    outbound_links: [{ url: "https://other.example/" }],
    stats: { pages_fetched: 4 },
  };
  const carried = carryForwardOriginSignal(prior, {
    origin: "https://a.example",
    crawledAt: "2026-11-03T00:00:00.000Z",
  });
  assert.equal(carried.crawled_at, "2026-11-03T00:00:00.000Z");
  assert.equal(carried.coverage.pages_fetched, 4);
  assert.equal(carried.pages.length, 1);
  assert.equal(carried.declared_topics.length, 1);
  assert.equal(
    carried.coverage.selection_reasons["https://a.example"],
    "short-circuit-unchanged",
  );
  // Prior object must not be mutated.
  assert.equal(prior.coverage.selection_reasons["https://a.example"], "seed");
});

test("carryForwardOriginSignal tolerates missing coverage and blank meta", () => {
  const carried = carryForwardOriginSignal(
    {
      origin: "https://c.example",
      coverage: "not-an-object",
      pages: [{ url: "https://c.example/" }],
    },
    /** @type {any} */ ({}),
  );
  assert.equal(carried.origin, "https://c.example");
  assert.equal(
    carried.coverage.selection_reasons["https://c.example"],
    "short-circuit-unchanged",
  );
  assert.ok(typeof carried.crawled_at === "string" && carried.crawled_at);

  const noReasons = carryForwardOriginSignal(
    {
      origin: "https://d.example",
      coverage: { pages_fetched: 2, selection_reasons: null },
      pages: [],
    },
    { origin: "", crawledAt: "" },
  );
  assert.equal(noReasons.origin, "https://d.example");
  assert.equal(
    noReasons.coverage.selection_reasons["https://d.example"],
    "short-circuit-unchanged",
  );

  const blankOrigin = carryForwardOriginSignal(
    { pages: [], coverage: {} },
    { origin: "", crawledAt: "2026-11-03T00:00:00.000Z" },
  );
  assert.equal(blankOrigin.origin, "");
  assert.equal(
    blankOrigin.coverage.selection_reasons[""],
    "short-circuit-unchanged",
  );
});

test("carryForwardOriginSignal builds an empty shell when prior is missing", () => {
  const carried = carryForwardOriginSignal(null, {
    origin: "https://b.example",
    crawledAt: "2026-11-03T00:00:00.000Z",
  });
  assert.equal(carried.origin, "https://b.example");
  assert.deepEqual(carried.pages, []);
  assert.equal(carried.coverage.pages_fetched, 0);
  assert.equal(
    carried.coverage.selection_reasons["https://b.example"],
    "short-circuit-unchanged",
  );
});
