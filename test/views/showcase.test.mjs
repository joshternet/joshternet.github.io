/**
 * Goal: Showcase projection helpers and view wiring.
 * Expanded kind labels stay under Showcase; Happening is separate.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  activityTimestamp,
  activityWithinDays,
  buildEventIcs,
  buildHappeningItems,
  buildMadeItems,
  buildShowcaseHomeItems,
  buildShowcaseItems,
  buildViewDocuments,
  compareShowcaseRecency,
  compactContentItem,
  creativePathKind,
  dirForLanguage,
  fairTopicArticles,
  isBareCreativeIndexUrl,
  isBlogShapedProjectTitle,
  isClientCaseStudyUrl,
  isCreativeSeriesHubUrl,
  isIndividualPhotoOrArtWorkUrl,
  isExactSlugProductTitle,
  isExternalShelfProject,
  isMadeContentItem,
  isMemberSiteHomeItem,
  isNamedRootCreativeProduct,
  isNamedRootProjectUrl,
  isPhotoAggregatorUrl,
  isPhotoOrArtCollectionUrl,
  isPortfolioIndexedProjectTitle,
  isPortfolioSourcedItem,
  isShowcaseContentItem,
  isSiteHomeUrl,
  projectTitleMatchingSlug,
  relationLabel,
  showcaseCardTitle,
  showcaseItemHasSubstance,
  showcaseItemsForActivity,
  showcaseKind,
  showcaseKindForItem,
  showcaseKindLabel,
  uniqueActivityItemsByUrl,
} from "../../scripts/views/lib.mjs";

test("showcaseKind maps content types to Showcase labels", () => {
  assert.equal(showcaseKind("photograph"), "photography");
  assert.equal(showcaseKind("visual_artwork"), "art");
  assert.equal(showcaseKind("music_album"), "music");
  assert.equal(showcaseKind("music_recording"), "music");
  assert.equal(showcaseKind("sheet_music"), "sheet music");
  assert.equal(showcaseKind("video"), "video");
  assert.equal(showcaseKind("game"), "games");
  assert.equal(showcaseKind("project"), "project");
  assert.equal(showcaseKind("collection"), "project");
  assert.equal(showcaseKind("article"), "other");
  assert.equal(showcaseKind(""), "other");
  assert.equal(relationLabel("credit"), "credits");
});

test("showcaseKind uses categories to refine project/game kind", () => {
  assert.equal(showcaseKind("game", ["Mobile app"]), "apps");
  assert.equal(showcaseKind("game", ["software library"]), "software");
  assert.equal(showcaseKind("project", ["a book"]), "books");
  assert.equal(showcaseKind("project", ["guide for beginners"]), "guides");
  assert.equal(showcaseKind("project", ["graphic design"]), "design");
  assert.equal(showcaseKind("project", ["iOS app"]), "apps");
  assert.equal(showcaseKind("project", ["software tool"]), "software");
  assert.equal(showcaseKind("collection", ["design system"]), "design");
});

test("dirForLanguage returns rtl for RTL language tags", () => {
  assert.equal(dirForLanguage("ar"), "rtl");
  assert.equal(dirForLanguage("he"), "rtl");
  assert.equal(dirForLanguage("fa"), "rtl");
  assert.equal(dirForLanguage("ar-SA"), "rtl");
  assert.equal(dirForLanguage("en"), "");
  assert.equal(dirForLanguage("fr"), "");
  assert.equal(dirForLanguage(""), "");
});

test("isShowcaseContentItem filters hub and non-creative", () => {
  assert.equal(isShowcaseContentItem(null), false);
  assert.equal(
    isShowcaseContentItem({
      content_type: "project",
      url: "https://joshternet.org/",
    }),
    false,
  );
  assert.equal(
    isShowcaseContentItem({
      content_type: "article",
      url: "https://a.example/p/",
    }),
    false,
  );
  assert.equal(
    isShowcaseContentItem({ content_type: "photograph", url: "" }),
    false,
  );
  assert.equal(
    isShowcaseContentItem({
      content_type: "photograph",
      url: "https://a.example/photo/",
    }),
    false,
  );
  assert.equal(
    isShowcaseContentItem({
      content_type: "photograph",
      url: "https://a.example/photos/2014/",
      title: "2014",
      image: "https://a.example/photos/2014/cover.jpg",
      summary: "My Photos from 2014",
    }),
    true,
  );
  assert.equal(
    isShowcaseContentItem({
      content_type: "project",
      url: "https://www.joshuabaker.com/work/",
      title: "Work — Joshua Baker",
      summary: "",
    }),
    false,
  );
  assert.equal(
    isShowcaseContentItem({
      content_type: "project",
      url: "https://www.joshuabaker.com/work/?work=aiglon-aiglon-2013",
      title: "Aiglon",
      summary: "2013 · Education · Switzerland",
      source_kind: "portfolio",
    }),
    false,
  );
  assert.equal(
    isShowcaseContentItem({
      content_type: "collection",
      url: "https://joshuamorris.info/experiments/",
      title: "Experiments",
      summary: "Web experiments and playground shells.",
    }),
    false,
  );
  assert.equal(
    isShowcaseContentItem({
      content_type: "article",
      url: "https://joshuamorris.info/experiments/corkboard/",
      title: "Corkboard",
      summary: "A corkboard for notes.",
    }),
    true,
  );
  assert.equal(
    isShowcaseContentItem({
      content_type: "article",
      url: "https://joshuamorris.info/experiments/model-viewer/",
      title: "Model viewer",
    }),
    true,
  );
  assert.equal(
    isShowcaseContentItem({
      content_type: "project",
      url: "https://www.joshuabaker.com/work/banked/",
      title: "Banked",
      source_kind: "creative-index",
    }),
    false,
  );
  assert.equal(
    isShowcaseContentItem({
      content_type: "project",
      url: "https://www.joshuabaker.com/work/banked/",
      source_feeds: [{ type: "portfolio" }, { type: "creative-index" }],
    }),
    false,
  );
});

test("activityTimestamp prefers published_at over observed_at", () => {
  assert.equal(activityTimestamp(null), "");
  assert.equal(activityTimestamp({}), "");
  assert.equal(
    activityTimestamp({
      published_at: "2026-10-06T00:00:00.000Z",
      observed_at: "2026-11-01T05:00:00.000Z",
    }),
    "2026-10-06T00:00:00.000Z",
  );
  assert.equal(
    activityTimestamp({ observed_at: "2026-11-01T05:00:00.000Z" }),
    "2026-11-01T05:00:00.000Z",
  );
  assert.equal(
    activityWithinDays(
      { published_at: "2026-10-30T00:00:00.000Z" },
      new Date("2026-11-01T12:00:00.000Z"),
    ),
    true,
  );
  assert.equal(
    activityWithinDays(
      { observed_at: "2026-10-01T00:00:00.000Z" },
      new Date("2026-11-01T12:00:00.000Z"),
    ),
    false,
  );
});

test("uniqueActivityItemsByUrl dedupes and sorts newest first", () => {
  assert.deepEqual(uniqueActivityItemsByUrl(null), []);
  const sorted = uniqueActivityItemsByUrl([
    null,
    { url: "https://a.example/old", published_at: "2026-01-01T00:00:00.000Z" },
    { url: "https://a.example/old", published_at: "2026-06-01T00:00:00.000Z" },
    { url: "https://a.example/new", published_at: "2026-10-01T00:00:00.000Z" },
    { url: 42 },
  ]);
  assert.deepEqual(
    sorted.map((item) => item.url),
    ["https://a.example/new", "https://a.example/old"],
  );

  // Equal timestamps: alphabetical url tiebreak.
  const tied = uniqueActivityItemsByUrl([
    { url: "https://a.example/b", published_at: "2026-01-01T00:00:00.000Z" },
    { url: "https://a.example/a", published_at: "2026-01-01T00:00:00.000Z" },
  ]);
  assert.deepEqual(
    tied.map((item) => item.url),
    ["https://a.example/a", "https://a.example/b"],
  );
});

test("showcaseItemsForActivity keeps dated window peers only", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");
  const items = showcaseItemsForActivity(
    [
      {
        content_type: "article",
        url: "https://joshuamorris.info/experiments/corkboard/",
        site_origin: "https://joshuamorris.info",
        title: "Corkboard",
        summary: "Notes and pins",
        published_at: "2026-07-15T00:00:00.000Z",
        image: "https://joshuamorris.info/images/corkboard.webp",
      },
      {
        content_type: "article",
        url: "https://joshuamorris.info/experiments/weird-web-october-2026/analog/",
        site_origin: "https://joshuamorris.info",
        title: "Analog",
        summary: "WWO day toy",
        published_at: "2026-10-06T00:00:00.000Z",
        image: "https://joshuamorris.info/images/analog.webp",
      },
      {
        content_type: "article",
        url: "https://joshuamorris.info/experiments/weird-web-october-2026/glitch/",
        site_origin: "https://joshuamorris.info",
        title: "Glitch",
        summary: "Another WWO day",
        published_at: "2026-10-07T00:00:00.000Z",
        image: "https://joshuamorris.info/images/glitch.webp",
      },
      {
        content_type: "photograph",
        url: "https://joshbeard.com/photos/2014/",
        site_origin: "https://joshbeard.com",
        title: "My Photos from 2014",
        summary: "Hikes",
        published_at: "",
        observed_at: "2026-10-08T05:00:00.000Z",
        image: "https://joshbeard.com/photos/2014/cover.jpg",
      },
    ],
    now,
  );

  const titles = items.map((item) => item.title);
  assert.ok(titles.includes("Analog"));
  assert.ok(titles.includes("Glitch"));
  assert.equal(titles.includes("Corkboard"), false);
  assert.equal(titles.includes("My Photos from 2014"), false);
});

test("What's New merges windowed Showcase works beside same-origin writing", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");
  const views = buildViewDocuments({
    network: [
      {
        origin: "https://joshuamorris.info",
        domain: "joshuamorris.info",
        title: "Joshua Morris",
      },
      {
        origin: "https://other.example",
        domain: "other.example",
        title: "Other",
      },
    ],
    content: {
      items: [
        {
          url: "https://joshuamorris.info/notes/fresh/",
          site_origin: "https://joshuamorris.info",
          title: "Fresh note",
          content_type: "article",
          published_at: "2026-10-07T14:00:00.000Z",
          observed_at: "2026-10-08T05:00:00.000Z",
        },
        {
          url: "https://joshuamorris.info/experiments/corkboard/",
          site_origin: "https://joshuamorris.info",
          title: "Corkboard",
          content_type: "article",
          published_at: "2026-07-15T00:00:00.000Z",
          summary: "Notes and pins",
          image: "https://joshuamorris.info/images/corkboard.webp",
          observed_at: "2026-10-08T05:00:00.000Z",
        },
        {
          url: "https://joshuamorris.info/experiments/weird-web-october-2026/analog/",
          site_origin: "https://joshuamorris.info",
          title: "Analog",
          content_type: "article",
          published_at: "2026-10-06T00:00:00.000Z",
          summary: "WWO day toy",
          image: "https://joshuamorris.info/images/analog.webp",
          observed_at: "2026-10-08T05:00:00.000Z",
        },
        {
          url: "https://other.example/post/",
          site_origin: "https://other.example",
          title: "Other post",
          content_type: "article",
          published_at: "2026-10-05T00:00:00.000Z",
        },
        {
          url: "https://joshbeard.com/photos/2014/",
          site_origin: "https://joshbeard.com",
          title: "My Photos from 2014",
          content_type: "photograph",
          published_at: "",
          observed_at: "2026-10-08T05:00:00.000Z",
          image: "https://joshbeard.com/photos/2014/cover.jpg",
          summary: "Hikes",
        },
      ],
    },
    topics: { community_count: 0 },
    connections: {},
    siteSignals: { origins: [] },
    generatedAt: "2026-10-08T12:00:00.000Z",
    now,
  });

  const urls = views.activity.primary.map((item) => item.url);
  // Same-origin writing still appears…
  assert.ok(urls.includes("https://joshuamorris.info/notes/fresh/"));
  // …and the windowed Showcase toy is not crowded out by that note.
  assert.ok(
    urls.includes(
      "https://joshuamorris.info/experiments/weird-web-october-2026/analog/",
    ),
  );
  assert.equal(
    urls.includes("https://joshuamorris.info/experiments/corkboard/"),
    false,
  );
  assert.equal(urls.includes("https://joshbeard.com/photos/2014/"), false);
  assert.ok(urls.includes("https://other.example/post/"));
  assert.equal(
    views.activity.primary.find((item) =>
      String(item.url).includes("/notes/fresh/"),
    )?.observed_at,
    "2026-10-08T05:00:00.000Z",
  );
});

test("buildShowcaseHomeItems respects an explicit numeric limit", () => {
  const pool = [
    {
      content_type: "game",
      url: "https://joshtronic.com/games/age-of-combat/",
      site_origin: "https://joshtronic.com",
      title: "Age of Combat",
      published_at: "2026-10-28T00:00:00.000Z",
      summary: "A browser combat game from the games index.",
      image: "https://joshtronic.com/images/age.png",
    },
    {
      content_type: "article",
      url: "https://joshuamorris.info/experiments/newer/",
      site_origin: "https://joshuamorris.info",
      title: "Newer Experiment",
      published_at: "2026-10-30T00:00:00.000Z",
      summary: "A newer experiment on the creative path.",
      image: "https://joshuamorris.info/images/newer.webp",
    },
  ];
  assert.equal(buildShowcaseHomeItems(pool, 1).length, 1);
  assert.equal(buildShowcaseHomeItems(pool, 1.8).length, 1);
  assert.equal(buildShowcaseHomeItems(pool, -2).length, 0);
  assert.equal(buildShowcaseHomeItems(pool, Number.NaN).length, 2);
  assert.equal(buildShowcaseHomeItems(pool, Infinity).length, 2);
  assert.deepEqual(buildShowcaseHomeItems(null), []);
});

test("buildShowcaseHomeItems skips eligible works without site_origin", () => {
  assert.deepEqual(
    buildShowcaseHomeItems([
      {
        content_type: "game",
        url: "https://joshtronic.com/games/age-of-combat/",
        title: "Age of Combat",
        summary: "A browser combat game missing its site origin.",
        image: "https://joshtronic.com/images/age.png",
      },
      {
        content_type: "game",
        url: "https://joshtronic.com/games/idol-idle/",
        site_origin: "",
        title: "Idol Idle",
        summary: "A browser idle game with an empty site origin.",
        image: "https://joshtronic.com/images/idol.png",
      },
      {
        content_type: "game",
        url: "https://joshtronic.com/games/know-the-table/",
        site_origin: 12,
        title: "Know the Table",
        summary: "A browser game with a non-string site origin.",
        image: "https://joshtronic.com/images/table.png",
      },
    ]),
    [],
  );
});

test("buildShowcaseHomeItems keeps one newest work per member and kind", () => {
  const items = buildShowcaseHomeItems([
    {
      content_type: "article",
      url: "https://joshuamorris.info/experiments/older/",
      site_origin: "https://joshuamorris.info",
      title: "Older Experiment",
      summary: "An older experiment on the creative path.",
      published_at: "2026-09-01T00:00:00.000Z",
      image: "https://joshuamorris.info/images/older.webp",
    },
    {
      content_type: "article",
      url: "https://joshuamorris.info/experiments/newer/",
      site_origin: "https://joshuamorris.info",
      title: "Newer Experiment",
      summary: "A newer experiment on the creative path.",
      published_at: "2026-10-30T00:00:00.000Z",
      image: "https://joshuamorris.info/images/newer.webp",
    },
    {
      content_type: "game",
      url: "https://joshtronic.com/games/age-of-combat/",
      site_origin: "https://joshtronic.com",
      title: "Age of Combat",
      summary: "An older undated combat game on the games index.",
      observed_at: "2026-10-01T00:00:00.000Z",
      image: "https://joshtronic.com/images/age.png",
    },
    {
      content_type: "game",
      url: "https://joshtronic.com/games/idol-idle/",
      site_origin: "https://joshtronic.com",
      title: "Idol Idle",
      summary: "A newer undated idle game that should win games.",
      observed_at: "2026-10-29T00:00:00.000Z",
      image: "https://joshtronic.com/images/idol.png",
    },
    {
      content_type: "photograph",
      url: "https://joshbeard.com/photos/2014/",
      site_origin: "https://joshbeard.com",
      title: "2014",
      summary: "Older year album that loses to the newer album URL.",
      observed_at: "2026-11-01T00:00:00.000Z",
      image: "https://joshbeard.com/photos/2014/cover.jpg",
    },
    {
      content_type: "photograph",
      url: "https://joshbeard.com/photos/2026/",
      site_origin: "https://joshbeard.com",
      title: "2026",
      summary: "Newer year album that should win photography.",
      observed_at: "2026-11-01T00:00:00.000Z",
      image: "https://joshbeard.com/photos/2026/cover.jpg",
    },
    {
      content_type: "music_album",
      url: "https://music.example/albums/dawn/",
      site_origin: "https://music.example",
      title: "Dawn Album",
      summary: "A music album that should appear as its own kind card.",
      published_at: "2025-01-01T00:00:00.000Z",
      image: "https://music.example/albums/dawn.jpg",
    },
    {
      content_type: "video",
      url: "https://video.example/films/clip/",
      site_origin: "https://video.example",
      title: "Fresh Clip",
      summary: "Video kind is not part of the home creative strip.",
      published_at: "2026-10-30T00:00:00.000Z",
      image: "https://video.example/films/clip.jpg",
    },
  ]);

  assert.equal(items.length, 4);
  assert.deepEqual(
    items.map((item) => ({ kind: item.kind, url: item.url })),
    [
      {
        kind: "photography",
        url: "https://joshbeard.com/photos/2026/",
      },
      {
        kind: "project",
        url: "https://joshuamorris.info/experiments/newer/",
      },
      {
        kind: "games",
        url: "https://joshtronic.com/games/idol-idle/",
      },
      {
        kind: "music",
        url: "https://music.example/albums/dawn/",
      },
    ],
  );
});

test("buildShowcaseHomeItems keeps multiple kinds from the same member", () => {
  const items = buildShowcaseHomeItems([
    {
      content_type: "article",
      url: "https://maker.example/experiments/toy/",
      site_origin: "https://maker.example",
      title: "Toy Project",
      summary: "A project on a creative experiments path.",
      published_at: "2026-10-30T00:00:00.000Z",
      image: "https://maker.example/images/toy.webp",
    },
    {
      content_type: "game",
      url: "https://maker.example/games/arcade/",
      site_origin: "https://maker.example",
      title: "Arcade Game",
      summary: "A game from the same member as the project.",
      observed_at: "2026-10-29T00:00:00.000Z",
      image: "https://maker.example/images/arcade.png",
    },
  ]);

  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.kind).sort(), ["games", "project"]);
});

test("buildShowcaseHomeItems keeps one project per member and only the latest of three", () => {
  const items = buildShowcaseHomeItems([
    {
      content_type: "article",
      url: "https://a.example/experiments/one/",
      site_origin: "https://a.example",
      title: "A One",
      summary: "First project from member A on experiments.",
      published_at: "2026-10-01T00:00:00.000Z",
      image: "https://a.example/images/one.webp",
    },
    {
      content_type: "article",
      url: "https://a.example/experiments/two/",
      site_origin: "https://a.example",
      title: "A Two",
      summary: "Second project from member A on experiments.",
      published_at: "2026-10-10T00:00:00.000Z",
      image: "https://a.example/images/two.webp",
    },
    {
      content_type: "article",
      url: "https://a.example/experiments/three/",
      site_origin: "https://a.example",
      title: "A Three",
      summary: "Latest project from member A on experiments.",
      published_at: "2026-10-20T00:00:00.000Z",
      image: "https://a.example/images/three.webp",
    },
    {
      content_type: "article",
      url: "https://b.example/projects/widget/",
      site_origin: "https://b.example",
      title: "B Widget",
      summary: "A project from member B that must also show.",
      published_at: "2026-10-05T00:00:00.000Z",
      image: "https://b.example/images/widget.webp",
    },
  ]);

  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((item) => item.url),
    [
      "https://a.example/experiments/three/",
      "https://b.example/projects/widget/",
    ],
  );
});

test("buildShowcaseItems highlights individual experiments and groups by kind", () => {
  const items = buildShowcaseItems(
    [
      {
        content_type: "collection",
        url: "https://joshuamorris.info/experiments/",
        site_origin: "https://joshuamorris.info",
        title: "Experiments",
        summary: "Folder summary",
      },
      {
        content_type: "article",
        url: "https://joshuamorris.info/experiments/corkboard/",
        site_origin: "https://joshuamorris.info",
        title: "Corkboard",
        summary: "Notes and pins",
        image: "https://joshuamorris.info/images/corkboard.webp",
      },
      {
        content_type: "article",
        url: "https://joshuamorris.info/experiments/model-viewer/",
        site_origin: "https://joshuamorris.info",
        title: "Model viewer",
        summary: "Trion figures",
      },
      {
        content_type: "project",
        url: "https://www.joshuabaker.com/work/?work=aiglon",
        site_origin: "https://www.joshuabaker.com",
        title: "Aiglon",
        source_kind: "portfolio",
      },
      {
        content_type: "game",
        url: "https://joshtronic.com/games/age-of-combat/",
        site_origin: "https://joshtronic.com",
        title: "Age of Combat",
      },
      {
        content_type: "photograph",
        url: "https://joshbeard.com/photos/2014/",
        site_origin: "https://joshbeard.com",
        title: "My Photos from 2014",
        summary: "My Photos from 2014",
        image: "https://joshbeard.com/photos/2014/cover.jpg",
      },
      {
        content_type: "photograph",
        url: "https://joshbeard.com/photos/2015/",
        site_origin: "https://joshbeard.com",
        title: "2015",
      },
    ],
    12,
  );

  assert.equal(
    items.some((item) => item.title === "Experiments"),
    false,
  );
  assert.equal(
    items.some((item) => item.title === "Aiglon"),
    false,
  );
  assert.ok(items.some((item) => item.title === "Corkboard"));
  assert.ok(items.some((item) => item.title === "Model viewer"));
  assert.ok(items.some((item) => item.title === "My Photos from 2014"));
  assert.equal(
    items.some((item) => item.title === "2015"),
    false,
  );

  const corkboard = items.find((item) => item.title === "Corkboard");
  assert.equal(corkboard.kind, "project");

  const kinds = items.map((item) => item.kind);
  const firstProject = kinds.indexOf("project");
  const firstGame = kinds.indexOf("games");
  const firstPhoto = kinds.indexOf("photography");

  // Section order: projects → games → photography → …
  assert.ok(firstProject !== -1 && firstGame !== -1 && firstPhoto !== -1);
  assert.ok(firstProject < firstGame);
  assert.ok(firstGame < firstPhoto);
});

test("buildShowcaseItems is fair per origin and returns Showcase kind labels", () => {
  const items = buildShowcaseItems(
    [
      null,
      "skip",
      {
        content_type: "photograph",
        url: "https://a.example/photos/2024/",
        site_origin: "https://a.example",
        title: "A1",
        image: "https://a.example/photos/2024/cover.jpg",
        summary: "A landscape from the ridge",
      },
      {
        content_type: "photograph",
        url: "https://a.example/photos/2025/",
        site_origin: "https://a.example",
        title: "A2",
        image: "https://a.example/photos/2025/cover.jpg",
        summary: "Another photograph from the coast",
      },
      {
        content_type: "game",
        url: "https://b.example/1/",
        site_origin: "https://b.example",
        title: "Age of Combat",
        summary: "A browser fighting game with short matches.",
      },
    ],
    2,
  );

  assert.equal(items.length, 2);
  assert.ok(items.some((item) => item.site_origin === "https://a.example"));
  assert.ok(items.some((item) => item.site_origin === "https://b.example"));

  const photo = items.find((i) => i.content_type === "photograph");
  assert.equal(photo.kind, "photography");

  const game = items.find((i) => i.content_type === "game");
  assert.equal(game.kind, "games");

  assert.deepEqual(buildShowcaseItems(null, 3), []);
});

test("buildViewDocuments includes showcase, happening and search content_type", () => {
  const views = buildViewDocuments({
    network: [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        description: "",
      },
    ],
    content: {
      items: [
        {
          identity: "url:https://a.example/photos/ridge/",
          url: "https://a.example/photos/ridge/",
          title: "Ridge light",
          summary: "A photograph from the ridge trail at dusk.",
          image: "https://a.example/photos/ridge/cover.jpg",
          site_origin: "https://a.example",
          content_type: "photograph",
          language: "en",
          published_at: "",
        },
      ],
    },
    topics: { communities: [] },
    connections: { edges: [] },
    siteSignals: { origins: [] },
    generatedAt: "2026-10-31T00:00:00.000Z",
  });

  assert.equal(views.made, undefined);
  assert.ok(views.showcase.item_count >= 1);
  assert.equal(views.showcase.items[0].kind, "photography");
  assert.equal(views.showcase.items[0].kind_label, "Photography");
  assert.equal(views.showcase.kind_labels.photography, "Photography");
  assert.equal(typeof views.happening.schema_version, "number");
  assert.equal(views.happening.item_count, 0);

  const multi = buildViewDocuments({
    network: [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        description: "",
      },
      {
        origin: "https://b.example",
        domain: "b.example",
        title: "B",
        description: "",
      },
    ],
    content: {
      items: [
        {
          identity: "url:https://a.example/experiments/corkboard/",
          url: "https://a.example/experiments/corkboard/",
          title: "Corkboard",
          summary: "Notes",
          image: "https://a.example/corkboard.webp",
          site_origin: "https://a.example",
          content_type: "article",
          language: "en",
          published_at: "",
        },
        {
          identity: "url:https://b.example/experiments/model-viewer/",
          url: "https://b.example/experiments/model-viewer/",
          title: "Model viewer",
          summary: "Models",
          image: "https://b.example/model.webp",
          site_origin: "https://b.example",
          content_type: "article",
          language: "en",
          published_at: "",
        },
      ],
    },
    topics: { communities: [] },
    connections: { edges: [] },
    siteSignals: { origins: [] },
    generatedAt: "2026-10-31T00:00:00.000Z",
  });
  assert.equal(multi.showcase.kind_labels.project, "Projects");
  assert.equal(multi.showcase.items[0].kind_label, "Projects");
  assert.equal(showcaseKindLabel("project", 1), "Project");
  assert.equal(showcaseKindLabel("project", 2), "Projects");
  assert.equal(showcaseKindLabel("games", 1), "Game");
  assert.equal(showcaseKindLabel("games", 5), "Games");
  assert.equal(showcaseKindLabel("unknown-kind", 3), "Unknown-kind");
  assert.equal(showcaseKindLabel("", 0), "Other");

  const doc = views.search_index.documents.find(
    (entry) => entry.type === "content",
  );
  assert.ok(doc);
  assert.equal(doc.content_type, "photograph");
});

test("buildEventIcs emits VEVENT lines for upcoming items", () => {
  const ics = buildEventIcs([
    {
      url: "https://a.example/events/show/",
      title: "Show",
      start: "2026-12-01T20:00:00-05:00",
      end: "2026-12-01T22:00:00-05:00",
      site_origin: "https://a.example",
      venue: "Hall",
    },
  ]);

  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /SUMMARY:Show/);
  assert.match(ics, /UID:/);
  assert.match(ics, /END:VCALENDAR/);
});

// ─── Coverage: compactContentItem optional fields (lines 306-344) ─────────────

test("compactContentItem carries optional creative and event fields", () => {
  const result = compactContentItem(
    {
      identity: "url:https://a.example/p/",
      url: "https://a.example/p/",
      title: "Title",
      summary: "",
      site_origin: "https://a.example",
      content_type: "photograph",
      language: "en",
      published_at: "",
      categories: ["photography", "portrait"],
      availability: "InStock",
      action_label: "View",
      action_url: "https://a.example/p/?view=1",
      start: "2027-03-15T18:00:00-05:00",
      end: "2027-03-15T22:00:00-05:00",
      venue: "The Loft",
      location: "New York, NY",
      status: "EventScheduled",
      attribution_role: "organized",
    },
    new Map(),
    [],
  );

  assert.deepEqual(result.categories, ["photography", "portrait"]);
  assert.equal(result.availability, "InStock");
  assert.equal(result.action_label, "View");
  assert.equal(result.action_url, "https://a.example/p/?view=1");
  assert.equal(result.start, "2027-03-15T18:00:00-05:00");
  assert.equal(result.end, "2027-03-15T22:00:00-05:00");
  assert.equal(result.venue, "The Loft");
  assert.equal(result.location, "New York, NY");
  assert.equal(result.status, "EventScheduled");
  assert.equal(result.attribution_role, "organized");
});

// ─── Coverage: buildHappeningItems edge cases (lines 1173-1222) ───────────────

test("buildHappeningItems returns empty array for invalid now", () => {
  assert.deepEqual(
    buildHappeningItems(
      [
        {
          content_type: "event",
          start: "2099-01-01",
          url: "https://a.example/e/",
        },
      ],
      new Date("not-a-date"),
    ),
    [],
  );
});

test("buildHappeningItems skips non-object items and hub URLs", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const result = buildHappeningItems(
    [
      null,
      "string",
      42,
      {
        content_type: "event",
        start: "2099-01-01",
        url: "https://joshternet.org/events/",
      },
    ],
    now,
  );

  assert.equal(result.length, 0);
});

test("buildHappeningItems skips items with unparseable start date", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const result = buildHappeningItems(
    [
      {
        content_type: "event",
        start: "not-a-date",
        url: "https://a.example/e/",
      },
    ],
    now,
  );

  assert.equal(result.length, 0);
});

test("buildHappeningItems uses url tiebreaker when start times are equal", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const result = buildHappeningItems(
    [
      {
        content_type: "event",
        start: "2099-06-01T12:00:00Z",
        url: "https://b.example/e/",
        title: "B",
      },
      {
        content_type: "event",
        start: "2099-06-01T12:00:00Z",
        url: "https://a.example/e/",
        title: "A",
      },
    ],
    now,
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].url, "https://a.example/e/");
});

// ─── Coverage: buildEventIcs with unparseable start (line 1283-1284) ─────────

test("buildEventIcs skips items with unparseable start date", () => {
  const ics = buildEventIcs([
    { url: "https://a.example/e/", title: "Bad", start: "not-a-date" },
    {
      url: "https://a.example/e2/",
      title: "Good",
      start: "2027-01-01T18:00:00Z",
    },
  ]);

  assert.doesNotMatch(ics, /Bad/);
  assert.match(ics, /Good/);
});

test("buildEventIcs returns empty VCALENDAR for empty input", () => {
  const ics = buildEventIcs([]);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /END:VCALENDAR/);
  assert.doesNotMatch(ics, /BEGIN:VEVENT/);
});

// ─── Coverage: fairTopicArticles null-item branch (line 582-583) ─────────────

test("fairTopicArticles skips null and non-object entries", () => {
  const result = fairTopicArticles(
    [
      null,
      "string",
      42,
      {
        content_type: "photograph",
        url: "https://a.example/1/",
        site_origin: "https://a.example",
        title: "A",
      },
    ],
    10,
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://a.example/1/");
});

// ─── Coverage: buildHappeningItems non-string start/end (lines 1193-1194, 1206-1207) ─

test("buildHappeningItems skips items with non-string start", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const result = buildHappeningItems(
    [{ content_type: "event", start: 42, url: "https://a.example/e/" }],
    now,
  );
  assert.equal(result.length, 0);
});

test("buildHappeningItems treats non-string end as no end (ongoing check skipped)", () => {
  // start is in the past, end is a number (not string) → treated as no end → not ongoing
  const now = new Date("2026-06-01T00:00:00.000Z");
  const result = buildHappeningItems(
    [
      {
        content_type: "event",
        start: "2026-01-01",
        end: 9999999999999,
        url: "https://a.example/e/",
      },
    ],
    now,
  );
  assert.equal(result.length, 0);
});

// ─── Coverage: buildHappeningItems sort diff !== 0 branch (line 1220-1221) ───

test("buildHappeningItems sorts by start date ascending", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const result = buildHappeningItems(
    [
      {
        content_type: "event",
        start: "2099-12-01T00:00:00Z",
        url: "https://a.example/later/",
        title: "Later",
      },
      {
        content_type: "event",
        start: "2099-03-01T00:00:00Z",
        url: "https://a.example/sooner/",
        title: "Sooner",
      },
    ],
    now,
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].url, "https://a.example/sooner/");
  assert.equal(result[1].url, "https://a.example/later/");
});

// ─── Coverage: remaining branches ────────────────────────────────────────────

test("fairTopicArticles handles null items argument", () => {
  // Exercises `items || []` — items is null/undefined
  assert.deepEqual(fairTopicArticles(null, 10), []);
  assert.deepEqual(fairTopicArticles(undefined, 5), []);
});

test("fairTopicArticles groups items without string site_origin under empty key", () => {
  // Exercises `typeof item.site_origin === "string" ? item.site_origin : ""`
  const result = fairTopicArticles(
    [
      {
        content_type: "photograph",
        url: "https://a.example/1/",
        title: "A",
        site_origin: 42,
      },
    ],
    10,
  );
  assert.equal(result.length, 1);
});

test("showcaseKind handles non-array and falsy categories gracefully", () => {
  // Exercises `Array.isArray(categories) ? categories : []` and `cat || ""`
  assert.equal(showcaseKind("game", null), "games");
  assert.equal(showcaseKind("project", null), "project");
  assert.equal(showcaseKind("project", [null, undefined, ""]), "project");
});

test("buildMadeItems applies madeKind with non-array categories (falls back to [])", () => {
  // Exercises `Array.isArray(item.categories) ? item.categories : []` false branch
  const items = buildMadeItems(
    [
      {
        content_type: "project",
        url: "https://a.example/experiments/corkboard/",
        site_origin: "https://a.example",
        title: "Corkboard",
        summary: "A corkboard for notes and connecting threads.",
        image: "https://a.example/corkboard.webp",
        categories: "not-an-array",
      },
    ],
    10,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "project");
});

test("buildMadeItems applies madeKind with array categories (truthy branch)", () => {
  // Exercises `Array.isArray(item.categories) ? item.categories : []` true branch
  const items = buildMadeItems(
    [
      {
        content_type: "project",
        url: "https://a.example/design/system/",
        site_origin: "https://a.example",
        title: "Design system",
        summary: "A public design system for product teams.",
        image: "https://a.example/design.webp",
        categories: ["design", "portfolio"],
      },
    ],
    10,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "design");
});

test("buildHappeningItems accepts string now parameter (non-Date branch)", () => {
  // Exercises `now instanceof Date ? ... : Date.parse(String(now))`
  const result = buildHappeningItems(
    [
      {
        content_type: "event",
        start: "2099-01-01",
        url: "https://a.example/e/",
      },
    ],
    "2026-11-01T00:00:00.000Z",
  );
  assert.equal(result.length, 1);
});

test("buildHappeningItems accepts null compactItems", () => {
  // Exercises `(compactItems || []).filter(...)`
  assert.deepEqual(buildHappeningItems(null), []);
  assert.deepEqual(buildHappeningItems(undefined), []);
});

test("buildHappeningItems treats empty-string end as no end (not ongoing)", () => {
  // start is past, end is "" → endStr = "" → endMs = NaN → not ongoing
  const now = new Date("2026-06-01T00:00:00.000Z");
  const result = buildHappeningItems(
    [
      {
        content_type: "event",
        start: "2026-01-01",
        end: "",
        url: "https://a.example/e/",
      },
    ],
    now,
  );
  assert.equal(result.length, 0);
});

test("buildHappeningItems includes ongoing events (started but not yet ended)", () => {
  // start is in the past, end is in the future → ongoing → included
  // Exercises: endStr truthy (Date.parse branch), Number.isFinite(endMs) && endMs > nowMs = true
  const now = new Date("2026-06-01T00:00:00.000Z");
  const result = buildHappeningItems(
    [
      {
        content_type: "event",
        start: "2026-03-01T00:00:00Z",
        end: "2026-12-31T00:00:00Z",
        url: "https://a.example/ongoing/",
        title: "Ongoing Show",
      },
    ],
    now,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://a.example/ongoing/");
});

test("buildHappeningItems sort handles items without url property", () => {
  // Exercises `left.url ?? ""` for both null and non-null url cases.
  // Three items with the same start force multiple comparisons covering both branches.
  const now = new Date("2026-01-01T00:00:00.000Z");
  const result = buildHappeningItems(
    [
      // url present first — one comparison has left.url non-null
      {
        content_type: "event",
        start: "2099-01-01T00:00:00Z",
        title: "C",
        url: "https://c.example/e/",
      },
      { content_type: "event", start: "2099-01-01T00:00:00Z", title: "B" },
      {
        content_type: "event",
        start: "2099-01-01T00:00:00Z",
        title: "A",
        url: "https://a.example/e/",
      },
    ],
    now,
  );
  assert.equal(result.length, 3);
});

test("buildEventIcs accepts custom prodId option", () => {
  // Exercises `options.prodId || default` when prodId is provided
  const ics = buildEventIcs(
    [
      {
        url: "https://a.example/e/",
        title: "E",
        start: "2027-01-01T18:00:00Z",
      },
    ],
    { prodId: "-//Custom//Feed//EN" },
  );
  assert.match(ics, /Custom/);
});

test("buildEventIcs uses title fallback when url is missing for uid", () => {
  // Exercises `item.url || item.title || dtstart` fallback in uid generation
  const ics = buildEventIcs([
    { title: "No URL Event", start: "2027-02-01T18:00:00Z" },
  ]);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /SUMMARY:No URL Event/);
});

test("buildEventIcs uses Event as title fallback when title is missing", () => {
  // Exercises `item.title || "Event"` fallback
  const ics = buildEventIcs([
    { url: "https://a.example/e/", start: "2027-03-01T18:00:00Z" },
  ]);
  assert.match(ics, /SUMMARY:Event/);
});

test("buildEventIcs emits LOCATION and ORGANIZER lines", () => {
  // Exercises venue path and organizer conditional (site_title present)
  const ics = buildEventIcs([
    {
      url: "https://a.example/e/",
      title: "With Venue",
      start: "2027-04-01T18:00:00Z",
      venue: "The Hall",
      site_title: "My Site",
      site_origin: "https://a.example",
    },
  ]);
  assert.match(ics, /LOCATION:The Hall/);
  assert.match(ics, /ORGANIZER/);
});

// ─── Coverage: isBareCreativeIndexUrl branches ───────────────────────────────

test("isBareCreativeIndexUrl returns false for URL with query params (lines 718-719)", () => {
  // Exercises `if ([...searchParams.keys()].length > 0) return false`
  assert.equal(
    isBareCreativeIndexUrl("https://a.example/gallery/?work=photo1"),
    false,
  );
});

test("isBareCreativeIndexUrl returns false for URL constructor throw (lines 727-728)", () => {
  // Exercises the catch block
  assert.equal(isBareCreativeIndexUrl("not::a::url"), false);
  assert.equal(isBareCreativeIndexUrl(null), false);
});

test("isBareCreativeIndexUrl returns true for bare creative index path", () => {
  assert.equal(isBareCreativeIndexUrl("https://a.example/gallery/"), true);
  assert.equal(isBareCreativeIndexUrl("https://a.example/work/"), true);
  assert.equal(isBareCreativeIndexUrl("https://a.example/photos/"), true);
});

test("isMadeContentItem excludes bare creative index URLs (lines 758-759)", () => {
  // item.url is a bare creative index → isBareCreativeIndexUrl → return false
  assert.equal(
    isShowcaseContentItem({
      content_type: "photograph",
      url: "https://a.example/gallery/",
    }),
    false,
  );
  // Query params avoid the bare-index check; album paths stay eligible.
  assert.equal(
    isShowcaseContentItem({
      content_type: "photograph",
      url: "https://a.example/photos/2014/?utm=1",
      title: "Photo album",
      image: "https://a.example/photos/2014/cover.jpg",
      summary: "A year album of photographs from the trail.",
    }),
    true,
  );
  // Individual gallery query cards are not Showcase photography.
  assert.equal(
    isShowcaseContentItem({
      content_type: "photograph",
      url: "https://a.example/gallery/?work=photo1",
      title: "Photo one",
      image: "https://a.example/gallery/photo1.jpg",
      summary: "A photograph from the gallery.",
    }),
    false,
  );
});

test("buildEventIcs uses location field when venue is absent", () => {
  // Exercises `else if (item.location)` branch (item has location but no venue)
  const ics = buildEventIcs([
    {
      url: "https://a.example/e/",
      title: "Location Only",
      start: "2027-05-01T18:00:00Z",
      location: "Brooklyn, NY",
    },
  ]);
  assert.match(ics, /LOCATION:Brooklyn, NY/);
});

// ─── Remaining views/lib.mjs coverage (lines 372-383, 762-803, 837-842, 882-885, 913-914, 1665-1666) ───

test("compactContentItem: source_feeds portfolio entry sets source_kind (L372-380)", () => {
  // source_feeds contains {type:"portfolio"} → feedIsPortfolio=true → compact.source_kind="portfolio"
  const result = compactContentItem(
    {
      identity: "url:https://a.example/p/",
      url: "https://a.example/p/",
      title: "Portfolio Item",
      summary: "",
      site_origin: "https://a.example",
      content_type: "project",
      published_at: "",
      source_feeds: [{ type: "portfolio" }, { type: "rss" }],
    },
    new Map(),
    [],
  );
  assert.equal(result.source_kind, "portfolio");
});

test("compactContentItem: source.kind non-portfolio string sets source_kind (L382-383)", () => {
  // source.kind is a non-empty string that is NOT "portfolio" → else if branch
  const result = compactContentItem(
    {
      identity: "url:https://a.example/blog/post/",
      url: "https://a.example/blog/post/",
      title: "A Blog Post",
      summary: "",
      site_origin: "https://a.example",
      content_type: "article",
      published_at: "",
      source: { kind: "activity" },
    },
    new Map(),
    [],
  );
  assert.equal(result.source_kind, "activity");
});

test("creativePathKind: maps known root paths to correct kinds (L762-803)", () => {
  // Each root segment yields the correct kind or "" for a non-creative root.
  assert.equal(
    creativePathKind("https://a.example/gallery/photo.jpg"),
    "photography",
  );
  assert.equal(creativePathKind("https://a.example/art/piece/"), "art");
  assert.equal(creativePathKind("https://a.example/comics/strip-1/"), "art");
  assert.equal(creativePathKind("https://a.example/toys/widget/"), "project");
  assert.equal(creativePathKind("https://a.example/reels/clip/"), "video");
  assert.equal(creativePathKind("https://a.example/music/track/"), "music");
  assert.equal(
    creativePathKind("https://a.example/podcasts/ep-1/"),
    "podcasts",
  );
  assert.equal(creativePathKind("https://a.example/podcast/ep-1/"), "podcasts");
  assert.equal(creativePathKind("https://a.example/videos/clip/"), "video");
  assert.equal(creativePathKind("https://a.example/games/pong/"), "games");
  assert.equal(creativePathKind("https://a.example/apps/myapp/"), "apps");
  assert.equal(
    creativePathKind("https://a.example/software/tool/"),
    "software",
  );
  assert.equal(creativePathKind("https://a.example/design/logo/"), "design");
  assert.equal(creativePathKind("https://a.example/books/novel/"), "books");
  assert.equal(creativePathKind("https://a.example/guides/howto/"), "guides");
  // No creative root → "project" fallback (root is in CREATIVE_INDEX_ROOT but no specific match)
  assert.equal(
    creativePathKind("https://a.example/portfolio/case/"),
    "project",
  );
  // Root not in CREATIVE_INDEX_ROOT → ""
  assert.equal(creativePathKind("https://a.example/blog/post/"), "");
});

test("creativePathKind returns empty string for single-segment path (L756)", () => {
  // parts.length < 2 → early return ""
  assert.equal(creativePathKind("https://a.example/gallery/"), "");
});

test("isMadeContentItem: article with creative child URL uses creativePathKind (L832-837)", () => {
  // content_type="article" → showcaseKindForItem hits line 832 (creativePathKind).
  // url has depth >= 2 under a creative root → creativePathKind returns "project" → L837.
  const item = {
    url: "https://a.example/experiments/my-exp/",
    content_type: "article",
    title: "My Experiment",
    summary: "A detailed experimental write-up.",
  };
  assert.equal(isMadeContentItem(item), true);
});

test("isPortfolioSourcedItem: source.kind portfolio path (L882-885)", () => {
  // item.source_kind is absent but item.source.kind === "portfolio" → line 882-885
  const item = {
    url: "https://a.example/p/",
    content_type: "project",
    source: { kind: "portfolio" },
  };
  assert.equal(isPortfolioSourcedItem(item), true);
});

test("isClientCaseStudyUrl: catch branch on invalid URL (L913-914)", () => {
  // Passing an invalid URL string forces new URL() to throw → catch returns false.
  assert.equal(isClientCaseStudyUrl("not a url"), false);
  assert.equal(isClientCaseStudyUrl("https://[bad]/work/case/"), false);
});

test("buildEventIcs: default prodId is used when options.prodId absent (L1665-1666)", () => {
  // No prodId option → ternary takes the false branch → default PRODID string used.
  const ics = buildEventIcs(
    [
      {
        url: "https://a.example/e/",
        title: "Default ProdId",
        start: "2027-06-01T18:00:00Z",
      },
    ],
    // No prodId option
  );
  assert.match(ics, /PRODID:-\/\/Joshternet\/\/Happening\/\/EN/);
});

test("creativePathKind: invalid URL triggers catch branch (L803-804)", () => {
  // new URL("not a url") throws → catch returns ""
  assert.equal(creativePathKind("not a url"), "");
  assert.equal(creativePathKind("https://[bad]/gallery/shot/"), "");
});

test("showcaseKindForItem: article with non-creative URL is not a project", () => {
  const kind = showcaseKindForItem({
    url: "https://a.example/blog/post/",
    content_type: "article",
  });
  assert.equal(kind, "other");
});

test("showcaseKindForItem: unrecognized type with non-creative URL returns other (L841-842)", () => {
  // content_type="link" → fromType="other" → fromPath="" → L842 return fromType = "other"
  const kind = showcaseKindForItem({
    url: "https://a.example/links/",
    content_type: "link",
  });
  assert.equal(kind, "other");
});

test("showcaseItemHasSubstance: yearOnly title with short summary returns false (L948-949)", () => {
  // title = "2022" (year-only) AND summary.length < 12 → returns false
  // Use a project so we don't need a poster.
  const item = {
    url: "https://a.example/p/2022/",
    content_type: "project",
    title: "2022",
    summary: "short",
  };
  assert.equal(isMadeContentItem(item), false);
});

test("showcaseKind: sheet_music content type returns sheet music (L690)", () => {
  // The case "sheet_music" branch returns "sheet music".
  assert.equal(showcaseKind("sheet_music"), "sheet music");
});

test("showcaseItemHasSubstance: sheet music with local /assets/ image returns true (L949-955 via L951)", () => {
  // kind = "sheet music" → checks hasHttpsPoster (false) OR local /assets/ image (true).
  // The /assets/ path short-circuits the || to true (line 951), line 952 not evaluated.
  const item = {
    url: "https://a.example/sheet/",
    content_type: "sheet_music",
    title: "Waltz",
    summary: "",
    image: "/assets/scores/waltz-preview.png",
  };
  assert.equal(showcaseItemHasSubstance(item), true);
});

test("showcaseItemHasSubstance: sheet music with no image but long title returns true (L952)", () => {
  // kind = "sheet music" → hasHttpsPoster false, image not /assets/ → L952: title.length >= 8 → true.
  const item = {
    url: "https://a.example/sheet/",
    content_type: "sheet_music",
    title: "Beethoven", // 9 chars >= 8
    summary: "",
    // no image
  };
  assert.equal(showcaseItemHasSubstance(item), true);
});

test("buildEventIcs: item without url or title falls back to dtstart for UID (L1692-1693)", () => {
  // No url, no title → uidBase = dtstart (the else fallback branch).
  const ics = buildEventIcs([
    {
      start: "2027-07-04T12:00:00Z",
      // No url, no title
    },
  ]);
  // UID should be based on dtstart
  assert.match(ics, /UID:/);
  assert.match(ics, /DTSTART:20270704T120000Z/);
});

test('creativePathKind: null url uses || "" fallback and triggers catch (L754 false branch)', () => {
  // null → url || "" → "" → new URL("") throws → catch → return "".
  assert.equal(creativePathKind(null), "");
  assert.equal(creativePathKind(undefined), "");
});

test('isBareCreativeIndexUrl: root-only URL triggers || "/" fallback (L864 false branch)', () => {
  // pathname="/" → replace trailing slashes → "" (falsy) → || "/" fires → path="/".
  // parts = [] → length !== 1 → returns false.
  assert.equal(isBareCreativeIndexUrl("https://example.com/"), false);
});

test('isClientCaseStudyUrl: null url uses || "" fallback and triggers catch (L910 false branch)', () => {
  // null → url || "" → "" → new URL("") throws → catch → return false.
  assert.equal(isClientCaseStudyUrl(null), false);
  assert.equal(isClientCaseStudyUrl(undefined), false);
});

test("buildMadeItems: item with non-string site_origin uses empty-string key (L1072 false branch)", () => {
  // typeof item.site_origin !== "string" → false branch → key = "" (L1072).
  const items = buildMadeItems([
    {
      url: "https://external.example/gallery/portrait/",
      content_type: "article",
      title: "Portrait Session",
      summary: "A wonderful portrait session",
      image: "https://external.example/images/portrait.jpg",
      site_origin: null, // non-string → false branch at L1072
    },
  ]);
  // The item is eligible and should be included in the result.
  assert.ok(items.length > 0);
});

test("buildEventIcs: non-array first arg uses [] fallback (L1680 false branch)", () => {
  // Array.isArray(null) = false → false branch → items = [].
  const ics = buildEventIcs(null);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.doesNotMatch(ics, /BEGIN:VEVENT/);
});

test("buildEventIcs: item with no start field uses empty dtstart (L1691 false branch)", () => {
  // item.start is undefined → false branch → dtstart = "" → !dtstart → continue (item skipped).
  const ics = buildEventIcs([
    {
      url: "https://a.example/event/",
      title: "No Start Event",
      // No start field
    },
  ]);
  // Item skipped because dtstart is empty.
  assert.doesNotMatch(ics, /BEGIN:VEVENT/);
});

test("buildEventIcs: item with site_title but no site_origin uses empty siteOrigin (L1748 false branch)", () => {
  // organizer = site_title (truthy), site_origin is absent → false branch → siteOrigin = "".
  const ics = buildEventIcs([
    {
      url: "https://a.example/event/",
      title: "My Event",
      start: "2027-08-01T19:00:00Z",
      site_title: "My Concert Hall",
      // No site_origin
    },
  ]);
  // ORGANIZER line uses site_title as CN with empty URL.
  assert.match(ics, /ORGANIZER;CN=My Concert Hall:/);
});

test("isCreativeSeriesHubUrl excludes WWO hub when day toys exist", () => {
  const hub = "https://joshuamorris.info/experiments/weird-web-october-2026/";
  const days = [
    "https://joshuamorris.info/experiments/weird-web-october-2026/analog/",
    "https://joshuamorris.info/experiments/weird-web-october-2026/fake/",
    "https://joshuamorris.info/experiments/weird-web-october-2026/organic/",
    "https://joshuamorris.info/experiments/weird-web-october-2026/plastic/",
    "https://joshuamorris.info/experiments/weird-web-october-2026/reveal/",
    "https://joshuamorris.info/experiments/weird-web-october-2026/sheet/",
    "https://joshuamorris.info/experiments/weird-web-october-2026/skeuomorphism/",
    "https://joshuamorris.info/experiments/weird-web-october-2026/spark/",
  ];
  const corkboard = {
    content_type: "article",
    url: "https://joshuamorris.info/experiments/corkboard/",
    site_origin: "https://joshuamorris.info",
    title: "Corkboard",
    summary: "A corkboard for notes and pins in the browser.",
  };
  const modelViewer = {
    content_type: "article",
    url: "https://joshuamorris.info/experiments/model-viewer/",
    site_origin: "https://joshuamorris.info",
    title: "Model viewer",
    summary: "Inspect Trion figures in the browser.",
  };
  const hubItem = {
    content_type: "collection",
    url: hub,
    site_origin: "https://joshuamorris.info",
    title: "Weird Web October 2026",
    summary: "Eight daily toys for Weird Web October.",
  };
  const dayItems = days.map((url, index) => ({
    content_type: "article",
    url,
    site_origin: "https://joshuamorris.info",
    title: `Day toy ${index + 1}`,
    summary: "A Weird Web October day experiment with enough summary text.",
  }));

  const items = buildMadeItems(
    [hubItem, corkboard, modelViewer, ...dayItems],
    36,
  );

  assert.equal(
    items.some((item) => item.url === hub),
    false,
    "series hub must not appear",
  );
  assert.equal(
    days.every((url) => items.some((item) => item.url === url)),
    true,
    "all eight day toys must appear",
  );
  assert.ok(items.some((item) => item.title === "Corkboard"));
  assert.ok(items.some((item) => item.title === "Model viewer"));
});

test("isPhotoAggregatorUrl excludes View All Photos hubs", () => {
  assert.equal(
    isMadeContentItem({
      content_type: "photograph",
      url: "https://joshbeard.com/photos/all/",
      title: "View All Photos",
      summary: "A single index of every photo from every album.",
      image: "https://joshbeard.com/assets/img/cover.png",
    }),
    false,
  );
});

test("Muller toilet sample article is not a Showcase project", () => {
  const item = {
    content_type: "article",
    url: "https://joshmuller.ca/very_simple_toilet_sample/",
    site_origin: "https://joshmuller.ca",
    title: "Very Simple Model of Injection Molded Composting Toilet Frame",
    summary: "3D Viewer Desktop Controls",
    image: "https://joshmuller.ca/profile.jpg",
    source_kind: "rss",
  };
  assert.equal(isMadeContentItem(item), false);
  assert.equal(showcaseKindForItem(item), "other");
});

test("buildMadeItems omits title-echo summaries", () => {
  const items = buildMadeItems([
    {
      content_type: "photograph",
      url: "https://joshbeard.com/photos/2014/",
      site_origin: "https://joshbeard.com",
      title: "My Photos from 2014",
      summary: "My Photos from 2014",
      image: "https://joshbeard.com/photos/2014/cover.jpg",
    },
  ]);
  assert.equal(items[0].summary, "");
});

test("buildMadeItems keeps all Beard year albums when uncapped", () => {
  const years = [
    2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    2026,
  ];
  const photos = years.map((year) => ({
    content_type: "photograph",
    url: `https://joshbeard.com/photos/${year}/`,
    site_origin: "https://joshbeard.com",
    title: `My Photos from ${year}`,
    summary: `An assortment of photos from ${year}`,
    image: `https://joshbeard.com/photos/${year}/cover.jpg`,
  }));
  const items = buildMadeItems(photos);
  assert.equal(items.length, years.length);
  assert.ok(items.some((item) => /2023/.test(String(item.url))));
  assert.ok(items.some((item) => /2026/.test(String(item.url))));
  assert.equal(
    items.some((item) => /\/photos\/all\//.test(String(item.url))),
    false,
  );
  // Undated year albums still sort newest-looking URL first.
  assert.match(String(items[0].url), /\/photos\/2026\/$/);
  assert.match(String(items[items.length - 1].url), /\/photos\/2014\/$/);
});

test("compareShowcaseRecency prefers newer published_at then newer URL", () => {
  assert.ok(
    compareShowcaseRecency(
      {
        url: "https://a.example/old",
        published_at: "2026-01-01T00:00:00.000Z",
      },
      {
        url: "https://a.example/new",
        published_at: "2026-10-01T00:00:00.000Z",
      },
    ) > 0,
  );
  assert.ok(
    compareShowcaseRecency(
      { url: "https://a.example/photos/2014/" },
      { url: "https://a.example/photos/2026/" },
    ) > 0,
  );
  // Missing urls exercise the `|| ""` tiebreaker branches.
  assert.equal(
    compareShowcaseRecency(
      { published_at: "2026-01-01T00:00:00.000Z" },
      { published_at: "2026-01-01T00:00:00.000Z" },
    ),
    0,
  );
});

test("compactContentItem clears title-echo summaries", () => {
  const sites = new Map([
    ["https://joshbeard.com", { title: "Josh Beard", domain: "joshbeard.com" }],
  ]);
  const compact = compactContentItem(
    {
      url: "https://joshbeard.com/photos/2014/",
      site_origin: "https://joshbeard.com",
      title: "My Photos from 2014",
      summary: "My Photos from 2014",
      content_type: "photograph",
      image: "https://joshbeard.com/photos/2014/cover.jpg",
    },
    sites,
    new Set(),
  );
  assert.equal(compact.summary, "");
});

test("isPhotoAggregatorUrl catch and non-photo roots", () => {
  assert.equal(isPhotoAggregatorUrl("not a url"), false);
  assert.equal(isPhotoAggregatorUrl("https://a.example/work/all/"), false);
  assert.equal(isPhotoAggregatorUrl("https://a.example/photos/"), false);
});

test("isCreativeSeriesHubUrl returns false without children or bad urls", () => {
  assert.equal(
    isCreativeSeriesHubUrl("https://a.example/experiments/corkboard/", [
      "https://a.example/experiments/model-viewer/",
    ]),
    false,
  );
  assert.equal(isCreativeSeriesHubUrl("not a url", []), false);
  assert.equal(
    isCreativeSeriesHubUrl("https://a.example/experiments/series/", null),
    false,
  );
});

test("isPhotoAggregatorUrl accepts view-all album slug", () => {
  assert.equal(
    isPhotoAggregatorUrl("https://joshbeard.com/photos/view-all/"),
    true,
  );
});

test("isMadeContentItem uses siblingUrls option for series hubs", () => {
  const hub = {
    content_type: "collection",
    url: "https://joshuamorris.info/experiments/weird-web-october-2026/",
    title: "Weird Web October 2026",
    summary: "Eight daily toys for Weird Web October.",
  };
  assert.equal(
    isMadeContentItem(hub, {
      siblingUrls: [
        "https://joshuamorris.info/experiments/weird-web-october-2026/analog/",
      ],
    }),
    false,
  );
  assert.equal(isMadeContentItem(hub, { siblingUrls: [] }), true);
});

test("isCreativeSeriesHubUrl skips unparseable siblings", () => {
  assert.equal(
    isCreativeSeriesHubUrl("https://a.example/experiments/series/", [
      "not a url",
      "https://a.example/experiments/other/leaf/",
    ]),
    false,
  );
  assert.equal(
    isCreativeSeriesHubUrl("https://a.example/experiments/series/", [
      "https://a.example/experiments/series/day-one/",
    ]),
    true,
  );
});

test("isPhotoAggregatorUrl covers galleries/everything", () => {
  assert.equal(
    isPhotoAggregatorUrl("https://a.example/galleries/everything/"),
    true,
  );
});

test("isPhotoAggregatorUrl covers each photo root and aggregator slug", () => {
  for (const root of [
    "gallery",
    "galleries",
    "albums",
    "photography",
    "photos",
  ]) {
    assert.equal(
      isPhotoAggregatorUrl(`https://a.example/${root}/all/`),
      true,
      root,
    );
  }
  assert.equal(isPhotoAggregatorUrl("https://a.example/photos/viewall/"), true);
  assert.equal(isPhotoAggregatorUrl("https://a.example/photos/index/"), true);
  assert.equal(isPhotoAggregatorUrl("https://a.example/photos/2024/"), false);
});

test("isCreativeSeriesHubUrl rejects non-creative two-segment paths", () => {
  assert.equal(
    isCreativeSeriesHubUrl("https://a.example/blog/series/", [
      "https://a.example/blog/series/one/",
    ]),
    false,
  );
});

test("pathnameParts empty url via isNamedRootProjectUrl", () => {
  assert.equal(isNamedRootProjectUrl(""), false);
  assert.equal(isNamedRootProjectUrl(null), false);
});

test("compactContentItem keeps distinct summaries", () => {
  const sites = new Map([
    ["https://joshbeard.com", { title: "Josh Beard", domain: "joshbeard.com" }],
  ]);
  const compact = compactContentItem(
    {
      url: "https://joshbeard.com/photos/2016/",
      site_origin: "https://joshbeard.com",
      title: "My Photos from 2016",
      summary: "Including hikes around Colorado",
      content_type: "photograph",
      image: "https://joshbeard.com/photos/2016/cover.jpg",
    },
    sites,
    new Set(),
  );
  assert.match(String(compact.summary), /Colorado/);
});

test("isMadeContentItem without options uses empty sibling list", () => {
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://a.example/experiments/corkboard/",
      title: "Corkboard",
      summary: "A corkboard for notes and pins in the browser.",
    }),
    true,
  );
});

test("isPhotoAggregatorUrl falsy url uses empty-string fallback", () => {
  assert.equal(isPhotoAggregatorUrl(null), false);
  assert.equal(isPhotoAggregatorUrl(undefined), false);
  assert.equal(isPhotoAggregatorUrl(""), false);
});

test("buildMadeItems accepts imaged photograph with empty title", () => {
  const items = buildMadeItems([
    {
      content_type: "photograph",
      url: "https://joshbeard.com/photos/2014/",
      site_origin: "https://joshbeard.com",
      title: "",
      summary: "Cover photo album",
      image: "https://joshbeard.com/photos/2014/cover.jpg",
    },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "");
});

test("Showcase photography/art keeps albums and drops individual image pages", () => {
  assert.equal(
    isPhotoOrArtCollectionUrl("https://joshbeard.com/photos/2014/"),
    true,
  );
  assert.equal(
    isIndividualPhotoOrArtWorkUrl(
      "https://joshbeard.com/photos/2017/20170513-finch-lake-1_jpg.html",
    ),
    true,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "photograph",
      url: "https://joshbeard.com/photos/2014/",
      title: "My Photos from 2014",
      summary: "An assortment of photos from 2014",
      image: "https://joshbeard.com/photos/2014/cover.jpg",
    }),
    true,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "photograph",
      url: "https://joshbeard.com/photos/2017/20170513-finch-lake-1_jpg.html",
      title: "Finch Lake, Allenspark, Colorado. May 13, 2017.",
      summary: "A single photo page must not become a Showcase card",
      image: "https://joshbeard.com/photos/2017/20170513-finch-lake-1.jpg",
    }),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "visual_artwork",
      url: "https://a.example/art/summer-show/piece-3/",
      title: "Piece three from the summer show",
      summary: "Individual artwork under an art collection",
      image: "https://a.example/art/summer-show/piece-3.jpg",
    }),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "visual_artwork",
      url: "https://a.example/art/summer-show/",
      title: "Summer show",
      summary: "A collection of illustrations from the summer show",
      image: "https://a.example/art/summer-show/cover.jpg",
    }),
    true,
  );

  const made = buildMadeItems([
    {
      content_type: "photograph",
      url: "https://joshbeard.com/photos/2026/",
      title: "My Photos from 2026",
      summary: "Year album",
      image: "https://joshbeard.com/photos/2026/cover.jpg",
    },
    {
      content_type: "photograph",
      url: "https://joshbeard.com/photos/2026/IMG_1548_jpeg.html",
      title: "A single frame from 2026",
      summary: "Individual photo HTML page",
      image: "https://joshbeard.com/photos/2026/IMG_1548.jpeg",
    },
  ]);
  assert.equal(made.length, 1);
  assert.match(String(made[0].url), /\/photos\/2026\/$/);
});

test("isMadeContentItem rejects identity nav topics notes reading webrings feeds", () => {
  const poster = "https://example.com/og.png";
  const chrome = [
    "https://joshbeard.com/me/",
    "https://joshua.seigler.net/links/",
    "https://joshuamorris.info/buttons/",
    "https://joshbeard.com/more/",
    "https://joshghent.com/referrals",
    "https://joshua.seigler.net/now/",
    "https://joshuamorris.info/uses/",
    "https://joshuamorris.info/dedication/",
    "https://joshuamorris.info/topics/video-games/",
    "https://joshuamorris.info/notes/2026/07/",
    "https://joshuamorris.info/reading/",
    "https://example.com/webrings/",
    "https://example.com/rss.xml",
    "https://example.com/posts/",
  ];

  for (const url of chrome) {
    assert.equal(
      isMadeContentItem({
        content_type: "project",
        url,
        title: "Chrome page with a long enough title",
        summary:
          "A summary that is definitely long enough for substance checks",
        image: poster,
      }),
      false,
      url,
    );
  }
});

test("compactContentItem preserves page_role for Showcase writing gate", () => {
  const sites = new Map([
    [
      "https://joshghent.com",
      {
        origin: "https://joshghent.com",
        domain: "joshghent.com",
        title: "Josh Ghent",
      },
    ],
  ]);
  const compact = compactContentItem(
    {
      url: "https://joshghent.com/created-my-own-status-page/",
      title: "Status page",
      summary: "Built a status page",
      content_type: "project",
      page_role: "article",
      site_origin: "https://joshghent.com",
      source: { kind: "creative-homepage" },
    },
    sites,
    new Set(),
  );
  assert.equal(compact.page_role, "article");
  assert.equal(compact.source_kind, "creative-homepage");
});

test("compactContentItem keeps local activity poster paths", () => {
  const compact = compactContentItem(
    {
      url: "https://themorning.app/",
      site_origin: "https://joshgr.com",
      title: "The Morning App",
      content_type: "project",
      image: "/assets/activity/posters/abc123.webp",
    },
    new Map([
      ["https://joshgr.com", { title: "Josh Grant", domain: "joshgr.com" }],
    ]),
    new Set(),
  );

  assert.equal(compact?.image, "/assets/activity/posters/abc123.webp");
  assert.equal(compact?.image_origin, "");
});

test("isMadeContentItem requires creative-directory URLs for projects", () => {
  assert.equal(isSiteHomeUrl("https://joshmuller.ca/"), true);
  assert.equal(
    isMemberSiteHomeItem({
      url: "https://joshmuller.ca/",
      site_origin: "https://joshmuller.ca",
    }),
    true,
  );
  assert.equal(
    isMemberSiteHomeItem({
      url: "https://themorning.app/",
      site_origin: "https://joshgr.com",
    }),
    false,
  );
  assert.equal(
    isExternalShelfProject({
      url: "https://themorning.app/",
      site_origin: "https://joshgr.com",
      source_kind: "creative-homepage-shelf",
    }),
    true,
  );
  assert.equal(
    isExternalShelfProject({
      url: "https://joshgr.com/wizardly-words/",
      site_origin: "https://joshgr.com",
      source_kind: "creative-homepage-shelf",
    }),
    false,
  );
  assert.equal(
    isExternalShelfProject({
      url: "https://themorning.app/",
      site_origin: "https://joshgr.com",
      source_kind: "creative-homepage",
    }),
    false,
  );
  assert.equal(isExternalShelfProject(null), false);
  assert.equal(isExternalShelfProject("x"), false);
  assert.equal(
    isExternalShelfProject({
      url: 42,
      site_origin: "https://joshgr.com",
      source_kind: "creative-homepage-shelf",
    }),
    false,
  );
  assert.equal(
    isExternalShelfProject({
      url: "https://themorning.app/",
      site_origin: "https://exa mple.com",
      source_kind: "creative-homepage-shelf",
    }),
    false,
  );
  assert.equal(isMemberSiteHomeItem(null), false);
  assert.equal(
    isMemberSiteHomeItem({
      url: "https://joshgr.com/",
    }),
    true,
  );
  assert.equal(
    isMemberSiteHomeItem({
      url: "https://joshgr.com/",
      site_origin: "",
    }),
    true,
  );
  assert.equal(
    isMemberSiteHomeItem({
      url: "https://joshgr.com/",
      site_origin: "https://exa mple.com",
    }),
    true,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://joshmuller.ca/",
      site_origin: "https://joshmuller.ca",
      title: "Josh Müller",
      summary: "Homepage is not a Showcase project",
      image: "https://joshmuller.ca/profile.jpg",
      source_kind: "creative-figure",
    }),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://joshuakim.studio/work.html",
      title: "Work, Joshua Kim",
      summary: "Bare work index is not an individual project",
      image: "https://joshuakim.studio/images/og-cover.jpg",
      source_kind: "creative-og",
    }),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://www.joshcanhelp.com/personal-data-pipeline/",
      title: "Imagining a Personal Data Pipeline",
      summary: "Articles about personal data pipelines are not projects",
      image: "https://www.joshcanhelp.com/_images/2024/data-pipeline.png",
      source_kind: "creative-homepage",
    }),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://www.joshcanhelp.com/personal-data-pipeline-update/",
      title: "Personal Data Pipeline Update",
      summary:
        "Taking a step forward on the Personal Data Pipeline project by autoloading JSON.",
      image: "https://www.joshcanhelp.com/_images/2024/bike_frame.jpg",
      source_kind: "creative-homepage",
    }),
    false,
  );
  assert.equal(isBlogShapedProjectTitle("Personal Data Pipeline Update"), true);
  assert.equal(isBlogShapedProjectTitle(""), false);
  assert.equal(isBlogShapedProjectTitle(null), false);
  assert.equal(isBlogShapedProjectTitle("SomaSpace"), false);
  assert.equal(
    isExactSlugProductTitle(
      "Personal Data Pipeline Update",
      "https://www.joshcanhelp.com/personal-data-pipeline-update/",
    ),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://joshua.seigler.net/recipes/",
      title: "/recipes",
      summary: "Recipes directories are not Showcase projects",
      source_kind: "creative-homepage",
    }),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://joshtronic.com/code/",
      title: "Code",
      summary: "Code indexes are not Showcase projects",
      source_kind: "creative-homepage",
    }),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://joshtronic.com/hustles/",
      title: "things",
      summary: "Things/hustles indexes are not Showcase projects",
      source_kind: "creative-homepage",
    }),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "collection",
      url: "https://joshuamorris.info/experiments/corkboard/",
      title: "Corkboard",
      summary: "Pin notes on a corkboard",
      image: "https://joshuamorris.info/images/corkboard.webp",
      source_kind: "creative-index",
    }),
    true,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://joshuakim.studio/somaspace",
      title:
        "02 M.A. Thesis · Installation SomaSpace Webcams track your body, and your movement turns into soft visuals and sound on the wall. Solo M.A. thesis · built in TouchDesigner with MediaPipe.",
      summary:
        "SomaSpace is a body-tracking installation that turns body movement into soft visuals and sound.",
      image: "https://joshuakim.studio/images/og-cover.jpg",
      source_kind: "creative-homepage",
    }),
    true,
  );
  assert.equal(
    isNamedRootProjectUrl("https://joshuakim.studio/work.html"),
    false,
  );
  assert.equal(
    isNamedRootProjectUrl("https://joshuakim.studio/somaspace"),
    true,
  );
  assert.equal(
    isPortfolioIndexedProjectTitle(
      "02 M.A. Thesis · Installation SomaSpace Webcams track your body",
    ),
    true,
  );
  assert.equal(isPortfolioIndexedProjectTitle("SomaSpace"), false);
  assert.equal(isPortfolioIndexedProjectTitle(null), false);
  assert.equal(isPortfolioIndexedProjectTitle(""), false);
  assert.equal(
    isExactSlugProductTitle(null, "https://joshuakim.studio/somaspace"),
    false,
  );
  assert.equal(
    isExactSlugProductTitle(undefined, "https://joshuakim.studio/somaspace"),
    false,
  );
  assert.equal(
    projectTitleMatchingSlug(
      "02 M.A. Thesis · Installation SomaSpace Webcams track your body",
      "somaspace",
    ),
    "SomaSpace",
  );
  assert.equal(
    isExactSlugProductTitle("SomaSpace", "https://joshuakim.studio/somaspace"),
    true,
  );
  assert.equal(
    isExactSlugProductTitle(
      "Imagining a Personal Data Pipeline",
      "https://www.joshcanhelp.com/personal-data-pipeline/",
    ),
    false,
  );
  assert.equal(
    isNamedRootCreativeProduct({
      url: "https://joshuakim.studio/chewchat",
      title: "ChewChat",
      source_kind: "creative-homepage",
    }),
    true,
  );
  assert.equal(
    isNamedRootCreativeProduct({
      url: "https://joshuakim.studio/vap",
      title: "VAP",
      source: { kind: "creative-schema" },
    }),
    true,
  );
  assert.equal(
    isNamedRootCreativeProduct({
      url: "https://joshuakim.studio/about",
      title: "01 About page",
    }),
    false,
  );
  assert.equal(isNamedRootCreativeProduct(null), false);
  assert.equal(isNamedRootProjectUrl("https://joshuakim.studio/a/b"), false);
  assert.equal(isNamedRootProjectUrl("not a url"), false);
  assert.equal(
    isExactSlugProductTitle("SomaSpace", "https://joshuakim.studio/a/b"),
    false,
  );
  assert.equal(
    isExactSlugProductTitle("x", "https://joshuakim.studio/somaspace"),
    false,
  );
  assert.equal(
    isExactSlugProductTitle(
      "This title is intentionally longer than forty-eight characters total",
      "https://joshuakim.studio/somaspace",
    ),
    false,
  );
  assert.equal(projectTitleMatchingSlug("", "somaspace"), "");
  assert.equal(projectTitleMatchingSlug("SomaSpace", ""), "");
  assert.equal(
    projectTitleMatchingSlug("Almost SomaSpac but truncated", "somaspace"),
    "",
  );
  assert.equal(
    projectTitleMatchingSlug("xx SomaSpace!", "somaspace"),
    "SomaSpace",
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://joshuakim.studio/kindbite",
      title: "KindBite",
      summary: "Surplus food app",
      image: "https://joshuakim.studio/images/kindbite-poster.jpg",
      source_kind: "",
      source: { kind: "creative-schema" },
    }),
    true,
  );
  assert.equal(
    isNamedRootCreativeProduct({
      url: "https://joshuakim.studio/mystery",
      title: "No matching product name here",
      source: { kind: 42 },
    }),
    false,
  );
  assert.equal(
    isNamedRootCreativeProduct({
      url: "https://joshuakim.studio/mystery",
      title: "No matching product name here",
    }),
    false,
  );
});

test("showcaseCardTitle strips HTML and experiment day numbers", () => {
  assert.equal(
    showcaseCardTitle({
      url: "https://joshuamorris.info/experiments/weird-web-october-2026/plastic/",
      title: "4 Plastic",
    }),
    "Plastic",
  );
  assert.equal(
    showcaseCardTitle({
      url: "https://joshmuller.ca/",
      title: '📸: <a href="/">Josh Müller</a>',
    }),
    "📸: Josh Müller",
  );
  assert.equal(isSiteHomeUrl("not a url"), false);
  assert.equal(isSiteHomeUrl(""), false);
  assert.equal(isSiteHomeUrl(null), false);
  assert.equal(isBareCreativeIndexUrl("https://a.example/work.html"), true);
  assert.equal(
    showcaseCardTitle({ title: "Plain title without url" }),
    "Plain title without url",
  );
  assert.equal(
    showcaseCardTitle({
      url: "https://a.example/experiments/x/",
      title: "7 Organic &amp; More&nbsp;Stuff &middot; day",
    }),
    "Organic & More Stuff · day",
  );
  assert.equal(
    showcaseCardTitle({
      url: "https://joshuamorris.info/experiments/corkboard/",
      title:
        "Corkboard A corkboard for notes, pins, and connecting threads in the browser",
      summary:
        "A corkboard for notes, pins, and connecting threads in the browser",
    }),
    "Corkboard",
  );
  assert.equal(
    showcaseCardTitle({
      url: "https://joshuakim.studio/somaspace",
      title:
        "02 M.A. Thesis · Installation SomaSpace Webcams track your body, and your movement turns into soft visuals and sound on the wall. Solo M.A. thesis · built in TouchDesigner with MediaPipe. (opens on the publisher’s site)",
    }),
    "SomaSpace",
  );
  assert.equal(
    showcaseCardTitle({
      url: "https://joshuakim.studio/prismcatch",
      title:
        "04 p5.js · Playable Prism Catch Colored light falls, and a rope between your finger and thumb catches it.",
    }),
    "Prism Catch",
  );
  assert.equal(
    showcaseCardTitle({
      url: "https://joshuakim.studio/order-pipeline",
      title:
        "01 Internal tools · Automation Order Pipeline Toolkit Order contents and label printing, made way easier",
    }),
    "Order Pipeline Toolkit",
  );
});

test("showcaseItemHasSubstance rejects year-only project shells", () => {
  assert.equal(
    showcaseItemHasSubstance({
      content_type: "project",
      url: "https://a.example/experiments/2022/",
      title: "2022",
      summary: "short",
      source_kind: "creative-index",
    }),
    false,
  );
});

test("isMadeContentItem keeps experiments games and rejects plain articles", () => {
  assert.equal(
    isMadeContentItem({
      content_type: "article",
      url: "https://joshuamorris.info/experiments/weird-web-october-2026/analog/",
      title: "Analog",
      summary: "Weird Web October day toy",
      image: "https://joshuamorris.info/images/analog.webp",
    }),
    true,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "article",
      url: "https://joshghent.com/status-pages-are-expensive/",
      title: "I created my own status page",
      summary: "Status pages somehow cost thousands so I built one",
      image: "https://joshghent.com/img/status.png",
    }),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      page_role: "article",
      url: "https://joshghent.com/created-my-own-status-page/",
      title:
        "Oct 5, 2026 · 4 min read I created my own status page Status pages…",
      summary:
        "Status pages are a single HTML page that somehow costs thousands.",
      image: "https://joshghent.com/assets/icons/repowarden.svg",
      source_kind: "creative-homepage",
    }),
    false,
  );
  assert.equal(
    showcaseKindForItem({
      content_type: "article",
      url: "https://joshghent.com/status-pages-are-expensive/",
    }),
    "other",
  );
});

test("What's New receives Showcase toys; writing does not enter Showcase", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");
  const views = buildViewDocuments({
    network: [
      {
        origin: "https://joshuamorris.info",
        domain: "joshuamorris.info",
        title: "Joshua Morris",
      },
    ],
    content: {
      items: [
        {
          content_type: "article",
          url: "https://joshuamorris.info/notes/2026/10/01/hello/",
          site_origin: "https://joshuamorris.info",
          title: "Hello note",
          summary: "A writing item for What's New only",
          // Newer than the toy so oneLatestPerOrigin keeps this writing row.
          published_at: "2026-10-07T18:00:00.000Z",
        },
        {
          content_type: "article",
          url: "https://joshuamorris.info/experiments/weird-web-october-2026/spark/",
          site_origin: "https://joshuamorris.info",
          title: "Spark",
          summary: "WWO day toy for Showcase and What's New",
          published_at: "2026-10-07T12:00:00.000Z",
          image: "https://joshuamorris.info/images/spark.webp",
        },
        {
          content_type: "project",
          url: "https://joshuamorris.info/now/",
          site_origin: "https://joshuamorris.info",
          title: "Now",
          summary: "Identity slash page must not be Showcase",
          image: "https://joshuamorris.info/images/now.png",
        },
      ],
    },
    topics: { communities: [] },
    connections: { edges: [] },
    now,
  });

  const showcaseUrls = (views.showcase.items || []).map((item) => item.url);
  assert.ok(
    showcaseUrls.includes(
      "https://joshuamorris.info/experiments/weird-web-october-2026/spark/",
    ),
  );
  assert.equal(showcaseUrls.includes("https://joshuamorris.info/now/"), false);
  assert.equal(
    showcaseUrls.includes("https://joshuamorris.info/notes/2026/10/01/hello/"),
    false,
  );

  const activityUrls = (views.activity.primary || []).map((item) => item.url);
  assert.ok(
    activityUrls.includes(
      "https://joshuamorris.info/experiments/weird-web-october-2026/spark/",
    ),
  );
  assert.ok(
    activityUrls.includes("https://joshuamorris.info/notes/2026/10/01/hello/"),
  );
});
