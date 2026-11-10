/**
 * Goal: Prune-then-gather retention — 30-day cache, 14-day display, durable creative.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_WINDOW_DAYS,
  CONTENT_CACHE_DAYS,
  contentItemTimestamp,
  isAppearanceListingSourcedItem,
  isContentCacheEligible,
  isDurableCreativeContentItem,
  isVisitorFacingContentItem,
  mergeGatheredContent,
  pruneContentItems,
} from "../../scripts/nlp/content-retention.mjs";

const NOW = "2026-11-02T12:00:00.000Z";

/**
 * @param {number} daysAgo
 * @returns {string}
 */
function daysAgoIso(daysAgo) {
  const ms = Date.parse(NOW) - daysAgo * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

test("CONTENT_CACHE_DAYS is 30 and display window is 14", () => {
  assert.equal(CONTENT_CACHE_DAYS, 30);
  assert.equal(ACTIVITY_WINDOW_DAYS, 14);
});

test("contentItemTimestamp prefers published_at then observed_at", () => {
  assert.equal(contentItemTimestamp(null), "");
  assert.equal(
    contentItemTimestamp({
      published_at: "2026-01-01T00:00:00.000Z",
      observed_at: "2026-11-01T00:00:00.000Z",
    }),
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal(
    contentItemTimestamp({ observed_at: "2026-11-01T00:00:00.000Z" }),
    "2026-11-01T00:00:00.000Z",
  );
});

test("isDurableCreativeContentItem keeps events and presentations", () => {
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "event",
      url: "https://a.example/speaking/",
    }),
    true,
  );
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "presentation",
      url: "https://a.example/speaking/",
    }),
    true,
  );
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "article",
      url: "https://a.example/notes/1",
    }),
    false,
  );
});

test("isDurableCreativeContentItem recognizes Showcase types and creative sources", () => {
  assert.equal(isDurableCreativeContentItem(null), false);
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "project",
      url: "https://a.example/projects/x",
    }),
    true,
  );
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "article",
      source_kind: "portfolio",
      url: "https://a.example/work/1",
    }),
    true,
  );
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "article",
      url: "https://a.example/blog/post",
    }),
    false,
  );
});

test("13-day writing is visitor-facing; 20-day is cache-only; 31-day is dropped", () => {
  const recent = {
    content_type: "article",
    url: "https://a.example/recent",
    published_at: daysAgoIso(13),
  };
  const cached = {
    content_type: "article",
    url: "https://a.example/cached",
    published_at: daysAgoIso(20),
  };
  const aged = {
    content_type: "article",
    url: "https://a.example/aged",
    published_at: daysAgoIso(31),
  };

  assert.equal(isVisitorFacingContentItem(recent, NOW), true);
  assert.equal(isContentCacheEligible(recent, NOW), true);

  assert.equal(isVisitorFacingContentItem(cached, NOW), false);
  assert.equal(isContentCacheEligible(cached, NOW), true);

  assert.equal(isVisitorFacingContentItem(aged, NOW), false);
  assert.equal(isContentCacheEligible(aged, NOW), false);
});

test("pruneContentItems drops aged writing and keeps durable creative", () => {
  const project = {
    content_type: "project",
    url: "https://a.example/projects/old",
    published_at: daysAgoIso(400),
  };
  const agedArticle = {
    content_type: "article",
    url: "https://a.example/old-post",
    published_at: daysAgoIso(40),
  };
  const freshArticle = {
    content_type: "article",
    url: "https://a.example/new-post",
    published_at: daysAgoIso(2),
  };

  const { kept, prunedCount } = pruneContentItems(
    [project, agedArticle, freshArticle, null],
    NOW,
  );

  assert.equal(prunedCount, 2);
  assert.equal(kept.length, 2);
  assert.ok(kept.some((item) => item.url === project.url));
  assert.ok(kept.some((item) => item.url === freshArticle.url));
});

test("isAppearanceListingSourcedItem detects speaking and event listings", () => {
  assert.equal(isAppearanceListingSourcedItem(null), false);
  assert.equal(
    isAppearanceListingSourcedItem({
      content_type: "event",
      source: { kind: "speaking-archive" },
    }),
    true,
  );
  assert.equal(
    isAppearanceListingSourcedItem({
      content_type: "event",
      source_kind: "speaking-archive",
    }),
    true,
  );
  assert.equal(
    isAppearanceListingSourcedItem({
      content_type: "presentation",
      source_feeds: [
        { type: "event-listing", url: "https://a.example/events/" },
      ],
    }),
    true,
  );
  assert.equal(
    isAppearanceListingSourcedItem({
      content_type: "event",
      source_feeds: [null, "skip", { type: "" }, { type: "event-listing" }],
    }),
    true,
  );
  assert.equal(
    isAppearanceListingSourcedItem({
      content_type: "event",
      source: { kind: "schema-event" },
    }),
    false,
  );
  assert.equal(
    isAppearanceListingSourcedItem({
      content_type: "project",
      source: { kind: "speaking-archive" },
    }),
    false,
  );
  assert.equal(
    isAppearanceListingSourcedItem({
      content_type: "event",
      source_feeds: [null, { type: "" }],
    }),
    false,
  );
  assert.equal(
    isAppearanceListingSourcedItem({
      content_type: 42,
      source_kind: "speaking-archive",
    }),
    false,
  );
});

