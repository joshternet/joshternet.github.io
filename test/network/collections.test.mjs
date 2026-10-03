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
