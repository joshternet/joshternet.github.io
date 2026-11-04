/**
 * Goal: Content contract for the Hugo platform recipe (guide text only—not a
 * Hugo binary build or live host deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/hugo.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("hugo platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/hugo\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: Hugo/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("hugo platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("hugo platform guide documents static copy, custom dirs, and mounts", async () => {
  const page = await readPage();

  assert.match(page, /static\/\n\s+\.well-known\/\n\s+josh/);
  assert.match(page, /public\/\n\s+\.well-known\/\n\s+josh/);
  assert.match(page, /test -f public\/\.well-known\/josh/);
  assert.match(page, /staticDir = "site-static"/);
  assert.match(page, /publishDir = "dist"/);
  assert.match(page, /source = "static"/);
  assert.match(
    page,
    /removes that component's default mount|removes that component’s default mount/,
  );
  assert.match(page, /\{\s*"version": 1\s*\}/);
});

test("hugo platform guide covers hosts, stale output, and branch publishing", async () => {
  const page = await readPage();

  assert.match(page, /static\/_headers/);
  assert.match(
    page,
    /\[\[headers\]\]\s*for = "\/\.well-known\/josh"[\s\S]*Content-Type = "application\/json"/,
  );
  assert.match(page, /include-hidden-files: true/);
  assert.match(page, /\.nojekyll/);
  assert.match(page, /cleanDestinationDir|--cleanDestinationDir/);
  assert.match(
    page,
    /leave an old published file behind|A removed source file can leave/,
  );
  assert.match(page, /hugo server/);
  assert.match(page, /curl -i http:\/\/localhost:1313\/\.well-known\/josh/);
});

test("hugo platform guide keeps shared includes and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-10-06/);
  assert.match(page, /static\/` → `public\//);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.match(page, /not a live Hugo\+host deployment/i);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
});
