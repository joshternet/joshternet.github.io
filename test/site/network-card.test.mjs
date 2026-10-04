/**
 * Goal: Network cards expose feed and elsewhere controls outside the origin link.
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

test("network cards link the primary feed outside the origin card link", async () => {
  const page = await read("network.md");
  const styles = [
    await read("assets/css/main.css"),
    await read("assets/css/elsewhere-glyphs.css"),
  ].join("\n");
  const networkDev = await read("_data/network_dev.json");

  assert.match(page, /network-card--{{ network_site.identity }} h-card/);
  assert.match(page, /network_site\.feeds/);
  assert.match(page, /network-card__feed/);
  assert.match(page, /network-card__actions/);
  assert.match(page, /network-card__footer/);
  assert.doesNotMatch(page, /site\.data\.site_views/);
  assert.doesNotMatch(page, /recent_content/);

  const feedAt = page.indexOf('class="network-card__feed"');
  const linkCloseAt = page.indexOf(
    "</a>",
    page.indexOf('class="network-card__link"'),
  );
  const articleCloseAt = page.indexOf("</article>", feedAt);

  assert.ok(
    feedAt > linkCloseAt,
    "feed control must follow the origin link close",
  );
  assert.ok(feedAt < articleCloseAt, "feed control must stay inside the card");
  assert.doesNotMatch(
    page.slice(page.indexOf('class="network-card__link"'), linkCloseAt),
    /network-card__feed/,
  );

  assert.match(styles, /\.network-card__feed(?:,|\s*\{)/);
  assert.match(styles, /\.network-card__actions\s*\{[^}]*display:\s*grid/s);
  assert.match(
    styles,
    /\.network-card__elsewhere\s*\{[^}]*display:\s*contents/s,
  );
  assert.match(
    networkDev,
    /"url": "https:\/\/josh\.example\.invalid\/rss\.xml"/,
  );
});

test("network cards expose elsewhere icons outside the origin link", async () => {
  const page = await read("network.md");
  const styles = [
    await read("assets/css/main.css"),
    await read("assets/css/elsewhere-glyphs.css"),
  ].join("\n");
  const sprite = await read("assets/icons/elsewhere-sprite.svg");
  const networkDev = await read("_data/network_dev.json");

  assert.match(page, /network_site\.elsewhere/);
  assert.match(page, /network-card__elsewhere/);
  assert.match(page, /network-card__elsewhere-glyph--/);

  const elsewhereAt = page.indexOf('class="network-card__elsewhere"');
  const linkCloseAt = page.indexOf(
    "</a>",
    page.indexOf('class="network-card__link"'),
  );
  const articleCloseAt = page.indexOf("</article>", elsewhereAt);

  assert.ok(elsewhereAt > linkCloseAt, "elsewhere must follow origin link");
  assert.ok(elsewhereAt < articleCloseAt, "elsewhere must stay in the card");
  assert.doesNotMatch(
    page.slice(page.indexOf('class="network-card__link"'), linkCloseAt),
    /network-card__elsewhere/,
  );

  assert.match(styles, /elsewhere-sprite\.svg/);
  assert.match(styles, /\.network-card__elsewhere-glyph--github\s*\{/);
  assert.match(styles, /\.network-card__elsewhere-glyph--weibo\s*\{/);
  assert.match(
    styles,
    /mask-image:\s*url\("\/assets\/icons\/elsewhere-sprite\.svg"\)/,
  );
  assert.match(sprite, /id="github"/);
  assert.match(sprite, /id="web"/);
  assert.match(sprite, /Simple Icons \(CC0\)/);
  assert.match(
    await read("THIRD_PARTY_LICENSES.md"),
    /Elsewhere network icons/,
  );
  assert.match(await read("THIRD_PARTY_LICENSES.md"), /brand\.linkedin\.com/);
  assert.match(networkDev, /"network": "github"/);
  assert.match(networkDev, /"network": "weibo"/);
});

test("network page does not duplicate the blogroll subscribe copy", async () => {
  const page = await read("network.md");

  assert.doesNotMatch(page, /Joshternet blogroll/);
  assert.doesNotMatch(page, /Subscribe with the/);
});

test("site head advertises the Joshternet blogroll on every page", async () => {
  const layout = await read("_layouts/default.html");

  assert.match(
    layout,
    /rel="blogroll"[\s\S]*?type="text\/xml"[\s\S]*?joshternet\.opml/,
  );
  assert.match(layout, /\/assets\/network\/joshternet\.opml/);
});
