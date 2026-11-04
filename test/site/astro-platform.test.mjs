/**
 * Goal: Content contract for the Astro platform recipe (guide text only—not an
 * Astro binary build or live host deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/astro.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("astro platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/astro\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: Astro/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("astro platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("astro platform guide documents public copy, build, and preview", async () => {
  const page = await readPage();

  assert.match(page, /public\/\.well-known\/josh/);
  assert.match(page, /dist\/\.well-known\/josh/);
  assert.match(page, /npm run build/);
  assert.match(page, /npm run preview/);
  assert.match(page, /curl -i http:\/\/localhost:4321\/\.well-known\/josh/);
  assert.match(page, /test -f dist\/\.well-known\/josh/);
  assert.match(page, /publicDir/);
  assert.match(page, /outDir/);
});

test("astro platform guide corrects base-path and hosting Content-Type guidance", async () => {
  const page = await readPage();

  assert.match(page, /\bbase\b/);
  assert.match(page, /\/blog\/\.well-known\/josh/);
  assert.doesNotMatch(page, /base`? option does not move the well-known URI/i);
  assert.match(page, /Content-Type: application\/json/);
  assert.match(page, /public\/_headers/);
  assert.match(page, /Cloudflare Pages/);
  assert.match(page, /Netlify/);
  assert.match(page, /GitHub Pages/);
  assert.match(
    page,
    /does \*\*not\*\* provide ordinary per-file custom Content-Type|does not provide ordinary per-file custom Content-Type/i,
  );
});

test("astro platform guide keeps shared includes, stop publishing, and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-10-06/);
  assert.match(page, /Astro 5\.x/);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.match(page, /not a live Astro\+host deployment/i);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
});

test("astro platform guide links authoritative Astro and protocol docs", async () => {
  const page = await readPage();

  assert.match(page, /docs\.astro\.build\/en\/basics\/project-structure\//);
  assert.match(
    page,
    /docs\.astro\.build\/en\/reference\/configuration-reference\//,
  );
  assert.match(page, /docs\.astro\.build\/en\/develop-and-build\//);
  assert.match(page, /docs\.astro\.build\/en\/guides\/on-demand-rendering\//);
  assert.match(
    page,
    /github\.com\/joshternet\/spec\/blob\/main\/rfcs\/0002-well-known-josh\.md/,
  );
  assert.match(page, /\/implement\/validate\//);
  assert.match(page, /\/implement\/platforms\//);
});
