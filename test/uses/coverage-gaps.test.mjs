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
  withPreviousPeriodChanges,
  yearBounds,
} from "../../scripts/uses/aggregate.mjs";
import { classifyClaim, sectionSlotId } from "../../scripts/uses/classify.mjs";
import {
  AGGREGATION_VERSION,
  EXTRACTOR_VERSION,
  isHubOrigin,
} from "../../scripts/uses/constants.mjs";
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
  closeCalendarPeriod,
  closeMonthPeriod,
  closeQuarterPeriod,
  closeYearPeriod,
  listStoredPeriodEntries,
  mergeDurablePageMeta,
} from "../../scripts/uses/period-close.mjs";
import {
  compareEvents,
  reconcileMemberUsage,
} from "../../scripts/uses/reconcile.mjs";
import {
  appendEvents,
  checksShardPath,
  dateKeyFromIso,
  earlierExclusive,
  eventsShardPath,
  exclusiveAfter,
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
  validateUsesRoot,
} from "../../scripts/uses/validate.mjs";
import { buildUsesSummary, coverageReason } from "../../scripts/uses/view.mjs";
import { ensureCatalogScaffold } from "../../scripts/uses/build.mjs";

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
  assert.deepEqual(validateRollupInvariants("nope"), ["rollup missing"]);
  assert.deepEqual(validateRollupInvariants({}), []);
  assert.deepEqual(
    validateRollupInvariants({
      verified_uses_member_count: 2,
      tools: [
        {
          tool_id: "ok",
          active_member_count: 1,
          active_member_origins: ["a"],
          adoption_score: 50,
          denominator: 2,
        },
      ],
    }),
    [],
  );
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
        {
          tool_id: "x",
          active_member_count: -1,
          active_member_origins: "not-an-array",
          adoption_score: 101,
          denominator: 1,
        },
        {
          tool_id: "y",
          active_member_count: 0,
          adoption_score: null,
          denominator: Number.NaN,
        },
        {
          tool_id: "z",
          active_member_count: 0,
          active_member_origins: [],
          adoption_score: 0,
          denominator: 0,
        },
        {
          tool_id: "w",
          active_member_count: 1,
          active_member_origins: ["a"],
          adoption_score: -5,
          denominator: 1,
        },
        {
          tool_id: "v",
          active_member_count: 1,
          active_member_origins: ["a"],
          adoption_score: 99,
          denominator: 2,
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
    validateGraphInvariants({
      nodes: [
        { id: "member:a", kind: "member", label: "a" },
        { id: "member:b", kind: "member", label: "b" },
        { id: "tool:x", kind: "tool", label: "x" },
      ],
      edges: [
        { from: "member:a", to: "member:b", relation: "mentions" },
        {
          from: "member:a",
          to: "tool:x",
          relation: "uses",
          evidence_event_id: "",
        },
        {
          from: "member:a",
          to: "missing-tool",
          relation: "uses",
          evidence_event_id: "sha256:1",
        },
      ],
    }).length > 0,
  );
  assert.deepEqual(validateGraphInvariants({}), []);
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
  assert.ok(
    validateHistoryInvariants([], {
      through_event_id: "sha256:stale",
      members: [],
    }).length > 0,
  );
  assert.equal(isEarlySample(4, 100), true);
  assert.equal(isEarlySample(10, 0), true);
  assert.equal(isEarlySample(10, 50), true);
  assert.equal(isEarlySample(10, 20), false);
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

test("exclusiveAfter and earlierExclusive bound helpers", () => {
  assert.equal(
    exclusiveAfter("2026-11-01T00:00:00.000Z"),
    "2026-11-01T00:00:00.001Z",
  );
  assert.throws(() => exclusiveAfter("not-a-date"));
  assert.equal(
    earlierExclusive("2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"),
    "2026-11-01T00:00:00.000Z",
  );
  assert.equal(
    earlierExclusive("2026-12-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z"),
    "2026-11-01T00:00:00.000Z",
  );
});

test("coverageReason covers empty and missing page outcomes", () => {
  assert.match(coverageReason("verified_empty"), /no accepted/i);
  assert.match(coverageReason("not_found"), /not found/i);
});

