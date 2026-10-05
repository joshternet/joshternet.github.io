/**
 * Goal: 100% line/branch/function coverage for scripts/nlp/feeds.mjs.
 * All tests are offline — mock fetch only, never live network.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  subjectsFromFeeds,
  subjectsFromJsonFeed,
  subjectsFromRssOrAtom,
} from "../../scripts/nlp/feeds.mjs";
import { dnsCache, install, restore } from "../helpers/mock-fetch.mjs";

// ─── subjectsFromRssOrAtom ───────────────────────────────────────────────────

test("subjectsFromRssOrAtom: RSS category with term attribute", () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title><![CDATA[My Post]]></title>
        <link>https://a.example/my-post</link>
        <category term="Photography">Photography</category>
      </item>
    </channel></rss>`;
  const subjects = subjectsFromRssOrAtom(xml);
  assert.ok(subjects.some((s) => s.slug === "photography"));
  assert.equal(
    subjects.find((s) => s.slug === "photography")?.community_eligible,
    true,
  );
});

test("subjectsFromRssOrAtom: CMS feed-path categories are dropped", () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>Campus news</title>
        <link>https://www.cs.cmu.edu/news</link>
        <category>feeds/default</category>
      </item>
    </channel></rss>`;
  const subjects = subjectsFromRssOrAtom(xml);
  assert.equal(subjects.length, 0);
});

test("subjectsFromRssOrAtom: CDATA category labels unwrap", () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>Goals achieved</title>
        <link>https://joshreads.com/goals</link>
        <category><![CDATA[Heathcliff]]></category>
      </item>
    </channel></rss>`;
  const subjects = subjectsFromRssOrAtom(xml);
  assert.equal(subjects[0]?.label, "Heathcliff");
  assert.equal(subjects[0]?.slug, "heathcliff");
});

test("subjectsFromRssOrAtom: Atom category with term attribute", () => {
  const xml = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Hello Atom</title>
        <link href="https://a.example/atom-post" rel="alternate"/>
        <category term="IndieWeb"/>
        <category term="Photography"/>
      </entry>
    </feed>`;
  const subjects = subjectsFromRssOrAtom(xml);
  const slugs = subjects.map((s) => s.slug);
  assert.ok(slugs.includes("indieweb"));
  assert.ok(slugs.includes("photography"));
  // Atom feed sets the source correctly
  const s = subjects.find((sub) => sub.slug === "indieweb");
  assert.ok(s?.sources.includes("atom:category"));
});

test("subjectsFromRssOrAtom: empty slug is skipped", () => {
  // A category with only whitespace → slugifyTopic returns '' → skipped
  const xml = `<rss><channel>
    <item>
      <link>https://a.example/1</link>
      <category>   </category>
      <category>Design</category>
    </item>
  </channel></rss>`;
  const subjects = subjectsFromRssOrAtom(xml);
  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].slug, "design");
});

test("subjectsFromRssOrAtom: item without a URL still adds category", () => {
  // No <link> element → url is empty; topic still created with empty pages
  const xml = `<rss><channel>
    <item>
      <category>Gardening</category>
    </item>
  </channel></rss>`;
  const subjects = subjectsFromRssOrAtom(xml);
  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].slug, "gardening");
  assert.equal(subjects[0].pages.length, 0);
});

test("subjectsFromRssOrAtom: multiple items with same category share pages", () => {
  const xml = `<rss><channel>
    <item>
      <link>https://a.example/1</link>
      <category>AI</category>
    </item>
    <item>
      <link>https://a.example/2</link>
      <category>AI</category>
    </item>
  </channel></rss>`;
  const subjects = subjectsFromRssOrAtom(xml);
  const ai = subjects.find((s) => s.slug === "ai");
  assert.ok(ai);
  assert.ok(ai.pages.length >= 2);
});

test("subjectsFromRssOrAtom: pages are capped at 5", () => {
  const items = Array.from(
    { length: 8 },
    (_, i) =>
      `<item><link>https://a.example/${i}</link><category>AI</category></item>`,
  ).join("\n");
  const xml = `<rss><channel>${items}</channel></rss>`;
  const subjects = subjectsFromRssOrAtom(xml);
  const ai = subjects.find((s) => s.slug === "ai");
  assert.ok(ai);
  assert.ok(ai.pages.length <= 5);
});

test("subjectsFromRssOrAtom: observedAt propagates to evidence", () => {
  const xml = `<rss><channel>
    <item>
      <link>https://a.example/1</link>
      <category>Books</category>
    </item>
  </channel></rss>`;
  const subjects = subjectsFromRssOrAtom(xml, {
    observedAt: "2026-10-03T22:00:00.000Z",
  });
  const books = subjects.find((s) => s.slug === "books");
  assert.ok(books);
  assert.ok(Array.isArray(books.evidence));
});

test("subjectsFromRssOrAtom: evidence_class is declared", () => {
  const xml = `<rss><channel>
    <item><link>https://a.example/1</link><category>Maps</category></item>
  </channel></rss>`;
  const subjects = subjectsFromRssOrAtom(xml);
  assert.equal(subjects[0].evidence_class, "declared");
});

// ─── subjectsFromJsonFeed ────────────────────────────────────────────────────

test("subjectsFromJsonFeed: valid JSON Feed with tags", () => {
  const json = JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    items: [
      {
        url: "https://a.example/post-1",
        title: "First post",
        tags: ["Photography", "Travel"],
      },
      {
        url: "https://a.example/post-2",
        title: "Second post",
        tags: ["Photography"],
      },
    ],
  });
  const subjects = subjectsFromJsonFeed(json);
  const slugs = subjects.map((s) => s.slug);
  assert.ok(slugs.includes("photography"));
  assert.ok(slugs.includes("travel"));
});

test("subjectsFromJsonFeed: invalid JSON → empty array", () => {
  const subjects = subjectsFromJsonFeed("not valid json {{{");
  assert.deepEqual(subjects, []);
});

test("subjectsFromJsonFeed: non-string tag is skipped", () => {
  const json = JSON.stringify({
    items: [
      {
        url: "https://a.example/1",
        tags: [42, null, "Design", { label: "oops" }],
      },
    ],
  });
  const subjects = subjectsFromJsonFeed(json);
  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].slug, "design");
});

test("subjectsFromJsonFeed: item with no URL still adds topic with empty pages", () => {
  const json = JSON.stringify({
    items: [{ tags: ["Gardening"] }],
  });
  const subjects = subjectsFromJsonFeed(json);
  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].slug, "gardening");
  assert.equal(subjects[0].pages.length, 0);
});

test("subjectsFromJsonFeed: empty tag string is skipped via slugify", () => {
  const json = JSON.stringify({
    items: [
      {
        url: "https://a.example/1",
        tags: ["   ", "Books"],
      },
    ],
  });
  const subjects = subjectsFromJsonFeed(json);
  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].slug, "books");
});

test("subjectsFromJsonFeed: empty items array → empty result", () => {
  const json = JSON.stringify({ items: [] });
  const subjects = subjectsFromJsonFeed(json);
  assert.deepEqual(subjects, []);
});

test("subjectsFromJsonFeed: no items field → empty result", () => {
  const json = JSON.stringify({ title: "My Feed" });
  const subjects = subjectsFromJsonFeed(json);
  assert.deepEqual(subjects, []);
});

test("subjectsFromJsonFeed: pages capped at 5", () => {
  const items = Array.from({ length: 8 }, (_, i) => ({
    url: `https://a.example/${i}`,
    tags: ["AI"],
  }));
  const json = JSON.stringify({ items });
  const subjects = subjectsFromJsonFeed(json);
  const ai = subjects.find((s) => s.slug === "ai");
  assert.ok(ai);
  assert.ok(ai.pages.length <= 5);
});

test("subjectsFromJsonFeed: sources include feed and json-feed:tag", () => {
  const json = JSON.stringify({
    items: [{ url: "https://a.example/1", tags: ["AI"] }],
  });
  const subjects = subjectsFromJsonFeed(json);
  assert.ok(subjects[0].sources.includes("feed"));
  assert.ok(subjects[0].sources.includes("json-feed:tag"));
});

test("subjectsFromJsonFeed: observedAt propagates to evidence", () => {
  const json = JSON.stringify({
    items: [{ url: "https://a.example/1", tags: ["Cycling"] }],
  });
  const subjects = subjectsFromJsonFeed(json, {
    observedAt: "2026-10-03T22:00:00.000Z",
  });
  assert.ok(subjects[0].evidence.length > 0);
});

// ─── subjectsFromFeeds ───────────────────────────────────────────────────────

const RSS_BODY = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>A post</title>
    <link>https://a.example/a-post</link>
    <category>Design</category>
  </item>
  <item>
    <title>Another post</title>
    <link>https://a.example/another-post</link>
    <category>Photography</category>
  </item>
</channel></rss>`;

const ATOM_BODY = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom post</title>
    <link href="https://b.example/atom-post" rel="alternate"/>
    <category term="IndieWeb"/>
  </entry>
</feed>`;

const JSON_FEED_BODY = JSON.stringify({
  version: "https://jsonfeed.org/version/1.1",
  items: [
    {
      id: "1",
      url: "https://c.example/post-1",
      title: "JSON post",
      tags: ["Maps"],
    },
  ],
});

test("subjectsFromFeeds: returns empty result for non-array feeds", async () => {
  const result = await subjectsFromFeeds(null);
  assert.deepEqual(result.subjects, []);
  assert.deepEqual(result.entryUrls, []);
});

test("subjectsFromFeeds: skips feeds with no url string", async () => {
  const result = await subjectsFromFeeds([{ type: "rss" }, null, { url: 123 }]);
  assert.deepEqual(result.subjects, []);
});

test("subjectsFromFeeds: processes RSS feed via mock fetch", async () => {
  const feedUrl = "https://a.example/rss.xml";
  const cache = dnsCache(["a.example"]);
  install();
  try {
    // External HTTP boundary — real fetch replaced by mock stub
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/rss+xml" }),
      arrayBuffer: async () => Buffer.from(RSS_BODY),
    });
    const result = await subjectsFromFeeds(
      [{ url: feedUrl, type: "rss" }],
      cache,
    );
    const slugs = result.subjects.map((s) => s.slug);
    assert.ok(slugs.includes("design"));
    assert.ok(slugs.includes("photography"));
    assert.ok(result.entryUrls.includes("https://a.example/a-post"));
  } finally {
    restore();
  }
});

test("subjectsFromFeeds: processes Atom feed via mock fetch", async () => {
  const feedUrl = "https://b.example/atom.xml";
  const cache = dnsCache(["b.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/atom+xml" }),
      arrayBuffer: async () => Buffer.from(ATOM_BODY),
    });
    const result = await subjectsFromFeeds([{ url: feedUrl }], cache);
    const slugs = result.subjects.map((s) => s.slug);
    assert.ok(slugs.includes("indieweb"));
  } finally {
    restore();
  }
});

test("subjectsFromFeeds: processes JSON Feed via mock fetch", async () => {
  const feedUrl = "https://c.example/feed.json";
  const cache = dnsCache(["c.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/feed+json" }),
      arrayBuffer: async () => Buffer.from(JSON_FEED_BODY),
    });
    const result = await subjectsFromFeeds(
      [{ url: feedUrl, type: "json" }],
      cache,
    );
    const slugs = result.subjects.map((s) => s.slug);
    assert.ok(slugs.includes("maps"));
    assert.ok(result.entryUrls.includes("https://c.example/post-1"));
  } finally {
    restore();
  }
});

test("subjectsFromFeeds: JSON body detected by trimmed content", async () => {
  const feedUrl = "https://d.example/feed";
  const cache = dnsCache(["d.example"]);
  install();
  try {
    // Content-type is generic but body starts with '{'
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      arrayBuffer: async () => Buffer.from(JSON_FEED_BODY),
    });
    const result = await subjectsFromFeeds([{ url: feedUrl }], cache);
    const slugs = result.subjects.map((s) => s.slug);
    assert.ok(slugs.includes("maps"));
  } finally {
    restore();
  }
});

test("subjectsFromFeeds: JSON body starts with { but is invalid JSON (entryUrls catch branch)", async () => {
  // The body starts with '{' → JSON path is selected. JSON.parse throws → catch fires.
  // External HTTP boundary — real fetch replaced by mock stub.
  const feedUrl = "https://e.example/feed";
  const cache = dnsCache(["e.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      arrayBuffer: async () => Buffer.from("{ this is not valid json }"),
    });
    const result = await subjectsFromFeeds([{ url: feedUrl }], cache);
    // entryUrls should be empty; no crash
    assert.deepEqual(result.entryUrls, []);
  } finally {
    restore();
  }
});

test("subjectsFromFeeds: failed fetch is skipped without crashing", async () => {
  const feedUrl = "https://bad.example/rss.xml";
  const cache = dnsCache(["bad.example"]);
  install();
  try {
    globalThis.fetch = async () => {
      throw new Error("simulated network error");
    };
    const result = await subjectsFromFeeds([{ url: feedUrl }], cache);
    assert.deepEqual(result.subjects, []);
  } finally {
    restore();
  }
});

test("subjectsFromFeeds: only first 3 feeds are processed", async () => {
  const feeds = Array.from({ length: 5 }, (_, i) => ({
    url: `https://f${i}.example/rss.xml`,
  }));
  const hostnames = feeds.map((f) => new URL(f.url).hostname);
  const cache = dnsCache(hostnames);
  let fetchCount = 0;
  install();
  try {
    globalThis.fetch = async () => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/rss+xml" }),
        arrayBuffer: async () => Buffer.from("<rss><channel></channel></rss>"),
      };
    };
    await subjectsFromFeeds(feeds, cache);
    assert.equal(fetchCount, 3);
  } finally {
    restore();
  }
});

test("subjectsFromFeeds: entryUrls are capped at 80", async () => {
  // Build a feed with 100 items
  const items = Array.from(
    { length: 100 },
    (_, i) =>
      `<item><link>https://a.example/post-${i}</link><category>AI</category></item>`,
  ).join("\n");
  const body = `<rss><channel>${items}</channel></rss>`;
  const feedUrl = "https://a.example/big.xml";
  const cache = dnsCache(["a.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/rss+xml" }),
      arrayBuffer: async () => Buffer.from(body),
    });
    const result = await subjectsFromFeeds([{ url: feedUrl }], cache);
    assert.ok(result.entryUrls.length <= 80);
  } finally {
    restore();
  }
});

// ─── Additional branch coverage ───────────────────────────────────────────────

test("subjectsFromRssOrAtom: empty category text and no term fires || '' (L38)", () => {
  // No term attribute + empty text → category[1]=undefined, category[3]=undefined,
  // category[2]="" → last || "" fires (L38 final false branch)
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title><![CDATA[Post]]></title>
        <link>https://a.example/post</link>
        <category></category>
      </item>
    </channel></rss>`;
  const subjects = subjectsFromRssOrAtom(xml);
  // Empty label → no slug → no subjects
  assert.deepEqual(subjects, []);
});

test("subjectsFromJsonFeed: item with non-array tags fires ': []' (L112)", () => {
  // item.tags = "design" is not an array → false branch (': []') fires → tags = []
  const json = JSON.stringify({
    items: [{ url: "https://a.example/1", tags: "not-an-array" }],
  });
  const subjects = subjectsFromJsonFeed(json);
  assert.deepEqual(subjects, []);
});

test("subjectsFromFeeds: JSON body with no items array fires ': []' (L203)", async () => {
  // json.items is missing → not an array → false branch (': []') fires → entryUrls = []
  const feedUrl = "https://a.example/feed.json";
  const cache = dnsCache(["a.example"]);
  install();
  try {
    globalThis.fetch = async (url) => {
      if (String(url).startsWith("https://a.example/feed.json")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          arrayBuffer: async () =>
            Buffer.from(
              JSON.stringify({ version: "https://jsonfeed.org/version/1.1" }),
            ), // no .items
        };
      }
      throw new Error(`mock-fetch: no handler for ${url}`);
    };
    const result = await subjectsFromFeeds([{ url: feedUrl }], cache);
    assert.deepEqual(result.subjects, []);
    assert.deepEqual(result.entryUrls, []);
  } finally {
    restore();
  }
});
