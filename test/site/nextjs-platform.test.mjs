/**
 * Goal: Content contract for the Next.js platform recipe (guide text only—not a
 * Next.js binary build or live host deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/nextjs.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("nextjs platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/nextjs\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: Next\.js/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("nextjs platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("nextjs platform guide documents public file, export, and undeclared JSON", async () => {
  const page = await readPage();

  assert.match(page, /\{\s*"version": 1\s*\}/);
  assert.match(page, /public\/\n\s+\.well-known\/\n\s+josh/);
  assert.match(page, /out\/\n\s+\.well-known\/\n\s+josh/);
  assert.match(page, /test -f out\/\.well-known\/josh/);
  assert.match(page, /output:\s*["']export["']/);
  assert.match(page, /next export.+removed|removed.+next export/i);
  assert.doesNotMatch(page, /```sh\nnext export\n```/);
  assert.match(page, /npm run (?:dev|build|start)/);
  assert.match(page, /curl -i http:\/\/localhost:3000\/\.well-known\/josh/);
});

test("nextjs platform guide covers headers, hosts, basePath, and Proxy", async () => {
  const page = await readPage();

  assert.match(page, /source:\s*["']\/\.well-known\/josh["']/);
  assert.match(
    page,
    /unsupported.*static export|static export.*unsupported|does \*\*not\*\* apply|Headers.*unsupported|unsupported.*headers/i,
  );
  assert.match(page, /basePath/);
  assert.match(page, /trailingSlash/);
  assert.match(page, /\.well-known\//);
  assert.match(page, /Proxy|middleware/i);
  assert.match(page, /standalone/i);
  assert.match(page, /public\//);
  assert.match(page, /Vercel/);
  assert.match(page, /_headers/);
  assert.match(page, /\.nojekyll/);
  assert.match(page, /Route Handler/i);
});

test("nextjs platform guide keeps shared includes and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-10-06/);
  assert.match(page, /Next\.js 15 static export/);
  assert.match(page, /public\/` → `out\//);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.match(page, /not a live Next\.js\+host deployment/i);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
});
