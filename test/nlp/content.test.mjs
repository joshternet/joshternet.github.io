/**
 * Goal: 100% line/branch/function coverage for scripts/nlp/content.mjs.
 * All tests are offline — no network, no live data files as oracles.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  absoluteHttpsImageUrl,
  ACTIVITY_IMAGE_MIN_HEIGHT,
  ACTIVITY_IMAGE_MIN_WIDTH,
  contentIdentityKey,
  contentItemNeedsPosterEnrichment,
  contentItemsFromHEntryList,
  contentItemsFromJsonFeed,
  contentItemsFromRssOrAtom,
  isEpisodeAnnouncement,
  contentUrlMatchesSiteOrigin,
  contentUrlMatchesSourceFeed,
  amazonProductUrlFromHtml,
  contentItemNeedsBookPublishedAtEnrichment,
  enrichContentItemPosters,
  enrichPublishedAtForBookItems,
  enrichPublishedAtFromPages,
  feedImageFromJsonItem,
  feedImageFromXml,
  httpContentUrl,
  imageDimensionsFromAttrs,
  isoDateString,
  isBookWorkUrl,
  isUsableCardImageSize,
  joinContentWithPageSignals,
  applyPersonalJournalTyping,
  contentTypeForPersonalJournal,
  entryTitleFromHtml,
  mergeContentItems,
  mf2NameFromHtml,
  normalizeContentItemForPublish,
  plainTextSummary,
  shouldPreferDraftTitle,
  shouldPreferShareDescription,
  summaryNeedsPageBackfill,
  titleLooksLikeBodyStandIn,
  publishedAtFromAmazonDateText,
  publishedAtFromAmazonHtml,
  publishedAtFromBookByline,
  publishedAtFromComingBadge,
  publishedAtFromMonthYear,
  publishedAtFromPageHtml,
  publishedAtFromYear,
  siteOriginFromContentUrl,
} from "../../scripts/nlp/content.mjs";

/** Offline robots gate that allows every URL. */
const ALLOW_ALL_ROBOTS = {
  allows: async () => true,
  bodyForOrigin: async () => "",
};

/**
 * robots.txt fetch stub that allows every path (empty body ⇒ allow).
 * @returns {Promise<{ url: string, contentType: string, body: string }>}
 */
async function allowAllRobotsText(url) {
  return { url: String(url), contentType: "text/plain", body: "" };
}

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

