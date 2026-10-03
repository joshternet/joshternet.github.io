import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("community page and footer point at #joshternet without embedding chat", async () => {
  const community = await read("community.md");
  const layout = await read("_layouts/default.html");

  assert.match(community, /#joshternet/);
  assert.match(community, /https:\/\/web\.libera\.chat\/#joshternet/);
  assert.match(community, /irc\.libera\.chat/);
  assert.match(community, /6697/);
  assert.match(community, /TLS/);
  assert.doesNotMatch(community, /<iframe/i);
  assert.match(layout, /https:\/\/web\.libera\.chat\/#joshternet/);
  assert.match(layout, />#joshternet</);
  assert.match(layout, /site-footer__button/);
  assert.match(layout, /joshternet-button\.js/);
});

test("primary navigation keeps top-level labels and Implement children", async () => {
  const links = await read("_includes/site-nav-links.html");
  const children = await read("_includes/site-nav-implement-children.html");
  const layout = await read("_layouts/default.html");
  const data = await read("_data/implement_nav.yml");
  const styles = await read("assets/css/main.css");

  for (const label of [
    "Home",
    "About",
    "Network",
    "Wander",
    "Nominate",
    "Specifications",
    "Community",
    "Governance",
    "Implement",
    "JoshBot",
  ]) {
    assert.match(links, new RegExp(`>${label}</a`));
  }

  assert.match(links, /site-nav__item--implement/);
  assert.match(links, /site-nav__raindrop/);
  assert.match(links, /Implement submenu/);
  assert.match(links, /aria-current="true"/);
  assert.match(links, /variant == ['"]compact['"]/);
  assert.match(children, /site\.data\.implement_nav/);
  assert.doesNotMatch(data, /title: Guide/);
  assert.doesNotMatch(data, /path: \/implement\/\n/);
  assert.match(data, /path: \/implement\/validate\//);
  assert.match(data, /path: \/implement\/eleventy\//);
  assert.match(data, /path: \/implement\/jekyll\//);
  assert.match(data, /path: \/implement\/buttons\//);
  assert.match(layout, /site-nav-secondary--implement/);
  assert.match(layout, /site-header__top/);
  assert.match(layout, /site-header__motif/);
  assert.match(layout, /variant="compact"/);
  assert.match(layout, /variant="wide"/);
  assert.match(styles, /site-header__top/);
  assert.match(styles, /site-nav-secondary/);
  assert.match(styles, /site-nav__raindrop/);
  assert.match(layout, /site-nav\.js/);
  const navScript = await read("assets/js/site-nav.js");
  assert.match(navScript, /pointerenter/);
  assert.match(navScript, /scheduleLeave/);
  assert.doesNotMatch(styles, /site-nav-secondary[^{]*\{[^}]*box-shadow/);
  assert.doesNotMatch(links, /aria-expanded/);
});

test("Eleventy recipe is its own page under the implementation guide", async () => {
  const guide = await read("implement.md");
  const eleventy = await read("implement/eleventy.md");

  assert.match(guide, /\/implement\/eleventy\//);
  assert.match(guide, /does not become `\/\.well-known\/josh\.json`/);
  assert.doesNotMatch(guide, /addPassthroughCopy/);

  assert.match(eleventy, /permalink: \/implement\/eleventy\//);
  assert.match(eleventy, /josh\.json/);
  assert.match(eleventy, /\/\.well-known\/josh/);
  assert.match(eleventy, /does not become `\/\.well-known\/josh\.json`/);
  assert.match(eleventy, /addPassthroughCopy\(\{/);
  assert.match(eleventy, /"input\/josh\.json": "\.well-known\/josh"/);
  assert.match(eleventy, /Content-Type: application\/json/);
  assert.match(eleventy, /\[\[headers\]\]/);
  assert.match(
    eleventy,
    /curl -i https:\/\/example\.invalid\/\.well-known\/josh/,
  );
  assert.match(eleventy, /\[implementation guide\]\[implement\]/);
  assert.match(eleventy, /\[implement\]: \/implement\//);
});

test("Jekyll recipe is its own page under the implementation guide", async () => {
  const guide = await read("implement.md");
  const jekyll = await read("implement/jekyll.md");
  const config = await read("_config.yml");

  assert.match(guide, /\/implement\/jekyll\//);
  assert.doesNotMatch(guide, /include:\n\s+- \.well-known/);

  assert.match(jekyll, /permalink: \/implement\/jekyll\//);
  assert.match(jekyll, /\.well-known\/\n\s+josh/);
  assert.match(jekyll, /\/\.well-known\/josh/);
  assert.match(jekyll, /does not become `\/\.well-known\/josh\.json`/);
  assert.match(jekyll, /include:\n\s+- \.well-known/);
  assert.match(jekyll, /Content-Type: application\/json/);
  assert.match(jekyll, /\[\[headers\]\]/);
  assert.match(
    jekyll,
    /curl -i https:\/\/example\.invalid\/\.well-known\/josh/,
  );
  assert.match(jekyll, /\[implementation guide\]\[implement\]/);
  assert.match(jekyll, /\[implement\]: \/implement\//);
  assert.match(config, /include:\n\s+- \.well-known/);
});

test("declaration check keeps paste and origin feedback in separate forms", async () => {
  const page = await read("implement/validate.md");
  const script = await read("assets/js/declaration-check.js");
  const styles = await read("assets/css/main.css");

  const pasteResultAt = page.indexOf("data-declaration-paste-result");
  const pasteInputAt = page.indexOf("data-declaration-text");
  const pasteErrorAt = page.indexOf("data-declaration-paste-error");
  const originResultAt = page.indexOf("data-declaration-origin-result");
  const originInputAt = page.indexOf("data-declaration-origin-input");
  const originErrorAt = page.indexOf("data-declaration-origin-error");

  assert.ok(pasteResultAt > -1 && pasteResultAt < pasteInputAt);
  assert.ok(pasteInputAt < pasteErrorAt);
  assert.ok(originResultAt > -1 && originResultAt < originInputAt);
  assert.ok(originInputAt < originErrorAt);
  assert.match(page, /placeholder='\{\n  "version": 1\n\}'/);
  assert.match(page, /placeholder="https:\/\/example\.invalid"/);
  assert.doesNotMatch(page, /<textarea[^>]*>\s*\{/);
  assert.doesNotMatch(page, /data-declaration-result[^-]/);
  assert.match(script, /markField\(pasteField/);
  assert.match(script, /markField\(originInput/);
  assert.match(styles, /data-field-state="valid"/);
  assert.match(styles, /data-field-state="invalid"/);
  assert.doesNotMatch(script, /pasteInput\.value = body/);
  assert.doesNotMatch(
    script,
    /window\.setTimeout\(checkPaste, PAUSE_MS\);\n\n  pasteInput/,
  );
  assert.match(page, /data-declaration-check-api/);
  assert.match(script, /data-declaration-check-api/);
  assert.match(script, /endpoint\.searchParams\.set\("origin"/);
  assert.doesNotMatch(script, /fetch\(url,/);
});
