/**
 * Goal: Happening (/events/) is always built; Network nav appears when
 * upcoming events exist (past archive is JEKYLL_ENV=development only).
 * Page markup credits publishers via activity-card, omits embeds/autoplay,
 * and the homepage strip reuses the same card without nested list items.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

test("events page is published with empty-state markup", async () => {
  const page = await read("events.md");
  assert.match(page, /^published:\s*true\b/m);
  assert.match(page, /permalink: \/events\//);
  assert.match(page, /include activity-card\.html item=item/);
  assert.doesNotMatch(page, /<iframe\b/i);
  assert.doesNotMatch(page, /autoplay/i);
  assert.match(page, /joshternet\.ics/);
  assert.match(page, /site\.data\.happening\.k3a/);
  assert.match(page, /site\.data\.past_events\.k3a/);
  assert.match(page, /show_past_events/);
  assert.match(page, /jekyll\.environment == 'development'/);
  assert.match(page, /## Past events/);
  assert.match(page, /past_group_by_year/);
});

test("network nav shows Happening for upcoming; past only in development", async () => {
  const nav = await read("_includes/site-nav-network-children.html");
  assert.match(nav, /happening_count/);
  assert.match(nav, /past_count/);
  assert.match(nav, /events_nav_count/);
  assert.match(nav, /site\.data\.happening\.k38|site\.data\.happening\.k3a/);
  assert.match(nav, /jekyll\.environment == 'development'/);
  assert.match(
    nav,
    /site\.data\.past_events\.k38|site\.data\.past_events\.k3a/,
  );
  assert.match(nav, /\/events\//);
  assert.match(nav, />Happening</);
});

test("home happening strip omits when empty and uses activity-card", async () => {
  const home = await read("_includes/home-happening.html");
  assert.match(home, /home_happening\.size > 0/);
  assert.match(home, /include activity-card\.html item=item/);
  assert.doesNotMatch(home, /<li[\s\S]*include activity-card/);
  assert.match(home, /\/events\//);
});

test("activity-card renders event start/venue/conference and site credit", async () => {
  const card = await read("_includes/activity-card.html");
  assert.match(card, /happening-date/);
  assert.match(card, /happening-venue/);
  assert.match(card, /include\.item\.k6h/);
  assert.match(card, /include\.item\.k89/);
  assert.match(card, /include\.item\.k8f/);
  assert.doesNotMatch(card, /autoplay/i);
  assert.doesNotMatch(card, /<iframe\b/i);
});

test("network_nav.yml does not hardcode Happening (liquid-gated instead)", async () => {
  const nav = await read("_data/network_nav.yml");
  assert.doesNotMatch(nav, /title: Happening/);
  assert.doesNotMatch(nav, /path: \/events\//);
});
