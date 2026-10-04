/**
 * Goal: What's New and Search routes stay HTML-first.
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

test("activity and search pages avoid popularity language", async () => {
  const activity = await read("activity.md");
  const card = await read("_includes/activity-card.html");
  const search = await read("search.md");

  assert.match(activity, /permalink: \/activity\//);
  assert.doesNotMatch(activity, /social feed/);
  assert.doesNotMatch(activity, /prolific publisher/);
  assert.doesNotMatch(activity, /One piece per site/);
  assert.match(activity, /include activity-card.html/);
  assert.match(card, /activity-card__heading/);
  assert.match(card, /activity-card__author/);
  assert.match(card, /p-author h-card/);
  assert.match(card, /p-category/);
  assert.match(activity, /h-feed/);
  assert.match(search, /h-feed/);
  assert.match(card, /activity-card__footer/);
  const titleAt = card.indexOf("activity-card__title");
  const authorAt = card.indexOf("activity-card__author");
  const summaryAt = card.indexOf("activity-card__summary");
  const topicsAt = card.indexOf("activity-card__topics");
  const domainAt = card.indexOf("activity-card__domain");
  assert.ok(titleAt > -1 && titleAt < authorAt);
  assert.ok(authorAt < summaryAt);
  assert.ok(summaryAt < topicsAt);
  assert.ok(topicsAt < domainAt);
  assert.doesNotMatch(activity, /By site/);
  assert.doesNotMatch(activity, /data-activity-filter/);
  assert.doesNotMatch(activity, /activity\.js/);
  assert.match(search, /permalink: \/search\//);
  assert.doesNotMatch(search, /does not boost sites/);
  assert.match(search, /data-search-input/);
  assert.match(await read("assets/js/search.js"), /activity-card__heading/);
  assert.match(search, /<noscript>/);
  assert.doesNotMatch(await read("implement/explore.md"), /topics\.json/);
  assert.doesNotMatch(await read("implement/explore.md"), /activity\.json/);

  for (const page of [activity, search]) {
    assert.doesNotMatch(page, /trending/i);
    assert.doesNotMatch(page, /most connected/i);
    assert.doesNotMatch(page, /PageRank/i);
    assert.doesNotMatch(page, /tfidf-v1/);
  }
});

test("search index is a compact Jekyll JSON page", async () => {
  const index = await read("search-index.json");
  assert.match(index, /permalink: \/search\/index\.json/);
  assert.match(index, /site\.data\.search_index/);
});

test("Explore hub page was never published", async () => {
  const nav = await read("_data/network_nav.yml");
  const index = await read("index.md");
  const layout = await read("_layouts/default.html");

  assert.doesNotMatch(nav, /path: \/explore\//);
  assert.doesNotMatch(index, /\/explore\//);
  assert.doesNotMatch(layout, /'\/explore\/'/);
  assert.doesNotMatch(layout, /page\.url == '\/explore\/'/);

  await assert.rejects(() => read("explore.md"));
  await assert.rejects(() => read("explore.html"));
});
