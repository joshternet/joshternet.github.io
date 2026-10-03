/**
 * Goal: Connections page, nav, and data contract stay wired for #45.
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

test("connections page is HTML-first and cross-linked", async () => {
  const page = await read("connections.md");
  const wander = await read("wander.md");
  const nav = await read("_includes/site-nav-links.html");
  const script = await read("assets/js/connections.js");
  const data = await read("connections-data.json");
  const styles = await read("assets/css/main.css");

  assert.match(page, /permalink: \/connections\//);
  assert.match(page, /script: \/assets\/js\/connections\.js/);
  assert.match(page, /Connects to/);
  assert.match(page, /outbound > 0 or inbound > 0 or overlap_count > 0/);
  assert.match(page, /Shared topics/);
  assert.match(page, /topic_overlaps/);
  assert.match(page, /site\.data\.connection_topics/);
  assert.match(page, /connections-graph__footer/);
  assert.match(page, /connections-graph__filters/);
  assert.match(page, /data-connections-key/);
  assert.match(page, /Show on the graph/);
  assert.match(page, /Line key/);
  assert.doesNotMatch(page, /data-connections-key[\s\S]*<input/);
  assert.doesNotMatch(page, /Select a site or a link/);
  assert.match(page, /connections-topic-list/);
  assert.match(page, /connections-topic__disclosure/);
  assert.match(page, /connections-site__column--topics/);
  assert.match(page, /overlap_count == 1/);
  assert.doesNotMatch(page, /Topic:/);
  assert.doesNotMatch(page, /connections-topic__posts/);
  assert.match(styles, /\.connections-key__list \{[^}]*display:\s*flex/);
  assert.match(page, /data-connections-viewport/);
  assert.match(page, /data-connections-map-reset/);
  assert.match(page, /Center Joshternet/);
  assert.match(
    styles,
    /\.connections-graph__viewport \{[^}]*overflow:\s*hidden/,
  );
  assert.match(script, /centerHub/);
  assert.match(script, /originIsHub/);
  assert.match(
    styles,
    /\.connections-bubble__title::before \{[^}]*content:\s*none/,
  );
  assert.match(styles, /\.connections-bubble__body \{[^}]*display:\s*flex/);
  assert.match(
    styles,
    /\.connections-bubble__close \{[^}]*position:\s*absolute/,
  );
  assert.match(styles, /\.connections-bubble \{[^}]*overflow:\s*visible/);
  assert.doesNotMatch(styles, /\.connections-bubble \{[^}]*overflow:\s*auto/);
  assert.match(styles, /\.connections-bubble__list > li \{[^}]*margin:\s*0/);
  assert.match(page, /ordered_sites/);
  assert.match(page, /https:\/\/joshternet\.org/);
  assert.match(styles, /connections-swatch/);
  assert.doesNotMatch(
    styles,
    /@media \(min-width: 64rem\) \{\s*\.connections-shell \{/,
  );
  assert.match(page, /type: CollectionPage/);
  assert.match(page, /connections-site h-card/);
  assert.match(page, /connections-site__identity/);
  assert.match(page, /data-connection-keys/);
  assert.match(page, /width="576"/);
  assert.match(page, /connections-visible-rel/);
  assert.doesNotMatch(page, /rel=\{\{ edge\.rel/);
  assert.match(page, /Connected from/);
  assert.match(page, /site\.data\.connections/);
  assert.match(page, /id="connections-bootstrap"/);
  assert.match(page, /Connections from around the Joshternet/);
  assert.match(page, /connections-howto/);
  assert.match(page, /Observed links/);
  assert.match(page, /verified\s+Webmention/);
  assert.match(page, /not stored as a\s+directed link/);
  assert.doesNotMatch(page, /80 feed/);
  assert.doesNotMatch(page, /Heuristics never become/);
  assert.doesNotMatch(page, /Josh identity stays declared/);
  assert.match(page, /\/implement\/connections\//);
  assert.match(page, /\/data\//);
  assert.match(styles, /\.connections-howto__kinds \{[^}]*display:\s*grid/);
  assert.doesNotMatch(page, /friendship, endorsement/);
  assert.match(page, /\/network\//);
  assert.match(
    styles,
    /:not\(pre\) > code[\s\S]*?overflow-wrap:\s*normal;[\s\S]*?white-space:\s*nowrap;/,
  );
  assert.match(wander, /\/connections\//);
  assert.doesNotMatch(wander, /wander-modes/);
  assert.doesNotMatch(wander, /How should curiosity move/);
  assert.doesNotMatch(wander, /data-wander-mode/);
  assert.match(styles, /\.page--wander\.site-shell \{[^}]*overflow:\s*visible/);
  assert.match(styles, /\.page--wander \.site-main \{[^}]*overflow:\s*hidden/);
  assert.match(
    styles,
    /@media \(min-width: 40rem\) \{\s*\.page--wander \.site-main \{[^}]*padding-block-start:/,
  );
  assert.match(
    styles,
    /\.wander-bar \{[^}]*border-block-start:\s*1px solid var\(--color-border\)/,
  );
  assert.doesNotMatch(styles, /\.wander-modes \{/);
  assert.match(nav, /site-nav-network-children\.html/);
  assert.match(script, /validatePayload/);
  assert.match(script, /canonicalOrigin/);
  assert.match(script, /connectionRelation/);
  assert.match(script, /homepage-link|content-link/);
  assert.match(script, /shared-topic/);
  assert.match(script, /validateTopicOverlap/);
  assert.doesNotMatch(script, /most connected|PageRank|influencer/i);
  assert.match(data, /permalink: \/connections\/data\.json/);
});

test("connection observations keep bridge fields without scores", async () => {
  const moduleSource = await read("scripts/network/connections.mjs");

  assert.match(moduleSource, /connectionObservations/);
  assert.match(moduleSource, /friendConnectionObservations/);
  assert.match(moduleSource, /topicConnectionObservations/);
  assert.match(moduleSource, /isParticipationDeclarationPath/);
  assert.match(moduleSource, /relation:/);
  assert.match(moduleSource, /via:/);
  assert.match(moduleSource, /href,/);
  assert.match(moduleSource, /text,/);
  assert.match(moduleSource, /rel,/);
  assert.match(moduleSource, /page:/);
  assert.doesNotMatch(moduleSource, /\bweight\s*:/);
  assert.doesNotMatch(moduleSource, /\bpagerank\b/i);
});