test("plainTextSummary: a glued link list keeps the labels", () => {
  assert.equal(
    plainTextSummary(
      "CSS Battle:https://cssbattle.devMy website:https://artlung.com/",
    ),
    "CSS Battle. My website.",
  );
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

test("feedImageFromXml: itunes:image with an empty tag still parses", () => {
  assert.equal(
    feedImageFromXml(
      "<item><itunes:image></itunes:image></item>",
      "https://a.example/rss.xml",
    ),
    "",
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

test("feedImageFromXml: a repeated enclosure URL is kept once", () => {
  const chunk = `<item>
    <enclosure url="https://a.example/hero.jpg" type="image/jpeg" />
    <enclosure url="https://a.example/hero.jpg" type="image/jpeg" />
  </item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://a.example/hero.jpg",
  );
});

test("feedImageFromXml: ignores images embedded in the article body", () => {
  const chunk = `<item><description>&lt;img src=&quot;https://a.example/photo.jpg&quot; /&gt; A paragraph.</description></item>`;
  assert.equal(feedImageFromXml(chunk, "https://a.example/rss.xml"), "");
});

test("feedImageFromXml: ignores images in content:encoded", () => {
  const chunk = `<item><content:encoded><![CDATA[<img src="https://a.example/content.png" />]]></content:encoded></item>`;
  assert.equal(feedImageFromXml(chunk, "https://a.example/rss.xml"), "");
});

test("isUsableCardImageSize: unknown dimensions are allowed", () => {
  assert.equal(isUsableCardImageSize(0, 0), true);
  assert.equal(isUsableCardImageSize(), true);
});

test("isUsableCardImageSize: rejects undersized known edges", () => {
  assert.equal(isUsableCardImageSize(ACTIVITY_IMAGE_MIN_WIDTH - 1, 800), false);
  assert.equal(
    isUsableCardImageSize(800, ACTIVITY_IMAGE_MIN_HEIGHT - 1),
    false,
  );
  assert.equal(
    isUsableCardImageSize(ACTIVITY_IMAGE_MIN_WIDTH, ACTIVITY_IMAGE_MIN_HEIGHT),
    true,
  );
});

test("imageDimensionsFromAttrs: reads width and height", () => {
  assert.deepEqual(imageDimensionsFromAttrs('width="1200" height="630"'), {
    width: 1200,
    height: 630,
  });
  assert.deepEqual(imageDimensionsFromAttrs(""), { width: 0, height: 0 });
});

test("feedImageFromXml: skips an undersized media:thumbnail for a declared hero", () => {
  const chunk = `<item>
    <media:thumbnail url="https://cdn.example/thumb.jpg" width="75" height="75" />
    <media:content url="https://cdn.example/hero.jpg" medium="image" width="1200" height="630" />
  </item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://cdn.example/hero.jpg",
  );
});

test("feedImageFromXml: keeps undimensioned thumbnail", () => {
  const chunk = `<item><media:thumbnail url="https://cdn.example/thumb.jpg" /></item>`;
  assert.equal(
    feedImageFromXml(chunk, "https://a.example/rss.xml"),
    "https://cdn.example/thumb.jpg",
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

test("feedImageFromJsonItem: ignores images embedded in content_html", () => {
  assert.equal(
    feedImageFromJsonItem(
      {
        content_html: '<img src="https://a.example/inline.jpg" />',
      },
      "https://a.example/feed.json",
    ),
    "",
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

test("isEpisodeAnnouncement separates episode blurbs from essays", () => {
  assert.equal(isEpisodeAnnouncement(null, null, null), false);
  assert.equal(isEpisodeAnnouncement("New episode: Tiny Result", ""), true);
  assert.equal(
    isEpisodeAnnouncement("Hello", "Watch the video when you have a minute."),
    true,
  );
  assert.equal(
    isEpisodeAnnouncement("Hi", "", "https://www.youtube.com/watch?v=abcdef"),
    true,
  );
  assert.equal(
    isEpisodeAnnouncement("Hi", "https://youtu.be/abcdef", ""),
    true,
  );
  assert.equal(
    isEpisodeAnnouncement(
      "Show notes",
      "https://joshua.example/podcasts/tiny-result/",
      "",
    ),
    true,
  );
  assert.equal(
    isEpisodeAnnouncement(
      "Show notes",
      "https://joshua.example/episodes/tiny-result/",
      "",
    ),
    true,
  );
  const essay =
    "I mentioned a podcast once in this essay about databases. The rest is the writing: indexes, backups, and the afternoon I spent checking them. This is not an announcement that an episode is out.";
  assert.equal(essay.length > 180, true);
  assert.equal(
    isEpisodeAnnouncement("What I kept from a long conversation", essay),
    false,
  );
  assert.equal(
    isEpisodeAnnouncement(
      "What I kept",
      `${essay} on the podcast we kept talking.`,
    ),
    false,
  );
  assert.equal(
    isEpisodeAnnouncement("Notes", "https://joshua.example/blog/notes/"),
    false,
  );
});

test("contentItemsFromRssOrAtom marks an episode announcement and keeps a real podcast", () => {
  const xml = `<rss><channel>
    <item>
      <title>New episode: Tiny Result</title>
      <link>https://a.example/new-episode</link>
      <description>Watch the video</description>
    </item>
    <item>
      <title>New episode: the recording</title>
      <link>https://a.example/ep</link>
      <enclosure url="https://a.example/ep.mp3" type="audio/mpeg" />
      <description>The episode audio.</description>
    </item>
    <item>
      <title>What I kept from a long conversation</title>
      <link>https://a.example/essay</link>
      <description>I mentioned a podcast once in this essay about databases. The rest is the writing: indexes, backups, and the afternoon I spent checking them. This is not an announcement that an episode is out.</description>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  assert.equal(items[0].content_type, "episode_announcement");
  assert.equal(items[1].content_type, "podcast_episode");
  assert.equal(items[2].content_type, "article");
});

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

test("contentItemsFromRssOrAtom: CMS feed-path categories are dropped", () => {
  const xml = `<rss><channel>
    <item>
      <title>Campus news</title>
      <link>https://www.cs.cmu.edu/news</link>
      <category>feeds/default</category>
      <category>keywords/Government</category>
      <category>Photography</category>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  const labels = items[0].declared_topics.map((topic) => topic.label);
  assert.equal(labels.includes("feeds/default"), false);
  assert.equal(labels.includes("keywords/Government"), false);
  assert.deepEqual(labels, ["Photography"]);
});

test("contentItemsFromRssOrAtom: CDATA categories become plain topic labels", () => {
  const xml = `<rss><channel>
    <item>
      <title>Goals achieved</title>
      <link>https://joshreads.com/goals</link>
      <category><![CDATA[Heathcliff]]></category>
      <category><![CDATA[Marvin]]></category>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  const labels = items[0].declared_topics.map((topic) => topic.label);
  const slugs = items[0].declared_topics.map((topic) => topic.slug);
  assert.deepEqual(labels, ["Heathcliff", "Marvin"]);
  assert.deepEqual(slugs, ["heathcliff", "marvin"]);
});

test("contentItemsFromRssOrAtom: unparseable pubDate stays null", () => {
  const xml = `<rss><channel>
    <item>
      <title>Dated badly</title>
      <link>https://a.example/bad-date</link>
      <pubDate>not a real date</pubDate>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  assert.equal(items.length, 1);
  assert.equal(items[0].published_at, null);
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
  assert.ok(items[0].declared_topics.some((t) => t.slug === "book"));
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

test("contentItemsFromJsonFeed: unparseable date strings stay null", () => {
  const json = JSON.stringify({
    items: [
      {
        id: "1",
        url: "https://a.example/p",
        title: "P",
        date_published: "whenever",
        date_modified: 12,
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

test("joinContentWithPageSignals: listing extracts keep their own role and topics", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "presentation:https://a.example:linter",
        url: "https://a.example/speaking/",
        content_type: "presentation",
        page_role: "presentation",
        language: null,
        title: "How to Learn to Love the Linter",
        summary: "Boston Code Camp 40",
        declared_topics: [
          {
            slug: "static-analysis",
            label: "static analysis",
            source: "item:declared",
            community_eligible: true,
          },
        ],
        source: {
          kind: "speaking-archive",
          page: "https://a.example/speaking/",
        },
      },
      {
        url: "https://a.example/speaking/",
        content_type: "event",
        title: "Untyped source",
        source: "speaking-archive",
      },
    ],
    [
      {
        pages: [
          {
            url: "https://a.example/speaking/",
            lang: "en",
            page_role: "speaking-archive",
            poster_image: "https://cdn.example/bio.jpg",
            share_description:
              "Maintainer biography that is not about one talk.",
          },
        ],
        declared_topics: [
          {
            slug: "typescript",
            label: "TypeScript",
            evidence: [
              {
                community_eligible: true,
                class: "declared",
                page: "https://a.example/speaking/",
                raw_value: "TypeScript",
                source: "meta:keywords",
              },
            ],
          },
        ],
      },
    ],
  );

  assert.equal(joined[0].page_role, "presentation");
  assert.equal(joined[0].language, "en");
  assert.equal(joined[0].summary, "Boston Code Camp 40");
  assert.equal(joined[0].image, undefined);
  assert.deepEqual(
    joined[0].declared_topics.map((topic) => topic.slug),
    ["static-analysis"],
  );
  assert.equal(joined[1].page_role, "speaking-archive");
});

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

test("joinContentWithPageSignals: uses the page poster and share description when the feed omitted them", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/post/",
        url: "https://a.example/post/",
        language: "en",
        summary: "",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [
          {
            url: "https://a.example/post/",
            lang: "en",
            page_role: "article",
            poster_image: "https://cdn.example/social.jpg",
            share_description: "What the publisher wrote for sharing.",
          },
        ],
        declared_topics: [],
      },
    ],
  );
  assert.equal(joined[0].image, "https://cdn.example/social.jpg");
  assert.equal(joined[0].summary, "What the publisher wrote for sharing.");
});

test("joinContentWithPageSignals: year albums keep short title and put share in summary", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://photos.example/photos/2014/",
        url: "https://photos.example/photos/2014/",
        title: "2014",
        summary: "",
        content_type: "photograph",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [
          {
            url: "https://photos.example/photos/2014/",
            poster_image: "https://photos.example/photos/2014/cover.jpg",
            share_description: "My Photos from 2014",
          },
        ],
        declared_topics: [],
      },
    ],
  );
  assert.equal(joined[0].image, "https://photos.example/photos/2014/cover.jpg");
  assert.equal(joined[0].summary, "My Photos from 2014");
  assert.equal(joined[0].title, "2014");
});

test("joinContentWithPageSignals: upgrades title-echo and chrome summaries from share text", () => {
  const echo = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/books/guide/",
        url: "https://a.example/books/guide/",
        title: "Coding Guide",
        summary: "Coding Guide",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [
          {
            url: "https://a.example/books/guide/",
            share_description:
              "Learn to code from the basics to Python and beyond.",
          },
        ],
        declared_topics: [],
      },
    ],
  );
  assert.equal(
    echo[0].summary,
    "Learn to code from the basics to Python and beyond.",
  );

  const chrome = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/music/",
        url: "https://a.example/music/",
        title: "Music",
        summary: "Elsewhere",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [
          {
            url: "https://a.example/music/",
            share_description: "Recordings and scores from the studio.",
          },
        ],
        declared_topics: [],
      },
    ],
  );
  assert.equal(chrome[0].summary, "Recordings and scores from the studio.");
});

test("shouldPreferShareDescription and summaryNeedsPageBackfill gates", () => {
  assert.equal(
    shouldPreferShareDescription("", "Title", "A real blurb here."),
    true,
  );
  assert.equal(
    shouldPreferShareDescription("Title", "Title", "A real blurb here."),
    true,
  );
  assert.equal(
    shouldPreferShareDescription(
      "Elsewhere",
      "Music",
      "Recordings and scores.",
    ),
    true,
  );
  assert.equal(
    shouldPreferShareDescription(
      "Short tip",
      "Title",
      "A longer share blurb wins.",
    ),
    true,
  );
  assert.equal(
    shouldPreferShareDescription(
      "A medium-length feed summary that is already useful on the card.",
      "Title",
      "A medium-length feed summary that is already useful on the card. Plus a much longer publisher share description for the page.",
    ),
    true,
  );
  assert.equal(
    shouldPreferShareDescription(
      "A solid feed summary that is already long enough.",
      "Title",
      "Short",
    ),
    false,
  );
  assert.equal(shouldPreferShareDescription("", "Title", "Title"), false);
  assert.equal(shouldPreferShareDescription(null, "Title", null), false);
  assert.equal(summaryNeedsPageBackfill(null), false);
  assert.equal(summaryNeedsPageBackfill("nope"), false);
  assert.equal(summaryNeedsPageBackfill({ summary: "", title: "X" }), true);
  assert.equal(
    summaryNeedsPageBackfill({ summary: "Same", title: "Same" }),
    true,
  );
  assert.equal(
    summaryNeedsPageBackfill({ summary: "Elsewhere", title: "Music" }),
    true,
  );
  assert.equal(
    summaryNeedsPageBackfill({
      summary: "A long enough publisher summary that should not need backfill.",
      title: "Title",
    }),
    false,
  );
});

test("joinContentWithPageSignals: keeps a feed poster and summary", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/post/",
        url: "https://a.example/post/",
        title: "Post",
        summary: "Feed blurb that is already a useful length for the card.",
        image: "https://cdn.example/feed.jpg",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [
          {
            url: "https://a.example/post/",
            poster_image: "https://cdn.example/social.jpg",
            share_description: "Page blurb similar length.",
          },
        ],
        declared_topics: [],
      },
    ],
  );
  assert.equal(joined[0].image, "https://cdn.example/feed.jpg");
  assert.equal(
    joined[0].summary,
    "Feed blurb that is already a useful length for the card.",
  );
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
test("mergeContentItems: items without http urls are dropped", () => {
  const drafts = [
    { identity: "id:abc", url: null, title: null },
    { identity: "id:def", url: null, title: null },
  ];
  const result = mergeContentItems(drafts);
  assert.equal(result.length, 0);
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

test("mergeContentItems: sorts remaining items by url", () => {
  const a = {
    identity: "url:https://a.example/z/",
    url: "https://a.example/z/",
    title: "Zebra",
    source_feeds: [],
    declared_topics: [],
  };
  const b = {
    identity: "url:https://a.example/a/",
    url: "https://a.example/a/",
    title: "Alpha",
    source_feeds: [],
    declared_topics: [],
  };
  const result = mergeContentItems([a, b]);
  assert.equal(result.length, 2);
  assert.equal(result[0].url, "https://a.example/a/");
  assert.equal(result[1].url, "https://a.example/z/");
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

test("contentItemsFromRssOrAtom: missing description becomes empty summary string", () => {
  const xml = `<rss><channel>
    <item>
      <title>No blurb</title>
      <link>https://a.example/no-blurb</link>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  assert.equal(items[0].summary, "");
});

test("contentItemsFromJsonFeed: missing summary becomes empty string", () => {
  const items = contentItemsFromJsonFeed(
    JSON.stringify({
      items: [{ url: "https://a.example/json-quiet", title: "Quiet" }],
    }),
    {
      feedUrl: "https://a.example/feed.json",
      siteOrigin: "https://a.example",
      observedAt: "2026-10-03T22:00:00.000Z",
    },
  );
  assert.equal(items[0].summary, "");
});

test("isoDateString and httpContentUrl reject junk", () => {
  assert.equal(isoDateString(""), "");
  assert.equal(isoDateString("   "), "");
  assert.equal(isoDateString(12), "");
  assert.equal(isoDateString("not-a-date"), "");
  assert.equal(
    isoDateString("2024-01-02T00:00:00.000Z"),
    "2024-01-02T00:00:00.000Z",
  );
  assert.equal(httpContentUrl(""), "");
  assert.equal(httpContentUrl("   "), "");
  assert.equal(httpContentUrl("ftp://a.example/x"), "");
  assert.equal(httpContentUrl("https://user:pass@a.example/x"), "");
  assert.equal(httpContentUrl("not a url"), "");
  assert.equal(
    httpContentUrl("http://a.example/p/#hash"),
    "http://a.example/p/",
  );
});

test("publishedAtFromYear maps 4-digit years and rejects junk", () => {
  assert.equal(publishedAtFromYear("2023"), "2023-01-01T00:00:00.000Z");
  assert.equal(publishedAtFromYear("1999"), "1999-01-01T00:00:00.000Z");
  assert.equal(publishedAtFromYear(" 2022 "), "2022-01-01T00:00:00.000Z");
  assert.equal(publishedAtFromYear("22"), "");
  assert.equal(publishedAtFromYear("1899"), "");
  assert.equal(publishedAtFromYear("2100"), "");
  assert.equal(publishedAtFromYear(""), "");
  assert.equal(publishedAtFromYear(null), "");
  assert.equal(publishedAtFromYear(2023), "");
});

test("publishedAtFromPageHtml prefers Status Completed over prose years", () => {
  assert.equal(
    publishedAtFromPageHtml(
      `<p>In the Spring of 2022 I went back to school.</p>
       <p>Status: Completed 2023</p>
       <p>Organization: FAA/OSU</p>`,
    ),
    "2023-01-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(`<p>Status: Complete 2021</p>`),
    "2021-01-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(
      `<meta property="article:published_time" content="2024-06-15T12:00:00Z">`,
    ),
    "2024-06-15T12:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(
      `<meta content="2024-07-01" property="article:published_time">`,
    ),
    "2024-07-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(
      `<time datetime="2020-03-04T08:00:00.000Z">March</time>`,
    ),
    "2020-03-04T08:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(
      `<script type="application/ld+json">{"@type":"CreativeWork","datePublished":"2019-11-02"}</script>`,
    ),
    "2019-11-02T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(
      `<p>In the Spring of 2022 I went back to school.</p>`,
    ),
    "",
  );
  assert.equal(
    publishedAtFromPageHtml(`<p>Published: 2018</p>`),
    "2018-01-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(
      `<span class="break-word def">Year:&nbsp;</span><span class="break-word">2022</span>`,
    ),
    "2022-01-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(`<p>Year: 2024</p>`),
    "2024-01-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(
      `<meta property="book:release_date" content="2025-04-01">`,
    ),
    "2025-04-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(
      `<script type="application/ld+json">{"dateCreated":"2017-02-03"}</script>`,
    ),
    "2017-02-03T00:00:00.000Z",
  );
  assert.equal(publishedAtFromPageHtml(""), "");
  assert.equal(publishedAtFromPageHtml(null), "");
  assert.equal(
    publishedAtFromPageHtml(`<p class="soon">Coming April 2027</p>`),
    "2027-04-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(
      `<p class="meta">By Chris Minnick · Wiley · 2025</p>`,
    ),
    "2025-01-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromPageHtml(`<span class="badge">Coming 2026</span>`),
    "2026-01-01T00:00:00.000Z",
  );
});

