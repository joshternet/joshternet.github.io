/**
 * Goal: Appearance title hygiene rejects blog chrome and year crumbs.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  isEmptyAppearanceTitle,
  isYearCrumbConference,
  resolveEventTitle,
} from "../../scripts/nlp/appearance-title.mjs";

test("isEmptyAppearanceTitle rejects min-read and year crumbs", () => {
  assert.equal(isEmptyAppearanceTitle("2 min read"), true);
  assert.equal(isEmptyAppearanceTitle("4 minutes read"), true);
  assert.equal(isEmptyAppearanceTitle("Reading time: 5 min"), true);
  assert.equal(isEmptyAppearanceTitle(", 2026"), true);
  assert.equal(isEmptyAppearanceTitle("2026"), true);
  assert.equal(isEmptyAppearanceTitle(""), true);
  assert.equal(isEmptyAppearanceTitle("Front End Study Hall #061"), false);
});

test("isEmptyAppearanceTitle rejects leading year chrome and embedded min-read", () => {
  assert.equal(
    isEmptyAppearanceTitle(
      ", 2026 · 2 min read Enterprise sales teams, please, I beg you, stop",
    ),
    true,
  );
  assert.equal(
    isEmptyAppearanceTitle(
      ", 2026 · 4 min read Last week was terrible. It didn't have to be",
    ),
    true,
  );
  assert.equal(
    isEmptyAppearanceTitle("2 min read Enterprise sales teams, please stop"),
    true,
  );
  assert.equal(isEmptyAppearanceTitle("Boston Code Camp 40"), false);
  // ISO dates and real talk titles must not look like year-chrome zombies.
  assert.equal(isEmptyAppearanceTitle("2026-01-15"), false);
  assert.equal(
    isEmptyAppearanceTitle("2026-01-15 recording No Year Hint Talk"),
    false,
  );
  assert.equal(isEmptyAppearanceTitle("No Year Hint Talk"), false);
});

test("isYearCrumbConference matches comma-year labels", () => {
  assert.equal(isYearCrumbConference(", 2026"), true);
  assert.equal(isYearCrumbConference("2025"), true);
  assert.equal(isYearCrumbConference(""), true);
  assert.equal(isYearCrumbConference("DevReach 2023"), false);
});

test("resolveEventTitle prefers talk title over year-crumb conference", () => {
  assert.equal(
    resolveEventTitle(", 2026", "Front End Study Hall #061"),
    "Front End Study Hall #061",
  );
  assert.equal(
    resolveEventTitle("DevReach 2023", "Some Talk"),
    "DevReach 2023",
  );
  assert.equal(resolveEventTitle("2 min read", "2 min read"), "");
  assert.equal(
    resolveEventTitle(
      ", 2026 · 2 min read Enterprise sales teams",
      "Real Talk Title",
    ),
    "Real Talk Title",
  );
  assert.equal(resolveEventTitle("", ""), "");
});
