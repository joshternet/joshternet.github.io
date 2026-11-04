/**
 * Goal: Content contract for the Jekyll platform recipe (guide text only—not a
 * Jekyll binary build or live host deploy).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const pagePath = path.join(root, "implement/platforms/jekyll.md");

/**
 * @returns {Promise<string>}
 */
async function readPage() {
  return readFile(pagePath, "utf8");
}

test("jekyll platform guide keeps canonical permalink and TechArticle SEO", async () => {
  const page = await readPage();

  assert.match(page, /permalink: \/implement\/platforms\/jekyll\//);
  assert.match(page, /seo:\s*\n\s*type: TechArticle/);
  assert.match(page, /nav_title: Jekyll/);
  assert.match(page, /\[implement\]: \/implement\//);
});

test("jekyll platform guide uses joshua.example and avoids banned fiction hosts", async () => {
  const page = await readPage();

  assert.match(page, /https:\/\/joshua\.example\/\.well-known\/josh/);
  assert.doesNotMatch(page, /example\.invalid/);
  assert.doesNotMatch(page, /harbor\.example/);
  assert.doesNotMatch(page, /joshuamorris\.info/);
});

test("jekyll platform guide documents undeclared JSON and no front matter", async () => {
  const page = await readPage();

  assert.match(page, /\{\s*"version": 1\s*\}/);
  assert.match(
    page,
    /Do not add YAML front matter|no YAML front matter|without front matter/i,
  );
  assert.match(page, /\.well-known\/\n\s+josh/);
  assert.match(page, /include:\n\s+- \.well-known/);
  assert.match(page, /test -f _site\/\.well-known\/josh/);
  assert.match(
    page,
    /Including `\.well-known` in Jekyll and preserving `\.well-known` in a later deploy/,
  );
  assert.match(page, /replaces|Preserve existing include/i);
});

test("jekyll platform guide covers hosts, packaging, and baseurl", async () => {
  const page = await readPage();

  assert.match(
    page,
    /\[\[headers\]\]\s*for = "\/\.well-known\/josh"[\s\S]*Content-Type = "application\/json"/,
  );
  assert.match(page, /_headers/);
  assert.match(page, /include:\n\s+- \.well-known\n\s+- _headers/);
  assert.match(page, /include-hidden-files: true/);
  assert.match(page, /\.nojekyll/);
  assert.match(
    page,
    /Do \*\*not\*\* add `\.nojekyll`|not add `\.nojekyll` merely|only for prebuilt|Prebuilt output/i,
  );
  assert.match(page, /baseurl/);
  assert.match(page, /bundle exec jekyll (?:build|serve)/);
  assert.match(page, /curl -i http:\/\/localhost:4000\/\.well-known\/josh/);
  assert.match(page, /github-pages/);
});

test("jekyll platform guide keeps shared includes and tested claim", async () => {
  const page = await readPage();

  assert.match(page, /declaration-identity-ref\.html/);
  assert.match(page, /declaration-origin-root-note\.html/);
  assert.match(page, /declaration-verify-ref\.html/);
  assert.match(page, /declaration-stop-publishing\.html/);
  assert.match(page, /stop_steps/);
  assert.match(page, /## Tested/);
  assert.match(page, /Verified: 2026-10-06/);
  assert.match(page, /Jekyll static `\.well-known\/josh` with `include`/);
  assert.match(page, /RFC-JOSH-0002 version 1/);
  assert.match(page, /not every host MIME|not a live GitHub Pages MIME/i);
  assert.doesNotMatch(page, /JoshBot (?:support|implementation-status)/i);
  assert.doesNotMatch(page, /This page explains/);
  assert.doesNotMatch(page, /The public resource is exactly/);
  assert.doesNotMatch(page, /joshternet\.org does it that way/);
});