test("book coming badges, bylines, and Amazon publication dates parse", () => {
  assert.equal(
    publishedAtFromMonthYear("April", "2027"),
    "2027-04-01T00:00:00.000Z",
  );
  assert.equal(publishedAtFromMonthYear("nope", "2027"), "");
  assert.equal(publishedAtFromMonthYear(1, "2027"), "");
  assert.equal(publishedAtFromComingBadge(""), "");
  assert.equal(publishedAtFromComingBadge(null), "");
  assert.equal(
    publishedAtFromComingBadge("Coming April 2027"),
    "2027-04-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromComingBadge("Coming 2028"),
    "2028-01-01T00:00:00.000Z",
  );
  assert.equal(publishedAtFromBookByline(""), "");
  assert.equal(
    publishedAtFromBookByline("By Chris Minnick · Wiley · 2025"),
    "2025-01-01T00:00:00.000Z",
  );
  assert.equal(publishedAtFromBookByline("By Chris Minnick · Wiley"), "");
  assert.equal(
    amazonProductUrlFromHtml(
      `<a href="https://amzn.to/47jy5Da">Buy</a>
       <a href="https://www.amazon.com/Chris-Minnick/e/B002BMCII2">Author</a>`,
    ),
    "https://amzn.to/47jy5Da",
  );
  assert.equal(
    amazonProductUrlFromHtml(
      `<a href='https://www.amazon.com/gp/product/1394341725'>Buy</a>`,
    ),
    "https://www.amazon.com/gp/product/1394341725",
  );
  assert.equal(
    amazonProductUrlFromHtml(
      `<a href="">empty</a>
       <a href=''>empty2</a>
       <a href="https://example.com/not-amazon">other</a>
       <a href="https://www.amazon.com/stores/author">store</a>
       <a href="https://www.amazon.com/Chris/e/B002">author</a>
       <a href="https://www.amazon.com/s?k=books">search</a>
       <a href="http://[">bad</a>`,
    ),
    "",
  );
  assert.equal(amazonProductUrlFromHtml(""), "");
  assert.equal(amazonProductUrlFromHtml("<a href='/local'>x</a>"), "");
  // Force an empty capture group via a zero-width quoted href.
  assert.equal(amazonProductUrlFromHtml('<a href="">x</a>'), "");
  assert.equal(
    publishedAtFromAmazonDateText("July 1, 2025"),
    "2025-07-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromAmazonDateText("1 July 2025"),
    "2025-07-01T00:00:00.000Z",
  );
  assert.equal(publishedAtFromAmazonDateText("July 32, 2025"), "");
  assert.equal(publishedAtFromAmazonDateText("32 July 2025"), "");
  assert.equal(publishedAtFromAmazonDateText(""), "");
  assert.equal(publishedAtFromAmazonDateText("not a date"), "");
  assert.equal(
    publishedAtFromAmazonHtml(`
      <div data-rpi-attribute-name="book_details-publication_date">
        <span>Publication date</span>
        <div class="rpi-attribute-value"><span>July 1, 2025</span></div>
      </div>`),
    "2025-07-01T00:00:00.000Z",
  );
  assert.equal(
    publishedAtFromAmazonHtml(
      `<span>Publication date</span><span>August 15, 2024</span>`,
    ),
    "2024-08-15T00:00:00.000Z",
  );
  assert.equal(publishedAtFromAmazonHtml(""), "");
  assert.equal(publishedAtFromAmazonHtml("<html></html>"), "");
  assert.equal(isBookWorkUrl("https://a.example/books/title/"), true);
  assert.equal(isBookWorkUrl("https://a.example/fiction/novel/"), true);
  assert.equal(isBookWorkUrl("https://a.example/books/"), false);
  assert.equal(isBookWorkUrl("https://["), false);
  assert.equal(isBookWorkUrl("not a url"), false);
  assert.equal(
    contentItemNeedsBookPublishedAtEnrichment({
      url: "https://a.example/books/title/",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsBookPublishedAtEnrichment({
      url: "https://a.example/books/title/",
      published_at: "2025-01-01T00:00:00.000Z",
    }),
    false,
  );
  assert.equal(contentItemNeedsBookPublishedAtEnrichment(null), false);
});

test("enrichPublishedAtForBookItems uses page then Amazon fallback", async () => {
  const items = [
    {
      url: "https://a.example/books/claude/",
      title: "Claude",
    },
    {
      url: "https://a.example/books/ai/",
      title: "AI",
    },
    {
      url: "https://a.example/projects/skip/",
      title: "Skip",
    },
  ];

  await enrichPublishedAtForBookItems(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (href) => {
      if (href.endsWith("/books/claude/")) {
        return {
          url: href,
          contentType: "text/html",
          body: `<p class="soon">Coming April 2027</p>
            <a href="https://amzn.to/claude">Pre-order</a>`,
        };
      }

      if (href.endsWith("/books/ai/")) {
        return {
          url: href,
          contentType: "text/html",
          body: `<p class="meta">By Chris Minnick</p>
            <a href="https://amzn.to/ai-book">Buy on Amazon</a>`,
        };
      }

      if (href.includes("amzn.to/ai-book")) {
        return {
          url: "https://www.amazon.com/dp/AI",
          contentType: "text/html",
          body: `<div data-rpi-attribute-name="book_details-publication_date">
            <div class="rpi-attribute-value"><span>July 1, 2025</span></div>
          </div>`,
        };
      }

      throw new Error(`unexpected ${href}`);
    },
  });

  assert.equal(items[0].published_at, "2027-04-01T00:00:00.000Z");
  assert.equal(items[1].published_at, "2025-07-01T00:00:00.000Z");
  assert.equal(items[2].published_at, undefined);
  assert.deepEqual(await enrichPublishedAtForBookItems([]), []);
  assert.deepEqual(await enrichPublishedAtForBookItems(null), []);
});

test("enrichPublishedAtForBookItems respects robots deny and fetch errors", async () => {
  const denied = [{ url: "https://a.example/books/blocked/", title: "X" }];
  await enrichPublishedAtForBookItems(denied, {
    robotsGate: {
      allows: async () => false,
      bodyForOrigin: async () => "",
    },
    fetchText: async () => {
      throw new Error("should not fetch");
    },
  });
  assert.equal(denied[0].published_at, undefined);

  const boom = [{ url: "https://a.example/books/boom/", title: "Y" }];
  await enrichPublishedAtForBookItems(boom, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(boom[0].published_at, undefined);

  const amazonDenied = [{ url: "https://a.example/books/amz/", title: "Z" }];
  await enrichPublishedAtForBookItems(amazonDenied, {
    robotsGate: {
      allows: async (href) => !String(href).includes("amzn.to"),
      bodyForOrigin: async () => "",
    },
    fetchText: async (href) => ({
      url: href,
      contentType: "text/html",
      body: `<a href="https://amzn.to/x">Buy</a>`,
    }),
  });
  assert.equal(amazonDenied[0].published_at, undefined);

  const amazonBoom = [{ url: "https://a.example/books/amz-boom/", title: "A" }];
  await enrichPublishedAtForBookItems(amazonBoom, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (href) => {
      if (href.includes("/books/amz-boom/")) {
        return {
          url: href,
          contentType: "text/html",
          body: `<a href="https://amzn.to/boom">Buy</a>`,
        };
      }

      throw new Error("amazon offline");
    },
  });
  assert.equal(amazonBoom[0].published_at, undefined);

  const undatedAmazon = [
    { url: "https://a.example/books/undated-amz/", title: "U" },
  ];
  await enrichPublishedAtForBookItems(undatedAmazon, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (href) => ({
      url: href,
      contentType: "text/html",
      body: href.includes("amzn.to")
        ? "<html>no date</html>"
        : `<a href="https://amzn.to/nodate">Buy</a>`,
    }),
  });
  assert.equal(undatedAmazon[0].published_at, undefined);

  const nonStringBody = [
    { url: "https://a.example/books/non-string/", title: "N" },
  ];
  await enrichPublishedAtForBookItems(nonStringBody, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async () => ({
      url: "https://a.example/books/non-string/",
      contentType: "text/html",
      body: 12,
    }),
  });
  assert.equal(nonStringBody[0].published_at, undefined);

  const limited = [
    { url: "https://a.example/books/one/", title: "One" },
    { url: "https://a.example/books/two/", title: "Two" },
  ];
  await enrichPublishedAtForBookItems(limited, {
    robotsGate: ALLOW_ALL_ROBOTS,
    limit: 1,
    fetchText: async (href) => ({
      url: href,
      contentType: "text/html",
      body: `<p class="soon">Coming May 2026</p>`,
    }),
  });
  assert.equal(limited[0].published_at, "2026-05-01T00:00:00.000Z");
  assert.equal(limited[1].published_at, undefined);

  const limitBeforeAmazon = [
    { url: "https://a.example/books/need-amz/", title: "Need" },
  ];
  await enrichPublishedAtForBookItems(limitBeforeAmazon, {
    robotsGate: ALLOW_ALL_ROBOTS,
    limit: 1,
    fetchText: async (href) => {
      if (href.includes("amzn.to")) {
        throw new Error("should not amazon");
      }

      return {
        url: href,
        contentType: "text/html",
        body: `<a href="https://amzn.to/later">Buy</a>`,
      };
    },
  });
  assert.equal(limitBeforeAmazon[0].published_at, undefined);

  await enrichPublishedAtForBookItems(
    [
      {
        url: "https://a.example/books/dated/",
        published_at: "2024-01-01T00:00:00.000Z",
      },
    ],
    {
      fetchRobotsText: allowAllRobotsText,
      fetchText: async () => {
        throw new Error("should not fetch dated books");
      },
    },
  );

  await enrichPublishedAtForBookItems(
    [{ url: "https://a.example/projects/x/", title: "Not a book" }],
    {
      cache: new Map(),
    },
  );

  const amazonEmptyBody = [
    { url: "https://a.example/books/empty-amz-body/", title: "E" },
  ];
  await enrichPublishedAtForBookItems(amazonEmptyBody, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (href) => {
      if (href.includes("amzn.to")) {
        return { url: href, contentType: "text/html", body: null };
      }

      return {
        url: href,
        contentType: "text/html",
        body: `<a href="https://amzn.to/empty-body">Buy</a>`,
      };
    },
  });
  assert.equal(amazonEmptyBody[0].published_at, undefined);
});

