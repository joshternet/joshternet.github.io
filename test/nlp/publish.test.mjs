/**
 * Goal: 100% line/branch/function coverage for scripts/nlp/publish.mjs.
 * All tests are offline — no network, no live data files as oracles.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDataManifest,
  semanticHash,
  semanticallyEqual,
  shouldPublishSemanticChange,
  stableStringify,
  stripOperationalTimestamps,
} from "../../scripts/nlp/publish.mjs";

// ─── stripOperationalTimestamps ───────────────────────────────────────────────

test("stripOperationalTimestamps: passes primitives through unchanged", () => {
  assert.equal(stripOperationalTimestamps(42), 42);
  assert.equal(stripOperationalTimestamps("hello"), "hello");
  assert.equal(stripOperationalTimestamps(null), null);
  assert.equal(stripOperationalTimestamps(false), false);
});

test("stripOperationalTimestamps: removes all timestamp keys", () => {
  const input = {
    slug: "design",
    generated_at: "2026-01-01T00:00:00Z",
    crawled_at: "2026-01-01T00:00:00Z",
    observed_at: "2026-01-01T00:00:00Z",
    last_checked_at: "2026-01-01T00:00:00Z",
    last_attempt_at: "2026-01-01T00:00:00Z",
    last_success_at: "2026-01-01T00:00:00Z",
    verified_at: "2026-01-01T00:00:00Z",
    first_seen_at: "2026-01-01T00:00:00Z",
    last_changed_at: "2026-01-01T00:00:00Z",
    stale_since: "2026-01-01T00:00:00Z",
  };
  const result = stripOperationalTimestamps(input);
  assert.equal(result.slug, "design");
  assert.ok(!Object.hasOwn(result, "generated_at"));
  assert.ok(!Object.hasOwn(result, "crawled_at"));
  assert.ok(!Object.hasOwn(result, "observed_at"));
  assert.ok(!Object.hasOwn(result, "last_checked_at"));
  assert.ok(!Object.hasOwn(result, "last_attempt_at"));
  assert.ok(!Object.hasOwn(result, "last_success_at"));
  assert.ok(!Object.hasOwn(result, "verified_at"));
  assert.ok(!Object.hasOwn(result, "first_seen_at"));
  assert.ok(!Object.hasOwn(result, "last_changed_at"));
  assert.ok(!Object.hasOwn(result, "stale_since"));
});

test("stripOperationalTimestamps: recurses into arrays", () => {
  const input = [
    { slug: "a", generated_at: "2026-01-01T00:00:00Z" },
    { slug: "b", crawled_at: "2026-02-01T00:00:00Z" },
  ];
  const result = stripOperationalTimestamps(input);
  assert.ok(Array.isArray(result));
  assert.equal(result[0].slug, "a");
  assert.ok(!Object.hasOwn(result[0], "generated_at"));
  assert.equal(result[1].slug, "b");
  assert.ok(!Object.hasOwn(result[1], "crawled_at"));
});

test("stripOperationalTimestamps: recurses into nested objects", () => {
  const input = {
    data: {
      topic: "design",
      verified_at: "2026-01-01T00:00:00Z",
    },
  };
  const result = stripOperationalTimestamps(input);
  assert.ok(!Object.hasOwn(result.data, "verified_at"));
  assert.equal(result.data.topic, "design");
});

// ─── stableStringify ──────────────────────────────────────────────────────────

test("stableStringify: primitives produce JSON equivalents", () => {
  assert.equal(stableStringify(42), "42");
  assert.equal(stableStringify("hello"), '"hello"');
  assert.equal(stableStringify(null), "null");
  assert.equal(stableStringify(true), "true");
});

test("stableStringify: arrays preserve order", () => {
  assert.equal(stableStringify([1, 2, 3]), "[1,2,3]");
  assert.equal(stableStringify(["b", "a"]), '["b","a"]');
});

test("stableStringify: objects sort keys alphabetically", () => {
  const result = stableStringify({ z: 1, a: 2, m: 3 });
  // Keys must appear in sorted order: a, m, z
  assert.ok(result.indexOf('"a"') < result.indexOf('"m"'));
  assert.ok(result.indexOf('"m"') < result.indexOf('"z"'));
});

test("stableStringify: nested arrays and objects", () => {
  const result = stableStringify({ items: [{ z: 1, a: 2 }] });
  assert.ok(result.includes('"a"'));
  assert.ok(result.includes('"z"'));
  // 'a' should come before 'z' inside nested object too
  assert.ok(result.indexOf('"a"') < result.indexOf('"z"'));
});

// ─── semanticHash / semanticallyEqual ────────────────────────────────────────

test("semanticHash: returns sha256 prefix string", () => {
  const hash = semanticHash({ topics: ["ai"] });
  assert.ok(hash.startsWith("sha256:"));
  assert.equal(hash.length, 7 + 64);
});

test("semanticHash: same data → same hash", () => {
  const a = semanticHash({ x: 1 });
  const b = semanticHash({ x: 1 });
  assert.equal(a, b);
});

test("semanticHash: different data → different hash", () => {
  const a = semanticHash({ x: 1 });
  const b = semanticHash({ x: 2 });
  assert.notEqual(a, b);
});

test("semanticHash: timestamp keys do not affect hash", () => {
  const a = semanticHash({ slug: "a", generated_at: "2025-01-01T00:00:00Z" });
  const b = semanticHash({ slug: "a", generated_at: "2026-09-01T00:00:00Z" });
  assert.equal(a, b);
});

test("semanticallyEqual: returns true when only timestamps differ", () => {
  assert.equal(
    semanticallyEqual(
      { slug: "a", last_checked_at: "2025" },
      { slug: "a", last_checked_at: "2026" },
    ),
    true,
  );
});

test("semanticallyEqual: returns false when semantic content differs", () => {
  assert.equal(semanticallyEqual({ slug: "a" }, { slug: "b" }), false);
});

// ─── shouldPublishSemanticChange ──────────────────────────────────────────────

test("shouldPublishSemanticChange: no previousHash → always publish", () => {
  const hash = semanticHash({ topics: ["ai"] });
  assert.equal(shouldPublishSemanticChange(undefined, hash), true);
});

test("shouldPublishSemanticChange: same hash → do not publish", () => {
  const hash = semanticHash({ topics: ["ai"] });
  assert.equal(shouldPublishSemanticChange(hash, hash), false);
});

test("shouldPublishSemanticChange: different hash → publish", () => {
  const hashA = semanticHash({ topics: ["ai"] });
  const hashB = semanticHash({ topics: ["design"] });
  assert.equal(shouldPublishSemanticChange(hashA, hashB), true);
});

test("shouldPublishSemanticChange: empty string previousHash → publish", () => {
  const hash = semanticHash({ topics: ["ai"] });
  assert.equal(shouldPublishSemanticChange("", hash), true);
});

// ─── buildDataManifest ────────────────────────────────────────────────────────

test("buildDataManifest: returns correct schema_version and shape", () => {
  const manifest = buildDataManifest({
    generatedAt: "2026-10-03T22:00:00.000Z",
    hashes: {
      network: "sha256:abc",
      topics: "sha256:def",
    },
  });

  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.generated_at, "2026-10-03T22:00:00.000Z");
  assert.deepEqual(manifest.semantic_hashes, {
    network: "sha256:abc",
    topics: "sha256:def",
  });
});

test("buildDataManifest: includes all expected dataset keys", () => {
  const manifest = buildDataManifest({ generatedAt: "t", hashes: {} });
  const datasets = Object.keys(manifest.datasets);
  for (const key of [
    "network",
    "site_signals",
    "content",
    "topics",
    "connections",
    "blogrolls",
    "mentions",
  ]) {
    assert.ok(datasets.includes(key), `missing dataset: ${key}`);
  }
});

test("buildDataManifest: includes all expected extractor keys", () => {
  const manifest = buildDataManifest({ generatedAt: "t", hashes: {} });
  const extractors = Object.keys(manifest.extractors);
  for (const key of ["html", "topics", "relationships", "feeds"]) {
    assert.ok(extractors.includes(key), `missing extractor: ${key}`);
  }
});

test("buildDataManifest: includes all expected schema URLs", () => {
  const manifest = buildDataManifest({ generatedAt: "t", hashes: {} });
  assert.ok(typeof manifest.schemas.network === "string");
  assert.ok(typeof manifest.schemas.data_manifest === "string");
  assert.ok(manifest.schemas.network.startsWith("https://"));
});
