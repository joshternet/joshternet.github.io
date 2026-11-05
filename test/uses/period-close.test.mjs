/**
 * Goal: Period close boundary and weekly reconcile helpers.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  closeMonthPeriod,
  formatOpsMetrics,
  periodBoundaryPassed,
  previousCompletePeriodKeys,
  weeklyReconcile,
} from "../../scripts/uses/period-close.mjs";
import { ensureCatalogScaffold } from "../../scripts/uses/build.mjs";

test("periodBoundaryPassed and previousCompletePeriodKeys", () => {
  assert.equal(
    periodBoundaryPassed(
      "2026-12-01T00:00:00.000Z",
      "2026-12-01T00:00:00.000Z",
    ),
    true,
  );
  assert.equal(
    periodBoundaryPassed(
      "2026-12-01T00:00:00.000Z",
      "2026-11-30T23:00:00.000Z",
    ),
    false,
  );
  const keys = previousCompletePeriodKeys("2026-12-05T12:00:00.000Z");
  assert.equal(keys.month, "2026-11");
  assert.equal(keys.quarter, "2026-Q4");
  assert.equal(keys.year, "2026");
});

test("closeMonthPeriod waits for boundary", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-close-"));
  try {
    await ensureCatalogScaffold(dir);
    const early = await closeMonthPeriod({
      usesRoot: dir,
      period: "2026-11",
      as_of: "2026-11-15T00:00:00.000Z",
      eligible_origins: [],
    });
    assert.equal(early.closed, false);
    assert.equal(early.reason, "boundary_not_reached");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("weeklyReconcile and formatOpsMetrics", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-week-"));
  try {
    await ensureCatalogScaffold(dir);
    const result = await weeklyReconcile(dir);
    assert.equal(result.ok, true);
    const metrics = formatOpsMetrics({
      eligible_member_count: 2,
      verified_count: 1,
      publish: false,
    });
    assert.equal(metrics.registry_eligible, 2);
    assert.equal(metrics.publish, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
