/**
 * Goal: Prune-then-gather retention — 30-day cache, 14-day display, durable creative.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_WINDOW_DAYS,
  CONTENT_CACHE_DAYS,
  contentItemTimestamp,
  isContentCacheEligible,
  isDurableCreativeContentItem,
  isVisitorFacingContentItem,
  markLocalDevCacheContent,
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

test("local personal-site content grows and live writing still ages out", () => {
  const oldLocal = {
    content_type: "article",
    url: "https://other.example/uses/old",
    site_origin: "https://other.example",
    published_at: daysAgoIso(400),
    local_dev_cache: true,
  };
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

  assert.equal(
    isContentCacheEligible(oldLocal, NOW, CONTENT_CACHE_DAYS, {
      retainLocalDevCache: true,
    }),
    true,
  );
  assert.equal(isContentCacheEligible(oldLocal, NOW), false);
  assert.equal(
    isContentCacheEligible(
      { local_dev_cache: true, content_type: "project" },
      NOW,
      CONTENT_CACHE_DAYS,
      { retainLocalDevCache: false },
    ),
    false,
  );

  const keptLocal = pruneContentItems(
    [oldLocal, agedMember, freshMember],
    NOW,
    {
      retainLocalDevCache: true,
    },
  );
  assert.equal(keptLocal.prunedCount, 1);
  assert.ok(keptLocal.kept.some((item) => item.url === oldLocal.url));

  const droppedLocal = pruneContentItems([oldLocal], NOW);
  assert.equal(droppedLocal.kept.length, 0);

  const drafts = [
    null,
    { content_type: "article", title: "no origin" },
    { content_type: "article", url: "not a url" },
    {
      content_type: "article",
      url: "https://friends.joshua.example/note",
      published_at: daysAgoIso(90),
    },
    {
      content_type: "article",
      url: "https://other.example/older-note",
      published_at: daysAgoIso(200),
    },
    {
      content_type: "article",
      url: "https://other.example/uses/old",
      site_origin: "https://other.example",
      published_at: daysAgoIso(10),
      title: "updated",
    },
  ];
  markLocalDevCacheContent(drafts, [null, "", "https://other.example"]);
  markLocalDevCacheContent(drafts, []);
  markLocalDevCacheContent(drafts);
  markLocalDevCacheContent(null, ["https://other.example"]);
  assert.equal(drafts[5].local_dev_cache, true);
  assert.equal(drafts[4].local_dev_cache, true);
  assert.equal(drafts[3].local_dev_cache, undefined);

  const aside = {
    content_type: "article",
    url: "https://other.example/aside",
    site_origin: "https://other.example",
    published_at: daysAgoIso(500),
    local_dev_cache: true,
  };
  const grown = mergeGatheredContent(
    [oldLocal, aside, agedMember],
    drafts.filter((item) => item),
    { now: NOW, retainLocalDevCache: true },
  );
  assert.ok(
    grown.items.some(
      (item) => item.url === oldLocal.url && item.title === "updated",
    ),
  );
  assert.ok(grown.items.some((item) => item.url === aside.url));
  assert.ok(
    grown.items.some((item) => item.url === "https://other.example/older-note"),
  );
  assert.ok(
    !grown.items.some(
      (item) => item.url === "https://friends.joshua.example/note",
    ),
  );
  assert.ok(!grown.items.some((item) => item.url === agedMember.url));

  const live = mergeGatheredContent(
    [oldLocal],
    drafts.filter((item) => item),
    {
      now: NOW,
    },
  );
  assert.ok(!live.items.some((item) => item.local_dev_cache === true));
});
