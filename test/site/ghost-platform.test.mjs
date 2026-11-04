/**
 * Goal: Content contract for the Ghost platform recipe (guide text only—not a
 * live Ghost+Nginx or Ghost(Pro) deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/ghost.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("ghost platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/ghost\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: Ghost/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("ghost platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("ghost platform guide documents undeclared-first exact Nginx location", async () => {
  const page = await readPage();

  assert.match(
    page,
    /location = \/\.well-known\/josh \{\s*default_type application\/json;\s*return 200 '{"version":1}';\s*\}/,
  );
  assert.match(page, /sudo nginx -t/);
  assert.match(page, /systemctl reload nginx/);
  assert.match(page, /curl -i --resolve joshua\.example:443:127\.0\.0\.1/);
  assert.match(page, /'\{"version":1,"josh":true\}'/);
  assert.match(page, /'\{"version":1,"josh":false\}'/);
});

test("ghost platform guide rejects theme and routes.yaml as the protocol solution", async () => {
  const page = await readPage();

  assert.match(page, /Why not put this in a Ghost theme/);
  assert.match(page, /Why not use routes\.yaml/);
  assert.match(page, /trailing slash/);
  assert.doesNotMatch(page, /upload a JSON file as a theme asset and claim/i);
});

test("ghost platform guide qualifies Ghost(Pro) and keeps official Ghost links", async () => {
  const page = await readPage();

  assert.match(page, /Ghost\(Pro\)/);
  assert.match(page, /No generally verified direct publishing recipe/);
  assert.match(page, /Ghost\(Pro\) is not claimed tested/i);
  assert.match(
    page,
    /https:\/\/ghost\.org\/docs\/faq\/proxying-https-infinite-loops\//,
  );
  assert.match(page, /https:\/\/docs\.ghost\.org\/themes\/routing/);
  assert.match(
    page,
    /https:\/\/ghost\.org\/help\/run-ghost-from-a-subdirectory\//,
  );
  assert.doesNotMatch(page, /upload-pages-artifact/);
});

test("ghost platform guide keeps shared includes and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-10-06/);
  assert.match(page, /location = \/\.well-known\/josh/);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
});
