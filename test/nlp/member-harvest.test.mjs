/**
 * Goal & Constraints:
 * Layout-shaped harvest fixtures for Steele / Beard / Tronic / podcasts.
 * Assert first-party creative typing without live network calls.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  audioEnclosureUrlFromFeedChunk,
  contentItemsFromArchiveEntryList,
  contentItemsFromHEntryList,
  contentItemsFromHugoIndexJson,
  contentItemsFromRssOrAtom,
  firstPartyContentTypeFromTitle,
  isListeningCurationTitle,
  isPodcastFeedItem,
  rssOrAtomEntryTitle,
} from "../../scripts/nlp/content.mjs";
import {
  collectCreativeWorks,
  creativeItemsFromAlbumList,
  creativeItemsFromExternalListenLinks,
  creativeItemsFromHomepageLinks,
  creativeItemsFromProjectsIndex,
  isExternalProductProjectUrl,
  shelfLinkTitleAndSummary,
} from "../../scripts/nlp/creative.mjs";
import { classifyPageRole } from "../../scripts/nlp/page-role.mjs";
import {
  buildViewDocuments,
  isExternalShelfProject,
  isMadeContentItem,
  showcaseKind,
  showcaseKindForItem,
} from "../../scripts/views/lib.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} relative
 * @returns {string}
 */
function readFixture(relative) {
  return fs.readFileSync(path.join(root, "fixtures", relative), "utf8");
}

const RSS_META = {
  feedUrl: "https://joshuapsteele.com/feed.xml",
  feedKind: /** @type {'rss'} */ ("rss"),
  siteOrigin: "https://joshuapsteele.com",
  observedAt: "2026-11-01T12:00:00.000Z",
};

test("empty RSS title falls back to description (Steele notes)", () => {
  const items = contentItemsFromRssOrAtom(
    readFixture("feeds/steele-feed-snippet.xml"),
    RSS_META,
  );
  const note = items.find((item) =>
    String(item.url || "").includes("/notes/2026-08-30-0952"),
  );

  assert.ok(note);
  assert.match(String(note.title), /historical overview/i);
  assert.doesNotMatch(String(note.title), /^https-/);
});

test("first-party [Photo] title becomes photograph; listening curation stays article", () => {
  assert.equal(
    firstPartyContentTypeFromTitle("[Photo] Northern Lights", "article"),
    "photograph",
  );
  assert.equal(isListeningCurationTitle("Albums I listened to in 2022"), true);

  const items = contentItemsFromRssOrAtom(
    readFixture("feeds/steele-feed-snippet.xml"),
    {
      ...RSS_META,
      feedUrl: "https://example.com/feed.xml",
      siteOrigin: "https://example.com",
    },
  );
  // Cross-origin URLs in the shared fixture are skipped by identity rules when
  // siteOrigin mismatches — re-parse with matching origins per item via title helpers.
  assert.equal(
    firstPartyContentTypeFromTitle("Albums I listened to in 2022", "article"),
    "article",
  );
});

test("podcast enclosure + itunes tags → podcast_episode with listen action", () => {
  const items = contentItemsFromRssOrAtom(
    readFixture("feeds/podcast-enclosure-snippet.xml"),
    {
      feedUrl: "https://example.com/podcast.xml",
      feedKind: "rss",
      siteOrigin: "https://example.com",
      observedAt: "2026-11-01T12:00:00.000Z",
    },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].content_type, "podcast_episode");
  assert.equal(items[0].actions?.[0]?.type, "listen");
  assert.match(String(items[0].actions?.[0]?.url), /\.mp3$/);
  assert.equal(showcaseKind("podcast_episode"), "podcasts");
});

test("Hugo index.json array maps permalink + empty title fallback", () => {
  const items = contentItemsFromHugoIndexJson(
    readFixture("feeds/steele-index.json"),
    {
      feedUrl: "https://joshuapsteele.com/index.json",
      siteOrigin: "https://joshuapsteele.com",
      observedAt: "2026-11-01T12:00:00.000Z",
    },
  );

  assert.equal(items.length, 2);
  assert.match(String(items[0].title), /historical overview/i);
  assert.equal(items[1].title, "I Finally Found Wide Soccer Cleats");
});

