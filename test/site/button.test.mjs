/**
 * Goal: Button docs and embed contract without reusable image files.
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

test("button page documents all four states and the one-line embed", async () => {
  const page = await read("implement/buttons.md");
  const nav = await read("_data/implement_nav.yml");
  const config = await read("_config.yml");
  const guide = await read("implement.md");
  const layout = await read("_layouts/default.html");
  const wrangler = await read("workers/joshternet-button/wrangler.jsonc");

  assert.match(page, /permalink: \/implement\/buttons\//);
  assert.match(page, /window\.location\.origin/);
  assert.match(page, /Verified Josh/);
  assert.match(page, /Verified Non-Josh/);
  assert.match(page, /Undeclared/);
  assert.match(page, /Join the Joshternet/);
  assert.match(page, /joshternet-button\.js/);
  assert.match(page, /script-src https:\/\/joshternet\.org/);
  assert.match(page, /connect-src https:\/\/joshternet\.org/);
  assert.doesNotMatch(page, /img-src https:\/\/joshternet\.org/);
  assert.doesNotMatch(page, /\.png/);
  assert.doesNotMatch(page, /assets\/buttons/);
  assert.doesNotMatch(page, /imageURL/);
  assert.match(
    page,
    /src="https:\/\/joshternet\.org\/embed\/joshternet-button\.js"/,
  );
  assert.match(page, /GET https:\/\/joshternet\.org\/api\/button-state/);
  assert.doesNotMatch(page, /badge/i);
  assert.doesNotMatch(page, /banner/i);
  assert.match(nav, /title: Buttons/);
  assert.match(nav, /path: \/implement\/buttons\//);
  assert.match(config, /joshternet_button:/);
  assert.match(config, /embed_src: "https:\/\/joshternet\.org\/embed\//);
  assert.match(guide, /\/implement\/buttons\//);
  assert.match(layout, /site-footer__button/);
  assert.match(layout, /joshternet-button\.js/);
  assert.match(wrangler, /joshternet\.org\/embed\/\*/);
  assert.match(wrangler, /joshternet\.org\/api\/button-state\*/);
  assert.doesNotMatch(wrangler, /joshternet\.org\/button\*/);
  assert.doesNotMatch(wrangler, /assets:\s*\{/);
  assert.doesNotMatch(wrangler, /"directory": "\.\/public"/);
  assert.match(wrangler, /www\.joshternet\.org\/embed\/\*/);
});

test("official button files are not published under assets/buttons", async () => {
  await assert.rejects(
    () => access(path.join(root, "assets/buttons")),
    (error) => {
      assert.equal(/** @type {NodeJS.ErrnoException} */ (error).code, "ENOENT");
      return true;
    },
  );
});