test("enrichPublishedAtFromPages fills missing published_at from crawled HTML", () => {
  const items = [
    {
      url: "https://joshuadrake.org/projects/turboelectriccessna",
      title: "TurboElectric Cessna",
      observed_at: "2026-11-02T15:29:16.095Z",
    },
    {
      url: "https://example.org/already-dated",
      published_at: "2025-01-01T00:00:00.000Z",
      title: "Keep me",
    },
    {
      url: "https://example.org/no-page",
      title: "Stay undated",
    },
    null,
    { title: "no url" },
  ];
  enrichPublishedAtFromPages(items, [
    {
      url: "https://joshuadrake.org/projects/turboelectriccessna/",
      html: `<p>Spring of 2022</p><p>Status: Completed 2023</p>`,
    },
    {
      url: "https://example.org/already-dated",
      html: `<p>Status: Completed 2010</p>`,
    },
    { url: "https://example.org/empty", html: "" },
    null,
  ]);
  assert.equal(items[0].published_at, "2023-01-01T00:00:00.000Z");
  assert.equal(items[1].published_at, "2025-01-01T00:00:00.000Z");
  assert.equal(items[2].published_at, undefined);
  assert.equal(enrichPublishedAtFromPages(null, []), null);
  assert.deepEqual(enrichPublishedAtFromPages([], null), []);
});

test("normalizeContentItemForPublish drops invalid items and stringifies summary", () => {
  assert.equal(normalizeContentItemForPublish(null), null);
  assert.equal(normalizeContentItemForPublish(5), null);
  assert.equal(normalizeContentItemForPublish("x"), null);
  assert.equal(normalizeContentItemForPublish([]), null);
  assert.equal(
    normalizeContentItemForPublish({ url: "https://a.example/" }),
    null,
  );
  assert.equal(
    normalizeContentItemForPublish({ identity: 3, url: "https://a.example/" }),
    null,
  );
  assert.equal(
    normalizeContentItemForPublish({
      identity: "  ",
      url: "https://a.example/",
    }),
    null,
  );
  assert.equal(
    normalizeContentItemForPublish({
      identity: "url:https://a.example/x",
      url: "mailto:hi@a.example",
    }),
    null,
  );

  const published = normalizeContentItemForPublish({
    identity: "url:https://a.example/post/",
    url: "https://a.example/post/#frag",
    title: "",
    summary: 12,
    published_at: "not-a-date",
    updated_at: "2024-06-01T00:00:00.000Z",
  });
  assert.equal(published.url, "https://a.example/post/");
  assert.equal(published.title, "Untitled");
  assert.equal(published.summary, "");
  assert.equal("published_at" in published, false);
  assert.equal(published.updated_at, "2024-06-01T00:00:00.000Z");

  const titled = normalizeContentItemForPublish({
    identity: "url:https://a.example/named/",
    url: "https://a.example/named/",
    title: "Named",
    summary: "<p>Hi</p>",
    published_at: "2024-01-01T00:00:00.000Z",
  });
  assert.equal(titled.title, "Named");
  assert.equal(titled.summary, "Hi");
  assert.equal(titled.published_at, "2024-01-01T00:00:00.000Z");
  assert.equal("updated_at" in titled, false);
});

test("contentUrlMatchesSiteOrigin requires matching origins", () => {
  assert.equal(
    contentUrlMatchesSiteOrigin(
      "https://joshua.seigler.net/posts/x/",
      "https://joshua.seigler.net",
    ),
    true,
  );
  assert.equal(
    contentUrlMatchesSiteOrigin(
      "https://joshternet.org/",
      "https://joshua.seigler.net",
    ),
    false,
  );
  assert.equal(contentUrlMatchesSiteOrigin("https://a.example/", ""), false);
  assert.equal(
    contentUrlMatchesSiteOrigin("https://a.example/", "not a url"),
    false,
  );
});

test("normalizeContentItemForPublish drops member link-posts to the hub", () => {
  assert.equal(
    normalizeContentItemForPublish({
      identity: "url:https://joshternet.org/",
      url: "https://joshternet.org/",
      site_origin: "https://joshua.seigler.net",
      title: "Link: Joshternet",
      summary: "",
    }),
    null,
  );

  const sameOrigin = normalizeContentItemForPublish({
    identity: "url:https://joshua.seigler.net/posts/hi/",
    url: "https://joshua.seigler.net/posts/hi/",
    site_origin: "https://joshua.seigler.net",
    title: "Hi",
    summary: "",
  });
  assert.equal(sameOrigin.url, "https://joshua.seigler.net/posts/hi/");
});

test("contentUrlMatchesSourceFeed allows Substack posts from card feeds", () => {
  assert.equal(
    contentUrlMatchesSourceFeed("https://chrisminnick.substack.com/p/hello", [
      { type: "rss", url: "https://chrisminnick.substack.com/feed" },
    ]),
    true,
  );
  assert.equal(
    contentUrlMatchesSourceFeed("https://other.substack.com/p/hello", [
      { type: "rss", url: "https://chrisminnick.substack.com/feed" },
    ]),
    false,
  );
  assert.equal(contentUrlMatchesSourceFeed("https://a.example/p", null), false);
  assert.equal(contentUrlMatchesSourceFeed("https://a.example/p", []), false);
  assert.equal(
    contentUrlMatchesSourceFeed("not a url", [
      { type: "rss", url: "https://chrisminnick.substack.com/feed" },
    ]),
    false,
  );
  assert.equal(
    contentUrlMatchesSourceFeed("https://a.example/p", [
      null,
      { type: "rss", url: "not a url" },
      { type: "rss" },
    ]),
    false,
  );
});

test("normalizeContentItemForPublish keeps Substack posts when source feed matches", () => {
  const published = normalizeContentItemForPublish({
    identity: "url:https://chrisminnick.substack.com/p/hello",
    url: "https://chrisminnick.substack.com/p/hello",
    site_origin: "https://www.chrisminnick.com",
    title: "Hello from Substack",
    summary: "A newsletter post.",
    published_at: "2026-10-20T12:00:00.000Z",
    source_feeds: [
      { type: "rss", url: "https://chrisminnick.substack.com/feed" },
    ],
  });
  assert.equal(published?.url, "https://chrisminnick.substack.com/p/hello");
  assert.equal(published?.site_origin, "https://www.chrisminnick.com");
  assert.equal(published?.published_at, "2026-10-20T12:00:00.000Z");

  assert.equal(
    normalizeContentItemForPublish({
      identity: "url:https://other.substack.com/p/not-theirs",
      url: "https://other.substack.com/p/not-theirs",
      site_origin: "https://www.chrisminnick.com",
      title: "Someone else",
      summary: "",
      source_feeds: [
        { type: "rss", url: "https://chrisminnick.substack.com/feed" },
      ],
    }),
    null,
  );
});

test("mergeContentItems drops guid-only drafts without http urls", () => {
  const merged = mergeContentItems([
    { identity: "id:https://a.example:1", url: null, title: "Ghost" },
    {
      identity: "url:https://a.example/real/",
      url: "https://a.example/real/",
      title: "Real",
      summary: null,
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].url, "https://a.example/real/");
  assert.equal(merged[0].summary, "");
});

test("joinContentWithPageSignals never restores a null summary", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/p/",
        url: "https://a.example/p/",
        summary: 9,
        declared_topics: [],
      },
    ],
    [],
  );
  assert.equal(joined[0].summary, "");
});

test("merged empty summaries satisfy content.schema.json", async () => {
  const { contentSchema } = await import("../../scripts/nlp/crawl-shape.mjs");
  const schema = contentSchema;
  const xml = `<rss><channel>
    <item><title>A</title><link>https://a.example/a</link></item>
    <item><title>B</title><link>https://a.example/b</link></item>
  </channel></rss>`;
  const items = mergeContentItems(contentItemsFromRssOrAtom(xml, RSS_META));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(
    validate({
      schema_version: 1,
      item_count: items.length,
      items,
    }),
    true,
    JSON.stringify(validate.errors),
  );
});

