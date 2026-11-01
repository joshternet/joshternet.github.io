/**
 * Goal: Catalog completeness, probe policy, and sensitive-path highlights.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  SLASH_PAGE_CATALOG,
  SLASH_PAGE_CATALOG_REVIEWED_AT,
  SLASH_PAGE_CATALOG_VERSION,
  creativeIndexSlashPaths,
  identityLikeSlashPaths,
  isNonHighlightSlashPath,
  normalizeSlashPath,
  pathsForEntry,
  probeSlashPaths,
  slashPageAllowsHostElsewhere,
  slashPageUses,
  writingIndexSlashPaths,
} from "../../scripts/network/slash-page-catalog.mjs";
import {
  CREATIVE_INDEX_PATHS,
  IDENTITY_SLASH_PATHS,
  PROBE_SLASH_PATHS,
  WRITING_INDEX_PATHS,
  contentIndexPaths,
  isShowcaseChromePath,
} from "../../scripts/network/slash-pages.mjs";

test("slash catalog is versioned and reviewed", () => {
  assert.equal(SLASH_PAGE_CATALOG_VERSION, 1);
  assert.match(SLASH_PAGE_CATALOG_REVIEWED_AT, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(SLASH_PAGE_CATALOG.length > 40);
});

test("normalizeSlashPath: trailing slash forms and empties", () => {
  assert.equal(normalizeSlashPath("/About"), "/about/");
  assert.equal(normalizeSlashPath("gallery/"), "/gallery/");
  assert.equal(normalizeSlashPath("/"), "");
  assert.equal(normalizeSlashPath(""), "");
});

test("slashPageUses gates host elsewhere on site-info paths only", () => {
  assert.deepEqual(slashPageUses("/friends/"), ["connections"]);
  assert.deepEqual(slashPageUses("/people/"), ["connections"]);
  assert.equal(slashPageAllowsHostElsewhere("/friends/"), false);
  assert.equal(slashPageAllowsHostElsewhere("/following/"), false);
  assert.ok(slashPageUses("/social/").includes("site-info"));
  assert.equal(slashPageAllowsHostElsewhere("/social/"), true);
  assert.equal(slashPageAllowsHostElsewhere("/about/"), true);
  assert.deepEqual(slashPageUses("/unknown-path/"), []);
  assert.equal(slashPageAllowsHostElsewhere("/unknown-path/"), false);
  assert.deepEqual(slashPageUses("/"), []);
  assert.deepEqual(slashPageUses(""), []);
  assert.equal(slashPageAllowsHostElsewhere(""), false);
});

test("catalog covers core slashpages.net and creative indexes", () => {
  const paths = new Set(probeSlashPaths());

  for (const required of [
    "/about/",
    "/now/",
    "/uses/",
    "/contact/",
    "/feeds/",
    "/til/",
    "/slashes/",
    "/why/",
    "/podroll/",
    "/gallery/",
    "/photography/",
    "/music/",
    "/discography/",
    "/videos/",
    "/games/",
    "/illustration/",
    "/exhibitions/",
    "/portfolio/",
    "/apps/",
    "/software/",
    "/books/",
    "/guides/",
    "/experiments/",
    "/sounds/",
    "/events/",
    "/shows/",
    "/gigs/",
    "/concerts/",
    "/performances/",
    "/readings/",
    "/workshops/",
    "/calendar/",
  ]) {
    assert.ok(paths.has(required), `missing ${required}`);
  }
});

test("event slash paths are probeable with events extraction", () => {
  const events = SLASH_PAGE_CATALOG.filter(
    (entry) => entry.category === "events",
  );
  assert.ok(events.length >= 2);
  for (const entry of events) {
    assert.equal(entry.probe, true);
    assert.equal(entry.extraction, "events");
  }
});

test("sensitive paths are not public_highlight", () => {
  for (const path of ["/death/", "/disability/", "/where/"]) {
    assert.equal(isNonHighlightSlashPath(path), true, path);
  }

  assert.equal(isNonHighlightSlashPath("/about/"), false);
  assert.equal(isNonHighlightSlashPath(""), false);
  assert.equal(isNonHighlightSlashPath("/not-in-catalog/"), false);
});

test("pathsForEntry includes aliases", () => {
  const about = SLASH_PAGE_CATALOG.find((entry) => entry.path === "/about/");
  assert.ok(about);
  const paths = pathsForEntry(about);
  assert.ok(paths.includes("/about/"));
  assert.ok(paths.includes("/me/"));
});

test("probeSlashPaths includes conventional and creative indexes", () => {
  const probes = new Set(probeSlashPaths());
  assert.ok(probes.has("/now/"));
  assert.ok(probes.has("/gallery/"));
  assert.ok(probes.has("/music/"));
  assert.deepEqual(PROBE_SLASH_PATHS, probeSlashPaths());
});

test("derived slash-pages lists stay aligned with catalog helpers", () => {
  assert.deepEqual(IDENTITY_SLASH_PATHS, identityLikeSlashPaths());
  assert.deepEqual(WRITING_INDEX_PATHS, writingIndexSlashPaths());
  assert.deepEqual(CREATIVE_INDEX_PATHS, creativeIndexSlashPaths());
  assert.ok(contentIndexPaths().includes("/gallery/"));
  assert.ok(contentIndexPaths().includes("/blog/"));
  assert.ok(contentIndexPaths().includes("/comics/"));
  assert.ok(contentIndexPaths().includes("/toys/"));
  assert.ok(contentIndexPaths().includes("/reels/"));
  assert.ok(probeSlashPaths().includes("/cssbattles/"));
  assert.ok(probeSlashPaths().includes("/study-hall/"));
  assert.ok(probeSlashPaths().includes("/education/"));
});

test("creative and writing helpers skip unrelated categories", () => {
  assert.ok(creativeIndexSlashPaths().every((path) => path.startsWith("/")));
  assert.ok(
    writingIndexSlashPaths().includes("/notes/") ||
      writingIndexSlashPaths().includes("/blog/"),
  );
  assert.ok(identityLikeSlashPaths().includes("/about/"));
  assert.ok(!writingIndexSlashPaths().includes("/studio-index/"));
  assert.ok(!probeSlashPaths().includes("/blank/"));
});

test("pathsForEntry skips empty and duplicate aliases", () => {
  const paths = pathsForEntry({
    path: "/about/",
    aliases: ["/", "/about/", "/me/"],
    purpose: "x",
    category: "identity",
    uses: ["site-info"],
    probe: true,
    public_highlight: true,
    extraction: "profile",
  });
  assert.deepEqual(paths, ["/about/", "/me/"]);
  assert.deepEqual(
    pathsForEntry({
      path: "/solo/",
      aliases: null,
      purpose: "x",
      category: "identity",
      uses: ["site-info"],
      probe: true,
      public_highlight: true,
      extraction: "profile",
    }),
    ["/solo/"],
  );
  assert.equal(normalizeSlashPath(null), "");
  assert.equal(normalizeSlashPath("///"), "");
});

test("isShowcaseChromePath covers identity writing topics webrings feeds", () => {
  assert.equal(isShowcaseChromePath("https://a.example/now/"), true);
  assert.equal(isShowcaseChromePath("https://a.example/uses/"), true);
  assert.equal(isShowcaseChromePath("https://a.example/dedication/"), true);
  assert.equal(isShowcaseChromePath("/topics/video-games/"), true);
  assert.equal(isShowcaseChromePath("/notes/2026/07/page/2/"), true);
  assert.equal(isShowcaseChromePath("/reading/foo/"), true);
  assert.equal(isShowcaseChromePath("/webrings/"), true);
  assert.equal(isShowcaseChromePath("/rss.xml"), true);
  assert.equal(isShowcaseChromePath("/posts/"), true);
  assert.equal(isShowcaseChromePath("/recipes/"), true);
  assert.equal(isShowcaseChromePath("/code/"), true);
  assert.equal(isShowcaseChromePath("/hustles/"), true);
  assert.equal(isShowcaseChromePath("/things/"), true);
  assert.equal(
    isShowcaseChromePath("https://a.example/experiments/corkboard/"),
    false,
  );
  assert.equal(
    isShowcaseChromePath("https://a.example/games/age-of-combat/"),
    false,
  );
  assert.equal(isShowcaseChromePath("https://[bad"), false);
  assert.equal(isShowcaseChromePath("https://a.example/"), false);
  assert.equal(isShowcaseChromePath("/"), false);
  assert.equal(isShowcaseChromePath(""), false);
  assert.equal(isShowcaseChromePath(null), false);
});
