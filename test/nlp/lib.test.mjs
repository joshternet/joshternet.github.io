/**
 * Goal: 100% line/branch/function coverage for scripts/nlp/lib.mjs.
 * Atomic I/O uses real temp dirs; fetchPublicText uses mock-fetch + DNS cache.
 * All tests are offline — mock fetch only, never live network.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  FETCH_TIMEOUT_MS,
  MAX_BYTES_PER_RESPONSE,
  fetchPublicText,
  parseHtmlDocument,
  readJSONIfExists,
  writeJSONAtomic,
  writeTextAtomic,
} from "../../scripts/nlp/lib.mjs";
import { dnsCache, install, restore } from "../helpers/mock-fetch.mjs";

// ─── readJSONIfExists ─────────────────────────────────────────────────────────

test("readJSONIfExists: returns parsed JSON when file exists", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nlp-lib-test-"));
  const filePath = path.join(dir, "data.json");
  try {
    await fs.writeFile(filePath, JSON.stringify({ hello: "world" }), "utf8");
    const result = await readJSONIfExists(filePath, null);
    assert.deepEqual(result, { hello: "world" });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("readJSONIfExists: returns fallback when file does not exist (ENOENT)", async () => {
  const result = await readJSONIfExists(
    "/tmp/does-not-exist-nlp-lib-test.json",
    "fallback",
  );
  assert.equal(result, "fallback");
});

test("readJSONIfExists: throws on non-ENOENT FS errors", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nlp-lib-test-"));
  const filePath = path.join(dir, "data.json");
  // Create a directory at the path so reading it as a file fails with EISDIR
  await fs.mkdir(filePath);
  try {
    await assert.rejects(
      () => readJSONIfExists(filePath, null),
      (err) => err.code !== "ENOENT",
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// ─── writeJSONAtomic ──────────────────────────────────────────────────────────

test("writeJSONAtomic: writes valid JSON and creates directories", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nlp-lib-test-"));
  const filePath = path.join(dir, "nested", "data.json");
  try {
    await writeJSONAtomic(filePath, { result: [1, 2, 3] });
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    assert.deepEqual(parsed, { result: [1, 2, 3] });
    // Atomic write appends newline
    assert.ok(content.endsWith("\n"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("writeJSONAtomic: overwrites existing file atomically", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nlp-lib-test-"));
  const filePath = path.join(dir, "data.json");
  try {
    await writeJSONAtomic(filePath, { version: 1 });
    await writeJSONAtomic(filePath, { version: 2 });
    const content = await fs.readFile(filePath, "utf8");
    assert.equal(JSON.parse(content).version, 2);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// ─── writeTextAtomic ──────────────────────────────────────────────────────────

test("writeTextAtomic: writes plain text and creates directories", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nlp-lib-test-"));
  const filePath = path.join(dir, "sub", "output.txt");
  try {
    await writeTextAtomic(filePath, "Hello, world!\n");
    const content = await fs.readFile(filePath, "utf8");
    assert.equal(content, "Hello, world!\n");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// ─── fetchPublicText ──────────────────────────────────────────────────────────

test("fetchPublicText: fetches and returns body with content-type", async () => {
  const cache = dnsCache(["a.example"]);
  install();
  try {
    // External HTTP boundary — real fetch replaced by mock stub
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      arrayBuffer: async () => Buffer.from("<html><body>Hello</body></html>"),
    });
    const result = await fetchPublicText("https://a.example/page", { cache });
    assert.equal(result.url, "https://a.example/page");
    assert.ok(result.contentType.includes("text/html"));
    assert.ok(result.body.includes("Hello"));
  } finally {
    restore();
  }
});

test("fetchPublicText: throws on non-OK HTTP status", async () => {
  const cache = dnsCache(["a.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: async () => Buffer.from(""),
    });
    await assert.rejects(
      () => fetchPublicText("https://a.example/missing", { cache }),
      /HTTP 404/,
    );
  } finally {
    restore();
  }
});

test("fetchPublicText: truncates when response exceeds MAX_BYTES_PER_RESPONSE", async () => {
  const cache = dnsCache(["a.example"]);
  const bigBuffer = Buffer.alloc(1_500_001, "x");
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: async () => bigBuffer,
    });
    const result = await fetchPublicText("https://a.example/huge", { cache });
    assert.equal(result.body.length, MAX_BYTES_PER_RESPONSE);
  } finally {
    restore();
  }
});

test("fetchPublicText: maxBytes truncates; non-positive maxBytes uses the default cap", async () => {
  const cache = dnsCache(["a.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      arrayBuffer: async () => Buffer.from("abcdefghij"),
    });
    const short = await fetchPublicText("https://a.example/cap", {
      cache,
      maxBytes: 4,
    });
    assert.equal(short.body, "abcd");
    const full = await fetchPublicText("https://a.example/cap", {
      cache,
      maxBytes: 0,
    });
    assert.equal(full.body, "abcdefghij");
  } finally {
    restore();
  }
});

test("fetchPublicText: throws when overflow is throw and the body is too large", async () => {
  const cache = dnsCache(["a.example"]);
  const bigBuffer = Buffer.alloc(1_500_001, "x");
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: async () => bigBuffer,
    });
    await assert.rejects(
      () =>
        fetchPublicText("https://a.example/huge", {
          cache,
          overflow: "throw",
        }),
      /response too large/,
    );
  } finally {
    restore();
  }
});

test("fetchPublicText: follows redirect with Location header", async () => {
  const cache = dnsCache(["a.example", "b.example"]);
  let callCount = 0;
  install();
  try {
    globalThis.fetch = async (url) => {
      callCount++;
      if (String(url).includes("a.example")) {
        return {
          ok: false,
          status: 301,
          headers: new Headers({
            "content-type": "text/html",
            location: "https://b.example/new-page",
          }),
          arrayBuffer: async () => Buffer.from(""),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: async () => Buffer.from("<html>Redirected</html>"),
      };
    };
    const result = await fetchPublicText("https://a.example/old", { cache });
    assert.ok(result.body.includes("Redirected"));
    assert.equal(callCount, 2);
  } finally {
    restore();
  }
});

test("fetchPublicText: throws when redirect has no Location header", async () => {
  const cache = dnsCache(["a.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: false,
      status: 301,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: async () => Buffer.from(""),
    });
    await assert.rejects(
      () => fetchPublicText("https://a.example/redirect", { cache }),
      /redirect without location/,
    );
  } finally {
    restore();
  }
});

// ─── parseHtmlDocument ────────────────────────────────────────────────────────

test("parseHtmlDocument: returns parsed regions for full HTML", () => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>My Page</title>
  <meta name="robots" content="index,follow">
</head>
<body>
  <main><h1>Hello world</h1><p>Some content here.</p></main>
  <a href="https://other.example/">Other</a>
</body>
</html>`;
  const doc = parseHtmlDocument(html);
  assert.equal(doc.title, "My Page");
  assert.ok(typeof doc.text === "string");
  assert.ok(Array.isArray(doc.links));
  assert.equal(doc.noindex, false);
  assert.equal(doc.derived, false);
  assert.equal(doc.lang, "en");
});

test("parseHtmlDocument: noindex meta tag is detected", () => {
  const html = `<html><head>
    <meta name="robots" content="noindex,nofollow">
  </head><body></body></html>`;
  const doc = parseHtmlDocument(html);
  assert.equal(doc.noindex, true);
});

test("parseHtmlDocument: derived analysis meta tag is detected", () => {
  const html = `<html><head>
    <meta name="joshternet-analysis" content="derived">
  </head><body></body></html>`;
  const doc = parseHtmlDocument(html);
  assert.equal(doc.derived, true);
});

test("parseHtmlDocument: empty string returns safe defaults", () => {
  const doc = parseHtmlDocument("");
  assert.equal(doc.title, "");
  assert.equal(doc.text, "");
  assert.deepEqual(doc.links, []);
  assert.equal(doc.noindex, false);
  assert.equal(doc.derived, false);
  assert.equal(doc.lang, "");
});

// ─── fetchPublicText abort timeout ────────────────────────────────────────────

test("fetchPublicText: abort timer fires and propagates as an error", async (t) => {
  // Uses the Node.js test-runner mock-timers to tick past FETCH_TIMEOUT_MS
  // without waiting 12 s.  The setTimeout callback (() => controller.abort())
  // is the function that must be exercised to reach 100% function coverage.
  t.mock.timers.enable(["setTimeout"]);
  const cache = dnsCache(["a.example"]);
  install();

  try {
    // External HTTP boundary — real fetch replaced by a stub that suspends
    // until the AbortSignal fires, then rejects with AbortError.
    globalThis.fetch = async (_url, { signal } = {}) => {
      return new Promise((_resolve, reject) => {
        const handler = () =>
          reject(new DOMException("The operation was aborted.", "AbortError"));
        if (signal?.aborted) {
          handler();
          return;
        }
        signal?.addEventListener("abort", handler);
      });
    };

    const fetchPromise = fetchPublicText("https://a.example/slow", { cache });

    // Yield enough microtask turns for assertPublicURL (uses cache — fast)
    // and the setTimeout registration inside fetchPublicText to complete.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Fire the abort timer; this calls controller.abort() → signal fires →
    // the mock fetch rejects with AbortError.
    t.mock.timers.tick(FETCH_TIMEOUT_MS + 1);

    await assert.rejects(fetchPromise, /AbortError|aborted|abort/i);
  } finally {
    t.mock.timers.reset();
    restore();
  }
});

// ─── fetchPublicText: response with no content-type header fires || '' (L123) ─

test("fetchPublicText: response without content-type header fires || '' (L123)", async () => {
  // headers.get("content-type") returns null when header is absent → null || "" fires (L123)
  const cache = dnsCache(["a.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null }, // No content-type → get() returns null
      arrayBuffer: async () => Buffer.from("body text"),
    });
    const result = await fetchPublicText("https://a.example/no-ct", { cache });
    assert.equal(result.contentType, ""); // || "" fires → contentType = ""
    assert.equal(result.body, "body text");
  } finally {
    restore();
  }
});
