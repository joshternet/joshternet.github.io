/**
 * Goal: 100% line/branch/function coverage for scripts/nlp/webmentions.mjs.
 * All tests are offline — mock fetch only, never live network.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchMentionsForTargets,
  mentionConnections,
} from "../../scripts/nlp/webmentions.mjs";
import { dnsCache, install, restore } from "../helpers/mock-fetch.mjs";

// ─── sanitizeMention (indirectly via fetchMentionsForTargets) ─────────────────

/**
 * Helper to fetch mentions for a single target with a pre-configured response.
 * @param {object[]} children - JSON children array
 * @returns {Promise<object[]>}
 */
async function fetchWithChildren(children) {
  const target = "https://a.example/post";
  const cache = dnsCache(["webmention.io"]);
  install();
  try {
    // External HTTP boundary — real fetch replaced by mock stub
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      arrayBuffer: async () => Buffer.from(JSON.stringify({ children })),
    });
    const result = await fetchMentionsForTargets([target], cache);
    return result[target];
  } finally {
    restore();
  }
}

test("sanitizeMention: null entry is excluded", async () => {
  const mentions = await fetchWithChildren([null]);
  assert.equal(mentions.length, 0);
});

test("sanitizeMention: non-object entry is excluded", async () => {
  const mentions = await fetchWithChildren(["not-an-object", 42]);
  assert.equal(mentions.length, 0);
});

test("sanitizeMention: entry without url is excluded", async () => {
  const mentions = await fetchWithChildren([{ "wm-property": "mention-of" }]);
  assert.equal(mentions.length, 0);
});

test("sanitizeMention: ftp:// URL is excluded", async () => {
  const mentions = await fetchWithChildren([
    { url: "ftp://other.example/file", content: { text: "hi" } },
  ]);
  assert.equal(mentions.length, 0);
});

test("sanitizeMention: URL with credentials is excluded", async () => {
  const mentions = await fetchWithChildren([
    { url: "https://user:pass@other.example/page" },
  ]);
  assert.equal(mentions.length, 0);
});

test("sanitizeMention: participation declaration path is excluded", async () => {
  const mentions = await fetchWithChildren([
    { url: "https://other.example/.well-known/josh" },
  ]);
  assert.equal(mentions.length, 0);
});

test("sanitizeMention: invalid URL string is excluded", async () => {
  const mentions = await fetchWithChildren([{ url: "not a valid url" }]);
  assert.equal(mentions.length, 0);
});

test("sanitizeMention: valid https mention is included", async () => {
  const mentions = await fetchWithChildren([
    {
      url: "https://other.example/reply",
      published: "2026-01-01T00:00:00Z",
      "wm-property": "in-reply-to",
      author: { name: "Josh B", url: "https://other.example/" },
      content: { text: "Great post!" },
    },
  ]);
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].url, "https://other.example/reply");
  assert.equal(mentions[0].type, "entry");
  assert.equal(mentions[0]["wm-property"], "in-reply-to");
  assert.equal(mentions[0].author.name, "Josh B");
  assert.equal(mentions[0].content.text, "Great post!");
});

test("sanitizeMention: valid http mention is included", async () => {
  const mentions = await fetchWithChildren([
    {
      url: "http://legacy.example/reply",
      content: { text: "Nice" },
    },
  ]);
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].url, "http://legacy.example/reply");
});

test("sanitizeMention: author without url gets null url", async () => {
  const mentions = await fetchWithChildren([
    {
      url: "https://other.example/reply",
      author: { name: "Anonymous" },
      content: { text: "" },
    },
  ]);
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].author.url, "");
});

test("sanitizeMention: no author → null author", async () => {
  const mentions = await fetchWithChildren([
    { url: "https://other.example/reply", content: { text: "hi" } },
  ]);
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].author, null);
});

test("sanitizeMention: non-object author → null author", async () => {
  const mentions = await fetchWithChildren([
    {
      url: "https://other.example/reply",
      author: "not an object",
      content: { text: "hi" },
    },
  ]);
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].author, null);
});

test("sanitizeMention: published and wm-property are sliced to max length", async () => {
  const longString = "x".repeat(200);
  const mentions = await fetchWithChildren([
    {
      url: "https://other.example/reply",
      published: longString,
      "wm-property": longString,
      content: { text: "" },
    },
  ]);
  assert.equal(mentions.length, 1);
  assert.ok(mentions[0].published.length <= 64);
  assert.ok(mentions[0]["wm-property"].length <= 64);
});

// ─── fetchMentionsForTargets ──────────────────────────────────────────────────

test("fetchMentionsForTargets: non-string targets are skipped", async () => {
  const cache = dnsCache(["webmention.io"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      arrayBuffer: async () => Buffer.from(JSON.stringify({ children: [] })),
    });
    // null and empty string targets should be skipped
    const result = await fetchMentionsForTargets(
      [null, "", "https://a.example/p"],
      cache,
    );
    // Only the valid target should be in the result
    assert.ok(Object.hasOwn(result, "https://a.example/p"));
  } finally {
    restore();
  }
});

test("fetchMentionsForTargets: only first 40 targets processed", async () => {
  const targets = Array.from(
    { length: 50 },
    (_, i) => `https://a.example/post-${i}`,
  );
  const cache = dnsCache(["webmention.io"]);
  let fetchCount = 0;
  install();
  try {
    globalThis.fetch = async () => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        arrayBuffer: async () => Buffer.from(JSON.stringify({ children: [] })),
      };
    };
    await fetchMentionsForTargets(targets, cache);
    assert.equal(fetchCount, 40);
  } finally {
    restore();
  }
});