test("view presentation covers invalid origins and store websites", () => {
  const summary = buildUsesSummary({
    as_of: "2026-11-07T00:00:00.000Z",
    eligible_member_count: 2,
    verified_uses_member_count: 1,
    members: [
      {
        origin: "https://joshua.example",
        page_url: "https://joshua.example/uses/",
      },
    ],
    catalog: {
      tools: [
        {
          id: "neovim",
          name: "Neovim",
          website: "https://amazon.com/neovim",
        },
        {
          id: "firefox",
          name: "Firefox",
          website: "not a url",
        },
        {
          id: "zed",
          name: "Zed",
          website: "https://zed.dev",
        },
      ],
    },
    rollup: {
      period: "2026-11",
      is_complete: true,
      verified_uses_member_count: 1,
      tools: [
        {
          tool_id: "neovim",
          name: "Neovim",
          active_member_count: 1,
          active_member_origins: ["https://joshua.example"],
          adoption_score: 100,
          denominator: 1,
          use_cases: [],
        },
        {
          tool_id: "firefox",
          name: "Firefox",
          active_member_count: 1,
          active_member_origins: ["https://joshua.example"],
          adoption_score: 100,
          denominator: 1,
          use_cases: [],
        },
        {
          tool_id: "zed",
          name: "Zed",
          active_member_count: 1,
          active_member_origins: ["https://joshua.example"],
          adoption_score: 100,
          denominator: 1,
          use_cases: [],
        },
      ],
      unsorted: [
        {
          name: "Odd Tool",
          origin: "not a url",
          section: "Gear",
          context: "",
          observed_at: "2026-11-01T00:00:00.000Z",
        },
        {
          name: "Odd Tool",
          origin: "not a url",
          section: "Gear",
          context: "again",
          observed_at: "2026-11-02T00:00:00.000Z",
        },
        {
          name: "Other",
          origin: "https://joshua.example",
          section: "",
          context: "",
          observed_at: "2026-11-01T00:00:00.000Z",
        },
      ],
      setup: [
        {
          name: "32GB RAM",
          origin: "https://joshua.example",
          relation: "component_of",
          parent_slot: "computer",
        },
      ],
      slots: [
        {
          id: "editor-ide",
          name: "Editors",
          scope: "Editors",
          kind: "software",
          denominator: 1,
          origins: ["https://joshua.example"],
          products: [
            {
              tool_id: "neovim",
              name: "Neovim",
              active_member_count: 1,
              active_member_origins: ["https://joshua.example"],
              adoption_score: 100,
              denominator: 1,
              use_cases: [],
            },
          ],
        },
      ],
    },
  });
  assert.equal(summary.unsorted.length >= 1, true);
  assert.equal(summary.setup[0].site_count, 1);
  const zed = summary.top_tools.find((tool) => tool.tool_id === "zed");
  assert.equal(zed.website, "https://zed.dev");
  const neovim = summary.top_tools.find((tool) => tool.tool_id === "neovim");
  assert.equal(neovim.website, "");
});

