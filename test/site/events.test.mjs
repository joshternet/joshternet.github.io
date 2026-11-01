/**
 * Goal: Happening (/events/) stays unpublished until member events exist.
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

test("events page is unpublished until member events exist", async () => {
  const page = await read("events.md");
  assert.match(page, /^published:\s*false\b/m);
  assert.match(page, /permalink: \/events\//);
  assert.match(page, /Happening on the Joshternet/);
  assert.match(page, /include activity-card\.html item=item/);
  assert.doesNotMatch(page, /<iframe\b/i);
  assert.doesNotMatch(page, /autoplay/i);
  assert.match(page, /joshternet\.ics/);
  assert.match(page, /site\.data\.happening\.items/);
});

test("home happening strip omits when empty and uses activity-card", async () => {
  const home = await read("_includes/home-happening.html");
  assert.match(home, /home_happening\.size > 0/);
  assert.match(home, /include activity-card\.html item=item/);
  assert.doesNotMatch(home, /<li[\s\S]*include activity-card/);
  assert.match(home, /\/events\//);
});

test("activity-card renders event start/venue and site credit", async () => {
  const card = await read("_includes/activity-card.html");
  assert.match(card, /happening-date/);
  assert.match(card, /happening-venue/);
  assert.match(card, /include\.item\.site_title/);
  assert.match(card, /include\.item\.start/);
  assert.doesNotMatch(card, /autoplay/i);
  assert.doesNotMatch(card, /<iframe\b/i);
});

test("network nav omits Happening while events stay unpublished", async () => {
  const nav = await read("_data/network_nav.yml");
  assert.doesNotMatch(nav, /title: Happening/);
  assert.doesNotMatch(nav, /path: \/events\//);
});
