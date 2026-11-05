/**
 * Goal: Conditional HTTP fetch cache — meta prune, 304 reuse, bypass flag,
 * and a permanent original capture beside later updates.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  readOriginalFetchCacheBody,
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
    assert.equal(
      await readOriginalFetchCacheBody(null, "https://a.example/"),
      null,
    );
    assert.equal(
      await readOriginalFetchCacheBody(
        { bypass: true, entries: new Map(), root },
        "https://a.example/",
      ),
      null,
    );
    assert.equal(await readOriginalFetchCacheBody(cache, ""), null);
  } finally {
    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

/**
 * Original body filename for one URL.
 * @param {string} url
 * @returns {string}
 */
function originalBodyName(url) {
  return `${createHash("sha256").update(url).digest("hex").slice(0, 32)}.original.body`;
}

test("complete crawl captures keep the original body when the page updates", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "josh-http-original-"));
  const previous = process.env.NETWORK_REFRESH_ALL;
  delete process.env.NETWORK_REFRESH_ALL;

  try {
    const cache = await openFetchCache(root);
    const page = "https://a.example/page";
    const first = await writeFetchCacheEntry(cache, {
      url: page,
      body: "<html>original</html>",
      contentType: "text/html",
      etag: '"v1"',
      lastModified: "Mon, 01 Jan 2026 00:00:00 GMT",
      cachedAt: "2026-01-01T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(first.originalBodyFile, first.bodyFile);
    assert.equal(
      (await readOriginalFetchCacheBody(cache, page)).body,
      "<html>original</html>",
    );

    const updated = await writeFetchCacheEntry(cache, {
      url: page,
      body: "<html>update</html>",
      etag: '"v2"',
      cachedAt: "2026-06-01T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.notEqual(updated.bodySha256, first.originalBodySha256);
    assert.equal(updated.originalCachedAt, "2026-01-01T00:00:00.000Z");
    assert.equal(
      (await readFetchCacheBody(cache, page)).body,
      "<html>update</html>",
    );
    assert.equal(
      (await readOriginalFetchCacheBody(cache, page)).body,
      "<html>original</html>",
    );

    cache.entries.get(page).originalCachedAt = "";
    await writeFetchCacheEntry(cache, {
      url: page,
      body: "<html>update-2</html>",
      cachedAt: "2026-07-01T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(
      cache.entries.get(page).originalCachedAt,
      "2026-06-01T00:00:00.000Z",
    );

    cache.entries.get(page).originalCachedAt = "";
    cache.entries.get(page).cachedAt = "";
    await writeFetchCacheEntry(cache, {
      url: page,
      body: "<html>update-3</html>",
      cachedAt: "2026-08-01T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(
      cache.entries.get(page).originalCachedAt,
      "2026-08-01T00:00:00.000Z",
    );

    cache.entries.get(page).originalCachedAt = 12;
    cache.entries.get(page).cachedAt = "2026-03-01T00:00:00.000Z";
    await writeFetchCacheEntry(cache, {
      url: page,
      body: "<html>update-4</html>",
      cachedAt: "2026-09-01T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(
      cache.entries.get(page).originalCachedAt,
      "2026-03-01T00:00:00.000Z",
    );

    const adopted = "https://a.example/adopt";
    await fs.writeFile(
      path.join(root, originalBodyName(adopted)),
      "<html>disk</html>",
      "utf8",
    );
    const adoptedEntry = await writeFetchCacheEntry(cache, {
      url: adopted,
      body: "<html>newer</html>",
      cachedAt: "2026-04-01T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(
      adoptedEntry.originalBodySha256,
      bodySha256("<html>disk</html>"),
    );
    assert.equal(
      (await readOriginalFetchCacheBody(cache, adopted)).body,
      "<html>disk</html>",
    );

    const datedPrior = "https://a.example/adopt-dated";
    await fs.writeFile(
      path.join(root, originalBodyName(datedPrior)),
      "<html>kept</html>",
      "utf8",
    );
    cache.entries.set(datedPrior, {
      url: datedPrior,
      bodySha256: "current",
      bodyFile: "dated-current.body",
      cachedAt: "2026-02-01T00:00:00.000Z",
    });
    const datedEntry = await writeFetchCacheEntry(cache, {
      url: datedPrior,
      body: "<html>replacement</html>",
      cachedAt: "2026-05-01T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(datedEntry.originalCachedAt, "2026-02-01T00:00:00.000Z");
    assert.equal(
      (await readOriginalFetchCacheBody(cache, datedPrior)).body,
      "<html>kept</html>",
    );

    const undatedPrior = "https://a.example/adopt-undated";
    await fs.writeFile(
      path.join(root, originalBodyName(undatedPrior)),
      "<html>undated-disk</html>",
      "utf8",
    );
    cache.entries.set(undatedPrior, {
      url: undatedPrior,
      bodySha256: "current",
      bodyFile: "undated-current.body",
      cachedAt: "",
    });
    const undatedEntry = await writeFetchCacheEntry(cache, {
      url: undatedPrior,
      body: "<html>replacement</html>",
      cachedAt: "2026-05-02T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(undatedEntry.originalCachedAt, "2026-05-02T00:00:00.000Z");

    const legacy = "https://a.example/legacy";
    await fs.writeFile(
      path.join(root, "legacy.body"),
      "<html>legacy</html>",
      "utf8",
    );
    cache.entries.set(legacy, {
      url: legacy,
      bodySha256: bodySha256("<html>legacy</html>"),
      bodyFile: "legacy.body",
      cachedAt: "2026-01-15T00:00:00.000Z",
    });
    const legacyEntry = await writeFetchCacheEntry(cache, {
      url: legacy,
      body: "<html>legacy-update</html>",
      cachedAt: "2026-06-15T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(
      legacyEntry.originalBodySha256,
      bodySha256("<html>legacy</html>"),
    );
    assert.equal(legacyEntry.originalCachedAt, "2026-01-15T00:00:00.000Z");
    assert.equal(
      (await readFetchCacheBody(cache, legacy)).body,
      "<html>legacy-update</html>",
    );

    const legacyUndated = "https://a.example/legacy-undated";
    await fs.writeFile(
      path.join(root, "legacy-undated.body"),
      "<html>old</html>",
      "utf8",
    );
    cache.entries.set(legacyUndated, {
      url: legacyUndated,
      bodySha256: bodySha256("<html>old</html>"),
      bodyFile: "legacy-undated.body",
      cachedAt: "",
    });
    const legacyUndatedEntry = await writeFetchCacheEntry(cache, {
      url: legacyUndated,
      body: "<html>new</html>",
      cachedAt: "2026-06-16T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(
      legacyUndatedEntry.originalCachedAt,
      "2026-06-16T00:00:00.000Z",
    );
    assert.equal(
      (await readOriginalFetchCacheBody(cache, legacyUndated)).body,
      "<html>old</html>",
    );

    const missingPrior = "https://a.example/missing-prior";
    cache.entries.set(missingPrior, {
      url: missingPrior,
      bodySha256: "gone",
      bodyFile: "missing-prior.body",
      cachedAt: "2026-01-20T00:00:00.000Z",
    });
    const missingEntry = await writeFetchCacheEntry(cache, {
      url: missingPrior,
      body: "<html>first-surviving</html>",
      cachedAt: "2026-06-20T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(
      missingEntry.originalBodySha256,
      bodySha256("<html>first-surviving</html>"),
    );

    const blankFile = "https://a.example/blank-file";
    cache.entries.set(blankFile, {
      url: blankFile,
      bodySha256: "blank",
      bodyFile: "",
      cachedAt: "2026-01-21T00:00:00.000Z",
    });
    const blankEntry = await writeFetchCacheEntry(cache, {
      url: blankFile,
      body: "<html>blank-original</html>",
      cachedAt: "2026-06-21T00:00:00.000Z",
      bodyComplete: true,
    });
    assert.equal(
      blankEntry.originalBodySha256,
      bodySha256("<html>blank-original</html>"),
    );

    const partial = await writeFetchCacheEntry(cache, {
      url: "https://a.example/partial",
      body: "<html>partial</html>",
      cachedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(partial.originalBodyFile, undefined);
    assert.equal(
      await readOriginalFetchCacheBody(cache, "https://a.example/partial"),
      null,
    );

    cache.entries.get(page).originalBodyFile = "gone.original.body";
    assert.equal(await readOriginalFetchCacheBody(cache, page), null);
    assert.equal(cache.entries.has(page), true);
    cache.entries.get(page).originalBodyFile = "";
    assert.equal(await readOriginalFetchCacheBody(cache, page), null);
    assert.equal(
      await readOriginalFetchCacheBody(cache, "https://a.example/unknown"),
      null,
    );

    cache.entries.get(adopted).etag = '"stale"';
    cache.entries.get(adopted).lastModified = "Tue, 01 Apr 2026 00:00:00 GMT";
    cache.entries.get(adopted).cachedAt = "2026-01-01T00:00:00.000Z";
    const evicted = pruneFetchCache(cache, "2026-12-15T00:00:00.000Z", 30);
    assert.equal(cache.entries.has(adopted), true);
    assert.equal(cache.entries.get(adopted).etag, undefined);
    assert.equal(cache.entries.get(adopted).lastModified, undefined);
    assert.equal(
      (await readOriginalFetchCacheBody(cache, adopted)).body,
      "<html>disk</html>",
    );
    assert.equal(cache.entries.has("https://a.example/partial"), false);
    assert.ok(evicted >= 1);
  } finally {
    if (previous === undefined) {
      delete process.env.NETWORK_REFRESH_ALL;
    } else {
      process.env.NETWORK_REFRESH_ALL = previous;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});
