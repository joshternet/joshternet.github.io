/**
 * Goal: Offline coverage for scripts/nlp/directory.mjs.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DIRECTORY_ORIGIN,
  accumulateListedOrigins,
  advertisedFeeds,
  directoryPageUrls,
  flagValue,
  isJoshDirectoryHost,
  mulberry32,
  originsFromDirectoryHtml,
  shuffle,
} from "../../scripts/nlp/directory.mjs";

test("isJoshDirectoryHost: directory hosts vs members", () => {
  assert.equal(isJoshDirectoryHost(""), false);
  assert.equal(isJoshDirectoryHost("joshing.you"), true);
  assert.equal(isJoshDirectoryHost("WWW.JOSHING.YOU"), true);
  assert.equal(isJoshDirectoryHost("joshbeckman.org"), false);
});

test("directoryPageUrls: index, both later-page forms, and non-numeric fallback", () => {
  assert.deepEqual(directoryPageUrls(0), [`${DIRECTORY_ORIGIN}/`]);
  assert.deepEqual(directoryPageUrls(1), [`${DIRECTORY_ORIGIN}/`]);
  assert.deepEqual(directoryPageUrls(2), [
    `${DIRECTORY_ORIGIN}/?page=2`,
    `${DIRECTORY_ORIGIN}/page/2`,
  ]);
  assert.deepEqual(directoryPageUrls("no"), [`${DIRECTORY_ORIGIN}/`]);
});

test("flagValue: missing flag, missing value, present value", () => {
  assert.equal(flagValue([], "--limit", "100"), "100");
  assert.equal(flagValue(["--limit"], "--limit", "100"), "100");
  assert.equal(flagValue(["--limit", "5"], "--limit", "100"), "5");
});

test("shuffle: empty, one, and many items stay a permutation", () => {
  const random = mulberry32(1);
  assert.deepEqual(shuffle(null, random), []);
  assert.deepEqual(shuffle(["only"], random), ["only"]);
  const shuffled = shuffle(["a", "b", "c", "d"], mulberry32(7));
  assert.equal(shuffled.length, 4);
  assert.deepEqual([...shuffled].sort(), ["a", "b", "c", "d"]);
});

test("originsFromDirectoryHtml: skips directory, mailto, credentials, and dups", () => {
  const html = `
    <a href="https://joshing.you/about">dir</a>
    <a href="/page/2">next</a>
    <a href="mailto:josh@example.com">mail</a>
    <a href="https://user:pass@evil.example/">creds</a>
    <a href="https://joshbeckman.org/blog">one</a>
    <a href="https://joshbeckman.org/">dup</a>
    <a href="http://joshreads.com">two</a>
    <a href="not a url">bad</a>
  `;
  const origins = originsFromDirectoryHtml(html, DIRECTORY_ORIGIN);
  assert.deepEqual(origins, [
    "https://joshbeckman.org",
    "http://joshreads.com",
  ]);
});

test("originsFromDirectoryHtml: empty base uses directory origin", () => {
  const html = `<a href="https://josh.works/">works</a>`;
  assert.deepEqual(originsFromDirectoryHtml(html, ""), ["https://josh.works"]);
  assert.deepEqual(originsFromDirectoryHtml(html, null), [
    "https://josh.works",
  ]);
});

test("accumulateListedOrigins: counts only new member origins", () => {
  const html = `
    <a href="https://joshbeckman.org/">one</a>
    <a href="https://joshreads.com">two</a>
  `;
  const first = accumulateListedOrigins([], html, DIRECTORY_ORIGIN);
  assert.equal(first.added, 2);
  const second = accumulateListedOrigins(first.origins, html, DIRECTORY_ORIGIN);
  assert.equal(second.added, 0);
  assert.equal(second.origins.length, 2);
  const fromNull = accumulateListedOrigins(null, html, DIRECTORY_ORIGIN);
  assert.equal(fromNull.added, 2);
});

test("advertisedFeeds: alternate, extension, /feed, types, dups, bad hrefs", () => {
  const html = `
    <a rel="alternate" href="/rss.xml">rss</a>
    <a rel="alternate" type="application/atom+xml" href="https://a.example/atom.xml">atom</a>
    <a href="/feed">feed path</a>
    <a rel="alternate" href="/rss.xml">dup</a>
    <a href="https://a.example/index.json">json</a>
    <a href="http://[">broken</a>
    <a href="/about">not a feed</a>
  `;
  const feeds = advertisedFeeds(html, "https://a.example");
  assert.equal(feeds.length, 2);
  assert.equal(feeds[0].type, "rss");
  assert.ok(feeds[0].url.includes("rss.xml"));
});

test("advertisedFeeds: skips invalid absolute hrefs and non-string origin", () => {
  const html = `
    <a rel="alternate" href="https://">broken</a>
    <a rel="alternate" href="https://ok.example/feed.xml">ok</a>
  `;
  const feeds = advertisedFeeds(html, null);
  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].url, "https://ok.example/feed.xml");
});

test("advertisedFeeds: json vs atom vs rss types and empty origin fallback", () => {
  const json = advertisedFeeds(`<a href="/index.json">json</a>`, "");
  assert.equal(json[0].type, "json");
  const atom = advertisedFeeds(
    `<a rel="alternate atom" href="https://b.example/x.xml">a</a>`,
    "https://b.example",
  );
  assert.equal(atom[0].type, "atom");
  const rss = advertisedFeeds(
    `<a href="/podcast.xml">xml</a>`,
    "https://b.example",
  );
  assert.equal(rss[0].type, "rss");
});
