/**
 * Goal: Uses page discovery eligibility and hub exclusion.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyRedirectScope,
  defaultUsesCandidates,
  discoverUsesPages,
  fetchUsesHtmlPages,
  isUsesPath,
  normalizeOrigin,
} from "../../scripts/uses/discover.mjs";
import { isHubOrigin } from "../../scripts/uses/constants.mjs";

test("isUsesPath accepts /uses variants", () => {
  assert.equal(isUsesPath("https://example.com/uses/"), true);
  assert.equal(isUsesPath("https://example.com/uses"), true);
  assert.equal(isUsesPath("https://example.com/uses.html"), true);
  assert.equal(isUsesPath("https://example.com/now/"), false);
});

test("hub origin never discovers uses pages", () => {
  assert.equal(isHubOrigin("https://joshternet.org"), true);
  assert.deepEqual(
    discoverUsesPages({
      origin: "https://joshternet.org",
      pages: [{ url: "https://joshternet.org/uses/", html: "<li>x</li>" }],
    }),
    [],
  );
});

test("discoverUsesPages prefers crawl hits and accepts nav", () => {
  const found = discoverUsesPages({
    origin: "https://example.com",
    pages: [{ url: "https://example.com/uses/" }],
    navLinks: [{ href: "/setup", text: "My setup" }],
  });
  assert.ok(found.some((f) => f.page_url.includes("/uses")));
  assert.ok(found.some((f) => f.discovery_method === "crawl"));
});

test("off-origin redirect is out_of_scope", () => {
  assert.equal(
    classifyRedirectScope("https://a.example", "https://b.example/uses/"),
    "out_of_scope",
  );
  assert.equal(
    classifyRedirectScope("https://a.example", "https://a.example/uses/"),
    "ok",
  );
});

test("defaultUsesCandidates and normalizeOrigin", () => {
  assert.equal(
    normalizeOrigin("https://Example.com/path"),
    "https://example.com",
  );
  assert.equal(defaultUsesCandidates("https://example.com").length, 3);
});

test("fetchUsesHtmlPages returns first successful Uses page", async () => {
  const calls = [];
  const pages = await fetchUsesHtmlPages("https://example.com", {
    fetchText: async (url) => {
      calls.push(url);
      const path = new URL(url).pathname;
      if (path === "/") {
        return {
          url: "https://example.com/",
          body: "<main><h1>Home</h1></main>",
          contentType: "text/html",
        };
      }
      if (url.endsWith("/uses/")) {
        throw new Error("HTTP 404");
      }
      return {
        url: "https://example.com/uses",
        body: "<ul><li>Neovim</li></ul>",
        contentType: "text/html",
      };
    },
  });

  assert.deepEqual(calls, [
    "https://example.com/",
    "https://example.com/uses/",
    "https://example.com/uses",
  ]);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].url, "https://example.com/uses");
  assert.equal(pages[0].html.includes("Neovim"), true);
});

test("fetchUsesHtmlPages rejects a uses URL that repeats the homepage", async () => {
  const home =
    "<main><h1>Home</h1><ul><li><a href='/cv'>/cv</a></li></ul></main>";
  const pages = await fetchUsesHtmlPages("https://example.com", {
    fetchText: async (url) => ({
      url,
      body: home,
      contentType: "text/html",
    }),
  });

  assert.equal(pages.length, 1);
  assert.equal(pages[0].outcome, "out_of_scope");
  assert.equal(pages[0].html, "");
});
