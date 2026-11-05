/**
 * Goal: Semantic diff, removal confirmation, replay determinism, daily checks.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { reconcileMemberUsage } from "../../scripts/uses/reconcile.mjs";
import {
  appendEvents,
  loadAllEvents,
  replayState,
  upsertDailyCheck,
  writeState,
} from "../../scripts/uses/store.mjs";
import { validateHistoryInvariants } from "../../scripts/uses/validate.mjs";

/**
 * @param {Partial<import('../../scripts/uses/evidence.mjs').EvidenceRecord>} overrides
 */
function evidence(overrides) {
  return {
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    label: "VS Code",
    comparison: "vs code",
    tool_id: "visual-studio-code",
    unresolved: false,
    status: "current",
    use_case_ids: ["programming"],
    section: "Dev",
    excerpt: "VS Code",
    source_hash: "sha256:abc",
    extractor_version: 1,
    taxonomy_version: 1,
    confidence: 0.9,
    ...overrides,
  };
}

test("same-claim comparison covers an unnamed prior and a renamed record", () => {
  const previous = {
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified",
    first_valid_observation_at: "2026-11-01T12:00:00.000Z",
    last_valid_observation_at: "2026-11-01T12:00:00.000Z",
    tools: [
      {
        tool_id: "visual-studio-code",
        name: "",
        status: "current",
        use_case_ids: ["programming"],
        kind: "product",
        context: "",
        section: "Dev",
        section_path: "",
        href: "",
        first_observed_at: "2026-11-01T12:00:00.000Z",
        last_event_at: "2026-11-01T12:00:00.000Z",
        evidence_event_id: "evt-prior",
      },
    ],
  };
  const blank = reconcileMemberUsage({
    previous,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified",
    observed_at: "2026-11-02T12:00:00.000Z",
    pageComplete: true,
    evidence: [evidence({ name: "", label: "" })],
  });
  const renamed = reconcileMemberUsage({
    previous,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified",
    observed_at: "2026-11-02T13:00:00.000Z",
    pageComplete: true,
    evidence: [evidence({ name: "Visual Studio Code" })],
  });

  assert.equal(blank.next.tools[0].name, "visual-studio-code");
  assert.equal(renamed.next.tools[0].name, "Visual Studio Code");
  assert.equal(
    renamed.events.some((event) => event.event_type === "usage_changed"),
    false,
  );
});

test("reconcile emits usage_added then no duplicate on identical run", () => {
  const first = reconcileMemberUsage({
    previous: null,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified",
    observed_at: "2026-11-03T16:00:00.000Z",
    evidence: [evidence()],
    pageComplete: true,
  });
  assert.equal(first.events.length, 2);
  assert.ok(first.events.some((e) => e.event_type === "usage_added"));
  assert.ok(first.events.some((e) => e.event_type === "source_status_changed"));

  const second = reconcileMemberUsage({
    previous: first.next,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified",
    observed_at: "2026-11-03T17:00:00.000Z",
    evidence: [evidence()],
    pageComplete: true,
  });
  assert.equal(second.events.length, 0);
});

