/**
 * Goal & Constraints: Coverage-first slot ordering helper.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { compareSlotsByCoverage } from "../../scripts/uses/build-helpers.mjs";

test("compareSlotsByCoverage ranks by denominator, then products, then name", () => {
  assert.ok(
    compareSlotsByCoverage(
      { denominator: 1, products: [], name: "A" },
      { denominator: 3, products: [], name: "B" },
    ) > 0,
  );
  assert.ok(
    compareSlotsByCoverage(
      { denominator: 2, products: [1], name: "A" },
      { denominator: 2, products: [1, 2], name: "B" },
    ) > 0,
  );
  assert.ok(
    compareSlotsByCoverage(
      { denominator: 2, products: [1], name: "Zebra" },
      { denominator: 2, products: [1], name: "Apple" },
    ) > 0,
  );
  assert.equal(
    compareSlotsByCoverage(
      { denominator: 2, products: [1], name: "Same" },
      { denominator: 2, products: [1], name: "Same" },
    ),
    0,
  );
  assert.equal(
    compareSlotsByCoverage(
      { denominator: Number.NaN, products: null, name: undefined },
      { denominator: undefined, products: undefined, name: 42 },
    ),
    0,
  );
});
