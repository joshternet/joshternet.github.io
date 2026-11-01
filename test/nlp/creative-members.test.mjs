/**
 * Goal & Constraints:
 * Verify creative-work extraction for cross-participant (member) fixture pages.
 * Each fixture must yield ≥1 creative/project item without person-specific rules.
 * The baker-portfolio fixture must also be parseable by portfolio.mjs.
 * The morris-experiments fixture at /experiments/ must be recognised as a
 * creative index (isCreativeIndexPath).
 * New index roots (guides, software, experiments) must pass isCreativeIndexPath.
 *
 * Target files: scripts/nlp/creative.mjs, scripts/nlp/portfolio.mjs
 * Do not modify plan file or commit.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  collectCreativeWorks,
  creativeItemsFromHomepageLinks,
  creativeItemsFromIndexLinks,
  creativeItemsFromOpenGraph,
  isCreativeIndexPath,
} from "../../scripts/nlp/creative.mjs";
import { collectPortfolio } from "../../scripts/nlp/portfolio.mjs";

const fixtureDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/creative/members",
);

/**
 * @param {string} name
 * @returns {string}
 */
function fixture(name) {
  return fs.readFileSync(path.join(fixtureDir, name), "utf8");
}

const OBSERVED_AT = "2026-10-31T00:00:00Z";

// ─── isCreativeIndexPath: new roots ──────────────────────────────────────────

test("isCreativeIndexPath: experiments is a recognised creative index root", () => {
  assert.equal(isCreativeIndexPath("/experiments/"), true);
  assert.equal(isCreativeIndexPath("/experiments"), true);
});

test("isCreativeIndexPath: software is a recognised creative index root", () => {
  assert.equal(isCreativeIndexPath("/software/"), true);
  assert.equal(isCreativeIndexPath("/software"), true);
});

test("isCreativeIndexPath: guides is a recognised creative index root", () => {
  assert.equal(isCreativeIndexPath("/guides/"), true);
  assert.equal(isCreativeIndexPath("/guides"), true);
});

test("isCreativeIndexPath: sounds, apps, books, resources, shows, concerts, events", () => {
  for (const root of [
    "/sounds",
    "/apps",
    "/books",
    "/resources",
    "/shows",
    "/concerts",
    "/events",
  ]) {
    assert.equal(
      isCreativeIndexPath(root),
      true,
      `Expected isCreativeIndexPath("${root}") to be true`,
    );
  }
});

// ─── beard-photos: photography gallery ───────────────────────────────────────

test("beard-photos: collectCreativeWorks yields ≥1 photograph or collection item", () => {
  const html = fixture("beard-photos.html");
  const { items } = collectCreativeWorks(
    [
      {
        url: "https://photos.example/gallery/",
        html,
        lang: "en",
      },
    ],
    { siteOrigin: "https://photos.example", observedAt: OBSERVED_AT },
  );

  assert.ok(items.length >= 1, `Expected ≥1 items, got ${items.length}`);
  assert.ok(
    items.some(
      (item) =>
        item.content_type === "photograph" ||
        item.content_type === "collection",
    ),
    "Expected at least one photograph or collection item",
  );
  assert.ok(
    items.every((item) =>
      String(item.url).startsWith("https://photos.example"),
    ),
    "All items must be same-origin",
  );
});

test("beard-photos: figure captions extracted without person-specific rules", () => {
  const html = fixture("beard-photos.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://photos.example/gallery/", html, lang: "en" }],
    { siteOrigin: "https://photos.example", observedAt: OBSERVED_AT },
  );

  // At least one figure-derived item with a descriptive caption.
  assert.ok(
    items.some((item) => /canyon|desert|mesa|salt/i.test(String(item.title))),
    `Expected a figure-derived item with caption; got titles: ${items.map((i) => i.title).join(", ")}`,
  );
});

// ─── ghent-products: OSS / product listings ──────────────────────────────────

test("ghent-products: collectCreativeWorks yields ≥1 project item", () => {
  const html = fixture("ghent-products.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://ghent.example/projects/", html, lang: "en" }],
    { siteOrigin: "https://ghent.example", observedAt: OBSERVED_AT },
  );

  assert.ok(items.length >= 1, `Expected ≥1 items, got ${items.length}`);
  assert.ok(
    items.some((item) => /fieldnotes|logseq|homelab/i.test(String(item.title))),
    "Expected at least one known product item",
  );
});

// ─── sherman-games: games index ───────────────────────────────────────────────

