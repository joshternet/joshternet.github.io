/**
 * Goal: /join/ guides participation without inventing membership success, and
 * homepage CTAs point at Join while Network remains linked from discovery.
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

test("join page covers identity platforms validate nominate and celebrate", async () => {
  const join = await read("join.md");
  const script = await read("assets/js/join.js");
  const css = await read("assets/css/main.css");
  const nav = await read("_data/implement_nav.yml");
  const links = await read("_includes/site-nav-links.html");
  const sections = await read("_includes/site-nav-sections.html");

  assert.match(join, /permalink: \/join\//);
  assert.match(join, /script: \/assets\/js\/join\.js/);
  assert.match(join, /Are you a Josh\? Get yourself connected/);
  assert.match(join, /equally|everyone is welcome|everyone participates/i);
  assert.match(join, /Choose your declaration/);
  assert.match(join, /Find your website's setup/);
  assert.match(join, /Put it on your website/);
  assert.match(join, /Check that it works/);
  assert.match(join, /Help JoshBot find you/);
  assert.match(join, /You're in\. What next\?/);
  assert.match(join, /"josh": true/);
  assert.match(join, /"josh": false/);
  assert.match(join, /\{\s*"version": 1\s*\}/);
  assert.match(join, /id="join-declaration-undeclared"/);
  assert.match(join, /data-join-copy/);
  assert.match(join, /site\.data\.platforms_nav/);
  assert.match(join, /generic-static/);
  assert.match(join, /\/implement\/validate\//);
  assert.match(join, /Check your declaration/);
  assert.match(join, /\/nominate\//);
  assert.doesNotMatch(join, /\/welcome\//);
  assert.match(join, /\/implement\/buttons\//);
  assert.match(join, /#joshternet/);
  assert.match(
    join,
    /doesn't mean JoshBot has discovered or listed|not the same as JoshBot having listed/i,
  );
  assert.match(join, /does not establish participation/i);
  assert.match(join, /establishes participation/i);
  assert.doesNotMatch(join, /not membership success/i);
  assert.doesNotMatch(join, /Choose participation identity/i);
  assert.match(join, /data-joshternet-skip-link-track/);
  assert.match(script, /function ensureJoinStart/);
  assert.match(script, /joshternet-join-started/);
  assert.match(script, /join-start/);
  assert.match(script, /join-platform/);
  assert.match(script, /join-declaration-copy/);
  assert.match(script, /join-check-open/);
  assert.match(script, /join-nominate-open/);
  assert.match(script, /join-share-open/);
  assert.equal((script.match(/track\("join-start"\)/g) || []).length, 1);
  assert.match(script, /function ensureJoinStart[\s\S]*track\("join-start"\)/);
  assert.match(script, /ensureJoinStart\(\);/);
  assert.match(css, /\.join-steps\s*\{/);
  assert.match(css, /\.join-declarations\s*\{/);
  assert.doesNotMatch(nav, /path: \/join\//);
  assert.match(links, /href="\{\{ '\/join\/' \| relative_url \}\}"/);
  assert.match(links, />Join<\/a/);
  assert.doesNotMatch(sections, /page\.url == '\/join\/'/);
  assert.match(sections, /page\.url == '\/implement\/'/);
});

test("cloudflare worker recipe embeds Worker source on the page", async () => {
  const recipe = await read("implement/platforms/cloudflare-worker.md");

  assert.match(recipe, /## Create the Worker/);
  assert.match(recipe, /```js/);
  assert.match(recipe, /snippets\/cloudflare-worker\.js/);
  assert.match(recipe, /\/\.well-known\/josh/);
  assert.match(recipe, /application\/json/);
  assert.match(recipe, /JOSH_IDENTITY/);
  assert.match(
    recipe,
    /fail closed|does \*\*not\*\* silently become undeclared/i,
  );
  assert.match(recipe, /## Wrangler config|### Wrangler config/);
  assert.match(recipe, /```toml/);
  assert.match(recipe, /\[\[routes\]\]/);
  assert.match(recipe, /joshua\.example\/\.well-known\/josh/);
  assert.match(recipe, /does not (?:host or )?operate/i);
  assert.doesNotMatch(
    recipe,
    /github\.com\/joshternet\/joshternet\.github\.io\/tree\/.*examples/,
  );
});
