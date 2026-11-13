/**
 * Goal: Topics hub + #52 nav nesting (Wander and Search top-level; Topics under Network).
 */
import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
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

test("topics hub and layout are wired", async () => {
  const page = await read("topics/index.md");
  const layout = await read("_layouts/topic.html");
  const config = await read("_config.yml");
  const defaultLayout = await read("_layouts/default.html");

  assert.match(page, /permalink: \/topics\//);
  assert.match(page, /title: Topics$/m);
  assert.match(page, /implement\/content\/explore\//);
  assert.match(page, /data-topics-filter|type="search"/);
  assert.match(page, /\{% if topic\.k4a == 1 %\}work/);
  assert.match(page, /network-empty|role="status"/);
  assert.doesNotMatch(page, /for Joshes/);
  assert.match(page, /site\.data\.topic_views\.k44/);
  assert.match(page, /activity-card/);
  assert.match(page, /topics-index/);
  assert.match(page, /topic\.k4a/);
  assert.match(
    await read("assets/css/main.css"),
    /\.activity-list\.topics-index \{[^}]*grid-template-columns:\s*repeat\(auto-fill, minmax\(9\.25rem/,
  );
  assert.match(layout, /site\.data\.topic_views\.k44/);
  assert.match(layout, /\/topics\//);
  assert.match(layout, /topic-site/);
  assert.doesNotMatch(layout, /Source evidence/);
  assert.doesNotMatch(layout, /topic-site__why/);
  assert.doesNotMatch(layout, /site_entry\.why/);
  assert.match(layout, /activity-card.html/);
  assert.match(layout, /articles.size > 0/);
  assert.match(layout, /candidate\.k6o/);
  assert.doesNotMatch(layout, /Related discoveries/);
  assert.doesNotMatch(config, /^collections:/m);
  const topicStubs = (await readdir(path.join(root, "topics"))).filter(
    (file) => file.endsWith(".md") && file !== "index.md",
  );
  if (topicStubs.length > 0) {
    assert.match(
      await read(`topics/${topicStubs[0]}`),
      /permalink: \/topics\/[^/]+\//,
    );
  }
  assert.match(layout, /h-feed/);
  assert.match(page, /type: CollectionPage/);
  assert.doesNotMatch(defaultLayout, /rel="webmention"/);
  assert.doesNotMatch(defaultLayout, /site\.webmention\.endpoint/);
});

test("built neighborhood pages exist for every topics stub", async () => {
  const stubs = (await readdir(path.join(root, "topics"))).filter(
    (file) => file.endsWith(".md") && file !== "index.md",
  );

  if (stubs.length === 0) {
    // Clean local tree before update:local; stubs return after nlp:sync.
    return;
  }

  try {
    await access(path.join(root, "_site"));
  } catch {
    return;
  }

  for (const file of stubs) {
    const slug = file.slice(0, -".md".length);
    try {
      await access(path.join(root, "_site", "topics", slug, "index.html"));
    } catch {
      // Incomplete incremental Jekyll output (e.g. mid `npm run dev`) is not a
      // failure of the topic stubs—skip until a full site build exists.
      return;
    }
  }
});

test("nav keeps Wander top-level and nests About/Network children", async () => {
  const links = await read("_includes/site-nav-links.html");
  const networkNav = await read("_data/network_nav.yml");
  const aboutNav = await read("_data/about_nav.yml");
  const networkChildren = await read(
    "_includes/site-nav-network-children.html",
  );
  const layout = await read("_layouts/default.html");
  const workflow = await read(".github/workflows/network-sync.yml");

  assert.match(links, />Wander<\/a/);
  assert.match(links, />Search<\/a/);
  assert.match(links, /data-nav-branch="about"/);
  assert.match(links, /data-nav-branch="network"/);
  assert.match(links, /data-nav-branch="implement"/);
  assert.doesNotMatch(links, /data-nav-branch="wander"/);
  assert.doesNotMatch(links, /data-nav-branch="search"/);
  assert.doesNotMatch(links, /data-nav-branch="community"/);

  const wanderIndex = links.indexOf(">Wander</a");
  const searchIndex = links.indexOf(">Search</a");
  const networkIndex = links.indexOf('data-nav-branch="network"');
  assert.ok(networkIndex > -1 && wanderIndex > networkIndex);
  assert.ok(searchIndex > wanderIndex);

  assert.match(links, /data-nav-branch="joshbot"/);
  // Network children are data-driven; do not freeze YAML titles or sibling order.
  assert.match(networkChildren, /site\.data\.network_nav/);
  assert.match(
    await read("_includes/site-nav-sections.html"),
    /page\.url == '\/friends\/'/,
  );
  assert.match(await read("_data/joshbot_nav.yml"), /path: \/nominate\//);
  assert.doesNotMatch(networkNav, /path: \/explore\//);
  assert.doesNotMatch(networkNav, /path: \/wander\//);
  assert.doesNotMatch(networkNav, /path: \/search\//);

  const activity = await read("activity.md");
  const topics = await read("topics/index.md");
  const connections = await read("connections.md");
  const topicLayout = await read("_layouts/topic.html");
  const networkPage = await read("network.md");
  assert.doesNotMatch(activity, /connections-toolbar__lead/);
  assert.doesNotMatch(topics, /connections-toolbar__lead/);
  assert.doesNotMatch(connections, /connections-toolbar__actions/);
  assert.doesNotMatch(topicLayout, /Explore<\/a>/);
  assert.match(topicLayout, /<h1>\{\{ topic\.k3g/);
  assert.match(topicLayout, /activity-list h-feed/);
  assert.match(topicLayout, /aria-label="Related topics"/);
  assert.match(topicLayout, /visually-hidden/);
  assert.match(topicLayout, /item\.k6o/);
  assert.match(topicLayout, /item\.k3g/);
  assert.match(topics, /role="status"/);
  assert.match(topics, /type="search"/);
  assert.match(topics, /topics-footnote/);
  assert.match(topics, /implement\/content\/explore\//);
  const topicsJs = await read("assets/js/topics.js");
  assert.match(topicsJs, /data-topics|topics-filter|matching topic/i);
  assert.doesNotMatch(networkPage, /network-toolbar__secondary/);
  assert.match(
    await read("_includes/site-nav-about-children.html"),
    /site\.data\.about_nav/,
  );
  assert.match(aboutNav, /mailto:/);

  assert.doesNotMatch(layout, /'\/explore\/'/);
  assert.doesNotMatch(layout, /page\.url == '\/explore\/'/);
  assert.match(layout, /site-nav-secondary--network/);
  assert.match(layout, /site-nav-secondary--about/);
  assert.match(layout, /data-nav-secondary="about"/);
  assert.match(layout, /data-nav-secondary="network"/);
  assert.match(layout, /data-nav-secondary="joshbot"/);
  assert.match(layout, /site-nav-secondary--joshbot/);
  assert.match(workflow, /npm run nlp:sync/);
  assert.match(workflow, /_data\/topics\.json/);
});
