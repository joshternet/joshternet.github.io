/**
 * Goal & Constraints:
 * Uses page Liquid — review sections are local-only; comparisons stay anonymous
 * counts while choice names still link to catalog project/manufacturer pages.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Reads a UTF-8 file relative to the repository root.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<string>} File contents.
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("uses page shows review sections only in development", async () => {
  const page = await read("uses.md");
  const css = await read("assets/css/main.css");

  assert.match(page, /permalink: \/uses\//);
  assert.match(
    page,
    /{% if jekyll\.environment == 'development' %}[\s\S]*class="uses-dev-review"[\s\S]*<h3>Unsorted<\/h3>[\s\S]*<h3>Setup details<\/h3>[\s\S]*<h3>Stated uses<\/h3>/,
    "Unsorted, Setup details, and Stated uses must render only in development",
  );
  const afterEnhance = page.slice(page.indexOf("data-uses-enhance"));
  assert.doesNotMatch(
    afterEnhance,
    /<h3>Unsorted<\/h3>|<h3>Setup details<\/h3>|<h3>Stated uses<\/h3>/,
    "Review headings must not appear outside the development review block",
  );
  assert.match(page, /Local review — not published/);
  assert.match(
    css,
    /\.uses-dev-review\s*\{[^}]*repeating-conic-gradient/s,
    "Development review block must use a checkered border",
  );
  for (const heading of ["Unsorted", "Setup details", "Stated uses"]) {
    assert.equal(
      (page.match(new RegExp(`<h3>${heading}</h3>`, "g")) || []).length,
      1,
      `${heading} must appear once, inside the development gate`,
    );
  }
});

test("uses comparable choices use kind bands and a mosaic card grid", async () => {
  const page = await read("uses.md");
  const card = await read("_includes/uses-slot-card.html");
  const css = await read("assets/css/main.css");

  assert.match(page, /class="uses-kind"/);
  assert.match(page, /class="uses-kind__title"/);
  assert.match(page, /data-uses-slots/);
  assert.match(page, /aria-label="Comparable choices"/);
  assert.doesNotMatch(page, /<h2[^>]*>Comparable choices<\/h2>/);
  assert.doesNotMatch(page, /Across the network/);
  assert.match(page, /{% include uses-slot-card\.html heading="h3" %}/);
  assert.match(page, /{% include uses-slot-card\.html heading="h2" %}/);
  assert.match(card, /class="uses-slot uses-card"/);
  assert.match(card, /class="uses-card__choices"/);
  assert.match(card, /class="uses-card__choice"/);
  assert.match(card, /uses-cov__track/);
  assert.match(
    card,
    /<svg[\s\S]*class="uses-cov__track"[\s\S]*<rect[\s\S]*class="uses-cov__fill"/,
  );
  assert.doesNotMatch(
    card,
    /style\s*=/,
    "Coverage bars must not use inline styles under style-src 'self'",
  );
  assert.doesNotMatch(card, /data-uses-slot-chart/);
  assert.doesNotMatch(card, /Compared across/);
  assert.doesNotMatch(card, /data-uses-span/);
  assert.match(page, /class="uses-footnote"/);
  assert.match(
    page,
    /Choice counts are compared across the sites that reported each category/,
  );
  assert.match(page, /Sites can report more than one\./);
  assert.match(
    css,
    /\.page--uses\s+\.prose\s*\{[^}]*max-width:\s*none/s,
    "Comparable choices must escape the reading-width column",
  );
  assert.match(css, /\.uses-kind__title\s*\{[^}]*column-span:\s*all/s);
  assert.match(css, /\.uses-kind\s*\{[^}]*column-width:\s*16rem/s);
  assert.match(css, /\.uses-slot\s*\{[^}]*break-inside:\s*avoid/s);
  assert.doesNotMatch(css, /data-uses-span="wide"/);
  assert.match(css, /\.uses-footnote\s*\{/);
});

test("uses page comparisons stay anonymous counts", async () => {
  const page = await read("uses.md");

  assert.match(
    page,
    /summary\.k7v[\s\S]*summary\.k1z/,
    "Coverage must show verified Uses sites out of eligible network sites",
  );
  assert.match(page, /eligible network sites have a verified/);
  assert.match(page, /uses-footnote/);
  assert.doesNotMatch(
    page,
    /Sources in this count/,
    "Public page must not list a per-member Uses ledger",
  );
  const slotsStart = page.indexOf("data-uses-slots");
  const unsorted = page.indexOf("<h3>Unsorted</h3>");
  const comparable = page.slice(slotsStart, unsorted);
  assert.doesNotMatch(
    comparable,
    /uses-evidence/,
    "Comparable cards must not expand per-member source lists",
  );
  const card = await read("_includes/uses-slot-card.html");
  assert.match(
    card,
    /{% if tool\.k7y and tool\.k7y != '' %}[\s\S]*?<a href="\{\{ tool\.k7y \| escape \}\}" target="_blank" rel="noopener"/,
    "Choice names must link via tool.k7y in the shared slot card",
  );
  assert.match(page, /include uses-slot-card\.html heading="h3"/);
  assert.match(page, /include uses-slot-card\.html heading="h2"/);
  const setup = page.slice(page.indexOf("<h3>Setup details</h3>"));
  assert.doesNotMatch(
    setup,
    /uses-evidence/,
    "Setup details must stay anonymous site counts",
  );
  assert.match(page, /item\.k8d/);
});
