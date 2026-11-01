/**
 * Goal & Constraints:
 * Verify creative-work extraction for the Joshua Kim Studio fixture set.
 * - collectCreativeWorks must find all 8 distinct works.
 * - Hot Chocolate must NOT be classified as an upcoming event; it is a project.
 * - Homepage link extraction (creativeItemsFromHomepageLinks) must surface the
 *   6 root project paths linked from the home page.
 * - Schema types added in Phase 1 (MobileApplication, VideoGame, ItemList) must
 *   resolve to recognised content_type values.
 * - categories[] and availability are optional enrichments; when present they
 *   must be arrays/strings respectively.
 *
 * Target files: scripts/nlp/creative.mjs
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
} from "../../scripts/nlp/creative.mjs";

const fixtureDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/creative/joshuakim-studio",
);

/**
 * @param {string} name
 * @returns {string}
 */
function fixture(name) {
  return fs.readFileSync(path.join(fixtureDir, name), "utf8");
}

const ORIGIN = "https://joshuakim.studio";
const OBSERVED_AT = "2026-10-31T00:00:00Z";

/** Fixture pages used in multi-page tests. */
const PAGES = [
  { url: `${ORIGIN}/`, html: fixture("home.html"), lang: "en" },
  { url: `${ORIGIN}/projects`, html: fixture("projects.html"), lang: "en" },
];

// ─── 8-work coverage ─────────────────────────────────────────────────────────

test("collectCreativeWorks: finds all 8 distinct Joshua Kim works", () => {
  const { items } = collectCreativeWorks(PAGES, {
    siteOrigin: ORIGIN,
    observedAt: OBSERVED_AT,
  });

  const urls = items.map((item) => String(item.url));
  const EXPECTED_PATHS = [
    "/somaspace",
    "/prism-catch",
    "/chewchat",
    "/kindbite",
    "/vap",
    "/graphic-design",
    "/order-pipeline-toolkit",
    "/hot-chocolate",
  ];

  for (const expectedPath of EXPECTED_PATHS) {
    assert.ok(
      urls.some((url) => url.includes(expectedPath)),
      `Expected an item with path containing "${expectedPath}" — got: ${urls.join(", ")}`,
    );
  }

  // Deduplicated: at most one item per URL.
  const uniqueUrls = new Set(urls);
  assert.equal(
    uniqueUrls.size,
    urls.length,
    "Duplicate URLs detected in output",
  );

  // At least 8 works total.
  assert.ok(items.length >= 8, `Expected ≥8 items, got ${items.length}`);
});

// ─── Hot Chocolate: not an event ──────────────────────────────────────────────

test("collectCreativeWorks: Hot Chocolate is a project, not an upcoming event", () => {
  const { items } = collectCreativeWorks(PAGES, {
    siteOrigin: ORIGIN,
    observedAt: OBSERVED_AT,
  });

  const hotChocolate = items.find((item) =>
    String(item.url).includes("/hot-chocolate"),
  );
  assert.ok(hotChocolate, "Hot Chocolate item should be found");

  // Must not be classified as an event content_type.
  assert.ok(
    hotChocolate.content_type !== "event",
    `Hot Chocolate content_type must not be "event"; got "${hotChocolate.content_type}"`,
  );

  // Must not be classified as an upcoming event.
  assert.ok(
    hotChocolate.content_type !== "upcoming_event",
    `Hot Chocolate must not be an upcoming_event`,
  );

  // Should be classified as a project or game (SoftwareApplication).
  const VALID_TYPES = ["project", "game"];
  assert.ok(
    VALID_TYPES.includes(String(hotChocolate.content_type)),
    `Hot Chocolate content_type should be one of ${VALID_TYPES.join("|")}, got "${hotChocolate.content_type}"`,
  );
});

// ─── Homepage link extraction ─────────────────────────────────────────────────

test("creativeItemsFromHomepageLinks: extracts 6 project links from home page", () => {
  const html = fixture("home.html");
  const items = creativeItemsFromHomepageLinks(
    html,
    `${ORIGIN}/`,
    ORIGIN,
    OBSERVED_AT,
  );

  const urls = items.map((item) => String(item.url));
  const EXPECTED = [
    "/somaspace",
    "/prism-catch",
    "/chewchat",
    "/kindbite",
    "/vap",
    "/graphic-design",
  ];

  for (const expectedPath of EXPECTED) {
    assert.ok(
      urls.some((url) => url.includes(expectedPath)),
      `Expected homepage link item for "${expectedPath}"`,
    );
  }

  // Should not include navigation-only paths.
  assert.ok(
    !urls.some((url) => url.endsWith("/about") || url.endsWith("/contact")),
    "about and contact should be excluded as non-project paths",
  );

  assert.ok(items.length >= 6, `Expected ≥6 items, got ${items.length}`);
});