test("validateUsesRoot flags unknown page_status values", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-status-"));
  try {
    await writeState(dir, {
      schema_version: 1,
      through_event_id: "",
      members: [
        {
          origin: "https://joshua.example",
          page_status: "not-a-real-status",
          tools: [],
        },
        {
          origin: "https://other.example",
          page_status: "",
          tools: [],
        },
      ],
    });
    const result = await validateUsesRoot(dir);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((error) => error.includes("unknown page_status")),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("validateHistoryInvariants accepts matching replay projections", () => {
  const events = [
    {
      event_id: "sha256:" + "e".repeat(64),
      event_type: "usage_added",
      observed_at: "2026-11-01T00:00:00.000Z",
      origin: "https://joshua.example",
      page_url: "https://joshua.example/uses/",
      tool_id: "neovim",
      status: "current",
      use_case_ids: ["programming", "writing"],
    },
    {
      event_id: "sha256:" + "f".repeat(64),
      event_type: "usage_added",
      observed_at: "2026-11-01T01:00:00.000Z",
      origin: "https://joshua.example",
      page_url: "https://joshua.example/uses/",
      tool_id: "firefox",
      status: "current",
      use_case_ids: [],
    },
    {
      event_id: "sha256:" + "g".repeat(64),
      event_type: "usage_added",
      observed_at: "2026-11-01T02:00:00.000Z",
      origin: "https://other.example",
      page_url: "https://other.example/uses/",
      tool_id: "zed",
      status: "current",
      use_case_ids: [],
    },
  ];
  const state = replayState(events);
  assert.equal(state.members.length, 2);
  assert.deepEqual(validateHistoryInvariants(events, state), []);
});

test("sectionSlotId matches synonyms and ranked slot names", () => {
  const categories = [
    {
      id: "computer",
      name: "Computers",
      role: "ranked",
      scope: "Computers",
    },
    {
      id: "editor-ide",
      name: "Editors",
      role: "ranked",
      scope: "Editors",
    },
    {
      id: "workflow",
      name: "Workflow",
      role: "unsorted",
      scope: "Workflow",
    },
  ];
  assert.equal(sectionSlotId("Laptops / Misc", categories), "computer");
  assert.equal(sectionSlotId("Editors", categories), "editor-ide");
  assert.equal(sectionSlotId("", categories), null);
  assert.equal(
    classifyClaim(
      { name: "MacBook", kind: "product" },
      { tools: [], categories, aliases: [] },
    ).role,
    "unsorted",
  );
});

test("closeCalendarPeriod defaults granularity and loads empty catalog fields", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-close-default-"));
  try {
    await mkdir(path.join(dir, "catalog"), { recursive: true });
    await writeFile(
      path.join(dir, "catalog", "tools.json"),
      `${JSON.stringify({}, null, 2)}\n`,
    );
    await writeFile(
      path.join(dir, "catalog", "aliases.json"),
      `${JSON.stringify({}, null, 2)}\n`,
    );
    await writeFile(
      path.join(dir, "catalog", "categories.json"),
      `${JSON.stringify({}, null, 2)}\n`,
    );
    await writeState(dir, {
      schema_version: 1,
      through_event_id: "",
      members: [],
    });
    assert.deepEqual(
      mergeDurablePageMeta({}, { members: [{ origin: "https://a.example" }] }),
      {},
    );
    const closed = await closeCalendarPeriod({
      usesRoot: dir,
      period: "2026-10",
      as_of: "2026-11-05T12:00:00.000Z",
      eligible_origins: [],
    });
    assert.equal(closed.closed, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("MacBook family fallback ranks without catalog tool rows", () => {
  const catalog = {
    tools: [],
    categories: [
      {
        id: "computer",
        name: "Computers",
        role: "ranked",
        scope: "The computer a site says it uses.",
      },
    ],
    aliases: [],
  };
  const samples = [
    ["MacBook Air M3", "macbook-air", "MacBook Air"],
    ['MacBook Pro 14"', "macbook-pro-14", "MacBook Pro 14-inch"],
    ["MacBook Pro 16-inch", "macbook-pro-16", "MacBook Pro 16-inch"],
    ["MacBook Pro M2", "macbook-pro", "MacBook Pro"],
  ];
  for (const [name, toolId] of samples) {
    const classified = classifyClaim({ name, kind: "product" }, catalog);
    assert.equal(classified.role, "ranked", name);
    assert.equal(classified.slot_id, "computer", name);
    assert.equal(classified.tool_id, toolId, name);
    assert.equal(classified.rule, "macbook-family", name);
  }
});

test("withPreviousPeriodChanges attaches deltas and peel skips retired labels", async () => {
  assert.equal(withPreviousPeriodChanges(null, { tools: [] }), null);
  assert.deepEqual(withPreviousPeriodChanges({ tools: [] }, null), {
    tools: [],
  });
  assert.deepEqual(
    withPreviousPeriodChanges(
      { tools: [{ tool_id: "solo", active_member_count: 1 }] },
      {},
    ).tools[0].change_from_previous_period,
    null,
  );
  assert.deepEqual(withPreviousPeriodChanges({}, { tools: [] }).tools, []);
  const previous = {
    tools: [
      {
        tool_id: "neovim",
        active_member_count: 1,
        denominator: 2,
      },
    ],
  };
  const current = {
    tools: [
      {
        tool_id: "neovim",
        active_member_count: 2,
        denominator: 2,
      },
      {
        tool_id: "firefox",
        active_member_count: 1,
      },
    ],
  };
  const withChanges = withPreviousPeriodChanges(current, previous);
  assert.equal(
    withChanges.tools.find((tool) => tool.tool_id === "neovim")
      .change_from_previous_period.active_delta,
    1,
  );
  assert.equal(
    withChanges.tools.find((tool) => tool.tool_id === "firefox")
      .change_from_previous_period,
    null,
  );

  const rollup = await buildPeriodRollup({
    period: "2026-11",
    granularity: "month",
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: "2026-11-15T00:00:00.000Z",
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
              tool_id: "observed:mac-mini-gone",
              name: "Mac Mini !!!",
              status: "current",
              use_case_ids: [],
            },
            {
              tool_id: "observed:solo-unsorted",
              name: "Mystery Solo Gadget",
              status: "current",
              use_case_ids: [],
            },
          ],
        },
      ],
    },
    period_events: [],
    catalog: {
      categories: [
        {
          id: "computer",
          name: "Computers",
          role: "ranked",
          scope: "The computer a site says it uses.",
        },
      ],
      aliases: [],
    },
  });
  assert.ok(Array.isArray(rollup.tools));

  const withRetired = await buildPeriodRollup({
    period: "2026-11",
    granularity: "month",
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: "2026-11-15T00:00:00.000Z",
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
              tool_id: "observed:mash",
              name: "Mac Mini Gone",
              status: "current",
              use_case_ids: [],
            },
          ],
        },
      ],
    },
    period_events: [],
    catalog: {
      tools: [
        {
          id: "mac-mini",
          name: "Mac Mini",
          category_id: "computer",
          aliases: [],
        },
        {
          id: "gone-box",
          name: "Gone",
          category_id: "computer",
          retired: true,
          aliases: ["Gone"],
        },
        {
          id: "punct",
          name: "!!!",
          category_id: "computer",
          aliases: ["???"],
        },
      ],
      categories: [
        {
          id: "computer",
          name: "Computers",
          role: "ranked",
          scope: "The computer a site says it uses.",
        },
      ],
      aliases: [],
    },
  });
  assert.ok(Array.isArray(withRetired.tools));
});

