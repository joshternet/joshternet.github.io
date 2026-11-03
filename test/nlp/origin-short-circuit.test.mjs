/**
 * Goal: Origin short-circuit when feeds + sitemap are unchanged.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { decideOriginShortCircuit } from "../../scripts/nlp/origin-short-circuit.mjs";
import { dnsCache } from "../helpers/mock-fetch.mjs";

test("decideOriginShortCircuit refuses when no feeds were fetched", async () => {
  const result = await decideOriginShortCircuit({
    origin: "https://a.example",
    feedsFetched: 0,
    feedsUnchanged: true,
  });
  assert.equal(result.shortCircuit, false);
});

test("decideOriginShortCircuit refuses when feeds changed", async () => {
  const result = await decideOriginShortCircuit({
    origin: "https://a.example",
    feedsFetched: 2,
    feedsUnchanged: false,
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
    });

    const result = await decideOriginShortCircuit({
      origin: "https://a.example",
      feedsFetched: 1,
      feedsUnchanged: true,
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
      cache: dns,
    });
    assert.equal(changed.probedSitemap, true);
    assert.equal(changed.sitemapUnchanged, false);
    assert.equal(changed.shortCircuit, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
