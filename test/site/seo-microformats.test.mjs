/**
 * Goal: Exploration pages publish CollectionPage JSON-LD, jekyll-seo-tag
 * types, and IndieWeb microformats on lists and cards.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { topicCollectionMarkdown } from "../../scripts/nlp/communities.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("derived pages declare schema.org types and extra JSON-LD", async () => {
  const layout = await read("_layouts/default.html");
  const jsonld = await read("_includes/derived-jsonld.html");
  const topicLayout = await read("_layouts/topic.html");

  assert.match(layout, /include derived-jsonld.html/);
  assert.match(jsonld, /application\/ld\+json/);
  assert.match(jsonld, /page\.seo.type/);
  assert.match(jsonld, /\/#project/);
  assert.match(jsonld, /DefinedTerm/);
  assert.match(jsonld, /page.robots == 'noindex'/);
  assert.doesNotMatch(jsonld, /page.url == '\/search\/'/);
  assert.match(topicLayout, /class="h-feed"/);
  assert.match(topicLayout, /class="p-name"/);
  assert.match(topicLayout, /topic-site h-card/);

  assert.match(await read("connections.md"), /type: CollectionPage/);
  assert.match(await read("topics/index.md"), /type: CollectionPage/);
  assert.match(await read("activity.md"), /type: CollectionPage/);
  assert.match(await read("network.md"), /type: CollectionPage/);
  assert.match(await read("search.md"), /robots: noindex/);
  assert.match(await read("search.md"), /sitemap: false/);
  assert.match(await read("_layouts/default.html"), /page\.robots/);
  assert.match(await read("implement/connections.md"), /type: TechArticle/);
});

test("lists and cards expose h-feed, h-entry, and h-card", async () => {
  const card = await read("_includes/activity-card.html");
  const activity = await read("activity.md");
  const search = await read("search.md");
  const topics = await read("topics/index.md");
  const connections = await read("connections.md");
  const network = await read("network.md");
  const searchJs = await read("assets/js/search.js");

  assert.match(card, /h-entry/);
  assert.match(card, /p-author h-card/);
  assert.match(card, /p-category/);
  assert.match(card, /u-photo/);
  assert.match(activity, /activity-list h-feed/);
  assert.match(search, /activity-list h-feed/);
  assert.match(topics, /activity-list topics-index h-feed/);
  assert.match(topics, /activity-card h-entry/);
  assert.match(connections, /connections-site h-card/);
  assert.match(connections, /u-photo/);
  assert.match(connections, /p-note/);
  assert.match(network, /h-card/);
  assert.match(network, /p-name/);
  assert.match(searchJs, /p-author h-card/);
  assert.match(searchJs, /p-category/);
  assert.match(searchJs, /u-photo/);
});

test("topic stubs include descriptions and CollectionPage SEO", () => {
  const markdown = topicCollectionMarkdown({ slug: "ai", label: "ai" });
  const title = markdown.match(/title: "([^"]+)"/)?.[1] || "";
  const description = markdown.match(/description: "([^"]+)"/)?.[1] || "";
  const keywords = markdown.match(/keywords: "([^"]+)"/)?.[1] || "";

  assert.match(markdown, /type: CollectionPage/);
  assert.match(markdown, /permalink: \/topics\/ai\//);
  assert.match(markdown, /name: "AI"/);
  assert.match(title, /AI articles from Joshternet websites/);
  assert.ok(title.length >= 30 && title.length <= 60);
  assert.ok(description.length >= 120 && description.length <= 170);
  assert.match(keywords, /AI,/);
  assert.match(keywords, /Joshternet/);
  assert.doesNotMatch(description, /ai from around the Joshternet/i);
});

test("layout emits keywords and avoids duplicate Joshternet in titles", async () => {
  const layout = await read("_layouts/default.html");
  assert.match(layout, /meta name="keywords"/);
  assert.match(layout, /page\.title contains site\.title/);
  assert.match(await read("_config.yml"), /^keywords:/m);
  assert.match(await read("activity.md"), /keywords:/);
  assert.match(await read("index.md"), /description:/);
});
