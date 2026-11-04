/**
 * Goal: Content contract for the WordPress platform recipe (guide text only—not
 * a WordPress install or live host deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/wordpress.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("wordpress platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/wordpress\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: WordPress/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("wordpress platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("wordpress platform guide documents plugin directory and undeclared JSON", async () => {
  const page = await readPage();

  assert.match(page, /\{\s*"version": 1\s*\}/);
  assert.match(page, /https:\/\/wordpress\.org\/plugins\/joshternet\//);
  assert.match(page, /https:\/\/github\.com\/joshternet\/wordpress/);
  assert.match(page, /Releases are published on WordPress\.org/);
  assert.match(page, /It is not the release channel/);
  assert.doesNotMatch(page, /until the plugin is listed/);
  assert.doesNotMatch(page, /After directory acceptance/);
  assert.match(
    page,
    /Settings → Joshternet|Settings &rarr; Joshternet|\*\*Settings → Joshternet\*\*/,
  );
  assert.match(
    page,
    /does not create a physical|\.well-known` file on disk|no physical/i,
  );
});

test("wordpress platform guide covers participation, Multisite, and button", async () => {
  const page = await readPage();

  assert.match(
    page,
    /disabled by default|defaults to \*\*disabled\*\*|Participation is disabled/i,
  );
  assert.match(page, /joshternet_enabled|Publish the Joshternet declaration/);
  assert.match(page, /path-based|Multisite/i);
  assert.match(page, /\[joshternet_button\]/);
  assert.match(page, /joshternet\.org\/api\/button-state/);
  assert.match(page, /6 hours|15 minutes/);
  assert.match(
    page,
    /does not claim|not claimed tested|does not claim those environments/i,
  );
  assert.match(page, /curl -i https:\/\/joshua\.example\/\.well-known\/josh/);
});

test("wordpress platform guide keeps shared includes and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-10-06/);
  assert.match(page, /Joshternet plugin 0\.1\.1/);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.match(page, /not a live WordPress\.com|managed-host deploy/i);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
});
