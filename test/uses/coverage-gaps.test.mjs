/**
 * Goal: Close remaining branch/line coverage for uses pure libraries.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  adoptionScore,
  buildPeriodRollup,
  isFreshObservation,
  momentumAgainstPrevious,
  quarterBounds,
  yearBounds,
} from "../../scripts/uses/aggregate.mjs";
import { isHubOrigin } from "../../scripts/uses/constants.mjs";
import {
  defaultUsesCandidates,
  discoverUsesPages,
  isUsesPath,
  normalizeOrigin,
  sameOrigin,
} from "../../scripts/uses/discover.mjs";
import {
  buildEvidenceRecords,
  isAdoptionEligible,
} from "../../scripts/uses/evidence.mjs";
import {
  extractUsesFromHtml,
  inferStatus,
  inferUseCaseHints,
  stripNonContentHtml,
} from "../../scripts/uses/extract.mjs";
import { buildUsageGraph } from "../../scripts/uses/graph.mjs";
import {
  comparisonLabel,
  contentFingerprint,
  indexCatalog,
  resolveToolLabel,
  sanitizeLabel,
} from "../../scripts/uses/normalize.mjs";
import {
  compareEvents,
  reconcileMemberUsage,
} from "../../scripts/uses/reconcile.mjs";
import {
  appendEvents,
  checksShardPath,
  dateKeyFromIso,
  eventsShardPath,
  loadAllEvents,
  periodKeyFromIso,
  readJson,
  replayState,
  upsertDailyCheck,
  writeState,
} from "../../scripts/uses/store.mjs";
import {
  isEarlySample,
  validateGraphInvariants,
  validateHistoryInvariants,
  validateRollupInvariants,
} from "../../scripts/uses/validate.mjs";

test("constants and discover edge cases", () => {
  assert.equal(isHubOrigin(""), false);
  assert.equal(isHubOrigin("not a url"), false);
  assert.equal(isHubOrigin("https://www.joshternet.org/"), true);
  assert.deepEqual(defaultUsesCandidates("bad"), []);
  assert.equal(isUsesPath("::::"), false);
  assert.equal(normalizeOrigin("::::"), "");
  assert.equal(sameOrigin("https://a.example", "bad"), false);
  assert.deepEqual(
    discoverUsesPages({
      origin: "https://example.com",
      declaredUrl: "https://example.com/uses/",
      opmlOutlines: [{ url: "https://example.com/gear/", category: "/uses" }],
      navLinks: [{ href: "/tools", text: "Tools I use" }],
      pages: [],
    }).length >= 1,
    true,
  );
  const defaults = discoverUsesPages({
    origin: "https://example.com",
    pages: [{}],
  });
  assert.ok(
    defaults.every((entry) => entry.discovery_method === "slash-default"),
  );
});

test("extract edge paths", () => {
  assert.equal(stripNonContentHtml(""), "");
  assert.equal(inferStatus("considering Neovim"), "considering");
  assert.ok(inferUseCaseHints("self-host my photos").includes("self-hosting"));
  const table = extractUsesFromHtml(`
    <h2>Gear</h2>
    <table><tr><td><strong>Firefox</strong></td></tr></table>
    <dl><dt>Neovim</dt><dd>editor</dd></dl>
  `);
  assert.equal(table.outcome, "verified");
  assert.ok(table.items.length >= 1);
  const emptyList = extractUsesFromHtml(`<main><ul></ul></main>`);
  assert.ok(
    emptyList.outcome === "verified_empty" || emptyList.outcome === "uncertain",
  );
});

test("normalize and evidence edges", () => {
  assert.equal(sanitizeLabel(""), "");
  assert.equal(sanitizeLabel(null), "");
  assert.equal(comparisonLabel(""), "");
  const indexed = indexCatalog({
    tools: [
      { id: "", name: "x" },
      { id: "t", name: "Tool", aliases: ["T"] },
    ],
    aliases: [
      { alias: "", tool_id: "t" },
      { alias: "Tool", tool_id: "t" },
    ],
  });
  assert.ok(indexed.byId.has("t"));
  assert.equal(
    resolveToolLabel("", { catalog: { tools: [], aliases: [] } }).unresolved,
    true,
  );
  const records = buildEvidenceRecords({
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    content_hash_source: "x",
    items: [
      { label: "", status: "current", section: "", excerpt: "" },
      {
        label: "Mystery Box",
        status: "nope",
        section: "Stuff",
        excerpt: "Mystery Box",
        use_case_hints: ["programming", "nope"],
      },
    ],
    catalog: {
      tools: [],
      aliases: [],
      useCases: [{ id: "programming" }],
    },
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].unresolved, false);
  assert.equal(records[0].tool_id, "observed:mystery-box");
  assert.equal(records[0].name, "Mystery Box");
  assert.equal(records[0].status, "unspecified");
  assert.equal(isAdoptionEligible(records[0]), false);
  assert.equal(isAdoptionEligible(null), false);
});

test("aggregate quarter/year/momentum/freshness", async () => {
  assert.throws(() => quarterBounds("nope"));
  const q = quarterBounds("2026-Q1");
  assert.match(q.start, /2026-01-01/);
  const y = yearBounds("2026");
  assert.match(y.endExclusive, /2027-01-01/);
  assert.equal(isFreshObservation("bad", "2026-01-01T00:00:00Z"), false);
  assert.equal(
    isFreshObservation("2026-01-01T00:00:00Z", "2026-01-10T00:00:00Z"),
    true,
  );
  assert.deepEqual(momentumAgainstPrevious(null, null, 1, 1), {
    momentum_count: null,
    momentum_pp: null,
  });
  assert.deepEqual(
    momentumAgainstPrevious(
      { active_member_count: 3 },
      { active_member_count: 1 },
      10,
      10,
    ),
    { momentum_count: 2, momentum_pp: 20 },
  );
  assert.equal(adoptionScore(0, 0), null);

  const rollup = await buildPeriodRollup({
    period: "2026-11",
    granularity: "month",
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: "2026-11-03T00:00:00.000Z",
    is_complete: true,
    eligible_origins: ["https://a.example"],
    state: {
      members: [
        {
          origin: "https://a.example",
          page_status: "verified",
          last_valid_observation_at: "2026-11-02T00:00:00.000Z",
          tools: [
            {
              tool_id: "firefox",
              status: "former",
              use_case_ids: [],
            },
            {
              tool_id: "neovim",
              status: "current",
              use_case_ids: ["programming"],
            },
          ],
        },
      ],
    },
    period_events: [
      {
        event_type: "usage_added",
        status: "current",
        tool_id: "neovim",
        origin: "https://a.example",
        observed_at: "2026-11-02T00:00:00.000Z",
      },
    ],
    catalog: {
      tools: [
        {
          id: "neovim",
          name: "Neovim",
          category_id: "editor-ide",
          aliases: [],
        },
      ],
      categories: [
        {
          id: "editor-ide",
          name: "Editors",
          role: "ranked",
          scope: "The editor a site says it uses.",
        },
      ],
      aliases: [],
    },
  });
  assert.equal(rollup.tools[0].tool_id, "neovim");
  assert.equal(rollup.tools[0].source_coverage, "complete");
});

test("reconcile usage_changed and source_status_changed", () => {
  const first = reconcileMemberUsage({
    previous: null,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified",
    observed_at: "2026-11-01T00:00:00.000Z",
    evidence: [
      {
        origin: "https://example.com",
        page_url: "https://example.com/uses/",
        label: "Firefox",
        comparison: "firefox",
        tool_id: "firefox",
        unresolved: false,
        status: "current",
        use_case_ids: [],
        section: "",
        excerpt: "",
        source_hash: "sha256:a",
        extractor_version: 1,
        taxonomy_version: 1,
        confidence: 0.9,
      },
    ],
    pageComplete: true,
  });
  const changed = reconcileMemberUsage({
    previous: first.next,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified_empty",
    observed_at: "2026-11-01T01:00:00.000Z",
    evidence: [
      {
        origin: "https://example.com",
        page_url: "https://example.com/uses/",
        label: "Firefox",
        comparison: "firefox",
        tool_id: "firefox",
        unresolved: false,
        status: "former",
        use_case_ids: ["reading"],
        section: "",
        excerpt: "",
        source_hash: "sha256:a",
        extractor_version: 1,
        taxonomy_version: 1,
        confidence: 0.9,
      },
    ],
    pageComplete: true,
  });
  assert.ok(changed.events.some((e) => e.event_type === "usage_changed"));
  assert.ok(
    changed.events.some((e) => e.event_type === "source_status_changed"),
  );
  assert.equal(
    compareEvents({ observed_at: "a" }, { observed_at: "b" }) < 0,
    true,
  );
});

test("store IO edges and replay removals", async () => {
  assert.throws(() => periodKeyFromIso("bad"));
  assert.throws(() => dateKeyFromIso("bad"));
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-cov-"));
  try {
    assert.equal((await appendEvents(dir, [])).added, 0);
    assert.deepEqual(await loadAllEvents(dir), []);
    assert.equal(
      eventsShardPath(dir, "2026-11").endsWith("2026/2026-11.json"),
      true,
    );
    assert.equal(
      checksShardPath(dir, "2026-11").endsWith("2026/2026-11.json"),
      true,
    );
    assert.deepEqual(
      await readJson(path.join(dir, "missing.json"), { ok: 1 }),
      {
        ok: 1,
      },
    );

    await upsertDailyCheck(dir, {
      date: "2026-11-03",
      origin: "https://example.com",
      page_url: "https://example.com/uses/",
      outcome: "uncertain",
      content_hash: "",
      verified_item_count: 0,
      extractor_version: 1,
    });
    await upsertDailyCheck(dir, {
      date: "2026-11-03",
      origin: "https://example.com",
      page_url: "https://example.com/uses/",
      outcome: "verified",
      content_hash: "sha256:bb",
      verified_item_count: 2,
      extractor_version: 1,
    });

    const events = [
      {
        event_id: "sha256:" + "a".repeat(64),
        event_type: "usage_added",
        observed_at: "2026-11-01T00:00:00.000Z",
        origin: "https://example.com",
        page_url: "https://example.com/uses/",
        tool_id: "firefox",
        status: "current",
        use_case_ids: [],
      },
      {
        event_id: "sha256:" + "b".repeat(64),
        event_type: "usage_removed",
        observed_at: "2026-11-02T00:00:00.000Z",
        origin: "https://example.com",
        page_url: "https://example.com/uses/",
        tool_id: "firefox",
        status: "removed",
        use_case_ids: [],
      },
      {
        event_id: "sha256:" + "c".repeat(64),
        event_type: "source_status_changed",
        observed_at: "2026-11-02T01:00:00.000Z",
        origin: "https://example.com",
        page_url: "https://example.com/uses/",
        tool_id: "",
        status: "unspecified",
        use_case_ids: [],
      },
      {
        event_id: "sha256:" + "d".repeat(64),
        event_type: "member_eligibility_changed",
        observed_at: "2026-11-02T02:00:00.000Z",
        origin: "https://example.com",
        page_url: "https://example.com/uses/",
        tool_id: null,
        status: "unspecified",
        use_case_ids: [],
      },
    ];
    await appendEvents(dir, events);
    const state = replayState(events);
    assert.equal(state.members[0].tools.length, 0);
    await writeState(dir, state);

    const yearDir = path.join(dir, "events", "2026");
    await mkdir(yearDir, { recursive: true });
    await writeFile(path.join(yearDir, "note.txt"), "skip");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("graph and validate helpers", () => {
  assert.deepEqual(validateRollupInvariants(null), ["rollup missing"]);
  assert.ok(
    validateRollupInvariants({
      verified_uses_member_count: 1,
      tools: [
        {
          tool_id: "x",
          active_member_count: 2,
          active_member_origins: ["a"],
          adoption_score: 50,
        },
      ],
    }).length > 0,
  );
  assert.ok(
    validateGraphInvariants({
      nodes: [
        { id: "member:a", kind: "member", label: "a" },
        { id: "member:a", kind: "member", label: "a" },
      ],
      edges: [
        { from: "member:a", to: "member:b", relation: "uses" },
        {
          from: "missing",
          to: "tool:x",
          relation: "uses",
          evidence_event_id: "",
        },
      ],
    }).length > 0,
  );
  assert.ok(
    validateHistoryInvariants(
      [
        {
          event_id: "dup",
          observed_at: "not-a-date",
        },
        {
          event_id: "dup",
          observed_at: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
      { through_event_id: "", members: [] },
    ).length > 0,
  );
  assert.equal(isEarlySample(10, 0), true);
  assert.equal(contentFingerprint("z").startsWith("sha256:"), true);

  const graph = buildUsageGraph({
    rollup: {
      period: "2026-11",
      tools: [
        {
          tool_id: "unknown-tool",
          active_member_origins: ["https://a.example"],
          use_cases: [{ id: "missing", member_count: 1 }],
        },
      ],
    },
    state: { members: [] },
    tools: [],
    categories: [],
    useCases: [],
  });
  assert.ok(graph.nodes.some((n) => n.id === "tool:unknown-tool"));
});