test("sherman-games: collectCreativeWorks yields ≥1 game item", () => {
  const html = fixture("sherman-games.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://games.example/games/", html, lang: "en" }],
    { siteOrigin: "https://games.example", observedAt: OBSERVED_AT },
  );

  assert.ok(items.length >= 1, `Expected ≥1 items, got ${items.length}`);
  assert.ok(
    items.some((item) => item.content_type === "game"),
    "Expected at least one game content_type item",
  );
});

test("sherman-games: VideoGame schema type resolves to game", () => {
  const html = fixture("sherman-games.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://games.example/games/", html, lang: "en" }],
    { siteOrigin: "https://games.example", observedAt: OBSERVED_AT },
  );

  const hollowDrift = items.find((item) =>
    /hollow drift/i.test(String(item.title)),
  );
  assert.ok(hollowDrift, "Hollow Drift item should be found");
  assert.equal(hollowDrift.content_type, "game");
});

// ─── seigler-tools: software / watchfaces ────────────────────────────────────

test("seigler-tools: collectCreativeWorks yields ≥1 item", () => {
  const html = fixture("seigler-tools.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://seigler.example/software/", html, lang: "en" }],
    { siteOrigin: "https://seigler.example", observedAt: OBSERVED_AT },
  );

  assert.ok(items.length >= 1, `Expected ≥1 items, got ${items.length}`);
  assert.ok(
    items.some((item) => /tide|weather|font/i.test(String(item.title))),
    "Expected at least one known tool item",
  );
});

test("seigler-tools: MobileApplication schema type resolves to game", () => {
  const html = fixture("seigler-tools.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://seigler.example/software/", html, lang: "en" }],
    { siteOrigin: "https://seigler.example", observedAt: OBSERVED_AT },
  );

  const tide = items.find((item) => /tide/i.test(String(item.title)));
  assert.ok(tide, "Tide Watchface item should be found");
  // MobileApplication maps to "game" (app-type content_type)
  assert.equal(tide.content_type, "game");
});

// ─── baker-portfolio: portfolio table ────────────────────────────────────────

test("baker-portfolio: collectPortfolio parses sector table with data-sort-col", () => {
  const html = fixture("baker-portfolio.html");
  const { profile, items, subjects } = collectPortfolio(
    [{ url: "https://baker.example/work/", html, lang: "en" }],
    { siteOrigin: "https://baker.example", observedAt: OBSERVED_AT },
  );

  assert.ok(profile !== null, "Profile should be non-null");
  assert.ok(
    profile.work_count >= 4,
    `Expected ≥4 works, got ${profile.work_count}`,
  );
  assert.ok(items.length >= 1, "Expected ≥1 items from portfolio table");

  // Sector topics should include health, fintech, government, design
  const slugs = subjects.map((s) => s.slug);
  assert.ok(
    slugs.some((slug) => /health/.test(slug)),
    "Expected health sector topic",
  );
  assert.ok(
    slugs.some((slug) => /fintech|banking|finance/.test(slug)),
    "Expected fintech/banking sector topic",
  );
});

// ─── morris-experiments: experimental web projects at /experiments/ ───────────

test("morris-experiments: /experiments/ is a creative index path", () => {
  assert.equal(isCreativeIndexPath("/experiments/"), true);
});

test("morris-experiments: creativeItemsFromIndexLinks extracts project links", () => {
  const html = fixture("morris-experiments.html");
  const items = creativeItemsFromIndexLinks(
    html,
    "https://morris.example/experiments/",
    "https://morris.example",
    OBSERVED_AT,
  );

  assert.ok(
    items.length >= 1,
    `Expected ≥1 items from experiments index, got ${items.length}`,
  );
  assert.ok(
    items.some((item) => /canvas|css|svg|audio/i.test(String(item.title))),
    "Expected at least one experiment link item",
  );
});

test("morris-experiments: collectCreativeWorks yields ≥1 item", () => {
  const html = fixture("morris-experiments.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://morris.example/experiments/", html, lang: "en" }],
    { siteOrigin: "https://morris.example", observedAt: OBSERVED_AT },
  );

  assert.ok(items.length >= 1, `Expected ≥1 items, got ${items.length}`);
  assert.ok(
    items.every((item) =>
      String(item.url).startsWith("https://morris.example"),
    ),
    "All items must be same-origin",
  );
});

test("morris-experiments: OG fallback extraction on experiments index page", () => {
  const html = fixture("morris-experiments.html");
  const items = creativeItemsFromOpenGraph(
    html,
    "https://morris.example/experiments/",
    "https://morris.example",
    OBSERVED_AT,
  );

  // OG data present (og:type=website, og:title, og:url) → should produce 1 item
  assert.ok(items.length >= 1, "Expected OG fallback to produce an item");
  assert.ok(
    /web experiments|experiments/i.test(String(items[0]?.title)),
    `Expected OG title to match; got: "${items[0]?.title}"`,
  );
  assert.equal(items[0]?.source?.kind, "creative-og");
});

