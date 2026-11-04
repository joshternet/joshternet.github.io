/**
 * Goal: Content contract for the Quartz platform recipe (guide text only—not a
 * Quartz binary build or live host deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/quartz.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("quartz platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/quartz\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: Quartz/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("quartz platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("quartz platform guide documents post-build copy and undeclared JSON", async () => {
  const page = await readPage();

  assert.match(page, /\{\s*"version": 1\s*\}/);
  assert.match(page, /mkdir -p public\/\.well-known/);
  assert.match(page, /cp josh\.json public\/\.well-known\/josh/);
  assert.match(page, /test -f public\/\.well-known\/josh/);
  assert.match(page, /Quartz copies `quartz\/static` to `public\/static`/);
  assert.doesNotMatch(
    page,
    /quartz\/static\/\.well-known\/josh` is the deployed resource/,
  );
  assert.match(page, /npx quartz build/);
  assert.match(page, /curl -i http:\/\/localhost:8080\/\.well-known\/josh/);
});

test("quartz platform guide covers hosts, packaging, and baseUrl", async () => {
  const page = await readPage();

  assert.match(
    page,
    /\[\[headers\]\]\s*for = "\/\.well-known\/josh"[\s\S]*Content-Type = "application\/json"/,
  );
  assert.match(page, /josh-cloudflare-headers/);
  assert.match(page, /cp josh-cloudflare-headers public\/_headers/);
  assert.match(page, /location = \/\.well-known\/josh/);
  assert.match(page, /include-hidden-files: true/);
  assert.match(page, /baseUrl/);
  assert.match(page, /nginx -t/);
});

test("quartz platform guide keeps shared includes and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-10-10/);
  assert.match(page, /Quartz 5\.0\.0/);
  assert.match(page, /josh\.json` → `public\/\.well-known\/josh/);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.match(page, /not a live Quartz\+host deployment/i);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
});
