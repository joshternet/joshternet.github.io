/**
 * Goal: Lock hourly/registry sync triggers and the quality pipeline so CI cannot
 * silently drop coverage, browser, build, or site checks.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("network-sync keeps hourly and registry triggers plus sync steps", async () => {
  const sync = await read(".github/workflows/network-sync.yml");

  assert.match(sync, /schedule:/);
  assert.match(sync, /cron:\s*"17 \* \* \* \*"/);
  assert.match(sync, /repository_dispatch:/);
  assert.match(sync, /joshternet-registry-updated/);
  assert.match(sync, /workflow_dispatch:/);
  assert.match(sync, /npm run test:coverage/);
  assert.match(sync, /npm run test:browser/);
  assert.match(sync, /npm run network:sync/);
  assert.match(sync, /npm run nlp:sync/);
  assert.match(sync, /npm run nlp:validate/);
  assert.match(sync, /npm run nlp:quality/);
  assert.match(sync, /npm run format:data/);
});

test("network-sync publish set lists CI-owned generated paths", async () => {
  const sync = await read(".github/workflows/network-sync.yml");

  for (const relativePath of [
    "_data/network.json",
    "_data/blogrolls.json",
    "_data/connections.json",
    "_data/topics.json",
    "_data/site_signals.json",
    "_data/content.json",
    "_data/data_manifest.json",
    "_data/activity.json",
    "_data/explore.json",
    "_data/topic_views.json",
    "_data/connection_topics.json",
    "_data/site_views.json",
    "_data/search_index.json",
    "topics/",
    "assets/network/joshternet.opml",
    "assets/network/sites/",
    "assets/activity/posters/",
  ]) {
    assert.match(
      sync,
      new RegExp(relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `network-sync must publish ${relativePath}`,
    );
  }
});

test("site-quality runs coverage, browser, build, and site tests", async () => {
  const quality = await read(".github/workflows/site-quality.yml");

  assert.match(quality, /pull_request:/);
  assert.match(quality, /npm run test:coverage/);
  assert.match(quality, /npm run test:browser/);
  assert.match(quality, /npm run build/);
  assert.match(quality, /npm run test:site/);
  assert.doesNotMatch(quality, /^\s*run:\s*npm test\s*$/m);
});

test("seed-nominations Worker workflow matches the other public Workers", async () => {
  const workflow = await read(".github/workflows/seed-nominations.yml");

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /node-version: 22/);
  assert.match(workflow, /working-directory: workers\/seed-nominations/);
  assert.match(workflow, /workers\/seed-nominations\/\*\*/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run check/);
});

test("production smoke is scheduled and is not a pull request check", async () => {
  const workflow = await read(".github/workflows/production-smoke.yml");

  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.match(workflow, /https:\/\/joshternet\.org\//);
  assert.match(workflow, /latest_declaration_check_at/);
  assert.match(workflow, /hours=6/);
  assert.match(workflow, /button-state/);
  assert.match(workflow, /declaration-check/);
  assert.match(workflow, /seed-nominations/);
  assert.match(workflow, /http-message-signatures-directory/);
  assert.doesNotMatch(workflow, /secrets\./);
});
