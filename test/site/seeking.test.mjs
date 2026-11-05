/**
 * Goal: Seeking page structure, data hooks, and publish-gate retention—not
 * visitor marketing copy.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("seeking page keeps filters, status shells, and data hooks", async () => {
  const page = await read("seeking.md");
  const card = await read("_includes/seeking-card.html");
  const script = await read("assets/js/seeking.js");
  const css = await read("assets/css/main.css");

  assert.match(page, /permalink: \/seeking\//);
  assert.match(page, /nav_title: Seeking/);
  assert.match(page, /joshternet_analysis: derived/);
  assert.match(page, /script: \/assets\/js\/seeking\.js/);
  assert.match(page, /site\.data\.seeking/);
  assert.match(page, /data-seeking\b/);
  assert.match(page, /data-seeking-status=/);
  assert.match(page, /data-seeking-status-message/);
  assert.match(page, /data-seeking-filters/);
  assert.match(page, /data-seeking-filter=/);
  assert.match(page, /data-seeking-clear/);
  assert.match(page, /data-seeking-counts/);
  assert.match(page, /seeking_status == 'unavailable'/);
  assert.match(page, /seeking_status == 'ok'/);
  assert.match(page, /\/network\//);
  assert.match(page, /\/implement\/content\/seeking\//);
  assert.doesNotMatch(page, /publish_gated/);
  assert.doesNotMatch(page, /h-listing records/i);
  assert.doesNotMatch(page, /page_updated|last_checked|seeking-site__dates/);
  assert.match(
    css,
    /\.seeking-site__header\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/s,
  );
  assert.match(
    css,
    /\.seeking-site__domain\s*\{[^}]*margin-inline-start:\s*auto/s,
  );

  assert.match(card, /seeking-card__categories list-row/);
  assert.match(card, /h-listing/);
  assert.match(card, /p-action/);
  assert.match(card, /outbound-href\.html/);
  assert.match(card, /source_url/);
  assert.doesNotMatch(card, /contact_url/);

  assert.match(script, /data-seeking-filter/);
  assert.match(script, /data-seeking-clear/);
  assert.match(script, /querySelectorAll\("\.p-category"\)/);
  assert.doesNotMatch(script, /seekingCategories/);
  assert.match(card, /categories \| join: ','/);
  assert.doesNotMatch(card, /unless forloop\.last/);
});

test("seeking payloads stay out of committed workflow staging", async () => {
  const workflow = await read(".github/workflows/network-sync.yml");
  const gitignore = await read(".gitignore");

  assert.match(gitignore, /_data\/seeking\.json/);
  assert.doesNotMatch(workflow, /^\s+_data\/seeking(?:\.json)?\s*$/m);
  assert.doesNotMatch(workflow, /^\s+git add --[^\n]*seeking/m);
  assert.match(workflow, /Seeking request bodies are current-only/);
  assert.match(
    await read("scripts/nlp/seeking.mjs"),
    /JOSHTERNET_SEEKING_PUBLISH/,
  );
});