test("fetchMentionsForTargets: fetch error → empty array for target", async () => {
  const target = "https://a.example/post";
  const cache = dnsCache(["webmention.io"]);
  install();
  try {
    globalThis.fetch = async () => {
      throw new Error("network error");
    };
    const result = await fetchMentionsForTargets([target], cache);
    assert.deepEqual(result[target], []);
  } finally {
    restore();
  }
});

test("fetchMentionsForTargets: invalid JSON in response → empty array", async () => {
  const target = "https://a.example/post";
  const cache = dnsCache(["webmention.io"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      arrayBuffer: async () => Buffer.from("not-json"),
    });
    const result = await fetchMentionsForTargets([target], cache);
    assert.deepEqual(result[target], []);
  } finally {
    restore();
  }
});

// ─── mentionConnections ───────────────────────────────────────────────────────

test("mentionConnections: valid cross-participant mention creates edge", () => {
  const edges = mentionConnections(
    {
      "https://b.example/post": [
        { url: "https://a.example/reply", content: { text: "nice" } },
      ],
    },
    new Set(["https://a.example", "https://b.example"]),
  );
  assert.equal(edges.length, 1);
  assert.equal(edges[0].from, "https://a.example");
  assert.equal(edges[0].to, "https://b.example");
  assert.equal(edges[0].relation, "mention");
  assert.equal(edges[0].source, "webmention");
  assert.equal(edges[0].directed, true);
});

test("mentionConnections: self-mention (from === to) is excluded", () => {
  const edges = mentionConnections(
    {
      "https://a.example/post": [
        { url: "https://a.example/reply", content: { text: "" } },
      ],
    },
    new Set(["https://a.example"]),
  );
  assert.equal(edges.length, 0);
});

test("mentionConnections: outsider mention is excluded", () => {
  const edges = mentionConnections(
    {
      "https://b.example/post": [
        { url: "https://outsider.example/reply", content: { text: "" } },
      ],
    },
    new Set(["https://a.example", "https://b.example"]),
  );
  assert.equal(edges.length, 0);
});

test("mentionConnections: target with non-participant origin is excluded", () => {
  const edges = mentionConnections(
    {
      "https://outsider.example/post": [
        { url: "https://a.example/reply", content: { text: "" } },
      ],
    },
    new Set(["https://a.example", "https://b.example"]),
  );
  assert.equal(edges.length, 0);
});

test("mentionConnections: duplicate mention (same key) is deduplicated", () => {
  const edges = mentionConnections(
    {
      "https://b.example/post": [
        { url: "https://a.example/reply", content: { text: "once" } },
        { url: "https://a.example/reply", content: { text: "twice" } },
      ],
    },
    new Set(["https://a.example", "https://b.example"]),
  );
  assert.equal(edges.length, 1);
});

test("mentionConnections: mention without url is skipped", () => {
  const edges = mentionConnections(
    {
      "https://b.example/post": [{ content: { text: "no url" } }],
    },
    new Set(["https://a.example", "https://b.example"]),
  );
  assert.equal(edges.length, 0);
});

test("mentionConnections: invalid target origin → skipped", () => {
  const edges = mentionConnections(
    {
      "not-a-valid-url": [
        { url: "https://a.example/reply", content: { text: "" } },
      ],
    },
    new Set(["https://a.example"]),
  );
  assert.equal(edges.length, 0);
});

test("mentionConnections: invalid mention URL → skipped", () => {
  const edges = mentionConnections(
    {
      "https://b.example/post": [{ url: "not-a-url", content: { text: "" } }],
    },
    new Set(["https://a.example", "https://b.example"]),
  );
  assert.equal(edges.length, 0);
});

test("mentionConnections: empty or null mentionsByTarget → empty", () => {
  assert.deepEqual(mentionConnections({}, new Set(["https://a.example"])), []);
  assert.deepEqual(
    mentionConnections(null, new Set(["https://a.example"])),
    [],
  );
});

test("mentionConnections: content text is sliced to max 200 chars", () => {
  const longText = "x".repeat(300);
  const edges = mentionConnections(
    {
      "https://b.example/post": [
        {
          url: "https://a.example/reply",
          content: { text: longText },
        },
      ],
    },
    new Set(["https://a.example", "https://b.example"]),
  );
  assert.equal(edges.length, 1);
  assert.ok(edges[0].text.length <= 200);
});

test("mentionConnections: non-string content text → empty string", () => {
  const edges = mentionConnections(
    {
      "https://b.example/post": [
        {
          url: "https://a.example/reply",
          content: { text: null },
        },
      ],
    },
    new Set(["https://a.example", "https://b.example"]),
  );
  assert.equal(edges.length, 1);
  assert.equal(edges[0].text, "");
});

// ─── Additional branch coverage ───────────────────────────────────────────────

test("sanitizeMention: author with empty name fires name || '' (L46)", async () => {
  // entry.author.name = null → null || "" fires (L46 false branch)
  const mentions = await fetchWithChildren([
    {
      url: "https://other.example/reply",
      author: { name: null, url: "https://other.example/" },
      content: { text: "hello" },
    },
  ]);
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].author.name, "");
});

test("fetchMentionsForTargets: non-array children in response fires ': []' (L87)", async () => {
  // parsed.children is not an array → false branch (': []') fires
  const target = "https://a.example/post";
  const cache = dnsCache(["webmention.io"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      arrayBuffer: async () => Buffer.from(JSON.stringify({ items: [] })), // no .children → not an array → ': []'
    });
    const result = await fetchMentionsForTargets([target], cache);
    assert.deepEqual(result[target], []);
  } finally {
    restore();
  }
});