test("mergeGatheredContent drops unreplaced speaking-archive zombies on success", () => {
  const zombie = {
    identity: "event:https://ok.example:2026:2026-10-01",
    content_type: "event",
    url: "https://ok.example/speaking/",
    site_origin: "https://ok.example",
    title: ", 2026",
    source: { kind: "speaking-archive", page: "https://ok.example/speaking/" },
    observed_at: daysAgoIso(10),
  };
  const freshTalk = {
    identity: "event:https://ok.example:front-end-study-hall-061:2026-10-29",
    content_type: "event",
    url: "https://ok.example/speaking/",
    site_origin: "https://ok.example",
    title: "Front End Study Hall #061",
    source: { kind: "speaking-archive", page: "https://ok.example/speaking/" },
    observed_at: daysAgoIso(1),
  };
  const photo = {
    content_type: "photograph",
    url: "https://ok.example/photos/1",
    site_origin: "https://ok.example",
    title: "Album",
    observed_at: daysAgoIso(2),
  };

  const merged = mergeGatheredContent([zombie, photo], [freshTalk], {
    now: NOW,
  });

  assert.equal(
    merged.items.some((item) => item.identity === zombie.identity),
    false,
  );
  assert.ok(merged.items.some((item) => item.identity === freshTalk.identity));
  assert.ok(merged.items.some((item) => item.url === photo.url));

  const carried = mergeGatheredContent([zombie, photo], [], {
    now: NOW,
    failedOrigins: ["https://ok.example"],
  });
  assert.ok(carried.items.some((item) => item.identity === zombie.identity));
});

test("mergeGatheredContent carries forward failed origins and filters aged gather", () => {
  const baseProject = {
    content_type: "project",
    url: "https://fail.example/projects/keep",
    site_origin: "https://fail.example",
  };
  const baseWriting = {
    content_type: "article",
    url: "https://fail.example/post",
    site_origin: "https://fail.example",
    published_at: daysAgoIso(5),
  };
  const okBaseWriting = {
    content_type: "article",
    url: "https://ok.example/old",
    site_origin: "https://ok.example",
    published_at: daysAgoIso(5),
  };
  const gatheredNew = {
    content_type: "article",
    url: "https://ok.example/brand-new",
    site_origin: "https://ok.example",
    published_at: daysAgoIso(1),
  };
  const gatheredAged = {
    content_type: "article",
    url: "https://ok.example/ancient",
    site_origin: "https://ok.example",
    published_at: daysAgoIso(100),
  };

  const merged = mergeGatheredContent(
    [baseProject, baseWriting, okBaseWriting],
    [gatheredNew, gatheredAged],
    { now: NOW, failedOrigins: ["https://fail.example"] },
  );

  assert.ok(merged.items.some((item) => item.url === baseProject.url));
  assert.ok(merged.items.some((item) => item.url === baseWriting.url));
  assert.ok(merged.items.some((item) => item.url === gatheredNew.url));
  assert.equal(
    merged.items.some((item) => item.url === gatheredAged.url),
    false,
  );
  // Successful origin writing from base is not kept unless re-gathered.
  assert.equal(
    merged.items.some((item) => item.url === okBaseWriting.url),
    false,
  );
  assert.ok(merged.carriedForwardCount >= 2);
  assert.ok(merged.addedCount >= 1);
});

test("undated writing without timestamps is not cache eligible", () => {
  assert.equal(
    isContentCacheEligible(
      { content_type: "article", url: "https://a.example/x" },
      NOW,
    ),
    false,
  );
  assert.equal(isContentCacheEligible(null, NOW), false);
  assert.equal(isVisitorFacingContentItem(null, NOW), false);
  assert.equal(
    isVisitorFacingContentItem(
      { content_type: "project", url: "https://a.example/p" },
      NOW,
    ),
    true,
  );
});

