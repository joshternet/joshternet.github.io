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

  assert.match(page, /title: Wander the Joshternet$/m);
  assert.match(page, /Discover another website/);
  assert.match(page, /Open this website in a new tab/);
  assert.match(page, /Finding another corner of the internet to explore/);
  assert.match(page, /browse the Network/);
  assert.doesNotMatch(page, /Browse The Network/);
  assert.doesNotMatch(page, /Looking for somewhere to wander/);
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
  assert.match(
    script,
    /This preview stays on the current website\. To follow links elsewhere/,
  );
  assert.match(script, /Previewing \$\{site\.title/);
  assert.match(
    script,
    /Showing \$\{site\.title \|\| site\.domain\}\. Open the original website to visit it/,
  );
  assert.match(script, /Find in the Network/);
  assert.match(script, /Participating website with affirmed Josh identity/);
  assert.match(script, /Participating since/);
  assert.doesNotMatch(script, /Josh Joshternet participant/);
  assert.doesNotMatch(script, /Joined <time/);
  assert.doesNotMatch(script, /Now viewing/);
  assert.doesNotMatch(script, /\/connections\/data\.json/);
  assert.doesNotMatch(script, /previousStack/);
  assert.doesNotMatch(script, /followConnection/);
  assert.doesNotMatch(script, /data-wander-follow/);
  assert.doesNotMatch(script, /data-wander-back/);
  assert.doesNotMatch(script, /shared-topic/);
  assert.doesNotMatch(script, /popularity|PageRank/i);
});
