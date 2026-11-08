/**
 * Goal: Homepage discovery structure, data hooks, and join paths stay intact
 * without locking visitor-facing marketing prose.
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

test("homepage front matter keeps description and avoids explore", async () => {
  const index = await read("index.md");

  assert.match(index, /^description:/m);
  assert.doesNotMatch(index, /\/explore\//);
});

test("homepage links Wander, Network, activity, and join paths", async () => {
  const index = await read("index.md");
  const activity = await read("_includes/home-recent-activity.html");
  const meet = await read("_includes/home-meet-sites.html");

  assert.match(index, /\/wander\//);
  assert.match(meet, /\/network\//);
  assert.match(index, /\/join\//);
  assert.match(index, /\/about\//);
  assert.match(activity, /\/activity\//);
  assert.match(index, /\/specs\//);
  assert.match(index, /\/governance\//);
  assert.match(index, /home-cta__primary/);
  assert.match(index, /home-cta__secondary/);
  assert.match(
    index,
    /class="home-cta__primary" href="\{\{ '\/join\/' \| relative_url \}\}"/,
  );
  assert.match(
    index,
    /class="home-cta__secondary" href="\{\{ '\/wander\/' \| relative_url \}\}"/,
  );
});

test("homepage meet and activity includes use generated datasets", async () => {
  const index = await read("index.md");
  const meet = await read("_includes/home-meet-sites.html");
  const arrivals = await read("_includes/home-new-arrivals.html");
  const eligible = await read("_includes/home-welcome-eligible.html");
  const activity = await read("_includes/home-recent-activity.html");
  const card = await read("_includes/activity-card.html");
  const meetScript = await read("assets/js/home-meet.js");
  const css = await read("assets/css/main.css");

  assert.match(index, /include home-new-arrivals\.html/);
  assert.match(index, /include home-meet-sites\.html/);
  assert.match(index, /include home-recent-activity\.html/);
  assert.match(index, /include home-connections\.html/);
  assert.match(index, /scripts:/);
  assert.doesNotMatch(index, /\/assets\/js\/home-new-arrivals\.js/);
  assert.match(index, /\/assets\/js\/home-meet\.js/);
  assert.match(index, /\/assets\/js\/connections\.js/);
  assert.doesNotMatch(index, /prose-emphasis/);
  assert.doesNotMatch(index, /^script:/m);
  assert.doesNotMatch(index, /"josh":\s*true/);
  assert.match(eligible, /site\.data\.network/);
  assert.match(eligible, new RegExp(CRAWL_KEYS.first_participated_at));
  assert.match(eligible, /home_arrival_cutoff_s/);
  assert.match(eligible, /slice: 0, 3/);
  assert.match(arrivals, /include home-welcome-eligible\.html/);
  assert.match(arrivals, /data-home-new-arrivals/);
  assert.match(arrivals, /include network-card-joined\.html/);
  assert.match(arrivals, /network-card-a11y\.html/);
  assert.match(arrivals, /home-new-arrivals__meta/);
  assert.match(arrivals, /outbound-href\.html/);
  assert.doesNotMatch(arrivals, /data-featured-domains/);
  assert.doesNotMatch(arrivals, /<\w[^>]*\shidden[\s>=]/);
  assert.doesNotMatch(arrivals, /data-home-new-arrivals-ready/);
  assert.doesNotMatch(arrivals, /<noscript>/);
  assert.doesNotMatch(arrivals, /assets\/js\/home-new-arrivals/);
  assert.match(css, /\.home-new-arrivals\s*\{/);
  assert.match(
    css,
    /\.network-card__footer\.home-new-arrivals__meta\s*\{[^}]*flex-direction:\s*column/s,
  );
  assert.match(meet, /include home-welcome-eligible\.html/);
  assert.match(meet, /meet_is_welcome/);
  assert.match(meet, /site\.data\.network/);
  assert.match(meet, /sort: ["']domain["']/);
  assert.match(meet, /https:\/\/joshternet\.org/);
  assert.match(meet, /home_hub_origin/);
  assert.match(meet, /network_site\.k4b != home_hub_origin/);
  assert.match(meet, /home_network_count = site\.data\.network \| size/);
  assert.doesNotMatch(meet, /limit: 3/);
  assert.match(meet, /data-home-meet-grid/);
  assert.match(meet, /outbound-href\.html/);
  assert.match(meet, /home-meet__empty/);
  assert.match(meet, /network-card__fallback/);
  assert.match(meetScript, /Math\.random/);
  assert.match(meetScript, /PREVIEW_COUNT = 3/);
  assert.match(meetScript, /data-home-meet-card/);
  assert.doesNotMatch(meetScript, /featuredWelcomeDomains|featuredDomains/);
  assert.match(
    css,
    /\.home-meet__grid:not\(\[data-home-meet-ready\]\)[\s\S]*nth-child\(n \+ 4\)/,
  );
  assert.match(activity, /site\.data\.activity\.k54/);
  assert.match(activity, /limit: 3/);
  assert.match(activity, /activity-card\.html/);
  assert.match(activity, /heading_tag="h3"/);
  assert.match(activity, /home-activity__empty/);
  assert.match(activity, /\/activity\//);
  assert.match(card, /heading_tag == ['"]h3['']/);
});

test("homepage join teaser points at guided join without duplicating declarations", async () => {
  const index = await read("index.md");
  const join = await read("join.md");

  assert.match(index, /\/\.well-known\/josh/);
  assert.match(index, /\/join\//);
  assert.doesNotMatch(index, /home-join__option/);
  assert.match(join, /"josh": true/);
  assert.match(join, /"josh": false/);
  assert.match(join, /\{\s*"version": 1\s*\}/);
});

test("homepage styles scope discovery components and honor reduced motion", async () => {
  const css = await read("assets/css/main.css");

  assert.match(css, /\.home-tagline\s*\{/);
  assert.match(css, /\.home-invite\s*\{/);
  assert.match(css, /\.home-cta\s*\{/);
  assert.match(css, /\.home-cta__primary\s*\{/);
  assert.match(css, /\.home-cta__secondary\s*\{/);
  assert.match(css, /\.join-steps\s*\{/);
  assert.match(css, /\.home-meet__grid\s*\{/);
  assert.match(css, /\.home-activity__list\s*\{/);
  assert.match(css, /\.home-connections\s*\{/);
  assert.match(css, /\.home-connections[\s\S]*touch-action:\s*pan-y/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.home-cta__primary/s,
  );
  assert.match(
    css,
    /\.home-cta__primary:focus-visible,\s*\.home-cta__secondary:focus-visible/,
  );
});

test("homepage connections preview uses the same bootstrap datapoints as Connections", async () => {
  const index = await read("index.md");
  const include = await read("_includes/home-connections.html");
  const connections = await read("connections.md");
  const layout = await read("_layouts/default.html");
  const script = await read("assets/js/connections.js");

  assert.match(index, /include home-connections\.html/);
  assert.match(include, /data-connections-mode="preview"/);
  assert.match(include, /home-connections-bootstrap/);
  assert.match(include, /home_ordered_sites\.size > 0/);
  assert.match(include, /include connections-tally\.html/);
  assert.match(include, /include connections-line-key\.html surface="home"/);
  assert.match(include, /site\.data\.connections\.k1y/);
  assert.match(include, /site\.data\.connection_topics\.k4q/);
  assert.match(include, /site\.data\.connection_topics\.k6i/);
  assert.match(include, /"topic_groups"/);
  assert.match(include, /network_site\.k1n/);
  assert.match(include, /network_site\.k63/);
  assert.doesNotMatch(include, /network_dev/);
  assert.match(connections, /"topic_groups": \{\{ overlap_sites/);
  assert.match(include, /\/connections\//);
  assert.match(include, /<noscript>/);
  assert.match(include, /home-connections__empty/);
  assert.match(layout, /page\.scripts/);
  assert.match(script, /function initShell/);
  assert.match(script, /isPreview/);
  assert.match(script, /arrowMarkerId/);
  assert.match(script, /topicGroups/);
  assert.match(script, /data-connections-map-tools/);
  assert.doesNotMatch(script, /if \(!tools && !isPreview\)/);
});

test("connections line key stacks title above horizontal items", async () => {
  const css = await read("assets/css/main.css");

  assert.match(
    css,
    /:is\(ul, ol\)\[class\]:not\(\.list-stack\) > li \+ li\s*\{[^}]*margin-block-start:\s*0/s,
  );
  assert.match(css, /\.list-row\s*\{[^}]*align-items:\s*center/s);
  assert.match(
    css,
    /\.connections-graph__key\s*\{[^}]*flex-direction:\s*column/s,
  );
  assert.match(
    css,
    /\.connections-graph__key-title\s*\{[^}]*display:\s*block/s,
  );
});
