/**
 * Goal: Uses page Liquid — Unsorted is local-only; comparisons stay anonymous.
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

test("uses page shows Unsorted only in development", async () => {
  const page = await read("uses.md");

  assert.match(page, /permalink: \/uses\//);
  assert.match(
    page,
    /{% if jekyll\.environment == 'development' %}\s*{% if summary\.k7n and summary\.k7n\.size > 0 %}\s*<h3>Unsorted<\/h3>[\s\S]*?{% endif %}\s*{% endif %}/,
    "Unsorted must render only when JEKYLL_ENV is development",
  );
  assert.equal(
    (page.match(/<h3>Unsorted<\/h3>/g) || []).length,
    1,
    "Unsorted must appear once, inside the development gate",
  );
});

test("uses page comparisons stay anonymous counts", async () => {
  const page = await read("uses.md");

  assert.match(
    page,
    /summary\.k7v[\s\S]*summary\.k1z/,
    "Coverage must show verified Uses sites out of eligible network sites",
  );
  assert.match(page, /eligible network sites have a verified/);
  assert.doesNotMatch(
    page,
    /Sources in this count/,
    "Public page must not list a per-member Uses ledger",
  );
  const comparable = page.slice(
    page.indexOf("Comparable choices"),
    page.indexOf("<h3>Unsorted</h3>"),
  );
  assert.doesNotMatch(
    comparable,
    /uses-evidence/,
    "Comparable tables must not expand per-member source lists",
  );
  const setup = page.slice(page.indexOf("<h3>Setup details</h3>"));
  assert.doesNotMatch(
    setup,
    /uses-evidence/,
    "Setup details must stay anonymous site counts",
  );
  assert.match(page, /item\.k8d/);
});
