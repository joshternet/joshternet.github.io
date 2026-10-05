/**
 * Goal: Site builds refresh registry datasets in a fixed, repeatable order.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("build script dry-run lists the registry rebuild before Jekyll", async () => {
  const script = path.join(root, "scripts/build.sh");
  const help = await execFileAsync("bash", [script, "--help"], { cwd: root });

  assert.match(help.stdout, /npm run network:sync/);
  assert.match(help.stdout, /npm run nlp:sync/);
  assert.match(help.stdout, /npm run format:data/);
  assert.match(help.stdout, /npm run nlp:validate/);
  assert.match(help.stdout, /jekyll build/);
  assert.doesNotMatch(help.stdout, /pkill|kill -9|lsof|fuser/i);

  const dry = await execFileAsync("bash", [script, "--dry-run"], { cwd: root });
  const networkAt = dry.stdout.indexOf("npm run network:sync");
  const nlpAt = dry.stdout.indexOf("npm run nlp:sync");
  const formatAt = dry.stdout.indexOf("npm run format:data");
  const validateAt = dry.stdout.indexOf("npm run nlp:validate");
  const jekyllAt = dry.stdout.indexOf("jekyll build");

  assert.ok(networkAt > -1 && networkAt < nlpAt);
  assert.ok(nlpAt < formatAt);
  assert.ok(formatAt < validateAt);
  assert.ok(validateAt < jekyllAt);
  assert.equal(dry.stderr, "");

  await assert.rejects(
    () => execFileAsync("bash", [script, "--explode"], { cwd: root }),
    (error) => {
      assert.equal(error.code, 2);
      assert.match(String(error.stderr), /unknown option/);
      return true;
    },
  );
});

test("site build and registry sync publish the view datasets", async () => {
  const pkg = await read("package.json");
  const quality = await read(".github/workflows/site-quality.yml");
  const sync = await read(".github/workflows/network-sync.yml");
  const views = await read("scripts/views/build.mjs");

  assert.match(pkg, /"build": "bash scripts\/build\.sh"/);
  assert.match(quality, /npm run build/);
  assert.doesNotMatch(quality, /bundle exec jekyll build/);

  for (const dataset of [
    "activity.json",
    "explore.json",
    "topic_views.json",
    "connection_topics.json",
    "site_views.json",
    "search_index.json",
  ]) {
    assert.match(sync, new RegExp(dataset.replace(".", "\\.")));
  }

  assert.match(views, /semanticallyEqual/);
});