// ─── muller-guides: guides / tools ───────────────────────────────────────────

test("muller-guides: collectCreativeWorks yields ≥1 item", () => {
  const html = fixture("muller-guides.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://muller.example/guides/", html, lang: "en" }],
    { siteOrigin: "https://muller.example", observedAt: OBSERVED_AT },
  );

  assert.ok(items.length >= 1, `Expected ≥1 items, got ${items.length}`);
  assert.ok(
    items.some((item) => /git|colour|shell/i.test(String(item.title))),
    "Expected at least one known guide item",
  );
});

test("muller-guides: Book schema type is accepted", () => {
  const html = fixture("muller-guides.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://muller.example/guides/", html, lang: "en" }],
    { siteOrigin: "https://muller.example", observedAt: OBSERVED_AT },
  );

  const book = items.find((item) =>
    /shell scripting/i.test(String(item.title)),
  );
  assert.ok(book, "Practical Shell Scripting book item should be found");
  // Book falls through to "project" content_type
  assert.equal(book.content_type, "project");
});

test("muller-guides: HowTo schema type is accepted", () => {
  const html = fixture("muller-guides.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://muller.example/guides/", html, lang: "en" }],
    { siteOrigin: "https://muller.example", observedAt: OBSERVED_AT },
  );

  const howTo = items.find((item) =>
    /self-hosted git/i.test(String(item.title)),
  );
  assert.ok(howTo, "HowTo guide item should be found");
  assert.equal(howTo.content_type, "project");
});

// ─── cunningham-software: technical project links ─────────────────────────────

test("cunningham-software: collectCreativeWorks yields ≥1 item", () => {
  const html = fixture("cunningham-software.html");
  const { items } = collectCreativeWorks(
    [{ url: "https://cunningham.example/software/", html, lang: "en" }],
    { siteOrigin: "https://cunningham.example", observedAt: OBSERVED_AT },
  );

  assert.ok(items.length >= 1, `Expected ≥1 items, got ${items.length}`);
  assert.ok(
    items.some((item) => /presto|spec|diff/i.test(String(item.title))),
    "Expected at least one known software project item",
  );
});

// ─── All fixtures: same-origin check ─────────────────────────────────────────

test("all member fixtures: no item escapes to a foreign origin", () => {
  const cases = [
    {
      file: "beard-photos.html",
      url: "https://photos.example/gallery/",
      origin: "https://photos.example",
    },
    {
      file: "ghent-products.html",
      url: "https://ghent.example/projects/",
      origin: "https://ghent.example",
    },
    {
      file: "sherman-games.html",
      url: "https://games.example/games/",
      origin: "https://games.example",
    },
    {
      file: "seigler-tools.html",
      url: "https://seigler.example/software/",
      origin: "https://seigler.example",
    },
    {
      file: "morris-experiments.html",
      url: "https://morris.example/experiments/",
      origin: "https://morris.example",
    },
    {
      file: "muller-guides.html",
      url: "https://muller.example/guides/",
      origin: "https://muller.example",
    },
    {
      file: "cunningham-software.html",
      url: "https://cunningham.example/software/",
      origin: "https://cunningham.example",
    },
  ];

  for (const { file, url, origin } of cases) {
    const { items } = collectCreativeWorks(
      [{ url, html: fixture(file), lang: "en" }],
      { siteOrigin: origin, observedAt: OBSERVED_AT },
    );

    assert.ok(
      items.every((item) => String(item.url).startsWith(origin)),
      `${file}: item(s) escaped origin — ${items
        .filter((item) => !String(item.url).startsWith(origin))
        .map((item) => item.url)
        .join(", ")}`,
    );
  }
});

test("ghent homepage products shelf yields Repowarden and PlanPacer projects", () => {
  const html = fixture("ghent-home-products.html");
  const items = creativeItemsFromHomepageLinks(
    html,
    "https://joshghent.com/",
    "https://joshghent.com",
    OBSERVED_AT,
  );
  assert.ok(
    items.some((item) => item.title === "Repowarden"),
    "Repowarden should be extracted from Products shelf",
  );
  assert.ok(
    items.some((item) => item.title === "PlanPacer"),
    "PlanPacer should be extracted from Products shelf",
  );
  const repowarden = items.find((item) => item.title === "Repowarden");
  assert.equal(repowarden.image, "https://joshghent.com/img/repowarden.png");
  assert.match(String(repowarden.summary), /repository/i);
});
