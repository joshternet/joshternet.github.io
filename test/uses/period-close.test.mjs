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
  listStoredPeriodEntries,
  mergeDurablePageMeta,
  periodBoundaryPassed,
  previousCompletePeriodKeys,
  weeklyReconcile,
} from "../../scripts/uses/period-close.mjs";
import { ensureCatalogScaffold } from "../../scripts/uses/build.mjs";
import {
  appendEvents,
  loadAllEvents,
  readJson,
  replayState,
  writeState,
} from "../../scripts/uses/store.mjs";

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

test("replayState asOfExclusive keeps prior month tools after a later removal", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-asof-"));
  try {
    await ensureCatalogScaffold(dir);
    await appendEvents(dir, [
      {
        event_id: "e1",
        event_type: "usage_added",
        origin: "https://joshua.example",
        page_url: "https://joshua.example/uses/",
        tool_id: "neovim",
        status: "current",
        observed_at: "2026-10-15T12:00:00.000Z",
        evidence: { label: "Neovim", kind: "product" },
        use_case_ids: [],
      },
      {
        event_id: "e2",
        event_type: "usage_removed",
        origin: "https://joshua.example",
        page_url: "https://joshua.example/uses/",
        tool_id: "neovim",
        status: "removed",
        observed_at: "2026-11-05T12:00:00.000Z",
        evidence: { label: "Neovim", kind: "product" },
        use_case_ids: [],
      },
    ]);
    const events = await loadAllEvents(dir);
    const october = replayState(events, {
      asOfExclusive: "2026-11-01T00:00:00.000Z",
    });
    const november = replayState(events);
    assert.equal(october.members[0].tools.length, 1);
    assert.equal(october.members[0].tools[0].tool_id, "neovim");
    assert.equal(november.members[0].tools.length, 0);

    const overlaid = replayState(events);
    overlaid.members[0].page_status = "disallowed";
    overlaid.members[0].page_url = "https://joshua.example/uses/";
    await writeState(dir, overlaid);

    const closed = await closeMonthPeriod({
      usesRoot: dir,
      period: "2026-10",
      as_of: "2026-11-05T12:00:00.000Z",
      eligible_origins: ["https://joshua.example"],
    });
    assert.equal(closed.closed, true);
    assert.equal(closed.rollup.is_complete, true);
    const afterClose = await readJson(path.join(dir, "state.json"), null);
    assert.equal(afterClose.members[0].page_status, "disallowed");
    assert.equal(
      mergeDurablePageMeta(october, afterClose).members[0].page_status,
      "disallowed",
    );
    const listed = await listStoredPeriodEntries(dir);
    assert.ok(
      listed.some(
        (entry) => entry.granularity === "month" && entry.id === "2026-10",
      ),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
