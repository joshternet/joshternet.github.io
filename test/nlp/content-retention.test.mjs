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
