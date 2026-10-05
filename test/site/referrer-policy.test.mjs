/**
 * Goal: Hub outbound navigations send origin Referer plus HTTPS UTM params;
 * images/Wander previews keep no-referrer. Source-level contract.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Reads a UTF-8 file relative to the repository root.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<string>} File contents.
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

/**
 * Hub templates and scripts that emit outbound `<a target="_blank">` navigations.
 * @type {readonly string[]}
 */
const OUTBOUND_NAV_SOURCES = [
  "_layouts/default.html",
  "_layouts/topic.html",
  "_includes/activity-card.html",
  "_includes/site-nav-child-items.html",
  "network.md",
  "connections.md",
  "assets/js/search.js",
  "assets/js/connections.js",
  "assets/js/wander.js",
];

test("default layout sets strict-origin-when-cross-origin referrer policy", async () => {
  const layout = await read("_layouts/default.html");

  assert.match(
    layout,
    /<meta name="referrer" content="strict-origin-when-cross-origin">/,
  );
  assert.doesNotMatch(layout, /no-referrer-when-downgrade/);
});

test("hub outbound navigation builders omit noreferrer and keep noopener", async () => {
  for (const relativePath of OUTBOUND_NAV_SOURCES) {
    const source = await read(relativePath);

    assert.doesNotMatch(
      source,
      /rel="[^"]*noreferrer[^"]*"/,
      `${relativePath} must not set rel noreferrer on navigations`,
    );
    assert.doesNotMatch(
      source,
      /noopener,noreferrer/,
      `${relativePath} must not pass noreferrer to window.open`,
    );
    assert.match(
      source,
      /rel="(?:me )?noopener"/,
      `${relativePath} must keep noopener on outbound navigations`,
    );
  }
});

test("activity images and Wander iframes keep referrerpolicy no-referrer", async () => {
  const activityCard = await read("_includes/activity-card.html");
  const wander = await read("assets/js/wander.js");
  const search = await read("assets/js/search.js");

  assert.match(activityCard, /referrerpolicy="no-referrer"/);
  assert.match(wander, /referrerpolicy="no-referrer"/);
  assert.match(search, /referrerpolicy="no-referrer"/);
});

test("privacy discloses bidirectional referrers and UTM parameters", async () => {
  const privacy = await read("privacy.md");

  assert.match(privacy, /permalink: \/privacy\//);
  assert.match(privacy, /## Referrers and outbound links/);
  assert.match(privacy, /utm_source=joshternet\.org/);
  assert.match(privacy, /utm_medium=referral/);
  assert.match(privacy, /utm_campaign/);
  assert.match(privacy, /utm_content/);
  assert.match(privacy, /Referer/);
  assert.match(privacy, /strict-origin-when-cross-origin|hub origin/);
  assert.match(privacy, /rel="me"/);
  assert.match(privacy, /Wander/);
  assert.match(privacy, /Joshternet button/);
  assert.match(privacy, /\/\.well-known\/josh/);
  assert.match(privacy, /\/joshbot\//);
});

test("network cards and layout attach UTM params to outbound hrefs", async () => {
  const network = await read("network.md");
  const layout = await read("_layouts/default.html");
  const include = await read("_includes/outbound-href.html");

  assert.match(include, /utm_source=joshternet\.org/);
  assert.match(include, /outbound_scheme == 'https:\/\/'/);
  assert.match(layout, /rel="me noopener"/);
  assert.match(
    layout,
    /href="https:\/\/github\.com\/joshternet"[\s\S]*rel="me noopener"/,
  );
  assert.match(network, /include outbound-href\.html url=network_site\.origin/);
  assert.match(network, /include outbound-href\.html url=primary_feed\.url/);
  assert.match(network, /include outbound-href\.html url=elsewhere_link\.url/);
  assert.match(layout, /assets\/js\/outbound-referrer\.js/);
  assert.match(
    layout,
    /include outbound-href\.html url="https:\/\/web\.libera\.chat\/#joshternet"/,
  );
  assert.match(
    layout,
    /include outbound-href\.html url="https:\/\/github\.com\/joshternet"/,
  );
});