test("isDurableCreativeContentItem covers creative source kinds", () => {
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "article",
      source: { kind: "creative-homepage" },
      url: "https://a.example/",
    }),
    true,
  );
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "article",
      source_kind: "creative-index-figures",
      url: "https://a.example/gallery/1",
    }),
    true,
  );
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "article",
      source_kind: "creative-homepage-shelf",
      url: "https://a.example/",
    }),
    true,
  );
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "article",
      source_kind: "creative-projects-shelf",
      url: "https://app.example/",
    }),
    true,
  );
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "article",
      source: { kind: 1 },
      url: "https://a.example/",
    }),
    false,
  );
});

test("appearance identity keys keep multiple talks that share an archive URL", () => {
  const archive = "https://member.example/speaking/";
  const first = {
    identity: "event:https://member.example:boston:2026-03-28",
    content_type: "event",
    url: archive,
    site_origin: "https://member.example",
    title: "Boston Code Camp 40",
    start: "2026-03-28",
    observed_at: daysAgoIso(1),
  };
  const second = {
    identity: "event:https://member.example:aspireconf:2026-03-23",
    content_type: "event",
    url: archive,
    site_origin: "https://member.example",
    title: "AspireConf 2026",
    start: "2026-03-23",
    observed_at: daysAgoIso(1),
  };
  const talk = {
    identity:
      "presentation:https://member.example:how-to-learn-to-love-the-linter",
    content_type: "presentation",
    url: archive,
    site_origin: "https://member.example",
    title: "How to Learn to Love the Linter",
    start: "2026-03-28",
    observed_at: daysAgoIso(1),
  };

  const merged = mergeGatheredContent([], [first, second, talk], { now: NOW });
  assert.equal(merged.items.length, 3);
  assert.ok(merged.items.some((item) => item.identity === first.identity));
  assert.ok(merged.items.some((item) => item.identity === second.identity));
  assert.ok(merged.items.some((item) => item.identity === talk.identity));
});

test("directory index URLs are never durable and leave on merge", () => {
  const collections = {
    content_type: "project",
    url: "https://joshozuna.com/collections",
    site_origin: "https://joshozuna.com",
    source: { kind: "creative-homepage" },
    observed_at: daysAgoIso(2),
  };
  const sitemap = {
    content_type: "collection",
    url: "https://joshozuna.com/html-sitemap",
    site_origin: "https://joshozuna.com",
    source: { kind: "creative-schema" },
    observed_at: daysAgoIso(2),
  };
  const toolsIndex = {
    content_type: "project",
    url: "https://joshuastuebner.com/tools/",
    site_origin: "https://joshuastuebner.com",
    source: { kind: "creative-homepage" },
    observed_at: daysAgoIso(2),
  };
  const toolChild = {
    content_type: "project",
    url: "https://joshuastuebner.com/tools/calendar/",
    site_origin: "https://joshuastuebner.com",
    source: { kind: "tool-index" },
    observed_at: daysAgoIso(1),
  };
  const photoAlbum = {
    content_type: "photograph",
    url: "https://joshozuna.com/film/kodak-ultramax",
    site_origin: "https://joshozuna.com",
    source: { kind: "creative-og" },
    observed_at: daysAgoIso(1),
  };

  assert.equal(isDurableCreativeContentItem(collections), false);
  assert.equal(isDurableCreativeContentItem(sitemap), false);
  assert.equal(isDurableCreativeContentItem(toolsIndex), false);
  assert.equal(
    isDurableCreativeContentItem({
      url: "https://joshozuna.com/tools/",
      content_type: 1,
    }),
    false,
  );
  assert.equal(isContentCacheEligible(collections, NOW), false);
  assert.equal(isContentCacheEligible(toolsIndex, NOW), false);
  assert.equal(isDurableCreativeContentItem(toolChild), true);
  assert.equal(
    isDurableCreativeContentItem({
      content_type: "presentation",
      url: "https://member.example/speaking/",
    }),
    true,
  );
  assert.equal(
    isContentCacheEligible(
      {
        content_type: "event",
        url: "https://member.example/speaking/",
        observed_at: daysAgoIso(2),
      },
      NOW,
    ),
    true,
  );

  const pruned = pruneContentItems(
    [collections, sitemap, toolsIndex, toolChild, photoAlbum],
    NOW,
  );
  assert.equal(
    pruned.kept.some((item) => item.url === collections.url),
    false,
  );
  assert.equal(
    pruned.kept.some((item) => item.url === sitemap.url),
    false,
  );
  assert.equal(
    pruned.kept.some((item) => item.url === toolsIndex.url),
    false,
  );
  assert.ok(pruned.kept.some((item) => item.url === toolChild.url));
  assert.ok(pruned.kept.some((item) => item.url === photoAlbum.url));

  const merged = mergeGatheredContent(
    [collections, sitemap, toolsIndex, toolChild, photoAlbum],
    [toolChild, photoAlbum],
    { now: NOW },
  );
  assert.equal(
    merged.items.some((item) => item.url === collections.url),
    false,
  );
  assert.equal(
    merged.items.some((item) => item.url === sitemap.url),
    false,
  );
  assert.equal(
    merged.items.some((item) => item.url === toolsIndex.url),
    false,
  );
  assert.ok(merged.items.some((item) => item.url === toolChild.url));
  assert.ok(merged.items.some((item) => item.url === photoAlbum.url));

  const carried = mergeGatheredContent(
    [collections, toolsIndex, toolChild],
    [],
    {
      now: NOW,
      failedOrigins: ["https://joshozuna.com", "https://joshuastuebner.com"],
    },
  );
  assert.equal(
    carried.items.some((item) => item.url === collections.url),
    false,
  );
  assert.equal(
    carried.items.some((item) => item.url === toolsIndex.url),
    false,
  );
  assert.ok(carried.items.some((item) => item.url === toolChild.url));
});