test("PaperMod archive-entry list and h-entry notes", () => {
  const archive = contentItemsFromArchiveEntryList(
    readFixture("html/steele/blog-index.html"),
    {
      pageUrl: "https://joshuapsteele.com/blog/",
      siteOrigin: "https://joshuapsteele.com",
      observedAt: "2026-11-01T12:00:00.000Z",
    },
  );

  assert.ok(archive.length >= 2);
  assert.equal(
    archive[0].url,
    "https://joshuapsteele.com/i-finally-found-wide-soccer-cleats/",
  );

  const notes = contentItemsFromHEntryList(
    readFixture("html/steele/home.html"),
    {
      pageUrl: "https://joshuapsteele.com/",
      siteOrigin: "https://joshuapsteele.com",
      observedAt: "2026-11-01T12:00:00.000Z",
    },
  );

  assert.ok(notes.length >= 1);
  assert.match(String(notes[0].url), /\/notes\/2026-08-30-0952/);
});

test("Steele homepage popular posts are not creative projects", () => {
  const items = creativeItemsFromHomepageLinks(
    readFixture("html/steele/home.html"),
    "https://joshuapsteele.com/",
    "https://joshuapsteele.com",
    "2026-11-01T12:00:00.000Z",
  );

  assert.equal(
    items.filter((item) => String(item.url || "").includes("fascism")).length,
    0,
  );
});

test("Beard album-in-list year cards → photography collections", () => {
  const albums = creativeItemsFromAlbumList(
    readFixture("html/beard-photos-index.html"),
    "https://joshbeard.com/photos/",
    "https://joshbeard.com",
    "2026-11-01T12:00:00.000Z",
  );

  assert.ok(albums.length >= 2);
  assert.equal(albums[0].content_type, "collection");
  assert.equal(albums[0].title, "2026");
  assert.equal(showcaseKindForItem(albums[0]), "photography");

  const collected = collectCreativeWorks(
    [
      {
        url: "https://joshbeard.com/photos/",
        html: readFixture("html/beard-photos-index.html"),
      },
    ],
    {
      siteOrigin: "https://joshbeard.com",
      observedAt: "2026-11-01T12:00:00.000Z",
    },
  );

  assert.ok(collected.items.some((item) => item.title === "2026"));
});

test("joshtronic /sounds/ YouTube links become music_recording listen actions", () => {
  const items = creativeItemsFromExternalListenLinks(
    readFixture("html/joshtronic-sounds.html"),
    "https://joshtronic.com/sounds/",
    "https://joshtronic.com",
    "2026-11-01T12:00:00.000Z",
  );

  assert.ok(items.length >= 1);
  assert.equal(items[0].content_type, "music_recording");
  assert.equal(items[0].url, "https://joshtronic.com/sounds/");
  assert.match(String(items[0].actions?.[0]?.url), /youtube\.com/);
});

test("homepage shelf tolerates Prettier-wrapped </a> and </span> closers", () => {
  const html = `<!doctype html><html><body><main>
<section aria-labelledby="projects-heading"><h2 id="projects-heading">Projects</h2>
<ul><li><a href="https://themorning.app"
  ><span class="font-medium">The Morning App</span
  ><span class="text-muted"
    >Wake up well.</span
  ></a
></li></ul></section></main></body></html>`;
  const items = creativeItemsFromHomepageLinks(
    html,
    "https://joshgr.com/",
    "https://joshgr.com",
    "2026-11-01T12:00:00.000Z",
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "The Morning App");
  assert.equal(items[0].url, "https://themorning.app/");
  assert.match(String(items[0].summary || ""), /Wake up well/);
});

