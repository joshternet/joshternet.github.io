/**
 * Goal: /friends/ is a derived declined-only Network view with Friends nav,
 * Friend presentation hooks, empty state, and Network card semantics.
 *
 * Assert structure and Liquid contracts—not visitor-facing prose.
 *
 * Synthetic contract (not live registry membership):
 * - affirmed / undeclared must not be listed
 * - declined (k31) is the only identity rendered
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CRAWL_KEYS } from "../../scripts/nlp/site-record.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("friends page filters network data to declined identity only", async () => {
  const page = await read("friends.md");

  assert.match(page, /permalink: \/friends\//);
  assert.match(page, /^title: Friends of the Joshternet$/m);
  assert.match(page, /^# Friends of the Joshternet$/m);
  assert.match(
    page,
    new RegExp(
      `site\\.data\\.network \\| where: "${CRAWL_KEYS.identity}", "declined"`,
    ),
  );
  assert.match(page, new RegExp(`${CRAWL_KEYS.promoted} != false`));
  assert.doesNotMatch(page, /where: "k31", "affirmed"/);
  assert.doesNotMatch(page, /where: "k31", "undeclared"/);
  assert.doesNotMatch(page, /for network_site in site\.data\.network/);
  assert.doesNotMatch(page, /network_dev/);
  assert.doesNotMatch(page, /network-dev-preview/);
  assert.doesNotMatch(page, /script:/);
});

test("friends page renders participant cards with Friend presentation", async () => {
  const page = await read("friends.md");
  const card = await read("_includes/network-participant-card.html");
  const styles = await read("assets/css/main.css");

  assert.match(
    page,
    /include network-participant-card\.html friend_presentation=true/,
  );
  assert.match(card, /friend_presentation/);
  assert.match(card, /network-card__friend-label/);
  assert.match(card, /network-card__friend-label-primary/);
  assert.match(card, /network-card__friend-label-secondary/);
  assert.match(
    card,
    new RegExp(
      `network-card--\\{\\{ network_site\\.${CRAWL_KEYS.identity} \\}\\} h-card`,
    ),
  );
  assert.match(card, /class="network-card__title p-name"/);
  assert.match(card, /u-url/);
  assert.match(card, /u-photo/);
  assert.match(card, /p-note/);
  assert.match(card, new RegExp(`network_site\\.${CRAWL_KEYS.title}`));
  assert.match(card, new RegExp(`network_site\\.${CRAWL_KEYS.domain}`));
  assert.match(card, new RegExp(`network_site\\.${CRAWL_KEYS.origin}`));
  assert.match(card, new RegExp(`network_site\\.${CRAWL_KEYS.description}`));
  assert.match(card, new RegExp(`network_site\\.${CRAWL_KEYS.screenshot}`));
  assert.match(card, /network-card__fallback/);
  assert.match(card, new RegExp(`network_site\\.${CRAWL_KEYS.feeds}`));
  assert.match(card, new RegExp(`network_site\\.${CRAWL_KEYS.elsewhere}`));
  assert.match(card, /include network-card-joined\.html/);
  assert.match(card, /include network-card-a11y\.html/);
  assert.match(card, /\| escape/);
  assert.match(styles, /\.network-card__friend-label\s*\{/);
  assert.match(styles, /\.network-card__friend-label-primary\s*\{/);
  assert.match(styles, /\.network-card__friend-label-secondary\s*\{/);
});

test("friends page empty state and footnote stay wired", async () => {
  const page = await read("friends.md");

  assert.match(page, /network-empty/);
  assert.match(page, /friends\.size > 0/);
  assert.match(page, /network-footnote/);
  assert.match(page, /['"]\/join\/['"]/);
});

test("friends page accessibility and SEO conventions", async () => {
  const page = await read("friends.md");

  assert.equal([...page.matchAll(/^# /gm)].length, 1);
  assert.match(page, /type: CollectionPage/);
  assert.match(page, /name: Friends of the Joshternet/);
  assert.match(page, /robots: max-snippet:160, max-image-preview:large/);
  assert.match(page, /joshternet_analysis: derived/);
  assert.match(page, /^description:/m);
});

test("friends appears in Network secondary navigation", async () => {
  const networkNav = await read("_data/network_nav.yml");
  const networkChildren = await read(
    "_includes/site-nav-network-children.html",
  );
  const sections = await read("_includes/site-nav-sections.html");
  const networkPage = await read("network.md");

  // Structural wiring only — labels and sibling entries live in data.
  assert.match(networkChildren, /site\.data\.network_nav/);
  assert.match(networkNav, /path:\s*\/friends\//);
  assert.match(sections, /page\.url == '\/friends\/'/);
  assert.match(networkPage, /['"]\/friends\/['"]/);
});
