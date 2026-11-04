/**
 * Goal: Showcase Liquid uses showcase-card + outbound-href (Umami UTMs),
 * never nests activity-card <li>, and home strip shares the same partial.
 * Kind controls are filter buttons (not hash scroll links). Whole card is one
 * covering hit link to the showcased work URL (not the site homepage).
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

test("showcase page uses showcase-card without nested activity-card list items", async () => {
  const page = await read("showcase.md");
  assert.match(page, /title: Showcase$/m);
  assert.match(
    page,
    /Explore games, books, art, photography, software, and other creative work/,
  );
  assert.match(page, /wandering the internet is discovering what people make/);
  assert.match(page, /Everything here leads to the original website/);
  assert.match(
    page,
    /not every creative project from every participating site/,
  );
  assert.doesNotMatch(
    page,
    /hand-selected|handpicked|carefully curated|Our favorite/i,
  );
  assert.doesNotMatch(page, /No creative works are indexed yet/);
  assert.match(page, /Nothing has made it into Showcase just yet/);
  assert.match(page, /showcase-close/);
  assert.match(page, /include showcase-card\.html item=item/);
  assert.doesNotMatch(page, /include activity-card\.html/);
  assert.doesNotMatch(page, /showcase-action/);
  assert.match(page, /script: \/assets\/js\/showcase\.js/);
});

test("showcase filters are buttons that filter by kind, not hash scroll links", async () => {
  const page = await read("showcase.md");
  const script = await read("assets/js/showcase.js");
  assert.match(page, /data-showcase-filter="all"/);
  assert.match(page, /data-showcase-filter="\{\{ kind \| escape \}\}"/);
  assert.match(page, /data-showcase-kind=/);
  assert.match(page, /showcase-filters__button/);
  assert.match(page, /kind_label/);
  assert.match(page, /showcase_kind_labels/);
  assert.doesNotMatch(page, /#kind-/);
  assert.doesNotMatch(page, /showcase-filters__link/);
  assert.match(script, /data-showcase-filter/);
  assert.match(script, /section\.hidden/);
  assert.match(script, /aria-pressed/);
  assert.match(script, /showcase-filter/);
});

test("showcase-card hit link uses the work URL only", async () => {
  const card = await read("_includes/showcase-card.html");
  assert.match(card, /include outbound-href\.html url=include\.item\.url/);
  assert.doesNotMatch(
    card,
    /include outbound-href\.html url=include\.item\.site_origin/,
  );
  assert.doesNotMatch(card, /showcase-card__maker-link/);
  assert.doesNotMatch(card, /href="\{\{\s*include\.item\.url/);
  assert.doesNotMatch(card, /data-joshternet-skip-link-track/);
  assert.match(card, /class="showcase-card__hit u-url"/);
  assert.equal((card.match(/^\s*<a\b/gm) || []).length, 1);
  const media = card.match(
    /<div class="showcase-card__media">([\s\S]*?)<\/div>/,
  );
  assert.ok(media, "media block should always wrap the poster slot");
  assert.match(media[1], /<img\b/);
  assert.doesNotMatch(media[1], /<a\b/);
  assert.match(card, /showcase-card__maker/);
  assert.match(card, /showcase-card__summary/);
  assert.match(card, /showcase-card__domain/);
  assert.match(card, /network_site\.screenshot/);
});

test("showcase-card CSS places the hit link over the tile and domain bottom-right", async () => {
  const css = await read("assets/css/main.css");
  assert.match(css, /\.showcase-card__hit\s*\{[^}]*inset:\s*0/s);
  assert.match(css, /\.showcase-card__hit\s*\{[^}]*z-index:\s*1/s);
  assert.doesNotMatch(css, /\.showcase-card__maker-link/);
  assert.match(
    css,
    /\.showcase-card__domain\s*\{[^}]*margin-block-start:\s*auto/s,
  );
  assert.match(css, /\.showcase-card__domain\s*\{[^}]*text-align:\s*end/s);
});

test("home showcase strip reuses showcase-card with outbound-href", async () => {
  const home = await read("_includes/home-showcase.html");
  assert.match(home, /include showcase-card\.html item=item/);
  assert.doesNotMatch(home, /include activity-card\.html/);
  assert.match(home, /Things people are making/);
});

test("home showcase list stays a single non-wrapping row", async () => {
  const css = await read("assets/css/main.css");
  assert.match(css, /\.showcase-list--home\s*\{[^}]*flex-wrap:\s*nowrap/s);
  assert.match(css, /\.showcase-list--home\s*\{[^}]*overflow-x:\s*auto/s);
});

test("showcase-card media keeps posters fully visible and readable", async () => {
  const css = await read("assets/css/main.css");
  assert.match(
    css,
    /\.showcase-card__media img\s*\{[^}]*object-fit:\s*contain[^}]*object-position:\s*center/s,
  );
  assert.doesNotMatch(
    css,
    /\.showcase-card:hover \.showcase-card__media img[^}]*transform:\s*scale/,
  );
  assert.match(
    css,
    /\.showcase-list--home > \.showcase-list__item\s*\{[^}]*15rem/s,
  );
});