test("joshgr Projects shelf harvests Morning App, Wizardly Words, MusicX, Seedling", () => {
  const observedAt = "2026-11-01T12:00:00.000Z";
  const siteOrigin = "https://joshgr.com";
  const home = creativeItemsFromHomepageLinks(
    readFixture("html/joshgr-home-projects.html"),
    "https://joshgr.com/",
    siteOrigin,
    observedAt,
  );
  const byTitle = Object.fromEntries(home.map((item) => [item.title, item]));

  assert.equal(byTitle["The Morning App"]?.url, "https://themorning.app/");
  assert.equal(
    byTitle["Wizardly Words"]?.url,
    "https://joshgr.com/wizardly-words/",
  );
  assert.equal(byTitle.MusicX?.url, "https://github.com/joshgrant/MusicX");
  assert.match(String(byTitle.Seedling?.url || ""), /apps\.apple\.com/);
  assert.equal(byTitle["The Morning App"]?.site_origin, siteOrigin);
  assert.equal(
    byTitle["The Morning App"]?.source?.kind,
    "creative-homepage-shelf",
  );
  assert.match(
    String(byTitle["The Morning App"]?.summary || ""),
    /wakefulness/i,
  );

  // Bare GitHub profile in nav is not a project.
  assert.equal(
    home.some((item) => item.url === "https://github.com/joshgrant"),
    false,
  );

  const fromIndex = creativeItemsFromProjectsIndex(
    readFixture("html/joshgr-projects-index.html"),
    "https://joshgr.com/projects/",
    siteOrigin,
    observedAt,
  );

  assert.equal(fromIndex.length, 4);
  assert.ok(
    fromIndex.every((item) => item.source?.kind === "creative-projects-shelf"),
  );

  const collected = collectCreativeWorks(
    [
      {
        url: "https://joshgr.com/",
        html: readFixture("html/joshgr-home-projects.html"),
      },
      {
        url: "https://joshgr.com/projects/",
        html: readFixture("html/joshgr-projects-index.html"),
      },
    ],
    { siteOrigin, observedAt },
  );

  assert.equal(
    collected.items.filter((item) => item.content_type === "project").length,
    4,
  );

  assert.equal(
    isExternalShelfProject({
      url: "https://themorning.app/",
      site_origin: siteOrigin,
      source_kind: "creative-homepage-shelf",
      content_type: "project",
      title: "The Morning App",
      summary: "The transition from sleep to wakefulness is powerful.",
    }),
    true,
  );
  assert.equal(
    isMadeContentItem({
      url: "https://themorning.app/",
      site_origin: siteOrigin,
      source_kind: "creative-homepage-shelf",
      content_type: "project",
      title: "The Morning App",
      summary: "The transition from sleep to wakefulness is powerful.",
    }),
    true,
  );
  assert.equal(
    isMadeContentItem({
      url: "https://github.com/joshgrant/MusicX",
      site_origin: siteOrigin,
      source_kind: "creative-projects-shelf",
      content_type: "project",
      title: "MusicX",
      summary: "What does the musical desert look like?",
    }),
    true,
  );
  assert.equal(
    isMadeContentItem({
      url: "https://apps.apple.com/us/app/seedling-daily-planner/id1516093618",
      site_origin: siteOrigin,
      source_kind: "creative-projects-shelf",
      content_type: "project",
      title: "Seedling",
      summary: "Daily planner for iOS",
    }),
    true,
  );
  // Member's own homepage stays excluded.
  assert.equal(
    isMadeContentItem({
      url: "https://joshgr.com/",
      site_origin: siteOrigin,
      source_kind: "creative-homepage-shelf",
      content_type: "project",
      title: "Josh Grant",
      summary: "Exploring systems on the member homepage itself",
    }),
    false,
  );

  assert.equal(
    isExternalProductProjectUrl("https://github.com/joshgrant", siteOrigin),
    false,
  );
  assert.equal(
    isExternalProductProjectUrl(
      "https://github.com/joshgrant/MusicX",
      siteOrigin,
    ),
    true,
  );
  assert.deepEqual(
    shelfLinkTitleAndSummary(
      `<span class="font-medium">Seedling</span><span class="text-muted">Daily planner</span>`,
    ),
    { title: "Seedling", summary: "Daily planner" },
  );
});

test("page_role note for /notes/YYYY-MM-DD-HHMM", () => {
  assert.equal(
    classifyPageRole("https://joshuapsteele.com/notes/2026-08-30-0952/"),
    "note",
  );
  assert.equal(classifyPageRole("https://joshbeard.com/photos/"), "portfolio");
});

