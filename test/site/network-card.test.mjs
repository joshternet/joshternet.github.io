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
  const network = await read("_data/network.json");

  assert.match(styles, /\.network-card\[hidden\]\s*\{[^}]*display:\s*none/s);
  assert.match(page, /network-card--{{ network_site.identity }} h-card/);
  assert.match(page, /network_site\.feeds/);
  assert.match(page, /network-card__feed/);
  assert.match(page, /network-card__actions/);
  assert.match(page, /network-card__footer/);
  assert.match(page, /include network-card-joined\.html/);
  assert.match(page, /include network-card-a11y\.html/);
  assert.doesNotMatch(page, /site\.data\.site_views/);
  assert.doesNotMatch(page, /recent_content/);
  assert.doesNotMatch(page, /network_dev/);
  assert.doesNotMatch(page, /network-dev-preview/);

  const a11y = await read("_includes/network-card-a11y.html");
  const joined = await read("_includes/network-card-joined.html");
  assert.match(a11y, /Participating website with affirmed Josh identity/);
  assert.match(a11y, /Participating website with declined Josh identity/);
  assert.match(a11y, /Participating website with undeclared Josh identity/);
  assert.doesNotMatch(a11y, /joshing the Joshes/);
  assert.match(joined, /Participating since/);
  assert.match(joined, /first_participated_at/);
  assert.match(styles, /\.network-card__joined\s*\{/);

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

  assert.match(
    styles,
    /\.network-card__footer\s*\{[^}]*flex-direction:\s*column/s,
  );
  assert.match(
    styles,
    /\.network-card__domain\s*\{[^}]*margin-inline-start:\s*0/s,
  );
  assert.match(styles, /\.network-card__domain\s*\{[^}]*text-align:\s*start/s);
  assert.doesNotMatch(
    styles,
    /\.network-card__domain\s*\{[^}]*margin-inline-start:\s*auto/s,
  );
  assert.match(
    styles,
    /\.network-card__joined\s*\{[^}]*margin-inline-start:\s*0/s,
  );
  assert.doesNotMatch(
    styles,
    /\.network-card__joined\s*\{[^}]*margin-inline-start:\s*auto/s,
  );
  assert.match(styles, /\.network-card__feed(?:,|\s*\{)/);
  assert.match(styles, /\.network-card__actions\s*\{[^}]*display:\s*grid/s);
  assert.match(
    styles,
    /\.network-card__elsewhere\s*\{[^}]*display:\s*contents/s,
  );
  assert.match(network, /"url": "https:\/\/artlung\.com\/feed\/"/);
});

test("network cards expose elsewhere icons outside the origin link", async () => {
  const page = await read("network.md");
  const styles = [
    await read("assets/css/main.css"),
    await read("assets/css/elsewhere-glyphs.css"),
  ].join("\n");
  const sprite = await read("assets/icons/elsewhere-sprite.svg");
  const network = await read("_data/network.json");

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
  assert.match(network, /"network": "github"/);
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
