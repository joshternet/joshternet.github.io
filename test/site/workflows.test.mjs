/**
 * Goal: Lock hourly/registry sync triggers and the quality pipeline so CI cannot
 * silently drop coverage, browser, build, or site checks. Ban Actions artifact
 * handoff for generated network/uses datasets.
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
  assert.match(sync, /sync-and-publish:/);
  assert.match(sync, /npm run test:coverage/);
  assert.match(sync, /npm run test:browser/);
  assert.match(sync, /npm run network:sync/);
  assert.match(sync, /npm run nlp:sync/);
  assert.match(sync, /Format generated datasets before validate/);
  assert.match(sync, /npm run nlp:validate/);
  assert.match(sync, /npm run nlp:quality/);
  assert.match(sync, /npm run uses:validate/);
  assert.match(sync, /npm run uses:quality/);
  assert.match(sync, /npm run format:data/);
  assert.match(sync, /npm run format:check/);
  assert.match(sync, /GITHUB_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
  assert.match(sync, /BASE_SHA|base\.outputs\.sha|Capture base SHA/);
  assert.match(sync, /JOSHTERNET_USES_PUBLISH/);
});

test("network-sync forbids Actions artifact upload/download for generated data", async () => {
  const sync = await read(".github/workflows/network-sync.yml");

  assert.doesNotMatch(
    sync,
    /actions\/upload-artifact/,
    "network-sync must not upload generated data as Actions artifacts",
  );
  assert.doesNotMatch(
    sync,
    /actions\/download-artifact/,
    "network-sync must not download generated data from Actions artifacts",
  );
  assert.doesNotMatch(
    sync,
    /retention-days:/,
    "network-sync must not configure artifact retention",
  );
  assert.doesNotMatch(
    sync,
    /network-generated/,
    "network-sync must not name a generated-data artifact",
  );
  assert.doesNotMatch(sync, /^\s*scrape:\s*$/m);
  assert.doesNotMatch(sync, /^\s*publish:\s*$/m);
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
    "_data/showcase.json",
    "_data/happening.json",
    "topics",
    "assets/network/joshternet.opml",
    "assets/network/sites",
    "assets/activity/posters",
  ]) {
    assert.match(
      sync,
      new RegExp(relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `network-sync must publish ${relativePath}`,
    );
  }

  assert.match(sync, /data\/uses/);
  assert.match(sync, /_data\/uses_summary\.json/);
  assert.match(sync, /assets\/data\/uses/);
  assert.doesNotMatch(
    sync,
    /^\s+_data\/seeking(?:\.json)?\s*$/m,
    "network-sync must not stage Seeking request bodies",
  );
  assert.match(
    sync,
    /Seeking request bodies are current-only/,
    "network-sync must document the Seeking non-commit retention boundary",
  );
});

test("site-quality runs coverage, browser, build, and site tests", async () => {
  const quality = await read(".github/workflows/site-quality.yml");

  assert.match(quality, /pull_request:/);
  assert.match(quality, /npm run format:check/);
  assert.match(quality, /npm run test:coverage/);
  assert.match(quality, /npm run test:browser/);
  assert.match(quality, /npm run build/);
  assert.match(quality, /npm run test:site/);
  assert.doesNotMatch(quality, /^\s*run:\s*npm test\s*$/m);
});

test("package validate script fails closed on format then coverage", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(
    pkg.scripts.validate,
    "npm run format:check && npm run test:coverage",
  );

  const build = await read("scripts/build.sh");
  assert.match(build, /npm run format:check/);
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
