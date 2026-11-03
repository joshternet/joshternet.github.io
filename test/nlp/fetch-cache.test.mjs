/**
 * Goal: Conditional HTTP fetch cache — meta prune, 304 reuse, bypass flag.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  bodySha256,
  conditionalHeadersFromEntry,
  fetchCacheBypassed,
  openFetchCache,
  pruneFetchCache,
  readFetchCacheBody,
  saveFetchCache,
  writeFetchCacheEntry,
} from "../../scripts/nlp/fetch-cache.mjs";
import { fetchPublicText } from "../../scripts/nlp/lib.mjs";
import { dnsCache } from "../helpers/mock-fetch.mjs";

test("bodySha256 is stable for a string", () => {
  assert.equal(bodySha256("abc"), bodySha256("abc"));
  assert.notEqual(bodySha256("abc"), bodySha256("abd"));
  assert.equal(bodySha256(null), bodySha256(""));
  assert.equal(bodySha256(undefined), bodySha256(""));
});

test("conditionalHeadersFromEntry maps etag and last-modified", () => {
  assert.deepEqual(conditionalHeadersFromEntry(null), {});
  assert.deepEqual(
    conditionalHeadersFromEntry({
      url: "https://a.example/",
      etag: '"v1"',
      lastModified: "Mon, 01 Jan 2026 00:00:00 GMT",
      bodySha256: "x",
      bodyFile: "x.body",
      cachedAt: "2026-01-01T00:00:00.000Z",
    }),
    {
      "If-None-Match": '"v1"',
      "If-Modified-Since": "Mon, 01 Jan 2026 00:00:00 GMT",
    },
  );
  assert.deepEqual(
    conditionalHeadersFromEntry({
      url: "https://a.example/",
      etag: '"only"',
      bodySha256: "x",
      bodyFile: "x.body",
      cachedAt: "2026-01-01T00:00:00.000Z",
    }),
    { "If-None-Match": '"only"' },
  );
  assert.deepEqual(
    conditionalHeadersFromEntry({
      url: "https://a.example/",
      lastModified: "Tue, 02 Jan 2026 00:00:00 GMT",
      bodySha256: "x",
      bodyFile: "x.body",
      cachedAt: "2026-01-01T00:00:00.000Z",
    }),
    { "If-Modified-Since": "Tue, 02 Jan 2026 00:00:00 GMT" },
  );
});

test("fetchCacheBypassed follows NETWORK_REFRESH_ALL and options.bypass", () => {
  const previous = process.env.NETWORK_REFRESH_ALL;
  delete process.env.NETWORK_REFRESH_ALL;
  assert.equal(fetchCacheBypassed(), false);
  assert.equal(fetchCacheBypassed({ bypass: true }), true);
  process.env.NETWORK_REFRESH_ALL = "true";
  assert.equal(fetchCacheBypassed(), true);
  process.env.NETWORK_REFRESH_ALL = "yes";
  assert.equal(fetchCacheBypassed(), true);
  process.env.NETWORK_REFRESH_ALL = "1";
  assert.equal(fetchCacheBypassed(), true);
  if (previous === undefined) {
    delete process.env.NETWORK_REFRESH_ALL;
  } else {
    process.env.NETWORK_REFRESH_ALL = previous;
  }
});

test("open/write/read/save/prune fetch cache round-trip", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "josh-http-cache-"));
  const previous = process.env.NETWORK_REFRESH_ALL;
  delete process.env.NETWORK_REFRESH_ALL;

  try {
    const cache = await openFetchCache(root);
    assert.equal(cache.bypass, false);
    assert.equal(cache.entries.size, 0);

    await writeFetchCacheEntry(cache, {
      url: "https://a.example/post",
      body: "<html>hi</html>",
      contentType: "text/html",
      etag: '"1"',
      lastModified: "Mon, 01 Jan 2026 00:00:00 GMT",
      cachedAt: "2026-11-01T00:00:00.000Z",
    });
    await writeFetchCacheEntry(cache, {
      url: "https://b.example/other",
      body: undefined,
    });

    const hit = await readFetchCacheBody(cache, "https://a.example/post");
    assert.ok(hit);
    assert.equal(hit.body, "<html>hi</html>");
    assert.equal(hit.unchanged, true);

    await saveFetchCache(cache);
    assert.ok(cache.entries.size >= 2);
    const reopened = await openFetchCache(root);
    assert.ok(reopened.entries.size >= 2);

    const keptFresh = await openFetchCache(root);
    keptFresh.entries.clear();
    await writeFetchCacheEntry(keptFresh, {
      url: "https://a.example/fresh",
      body: "fresh",
      cachedAt: "2026-12-01T00:00:00.000Z",
    });
    keptFresh.entries.set("https://a.example/nodate", {
      url: "https://a.example/nodate",
      bodySha256: "x",
      bodyFile: "nodate.body",
      cachedAt: "",
    });
    assert.ok(
      pruneFetchCache(keptFresh, new Date("2026-12-10T00:00:00.000Z"), 30) >= 1,
    );

    const evicted = pruneFetchCache(reopened, "2026-12-15T00:00:00.000Z", 30);
    assert.ok(evicted >= 1);
    assert.equal(reopened.entries.size, 0);

    assert.equal(await readFetchCacheBody(reopened, "https://missing"), null);
    assert.equal(await writeFetchCacheEntry(reopened, { url: "" }), null);
  } finally {
    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("fetchPublicText uses httpCache for 304 reuse and 200 store", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "josh-http-fetch-"));
  const previous = process.env.NETWORK_REFRESH_ALL;
  const previousFetch = globalThis.fetch;
  delete process.env.NETWORK_REFRESH_ALL;
  const cache = await openFetchCache(root);
  const dns = dnsCache(["public.example"]);

  try {
    globalThis.fetch = async () =>
      new Response("<html>one</html>", {
        status: 200,
        headers: {
          "content-type": "text/html",
          etag: '"v1"',
          "last-modified": "Mon, 01 Jan 2026 00:00:00 GMT",
        },
      });

    const first = await fetchPublicText("https://public.example/page", {
      httpCache: cache,
      cache: dns,
    });
    assert.equal(first.body, "<html>one</html>");
    assert.equal(first.unchanged, false);
    assert.equal(cache.entries.size, 1);

    let sawConditional = false;
    globalThis.fetch = async (_url, init) => {
      const headers = init?.headers || {};
      if (headers["If-None-Match"] === '"v1"') {
        sawConditional = true;
      }
      return new Response(null, { status: 304, headers: { etag: '"v1"' } });
    };

    const second = await fetchPublicText("https://public.example/page", {
      httpCache: cache,
      cache: dns,
    });
    assert.equal(sawConditional, true);
    assert.equal(second.unchanged, true);
    assert.equal(second.body, "<html>one</html>");
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("openFetchCache uses default root under cwd .tmp", async () => {
  const previous = process.env.NETWORK_REFRESH_ALL;
  delete process.env.NETWORK_REFRESH_ALL;
  try {
    const cache = await openFetchCache();
    assert.ok(String(cache.root).includes(".tmp"));
    assert.equal(cache.bypass, false);
  } finally {
    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
  }
});

test("openFetchCache bypasses when NETWORK_REFRESH_ALL is set", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "josh-http-bypass-"));
  const previous = process.env.NETWORK_REFRESH_ALL;
  process.env.NETWORK_REFRESH_ALL = "1";

  try {
    const bypassed = await openFetchCache(root);
    assert.equal(bypassed.bypass, true);
    assert.equal(bypassed.entries.size, 0);
    assert.equal(
      await writeFetchCacheEntry(bypassed, {
        url: "https://a.example/",
        body: "y",
      }),
      null,
    );
    await saveFetchCache(bypassed);
    assert.equal(pruneFetchCache(bypassed, new Date().toISOString()), 0);
  } finally {
    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("openFetchCache ignores corrupt meta and invalid entries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "josh-http-corrupt-"));
  const previous = process.env.NETWORK_REFRESH_ALL;
  delete process.env.NETWORK_REFRESH_ALL;

  try {
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, "meta.json"), "{not-json", "utf8");
    const cache = await openFetchCache(root);
    assert.equal(cache.entries.size, 0);

    await fs.writeFile(
      path.join(root, "meta.json"),
      '{"entries":null}',
      "utf8",
    );
    const emptyList = await openFetchCache(root);
    assert.equal(emptyList.entries.size, 0);

    await fs.writeFile(
      path.join(root, "meta.json"),
      JSON.stringify({
        entries: [
          null,
          { url: "https://a.example/", bodySha256: 1, bodyFile: "x" },
          {
            url: "https://ok.example/",
            bodySha256: "abc",
            bodyFile: "ok.body",
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
      "utf8",
    );
    await fs.writeFile(path.join(root, "ok.body"), "body", "utf8");
    const ok = await openFetchCache(root);
    assert.equal(ok.entries.size, 1);

    assert.equal(await readFetchCacheBody(ok, ""), null);
    assert.equal(await readFetchCacheBody(null, "https://ok.example/"), null);
    assert.equal(pruneFetchCache(null, new Date()), 0);
    pruneFetchCache(ok, new Date("invalid"), 30);
  } finally {
    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("fetchPublicText throws on 304 without cache entry", async () => {
  const previousFetch = globalThis.fetch;
  const previous = process.env.NETWORK_REFRESH_ALL;
  delete process.env.NETWORK_REFRESH_ALL;
  const dns = dnsCache(["nocache.example"]);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "josh-304-"));
  const httpCache = await openFetchCache(root);

  try {
    globalThis.fetch = async () => new Response(null, { status: 304 });
    await assert.rejects(
      () =>
        fetchPublicText("https://nocache.example/page", {
          cache: dns,
          httpCache,
        }),
      /304 without cache/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("readFetchCacheBody drops missing body files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "josh-http-miss-"));
  const previous = process.env.NETWORK_REFRESH_ALL;
  delete process.env.NETWORK_REFRESH_ALL;

  try {
    const cache = await openFetchCache(root);
    cache.entries.set("https://a.example/gone", {
      url: "https://a.example/gone",
      bodySha256: "x",
      bodyFile: "missing.body",
      cachedAt: new Date().toISOString(),
    });
    assert.equal(
      await readFetchCacheBody(cache, "https://a.example/gone"),
      null,
    );
    assert.equal(cache.entries.has("https://a.example/gone"), false);
  } finally {
    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});