test("What's New backfills quiet origins outside the 7-day window", () => {
  const generatedAt = "2026-11-01T12:00:00.000Z";
  const docs = buildViewDocuments({
    generatedAt,
    now: new Date(generatedAt),
    network: [
      {
        origin: "https://joshuapsteele.com",
        domain: "joshuapsteele.com",
        title: "Joshua P. Steele",
        identity: "affirmed",
      },
    ],
    content: {
      schema_version: 1,
      generated_at: generatedAt,
      items: [
        {
          identity: "url:https://joshuapsteele.com/notes/old/",
          url: "https://joshuapsteele.com/notes/old/",
          site_origin: "https://joshuapsteele.com",
          title: "Quiet note from August",
          content_type: "article",
          published_at: "2026-08-30T13:52:32.000Z",
          summary: "Older than seven days",
          source: { kind: "rss", feed: "https://joshuapsteele.com/feed.xml" },
          observed_at: generatedAt,
        },
      ],
    },
    connections: { schema_version: 1, generated_at: generatedAt, edges: [] },
    topics: { schema_version: 1, generated_at: generatedAt, communities: [] },
    siteSignals: { schema_version: 1, generated_at: generatedAt, origins: [] },
  });

  assert.ok(
    docs.activity.primary.some(
      (item) => item.title === "Quiet note from August",
    ),
  );
});

test("What's New backfill includes podcast_episode and skips non-string origins", () => {
  const generatedAt = "2026-11-01T12:00:00.000Z";
  const docs = buildViewDocuments({
    generatedAt,
    now: new Date(generatedAt),
    network: [
      {
        origin: "https://pod.example",
        domain: "pod.example",
        title: "Pod",
        identity: "affirmed",
      },
    ],
    content: {
      schema_version: 1,
      generated_at: generatedAt,
      items: [
        {
          identity: "url:https://pod.example/ep/1/",
          url: "https://pod.example/ep/1/",
          site_origin: "https://pod.example",
          title: "Old episode",
          content_type: "podcast_episode",
          published_at: "2026-01-01T00:00:00.000Z",
          summary: "Episode",
          source: { kind: "rss", feed: "https://pod.example/feed.xml" },
          observed_at: generatedAt,
        },
        {
          identity: "url:https://orphan.example/x/",
          url: "https://orphan.example/x/",
          site_origin: 123,
          title: "Bad origin",
          content_type: "article",
          published_at: "2026-01-01T00:00:00.000Z",
          observed_at: generatedAt,
        },
      ],
    },
    connections: { schema_version: 1, generated_at: generatedAt, edges: [] },
    topics: { schema_version: 1, generated_at: generatedAt, communities: [] },
    siteSignals: { schema_version: 1, generated_at: generatedAt, origins: [] },
  });

  assert.ok(docs.activity.primary.some((item) => item.title === "Old episode"));
});

test("audioEnclosureUrlFromFeedChunk: empty input, skips, atom link, invalid base", () => {
  assert.equal(audioEnclosureUrlFromFeedChunk("", "https://a.example/"), "");
  assert.equal(audioEnclosureUrlFromFeedChunk(null, "https://a.example/"), "");
  assert.equal(
    audioEnclosureUrlFromFeedChunk(
      `<enclosure url="https://a.example/x.png" type="image/png" />`,
      "https://a.example/",
    ),
    "",
  );
  assert.equal(
    audioEnclosureUrlFromFeedChunk(
      `<link rel="enclosure" type="audio/mpeg" href="https://a.example/ep.mp3" />`,
      "https://a.example/",
    ),
    "https://a.example/ep.mp3",
  );
  assert.equal(
    audioEnclosureUrlFromFeedChunk(
      `<link rel="enclosure" href="/ep.mp3" type="audio/mpeg" />`,
      "not-a-base",
    ),
    "/ep.mp3",
  );
  assert.equal(
    audioEnclosureUrlFromFeedChunk(
      `<enclosure url="/rel.mp3" type="audio/mpeg" />`,
      "not-a-base",
    ),
    "/rel.mp3",
  );
});