test("contentItemNeedsPosterEnrichment targets creative paths without images", () => {
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshuamorris.info/experiments/corkboard/",
      content_type: "article",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshuamorris.info/experiments/corkboard/",
      content_type: "article",
      image: "https://joshuamorris.info/images/experiments/corkboard-og.webp",
      summary: "A corkboard for notes and connecting threads across topics.",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://www.chrisminnick.com/books/coding-all-in-one-for-dummies/",
      content_type: "project",
      image: "https://www.chrisminnick.com/cover.png",
      title: "Coding All-in-One For Dummies",
      summary: "Coding All-in-One For Dummies",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshua.seigler.net/music/score.pdf",
      content_type: "sheet_music",
      summary: "",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshuamorris.info/notes/hello/",
      content_type: "article",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshuamorris.info/notes/hello/",
      content_type: "note",
    }),
    true,
  );
  assert.equal(contentItemNeedsPosterEnrichment(null), false);
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshgr.com/wizardly-words/",
      content_type: "project",
      source: { kind: "creative-homepage" },
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://themorning.app/",
      content_type: "project",
      source_kind: "creative-homepage-shelf",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshgr.com/wizardly-words/",
      content_type: "project",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://github.com/joshgrant/MusicX",
      content_type: "project",
      source: { kind: "creative-projects-shelf" },
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshgr.com/wizardly-words/",
      content_type: "article",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshgr.com/wizardly-words/",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshgr.com/nested/path/",
      content_type: "project",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshgr.com/wizardly-words/",
      content_type: "project",
      source_kind: "",
      source: { kind: 12 },
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://a.example/blog/hello/",
      content_type: "oddity",
    }),
    false,
  );
});

test("enrichContentItemPosters skips URLs robots.txt disallows", async () => {
  let fetched = false;
  const items = [
    {
      url: "https://a.example/experiments/secret/",
      content_type: "article",
      title: "Secret",
      summary: "",
      image: "",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: {
      allows: async () => false,
      bodyForOrigin: async () => "",
    },
    fetchText: async () => {
      fetched = true;
      return { url: "", contentType: "text/html", body: "" };
    },
  });

  assert.equal(fetched, false);
  assert.equal(items[0].image, "");
});

test("enrichContentItemPosters fills publisher og:image for experiments", async () => {
  const poster =
    "https://joshuamorris.info/images/experiments/corkboard-og.webp";
  const items = [
    {
      url: "https://joshuamorris.info/experiments/corkboard/",
      content_type: "article",
      title: "Corkboard",
      summary: "",
      image: "",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (url) => {
      assert.equal(url, items[0].url);
      return {
        url,
        contentType: "text/html",
        body: `<html><head>
          <meta property="og:image" content="${poster}">
          <meta property="og:description" content="A corkboard for notes.">
        </head></html>`,
      };
    },
  });

  assert.equal(items[0].image, poster);
  assert.match(String(items[0].summary), /corkboard/i);
});

test("enrichContentItemPosters fills summary when cover image already exists", async () => {
  const items = [
    {
      url: "https://www.chrisminnick.com/books/coding-all-in-one-for-dummies/",
      content_type: "project",
      title: "Coding All-in-One For Dummies, 3rd Edition",
      summary: "Coding All-in-One For Dummies, 3rd Edition",
      image: "https://www.chrisminnick.com/cover.png",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async () => ({
      url: items[0].url,
      contentType: "text/html",
      body: `<html><head>
        <meta property="og:description" content="Learn to code from the basics to Python and beyond">
      </head></html>`,
    }),
  });

  assert.equal(items[0].image, "https://www.chrisminnick.com/cover.png");
  assert.equal(
    items[0].summary,
    "Learn to code from the basics to Python and beyond",
  );
});

test("enrichContentItemPosters falls back to body lede when OG is missing", async () => {
  const items = [
    {
      url: "https://joshurbandavis.com/experiments/worn/index.html",
      content_type: "project",
      title: "worn",
      summary: "",
      image: "",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async () => ({
      url: items[0].url,
      contentType: "text/html",
      body: `<html><body>
        <h1>worn</h1>
        <p>A mirror that fits you with other people's faces. It moves exactly as you move.</p>
      </body></html>`,
    }),
  });

  assert.match(String(items[0].summary), /mirror that fits you/i);
});

test("enrichContentItemPosters fills comic hub post og:image and published_at", async () => {
  const poster = "https://artlung.example/comics/use-it.png";
  const items = [
    {
      url: "https://artlung.example/blog/2025/03/use-it/",
      content_type: "comic",
      title: "USE IT.",
      summary: "",
      image: "",
      source: { kind: "creative-comics-hub" },
    },
    {
      url: "https://artlung.example/blog/2024/11/spite/",
      content_type: "comic",
      title: "Spite",
      summary: "Already dated",
      image: "",
      published_at: "2024-11-01T00:00:00.000Z",
      source_kind: "creative-comics-hub",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (url) => {
      if (url === items[0].url) {
        return {
          url,
          contentType: "text/html",
          body: `<html><head>
            <meta property="og:image" content="${poster}">
            <meta property="article:published_time" content="2025-03-21T12:00:00.000Z">
          </head></html>`,
        };
      }

      return {
        url,
        contentType: "text/html",
        body: `<html><head>
          <meta property="og:image" content="https://artlung.example/spite.png">
        </head></html>`,
      };
    },
  });

  assert.equal(items[0].image, poster);
  assert.equal(items[0].published_at, "2025-03-21T12:00:00.000Z");
  assert.equal(items[1].image, "https://artlung.example/spite.png");
  assert.equal(items[1].published_at, "2024-11-01T00:00:00.000Z");
});

test("contentItemNeedsPosterEnrichment accepts creative-comics-hub source", () => {
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://artlung.example/blog/2025/03/use-it/",
      content_type: "note",
      image: "",
      source: { kind: "creative-comics-hub" },
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://artlung.example/blog/2025/03/use-it/",
      content_type: "note",
      image: "",
      source_kind: "creative-comics-hub",
    }),
    true,
  );
});

test("enrichContentItemPosters fills dates from source.kind comics hub", async () => {
  const items = [
    {
      url: "https://artlung.example/blog/2025/02/hub-kind/",
      content_type: "project",
      title: "Hub kind",
      summary: "ok",
      image: "",
      source: { kind: "creative-comics-hub" },
    },
    {
      url: "https://artlung.example/blog/2025/02/no-type/",
      title: "No type",
      summary: "ok",
      image: "",
      source_kind: "creative-comics-hub",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (url) => ({
      url,
      contentType: "text/html",
      body: `<html><head>
        <meta property="og:image" content="https://artlung.example/h.png">
        <meta property="article:published_time" content="2025-02-01T00:00:00.000Z">
      </head></html>`,
    }),
  });

  assert.equal(items[0].image, "https://artlung.example/h.png");
  assert.equal(items[0].published_at, "2025-02-01T00:00:00.000Z");
  assert.equal(items[1].image, "https://artlung.example/h.png");
  assert.equal(items[1].published_at, "2025-02-01T00:00:00.000Z");
});

test("enrichContentItemPosters comic type without hub source still dates", async () => {
  const items = [
    {
      url: "https://artlung.example/comics/solo-strip/",
      content_type: "comic",
      title: "Solo strip",
      summary: "ok",
      image: "",
    },
  ];
  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (url) => ({
      url,
      contentType: "text/html",
      body: `<html><head>
        <meta property="og:image" content="https://artlung.example/s.png">
        <meta property="article:published_time" content="2025-04-01T00:00:00.000Z">
      </head></html>`,
    }),
  });
  assert.equal(items[0].published_at, "2025-04-01T00:00:00.000Z");
});

test("enrichContentItemPosters comic with no page date leaves published_at empty", async () => {
  const items = [
    {
      url: "https://artlung.example/blog/2025/01/undated/",
      content_type: "project",
      title: "Undated strip",
      summary: "ok",
      image: "",
      source_kind: "creative-comics-hub",
    },
    {
      url: "https://artlung.example/blog/2025/01/kind-only/",
      content_type: "comic",
      title: "Kind only",
      summary: "ok",
      image: "",
      published_at: 2025,
      source: { kind: 12 },
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (url) => {
      if (String(url).includes("/undated/")) {
        return {
          url,
          contentType: "text/html",
          body: `<html><head>
            <meta property="og:image" content="https://artlung.example/u.png">
          </head></html>`,
        };
      }

      return {
        url,
        contentType: "text/html",
        body: `<html><head>
          <meta property="og:image" content="https://artlung.example/u.png">
          <meta property="article:published_time" content="2025-01-15T00:00:00.000Z">
        </head></html>`,
      };
    },
  });

  assert.equal(items[0].image, "https://artlung.example/u.png");
  assert.equal(items[0].published_at, undefined);
  assert.equal(items[1].image, "https://artlung.example/u.png");
  assert.equal(items[1].published_at, "2025-01-15T00:00:00.000Z");
});

test("enrichContentItemPosters skips items that already have posters", async () => {
  let fetched = false;
  const items = [
    {
      url: "https://joshuamorris.info/experiments/model-viewer/",
      content_type: "article",
      title: "Model Viewer",
      summary:
        "A WebGL model viewer with enough summary text to skip backfill.",
      image:
        "https://joshuamorris.info/images/experiments/model-viewer-og.webp",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async () => {
      fetched = true;
      return { url: "", contentType: "text/html", body: "" };
    },
  });

  assert.equal(fetched, false);
});

