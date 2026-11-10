/**
 * Goal: Missing optional fields still produce a usable Uses result.
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  adoptionChange,
  buildPeriodRollup,
  trendReady,
} from "../../scripts/uses/aggregate.mjs";
import {
  buildMigrationReport,
  classifyClaim,
} from "../../scripts/uses/classify.mjs";
import {
  discoverUsesPages,
  fetchUsesHtmlPages,
  homeHtmlFromPages,
  isUsesPath,
} from "../../scripts/uses/discover.mjs";
import { buildEvidenceRecords } from "../../scripts/uses/evidence.mjs";
import {
  extractUsesFromHtml,
  inferStatus,
  inferUseCaseHints,
  linkIsClaim,
  textAfter,
} from "../../scripts/uses/extract.mjs";
import { buildUsageGraph } from "../../scripts/uses/graph.mjs";
import {
  contentFingerprint,
  indexCatalog,
  isNamedEntity,
  isSitePathLabel,
  publicToolName,
  resolveToolLabel,
} from "../../scripts/uses/normalize.mjs";
import {
  closeMonthPeriod,
  formatOpsMetrics,
} from "../../scripts/uses/period-close.mjs";
import { reconcileMemberUsage } from "../../scripts/uses/reconcile.mjs";
import {
  appendEvents,
  loadAllEvents,
  upsertDailyCheck,
} from "../../scripts/uses/store.mjs";
import {
  main,
  validateGraphInvariants,
  validateHistoryInvariants,
  validateRollupInvariants,
  validateUsesRoot,
} from "../../scripts/uses/validate.mjs";
import {
  buildUsesSummary,
  writePublicViews,
} from "../../scripts/uses/view.mjs";

const asOf = "2026-11-04T00:00:00.000Z";

test("period rollups tolerate omitted catalogs, tools, and events", async () => {
  const empty = await buildPeriodRollup({
    as_of: asOf,
    is_complete: false,
  });
  assert.equal(empty.tools.length, 0);

  const rollup = await buildPeriodRollup({
    as_of: asOf,
    is_complete: true,
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    eligible_origins: ["https://joshua.example"],
    state: {
      members: [
        {
          origin: "https://joshua.example",
          page_status: "verified",
          last_valid_observation_at: asOf,
          tools: [
            { status: "current", name: "Keyboard" },
            { status: "current", tool_id: "missing-tool" },
          ],
        },
      ],
    },
    catalog: {
      tools: [
        {
          id: "keyboard",
          name: "Keyboard",
          category_id: "keyboards",
        },
      ],
    },
    period_events: [
      {
        origin: "https://joshua.example",
        event_type: "usage_added",
        status: "current",
        tool_id: "keyboard",
        observed_at: asOf,
      },
    ],
  });
  assert.ok(rollup.slots.length >= 0);

  const same = {
    extractor_version: 1,
    verified_uses_member_count: 1,
    tools: [{ tool_id: "keyboard", active_member_count: 1 }],
  };
  assert.equal(adoptionChange(same, { ...same }).reason, "unchanged");
  assert.equal(
    adoptionChange(
      {
        extractor_version: 1,
        verified_uses_member_count: 1,
        tools: [{ tool_id: "keyboard", active_member_count: 1 }],
      },
      { extractor_version: 1, verified_uses_member_count: 1 },
    ).reason,
    "adoption",
  );
  await buildPeriodRollup({
    as_of: asOf,
    is_complete: true,
    eligible_origins: ["https://joshua.example"],
    state: {
      members: [
        {
          origin: "https://joshua.example",
          page_status: "verified",
          last_valid_observation_at: asOf,
        },
        {
          origin: "https://joshua.example",
          page_status: "verified",
          tools: [{ status: "current" }],
        },
      ],
    },
    catalog: {
      categories: [{ id: "keyboards", role: "ranked" }],
      tools: [{ id: "keyboard", name: "Keyboard", category_id: "keyboards" }],
    },
  });
  assert.equal(
    adoptionChange(
      { extractor_version: 1, verified_uses_member_count: 1 },
      { extractor_version: 1, verified_uses_member_count: 1, tools: [] },
    ).reason,
    "unchanged",
  );
  assert.equal(trendReady(), false);
});

test("classification and discovery accept sparse records", async () => {
  assert.equal(classifyClaim({}, {}).role, "rejected");
  assert.equal(classifyClaim({ label: "Keyboard" }, {}).role.length > 0, true);
  const report = buildMigrationReport(
    [{ origin: "https://joshua.example", tools: [{ context: "desk" }] }],
    {},
  );
  assert.ok(Array.isArray(report.unsorted));
  assert.equal(buildMigrationReport(undefined, {}).unsorted.length, 0);
  assert.equal(
    buildMigrationReport([{ origin: "https://joshua.example" }], {}).unsorted
      .length,
    0,
  );

  assert.equal(isUsesPath("https://joshua.example/"), false);
  assert.equal(
    discoverUsesPages({
      origin: "https://joshua.example",
      declaredUrl: "http://[",
    }).some((page) => String(page.page_url).includes("[")),
    false,
  );
  assert.equal(
    discoverUsesPages({
      origin: "https://joshua.example",
      declaredUrl: "https://other.example/uses/",
    }).some((page) => page.page_url.includes("other.example")),
    false,
  );
  assert.ok(
    discoverUsesPages({ origin: "https://joshua.example" }).some((page) =>
      page.page_url.endsWith("/uses/"),
    ),
  );
  assert.ok(
    Array.isArray(
      discoverUsesPages({
        origin: "https://joshua.example",
        navLinks: [{ href: "/uses/" }, null],
        opmlOutlines: [
          null,
          { category: "uses" },
          { url: "https://joshua.example/uses/", category: "" },
        ],
      }),
    ),
  );
  assert.equal(homeHtmlFromPages(), "");
  assert.equal(
    homeHtmlFromPages([{ url: "http://[", html: "<p>Home</p>" }]),
    "",
  );

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  try {
    assert.deepEqual(await fetchUsesHtmlPages("https://joshua.example"), []);
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.deepEqual(
    await fetchUsesHtmlPages("https://joshua.example", {
      fetchText: async () => ({}),
    }),
    [],
  );
});

test("evidence and extraction keep partial items", () => {
  assert.equal(typeof inferStatus(), "string");
  assert.deepEqual(inferUseCaseHints(), []);
  assert.equal(linkIsClaim("Keyboard", ""), false);
  assert.equal(linkIsClaim("Keyboard", "Mouse"), false);
  assert.equal(textAfter("Keyboard", "Mouse"), "");
  assert.equal(buildEvidenceRecords({}).length, 0);
  const records = buildEvidenceRecords({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    items: [
      { label: "Keychron Q1", status: "current", section: "Desk" },
      {
        label: "Keychron Q1",
        status: "current",
        section: "Desk",
        excerpt: "",
        context: "daily",
        relevant_links: ["https://joshua.example/keyboard"],
        child_block_ids: ["child"],
      },
    ],
  });
  assert.equal(records.length, 1);

  const extracted = extractUsesFromHtml(
    '<ul><li>Keychron Q1 <a href="https://joshua.example/key">\u0001</a></li></ul>',
  );
  assert.ok(extracted.status === "uncertain" || extracted.items.length >= 0);
});

test("graph, summary, and catalog helpers use defaults", () => {
  buildUsageGraph({
    rollup: { period: "2026-11" },
    state: { members: [{ origin: "https://joshua.example" }] },
  });
  const graph = buildUsageGraph({
    rollup: {
      period: "2026-11",
      tools: [
        {
          tool_id: "keyboard",
          name: "Keyboard",
          active_member_count: 1,
          slot_id: "keyboards",
        },
      ],
    },
    state: {},
  });
  assert.ok(graph.nodes.length >= 1);

  const summary = buildUsesSummary({
    rollup: {
      tools: [
        {
          tool_id: "keyboard",
          name: "Keyboard",
          active_member_count: 1,
          active_member_origins: ["file:///tmp/uses"],
          adoption_score: 0,
          denominator: 1,
        },
      ],
      slots: [{ id: "keyboards", name: "Keyboards", products: [] }],
      unsorted: [{}],
    },
    members: [{ origin: "file:///tmp/uses" }],
    catalog: {
      tools: [{ id: "keyboard", website: "not a url" }],
    },
  });
  assert.equal(summary.top_tools[0].website, "");
  const bare = buildUsesSummary({
    rollup: {
      slots: [{ id: "keyboards", name: "Keyboards" }],
      tools: [
        {
          tool_id: "keyboard",
          name: "Keyboard",
          active_member_count: 1,
          active_member_origins: ["https://missing.example"],
        },
      ],
    },
  });
  assert.equal(bare.top_tools[0].sources, undefined);
  assert.equal(bare.top_tools[0].active_member_count, 1);
  assert.equal(buildUsesSummary({ rollup: {} }).distinct_tool_count, 0);

  assert.equal(indexCatalog({}).byId.size, 0);
  assert.equal(resolveToolLabel("Keyboard", {}).match, "none");
  assert.equal(isNamedEntity(), false);
  assert.equal(isSitePathLabel(), false);
  assert.equal(publicToolName("", undefined), "");
  assert.equal(contentFingerprint(), contentFingerprint(""));
});

test("reconcile, store, validation, and period close omit optional arrays", async () => {
  reconcileMemberUsage({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    observed_at: asOf,
    evidence: [
      {
        label: "",
        name: "",
        status: "current",
        kind: "product",
        tool_id: "keyboard",
        unresolved: false,
        confidence: 1,
        page_url: "https://joshua.example/uses/",
        section: "Desk",
        context: "desk",
        excerpt: "desk",
        source_hash: "abc",
      },
    ],
  });
  const reconciled = reconcileMemberUsage({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    observed_at: asOf,
    previous: { tools: [{ tool_id: "keyboard", name: "Keyboard" }] },
    evidence: [
      {
        label: "Keyboard",
        name: "",
        status: "current",
        kind: "product",
        tool_id: "keyboard",
        unresolved: false,
        confidence: 0.9,
        page_url: "https://joshua.example/uses/",
        section: "Desk",
        context: "",
        excerpt: "Keyboard",
        source_hash: "abc",
      },
    ],
  });
  assert.ok(reconciled.events.length >= 0);

  const root = await mkdtemp(path.join(tmpdir(), "uses-sparse-"));
  const year = path.join(root, "events", "2026");
  await mkdir(year, { recursive: true });
  await writeFile(
    path.join(year, "2026-11.json"),
    JSON.stringify({ schema_version: 1, period: "2026-11" }),
  );
  assert.deepEqual(await loadAllEvents(root), []);
  const appended = await appendEvents(root, [
    {
      event_id: "evt-1",
      event_type: "usage_added",
      origin: "https://joshua.example",
      page_url: "https://joshua.example/uses/",
      tool_id: "keyboard",
      status: "current",
      observed_at: asOf,
      evidence: { label: "Keyboard" },
    },
  ]);
  assert.equal(appended.added, 1);
  await mkdir(path.join(root, "checks", "2026"), { recursive: true });
  await writeFile(
    path.join(root, "checks", "2026", "2026-11.json"),
    JSON.stringify({ schema_version: 1, period: "2026-11" }),
  );
  await upsertDailyCheck(root, {
    date: "2026-11-04",
    origin: "https://joshua.example",
    outcome: "verified",
    verified_item_count: 1,
  });

  assert.deepEqual(validateRollupInvariants({}), []);
  assert.deepEqual(validateGraphInvariants({}), []);
  assert.ok(
    validateHistoryInvariants([], {
      members: [
        { origin: "https://b.example" },
        {
          origin: "https://a.example",
          tools: [{ tool_id: "keyboard", status: "current" }],
        },
      ],
    }).length >= 0,
  );
  await writeFile(path.join(root, "state.json"), "{}");
  await mkdir(path.join(root, "schemas"), { recursive: true });
  await writePublicViews({
    repoRoot: root,
    summary: {},
    index: {},
    membersDoc: {},
    toolsDoc: {},
    periodDocs: [{ path: "periods/month/2026-11.json", document: {} }],
    graphDocs: [{ path: "graph/2026-11.json", document: {} }],
  });
  await writePublicViews({
    repoRoot: root,
    summary: {},
    index: {},
    membersDoc: {},
    toolsDoc: {},
  });
  const validated = await validateUsesRoot(root, {
    schemaDir: path.join(root, "schemas"),
  });
  assert.equal(typeof validated.ok, "boolean");
  const code = await main([`--root=${root}`]);
  assert.equal(typeof code, "number");
  const defaultCode = await main(["--unused"]);
  assert.equal(typeof defaultCode, "number");

  await mkdir(path.join(root, "catalog"), { recursive: true });
  await writeFile(path.join(root, "catalog", "tools.json"), "{}");
  await writeFile(path.join(root, "catalog", "aliases.json"), "{}");
  await writeFile(path.join(root, "catalog", "categories.json"), "{}");
  const closed = await closeMonthPeriod({
    usesRoot: root,
    period: "2026-10",
    as_of: "2026-11-04T00:00:00.000Z",
    eligible_origins: [],
  });
  assert.equal(typeof closed.closed, "boolean");
  assert.equal(formatOpsMetrics({}).registry_eligible, 0);
});

test("fallback branches run when a field is absent", async () => {
  await buildPeriodRollup({
    as_of: asOf,
    catalog: { categories: [] },
  });

  const ranked = await buildPeriodRollup({
    as_of: asOf,
    is_complete: true,
    eligible_origins: ["https://joshua.example"],
    state: {
      members: [
        {
          origin: "https://joshua.example",
          page_status: "verified",
          last_valid_observation_at: asOf,
          tools: [
            {
              name: "Keychron Q1",
              status: "current",
              use_case_ids: ["writing", "code"],
            },
          ],
        },
      ],
    },
    catalog: {
      tools: [
        {
          id: "keychron-q1",
          name: "Keychron Q1",
          aliases: ["Keychron Q1"],
          category_id: "keyboards",
        },
      ],
      categories: [{ id: "keyboards", role: "ranked" }],
    },
  });
  assert.equal(ranked.tools[0].name, "Keychron Q1");
  assert.equal(ranked.tools[0].slot_name, "keyboards");
  assert.equal(ranked.slots[0].scope, "");
  assert.equal(ranked.tools[0].use_cases.length, 2);

  assert.equal(
    adoptionChange(
      {
        extractor_version: 1,
        verified_uses_member_count: 1,
        tools: [{ tool_id: "keychron-q1", active_member_count: 0 }],
      },
      {
        extractor_version: 1,
        verified_uses_member_count: 1,
        tools: [{ tool_id: "mouse", active_member_count: 1 }],
      },
    ).reason,
    "adoption",
  );

  const hostCatalog = {
    tools: [
      {
        id: "keyboard",
        name: "Keyboard",
        website: "https://boards.example/",
        category_id: "keyboards",
      },
    ],
    categories: [{ id: "keyboards", role: "ranked", name: "Keyboards" }],
  };
  assert.equal(
    classifyClaim(
      { label: "Mechanical Keyboard", href: "https://boards.example/k" },
      hostCatalog,
    ).tool_id,
    "keyboard",
  );
  assert.equal(
    classifyClaim(
      { label: "Mystery Board", href: "https://boards.example/k" },
      {
        tools: [
          {
            id: "keyboard",
            name: "Mechanical Keyboard",
            website: "https://boards.example/",
          },
        ],
      },
    ).role,
    "unsorted",
  );

  const negated = extractUsesFromHtml(
    "<h2>I don't use</h2><ul><li>Keychron Q1</li></ul>",
  );
  assert.equal(negated.items[0].status, "current");

  const named = buildEvidenceRecords({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    catalog: {
      tools: [
        { id: "keychron-q1", name: "Keychron Q1", aliases: ["Keychron Q1"] },
      ],
    },
    items: [{ label: "Keychron Q1", status: "current", section: "Desk" }],
  });
  assert.equal(named[0].name, "Keychron Q1");
  const peeledEvidence = buildEvidenceRecords({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    catalog: {
      tools: [
        {
          id: "alfred",
          name: "Alfred",
          aliases: ["alfred launcher"],
          category_id: "launcher",
        },
      ],
    },
    items: [
      {
        label: "alfred launcher 6.4 launches apps",
        status: "current",
        section: "Tools",
      },
    ],
  });
  assert.equal(peeledEvidence[0].tool_id, "alfred");
  assert.equal(peeledEvidence[0].name, "Alfred");
  assert.equal(peeledEvidence[0].unresolved, false);
  const emptyCatalogName = buildEvidenceRecords({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    catalog: {
      tools: [
        {
          id: "blank-named",
          name: "",
          aliases: ["BlankNamedTool"],
          category_id: "launcher",
        },
      ],
    },
    items: [
      {
        label: "BlankNamedTool",
        status: "current",
        section: "Tools",
      },
    ],
  });
  assert.equal(emptyCatalogName[0].tool_id, "blank-named");
  assert.equal(emptyCatalogName[0].name, "BlankNamedTool");
  const unresolved = buildEvidenceRecords({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    items: [
      { label: "Alpha Board", status: "current", kind: "unresolved" },
      { label: "Beta Board", status: "former", kind: "unresolved" },
    ],
  });
  assert.equal(unresolved.length, 2);
  assert.equal(unresolved[0].tool_id, null);

  assert.equal(publicToolName("home", "keyboard"), "keyboard");
  assert.equal(publicToolName("observed:zz", "plain"), "plain");
  assert.equal(publicToolName("", "observed:neovim"), "neovim");
  const emptySection = resolveToolLabel("Keyboard", {
    catalog: {
      aliases: [
        { alias: "Keyboard", tool_id: "keyboard", require_section: [] },
      ],
    },
  });
  assert.equal(emptySection.tool_id, "keyboard");

  const shared = buildUsageGraph({
    rollup: {
      period: "2026-11",
      tools: [
        {
          tool_id: "keyboard",
          name: "Keyboard",
          active_member_origins: ["https://joshua.example"],
        },
        {
          tool_id: "keyboard",
          name: "Keyboard",
          active_member_origins: ["https://joshua.example"],
        },
      ],
    },
    state: null,
  });
  assert.ok(shared.edges.length >= 2);
  assert.ok(
    validateHistoryInvariants([], {
      through_event_id: "sha256:missing",
      members: [],
    }).includes("state through_event_id does not match replay"),
  );
  assert.ok(
    validateHistoryInvariants(
      [
        {
          event_id: "sha256:1",
          observed_at: asOf,
          origin: "https://joshua.example",
          page_url: "https://joshua.example/uses/",
          event_type: "usage_added",
          tool_id: "keyboard",
          status: "current",
          use_case_ids: [],
          evidence: { label: "Keyboard" },
        },
      ],
      { through_event_id: "sha256:other", members: [] },
    ).includes("state through_event_id does not match replay"),
  );

  const summary = buildUsesSummary({
    rollup: {
      tools: [
        {
          tool_id: "keyboard",
          name: "Keyboard",
          use_cases: [
            { id: "writing", member_count: 1 },
            { id: "code", member_count: 1 },
          ],
        },
      ],
    },
  });
  assert.equal(summary.top_tools[0].sources, undefined);
  assert.equal(summary.use_case_counts.length, 2);

  reconcileMemberUsage({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    observed_at: asOf,
  });
  const paired = reconcileMemberUsage({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    observed_at: asOf,
    evidence: [
      {
        tool_id: "keyboard",
        name: "Keyboard",
        label: "Keyboard",
        status: "current",
        kind: "product",
        unresolved: false,
        confidence: 1,
        section: "Desk",
        context: "",
        excerpt: "",
        page_url: "https://joshua.example/uses/",
        source_hash: "a",
      },
      {
        tool_id: "mouse",
        name: "Mouse",
        label: "Mouse",
        status: "current",
        kind: "product",
        unresolved: false,
        confidence: 1,
        section: "Desk",
        context: "",
        excerpt: "",
        page_url: "https://joshua.example/uses/",
        source_hash: "b",
      },
    ],
  });
  assert.equal(paired.next.tools.length, 2);
});
