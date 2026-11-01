/**
 * Goal: Wander Follow-a-connection uses observed edges only, not modes UI.
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

test("Wander Follow uses connections data and session previous stack", async () => {
  const page = await read("wander.md");
  const script = await read("assets/js/wander.js");

  assert.match(page, /data-wander-follow/);
  assert.match(page, /data-wander-back/);
  assert.doesNotMatch(page, /data-wander-mode/);
  assert.match(script, /joshternet-wander-v3/);
  assert.match(script, /\/connections\/data\.json/);
  assert.match(script, /indexOutgoingConnections/);
  assert.match(script, /followConnection/);
  assert.match(script, /outgoingByOrigin/);
  assert.match(script, /previousStack/);
  assert.doesNotMatch(script, /shared-topic/);
  assert.doesNotMatch(script, /popularity|PageRank/i);
});
