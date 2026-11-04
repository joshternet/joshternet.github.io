/**
 * Goal: Content contract for the SvelteKit platform recipe (guide text only—not
 * a SvelteKit binary build or live host deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/sveltekit.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("sveltekit platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/sveltekit\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: SvelteKit/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("sveltekit platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("sveltekit platform guide documents static file, build, and undeclared JSON", async () => {
  const page = await readPage();

  assert.match(page, /\{\s*"version": 1\s*\}/);
  assert.match(page, /static\/\n\s+\.well-known\/\n\s+josh/);
  assert.match(page, /build\/\n\s+\.well-known\/\n\s+josh/);
  assert.match(page, /test -f build\/\.well-known\/josh/);
  assert.match(page, /adapter-static/);
  assert.match(page, /curl -i http:\/\/localhost:4173\/\.well-known\/josh/);
  assert.match(page, /npm run (?:build|preview)|vite (?:build|preview)/);
});

test("sveltekit platform guide covers SK2/SK3, adapters, and hosts", async () => {
  const page = await readPage();

  assert.match(page, /vite\.config\.js/);
  assert.match(page, /sveltekit\(\{\s*\n?\s*adapter:/);
  assert.match(page, /svelte\.config\.js/);
  assert.match(page, /prerender|200\.html|fallback/i);
  assert.match(
    page,
    /registered during the build|build-time asset registration|static assets are registered/i,
  );
  assert.match(page, /paths\.base/);
  assert.match(page, /_headers|\[\[headers\]\]/);
  assert.match(page, /\.nojekyll/);
  assert.match(page, /Netlify|Cloudflare|Vercel|GitHub Pages/);
});

test("sveltekit platform guide keeps shared includes and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-10-06/);
  assert.match(page, /SvelteKit 2/);
  assert.match(page, /@sveltejs\/adapter-static/);
  assert.match(page, /static\/` → `build\//);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.match(page, /not a live SvelteKit\+host deployment/i);
  assert.match(page, /not a claim that SvelteKit 3 was live-tested/i);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
});