test("mergeGatheredContent covers id keys, updates, and sort ties", () => {
  const base = {
    content_type: "project",
    id: "only-id",
    site_origin: "https://ok.example",
    title: "B",
  };
  const gatheredUpdate = {
    content_type: "project",
    id: "only-id",
    url: "https://ok.example/projects/b",
    site_origin: "https://ok.example",
    title: "A",
  };
  const gatheredSibling = {
    content_type: "project",
    url: "https://ok.example/projects/b",
    site_origin: "https://ok.example",
    title: "Z",
  };
  const badUrl = {
    content_type: "project",
    url: "not a url",
    title: "X",
  };
  const noKey = { content_type: "project", title: "nokey" };
  const idOnlyA = { content_type: "project", id: "sort-a", title: "B" };
  const idOnlyB = { content_type: "project", id: "sort-b" };
  const portfolioOnly = {
    source_kind: "portfolio",
    id: "port-1",
    title: "P",
  };

  const merged = mergeGatheredContent(
    [base, null, noKey, badUrl],
    [
      gatheredUpdate,
      gatheredSibling,
      null,
      noKey,
      { content_type: "article" },
      idOnlyA,
      idOnlyB,
      portfolioOnly,
    ],
    { now: NOW, cacheDays: 30, reuseOrigins: [] },
  );

  assert.ok(merged.updatedCount >= 1);
  assert.ok(merged.items.length >= 1);
  assert.equal(mergeGatheredContent(null, null, { now: NOW }).items.length, 0);

  // Origin key falls through when url parse fails and site_origin missing.
  const carried = mergeGatheredContent(
    [{ content_type: "project", id: "carry", title: "C" }],
    [],
    { now: NOW, failedOrigins: [""] },
  );
  assert.ok(carried.items.some((item) => item.id === "carry"));

  const titleSort = mergeGatheredContent(
    [],
    [
      { content_type: "project", id: "t-b", title: "B" },
      { content_type: "project", id: "t-a", title: "A" },
      { content_type: "project", id: "t-c", title: 3 },
      { content_type: "project", id: "t-d" },
    ],
    { now: NOW },
  );
  assert.ok(titleSort.items.length >= 3);
});

test("pruneContentItems accepts custom cacheDays and non-array", () => {
  const { kept, prunedCount } = pruneContentItems("nope", NOW, {
    cacheDays: 0,
  });
  assert.equal(kept.length, 0);
  assert.equal(prunedCount, 0);
});

test("aged writing leaves the cache while fresh writing remains", () => {
  const freshMember = {
    content_type: "article",
    url: "https://joshua.example/new",
    site_origin: "https://joshua.example",
    published_at: daysAgoIso(2),
  };
  const agedMember = {
    content_type: "article",
    url: "https://joshua.example/old",
    site_origin: "https://joshua.example",
    published_at: daysAgoIso(40),
  };

  assert.equal(isContentCacheEligible(freshMember, NOW), true);
  assert.equal(isContentCacheEligible(agedMember, NOW), false);

  const pruned = pruneContentItems([agedMember, freshMember], NOW);
  assert.equal(pruned.prunedCount, 1);
  assert.deepEqual(
    pruned.kept.map((item) => item.url),
    [freshMember.url],
  );

  const merged = mergeGatheredContent([agedMember], [freshMember], {
    now: NOW,
  });
  assert.ok(merged.items.some((item) => item.url === freshMember.url));
  assert.ok(!merged.items.some((item) => item.url === agedMember.url));
});
