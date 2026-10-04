/**
 * Goal: 100% line/branch/function coverage for scripts/nlp/content.mjs.
 * All tests are offline — no network, no live data files as oracles.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  absoluteHttpsImageUrl,
  contentIdentityKey,
  contentItemsFromJsonFeed,
  contentItemsFromRssOrAtom,
  feedImageFromJsonItem,
  feedImageFromXml,
  joinContentWithPageSignals,
  mergeContentItems,
  plainTextSummary,
  siteOriginFromContentUrl,
} from "../../scripts/nlp/content.mjs";

// ─── contentIdentityKey ───────────────────────────────────────────────────────

test("contentIdentityKey: URL input → url: key with hash stripped", () => {
  const key = contentIdentityKey({ url: "https://a.example/post/#section" });
  assert.equal(key, "url:https://a.example/post/");
});

test("contentIdentityKey: URL only (no feed) is stable", () => {
  const a = contentIdentityKey({ url: "https://a.example/post/" });
  const b = contentIdentityKey({
    url: "https://a.example/post/",
    feed: "https://a.example/feed.xml",
  });
  assert.equal(a, b);
});

test("contentIdentityKey: invalid URL falls through to id:site branch", () => {
  const key = contentIdentityKey({
    url: "not-a-valid-url",
    id: "entry-123",
    siteOrigin: "https://a.example",
  });
  assert.equal(key, "id:https://a.example:entry-123");
});

test("contentIdentityKey: id with feed but no siteOrigin", () => {
  const key = contentIdentityKey({
    id: "entry-abc",
    feed: "https://a.example/feed.json",
  });
  assert.equal(key, "id:https://a.example/feed.json:entry-abc");
});

test("contentIdentityKey: id without site or feed → empty string", () => {
  const key = contentIdentityKey({ id: "orphan" });
  assert.equal(key, "");
});

test("contentIdentityKey: no url, no id → empty string", () => {
  assert.equal(contentIdentityKey({}), "");
  assert.equal(contentIdentityKey({ siteOrigin: "https://a.example" }), "");
});

// ─── plainTextSummary ─────────────────────────────────────────────────────────

test("plainTextSummary: non-string → empty string", () => {
  assert.equal(plainTextSummary(null), "");
  assert.equal(plainTextSummary(undefined), "");
  assert.equal(plainTextSummary(42), "");
  assert.equal(plainTextSummary(""), "");
});

test("plainTextSummary: CDATA is unwrapped", () => {
  assert.equal(plainTextSummary("<![CDATA[Hello World]]>"), "Hello World");
});

test("plainTextSummary: HTML tags are stripped", () => {
  const result = plainTextSummary("<p>Hello <em>world</em></p>");
  assert.ok(!result.includes("<"));
  assert.ok(result.includes("Hello"));
  assert.ok(result.includes("world"));
});

test("plainTextSummary: HTML entities are decoded", () => {
  const result = plainTextSummary("Hello &amp; world &lt;ok&gt;");
  assert.ok(result.includes("&"));
});

test("plainTextSummary: unclosed tag is removed", () => {
  // A string ending mid-tag should not leak angle bracket into output
  const result = plainTextSummary("Hello <a href=");
  assert.ok(!result.includes("<"));
});

// ─── absoluteHttpsImageUrl ────────────────────────────────────────────────────

test("absoluteHttpsImageUrl: empty or non-string → empty", () => {
  assert.equal(absoluteHttpsImageUrl(""), "");
  assert.equal(absoluteHttpsImageUrl(null), "");
  assert.equal(absoluteHttpsImageUrl("   "), "");
});

test("absoluteHttpsImageUrl: https URL without credentials → returned", () => {
  assert.equal(
    absoluteHttpsImageUrl("https://cdn.example/photo.jpg"),
    "https://cdn.example/photo.jpg",
  );
});

test("absoluteHttpsImageUrl: relative URL resolved with base", () => {
  assert.equal(
    absoluteHttpsImageUrl("/img/hero.jpg", "https://a.example/"),
    "https://a.example/img/hero.jpg",
  );
});

test("absoluteHttpsImageUrl: http (non-https) → empty", () => {
  assert.equal(absoluteHttpsImageUrl("http://a.example/photo.jpg"), "");
});

test("absoluteHttpsImageUrl: URL with credentials → empty", () => {
  assert.equal(
    absoluteHttpsImageUrl("https://user:pass@a.example/photo.jpg"),
    "",
  );
});

test("absoluteHttpsImageUrl: invalid URL → empty", () => {
  assert.equal(absoluteHttpsImageUrl("not a url at all"), "");
});

test("absoluteHttpsImageUrl: CDATA wrapper is unwrapped before parse", () => {
  assert.equal(
    absoluteHttpsImageUrl("<![CDATA[https://a.example/photo.jpg]]>"),
    "https://a.example/photo.jpg",
  );
});

// ─── feedImageFromXml ─────────────────────────────────────────────────────────

test("feedImageFromXml: empty or non-string → empty", () => {
  assert.equal(feedImageFromXml("", "https://a.example/rss.xml"), "");
  assert.equal(feedImageFromXml(null, "https://a.example/rss.xml"), "");
});

test("feedImageFromXml: enclosure with image/jpeg type", () => {
  const chunk = `<item><enclosure url="https://a.example/hero.jpg" type="image/jpeg" /></item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/hero.jpg",
  );
});

test("feedImageFromXml: enclosure with non-image type is skipped", () => {
  const chunk = `<item><enclosure url="https://a.example/podcast.mp3" type="audio/mpeg" /></item>`;
  assert.equal(feedImageFromXml(chunk, "https://a.example/rss.xml"), "");
});

test("feedImageFromXml: enclosure with http URL is rejected", () => {
  const chunk = `<item><enclosure url="http://a.example/hero.jpg" type="image/jpeg" /></item>`;
  assert.equal(feedImageFromXml(chunk, "https://a.example/rss.xml"), "");
});

test("feedImageFromXml: media:content with medium=image", () => {
  const chunk = `<item><media:content url="https://cdn.example/photo.png" medium="image" /></item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://cdn.example/photo.png",
  );
});

test("feedImageFromXml: media:content with medium=video is skipped", () => {
  const chunk = `<item><media:content url="https://cdn.example/clip.mp4" medium="video" /></item>`;
  assert.equal(feedImageFromXml(chunk, "https://a.example/rss.xml"), "");
});

test("feedImageFromXml: media:thumbnail with image URL", () => {
  const chunk = `<item><media:thumbnail url="https://cdn.example/thumb.jpg" /></item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://cdn.example/thumb.jpg",
  );
});

test("feedImageFromXml: itunes:image with href", () => {
  const chunk = `<item><itunes:image href="https://a.example/cover.jpg" /></item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/cover.jpg",
  );
});

test("feedImageFromXml: link rel=enclosure with image type", () => {
  const chunk = `<item><link rel="enclosure" type="image/png" href="https://a.example/img.png" /></item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/img.png",
  );
});

test("feedImageFromXml: link rel=image", () => {
  const chunk = `<item><link rel="image" href="https://a.example/cover.jpg" /></item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/cover.jpg",
  );
});

test("feedImageFromXml: link with unrelated rel is skipped", () => {
  const chunk = `<item><link rel="alternate" type="text/html" href="https://a.example/post" /></item>`;
  assert.equal(feedImageFromXml(chunk, "https://a.example/rss.xml"), "");
});

test("feedImageFromXml: img in description HTML", () => {
  const chunk = `<item><description>&lt;img src=&quot;https://a.example/photo.jpg&quot; /&gt;</description></item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/photo.jpg",
  );
});

test("feedImageFromXml: img in content:encoded", () => {
  const chunk = `<item><content:encoded><![CDATA[<img src="https://a.example/content.png" />]]></content:encoded></item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/content.png",
  );
});

// ─── feedImageFromJsonItem ────────────────────────────────────────────────────

test("feedImageFromJsonItem: null or non-object → empty", () => {
  assert.equal(feedImageFromJsonItem(null, "https://a.example/feed.json"), "");
  assert.equal(
    feedImageFromJsonItem("string", "https://a.example/feed.json"),
    "",
  );
});

test("feedImageFromJsonItem: image as string URL", () => {
  assert.equal(
    feedImageFromJsonItem(
      { image: "https://a.example/hero.jpg" },
      "https://a.example/feed.json",
    ),
    "https://a.example/hero.jpg",
  );
});

test("feedImageFromJsonItem: image as object with url property", () => {
  assert.equal(
    feedImageFromJsonItem(
      { image: { url: "https://a.example/hero.png" } },
      "https://a.example/feed.json",
    ),
    "https://a.example/hero.png",
  );
});

test("feedImageFromJsonItem: banner_image fallback", () => {
  assert.equal(
    feedImageFromJsonItem(
      { banner_image: "https://a.example/banner.jpg" },
      "https://a.example/feed.json",
    ),
    "https://a.example/banner.jpg",
  );
});

test("feedImageFromJsonItem: attachments with image mime_type", () => {
  assert.equal(
    feedImageFromJsonItem(
      {
        attachments: [
          { url: "https://a.example/photo.gif", mime_type: "image/gif" },
        ],
      },
      "https://a.example/feed.json",
    ),
    "https://a.example/photo.gif",
  );
});

test("feedImageFromJsonItem: attachment with non-image mime_type is skipped", () => {
  assert.equal(
    feedImageFromJsonItem(
      {
        attachments: [
          { url: "https://a.example/episode.mp3", mime_type: "audio/mpeg" },
        ],
      },
      "https://a.example/feed.json",
    ),
    "",
  );
});

test("feedImageFromJsonItem: null attachment in array is skipped", () => {
  // null item in attachments must not throw
  assert.equal(
    feedImageFromJsonItem(
      {
        attachments: [
          null,
          { url: "https://a.example/img.jpg", mime_type: "image/jpeg" },
        ],
      },
      "https://a.example/feed.json",
    ),
    "https://a.example/img.jpg",
  );
});

test("feedImageFromJsonItem: image in content_html", () => {
  assert.equal(
    feedImageFromJsonItem(
      {
        content_html: '<img src="https://a.example/inline.jpg" />',
      },
      "https://a.example/feed.json",
    ),
    "https://a.example/inline.jpg",
  );
});

test("feedImageFromJsonItem: http image rejected", () => {
  assert.equal(
    feedImageFromJsonItem(
      { image: "http://a.example/hero.jpg" },
      "https://a.example/feed.json",
    ),
    "",
  );
});

// ─── contentItemsFromRssOrAtom ───────────────────────────────────────────────

const RSS_META = {
  feedUrl: "https://a.example/rss.xml",
  feedKind: "rss",
  siteOrigin: "https://a.example",
  observedAt: "2026-10-03T22:00:00.000Z",
};

const ATOM_META = {
  feedUrl: "https://a.example/atom.xml",
  feedKind: "atom",
  siteOrigin: "https://a.example",
  observedAt: "2026-10-03T22:00:00.000Z",
};

test("contentItemsFromRssOrAtom: empty or non-string XML → empty array", () => {
  assert.deepEqual(contentItemsFromRssOrAtom("", RSS_META), []);
  assert.deepEqual(contentItemsFromRssOrAtom(null, RSS_META), []);
});

test("contentItemsFromRssOrAtom: RSS item with URL and category", () => {
  const xml = `<rss><channel>
    <item>
      <title><![CDATA[My Post]]></title>
      <link>https://a.example/my-post</link>
      <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
      <description>Some content</description>
      <category>Photography</category>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://a.example/my-post");
  assert.ok(items[0].title.includes("My Post"));
  assert.ok(items[0].published_at !== null);
  assert.ok(items[0].declared_topics.some((t) => t.slug === "photography"));
  assert.equal(items[0].source.kind, "rss");
});

test("contentItemsFromRssOrAtom: Atom entry with alternate link", () => {
  // Note: the content.mjs Atom category regex requires a text node or non-self-closing form.
  // Self-closing <category term="X"/> alone is not captured; use text-content form.
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <title>Atom Post</title>
      <link rel="alternate" href="https://a.example/atom-post"/>
      <published>2024-01-01T00:00:00Z</published>
      <summary>Atom summary</summary>
      <category term="IndieWeb">IndieWeb</category>
    </entry>
  </feed>`;
  const items = contentItemsFromRssOrAtom(xml, ATOM_META);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://a.example/atom-post");
  assert.equal(items[0].source.kind, "atom");
  assert.ok(items[0].declared_topics.some((t) => t.slug === "indieweb"));
});

test("contentItemsFromRssOrAtom: Atom with only href link (no rel)", () => {
  const xml = `<feed>
    <entry>
      <title>Post</title>
      <link href="https://a.example/post"/>
      <updated>2024-06-01T00:00:00Z</updated>
    </entry>
  </feed>`;
  const items = contentItemsFromRssOrAtom(xml, ATOM_META);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://a.example/post");
  // updated is used as published_at when published is absent
  assert.ok(items[0].published_at !== null);
});

test("contentItemsFromRssOrAtom: item without a URL → skipped (no identity)", () => {
  const xml = `<rss><channel>
    <item><title>No link</title></item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  // No link and no id → contentIdentityKey returns '' → skipped
  assert.equal(items.length, 0);
});

test("contentItemsFromRssOrAtom: GUID fallback identity", () => {
  const xml = `<rss><channel>
    <item>
      <guid>urn:uuid:abc123</guid>
      <title>Guid post</title>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  // Has a guid+siteOrigin → identity key is id:siteOrigin:guid
  assert.equal(items.length, 1);
});

test("contentItemsFromRssOrAtom: RSS category as text content", () => {
  const xml = `<rss><channel>
    <item>
      <link>https://a.example/p</link>
      <category>Books</category>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  assert.ok(items[0].declared_topics.some((t) => t.slug === "books"));
});

test("contentItemsFromRssOrAtom: image from enclosure", () => {
  const xml = `<rss><channel>
    <item>
      <link>https://a.example/p</link>
      <enclosure url="https://a.example/photo.jpg" type="image/jpeg" />
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  assert.equal(items[0].image, "https://a.example/photo.jpg");
});

test("contentItemsFromRssOrAtom: invalid link URL is handled gracefully", () => {
  const xml = `<rss><channel>
    <item>
      <link>not-a-valid-url-at-all</link>
      <guid>my-guid-123</guid>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  // URL resolution fails → absoluteUrl = '' → uses id-based key
  assert.ok(Array.isArray(items));
});

// ─── contentItemsFromJsonFeed ─────────────────────────────────────────────────

const JSON_META = {
  feedUrl: "https://a.example/feed.json",
  siteOrigin: "https://a.example",
  observedAt: "2026-10-03T22:00:00.000Z",
};

test("contentItemsFromJsonFeed: invalid JSON → empty array", () => {
  assert.deepEqual(contentItemsFromJsonFeed("not json", JSON_META), []);
});

test("contentItemsFromJsonFeed: item with url and tags", () => {
  const json = JSON.stringify({
    language: "en",
    items: [
      {
        id: "1",
        url: "https://a.example/post-1",
        title: "Post One",
        date_published: "2024-01-01T00:00:00Z",
        date_modified: "2024-02-01T00:00:00Z",
        summary: "A short summary",
        tags: ["Photography", "Travel"],
      },
    ],
  });
  const items = contentItemsFromJsonFeed(json, JSON_META);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://a.example/post-1");
  assert.equal(items[0].language, "en");
  assert.ok(items[0].published_at !== null);
  assert.ok(items[0].updated_at !== null);
  assert.ok(items[0].declared_topics.some((t) => t.slug === "photography"));
  assert.ok(items[0].declared_topics.some((t) => t.slug === "travel"));
  assert.equal(items[0].source.kind, "json-feed");
});

test("contentItemsFromJsonFeed: item with external_url when no url", () => {
  const json = JSON.stringify({
    items: [
      {
        id: "ext-1",
        external_url: "https://a.example/external",
        title: "External post",
      },
    ],
  });
  const items = contentItemsFromJsonFeed(json, JSON_META);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://a.example/external");
});

test("contentItemsFromJsonFeed: item without url or id → skipped", () => {
  const json = JSON.stringify({
    items: [{ title: "No identity" }],
  });
  const items = contentItemsFromJsonFeed(json, JSON_META);
  // No url and no id → contentIdentityKey returns '' → skipped
  assert.equal(items.length, 0);
});

test("contentItemsFromJsonFeed: null item in array is skipped", () => {
  const json = JSON.stringify({
    items: [null, { id: "1", url: "https://a.example/p", title: "P" }],
  });
  const items = contentItemsFromJsonFeed(json, JSON_META);
  assert.equal(items.length, 1);
});

test("contentItemsFromJsonFeed: invalid date fields produce null timestamps", () => {
  const json = JSON.stringify({
    items: [
      {
        id: "1",
        url: "https://a.example/p",
        title: "P",
        date_published: null,
        date_modified: null,
      },
    ],
  });
  const items = contentItemsFromJsonFeed(json, JSON_META);
  assert.equal(items[0].published_at, null);
  assert.equal(items[0].updated_at, null);
});

test("contentItemsFromJsonFeed: image from item.image field", () => {
  const json = JSON.stringify({
    items: [
      {
        id: "1",
        url: "https://a.example/p",
        title: "P",
        image: "https://a.example/hero.jpg",
      },
    ],
  });
  const items = contentItemsFromJsonFeed(json, JSON_META);
  assert.equal(items[0].image, "https://a.example/hero.jpg");
});

// ─── mergeContentItems ────────────────────────────────────────────────────────

test("mergeContentItems: empty or null → empty array", () => {
  assert.deepEqual(mergeContentItems([]), []);
  assert.deepEqual(mergeContentItems(null), []);
});

test("mergeContentItems: item without identity string is skipped", () => {
  const items = mergeContentItems([
    {
      identity: 42,
      url: "https://a.example/p",
      source_feeds: [],
      declared_topics: [],
    },
    {
      identity: "url:https://a.example/p",
      url: "https://a.example/p",
      source_feeds: [],
      declared_topics: [],
    },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].identity, "url:https://a.example/p");
});

test("mergeContentItems: cross-feed deduplication unions source_feeds", () => {
  const keyA = "url:https://a.example/post/";
  const merged = mergeContentItems([
    {
      identity: keyA,
      url: "https://a.example/post/",
      title: "Post",
      source_feeds: [{ type: "rss", url: "https://a.example/rss.xml" }],
      declared_topics: [{ slug: "go", source: "rss:category" }],
    },
    {
      identity: keyA,
      url: "https://a.example/post/",
      title: "Post",
      source_feeds: [{ type: "json-feed", url: "https://a.example/feed.json" }],
      declared_topics: [{ slug: "go", source: "rss:category" }],
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source_feeds.length, 2);
  // Duplicate topic is not added again
  assert.equal(merged[0].declared_topics.length, 1);
});

test("mergeContentItems: new topic from second draft is added", () => {
  const key = "url:https://a.example/post/";
  const merged = mergeContentItems([
    {
      identity: key,
      url: "https://a.example/post/",
      source_feeds: [],
      declared_topics: [{ slug: "go", source: "rss:category" }],
    },
    {
      identity: key,
      url: "https://a.example/post/",
      source_feeds: [],
      declared_topics: [{ slug: "rust", source: "json-feed:tag" }],
    },
  ]);
  assert.equal(merged[0].declared_topics.length, 2);
});

test("mergeContentItems: url and published_at filled from second if first is null", () => {
  const key = "id:https://a.example/feed.json:entry-1";
  const merged = mergeContentItems([
    {
      identity: key,
      url: null,
      published_at: null,
      image: null,
      source_feeds: [],
      declared_topics: [],
    },
    {
      identity: key,
      url: "https://a.example/post/",
      published_at: "2024-01-01T00:00:00.000Z",
      image: "https://a.example/photo.jpg",
      source_feeds: [],
      declared_topics: [],
    },
  ]);
  assert.equal(merged[0].url, "https://a.example/post/");
  assert.equal(merged[0].published_at, "2024-01-01T00:00:00.000Z");
  assert.equal(merged[0].image, "https://a.example/photo.jpg");
});

test("mergeContentItems: results are sorted by url then title", () => {
  const merged = mergeContentItems([
    {
      identity: "url:https://b.example/",
      url: "https://b.example/",
      source_feeds: [],
      declared_topics: [],
    },
    {
      identity: "url:https://a.example/",
      url: "https://a.example/",
      source_feeds: [],
      declared_topics: [],
    },
  ]);
  assert.equal(merged[0].url, "https://a.example/");
  assert.equal(merged[1].url, "https://b.example/");
});

// ─── joinContentWithPageSignals ───────────────────────────────────────────────

test("joinContentWithPageSignals: joins language and page_role", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/post/",
        url: "https://a.example/post/",
        language: null,
        summary: "<p>Hello</p>",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [
          { url: "https://a.example/post/", lang: "en", page_role: "article" },
        ],
        declared_topics: [],
      },
    ],
  );
  assert.equal(joined[0].language, "en");
  assert.equal(joined[0].page_role, "article");
  assert.equal(joined[0].summary, "Hello");
});

test("joinContentWithPageSignals: does not overwrite existing language", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/p/",
        url: "https://a.example/p/",
        language: "fr",
        summary: "",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [
          { url: "https://a.example/p/", lang: "en", page_role: "article" },
        ],
        declared_topics: [],
      },
    ],
  );
  assert.equal(joined[0].language, "fr");
});

test("joinContentWithPageSignals: handles null or missing originSignals", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/",
        url: "https://a.example/",
        declared_topics: [],
      },
    ],
    null,
  );
  assert.equal(joined.length, 1);
});

test("joinContentWithPageSignals: items with no url skip page lookup", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "id:https://a.example/feed.json:entry-1",
        url: null,
        declared_topics: [],
      },
    ],
    [
      {
        pages: [{ url: "https://a.example/post/", lang: "en" }],
        declared_topics: [],
      },
    ],
  );
  // No url → can't join page signals
  assert.equal(joined[0].language, undefined);
});

test("joinContentWithPageSignals: declared topics from page evidence joined", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/post/",
        url: "https://a.example/post/",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [],
        declared_topics: [
          {
            slug: "radio",
            label: "Radio",
            evidence: [
              {
                class: "declared",
                source: "microformat:p-category",
                page: "https://a.example/post/",
                community_eligible: true,
                raw_value: "Radio",
              },
            ],
          },
        ],
      },
    ],
  );
  assert.ok(joined[0].declared_topics.some((t) => t.slug === "radio"));
});

test("joinContentWithPageSignals: non-community-eligible evidence excluded", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/post/",
        url: "https://a.example/post/",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [],
        declared_topics: [
          {
            slug: "radio",
            label: "Radio",
            evidence: [
              {
                class: "heuristic",
                source: "visible-text",
                page: "https://a.example/post/",
                community_eligible: false,
              },
            ],
          },
        ],
      },
    ],
  );
  // Not community_eligible → not joined
  assert.equal(joined[0].declared_topics.length, 0);
});

test("joinContentWithPageSignals: page with invalid URL in evidence is skipped", () => {
  // canonicalPageUrl catches URL parse errors gracefully
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/p/",
        url: "https://a.example/p/",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [{ url: "not-a-valid-url", lang: "en" }],
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            evidence: [
              {
                class: "declared",
                source: "microformat:p-category",
                page: "not-a-valid-url",
                community_eligible: true,
              },
            ],
          },
        ],
      },
    ],
  );
  assert.equal(joined[0].declared_topics.length, 0);
});

// ─── siteOriginFromContentUrl ─────────────────────────────────────────────────

test("siteOriginFromContentUrl: valid https URL → origin", () => {
  assert.equal(
    siteOriginFromContentUrl("https://a.example/post/slug"),
    "https://a.example",
  );
});

test("siteOriginFromContentUrl: invalid URL → empty string", () => {
  assert.equal(siteOriginFromContentUrl("not-a-url"), "");
});

test("siteOriginFromContentUrl: empty string → empty string", () => {
  assert.equal(siteOriginFromContentUrl(""), "");
});

// ─── contentItemsFromRssOrAtom: invalid link URL (catch branch) ───────────────

test("contentItemsFromRssOrAtom: item link that throws URL resolution → absoluteUrl empty (catch)", () => {
  // link = "http://" is structurally invalid → new URL('http://', base) throws → catch fires
  const xml = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Bad link</title>
    <link>http://</link>
    <guid>urn:guid:1</guid>
    <category>Photography</category>
  </item>
</channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, {
    feedUrl: "https://a.example/feed.xml",
    siteOrigin: "https://a.example",
  });
  // item has no valid url → still returns an array (identity via guid)
  assert.ok(Array.isArray(items));
});

// ─── contentItemsFromJsonFeed: invalid url (catch branch) ─────────────────────

test("contentItemsFromJsonFeed: item with invalid url → absoluteUrl empty (catch branch)", () => {
  // "http://" throws in new URL(..., base) → catch fires (lines 426-427)
  const json = JSON.stringify({
    items: [{ id: "1", url: "http://", title: "Bad URL" }],
  });
  const items = contentItemsFromJsonFeed(json, {
    feedUrl: "https://a.example/feed.json",
    siteOrigin: "https://a.example",
  });
  assert.ok(Array.isArray(items));
});

// ─── joinContentWithPageSignals: page without url is skipped ─────────────────

test("joinContentWithPageSignals: origin page with empty url is skipped (line 595-596)", () => {
  const items = [
    {
      url: "https://a.example/post",
      site_origin: "https://a.example",
      declared_topics: [],
    },
  ];
  const joined = joinContentWithPageSignals(items, [
    {
      origin: "https://a.example",
      pages: [
        { url: "", lang: "en", page_role: "article" }, // empty url → skipped
        { title: "No URL" }, // url field absent → skipped
        null, // null page → skipped
        { url: "https://a.example/post", lang: "en", page_role: "article" },
      ],
    },
  ]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].language, "en");
});

// ─── Additional branch coverage ───────────────────────────────────────────────

// feedImageFromXml: enclosure with no attributes fires match[1] || "" (L121)
test("feedImageFromXml: enclosure with no attributes fires L121 || ''", () => {
  // <enclosure> (no slash, no attrs) → ([^>]*) captures "" → "" || "" fires (L121)
  const chunk = `<enclosure>`;
  assert.equal(feedImageFromXml(chunk, "https://a.example/rss.xml"), "");
});

// feedImageFromXml: enclosure with url but no type fires L122 || ""
test("feedImageFromXml: enclosure url only (no type attr) fires L122 || ''", () => {
  // attrs has url but no type → type regex doesn't match → ?.[1] = undefined → undefined || "" fires (L122)
  const chunk = `<enclosure url="https://a.example/img.jpg"/>`;
  // looksLikeFeedImage(".jpg", "") falls through to extension check → true
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/img.jpg",
  );
});

// feedImageFromXml: media:content with no attributes fires L136 || ""
test("feedImageFromXml: media:content with no attrs fires L136 || ''", () => {
  // <media:content> (no slash, no attrs) → match[1] = "" → "" || "" fires (L136); abs = "" → !abs → continue
  const chunk = `<media:content>`;
  assert.equal(feedImageFromXml(chunk, "https://a.example/rss.xml"), "");
});

// feedImageFromXml: media:content without type attr fires L138 ?.[1]
test("feedImageFromXml: media:content url but no type fires L138 ?.[1]", () => {
  // type regex doesn't match → ?.[1] = undefined → undefined || "" fires (L138 null side of ?.)
  const chunk = `<media:content url="https://a.example/thumb.jpg">`;
  // looksLikeFeedImage(.jpg, "") → extension check → true
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/thumb.jpg",
  );
});

// feedImageFromXml: media:content WITH type attr fires L138 positive ?.[1] branch
test("feedImageFromXml: media:content with type fires L138 ?.[1] positive branch", () => {
  // type regex matches → match non-null → ?.[1] access fires (L138 positive)
  const chunk = `<media:content url="https://a.example/photo.jpg" type="image/jpeg">`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/photo.jpg",
  );
});

// feedImageFromXml: medium=image fires L148 || medium === "image"
test("feedImageFromXml: media:content medium=image fires L148 || medium === 'image'", () => {
  // looksLikeFeedImage("https://a.example/data", "") = false (no image extension, no image/ type)
  // but medium === "image" → || fires (L148)
  const chunk = `<media:content url="https://a.example/data" medium="image"/>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/data",
  );
});

// feedImageFromJsonItem: non-string mime_type fires ': ""' (L234)
test("feedImageFromJsonItem: attachment with non-string mime_type fires ': \"\"' (L234)", () => {
  // attachment.mime_type = 42 (not string) → ternary false branch (': ""') fires (L234)
  const item = {
    attachments: [
      { url: "https://a.example/img.jpg", mime_type: 42 }, // non-string mime_type
    ],
  };
  // looksLikeFeedImage(url, "") → .jpg extension → true → returns abs
  const result = feedImageFromJsonItem(item, "https://a.example/feed.json");
  assert.equal(result, "https://a.example/img.jpg");
});

// contentItemsFromRssOrAtom: Atom entry with link href (no rel) fires L290 || ""
test("contentItemsFromRssOrAtom: Atom entry without rel=alternate link fires L290", () => {
  // No rel=alternate → first regex fails; generic href fires → L290 right branch
  const xml = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Test Feed</title>
      <entry>
        <title>Entry 1</title>
        <link href="https://a.example/entry-1"/>
        <id>entry-1</id>
      </entry>
    </feed>`;
  const items = contentItemsFromRssOrAtom(xml, {
    feedUrl: "https://a.example/atom.xml",
    siteOrigin: "https://a.example",
    observedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(items.length >= 1);
});

// contentItemsFromRssOrAtom: entry with guid but no id fires L300 ?.[1]
test("contentItemsFromRssOrAtom: RSS entry with guid (no id) fires L300 ?.[1]", () => {
  // No <id> → first regex fails → <guid> regex fires → L300 second ?.[1]
  const xml = `<?xml version="1.0"?>
    <rss version="2.0"><channel>
      <title>Feed</title>
      <item>
        <title>Post</title>
        <link>https://a.example/post</link>
        <guid>https://a.example/post#guid</guid>
      </item>
    </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, {
    feedUrl: "https://a.example/rss.xml",
    siteOrigin: "https://a.example",
    observedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(items.length >= 1);
});

// contentItemsFromRssOrAtom: entry with no title fires L374 || slugify || "Untitled"
test("contentItemsFromRssOrAtom: entry without title fires L374 || slugify || 'Untitled'", () => {
  // No title → L374: "" || slugifyTopic(url) fires
  const xml = `<?xml version="1.0"?>
    <rss version="2.0"><channel>
      <title>Feed</title>
      <item>
        <link>https://a.example/my-post</link>
      </item>
    </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, {
    feedUrl: "https://a.example/rss.xml",
    siteOrigin: "https://a.example",
    observedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(items.length >= 1);
  // title derived from slugifying the URL path "my-post"
  assert.match(items[0].title, /my.post|Untitled/i);
});

// contentItemsFromRssOrAtom: entry with no title AND no URL fires "Untitled" (L374 last || "Untitled")
test("contentItemsFromRssOrAtom: entry with no title and no URL fires L374 last || 'Untitled'", () => {
  // No title + no link → L374: "" || slugifyTopic("") → "" || "Untitled" fires
  const xml = `<?xml version="1.0"?>
    <rss version="2.0"><channel>
      <title>Feed</title>
      <item>
        <guid>urn:uuid:abc123</guid>
      </item>
    </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, {
    feedUrl: "https://a.example/rss.xml",
    siteOrigin: "https://a.example",
    observedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(items.length >= 1);
  assert.equal(items[0].title, "Untitled");
});

// contentItemsFromJsonFeed: non-array items fires ': []' (L406)
test("contentItemsFromJsonFeed: data without items array fires ': []' (L406)", () => {
  // data.items is absent → not an array → ': []' fires (L406)
  const items = contentItemsFromJsonFeed(JSON.stringify({ version: "1.1" }), {
    feedUrl: "https://a.example/feed.json",
    siteOrigin: "https://a.example",
    observedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.deepEqual(items, []);
});

// contentItemsFromJsonFeed: item without title fires || "Untitled" (L470)
test("contentItemsFromJsonFeed: item without title fires || 'Untitled' (L470)", () => {
  // item.title is absent → String(undefined || "Untitled") → "Untitled"
  const items = contentItemsFromJsonFeed(
    JSON.stringify({ items: [{ url: "https://a.example/p" }] }),
    {
      feedUrl: "https://a.example/feed.json",
      siteOrigin: "https://a.example",
      observedAt: "2026-01-01T00:00:00.000Z",
    },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Untitled");
});

// contentItemsFromJsonFeed: item without url fires || meta.feedUrl (L448)
test("contentItemsFromJsonFeed: item without url in evidence fires || meta.feedUrl (L448)", () => {
  // absoluteUrl is "" (no url/external_url) but has id → key is non-empty → passes guard
  // L448 page = "" || meta.feedUrl fires
  const items = contentItemsFromJsonFeed(
    JSON.stringify({
      items: [{ id: "post-1", title: "No URL", tags: ["Design"] }],
    }),
    {
      feedUrl: "https://a.example/feed.json",
      siteOrigin: "https://a.example",
      observedAt: "2026-01-01T00:00:00.000Z",
    },
  );
  assert.ok(items.length >= 1);
  // The declared topic page should default to feedUrl
});

// mergeContentItems: draft without source_feeds/declared_topics fires || [] (L510-511)
test("mergeContentItems: draft without source_feeds fires || [] (L510-L511)", () => {
  // draft has no source_feeds → L510: [...(undefined || [])] fires
  // draft has no declared_topics → L511: [...(undefined || [])] fires
  const drafts = [
    {
      identity: "url:https://a.example/post",
      url: "https://a.example/post",
      title: "Post",
    },
  ];
  const result = mergeContentItems(drafts);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].source_feeds, []);
  assert.deepEqual(result[0].declared_topics, []);
});

// mergeContentItems: existing without source_feeds fires || [] (L517, L520)
// and draft without source_feeds fires || [] (L520) in merge path
test("mergeContentItems: existing+draft without arrays fires || [] in merge path (L517-L535)", () => {
  // Two drafts with same identity → merge path fires
  // Neither has source_feeds/declared_topics → || [] fires multiple times
  const drafts = [
    {
      identity: "url:https://a.example/post",
      url: "https://a.example/post",
      title: "Post",
    },
    {
      identity: "url:https://a.example/post",
      url: "https://a.example/post",
      title: "Post v2",
    },
  ];
  const result = mergeContentItems(drafts);
  assert.equal(result.length, 1);
});

// mergeContentItems: items without url/title fires || "" in sort (L556-557)
test("mergeContentItems: items without url/title fires || '' in sort (L556-L557)", () => {
  // left.url = null, left.title = null → null || null || "" fires at L556
  const drafts = [
    { identity: "id:abc", url: null, title: null },
    { identity: "id:def", url: null, title: null },
  ];
  const result = mergeContentItems(drafts);
  assert.equal(result.length, 2);
});

// joinContentWithPageSignals: null originSignals fires || [] (L593)
test("joinContentWithPageSignals: null originSignals fires || [] (L639)", () => {
  // items = null → (null || []).map(...) fires L639 || []
  const joined = joinContentWithPageSignals(null, []);
  assert.deepEqual(joined, []);
});

// joinContentWithPageSignals: item without declared_topics fires || [] (L645)
test("joinContentWithPageSignals: item without declared_topics fires || [] (L645)", () => {
  // item has no declared_topics → L645: (undefined || []).map(...) fires
  const items = [{ url: "https://a.example/post", title: "Post" }];
  const joined = joinContentWithPageSignals(items, []);
  assert.equal(joined.length, 1);
});

// joinContentWithPageSignals: origin without pages fires || [] (L594)
test("joinContentWithPageSignals: origin without pages fires || [] (L594)", () => {
  // origin has no .pages → L594: (undefined || []) fires
  const items = [{ url: "https://a.example/post", declared_topics: [] }];
  const joined = joinContentWithPageSignals(items, [
    { origin: "https://a.example" }, // no .pages
  ]);
  assert.equal(joined.length, 1);
});

// joinContentWithPageSignals: topic without evidence array fires || [] (L610)
test("joinContentWithPageSignals: topic without evidence array fires || [] (L610)", () => {
  // origin has declared_topics with a topic that has no .evidence → L610: (undefined || []) fires
  const items = [{ url: "https://a.example/post", declared_topics: [] }];
  const joined = joinContentWithPageSignals(items, [
    {
      origin: "https://a.example",
      pages: [],
      declared_topics: [
        { slug: "design", label: "Design" }, // no .evidence field → L610 || [] fires
      ],
    },
  ]);
  assert.equal(joined.length, 1);
});

// joinContentWithPageSignals: item.raw_value missing fires || topic.label (L630)
test("joinContentWithPageSignals: missing raw_value fires || topic.label (L630)", () => {
  // evidence item with no raw_value → L630: undefined || topic.label fires
  const items = [{ url: "https://a.example/post", declared_topics: [] }];
  const joined = joinContentWithPageSignals(items, [
    {
      origin: "https://a.example",
      pages: [{ url: "https://a.example/post" }],
      declared_topics: [
        {
          slug: "design",
          label: "Design",
          evidence: [
            {
              community_eligible: true,
              class: "declared",
              page: "https://a.example/post",
              source: "html:rel",
              // no raw_value → L630 fires
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].declared_topics.length, 1);
  assert.equal(joined[0].declared_topics[0].raw_value, "Design");
});

// joinContentWithPageSignals: topic.source missing fires || "" (L659)
test("joinContentWithPageSignals: topic without source fires || '' (L659)", () => {
  // pageTopics has item with no source → L659: "" || "" fires
  const items = [{ url: "https://a.example/post", declared_topics: [] }];
  const joined = joinContentWithPageSignals(items, [
    {
      origin: "https://a.example",
      pages: [],
      declared_topics: [
        {
          slug: "design",
          label: "Design",
          evidence: [
            {
              community_eligible: true,
              class: "declared",
              page: "https://a.example/post",
              raw_value: "Design",
              // no source → L659 fires
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].declared_topics[0].slug, "design");
});

// joinContentWithPageSignals: next.declared_topics missing fires || [] (L662)
test("joinContentWithPageSignals: item with missing declared_topics fires || [] (L662)", () => {
  // item has no declared_topics → topicKey built from [] → pageTopics added → L662 fires
  const items = [{ url: "https://a.example/post", title: "Post" }]; // no declared_topics
  const joined = joinContentWithPageSignals(items, [
    {
      origin: "https://a.example",
      pages: [],
      declared_topics: [
        {
          slug: "design",
          label: "Design",
          evidence: [
            {
              community_eligible: true,
              class: "declared",
              page: "https://a.example/post",
              raw_value: "Design",
              source: "html:rel",
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].declared_topics.length, 1);
});

// ─── feedImageFromXml: enclosure with no attributes fires || "" (L121-122) ───

test("feedImageFromXml: enclosure with no attributes fires attrs || '' (lines 121-122)", () => {
  // <enclosure> (no slash, no attrs) → match[1]="" → "" || "" fires L121; no type → type="" fires L122
  const xml = `<entry>
    <enclosure>
    <enclosure url="https://a.example/img.jpg" type="image/jpeg"/>
  </entry>`;
  const result = feedImageFromXml(xml, "https://a.example/feed.xml");
  assert.equal(result, "https://a.example/img.jpg");
});

// ─── contentItemsFromRssOrAtom: Atom link fallback (L290) ────────────────────

test("contentItemsFromRssOrAtom: Atom link without rel=alternate falls back to plain href (L290)", () => {
  // First pattern (rel=alternate) doesn't match → falls through to second href pattern (L290)
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Photography</title>
    <link href="https://a.example/photography/"/>
    <id>urn:uuid:1</id>
  </entry>
</feed>`;
  const items = contentItemsFromRssOrAtom(xml, {
    feedUrl: "https://a.example/feed.atom",
    feedKind: "atom",
    siteOrigin: "https://a.example",
    observedAt: "",
  });
  assert.ok(Array.isArray(items));
  assert.ok(items.length > 0);
  assert.equal(items[0].url, "https://a.example/photography/");
});

// ─── contentItemsFromRssOrAtom: RSS item guid fallback (L300) ────────────────

test("contentItemsFromRssOrAtom: RSS item without <id> uses <guid> (lines 300-301)", () => {
  // chunk.match(/<id.../)?.[1] is undefined → || fires → tries guid (L300-301)
  const xml = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Photography</title>
    <link>https://a.example/p/</link>
    <guid>https://a.example/p/</guid>
  </item>
</channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, {
    feedUrl: "https://a.example/feed.xml",
    siteOrigin: "https://a.example",
    observedAt: "",
  });
  assert.ok(items.length > 0);
});

// ─── contentItemsFromRssOrAtom: RSS empty category fires || "" fallback (L321) ─

test("contentItemsFromRssOrAtom: RSS empty category fires catMatch[1]||catMatch[2]||'' fallback (L321)", () => {
  // <category></category> → catMatch[1]="" (falsy), catMatch[2]=undefined → "" fires
  const xml = `<rss><channel>
    <item>
      <title>Empty cat</title>
      <link>https://a.example/empty-cat</link>
      <category></category>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  assert.ok(items.length > 0);
  // Empty category normalizes to "" and is skipped (raw is falsy after normalizeExtractedText)
  assert.deepEqual(items[0].declared_topics, []);
});

// ─── contentItemsFromRssOrAtom: Atom category body text (L321) ───────────────

test("contentItemsFromRssOrAtom: Atom category with body text uses catMatch[2] (L321)", () => {
  // Atom <category>Text</category> without term= attribute → catMatch[1]=undefined → || catMatch[2]
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Photography post</title>
    <link href="https://a.example/p/"/>
    <id>urn:uuid:2</id>
    <category>Photography</category>
  </entry>
</feed>`;
  const items = contentItemsFromRssOrAtom(xml, {
    feedUrl: "https://a.example/feed.atom",
    feedKind: "atom",
    siteOrigin: "https://a.example",
    observedAt: "",
  });
  assert.ok(items.length > 0);
  assert.ok(items[0].declared_topics.some((t) => t.slug === "photography"));
});

// ─── contentItemsFromJsonFeed: data.items is not an array (L406) ─────────────

test("contentItemsFromJsonFeed: non-array data.items fires false branch (L406)", () => {
  // data.items = "not-array" → Array.isArray() = false → items = [] → L406 false branch
  const json = JSON.stringify({ items: "not-array" });
  const items = contentItemsFromJsonFeed(json, {
    feedUrl: "https://a.example/feed.json",
    siteOrigin: "https://a.example",
    observedAt: "",
  });
  assert.deepEqual(items, []);
});

// ─── mergeContentItems: draft without source_feeds or declared_topics (L510-511) ─

test("mergeContentItems: draft without source_feeds or declared_topics fires || [] (lines 510-511)", () => {
  // draft has no source_feeds or declared_topics → ... || [] fires L510-511
  const draft = {
    identity: "url:https://a.example/p/",
    url: "https://a.example/p/",
    title: "Photography",
  };
  const result = mergeContentItems([draft]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].source_feeds, []);
  assert.deepEqual(result[0].declared_topics, []);
});

// ─── mergeContentItems: sort with null url uses title (L556-557) ─────────────

test("mergeContentItems: items with null url sort by title fallback (lines 556-557)", () => {
  // url=null → left.url || left.title || "" fires L556-557
  const a = {
    identity: "url:null:1",
    url: null,
    title: "Zebra",
    source_feeds: [],
    declared_topics: [],
  };
  const b = {
    identity: "url:null:2",
    url: null,
    title: "Alpha",
    source_feeds: [],
    declared_topics: [],
  };
  const result = mergeContentItems([a, b]);
  assert.equal(result.length, 2);
  // Alpha sorts before Zebra
  assert.equal(result[0].title, "Alpha");
  assert.equal(result[1].title, "Zebra");
});

// ─── joinContentWithPageSignals: non-empty declared_topics fires anon fn (L645-647) ─

test("joinContentWithPageSignals: item with existing declared_topics fires map callback (lines 645-647)", () => {
  // item has declared_topics → the .map() callback at L645 fires to build topicKey
  const items = [
    {
      identity: "url:https://a.example/p/",
      url: "https://a.example/p/",
      declared_topics: [{ slug: "photography", source: "rss:category" }],
    },
  ];
  const joined = joinContentWithPageSignals(items, [
    {
      pages: [{ url: "https://a.example/p/", lang: "en" }],
      declared_topics: [
        {
          slug: "travel",
          label: "Travel",
          evidence: [
            {
              class: "declared",
              source: "atom:category",
              page: "https://a.example/p/",
              community_eligible: true,
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(joined.length, 1);
  // "travel" is new → added; "photography" is pre-existing → not duplicated
  assert.ok(joined[0].declared_topics.some((t) => t.slug === "travel"));
  assert.ok(joined[0].declared_topics.some((t) => t.slug === "photography"));
});

// ─── joinContentWithPageSignals: evidence with no raw_value fires || topic.label (L630) ─

test("joinContentWithPageSignals: evidence item without raw_value uses topic.label (L630)", () => {
  // evidence item has no raw_value → item.raw_value || topic.label fires L630
  const items = [
    {
      identity: "url:https://a.example/p/",
      url: "https://a.example/p/",
      declared_topics: [],
    },
  ];
  const joined = joinContentWithPageSignals(items, [
    {
      pages: [],
      declared_topics: [
        {
          slug: "photography",
          label: "Photography",
          evidence: [
            {
              class: "declared",
              source: "atom:category",
              page: "https://a.example/p/",
              community_eligible: true,
              // no raw_value → fires L630
            },
          ],
        },
      ],
    },
  ]);
  assert.equal(joined.length, 1);
  const topic = joined[0].declared_topics.find((t) => t.slug === "photography");
  assert.ok(topic);
  assert.equal(topic.raw_value, "Photography"); // uses topic.label
});

// ─── joinContentWithPageSignals: null item.url fires ternary false (L639) ────

test("joinContentWithPageSignals: item with non-string url fires ternary false (L639)", () => {
  // typeof item.url === "string" is false → key = "" → L639 false branch fires
  const items = [{ identity: "url:null:x", url: null, declared_topics: [] }];
  const joined = joinContentWithPageSignals(items, [
    {
      pages: [{ url: "https://a.example/p/", lang: "en" }],
      declared_topics: [],
    },
  ]);
  assert.equal(joined.length, 1);
  // key="" → no page lookup → language stays null/undefined
  assert.ok(!joined[0].language);
});

// ─── joinContentWithPageSignals: item declared_topics with no source fires || "" (L646) ───

test("joinContentWithPageSignals: item declared_topic without source fires || '' (L646)", () => {
  // item already has a declared_topic with no source → String(topic.source || '') at L646 fires
  const items = [
    {
      url: "https://a.example/post",
      declared_topics: [
        { slug: "design", label: "Design" }, // no source → L646 fires
      ],
    },
  ];
  const joined = joinContentWithPageSignals(items, []);
  assert.equal(joined.length, 1);
});

// ─── contentItemsFromRssOrAtom: Atom entry with no link element fires || "" (L290) ───

test("contentItemsFromRssOrAtom: Atom entry with no <link> fires || '' (L290)", () => {
  // Atom entry has no <link> element → both regexes fail → || '' fires (L290)
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>No Link Entry</title>
    <id>urn:uuid:1</id>
    <!-- no <link> element at all -->
  </entry>
</feed>`;
  const items = contentItemsFromRssOrAtom(xml, {
    feedUrl: "https://a.example/feed.atom",
    feedKind: "atom",
    siteOrigin: "https://a.example",
    observedAt: "",
  });
  // link="" → key="" → no url assigned → item may be filtered
  assert.ok(Array.isArray(items));
});

// ─── mergeContentItems: merge path fires topic.source truthy branch (L530, L535) ─

test("mergeContentItems: two items with same identity fires merge path with topic sources (L530-535)", () => {
  // Two items with same identity → ELSE branch at L515+
  // existing has declared_topics WITH source → L530 LEFT branch fires (source truthy)
  // existing also has declared_topics WITHOUT source → L530 RIGHT branch fires (source falsy)
  // draft has declared_topics → L535 fires
  const item1 = {
    identity: "url:https://a.example/p/",
    url: "https://a.example/p/",
    title: "Photography",
    source_feeds: [{ type: "rss", url: "https://a.example/feed.xml" }],
    declared_topics: [
      { slug: "photography", source: "rss:category" }, // source truthy → L530 LEFT
      { slug: "travel" }, // no source → source || "" RIGHT fires
    ],
  };
  const item2 = {
    identity: "url:https://a.example/p/", // same identity → ELSE path
    url: "https://a.example/p/",
    title: "Photography",
    source_feeds: [{ type: "atom", url: "https://a.example/atom.xml" }], // new feed
    declared_topics: [
      { slug: "photography", source: "rss:category" }, // duplicate → not added
      { slug: "design" }, // no source → L535 RIGHT fires
    ],
  };
  const result = mergeContentItems([item1, item2]);
  assert.equal(result.length, 1);
  assert.ok(result[0].source_feeds.some((f) => f.type === "rss"));
  assert.ok(result[0].source_feeds.some((f) => f.type === "atom"));
  assert.ok(result[0].declared_topics.some((t) => t.slug === "photography"));
  assert.ok(result[0].declared_topics.some((t) => t.slug === "design"));
});
