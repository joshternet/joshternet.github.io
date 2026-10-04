/**
 * Goal: Sparse collection documents never ship a root empty array.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  itemsFromCollection,
  sparseCollectionDocument,
} from "../../scripts/network/collections.mjs";

test("itemsFromCollection reads legacy arrays and sparse documents", () => {
  assert.deepEqual(itemsFromCollection([{ slug: "a" }], "communities"), [
    { slug: "a" },
  ]);
  assert.deepEqual(
    itemsFromCollection({ communities: [{ slug: "b" }] }, "communities"),
    [{ slug: "b" }],
  );
  assert.deepEqual(
    itemsFromCollection({ community_count: 0 }, "communities"),
    [],
  );
});

test("sparseCollectionDocument omits empty item lists", () => {
  const empty = sparseCollectionDocument({
    generatedAt: "2026-10-03T00:00:00.000Z",
    key: "edges",
    items: [],
    extra: { edge_count: 0 },
  });
  assert.equal(empty.edge_count, 0);
  assert.equal(Object.hasOwn(empty, "edges"), false);

  const present = sparseCollectionDocument({
    generatedAt: "2026-10-03T00:00:00.000Z",
    key: "edges",
    items: [{ from: "https://a.example", to: "https://b.example" }],
    extra: { edge_count: 1 },
  });
  assert.equal(present.edges.length, 1);
});

test("sparseCollectionDocument: non-array items defaults to empty; extra is optional", () => {
  // Array.isArray(undefined) → false → items = [] branch (ternary false side)
  const doc = sparseCollectionDocument({
    generatedAt: "2026-10-03T00:00:00.000Z",
    key: "edges",
    items: undefined,
    // no extra → input.extra || {} → falsy path (spread {})
  });
  assert.equal(doc.schema_version, 1);
  assert.equal(Object.hasOwn(doc, "edges"), false);
});

test("itemsFromCollection: null and non-matching inputs return empty", () => {
  assert.deepEqual(itemsFromCollection(null, "edges"), []);
  assert.deepEqual(itemsFromCollection(undefined, "edges"), []);
  assert.deepEqual(itemsFromCollection("string", "edges"), []);
});