test("mergeContentItems fills empty summary and upgrades article to project", () => {
  const merged = mergeContentItems([
    {
      identity: "url:https://games.example/games/river/",
      url: "https://games.example/games/river/",
      title: "River Crossing",
      summary: "",
      content_type: "article",
      image: "",
      source_feeds: [{ type: "rss", url: "https://games.example/feed.xml" }],
      declared_topics: [],
    },
    {
      identity: "url:https://games.example/games/river/",
      url: "https://games.example/games/river/",
      title: "River Crossing",
      summary: "A quiet puzzle about getting everyone across.",
      content_type: "game",
      image: "https://games.example/images/river.png",
      source_feeds: [
        { type: "creative-index", url: "https://games.example/games/" },
      ],
      declared_topics: [],
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].content_type, "game");
  assert.equal(merged[0].image, "https://games.example/images/river.png");
  assert.match(String(merged[0].summary), /quiet puzzle/i);
});

test("mergeContentItems does not overwrite an existing https image", () => {
  const merged = mergeContentItems([
    {
      identity: "url:https://games.example/games/orchard/",
      url: "https://games.example/games/orchard/",
      title: "Orchard",
      summary: "Grow fruit",
      content_type: "game",
      image: "https://games.example/images/orchard.png",
      source_feeds: [
        { type: "creative-index", url: "https://games.example/games/" },
      ],
      declared_topics: [],
    },
    {
      identity: "url:https://games.example/games/orchard/",
      url: "https://games.example/games/orchard/",
      title: "Orchard",
      summary: "Grow fruit",
      content_type: "game",
      image: "https://cdn.example/other.png",
      source_feeds: [{ type: "rss", url: "https://games.example/feed.xml" }],
      declared_topics: [],
    },
  ]);
  assert.equal(merged[0].image, "https://games.example/images/orchard.png");
});

test("contentItemNeedsPosterEnrichment is true for games path without image", () => {
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshtronic.com/games/age-of-combat/",
      content_type: "game",
      image: "",
    }),
    true,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshtronic.com/games/age-of-combat/",
      content_type: "game",
      image: "https://joshtronic.com/images/age.png",
      summary:
        "A browser combat game with enough summary text to skip backfill.",
    }),
    false,
  );
});

test("contentItemNeedsPosterEnrichment rejects bad urls and credentials", () => {
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "http://a.example/games/x/",
      content_type: "game",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://user:pass@a.example/games/x/",
      content_type: "game",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://[bad]/games/x/",
      content_type: "game",
    }),
    false,
  );
});

test("enrichContentItemPosters returns empty input unchanged and swallows fetch errors", async () => {
  assert.deepEqual(await enrichContentItemPosters([]), []);
  assert.deepEqual(await enrichContentItemPosters(null), []);

  const items = [
    {
      url: "https://joshtronic.com/games/age-of-combat/",
      content_type: "game",
      image: "",
      summary: "",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async () => {
      throw new Error("network down");
    },
  });

  assert.equal(items[0].image, "");
});

test("enrichContentItemPosters builds a default robots gate via fetchRobotsText", async () => {
  const poster = "https://cdn.example/default-gate.png";
  const items = [
    {
      url: "https://games.example/games/default-gate/",
      content_type: "game",
      title: "Default Gate",
      summary: "",
      image: "",
    },
  ];
  /** @type {string[]} */
  const robotsUrls = [];

  await enrichContentItemPosters(items, {
    fetchRobotsText: async (url) => {
      robotsUrls.push(String(url));
      return allowAllRobotsText(url);
    },
    fetchText: async (url) => ({
      url,
      contentType: "text/html",
      body: `<html><head>
        <meta property="og:image" content="${poster}">
      </head></html>`,
    }),
  });

  assert.ok(
    robotsUrls.some((url) => url.includes("/robots.txt")),
    "expected default gate to fetch robots.txt",
  );
  assert.equal(items[0].image, poster);
});

test("mergeContentItems keeps existing summary and non-article content_type", () => {
  const merged = mergeContentItems([
    {
      identity: "url:https://games.example/games/river/",
      url: "https://games.example/games/river/",
      title: "River Crossing",
      summary: "Keep me",
      content_type: "game",
      image: "https://games.example/images/river.png",
      source_feeds: [{ type: "rss", url: "https://games.example/feed.xml" }],
      declared_topics: [],
    },
    {
      identity: "url:https://games.example/games/river/",
      url: "https://games.example/games/river/",
      title: "River Crossing",
      summary: "Ignore me",
      content_type: "article",
      image: "https://cdn.example/other.png",
      source_feeds: [
        { type: "creative-index", url: "https://games.example/games/" },
      ],
      declared_topics: [],
    },
  ]);
  assert.equal(merged[0].summary, "Keep me");
  assert.equal(merged[0].content_type, "game");
  assert.equal(merged[0].image, "https://games.example/images/river.png");
});

test("enrichContentItemPosters does not replace a non-https image string", async () => {
  const items = [
    {
      url: "https://joshtronic.com/games/age-of-combat/",
      content_type: "game",
      image: "/local/placeholder.png",
      summary: "Already summarized enough for a card.",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (url) => ({
      url,
      contentType: "text/html",
      body: `<html><head>
        <meta property="og:image" content="https://cdn.example/og.png">
        <meta property="og:description" content="Should not replace summary">
      </head></html>`,
    }),
  });

  assert.equal(items[0].image, "/local/placeholder.png");
  assert.equal(items[0].summary, "Already summarized enough for a card.");
});

test("enrichContentItemPosters uses default fetchText/cache options and non-string body", async () => {
  const items = [
    {
      url: "https://joshtronic.com/games/flip-flop-frenzy/",
      content_type: "game",
      image: "",
      summary: "",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (url) => ({
      // non-string body / url exercise ternary false branches
      url: null,
      contentType: "text/html",
      body: null,
    }),
  });

  assert.equal(items[0].image, "");
});

test("contentItemNeedsPosterEnrichment accepts creative path with unknown type", () => {
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://joshtronic.com/games/age-of-combat/",
      content_type: "oddity",
      image: "",
    }),
    true,
  );
});

test("contentItemNeedsPosterEnrichment rejects username-only and password-only urls", () => {
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://user@joshtronic.com/games/age-of-combat/",
      content_type: "game",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://:secret@joshtronic.com/games/age-of-combat/",
      content_type: "game",
    }),
    false,
  );
});

test("contentItemNeedsPosterEnrichment rejects unknown types on non-creative paths", () => {
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://a.example/blog/hello-world/",
      content_type: "oddity",
      image: "",
    }),
    false,
  );
  assert.equal(
    contentItemNeedsPosterEnrichment({
      url: "https://a.example/blog/hello-world/",
      content_type: "project",
      image: "",
    }),
    true,
  );
});

test("enrichContentItemPosters accepts an explicit cache map", async () => {
  const cache = new Map();
  const items = [
    {
      url: "https://joshtronic.com/games/idol-idle/",
      content_type: "game",
      image: "",
      summary: "Already has a summary long enough.",
    },
  ];

  await enrichContentItemPosters(items, {
    cache,
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (url) => ({
      url,
      contentType: "text/html",
      body: "<html><head></head><body>no og</body></html>",
    }),
  });

  assert.equal(items[0].image, "");
});

test("mergeContentItems fills whitespace-only summary and ignores non-string draft fields", () => {
  const merged = mergeContentItems([
    {
      identity: "url:https://games.example/games/know-the-table/",
      url: "https://games.example/games/know-the-table/",
      title: "Know the Table",
      summary: "   ",
      content_type: "article",
      image: "",
      source_feeds: [{ type: "rss", url: "https://games.example/feed.xml" }],
      declared_topics: [],
    },
    {
      identity: "url:https://games.example/games/know-the-table/",
      url: "https://games.example/games/know-the-table/",
      title: "Know the Table",
      // summary omitted → non-string branch
      content_type: 42,
      image: "https://games.example/images/table.png",
      source_feeds: [
        { type: "creative-index", url: "https://games.example/games/" },
      ],
      declared_topics: [],
    },
  ]);
  assert.equal(merged[0].content_type, "article");
  assert.equal(merged[0].image, "https://games.example/images/table.png");
});

test("mergeContentItems upgrades article when draft summary is present", () => {
  const merged = mergeContentItems([
    {
      identity: "url:https://games.example/games/river-of-doom/",
      url: "https://games.example/games/river-of-doom/",
      title: "River of DOOM!!!",
      summary: undefined,
      content_type: "article",
      source_feeds: [{ type: "rss", url: "https://games.example/feed.xml" }],
      declared_topics: [],
    },
    {
      identity: "url:https://games.example/games/river-of-doom/",
      url: "https://games.example/games/river-of-doom/",
      title: "River of DOOM!!!",
      summary: "A chaotic river arcade.",
      content_type: "game",
      source_feeds: [
        { type: "creative-index", url: "https://games.example/games/" },
      ],
      declared_topics: [],
    },
  ]);
  assert.equal(merged[0].content_type, "game");
  assert.match(String(merged[0].summary), /chaotic river/i);
});

test("enrichContentItemPosters uses default fetchText when every item already has a poster", async () => {
  const items = [
    {
      url: "https://joshtronic.com/games/age-of-combat/",
      content_type: "game",
      image: "https://joshtronic.com/images/age.png",
    },
  ];

  // No fetchText / robotsGate / fetchRobotsText → default lib fetch + default
  // robots gate (else branch) without performing a network fetch.
  const result = await enrichContentItemPosters(items);
  assert.equal(result[0].image, "https://joshtronic.com/images/age.png");
});

