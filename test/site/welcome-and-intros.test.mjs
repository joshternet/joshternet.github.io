/**
 * Goal: Participant-introductions scaffolding stays gone. Welcome postcard
 * page/pipeline removed separately (no /welcome/ assertions here).
 */
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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

test("welcome postcard page and pipeline are removed", async () => {
  const network = await read("network.md");
  const join = await read("join.md");
  const build = await read("scripts/views/build.mjs");
  const workflow = await read(".github/workflows/network-sync.yml");

  await assert.rejects(() => access(path.join(root, "welcome.md")));
  await assert.rejects(() =>
    access(path.join(root, "scripts/views/welcome-cards.mjs")),
  );
  await assert.rejects(() =>
    access(path.join(root, "_data/welcome_cards.json")),
  );
  assert.doesNotMatch(network, /Get welcome card/);
  assert.doesNotMatch(network, /\/welcome\//);
  assert.doesNotMatch(join, /\/welcome\//);
  assert.doesNotMatch(join, /Download your welcome card/);
  assert.doesNotMatch(build, /materializeWelcomeCards/);
  assert.doesNotMatch(workflow, /assets\/network\/welcome/);
  assert.doesNotMatch(workflow, /welcome_cards\.json/);
});

test("participant-introductions scaffolding is removed", async () => {
  const community = await read("community.md");
  const network = await read("network.md");

  assert.doesNotMatch(community, /Optional participant introductions/);
  assert.doesNotMatch(community, /introductions\.yml/);
  assert.doesNotMatch(network, /participant-introductions/);

  await assert.rejects(() =>
    access(path.join(root, "_data/introductions.yml")),
  );
  await assert.rejects(() =>
    access(path.join(root, "_includes/participant-introductions.html")),
  );
});

test("connections bootstrap carries build-time recently_joined for arrival chrome", async () => {
  const home = await read("_includes/home-connections.html");
  const page = await read("connections.md");
  const script = await read("assets/js/connections.js");
  const css = await read("assets/css/main.css");

  assert.match(home, /first_participated_at/);
  assert.match(home, /recently_joined/);
  assert.match(home, /recently_joined_cutoff_s/);
  assert.match(page, /first_participated_at/);
  assert.match(page, /recently_joined/);
  assert.match(page, /recently_joined_cutoff_s/);
  assert.match(script, /recently_joined/);
  assert.doesNotMatch(script, /isRecentlyJoined/);
  assert.doesNotMatch(script, /7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(script, /connections-graph__recent-ring/);
  assert.match(css, /connections-graph__recent-ring/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
