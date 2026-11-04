/**
 * Goal: Content contract for the Eleventy platform recipe (guide text only—not
 * an Eleventy binary build or live host deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/eleventy.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("eleventy platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/eleventy\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: Eleventy/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("eleventy platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("eleventy platform guide documents passthrough mapping, build, and serve", async () => {
  const page = await readPage();

  assert.match(
    page,
    /addPassthroughCopy\(\{\s*"input\/josh\.json": "\.well-known\/josh",\s*\}\)/,
  );
  assert.match(page, /export default function \(eleventyConfig\)/);
  assert.match(page, /module\.exports = function \(eleventyConfig\)/);
  assert.match(page, /npm run build/);
  assert.match(page, /npx @11ty\/eleventy/);
  assert.match(page, /npx @11ty\/eleventy --serve/);
  assert.match(page, /curl -i http:\/\/localhost:8080\/\.well-known\/josh/);
  assert.match(page, /test -f _site\/\.well-known\/josh/);
  assert.match(page, /setServerPassthroughCopyBehavior\("passthrough"\)/);
  assert.match(
    page,
    /default server behavior is `"copy"`|The default server behavior is `"copy"`/,
  );
});

test("eleventy platform guide covers hosts without artifact upload workflows", async () => {
  const page = await readPage();

  assert.match(page, /\[\[headers\]\]/);
  assert.match(page, /Content-Type = "application\/json"/);
  assert.match(page, /Cloudflare Pages/);
  assert.match(page, /\.nojekyll/);
  assert.match(page, /pathPrefix/);
  assert.doesNotMatch(page, /upload-pages-artifact/);
  assert.doesNotMatch(page, /include-hidden-files/);
});

test("eleventy platform guide keeps shared includes and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-10-06/);
  assert.match(page, /addPassthroughCopy/);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.match(page, /not a live Eleventy\+host deployment/i);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
});

test("eleventy platform guide links authoritative Eleventy and protocol docs", async () => {
  const page = await readPage();

  assert.match(page, /11ty\.dev\/docs\/copy\//);
  assert.match(page, /11ty\.dev\/docs\/config\//);
  assert.match(page, /11ty\.dev\/docs\/dev-server\//);
  assert.match(
    page,
    /github\.com\/joshternet\/spec\/blob\/main\/rfcs\/0002-well-known-josh\.md/,
  );
  assert.match(page, /\/implement\/validate\//);
  assert.match(page, /\/implement\/platforms\//);
});