test("enrichContentItemPosters default robots gate allows when robots.txt is absent", async () => {
  const poster = "https://cdn.example/absent-robots.png";
  const items = [
    {
      url: "https://games.example/games/absent-robots/",
      content_type: "game",
      title: "Absent Robots",
      summary: "",
      image: "",
    },
  ];

  // A 404 robots file is absent, so the default gate allows the page.
  await enrichContentItemPosters(items, {
    cache: new Map([["games.example", [{ address: "1.1.1.1" }]]]),
    fetchRobotsText: async (url) => ({
      url,
      body: "",
      status: 404,
      body_complete: false,
      contentType: "text/plain",
    }),
    fetchText: async (url) => {
      assert.match(String(url), /\/games\/absent-robots\//);
      return {
        url,
        contentType: "text/html",
        body: `<html><head>
          <meta property="og:image" content="${poster}">
        </head></html>`,
      };
    },
  });

  assert.equal(items[0].image, poster);
});

test("enrichContentItemPosters treats non-string image as empty", async () => {
  const items = [
    {
      url: "https://joshtronic.com/games/age-of-combat/",
      content_type: "game",
      image: null,
      summary: "",
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async (url) => ({
      url,
      contentType: "text/html",
      body: `<html><head>
        <meta property="og:image" content="https://joshtronic.com/images/age.png">
        <meta property="og:description" content="A combat age game.">
      </head></html>`,
    }),
  });

  assert.equal(items[0].image, "https://joshtronic.com/images/age.png");
});

test("contentItemsFromRssOrAtom: prefers pubDate over updated", () => {
  const xml = `<?xml version="1.0"?>
  <rss><channel>
    <item>
      <title>Prefer publish stamp</title>
      <link>https://a.example/post/</link>
      <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
      <updated>Wed, 01 Jan 2025 00:00:00 +0000</updated>
      <description>Body chrome</description>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  assert.equal(items.length, 1);
  assert.equal(items[0].published_at, "2024-01-01T00:00:00.000Z");
});

test("contentItemsFromRssOrAtom: prefers itunes:summary over description", () => {
  const xml = `<?xml version="1.0"?>
  <rss><channel>
    <item>
      <title>Episode</title>
      <link>https://a.example/ep/1/</link>
      <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
      <itunes:summary>Clean episode blurb for listeners.</itunes:summary>
      <description><![CDATA[<nav>Skip this chrome</nav><p>Long body</p>]]></description>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  assert.equal(items.length, 1);
  assert.match(items[0].summary, /Clean episode blurb/);
  assert.doesNotMatch(items[0].summary, /Skip this chrome/);
});

test("contentItemsFromJsonFeed: prefers summary over content_html", () => {
  const json = JSON.stringify({
    version: "https://jsonfeed.org/version/1",
    items: [
      {
        id: "1",
        url: "https://a.example/p/1",
        title: "Hello",
        date_published: "2024-01-01T00:00:00Z",
        summary: "Short publisher summary.",
        content_html: "<nav>Chrome</nav><p>Long body copy here.</p>",
        tags: ["design"],
      },
    ],
  });
  const items = contentItemsFromJsonFeed(json, {
    feedUrl: "https://a.example/feed.json",
    siteOrigin: "https://a.example",
    observedAt: "2026-11-01T00:00:00.000Z",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].summary, "Short publisher summary.");
  assert.equal(items[0].declared_topics[0]?.slug, "design");
});

test("contentItemsFromRssOrAtom: prefers media:description when no summary", () => {
  const xml = `<?xml version="1.0"?>
  <rss><channel>
    <item>
      <title>Clip</title>
      <link>https://a.example/clip/</link>
      <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
      <media:description>Media blurb for the clip.</media:description>
      <description>Fallback description chrome</description>
    </item>
  </channel></rss>`;
  const items = contentItemsFromRssOrAtom(xml, RSS_META);
  assert.equal(items.length, 1);
  assert.match(items[0].summary, /Media blurb/);
});

test("contentItemsFromRssOrAtom: Atom updated used when published and pubDate absent", () => {
  const xml = `<?xml version="1.0"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <title>Only updated</title>
      <link href="https://a.example/u/"/>
      <updated>2024-02-02T00:00:00Z</updated>
      <summary>Atom summary text here.</summary>
    </entry>
  </feed>`;
  const items = contentItemsFromRssOrAtom(xml, ATOM_META);
  assert.equal(items.length, 1);
  assert.equal(items[0].published_at, "2024-02-02T00:00:00.000Z");
  assert.match(items[0].summary, /Atom summary/);
});

test("contentItemsFromJsonFeed: content_text and content_html fallbacks", () => {
  const textOnly = contentItemsFromJsonFeed(
    JSON.stringify({
      version: "https://jsonfeed.org/version/1",
      items: [
        {
          id: "t",
          url: "https://a.example/t",
          title: "T",
          date_published: "2024-01-01T00:00:00Z",
          content_text: "Plain text body for the item.",
        },
      ],
    }),
    {
      feedUrl: "https://a.example/feed.json",
      siteOrigin: "https://a.example",
      observedAt: "2026-11-01T00:00:00.000Z",
    },
  );
  assert.match(textOnly[0].summary, /Plain text body/);

  const htmlOnly = contentItemsFromJsonFeed(
    JSON.stringify({
      version: "https://jsonfeed.org/version/1",
      items: [
        {
          id: "h",
          url: "https://a.example/h",
          title: "H",
          date_published: "2024-01-01T00:00:00Z",
          content_html: "<p>HTML body for the item.</p>",
        },
      ],
    }),
    {
      feedUrl: "https://a.example/feed.json",
      siteOrigin: "https://a.example",
      observedAt: "2026-11-01T00:00:00.000Z",
    },
  );
  assert.match(htmlOnly[0].summary, /HTML body/);

  const neither = contentItemsFromJsonFeed(
    JSON.stringify({
      version: "https://jsonfeed.org/version/1",
      items: [
        {
          id: "n",
          url: "https://a.example/n",
          title: "N",
          date_published: "2024-01-01T00:00:00Z",
          content_html: 12,
        },
      ],
    }),
    {
      feedUrl: "https://a.example/feed.json",
      siteOrigin: "https://a.example",
      observedAt: "2026-11-01T00:00:00.000Z",
    },
  );
  assert.equal(neither[0].summary, "");
});

test("contentItemsFromJsonFeed: prefers item.language over feed language", () => {
  const items = contentItemsFromJsonFeed(
    JSON.stringify({
      language: "en",
      items: [
        {
          id: "lang-item",
          url: "https://a.example/fr-post/",
          title: "Bonjour",
          language: "fr-CA",
          date_published: "2024-01-01T00:00:00Z",
        },
      ],
    }),
    JSON_META,
  );

  assert.equal(items[0].language, "fr-ca");
});

test("joinContentWithPageSignals: invalid language tags become null", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/bad-lang/",
        url: "https://a.example/bad-lang/",
        language: "!!!",
        title: "2014",
        summary: "",
        declared_topics: [],
      },
    ],
    [
      {
        pages: [
          {
            url: "https://a.example/bad-lang/",
            lang: "not a tag!!!",
            share_description: "<p></p>",
          },
        ],
        declared_topics: [],
      },
    ],
  );

  assert.equal(joined[0].language, null);
  assert.equal(joined[0].title, "2014");
});

test("contentItemsFromHEntryList: empty u-url href skips the entry", () => {
  const notes = contentItemsFromHEntryList(
    `<article class="h-entry"><a class="u-url" href=""></a><p class="e-content">blank</p></article>
     <article class="h-entry"><a class="u-url" href="/notes/ok/"><span class="p-name">Ok</span></a>
     <time class="dt-published" datetime=""></time><p class="e-content">body</p></article>`,
    {
      pageUrl: "https://a.example/notes/",
      siteOrigin: "https://a.example",
      observedAt: "2026-11-01T00:00:00.000Z",
    },
  );

  assert.equal(notes.length, 1);
  assert.equal(notes[0].url, "https://a.example/notes/ok/");
  assert.equal(notes[0].published_at, null);
});

test("contentItemsFromHEntryList: Artlung-shaped p-name on anchor keeps title and body summary", () => {
  const items = contentItemsFromHEntryList(
    `<div class="h-entry category-general tag-swim2026">
      <h1 class="title post-header">
        <a href="https://joshua.example/blog/2026/11/03/and-shredding/" class="u-url p-name post-header-inner">
          <span class="header-text">and shredding…</span>
        </a>
      </h1>
      <div class="inner-content e-content post-body">
        <p>I went relatively early this morning.</p>
        <p>I didn't catch much in the way of waves.</p>
        <p>But I got thrown around a good deal.</p>
      </div>
      <a href="https://joshua.example/blog/tag/swim2026/" rel="tag" class="p-category">swim2026</a>
      <time class="dt-published" datetime="2026-11-03T16:15:36"></time>
    </div>`,
    {
      pageUrl: "https://joshua.example/blog/2026/11/03/and-shredding/",
      siteOrigin: "https://joshua.example",
      observedAt: "2026-11-07T00:00:00.000Z",
    },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "and shredding…");
  assert.match(items[0].summary, /relatively early this morning/i);
  assert.equal(items[0].content_type, "note");
  assert.equal(items[0].page_role, "note");
  assert.equal(
    items[0].declared_topics.some((topic) => topic.slug === "swim2026"),
    true,
  );
});

test("titleLooksLikeBodyStandIn and shouldPreferDraftTitle recover feed headings", () => {
  assert.equal(
    titleLooksLikeBodyStandIn(
      "I went relatively early this morning.",
      "I went relatively early this morning. I didn't catch much.",
    ),
    true,
  );
  assert.equal(
    titleLooksLikeBodyStandIn("and shredding…", "I went relatively early."),
    false,
  );
  assert.equal(
    titleLooksLikeBodyStandIn(`${"word ".repeat(40).trim()}.`, ""),
    true,
  );
  assert.equal(titleLooksLikeBodyStandIn("", "body text"), true);
  assert.equal(titleLooksLikeBodyStandIn(null, ""), true);
  assert.equal(titleLooksLikeBodyStandIn("Hello", 12), false);
  assert.equal(titleLooksLikeBodyStandIn("Hello", null), false);
  assert.equal(
    titleLooksLikeBodyStandIn("Waves were soft this morning today.", ""),
    true,
  );
  assert.equal(
    contentTypeForPersonalJournal("", [{ slug: "bodysurfing" }]),
    "note",
  );
  assert.equal(contentTypeForPersonalJournal("article", ["surfing"]), "note");
  assert.equal(contentTypeForPersonalJournal("video", []), "video");
  assert.equal(
    shouldPreferDraftTitle(
      "I went relatively early this morning.",
      "",
      "and shredding…",
      "I went relatively early this morning. I didn't catch much.",
    ),
    true,
  );
  assert.equal(
    shouldPreferDraftTitle(
      "and shredding…",
      "I went relatively early.",
      "I went relatively early this morning.",
      "",
    ),
    false,
  );
  assert.equal(
    shouldPreferDraftTitle(
      "I went relatively early this morning and stayed for a long set.",
      "I went relatively early this morning and stayed for a long set. Soft waves.",
      "I went early.",
      "I went early. Soft waves after sunrise on a quiet beach day.",
    ),
    true,
  );
  assert.equal(mf2NameFromHtml(""), "");
  assert.equal(mf2NameFromHtml(null), "");
  assert.equal(
    mf2NameFromHtml(`<span class="p-name" value="Named"></span>`),
    "Named",
  );
  assert.equal(applyPersonalJournalTyping(null), null);
  assert.equal(
    contentTypeForPersonalJournal("article", [{ slug: "" }]),
    "article",
  );
});

