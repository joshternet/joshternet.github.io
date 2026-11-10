/**
 * Goal: Network cards expose feed and elsewhere controls outside the origin link.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CRAWL_KEYS,
  decodeCrawlValue,
} from "../../scripts/nlp/site-record.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

/**
 * Reads a generated crawl dataset when present.
 * @param {string} relativePath
 * @returns {Promise<string | null>}
 */
async function readGenerated(relativePath) {
  try {
    return await read(relativePath);
  } catch (error) {
    // External boundary: generated crawl files are absent after a clean wipe.
    if (
      error &&
      /** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

test("network cards link the primary feed outside the origin card link", async () => {
  const page = await read("network.md");
  const card = await read("_includes/network-participant-card.html");
  const styles = [
    await read("assets/css/main.css"),
    await read("assets/css/elsewhere-glyphs.css"),
  ].join("\n");
  const network = await readGenerated("_data/network.json");

  assert.match(page, /include network-participant-card\.html/);
  assert.match(styles, /\.network-card\[hidden\]\s*\{[^}]*display:\s*none/s);
  assert.match(
    card,
    new RegExp(
      `network-card--\\{\\{ network_site\\.${CRAWL_KEYS.identity} \\}\\} h-card`,
    ),
  );
  assert.match(card, new RegExp(`network_site\\.${CRAWL_KEYS.feeds}`));
  assert.match(card, /network-card__feed/);
  assert.match(card, /network-card__actions/);
  assert.match(card, /network-card__footer/);
  assert.match(card, /include network-card-joined\.html/);
  assert.match(card, /include network-card-a11y\.html/);
  assert.doesNotMatch(page, /site\.data\.site_views/);
  assert.doesNotMatch(page, /recent_content/);
  assert.doesNotMatch(page, /network_dev/);
  assert.doesNotMatch(page, /network-dev-preview/);
  assert.doesNotMatch(card, /network_dev/);

  const a11y = await read("_includes/network-card-a11y.html");
  const joined = await read("_includes/network-card-joined.html");
  assert.match(a11y, /Participating website with affirmed Josh identity/);
  assert.match(a11y, /Participating website with declined Josh identity/);
  assert.match(a11y, /Participating website with undeclared Josh identity/);
  assert.doesNotMatch(a11y, /joshing the Joshes/);
  assert.match(joined, /Participating since/);
  assert.match(joined, new RegExp(CRAWL_KEYS.first_participated_at));
  assert.match(styles, /\.network-card__joined\s*\{/);

  const feedAt = card.indexOf('class="network-card__feed"');
  const linkCloseAt = card.indexOf(
    "</a>",
    card.indexOf('class="network-card__link"'),
  );
  const articleCloseAt = card.indexOf("</article>", feedAt);

  assert.ok(
    feedAt > linkCloseAt,
    "feed control must follow the origin link close",
  );
  assert.ok(feedAt < articleCloseAt, "feed control must stay inside the card");
  assert.doesNotMatch(
    card.slice(card.indexOf('class="network-card__link"'), linkCloseAt),
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
  if (network !== null) {
    const decoded = decodeCrawlValue(JSON.parse(network));
    assert.match(JSON.stringify(decoded), /https:\/\/artlung\.com\/feed\//);
  }
});

test("network cards expose elsewhere icons outside the origin link", async () => {
  const page = await read("network.md");
  const card = await read("_includes/network-participant-card.html");
  const styles = [
    await read("assets/css/main.css"),
    await read("assets/css/elsewhere-glyphs.css"),
  ].join("\n");
  const sprite = await read("assets/icons/elsewhere-sprite.svg");
  const network = await readGenerated("_data/network.json");

  assert.match(page, /include network-participant-card\.html/);
  assert.match(card, new RegExp(`network_site\\.${CRAWL_KEYS.elsewhere}`));
  assert.match(card, /network-card__elsewhere/);
  assert.match(card, /network-card__elsewhere-glyph--/);

  const elsewhereAt = card.indexOf('class="network-card__elsewhere"');
  const linkCloseAt = card.indexOf(
    "</a>",
    card.indexOf('class="network-card__link"'),
  );
  const articleCloseAt = card.indexOf("</article>", elsewhereAt);

  assert.ok(elsewhereAt > linkCloseAt, "elsewhere must follow origin link");
  assert.ok(elsewhereAt < articleCloseAt, "elsewhere must stay in the card");
  assert.doesNotMatch(
    card.slice(card.indexOf('class="network-card__link"'), linkCloseAt),
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
  if (network !== null) {
    const decoded = decodeCrawlValue(JSON.parse(network));
    assert.match(JSON.stringify(decoded), /"network"\s*:\s*"github"/);
  }
});

test("network page does not duplicate the blogroll subscribe copy", async () => {
  const page = await read("network.md");

  assert.doesNotMatch(page, /Joshternet blogroll/);
  assert.doesNotMatch(page, /Subscribe with the/);
});

test("network templates tolerate a missing network dataset", async () => {
  const page = await read("network.md");
  const connections = await read("connections.md");
  const homeConnections = await read("_includes/home-connections.html");
  const layout = await read("_layouts/default.html");

  for (const source of [page, connections, homeConnections, layout]) {
    assert.match(source, /== (?:nil|null)/);
    assert.match(source, /split:\s*['"]{2}/);
  }
  assert.match(page, /network_sites \| sort: 'k1v'/);
});

test("site head advertises the Joshternet blogroll on every page", async () => {
  const layout = await read("_layouts/default.html");

  assert.match(
    layout,
    /rel="blogroll"[\s\S]*?type="text\/xml"[\s\S]*?joshternet\.opml/,
  );
  assert.match(layout, /\/assets\/network\/joshternet\.opml/);
});