test("creativeItemsFromHomepageLinks: returns empty for non-root paths", () => {
  const html = fixture("home.html");
  const items = creativeItemsFromHomepageLinks(
    html,
    `${ORIGIN}/projects`,
    ORIGIN,
    OBSERVED_AT,
  );
  assert.equal(items.length, 0, "Should return empty for non-root URL");
});

test("creativeItemsFromHomepageLinks: all items have homepage creative source kinds", () => {
  const html = fixture("home.html");
  const items = creativeItemsFromHomepageLinks(
    html,
    `${ORIGIN}/`,
    ORIGIN,
    OBSERVED_AT,
  );

  assert.ok(items.length > 0, "Expected at least one homepage item");
  assert.ok(
    items.every(
      (item) =>
        item.source?.kind === "creative-homepage" ||
        item.source?.kind === "creative-homepage-shelf",
    ),
    "All items should have a creative-homepage source kind",
  );
});

// ─── Schema type resolution ───────────────────────────────────────────────────

test("collectCreativeWorks: MobileApplication (SomaSpace) resolves to game content_type", () => {
  const { items } = collectCreativeWorks(
    [{ url: `${ORIGIN}/projects`, html: fixture("projects.html"), lang: "en" }],
    { siteOrigin: ORIGIN, observedAt: OBSERVED_AT },
  );

  const somaSpace = items.find((item) =>
    String(item.url).includes("/somaspace"),
  );
  assert.ok(somaSpace, "SomaSpace item should be found");
  // MobileApplication maps to "game" via creativeContentType
  assert.equal(somaSpace.content_type, "game");
});

test("collectCreativeWorks: VideoGame (Prism Catch) resolves to game content_type", () => {
  const { items } = collectCreativeWorks(
    [{ url: `${ORIGIN}/projects`, html: fixture("projects.html"), lang: "en" }],
    { siteOrigin: ORIGIN, observedAt: OBSERVED_AT },
  );

  const prismCatch = items.find((item) =>
    String(item.url).includes("/prism-catch"),
  );
  assert.ok(prismCatch, "Prism Catch item should be found");
  assert.equal(prismCatch.content_type, "game");
});

test("collectCreativeWorks: ItemList (Graphic Design) resolves to collection content_type", () => {
  const { items } = collectCreativeWorks(
    [{ url: `${ORIGIN}/projects`, html: fixture("projects.html"), lang: "en" }],
    { siteOrigin: ORIGIN, observedAt: OBSERVED_AT },
  );

  const graphicDesign = items.find((item) =>
    String(item.url).includes("/graphic-design"),
  );
  assert.ok(graphicDesign, "Graphic Design item should be found");
  assert.equal(graphicDesign.content_type, "collection");
});

// ─── Optional categories enrichment ──────────────────────────────────────────

test("collectCreativeWorks: items with applicationCategory have categories array", () => {
  const { items } = collectCreativeWorks(
    [{ url: `${ORIGIN}/projects`, html: fixture("projects.html"), lang: "en" }],
    { siteOrigin: ORIGIN, observedAt: OBSERVED_AT },
  );

  // SomaSpace has applicationCategory: "HealthApplication"
  const somaSpace = items.find((item) =>
    String(item.url).includes("/somaspace"),
  );
  assert.ok(somaSpace, "SomaSpace item should be found");
  assert.ok(
    Array.isArray(somaSpace.categories),
    "categories should be an array when applicationCategory is present",
  );
  assert.ok(
    somaSpace.categories.length > 0,
    "categories should be non-empty for SomaSpace",
  );
  assert.ok(
    somaSpace.categories.some((cat) => /health/i.test(String(cat))),
    `Expected 'health' category, got: ${JSON.stringify(somaSpace.categories)}`,
  );
});

test("collectCreativeWorks: items without applicationCategory omit categories", () => {
  const { items } = collectCreativeWorks(
    [{ url: `${ORIGIN}/projects`, html: fixture("projects.html"), lang: "en" }],
    { siteOrigin: ORIGIN, observedAt: OBSERVED_AT },
  );

  // Prism Catch (VideoGame) has no applicationCategory in the fixture
  const prismCatch = items.find((item) =>
    String(item.url).includes("/prism-catch"),
  );
  assert.ok(prismCatch, "Prism Catch item should be found");
  // categories should be absent or empty
  assert.ok(
    !prismCatch.categories || prismCatch.categories.length === 0,
    "items without applicationCategory should not have categories",
  );
});

// ─── All 8 works are same-origin ──────────────────────────────────────────────

test("collectCreativeWorks: all Kim works have joshuakim.studio origin", () => {
  const { items } = collectCreativeWorks(PAGES, {
    siteOrigin: ORIGIN,
    observedAt: OBSERVED_AT,
  });

  assert.ok(items.length > 0, "Expected items to be found");
  assert.ok(
    items.every((item) =>
      String(item.url).startsWith("https://joshuakim.studio"),
    ),
    "Every item URL must be on joshuakim.studio",
  );
  assert.ok(
    items.every((item) => item.site_origin === ORIGIN),
    "Every item site_origin must equal the siteOrigin",
  );
});