test("verified_empty first sighting replays without inventing state members", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-empty-"));
  try {
    const empty = reconcileMemberUsage({
      previous: null,
      origin: "https://empty.example",
      page_url: "https://empty.example/uses/",
      page_status: "verified_empty",
      observed_at: "2026-11-03T16:00:00.000Z",
      evidence: [],
      pageComplete: true,
    });
    assert.equal(empty.events.length, 1);
    assert.equal(empty.events[0].event_type, "source_status_changed");
    assert.equal(empty.next.tools.length, 0);

    await appendEvents(dir, empty.events);
    const events = await loadAllEvents(dir);
    const state = replayState(events);
    const overlay = state.members.find(
      (m) => m.origin === "https://empty.example",
    );
    assert.ok(overlay);
    overlay.page_status = empty.next.page_status;
    overlay.page_url = empty.next.page_url;
    overlay.first_valid_observation_at = empty.next.first_valid_observation_at;
    overlay.last_valid_observation_at = empty.next.last_valid_observation_at;
    await writeState(dir, state);

    const errors = validateHistoryInvariants(events, state);
    assert.deepEqual(errors, []);
    assert.equal(state.members.length, 1);
    assert.equal(state.members[0].page_status, "verified_empty");
    assert.equal(state.members[0].tools.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("removal requires two complete absences 24h apart", () => {
  const added = reconcileMemberUsage({
    previous: null,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified",
    observed_at: "2026-11-01T12:00:00.000Z",
    evidence: [evidence()],
    pageComplete: true,
  });

  const miss1 = reconcileMemberUsage({
    previous: added.next,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified_empty",
    observed_at: "2026-11-02T12:00:00.000Z",
    evidence: [],
    pageComplete: true,
  });
  assert.equal(
    miss1.events.filter((e) => e.event_type === "usage_removed").length,
    0,
  );
  assert.ok(miss1.next.tools[0].pending_absence_at);

  const missTooSoon = reconcileMemberUsage({
    previous: miss1.next,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified_empty",
    observed_at: "2026-11-02T18:00:00.000Z",
    evidence: [],
    pageComplete: true,
  });
  assert.equal(
    missTooSoon.events.filter((e) => e.event_type === "usage_removed").length,
    0,
  );

  const miss2 = reconcileMemberUsage({
    previous: miss1.next,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified_empty",
    observed_at: "2026-11-03T13:00:00.000Z",
    evidence: [],
    pageComplete: true,
  });
  assert.equal(
    miss2.events.filter((e) => e.event_type === "usage_removed").length,
    1,
  );
  assert.equal(miss2.next.tools.length, 0);
});

test("network failure does not remove tools", () => {
  const added = reconcileMemberUsage({
    previous: null,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified",
    observed_at: "2026-11-01T12:00:00.000Z",
    evidence: [evidence()],
    pageComplete: true,
  });
  const failed = reconcileMemberUsage({
    previous: added.next,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "unreachable",
    observed_at: "2026-11-02T12:00:00.000Z",
    evidence: [],
    pageComplete: false,
  });
  assert.equal(
    failed.events.filter((e) => e.event_type === "usage_removed").length,
    0,
  );
  assert.equal(failed.next.tools.length, 1);
});

test("a truncated response does not remove a previously listed tool", () => {
  const added = reconcileMemberUsage({
    previous: null,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified",
    observed_at: "2026-11-01T12:00:00.000Z",
    evidence: [evidence()],
    pageComplete: true,
    bodyComplete: true,
  });
  const truncated = reconcileMemberUsage({
    previous: added.next,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified_empty",
    observed_at: "2026-12-01T12:00:00.000Z",
    evidence: [],
    pageComplete: true,
    bodyComplete: false,
  });
  assert.equal(
    truncated.events.filter((event) => event.event_type === "usage_removed")
      .length,
    0,
  );
  assert.equal(truncated.next.tools.length, 1);
});

test("appendEvents dedupes and replay matches state tools", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-store-"));
  try {
    const added = reconcileMemberUsage({
      previous: null,
      origin: "https://example.com",
      page_url: "https://example.com/uses/",
      page_status: "verified",
      observed_at: "2026-11-03T16:00:00.000Z",
      evidence: [evidence()],
      pageComplete: true,
    });
    await appendEvents(dir, added.events);
    await appendEvents(dir, added.events);
    const events = await loadAllEvents(dir);
    assert.equal(events.length, 2);
    const state = replayState(events);
    await writeState(dir, state);
    const errors = validateHistoryInvariants(events, state);
    assert.deepEqual(errors, []);

    const replayed = state.members[0].tools.find(
      (tool) => tool.tool_id === "visual-studio-code",
    );
    assert.equal(replayed.name, "VS Code");

    await upsertDailyCheck(dir, {
      date: "2026-11-03",
      origin: "https://example.com",
      page_url: "https://example.com/uses/",
      outcome: "verified",
      content_hash: "sha256:aa",
      verified_item_count: 1,
      extractor_version: 1,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("homepage duplicate drops current tools immediately", () => {
  const added = reconcileMemberUsage({
    previous: null,
    origin: "https://example.com",
    page_url: "https://example.com/uses",
    page_status: "verified",
    observed_at: "2026-11-01T12:00:00.000Z",
    evidence: [evidence({ label: "/cv", tool_id: "observed:cv", name: "/cv" })],
    pageComplete: true,
  });
  const dropped = reconcileMemberUsage({
    previous: added.next,
    origin: "https://example.com",
    page_url: "https://example.com/uses",
    page_status: "out_of_scope",
    observed_at: "2026-11-04T12:00:00.000Z",
    evidence: [],
    pageComplete: true,
  });
  assert.equal(dropped.next.tools.length, 0);
  assert.equal(
    dropped.events.filter((event) => event.event_type === "usage_removed")
      .length,
    1,
  );
});