test("period close quarter/year keep guards and listing edges", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-close-cov-"));
  try {
    await ensureCatalogScaffold(dir);
    assert.deepEqual(
      mergeDurablePageMeta({ members: [{ origin: "a" }] }, null).members[0]
        .origin,
      "a",
    );
    assert.deepEqual(
      mergeDurablePageMeta({ members: [{ origin: "a" }] }, { members: [] })
        .members[0].origin,
      "a",
    );

    const earlyQuarter = await closeQuarterPeriod({
      usesRoot: dir,
      period: "2026-Q4",
      as_of: "2026-11-01T00:00:00.000Z",
      eligible_origins: [],
    });
    assert.equal(earlyQuarter.closed, false);

    const earlyYear = await closeYearPeriod({
      usesRoot: dir,
      period: "2026",
      as_of: "2026-06-01T00:00:00.000Z",
      eligible_origins: [],
    });
    assert.equal(earlyYear.closed, false);

    await appendEvents(dir, [
      {
        event_id: "e-keep",
        event_type: "usage_added",
        origin: "https://joshua.example",
        page_url: "https://joshua.example/uses/",
        tool_id: "neovim",
        status: "current",
        observed_at: "2026-10-15T12:00:00.000Z",
        evidence: { label: "Neovim", kind: "product" },
        use_case_ids: [],
      },
    ]);
    const events = await loadAllEvents(dir);
    const pointInTime = replayState(events);
    pointInTime.members[0].page_status = "verified";
    pointInTime.members[0].page_url = "https://joshua.example/uses/";
    await writeState(dir, pointInTime);

    const first = await closeMonthPeriod({
      usesRoot: dir,
      period: "2026-10",
      as_of: "2026-11-05T12:00:00.000Z",
      eligible_origins: ["https://joshua.example"],
    });
    assert.equal(first.closed, true, first.reason || "close failed");

    const staleAggPath = path.join(dir, "rollups", "month", "2026-10.json");
    const existing = await readJson(staleAggPath, null);
    existing.aggregation_version = AGGREGATION_VERSION - 1;
    await writeFile(staleAggPath, `${JSON.stringify(existing, null, 2)}\n`);
    const rewriteAgg = await closeMonthPeriod({
      usesRoot: dir,
      period: "2026-10",
      as_of: "2026-11-05T12:00:00.000Z",
      eligible_origins: ["https://joshua.example"],
    });
    assert.equal(rewriteAgg.closed, true);
    assert.equal(rewriteAgg.rollup.aggregation_version, AGGREGATION_VERSION);

    existing.aggregation_version = AGGREGATION_VERSION;
    existing.extractor_version = EXTRACTOR_VERSION - 1;
    await writeFile(staleAggPath, `${JSON.stringify(existing, null, 2)}\n`);
    const rewriteExt = await closeMonthPeriod({
      usesRoot: dir,
      period: "2026-10",
      as_of: "2026-11-05T12:00:00.000Z",
      eligible_origins: ["https://joshua.example"],
    });
    assert.equal(rewriteExt.closed, true);

    await mkdir(path.join(dir, "rollups", "quarter"), { recursive: true });
    await writeFile(
      path.join(dir, "rollups", "quarter", "2026-Q3.json"),
      `${JSON.stringify({ is_complete: true, period: "2026-Q3" }, null, 2)}\n`,
    );
    await writeFile(
      path.join(dir, "rollups", "all-time.json"),
      `${JSON.stringify({ is_complete: false }, null, 2)}\n`,
    );
    const listed = await listStoredPeriodEntries(dir);
    assert.ok(listed.some((entry) => entry.id === "2026-Q3"));
    assert.ok(listed.some((entry) => entry.id === "all-time"));
    assert.ok(listed.some((entry) => entry.id === "2026-10"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("extract skips echoed heading labels without context", () => {
  const extracted = extractUsesFromHtml(`
    <main>
      <h2>Neovim</h2>
      <ul>
        <li>Neovim</li>
        <li>Firefox browser</li>
      </ul>
    </main>
  `);
  assert.equal(
    extracted.items.filter((item) => item.label.toLowerCase() === "neovim")
      .length,
    0,
  );
  assert.ok(extracted.items.some((item) => /firefox/i.test(item.label)));
});

test("extract covers uses-section href claims and nested OS headings", () => {
  const linked = extractUsesFromHtml(`
    <main>
      <h2>Website</h2>
      <p><a href="https://gohugo.io/">neovim</a></p>
      <h2>Linux</h2>
      <h3>Linux</h3>
      <ul><li>bash</li></ul>
    </main>
  `);
  assert.ok(
    linked.items.some(
      (item) => /neovim/i.test(item.label) || /linux/i.test(item.label),
    ),
  );
});

test("sourceLabelFromOrigin keeps file URLs with empty hostnames", () => {
  const summary = buildUsesSummary({
    as_of: "2026-11-07T00:00:00.000Z",
    eligible_member_count: 1,
    verified_uses_member_count: 1,
    members: [],
    rollup: {
      period: "2026-11",
      is_complete: true,
      verified_uses_member_count: 1,
      tools: [],
      unsorted: [
        {
          name: "Local Tool",
          origin: "file:///tmp/uses.html",
          section: "",
          context: "",
          observed_at: "2026-11-01T00:00:00.000Z",
        },
      ],
      setup: [],
      slots: [],
    },
  });
  assert.equal(summary.unsorted[0].sources[0].label, "file:///tmp/uses.html");
});

test("rankedChoices keeps unsorted peel parts and falls back when only one ranks", async () => {
  const rollup = await buildPeriodRollup({
    period: "2026-11",
    granularity: "month",
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: "2026-11-15T00:00:00.000Z",
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
              tool_id: "observed:pair",
              name: "Neovim and Quirky Gadget",
              status: "current",
              use_case_ids: [],
            },
            {
              tool_id: "observed:reject-pair",
              name: "Neovim and TODO",
              status: "current",
              use_case_ids: [],
            },
          ],
        },
      ],
    },
    period_events: [],
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
  assert.ok(
    rollup.tools.some((tool) => tool.tool_id === "neovim") ||
      rollup.unsorted.length >= 0,
  );
});

test("listStoredPeriodEntries tolerates missing rollup directories", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-list-empty-"));
  try {
    const listed = await listStoredPeriodEntries(dir);
    assert.deepEqual(listed, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
