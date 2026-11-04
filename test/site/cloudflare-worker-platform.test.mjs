/**
 * Goal: Content contract for the Cloudflare Worker platform recipe (guide text
 * only—not a live Cloudflare account deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/cloudflare-worker.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("cloudflare-worker platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/cloudflare-worker\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: Cloudflare Worker/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("cloudflare-worker platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("cloudflare-worker platform guide documents Route deployment and identity", async () => {
  const page = await readPage();

  assert.match(page, /\{\s*"version": 1\s*\}/);
  assert.match(page, /### Affirmed/);
  assert.match(page, /### Declined/);
  assert.match(page, /JOSH_IDENTITY/);
  assert.match(page, /snippets\/cloudflare-worker\.js/);
  assert.match(page, /Worker Route/);
  assert.match(page, /workers\.dev/);
  assert.match(page, /wrangler\.toml|Wrangler/);
  assert.match(page, /curl -i https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.match(
    page,
    /does not invalidate otherwise valid declaration JSON under RFC-JOSH-0002/,
  );
});

test("cloudflare-worker platform guide keeps shared includes and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-11-03/);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.match(page, /not a live Cloudflare account deployment/i);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
});

test("cloudflare-worker platform guide links authoritative Cloudflare and protocol docs", async () => {
  const page = await readPage();

  assert.match(
    page,
    /https:\/\/developers\.cloudflare\.com\/workers\/configuration\/routing\//,
  );
  assert.match(
    page,
    /https:\/\/github\.com\/joshternet\/spec\/blob\/main\/rfcs\/0002-well-known-josh\.md/,
  );
  assert.match(
    page,
    /https:\/\/github\.com\/joshternet\/spec\/blob\/main\/rfcs\/0001-josh-identity\.md/,
  );
});
