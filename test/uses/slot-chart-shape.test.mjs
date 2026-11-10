/**
 * Goal & Constraints:
 * Exhaustive shape classification for Uses mosaic charts.
 * Covers solo, head-to-head, even pack, leader, long tail, overlapping.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  classifySlotChartShape,
  normalizeShare,
} from "../../scripts/uses/slot-chart-shape.mjs";

test("normalizeShare accepts numbers and blanks", () => {
  assert.equal(normalizeShare(50), 50);
  assert.equal(normalizeShare("33"), 33);
  assert.equal(normalizeShare(null), null);
  assert.equal(normalizeShare(undefined), null);
  assert.equal(normalizeShare(""), null);
  assert.equal(normalizeShare("nope"), null);
  assert.equal(normalizeShare(Number.NaN), null);
});

test("classifySlotChartShape handles empty and solo", () => {
  assert.equal(classifySlotChartShape([]), "solo");
  assert.equal(classifySlotChartShape(null), "solo");
  assert.equal(classifySlotChartShape([{ share: null }]), "solo");
  assert.equal(classifySlotChartShape([{ share: 100 }]), "solo");
  assert.equal(
    classifySlotChartShape([{ share: 100 }, { share: null }]),
    "solo",
  );
});

test("classifySlotChartShape picks head-to-head for two exclusive-ish choices", () => {
  assert.equal(
    classifySlotChartShape([{ share: 50 }, { share: 50 }]),
    "head_to_head",
  );
  assert.equal(
    classifySlotChartShape([{ share: 83 }, { share: 17 }]),
    "head_to_head",
  );
});

test("classifySlotChartShape picks even_pack for near-ties", () => {
  assert.equal(
    classifySlotChartShape([{ share: 33 }, { share: 33 }, { share: 33 }]),
    "even_pack",
  );
  assert.equal(
    classifySlotChartShape([
      { share: 28 },
      { share: 26 },
      { share: 24 },
      { share: 22 },
    ]),
    "even_pack",
  );
});

test("classifySlotChartShape picks leader_field when one choice dominates", () => {
  assert.equal(
    classifySlotChartShape([{ share: 100 }, { share: 33 }, { share: 33 }]),
    "leader_field",
  );
  assert.equal(
    classifySlotChartShape([{ share: 70 }, { share: 20 }, { share: 10 }]),
    "leader_field",
  );
  assert.equal(
    classifySlotChartShape([{ share: 85 }, { share: 10 }, { share: 5 }]),
    "leader_field",
  );
});

test("classifySlotChartShape picks overlapping when shares sum past 100", () => {
  assert.equal(
    classifySlotChartShape([{ share: 100 }, { share: 50 }]),
    "overlapping",
  );
  assert.equal(
    classifySlotChartShape([{ share: 60 }, { share: 50 }, { share: 40 }]),
    "overlapping",
  );
});

test("classifySlotChartShape picks long_tail for five or more choices", () => {
  assert.equal(
    classifySlotChartShape([
      { share: 25 },
      { share: 25 },
      { share: 17 },
      { share: 17 },
      { share: 8 },
    ]),
    "long_tail",
  );
  assert.equal(
    classifySlotChartShape([
      { share: 67 },
      { share: 33 },
      { share: 33 },
      { share: 33 },
      { share: 33 },
    ]),
    "long_tail",
  );
});

test("classifySlotChartShape falls back for three uneven exclusive-ish rows", () => {
  assert.equal(
    classifySlotChartShape([{ share: 50 }, { share: 30 }, { share: 20 }]),
    "even_pack",
  );
  assert.equal(
    classifySlotChartShape([
      { share: 40 },
      { share: 30 },
      { share: 20 },
      { share: 10 },
    ]),
    "even_pack",
  );
  assert.equal(
    classifySlotChartShape([{ share: 50 }, { share: null }]),
    "head_to_head",
  );
  assert.equal(
    classifySlotChartShape([{ share: 85 }, { share: 45 }]),
    "overlapping",
  );
  assert.equal(
    classifySlotChartShape([{ share: 80 }, { share: 45 }, { share: 10 }]),
    "leader_field",
  );
  assert.equal(
    classifySlotChartShape([{ share: 55 }, { share: 50 }, { share: 40 }]),
    "overlapping",
  );
  assert.equal(
    classifySlotChartShape([undefined, { share: 10 }]),
    "head_to_head",
  );
  assert.equal(classifySlotChartShape([{ share: null }]), "solo");
});
