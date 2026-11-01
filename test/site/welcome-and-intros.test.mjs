/**
 * Goal: Welcome cards page and Network card link stay registry-backed without
 * inventing membership accounts. Participant-introductions scaffolding is gone.
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

test("welcome page and Network link keep cards separate from the button", async () => {
  const welcome = await read("welcome.md");
  const network = await read("network.md");
  const workflow = await read(".github/workflows/network-sync.yml");
  const build = await read("scripts/views/build.mjs");

  assert.match(welcome, /permalink: \/welcome\//);
  assert.match(welcome, /official Joshternet button/);
  assert.match(welcome, /site\.data\.welcome_cards/);
  assert.match(network, /Get welcome card/);
  assert.match(network, /\/welcome\//);
  assert.match(build, /materializeWelcomeCards/);
  assert.match(workflow, /assets\/network\/welcome/);
  assert.match(workflow, /welcome_cards\.json/);
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