test("isPodcastFeedItem: empty and itunes-only without enclosure", () => {
  assert.equal(isPodcastFeedItem("", "https://a.example/"), false);
  assert.equal(isPodcastFeedItem(null, "https://a.example/"), false);
  assert.equal(
    isPodcastFeedItem(
      `<item><title>Solo</title><itunes:episodeType>full</itunes:episodeType></item>`,
      "https://a.example/",
    ),
    true,
  );
});

test("rssOrAtomEntryTitle: content body fallback then slug", () => {
  assert.match(
    rssOrAtomEntryTitle(
      `<item><title/><content:encoded><![CDATA[<p>Body only title source</p>]]></content:encoded></item>`,
      "https://joshuapsteele.com/notes/x/",
      "",
    ),
    /Body only title source/,
  );
  assert.equal(
    rssOrAtomEntryTitle(`<item><title/></item>`, "", ""),
    "Untitled",
  );
});

test("Hugo index.json edge branches", () => {
  const meta = {
    feedUrl: "https://joshuapsteele.com/index.json",
    siteOrigin: "https://joshuapsteele.com",
    observedAt: "2026-11-01T12:00:00.000Z",
  };

  assert.deepEqual(contentItemsFromHugoIndexJson("{", meta), []);
  assert.deepEqual(contentItemsFromHugoIndexJson('{"items":[]}', meta), []);
  assert.deepEqual(contentItemsFromHugoIndexJson('[null,1,"x"]', meta), []);

  const withUrl = contentItemsFromHugoIndexJson(
    JSON.stringify([
      {
        url: "https://joshuapsteele.com/post/",
        title: "Albums I listened to in 2022",
        summary: "curation",
      },
      { permalink: "https://exa mple.com/bad", title: "Bad" },
      { title: "No url" },
      {
        id: "id-only-post",
        title: "Id without permalink",
        content: "body used as summary",
      },
      {
        permalink: "https://joshuapsteele.com/dated/",
        title: "Dated",
        date_published: "2026-01-02T00:00:00Z",
      },
      {
        permalink: "https://joshuapsteele.com/hugo-date/",
        title: "Hugo date field",
        date: "2026-03-04T00:00:00Z",
      },
      {
        permalink: "https://joshuapsteele.com/photo-listen/",
        title: "[Photo] Albums I listened to",
      },
    ]),
    meta,
  );

  assert.ok(
    withUrl.some(
      (item) =>
        item.title === "Albums I listened to in 2022" &&
        item.content_type === "article",
    ),
  );
  assert.ok(
    withUrl.some(
      (item) =>
        item.url === "https://joshuapsteele.com/dated/" &&
        item.published_at === "2026-01-02T00:00:00.000Z",
    ),
  );
  assert.ok(
    withUrl.some(
      (item) =>
        item.title === "Id without permalink" &&
        item.url === null &&
        item.summary.includes("body used as summary"),
    ),
  );
  assert.ok(
    withUrl.some(
      (item) =>
        item.url === "https://joshuapsteele.com/hugo-date/" &&
        item.published_at === "2026-03-04T00:00:00.000Z",
    ),
  );
  assert.ok(
    withUrl.some(
      (item) =>
        item.url === "https://joshuapsteele.com/photo-listen/" &&
        item.content_type === "photograph",
    ),
  );
});