test("contentItemsFromHEntryList covers unclosed and nested e-content", () => {
  assert.deepEqual(
    contentItemsFromHEntryList("", {
      pageUrl: "https://joshua.example/",
      siteOrigin: "https://joshua.example",
      observedAt: "2026-11-03T00:00:00.000Z",
    }),
    [],
  );
  const unclosed = contentItemsFromHEntryList(
    `<article class="h-entry"><a class="u-url" href="/notes/open/"><span class="p-name">Open</span></a>
     <div class="e-content"><div>still open</div></article>`,
    {
      pageUrl: "https://joshua.example/notes/",
      siteOrigin: "https://joshua.example",
      observedAt: "2026-11-03T00:00:00.000Z",
    },
  );
  assert.equal(unclosed.length, 1);
  assert.match(String(unclosed[0].summary || ""), /still open/i);

  const trailingInner = contentItemsFromHEntryList(
    `<article class="h-entry"><a class="u-url" href="/notes/trail/"><span class="p-name">Trail</span></a>
     <div class="e-content"><div>only inner</div></article>`,
    {
      pageUrl: "https://joshua.example/notes/",
      siteOrigin: "https://joshua.example",
      observedAt: "2026-11-03T00:00:00.000Z",
    },
  );
  assert.equal(trailingInner.length, 1);
  assert.match(String(trailingInner[0].summary || ""), /only inner/i);

  const nested = contentItemsFromHEntryList(
    `<article class="h-entry">
       <a class="u-url" href="/notes/nest/"><span class="p-name">Nest</span></a>
       <div class="e-content">outer <div>inner <div>deep</div></div> after</div>
       <span class="p-category">surf</span>
       <span class="p-category"></span>
     </article>
     <article class="h-entry"><div class="e-content">no url</div></article>`,
    {
      pageUrl: "https://joshua.example/notes/",
      siteOrigin: "https://joshua.example",
      observedAt: "2026-11-03T00:00:00.000Z",
    },
  );
  assert.ok(nested.some((item) => item.title === "Nest"));
  assert.ok(
    nested.some((item) =>
      (item.declared_topics || []).some((topic) => topic.slug === "surf"),
    ),
  );

  const unclosedEntry = contentItemsFromHEntryList(
    `<div class="h-entry"><a class="u-url" href="/notes/hang/"><span class="p-name">Hang</span></a>
     <p class="e-content">body</p>`,
    {
      pageUrl: "https://joshua.example/notes/",
      siteOrigin: "https://joshua.example",
      observedAt: "2026-11-03T00:00:00.000Z",
    },
  );
  assert.equal(unclosedEntry.length, 0);
});

test("mergeContentItems prefers a longer share summary over a body-as-title shell", () => {
  const key = "url:https://joshua.example/blog/share-upgrade/";
  const merged = mergeContentItems([
    {
      identity: key,
      url: "https://joshua.example/blog/share-upgrade/",
      title: "I went relatively early this morning.",
      summary: "I went relatively early this morning.",
      content_type: "article",
      source_feeds: [{ type: "h-entry", url: key }],
      declared_topics: [],
    },
    {
      identity: key,
      url: "https://joshua.example/blog/share-upgrade/",
      title: "I went relatively early this morning.",
      summary:
        "I went relatively early this morning and the water was glass before the wind came up.",
      content_type: "article",
      source_feeds: [{ type: "rss", url: "https://joshua.example/feed/" }],
      declared_topics: [],
    },
  ]);
  assert.match(merged[0].summary, /water was glass/i);
});

test("RSS swim categories mark note page_role and join keeps note roles", () => {
  const items = contentItemsFromRssOrAtom(
    `<?xml version="1.0"?><rss version="2.0"><channel>
      <item>
        <title>Morning swim</title>
        <link>https://joshua.example/blog/swim/</link>
        <category>swim2026</category>
        <description>In the water.</description>
      </item>
    </channel></rss>`,
    {
      feedUrl: "https://joshua.example/feed.xml",
      siteOrigin: "https://joshua.example",
      observedAt: "2026-11-03T00:00:00.000Z",
    },
  );
  assert.equal(items[0].content_type, "note");
  assert.equal(items[0].page_role, "note");

  const joined = joinContentWithPageSignals(items, [
    {
      origin: "https://joshua.example",
      pages: [
        {
          url: "https://joshua.example/blog/swim/",
          page_role: "article",
          lang: "en",
        },
      ],
    },
  ]);
  assert.equal(joined[0].page_role, "note");
});

test("mergeContentItems: RSS heading replaces h-entry body-as-title stand-in", () => {
  const key = "url:https://joshua.example/blog/2026/11/03/and-shredding/";
  const merged = mergeContentItems([
    {
      identity: key,
      url: "https://joshua.example/blog/2026/11/03/and-shredding/",
      title: "I went relatively early this morning.",
      summary: "",
      content_type: "article",
      source_feeds: [{ type: "h-entry", url: key }],
      declared_topics: [],
    },
    {
      identity: key,
      url: "https://joshua.example/blog/2026/11/03/and-shredding/",
      title: "and shredding…",
      summary:
        "I went relatively early this morning. I didn't catch much in the way of waves.",
      content_type: "article",
      source_feeds: [{ type: "rss", url: "https://joshua.example/feed/" }],
      declared_topics: [
        {
          slug: "swim2026",
          label: "swim2026",
          source: "rss:category",
          community_eligible: true,
        },
      ],
    },
  ]);

  assert.equal(merged[0].title, "and shredding…");
  assert.match(merged[0].summary, /relatively early/i);
  assert.equal(merged[0].content_type, "note");
  assert.equal(merged[0].page_role, "note");
});

test("contentTypeForPersonalJournal: swimYYYY and surfing topics become notes", () => {
  assert.equal(
    contentTypeForPersonalJournal("article", [{ slug: "swim2026" }]),
    "note",
  );
  assert.equal(
    contentTypeForPersonalJournal("article", [{ slug: "bodysurfing" }]),
    "note",
  );
  assert.equal(
    contentTypeForPersonalJournal("podcast_episode", [{ slug: "swim2026" }]),
    "podcast_episode",
  );
  assert.equal(
    contentTypeForPersonalJournal("article", [{ slug: "programming" }]),
    "article",
  );
});

test("entryTitleFromHtml prefers h-entry p-name on anchors", () => {
  const title = entryTitleFromHtml(`<!doctype html><html><body>
    <div class="h-entry">
      <a class="u-url p-name" href="/post/"><span class="header-text">and shredding…</span></a>
      <div class="e-content"><p>I went relatively early this morning.</p></div>
    </div>
  </body></html>`);
  assert.equal(title, "and shredding…");
});

test("enrichContentItemPosters upgrades body-as-title and fills the journal summary", async () => {
  const items = [
    {
      identity: "url:https://joshua.example/blog/swim/",
      url: "https://joshua.example/blog/swim/",
      title: "I went relatively early this morning.",
      summary: "",
      content_type: "article",
      image: "https://joshua.example/poster.jpg",
      declared_topics: [{ slug: "swim2026", label: "swim2026" }],
    },
  ];

  await enrichContentItemPosters(items, {
    robotsGate: ALLOW_ALL_ROBOTS,
    fetchText: async () => ({
      url: "https://joshua.example/blog/swim/",
      body: `<div class="h-entry">
        <a class="u-url p-name" href="/blog/swim/"><span>and shredding…</span></a>
        <div class="e-content">
          <p>I went relatively early this morning.</p>
          <p>I didn't catch much in the way of waves.</p>
        </div>
      </div>`,
    }),
  });

  assert.equal(items[0].title, "and shredding…");
  assert.match(items[0].summary, /relatively early this morning/i);
  assert.equal(items[0].content_type, "note");
});

test("contentItemsFromRssOrAtom: reads feed and entry language tags", () => {
  const atom = contentItemsFromRssOrAtom(
    `<?xml version="1.0"?>
     <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="de">
       <entry>
         <title>Eins</title>
         <link href="https://a.example/eins/" rel="alternate"/>
         <id>https://a.example/eins/</id>
         <updated>2024-01-01T00:00:00Z</updated>
       </entry>
     </feed>`,
    {
      feedUrl: "https://a.example/atom.xml",
      siteOrigin: "https://a.example",
      feedKind: "atom",
      observedAt: "2026-11-01T00:00:00.000Z",
    },
  );
  assert.equal(atom[0].language, "de");

  const atomEntryLang = contentItemsFromRssOrAtom(
    `<?xml version="1.0"?>
     <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
       <entry xml:lang="es">
         <title>Hola</title>
         <link href="https://a.example/hola/" rel="alternate"/>
         <id>https://a.example/hola/</id>
         <updated>2024-01-01T00:00:00Z</updated>
       </entry>
     </feed>`,
    {
      feedUrl: "https://a.example/atom.xml",
      siteOrigin: "https://a.example",
      feedKind: "atom",
      observedAt: "2026-11-01T00:00:00.000Z",
    },
  );
  assert.equal(atomEntryLang[0].language, "es");

  const rss = contentItemsFromRssOrAtom(
    `<?xml version="1.0"?>
     <rss version="2.0"><channel>
       <language>pt-BR</language>
       <item>
         <title>Oi</title>
         <link>https://a.example/oi/</link>
         <guid>https://a.example/oi/</guid>
         <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
       </item>
     </channel></rss>`,
    {
      feedUrl: "https://a.example/rss.xml",
      siteOrigin: "https://a.example",
      feedKind: "rss",
      observedAt: "2026-11-01T00:00:00.000Z",
    },
  );
  assert.equal(rss[0].language, "pt-br");
});
