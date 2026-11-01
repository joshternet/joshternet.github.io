/**
 * Goal: Wander toolbar is Go, address, and Open only (no Follow/Previous).
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

test("Wander toolbar is Go, address, and Open only", async () => {
  const page = await read("wander.md");
  const script = await read("assets/js/wander.js");

  assert.match(page, /data-wander-go/);
  assert.match(page, /data-wander-address/);
  assert.match(page, /data-wander-open/);
  assert.doesNotMatch(page, /data-wander-follow/);
  assert.doesNotMatch(page, /data-wander-back/);
  assert.doesNotMatch(page, /data-wander-mode/);
  assert.doesNotMatch(page, /Follow a connection/);
  assert.doesNotMatch(page, /Previous/);

  assert.match(script, /joshternet-wander-v4/);
  assert.match(script, /\/network\/data\.json/);
  assert.doesNotMatch(script, /\/connections\/data\.json/);
  assert.doesNotMatch(script, /previousStack/);
  assert.doesNotMatch(script, /followConnection/);
  assert.doesNotMatch(script, /data-wander-follow/);
  assert.doesNotMatch(script, /data-wander-back/);
  assert.doesNotMatch(script, /shared-topic/);
  assert.doesNotMatch(script, /popularity|PageRank/i);
});
