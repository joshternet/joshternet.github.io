import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Reads a UTF-8 file relative to the repository root.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<string>} File contents.
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

/**
 * Asserts that a source path under the repo root exists.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<void>}
 */
async function assertExists(relativePath) {
  await access(path.join(root, relativePath));
}

test("content support matrix covers handbook chapters and extractor sources", async () => {
  const matrix = JSON.parse(await read("_data/content_support_matrix.json"));
  const nav = await read("_data/content_nav.yml");

  assert.equal(typeof matrix.verified_date, "string");
  assert.match(matrix.user_agent, /Joshternet-Joshbot/);
  assert.equal(matrix.product_token, "Joshternet-Joshbot");
  assert.ok(Array.isArray(matrix.entries));
  assert.ok(matrix.entries.length >= 18);

  const chapterIds = [
    "html",
    "seo",
    "slashpages",
    "opml",
    "microformats2",
    "open-graph",
    "schema-org",
    "feeds",
    "sitemaps",
    "robots",
    "links",
    "identity",
    "connections",
    "media",
    "events",
    "uses",
    "explore",
    "validation",
    "reference",
  ];

  for (const id of chapterIds) {
    assert.match(nav, new RegExp(`id: ${id}\\b`));
    assert.match(nav, new RegExp(`path: /implement/content/${id}/`));
    const entry = matrix.entries.find((row) => row.id === id);
    assert.ok(entry, `matrix must include chapter id ${id}`);
    assert.equal(entry.chapter_path, `/implement/content/${id}/`);
    assert.match(
      entry.status,
      /^(implemented|partial|not_implemented|under_consideration)$/,
    );
    for (const source of entry.source_files || []) {
      await assertExists(source);
    }

    const chapterPath = `implement/content/${id}.md`;
    const chapter = await read(chapterPath);
    assert.match(chapter, /permalink: \/implement\/content\//);
    assert.match(chapter, new RegExp(`content_id: ${id}\\b`));
    assert.match(chapter, new RegExp(`matrix_id: ${id}\\b`));
  }

  const forbiddenImplemented = [
    "webmention",
    "websub",
    "micropub",
    "indieauth",
    "activitypub",
  ];
  for (const id of forbiddenImplemented) {
    const entry = matrix.entries.find((row) => row.id === id);
    if (!entry) continue;
    assert.notEqual(
      entry.status,
      "implemented",
      `${id} must not claim implemented status`,
    );
  }

  const creative = await read("scripts/nlp/creative.mjs");
  assert.match(creative, /CREATIVE_SCHEMA_TYPES/);
  assert.match(creative, /Photograph/);

  const subjects = await read("scripts/nlp/subjects.mjs");
  assert.match(subjects, /p-category/);

  const text = await read("scripts/nlp/text.mjs");
  assert.match(text, /og:image/);

  const crawlerLib = await read("scripts/nlp/lib.mjs");
  assert.match(crawlerLib, /Joshternet-Joshbot/);
  const robots = await read("scripts/nlp/robots.mjs");
  assert.doesNotMatch(robots, /Crawl-delay/i);

  const openGraph = matrix.entries.find((row) => row.id === "open-graph");
  assert.ok(openGraph.properties_consumed.includes("og:image"));

  const mf2 = matrix.entries.find((row) => row.id === "microformats2");
  assert.ok(mf2.properties_consumed.includes("p-category"));
  assert.equal(mf2.status, "partial");

  const uses = matrix.entries.find((row) => row.id === "uses");
  assert.equal(uses.status, "partial");
});
