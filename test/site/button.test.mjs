/**
 * Goal: Button docs and assets for Joshternet web buttons.
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

/**
 * @param {Buffer} bytes
 * @returns {{ width: number, height: number }}
 */
function pngDimensions(bytes) {
  assert.equal(bytes.subarray(0, 8).toString("binary"), "\x89PNG\r\n\x1a\n");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test("button page documents all four states and the one-line embed", async () => {
  const page = await read("implement/buttons.md");
  const nav = await read("_data/implement_nav.yml");
  const config = await read("_config.yml");
  const guide = await read("implement.md");
  const layout = await read("_layouts/default.html");
  const wrangler = await read("workers/joshternet-button/wrangler.jsonc");

  assert.match(page, /permalink: \/implement\/buttons\//);
  assert.match(page, /window\.location\.origin/);
  assert.match(page, /web buttons/);
  assert.match(page, /verified-josh\.png/);
  assert.match(page, /verified-non-josh\.png/);
  assert.match(page, /undeclared\.png/);
  assert.match(page, /join-the-joshternet\.png/);
  assert.match(page, /script-src https:\/\/joshternet\.org/);
  assert.match(page, /img-src https:\/\/joshternet\.org/);
  assert.match(page, /connect-src https:\/\/joshternet\.org/);
  assert.match(
    page,
    /src="https:\/\/joshternet\.org\/embed\/joshternet-button\.js"/,
  );
  assert.match(page, /unavailable/);
  assert.match(page, /GET https:\/\/joshternet\.org\/api\/button-state/);
  assert.doesNotMatch(page, /badge/i);
  assert.doesNotMatch(page, /banner/i);
  assert.doesNotMatch(page, /88×31 banner/i);
  assert.match(nav, /title: Buttons/);
  assert.match(nav, /path: \/implement\/buttons\//);
  assert.match(config, /joshternet_button:/);
  assert.match(config, /embed_src: "https:\/\/joshternet\.org\/embed\//);
  assert.match(guide, /\/implement\/buttons\//);
  assert.match(layout, /site-footer__button/);
  assert.match(layout, /joshternet-button\.js/);
  assert.match(wrangler, /joshternet\.org\/embed\/\*/);
  assert.match(wrangler, /joshternet\.org\/button\*/);
  assert.match(wrangler, /joshternet\.org\/api\/button-state\*/);
  assert.match(wrangler, /www\.joshternet\.org\/embed\/\*/);
});

test("official button assets are 88 by 31 PNGs", async () => {
  for (const file of [
    "verified-josh.png",
    "verified-non-josh.png",
    "undeclared.png",
    "join-the-joshternet.png",
  ]) {
    const bytes = await readFile(path.join(root, "assets/buttons", file));
    const size = pngDimensions(bytes);
    assert.equal(size.width, 88, file);
    assert.equal(size.height, 31, file);
  }
});