test("archive-entry and h-entry edge branches", () => {
  const meta = {
    pageUrl: "https://joshuapsteele.com/blog/",
    siteOrigin: "https://joshuapsteele.com",
    observedAt: "2026-11-01T12:00:00.000Z",
  };

  assert.deepEqual(contentItemsFromArchiveEntryList("", meta), []);
  assert.deepEqual(contentItemsFromArchiveEntryList(null, meta), []);
  assert.deepEqual(contentItemsFromHEntryList("", meta), []);
  assert.deepEqual(contentItemsFromHEntryList(null, meta), []);

  // Non-empty HTML with neither archive-entry blocks nor title marker → [].
  assert.deepEqual(
    contentItemsFromArchiveEntryList("<div>plain blog chrome</div>", meta),
    [],
  );

  // Substring present without class=…archive-entry… → whole-document fallback.
  const fallbackDoc = contentItemsFromArchiveEntryList(
    `<!-- archive-entry-title marker -->`,
    meta,
  );
  assert.deepEqual(fallbackDoc, []);

  const hrefClassOrder = contentItemsFromArchiveEntryList(
    `<a href="/href-first/" class="archive-entry-title">Href First</a>
     <time datetime="2026-05-01T00:00:00Z">May 1</time>`,
    meta,
  );
  assert.equal(hrefClassOrder[0].url, "https://joshuapsteele.com/href-first/");
  assert.equal(hrefClassOrder[0].published_at, "2026-05-01T00:00:00.000Z");

  const badAndForeign = contentItemsFromArchiveEntryList(
    `<h2 class="archive-entry-title"><a href="https://exa mple.com/bad">Bad</a></h2>
     <h2 class="archive-entry-title"><a href="https://other.example/x/">Foreign</a></h2>
     <h2 class="archive-entry-title"><a href="/empty-title/"></a></h2>
     <h2 class="archive-entry-title"><a href="/dup/">First</a></h2>
     <h2 class="archive-entry-title"><a href="/dup/">Second</a></h2>`,
    meta,
  );
  assert.equal(
    badAndForeign.filter((item) => item.url.includes("/dup/")).length,
    1,
  );

  const notes = contentItemsFromHEntryList(
    `<article class="h-entry"><a class="u-url" href="https://exa mple.com/bad">x</a></article>
     <article class="h-entry"><a class="u-url" href="https://other.example/n/">x</a><p class="e-content">hi</p></article>
     <article class="h-entry"><a class="u-url" href="/notes/blank/"></a></article>
     <article class="h-entry"><p class="e-content">No permalink</p></article>
     <article class="h-entry"><a href="/notes/ok/" class="u-url"><span class="p-name">Named</span></a>
       <time datetime='2026-08-01T12:00:00Z'></time></article>
     <div class="h-entry"><a class=u-url href=/notes/unquoted/>Unquoted</a>
       <p class="e-content">Unquoted body</p>
       <time datetime=2026-08-02T12:00:00Z></time></div>
     <article class="h-entry"><a class="u-url" href="/notes/data-name/">
       <data class="p-name" value="Data Name"></data></a>
       <time datetime="not-a-date"></time></article>
     <article class="h-entry"><a class="u-url" href="/notes/echo/">
       </a><p class="e-content">Echo title</p></article>
     <article class="h-entry"><a class="u-url" href="/notes/diff/">
       <span class="p-name">Title Name</span></a>
       <p class="e-content">Different summary body text</p></article>`,
    {
      pageUrl: "https://joshuapsteele.com/",
      siteOrigin: "https://joshuapsteele.com",
      observedAt: "2026-11-01T12:00:00.000Z",
    },
  );

  assert.ok(notes.some((item) => item.title === "Named"));
  assert.ok(
    notes.some((item) => String(item.url || "").includes("/notes/unquoted")),
  );
  assert.ok(
    notes.some(
      (item) =>
        item.title === "Data Name" &&
        item.url === "https://joshuapsteele.com/notes/data-name/" &&
        item.published_at === null,
    ),
  );
  assert.ok(
    notes.some(
      (item) =>
        item.url === "https://joshuapsteele.com/notes/echo/" &&
        item.title === "Echo title" &&
        item.summary === "",
    ),
  );
  assert.ok(
    notes.some(
      (item) =>
        item.url === "https://joshuapsteele.com/notes/diff/" &&
        item.title === "Title Name" &&
        item.summary === "Different summary body text",
    ),
  );

  assert.equal(isListeningCurationTitle(null), false);
  assert.equal(isListeningCurationTitle(undefined), false);
  assert.equal(firstPartyContentTypeFromTitle(null, "article"), "article");
  assert.equal(firstPartyContentTypeFromTitle("", "article"), "article");
  assert.equal(
    firstPartyContentTypeFromTitle("📷 Aurora", "article"),
    "photograph",
  );
});
