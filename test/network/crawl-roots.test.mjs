/**
 * Goal: Exhaust crawl-root helpers with synthetic origins only. Cover parse,
 * path matching, start URLs, and validation without live participant locks.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertValidCrawlRoots,
  crawlRootPathByOrigin,
  crawlRootsFromDocument,
  crawlStartUrl,
  crawlStartUrlForOrigin,
  normalizeCrawlPath,
  urlMatchesCrawlRoot,
} from "../../scripts/network/crawl-roots.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("normalizeCrawlPath requires a rooted path without query or hash", () => {
  assert.equal(normalizeCrawlPath(null), "");
  assert.equal(normalizeCrawlPath("josh/"), "");
  assert.equal(normalizeCrawlPath("/josh?x=1"), "");
  assert.equal(normalizeCrawlPath("/josh#top"), "");
  assert.equal(normalizeCrawlPath("/"), "/");
  assert.equal(normalizeCrawlPath("/josh"), "/josh/");
  assert.equal(normalizeCrawlPath("/josh/"), "/josh/");
});

test("crawlRootsFromDocument ignores invalid rows and root paths", () => {
  assert.deepEqual(crawlRootsFromDocument(null), []);
  assert.deepEqual(crawlRootsFromDocument([]), []);
  assert.deepEqual(crawlRootsFromDocument({}), []);
  assert.deepEqual(crawlRootsFromDocument({ roots: null }), []);
  assert.deepEqual(
    crawlRootsFromDocument({
      roots: {
        "not a url": { path: "/josh/" },
        "https://family.example": null,
        "https://family.example/path": { path: "/josh/" },
        "https://root.example": { path: "/" },
        "https://relative.example": { path: "josh" },
        "https://scoped.example": { path: "/josh" },
      },
    }),
    [{ origin: "https://scoped.example", path: "/josh/" }],
  );
});

test("crawlStartUrl and path map resolve scoped start URLs", () => {
  assert.equal(
    crawlStartUrl("https://family.example", "/josh/"),
    "https://family.example/josh/",
  );
  assert.equal(
    crawlStartUrl("https://family.example", ""),
    "https://family.example",
  );
  const map = crawlRootPathByOrigin([
    { origin: "https://family.example", path: "/josh/" },
  ]);
  assert.equal(
    crawlStartUrlForOrigin("https://family.example", map),
    "https://family.example/josh/",
  );
  assert.equal(
    crawlStartUrlForOrigin("https://other.example", map),
    "https://other.example",
  );
});

test("urlMatchesCrawlRoot enforces path boundaries", () => {
  const origin = "https://family.example";
  assert.equal(urlMatchesCrawlRoot("", `${origin}/josh/`, "/josh/"), false);
  assert.equal(urlMatchesCrawlRoot("  ", `${origin}/josh/`, "/josh/"), false);
  assert.equal(urlMatchesCrawlRoot(origin, `${origin}/josh/`, "/josh/"), true);
  assert.equal(urlMatchesCrawlRoot(origin, `${origin}/josh`, "/josh/"), true);
  assert.equal(
    urlMatchesCrawlRoot(origin, `${origin}/josh/travel/`, "/josh/"),
    true,
  );
  assert.equal(
    urlMatchesCrawlRoot(origin, `${origin}/joshua/`, "/josh/"),
    false,
  );
  assert.equal(urlMatchesCrawlRoot(origin, `${origin}/`, "/josh/"), false);
  assert.equal(
    urlMatchesCrawlRoot(origin, "https://other.example/josh/", "/josh/"),
    false,
  );
  assert.equal(urlMatchesCrawlRoot(origin, `${origin}/about/`, ""), true);
  assert.equal(urlMatchesCrawlRoot(origin, `${origin}/about/`, "/"), true);
  assert.equal(urlMatchesCrawlRoot(origin, "not-a-url", "/josh/"), false);
});

test("assertValidCrawlRoots rejects duplicates, root paths, and bad origins", () => {
  assert.doesNotThrow(() =>
    assertValidCrawlRoots([
      { origin: "https://family.example", path: "/josh/" },
    ]),
  );
  assert.throws(
    () =>
      assertValidCrawlRoots([
        { origin: "https://family.example", path: "/josh/" },
        { origin: "https://family.example", path: "/other/" },
      ]),
    /duplicate origin/,
  );
  assert.throws(
    () =>
      assertValidCrawlRoots([{ origin: "https://family.example", path: "/" }]),
    /non-root path/,
  );
  assert.throws(
    () =>
      assertValidCrawlRoots([{ origin: "https://family.example", path: "" }]),
    /non-root path/,
  );
  assert.throws(
    () =>
      assertValidCrawlRoots([
        { origin: "https://family.example/path", path: "/josh/" },
      ]),
    /invalid origin/,
  );
});

test("checked-in crawl roots stay clear and include levinger /josh/", async () => {
  const doc = JSON.parse(
    await readFile(path.join(root, "_data/network_crawl_roots.json"), "utf8"),
  );
  const roots = crawlRootsFromDocument(doc);
  assertValidCrawlRoots(roots);
  const map = crawlRootPathByOrigin(roots);
  assert.equal(map.get("https://levinger.net"), "/josh/");
  assert.equal(
    crawlStartUrlForOrigin("https://levinger.net", map),
    "https://levinger.net/josh/",
  );
});
