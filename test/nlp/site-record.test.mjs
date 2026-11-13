/**
 * Goal: the per-site record and crawl JSON encoding round-trip without page bodies.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CRAWL_KEYS,
  buildSiteRecord,
  crawlSitesDir,
  decodeCrawlKey,
  decodeCrawlValue,
  encodeCrawlKey,
  encodeCrawlValue,
  isCrawlJsonPath,
  iterateSiteRecords,
  listSiteRecordIds,
  originRecordId,
  readSiteRecordFile,
  writeSiteRecord,
} from "../../scripts/nlp/site-record.mjs";

test("structural keys round-trip and page bodies are omitted", () => {
  const encoded = encodeCrawlValue({
    origin: "https://joshua.example",
    title: "Joshua",
    html: "<p>secret</p>",
    content_html: "<p>secret</p>",
    body: "<p>secret</p>",
    "https://joshua.example/notes": { ok: true },
    count: 2,
    items: [{ name: "Pen" }],
    empty: null,
  });
  const packed = JSON.stringify(encoded);
  assert.equal(packed.includes("origin"), false);
  assert.equal(packed.includes("html"), false);
  assert.equal(packed.includes("<p>secret</p>"), false);
  assert.equal(packed.includes("https://joshua.example/notes"), false);
  const decoded = decodeCrawlValue(encoded);
  assert.equal(decoded.origin, "https://joshua.example");
  assert.equal(decoded.title, "Joshua");
  assert.equal(decoded.count, 2);
  assert.equal(decoded.items[0].name, "Pen");
  assert.equal(decoded.empty, null);
  assert.equal(decoded["https://joshua.example/notes"].ok, true);
  assert.equal(Object.hasOwn(decoded, "html"), false);
});

test("key codec leaves short keys and unknown tokens in place", () => {
  assert.equal(encodeCrawlKey("origin"), CRAWL_KEYS.origin);
  assert.equal(encodeCrawlKey(CRAWL_KEYS.origin), CRAWL_KEYS.origin);
  const sealed = encodeCrawlKey("https://friends.joshua.example/uses");
  assert.equal(sealed.startsWith("z"), true);
  assert.equal(encodeCrawlKey(sealed), sealed);
  assert.notEqual(encodeCrawlKey("z"), "z");
  assert.equal(decodeCrawlKey(encodeCrawlKey("z")), "z");
  assert.equal(decodeCrawlKey(CRAWL_KEYS.title), "title");
  assert.equal(
    decodeCrawlKey(encodeCrawlKey("https://other.example/")),
    "https://other.example/",
  );
  assert.equal(decodeCrawlKey("plain"), "plain");
  assert.equal(decodeCrawlKey("z"), "z");
  assert.equal(encodeCrawlValue("pen"), "pen");
  assert.equal(encodeCrawlValue(null), null);
  assert.deepEqual(decodeCrawlValue(["a"]), ["a"]);
});

test("crawl paths are the generated datasets only", () => {
  assert.equal(isCrawlJsonPath(""), false);
  assert.equal(isCrawlJsonPath("/repo/readme.md"), false);
  assert.equal(isCrawlJsonPath("/repo/_data/topic_aliases.json"), false);
  assert.equal(isCrawlJsonPath("/repo/_data/topic_denylist.json"), false);
  assert.equal(
    isCrawlJsonPath("/repo/_data/network_display_titles.json"),
    false,
  );
  assert.equal(isCrawlJsonPath("/repo/_data/network_crawl_roots.json"), false);
  assert.equal(
    isCrawlJsonPath("/repo/_data/network_site_families.json"),
    false,
  );
  assert.equal(isCrawlJsonPath("/repo/_data/network_dev.json"), false);
  assert.equal(isCrawlJsonPath("/repo/_data/network_preview.json"), false);
  assert.equal(
    isCrawlJsonPath("/repo/_data/content_support_matrix.json"),
    false,
  );
  assert.equal(isCrawlJsonPath("/repo/_data/content.json"), true);
  assert.equal(isCrawlJsonPath("_data/network.json"), true);
  assert.equal(isCrawlJsonPath("_data/content.json"), true);
  assert.equal(isCrawlJsonPath("_data/topic_aliases.json"), false);
  assert.equal(isCrawlJsonPath("_data/homepage_connections.json"), true);
  assert.equal(isCrawlJsonPath("assets/data/uses/index.json"), true);
  assert.equal(isCrawlJsonPath("data/crawl-sites/abc.json"), true);
  assert.equal(isCrawlJsonPath("/repo/assets/data/uses/index.json"), true);
  assert.equal(isCrawlJsonPath("/repo/data/uses/catalog/tools.json"), false);
  assert.equal(isCrawlJsonPath("/repo/data/uses/state.json"), true);
  assert.equal(isCrawlJsonPath("/repo/data/crawl-sites/abc.json"), true);
  assert.equal(
    isCrawlJsonPath("/repo/data/classification/quality-baseline.json"),
    true,
  );
  assert.equal(isCrawlJsonPath("/repo/.network-sync/seeking-state.json"), true);
  assert.equal(isCrawlJsonPath("/repo/notes.json"), false);
  assert.equal(isCrawlJsonPath("C:\\repo\\_data\\content.json"), true);
});

test("a site record rejects page bodies and writes one compact file", async () => {
  assert.throws(
    () =>
      buildSiteRecord({
        origin: "https://joshua.example",
        pages: [{ html: "<p>" }],
      }),
    /rejects page bodies/,
  );
  assert.throws(
    () =>
      buildSiteRecord({
        origin: "https://joshua.example",
        pages: [{ content_html: "<p>" }],
      }),
    /rejects page bodies/,
  );
  assert.throws(
    () =>
      buildSiteRecord({
        origin: "https://joshua.example",
        pages: [{ text: "full page" }],
      }),
    /rejects page bodies/,
  );
  assert.throws(
    () =>
      buildSiteRecord({
        origin: "https://joshua.example",
        pages: [{ body: "full page" }],
      }),
    /rejects page bodies/,
  );
  assert.deepEqual(buildSiteRecord({}).pages, []);
  const built = buildSiteRecord({
    pages: [
      { html: "" },
      null,
      "skip",
      { page_role: "post", url: "https://joshua.example/notes" },
    ],
    status: "failed",
    content: "nope",
  });
  assert.equal(built.status, "failed");
  assert.equal(built.origin, "");
  assert.deepEqual(built.content, []);
  assert.equal(built.pages[1].url, "");
  assert.equal(built.pages[3].role, "post");
  assert.equal(built.signals, null);

  const root = await fs.mkdtemp(path.join(os.tmpdir(), "site-record-"));
  try {
    const filePath = await writeSiteRecord(root, {
      origin: "https://joshua.example",
      title: "Joshua",
      domain: "joshua.example",
      crawled_at: "2026-11-06T00:00:00.000Z",
      pages: [{ url: "https://joshua.example/", role: "home", hash: "abc" }],
      content: [{ title: "Note", url: "https://joshua.example/notes" }],
      signals: { origin: "https://joshua.example" },
      links: { origin: "https://joshua.example" },
      community: { origin: "https://joshua.example" },
      uses: { page_status: "verified" },
      seeking: { complete: true },
    });
    const raw = await fs.readFile(filePath, "utf8");
    assert.equal(raw.includes("origin"), false);
    assert.equal(raw.includes("\n"), false);
    const loaded = await readSiteRecordFile(filePath);
    assert.equal(loaded.origin, "https://joshua.example");
    assert.equal(loaded.pages[0].role, "home");
    assert.equal(loaded.content[0].title, "Note");
    const id = originRecordId("https://joshua.example");
    const seen = [];
    for await (const record of iterateSiteRecords(root, [id, "missing"])) {
      seen.push(record.origin);
    }
    assert.deepEqual(seen, ["https://joshua.example"]);
    assert.deepEqual(await listSiteRecordIds(root), [id]);
    assert.equal(crawlSitesDir(root), path.join(root, "data", "crawl-sites"));
    assert.equal(
      await readSiteRecordFile(path.join(root, "missing.json")),
      null,
    );
    const arrayFile = path.join(crawlSitesDir(root), "array.json");
    await fs.writeFile(arrayFile, "[]");
    assert.equal(await readSiteRecordFile(arrayFile), null);
    await fs.writeFile(path.join(crawlSitesDir(root), "bad.json"), "{");
    await assert.rejects(
      readSiteRecordFile(path.join(crawlSitesDir(root), "bad.json")),
    );
    await fs.writeFile(path.join(crawlSitesDir(root), "note.tmp.json"), "{}");
    const ids = await listSiteRecordIds(root);
    assert.equal(ids.includes("note.tmp"), false);
    assert.deepEqual(await listSiteRecordIds(path.join(root, "absent")), []);
    await fs.writeFile(path.join(root, "blocked"), "x");
    await fs.mkdir(path.join(root, "blocked-root"));
    await fs.mkdir(path.join(root, "blocked-root", "data"));
    await fs.writeFile(
      path.join(root, "blocked-root", "data", "crawl-sites"),
      "x",
    );
    await assert.rejects(listSiteRecordIds(path.join(root, "blocked-root")));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("two site files assemble one at a time without page HTML", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "site-record-pair-"));

  try {
    const origins = ["https://joshua.example", "https://other.example"];
    const ids = [];

    for (const origin of origins) {
      const filePath = await writeSiteRecord(root, {
        origin,
        pages: [{ url: `${origin}/`, role: "home" }],
        content: [{ title: "Note", url: `${origin}/notes` }],
      });
      const raw = await fs.readFile(filePath, "utf8");
      assert.equal(raw.includes(`"${CRAWL_KEYS.origin}"`), true);
      assert.equal(raw.includes('"origin"'), false);
      assert.equal(raw.includes("html"), false);
      ids.push(originRecordId(origin));
    }

    const seen = [];

    for await (const record of iterateSiteRecords(root, ids)) {
      seen.push(record.origin);
      assert.equal(record.pages[0].html, undefined);
      assert.equal(record.content[0].title, "Note");
    }

    assert.deepEqual(seen, origins);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
