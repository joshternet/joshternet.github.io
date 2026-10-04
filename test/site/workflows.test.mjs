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
