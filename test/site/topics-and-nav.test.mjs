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
  assert.match(page, /site\.data\.topic_views/);
  assert.match(page, /activity-card/);
  assert.match(page, /topics-index/);
  assert.match(page, /occurrence_count/);
  assert.match(
    await read("assets/css/main.css"),
    /\.activity-list\.topics-index \{[^}]*grid-template-columns:\s*repeat\(auto-fill, minmax\(9\.25rem/,
  );
  assert.match(layout, /site\.data\.topic_views/);
  assert.match(layout, /\/topics\//);
  assert.match(layout, /topic-site/);
  assert.match(layout, /activity-card.html/);
  assert.match(layout, /articles.size > 0/);
  assert.doesNotMatch(layout, /Related discoveries/);
  assert.doesNotMatch(config, /^collections:/m);
  const topicStubs = (await readdir(path.join(root, "topics"))).filter(
    (file) => file.endsWith(".md") && file !== "index.md",
  );
  assert.ok(topicStubs.length > 0, "nlp:sync must write topics/*.md stubs");
  assert.match(
    await read(`topics/${topicStubs[0]}`),
    /permalink: \/topics\/[^/]+\//,
  );
  assert.match(layout, /h-feed/);
  assert.match(page, /type: CollectionPage/);
  assert.match(defaultLayout, /rel="webmention"/);
  assert.match(defaultLayout, /site\.webmention\.endpoint/);
});

test("built neighborhood pages exist for every topics stub", async () => {
  const stubs = (await readdir(path.join(root, "topics"))).filter(
    (file) => file.endsWith(".md") && file !== "index.md",
  );

  assert.ok(stubs.length > 0, "nlp:sync must write topics/*.md stubs");

  try {
    await access(path.join(root, "_site"));
  } catch {
    return;
  }

  for (const file of stubs) {
    const slug = file.slice(0, -".md".length);
    await access(path.join(root, "_site", "topics", slug, "index.html"));
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
  assert.match(
    networkNav,
    /title: What's New[\s\S]*title: Topics[\s\S]*title: Connections/,
  );
  assert.doesNotMatch(networkNav, /title: Nominate/);
  assert.match(await read("_data/joshbot_nav.yml"), /path: \/nominate\//);
  assert.doesNotMatch(networkNav, /path: \/explore\//);
  assert.match(networkNav, /path: \/connections\//);
  assert.match(networkNav, /path: \/topics\//);
  assert.doesNotMatch(networkNav, /^-\s*title:\s*Wander\s*$/m);
  assert.doesNotMatch(networkNav, /^-\s*title:\s*Search\s*$/m);

  const activity = await read("activity.md");
  const topics = await read("topics/index.md");
  const connections = await read("connections.md");
  const topicLayout = await read("_layouts/topic.html");
  const networkPage = await read("network.md");
  assert.doesNotMatch(activity, /connections-toolbar__lead/);
  assert.doesNotMatch(topics, /connections-toolbar__lead/);
  assert.doesNotMatch(connections, /connections-toolbar__actions/);
  assert.doesNotMatch(topicLayout, /Explore<\/a>/);
  assert.doesNotMatch(networkPage, /network-toolbar__secondary/);
  assert.match(aboutNav, /title: Community/);
  assert.match(aboutNav, /path: \/community\//);
  assert.match(aboutNav, /title: Governance/);
  assert.match(aboutNav, /path: \/governance\//);
  assert.match(aboutNav, /title: Privacy/);
  assert.match(aboutNav, /title: Security/);
  assert.match(aboutNav, /mailto:hello@joshternet\.org/);
  assert.match(networkChildren, /site\.data\.network_nav/);

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
