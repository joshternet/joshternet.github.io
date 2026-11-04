/**
 * Goal: Content contract for the Nuxt platform recipe (guide text only—not a
 * Nuxt binary build or live host deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/nuxt.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("nuxt platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/nuxt\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: Nuxt/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("nuxt platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("nuxt platform guide documents public file, generate, and undeclared JSON", async () => {
  const page = await readPage();

  assert.match(page, /\{\s*"version": 1\s*\}/);
  assert.match(page, /public\/\n\s+\.well-known\/\n\s+josh/);
  assert.match(page, /\.output\/public\/\n\s+\.well-known\/\n\s+josh/);
  assert.match(page, /test -f \.output\/public\/\.well-known\/josh/);
  assert.match(page, /nuxt generate/);
  assert.match(page, /curl -i http:\/\/localhost:3000\/\.well-known\/josh/);
  assert.doesNotMatch(page, /## .+Nuxt 2|primary recipe.*`static\/`/);
});

test("nuxt platform guide covers Nitro, routeRules, hosts, and baseURL", async () => {
  const page = await readPage();

  assert.match(page, /routeRules/);
  assert.match(page, /"\/\.well-known\/josh"/);
  assert.match(page, /Content-Type/);
  assert.match(page, /noPublicDir/);
  assert.match(page, /app\.baseURL/);
  assert.match(page, /200\.html|404\.html|fallback HTML|SPA fallback/i);
  assert.match(page, /Nitro/);
  assert.match(page, /_headers/);
  assert.match(page, /\.nojekyll/);
  assert.match(page, /Netlify|Cloudflare|Vercel|GitHub Pages/);
});

test("nuxt platform guide keeps shared includes and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-10-06/);
  assert.match(page, /Nuxt 4\.x/);
  assert.match(page, /public\/` → `\.output\/public\//);
  assert.match(page, /nuxt generate/);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.match(page, /not a live Nuxt\+host deployment/i);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
});
