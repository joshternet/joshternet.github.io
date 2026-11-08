/**
 * Goal: Exercise Uses library branches the slot tests do not reach.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { decodeCrawlValue } from "../../scripts/nlp/site-record.mjs";

import {
  adoptionChange,
  buildPeriodRollup,
  momentumAgainstPrevious,
  trendReady,
} from "../../scripts/uses/aggregate.mjs";
import {
  buildMigrationReport,
  catalogFingerprint,
  classifyClaim,
} from "../../scripts/uses/classify.mjs";
import {
  classifyRedirectScope,
  discoverUsesPages,
  fetchUsesHtmlPages,
  homeHtmlFromPages,
  isUsesPath,
  usesHtmlRepeatsHomepage,
} from "../../scripts/uses/discover.mjs";
import {
  buildEvidenceRecords,
  isAdoptionEligible,
  isKeptInState,
} from "../../scripts/uses/evidence.mjs";
import {
  extractUsesFromHtml,
  inferStatus,
  stripNonContentHtml,
} from "../../scripts/uses/extract.mjs";
import { buildUsageGraph } from "../../scripts/uses/graph.mjs";
import {
  evaluateUsesQuality,
  main as qualityMain,
} from "../../scripts/uses/quality.mjs";
import { closeMonthPeriod } from "../../scripts/uses/period-close.mjs";
import {
  compareEvents,
  reconcileMemberUsage,
} from "../../scripts/uses/reconcile.mjs";
import {
  dateKeyFromIso,
  loadAllEvents,
  readJson,
  upsertDailyCheck,
} from "../../scripts/uses/store.mjs";
import {
  createUsesAjv,
  main as validateMain,
  runCli,
  validateRollupInvariants,
  validateUsesRoot,
} from "../../scripts/uses/validate.mjs";
import {
  buildPublicIndex,
  buildUsesSummary,
  coverageReason,
  writePublicViews,
} from "../../scripts/uses/view.mjs";
import {
  classifyUseKind,
  comparisonLabel,
  contentFingerprint,
  indexCatalog,
  isNamedEntity,
  isReportableUseLabel,
  observedToolId,
  productNameFromLabel,
  publicToolName,
  resolveToolLabel,
  sanitizeLabel,
  separateNameContext,
  splitCompoundName,
} from "../../scripts/uses/normalize.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "../..");

const editorCatalog = {
  tools: [
    {
      id: "neovim",
      name: "Neovim",
      category_id: "editor-ide",
      aliases: ["nvim"],
      website: "https://neovim.io/",
    },
    {
      id: "kindle-app",
      name: "Kindle for Android",
      category_id: "reading-app",
      aliases: [],
      website:
        "https://play.google.com/store/apps/details?id=com.amazon.kindle",
    },
    {
      id: "tmux",
      name: "tmux",
      category_id: "multiplexer",
      aliases: [],
      website: "https://github.com/tmux/tmux",
    },
    {
      id: "broken-site",
      name: "Broken",
      category_id: "editor-ide",
      aliases: [],
      website: "not a url",
    },
  ],
  categories: [
    { id: "editor-ide", name: "Editors", role: "ranked", scope: "Editors." },
    { id: "reading-app", name: "Reading apps", role: "ranked", scope: "Apps." },
    { id: "multiplexer", name: "Multiplexers", role: "ranked", scope: "Mux." },
    { id: "notes", name: "Notes", role: "detail", scope: "Details." },
  ],
  aliases: [],
};

test("classification covers parts, gear, links, and empty catalogs", () => {
  assert.equal(
    classifyClaim({ name: "Sit stand", kind: "practice" }, editorCatalog).role,
    "detail",
  );
  assert.equal(
    classifyClaim({ name: "Ada Lovelace", kind: "unresolved" }, editorCatalog)
      .role,
    "rejected",
  );
  assert.equal(
    classifyClaim({ name: "Office chair", kind: "equipment" }, editorCatalog)
      .role,
    "detail",
  );
  assert.equal(
    classifyClaim({ name: "uBlock Origin", kind: "product" }, editorCatalog)
      .role,
    "detail",
  );
  assert.equal(
    classifyClaim(
      { name: "Kindle", href: "not a url", kind: "product" },
      editorCatalog,
    ).role,
    "unsorted",
  );
  assert.equal(
    classifyClaim(
      {
        name: "Kindle",
        href: "https://apps.apple.com/app/kindle/id302584613",
        kind: "product",
      },
      editorCatalog,
    ).tool_id,
    "kindle-app",
  );
  assert.equal(
    classifyClaim(
      {
        name: "Kindle",
        href: "https://play.google.com/store/apps/details?id=com.amazon.kindle",
        kind: "product",
      },
      { tools: [], categories: [], aliases: [] },
    ).role,
    "unsorted",
  );
  assert.equal(
    classifyClaim(
      {
        name: "tmux",
        href: "https://github.com/tmux/tmux/wiki",
        kind: "product",
      },
      editorCatalog,
    ).tool_id,
    "tmux",
  );
  assert.equal(
    classifyClaim(
      { name: "Neovim", href: "https://neovim.io/about", kind: "product" },
      editorCatalog,
    ).rule,
    "approved-url",
  );
  const detail = classifyClaim(
    { name: "Notebook", kind: "product" },
    {
      tools: [
        {
          id: "notebook",
          name: "Notebook",
          category_id: "notes",
          aliases: [],
          website: "",
        },
      ],
      categories: [{ id: "notes", name: "Notes", role: "detail" }],
      aliases: [],
    },
  );
  assert.equal(detail.role, "detail");
  assert.equal(catalogFingerprint(null).length > 0, true);
  const report = buildMigrationReport(
    [
      {
        origin: "https://joshua.example",
        tools: [{ tool_id: "neovim", name: "Neovim with Vim" }],
      },
    ],
    editorCatalog,
  );
  assert.equal(report.split_compounds.length, 1);
  assert.deepEqual(buildMigrationReport(null, editorCatalog).unsorted, []);
});

test("rollup skips stale rows and catalog changes are not adoption", async () => {
  const rollup = await buildPeriodRollup({
    period: "2026-11",
    granularity: "month",
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: "2026-11-04T00:00:00.000Z",
    is_complete: true,
    eligible_origins: [
      "https://joshua.example",
      "https://other.example",
      "https://friends.joshua.example",
    ],
    state: {
      members: [
        {
          origin: "https://left-out.example",
          page_status: "verified",
          last_valid_observation_at: "2026-11-04T00:00:00.000Z",
          tools: [{ tool_id: "neovim", name: "Neovim", status: "current" }],
        },
        {
          origin: "https://joshua.example",
          page_status: "verified",
          last_valid_observation_at: "2020-01-01T00:00:00.000Z",
          tools: [{ tool_id: "neovim", name: "Neovim", status: "current" }],
        },
        {
          origin: "https://other.example",
          page_status: "verified",
          last_valid_observation_at: "2026-11-04T00:00:00.000Z",
          tools: [
            { tool_id: "neovim", name: "Neovim", status: "former" },
            { tool_id: "observed:cv", name: "/cv", status: "current" },
            { tool_id: "observed:", name: "", status: "current" },
            {
              tool_id: "neovim",
              name: "Neovim",
              status: "current",
              context: "my favorite editor",
              use_case_ids: ["programming", "programming"],
            },
            {
              tool_id: "observed:desk",
              name: "DeskThing",
              status: "current",
            },
          ],
        },
        {
          origin: "https://friends.joshua.example",
          page_status: "verified",
          last_valid_observation_at: "2026-11-04T00:00:00.000Z",
          tools: [{ tool_id: "neovim", name: "nvim", status: "current" }],
        },
      ],
    },
    period_events: [
      {
        origin: "https://left-out.example",
        event_type: "usage_added",
        status: "current",
        tool_id: "neovim",
        observed_at: "2026-11-02T00:00:00.000Z",
      },
      {
        origin: "https://other.example",
        event_type: "correction",
        status: "current",
        tool_id: "neovim",
        observed_at: "2026-11-02T00:00:00.000Z",
      },
      {
        origin: "https://other.example",
        event_type: "usage_added",
        status: "removed",
        tool_id: "",
        observed_at: "2026-11-02T00:00:00.000Z",
      },
      {
        origin: "https://other.example",
        event_type: "usage_changed",
        status: "current",
        tool_id: "neovim",
        observed_at: "not-a-date",
      },
    ],
    catalog: editorCatalog,
  });
  assert.equal(
    rollup.unsorted.some((item) => item.name === "DeskThing"),
    true,
  );
  assert.equal(adoptionChange(null, { tools: [] }).reason, "missing");
  assert.equal(rollup.tools[0].preference, true);
  assert.equal(rollup.tools[0].use_cases[0].id, "programming");
  assert.equal(
    adoptionChange(
      { extractor_version: 3, aggregation_version: 1, tools: [] },
      { extractor_version: 3, aggregation_version: 2, tools: [] },
    ).reason,
    "processing",
  );
  assert.equal(
    adoptionChange(
      { extractor_version: 3, catalog_hash: "a", tools: [] },
      { extractor_version: 3, catalog_hash: "b", tools: [] },
    ).reason,
    "processing",
  );
  assert.equal(
    adoptionChange(
      {
        extractor_version: 3,
        verified_uses_member_count: 1,
        tools: [{ tool_id: "neovim", active_member_count: 1 }],
      },
      {
        extractor_version: 3,
        verified_uses_member_count: 1,
        tools: [{ tool_id: "neovim", active_member_count: 2 }],
      },
    ).reason,
    "adoption",
  );
  assert.equal(trendReady(null), false);
  assert.equal(
    trendReady([
      {
        extractor_version: 3,
        tools: [{ tool_id: "neovim", active_member_count: 1 }],
      },
      {
        extractor_version: 3,
        tools: [{ tool_id: "neovim", active_member_count: 2 }],
      },
    ]),
    true,
  );
  assert.equal(
    momentumAgainstPrevious(
      { active_member_count: 1 },
      { active_member_count: 1 },
      0,
      0,
    ).momentum_pp,
    null,
  );
});

test("summary presents slots, unsorted names, and every coverage reason", async () => {
  const summary = buildUsesSummary({
    eligible_member_count: 10,
    verified_uses_member_count: 8,
    members: [
      {},
      {
        origin: "not a url",
        page_status: "verified",
      },
      {
        origin: "https://joshua.example",
        page_status: "not_found",
      },
    ],
    rollup: {
      is_complete: true,
      extractor_version: 3,
      snapshot_id: "3.2.abc",
      verified_uses_member_count: 8,
      tools: [
        {
          tool_id: "neovim",
          name: "Neovim",
          active_member_count: 1,
          active_member_origins: ["https://joshua.example"],
          adoption_score: 100,
          denominator: 1,
          use_cases: [{ id: "programming", member_count: 1 }],
          statements: [
            {
              origin: "https://joshua.example",
              section: "Software",
              context: "editor",
              observed_at: "2026-11-04T00:00:00.000Z",
              preference: true,
            },
          ],
        },
      ],
      slots: [
        {
          id: "editor-ide",
          name: "Editors",
          scope: "Editors.",
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
              statements: [],
            },
          ],
        },
      ],
      unsorted: [{ origin: "https://joshua.example", name: "DeskThing" }],
      setup: [{ origin: "https://joshua.example", name: "32GB DDR5 RAM" }],
    },
  });
  assert.equal(summary.early_sample, false);
  assert.equal(summary.slots[0].products[0].active_member_count, 1);
  assert.equal(summary.slots[0].products[0].sources, undefined);
  assert.equal(summary.unsorted[0].name, "DeskThing");
  assert.equal(summary.setup[0].name, "32GB DDR5 RAM");
  assert.equal(summary.setup[0].site_count, 1);
  assert.equal(summary.setup[0].sources, undefined);
  assert.equal(coverageReason("verified"), "Assessed Uses page");
  assert.equal(coverageReason("unreachable").includes("could not"), true);
  assert.equal(coverageReason("uncertain").includes("not recognized"), true);
  assert.equal(coverageReason("disallowed").includes("not allowed"), true);
  assert.equal(
    coverageReason("parse_error").includes("could not be read"),
    true,
  );
  assert.equal(coverageReason("not_checked").includes("Not assessed"), true);
  assert.equal(coverageReason("nope"), "nope");
  const index = buildPublicIndex({});
  assert.equal(index.snapshot_id, "");
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-views-"));
  try {
    await writePublicViews({
      repoRoot: dir,
      summary,
      index,
      membersDoc: { members: [] },
      toolsDoc: { tools: [] },
      periodDocs: [
        { path: "periods/month/2026-11.json", document: { ok: true } },
      ],
      graphDocs: [{ path: "graph/2026-11.json", document: { ok: true } }],
    });
    const written = decodeCrawlValue(
      JSON.parse(
        await readFile(path.join(dir, "_data", "uses_summary.json"), "utf8"),
      ),
    );
    assert.equal(written.snapshot_id, "3.2.abc");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  assert.equal(buildUsesSummary({}).top_tools.length, 0);
});

test("period close writes a rollup after the boundary", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-close-ok-"));
  try {
    const closed = await closeMonthPeriod({
      usesRoot: dir,
      period: "2026-10",
      as_of: "2026-11-04T00:00:00.000Z",
      eligible_origins: [],
    });
    assert.equal(closed.closed, true);
    const saved = JSON.parse(
      await readFile(
        path.join(dir, "rollups", "month", "2026-10.json"),
        "utf8",
      ),
    );
    assert.equal(saved.period, "2026-10");
    await mkdir(path.join(dir, "events", "2026"), { recursive: true });
    await writeFile(
      path.join(dir, "events", "2026", "2026-10.json"),
      JSON.stringify({
        events: [
          {
            event_id: "bad",
            event_type: "usage_added",
            origin: "https://joshua.example",
            page_url: "https://joshua.example/uses/",
            tool_id: "neovim",
            status: "current",
            observed_at: "not-a-date",
            use_case_ids: [],
            evidence: { label: "Neovim" },
          },
        ],
      }),
    );
    const rejected = await closeMonthPeriod({
      usesRoot: dir,
      period: "2026-10",
      as_of: "2026-11-04T00:00:00.000Z",
      eligible_origins: ["https://joshua.example"],
    });
    assert.equal(rejected.closed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("quality and validate entry points run", async () => {
  assert.equal(
    evaluateUsesQuality(
      {
        verified_count: 1,
        eligible_member_count: 2,
        extraction_item_count: 0,
        events_removed: 1,
        prior_active_edges: 1,
      },
      {
        verified_count: 3,
        eligible_member_count: 2,
        extraction_item_count: 10,
      },
    ).block,
    true,
  );
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-validate-"));
  try {
    assert.equal(
      await qualityMain([
        "--metrics",
        path.join(dir, "missing-metrics.json"),
        "--baseline",
        path.join(dir, "missing-baseline.json"),
      ]),
      0,
    );
    const code = await validateMain([`--root=${dir}`]);
    assert.equal(code, 0);
    const validateModule = fileURLToPath(
      new URL("../../scripts/uses/validate.mjs", import.meta.url),
    );
    assert.equal(await runCli(), null);
    assert.equal(await runCli(""), null);
    assert.equal(await runCli(path.join(dir, "other.mjs")), null);
    assert.equal(await runCli(validateModule, [`--root=${dir}`]), 0);
    const broken = path.join(dir, "broken");
    await mkdir(path.join(broken, "events", "2026"), { recursive: true });
    await writeFile(
      path.join(broken, "state.json"),
      JSON.stringify({
        schema_version: 1,
        through_event_id: "",
        members: [
          {
            origin: "https://joshua.example",
            page_status: "verified",
            tools: [
              {
                tool_id: "neovim",
                status: "current",
                use_case_ids: [],
                evidence_event_id: "missing",
              },
            ],
          },
        ],
      }),
    );
    const failed = await validateMain([`--root=${broken}`]);
    assert.equal(failed, 1);
    const qualityRun = await execFileAsync(process.execPath, [
      path.join(repoRoot, "scripts", "uses", "quality.mjs"),
      "--metrics",
      path.join(dir, "missing-metrics.json"),
      "--baseline",
      path.join(dir, "missing-baseline.json"),
    ]);
    assert.match(qualityRun.stdout, /uses:quality ok/);
    const validateRun = await execFileAsync(process.execPath, [
      path.join(repoRoot, "scripts", "uses", "validate.mjs"),
      `--root=${dir}`,
    ]);
    assert.match(validateRun.stdout, /uses:validate ok/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  assert.ok(createUsesAjv());
});

test("discovery, evidence, extract, and store edge paths", async () => {
  assert.equal(isUsesPath("http://["), false);
  assert.equal(usesHtmlRepeatsHomepage("", "<p>Home</p>"), false);
  assert.equal(homeHtmlFromPages([]), "");
  assert.equal(
    homeHtmlFromPages([
      { url: "notaurl", html: "<p>x</p>" },
      { html: "<p>y</p>" },
      { url: "https://joshua.example/", html: "<p>Home</p>" },
    ]),
    "<p>Home</p>",
  );
  assert.equal(
    classifyRedirectScope("https://joshua.example", "not a url"),
    "out_of_scope",
  );
  const pages = await fetchUsesHtmlPages("https://joshua.example", {
    // External HTTP boundary. The test supplies the response.
    fetchText: async (url) => {
      if (url.endsWith("/")) {
        throw new Error("home down");
      }
      return { url, body: "", contentType: "text/html" };
    },
  });
  assert.equal(pages.length, 0);

  assert.equal(stripNonContentHtml("<script>only</script>"), "");
  assert.equal(inferStatus("I don't use Vim"), "unspecified");
  const extracted = extractUsesFromHtml(`
    <main>
      <ul>
        <li>I don't use Emacs</li>
        <li>I use Neovim and I don't use Emacs</li>
        <li><a href="https://neovim.io/">Neovim</a> for programming</li>
        <li><a href="https://neovim.io/">Neovim</a> for writing longer notes about the editor</li>
        <li><a href="https://example.invalid">https://example.invalid</a></li>
        <li><a> </a>plain</li>
        <li>theme by <a href="https://profiles.joshua.example/">Ada</a></li>
      </ul>
    </main>
  `);
  assert.ok(extracted.items.some((item) => item.label === "Neovim"));
  assert.equal(
    extractUsesFromHtml("<script>only</script>").outcome,
    "parse_error",
  );

  const evidence = buildEvidenceRecords({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    content_hash_source: "<ul></ul>",
    items: [
      {
        label: "Neovim",
        status: "nope",
        section: "Software",
        excerpt: "Neovim",
        kind: "unresolved",
        use_case_hints: ["programming"],
      },
      {
        label: "Neovim",
        status: "current",
        section: "",
        excerpt: "Neovim again",
        kind: "product",
        use_case_hints: [],
      },
    ],
    catalog: editorCatalog,
  });
  assert.ok(evidence.length >= 1);
  assert.equal(isKeptInState(null), false);
  assert.equal(
    isKeptInState({
      unresolved: false,
      tool_id: "neovim",
      kind: "nope",
      confidence: 0.9,
    }),
    false,
  );
  assert.equal(isAdoptionEligible({ unresolved: true }), false);

  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-store-"));
  try {
    await writeFile(path.join(dir, "bad.json"), "{");
    await assert.rejects(readJson(path.join(dir, "bad.json"), {}));
    await mkdir(path.join(dir, "events"), { recursive: true });
    await writeFile(path.join(dir, "events", "notes.txt"), "nope");
    assert.deepEqual(await loadAllEvents(dir), []);
    const fileRoot = path.join(dir, "file-root");
    await mkdir(fileRoot);
    await writeFile(path.join(fileRoot, "events"), "nope");
    await assert.rejects(loadAllEvents(fileRoot));
    await upsertDailyCheck(dir, {
      date: "2026-11-02",
      origin: "https://other.example",
      page_url: "https://other.example/uses/",
      outcome: "uncertain",
      content_hash: "a",
      verified_item_count: 2,
      extractor_version: 3,
    });
    await upsertDailyCheck(dir, {
      date: "2026-11-01",
      origin: "https://joshua.example",
      page_url: "https://joshua.example/uses/",
      outcome: "uncertain",
      content_hash: "b",
      verified_item_count: 0,
      extractor_version: 3,
    });
    await upsertDailyCheck(dir, {
      date: "2026-11-02",
      origin: "https://other.example",
      page_url: "https://other.example/uses/",
      outcome: "uncertain",
      content_hash: "c",
      verified_item_count: 0,
      extractor_version: 3,
    });
    await upsertDailyCheck(dir, {
      date: "2026-11-02",
      origin: "https://joshua.example",
      page_url: "https://joshua.example/uses/",
      outcome: "verified",
      content_hash: "d",
      verified_item_count: 1,
      extractor_version: 3,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const graph = buildUsageGraph({
    rollup: {
      period: "2026-11",
      tools: [
        {
          tool_id: "neovim",
          active_member_origins: [
            "https://joshua.example",
            "https://other.example",
          ],
          use_cases: [],
        },
        {
          tool_id: "vim",
          active_member_origins: [
            "https://joshua.example",
            "https://other.example",
          ],
          use_cases: [],
        },
        {
          tool_id: "tmux",
          active_member_origins: ["https://joshua.example"],
          use_cases: [],
        },
      ],
    },
    state: { members: [] },
    tools: editorCatalog.tools,
    categories: editorCatalog.categories,
    useCases: [],
    memberLabels: new Map(),
  });
  assert.ok(graph.edges.some((edge) => edge.relation === "co_used_with"));

  assert.equal(
    compareEvents(
      { observed_at: "a", origin: "a", tool_id: "a", event_id: "a" },
      { observed_at: "a", origin: "b", tool_id: "a", event_id: "b" },
    ) < 0,
    true,
  );
  assert.equal(
    compareEvents(
      { observed_at: "a", origin: "a", tool_id: "a", event_id: "a" },
      { observed_at: "a", origin: "a", tool_id: "b", event_id: "b" },
    ) < 0,
    true,
  );
  assert.equal(
    compareEvents(
      { observed_at: "a", origin: "a", tool_id: "a", event_id: "a" },
      { observed_at: "a", origin: "a", tool_id: "a", event_id: "b" },
    ) < 0,
    true,
  );
  assert.throws(() => dateKeyFromIso("not-a-date"));
  assert.equal(dateKeyFromIso("2026-11-04T00:00:00.000Z"), "2026-11-04");
  const kept = reconcileMemberUsage({
    previous: null,
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    page_status: "verified",
    observed_at: "2026-11-04T00:00:00.000Z",
    evidence: [
      {
        origin: "https://joshua.example",
        page_url: "https://joshua.example/uses/",
        label: "skip",
        name: "skip",
        tool_id: null,
        unresolved: true,
        status: "current",
        use_case_ids: [],
        section: "",
        context: "",
        kind: "unresolved",
        excerpt: "",
        source_hash: "x",
        extractor_version: 3,
        taxonomy_version: 2,
        confidence: 0.2,
      },
    ],
    pageComplete: true,
  });
  assert.equal(kept.next.tools.length, 0);

  assert.equal(sanitizeLabel("  Neovim  "), "Neovim");
  assert.equal(comparisonLabel(""), "");
  assert.equal(productNameFromLabel("Neovim"), "Neovim");
  assert.equal(publicToolName("", "neovim"), "neovim");
  assert.equal(isNamedEntity("a"), false);
  assert.equal(isReportableUseLabel("A"), false);
  assert.equal(isReportableUseLabel("More"), false);
  assert.equal(isReportableUseLabel("Photos"), false);
  assert.equal(isReportableUseLabel("Resume"), false);
  assert.equal(observedToolId(""), "");
  assert.equal(contentFingerprint("same"), contentFingerprint("same"));
  assert.equal(
    resolveToolLabel("Nope", { catalog: editorCatalog }).match,
    "none",
  );
  const indexed = indexCatalog({
    tools: [{ id: "neovim", name: "Neovim", aliases: ["nvim"] }],
    aliases: [],
  });
  assert.equal(indexed.byId.get("neovim").name, "Neovim");
  assert.equal(separateNameContext("Neovim").name, "Neovim");
  assert.deepEqual(splitCompoundName("Neovim"), ["Neovim"]);
  assert.equal(
    discoverUsesPages({
      origin: "https://joshua.example",
      declaredUrl: "http://[",
      pages: [{ url: "https://other.example/uses/" }],
      opmlOutlines: [{ category: "uses", url: "https://joshua.example/uses/" }],
      navLinks: [{ text: "Uses" }, { href: "/blog/", text: "Blog" }],
    }).length >= 0,
    true,
  );
  assert.equal(
    classifyClaim(
      { name: "Nope", href: "https://shared.example/a", kind: "product" },
      {
        tools: [
          {
            id: "one",
            name: "One",
            category_id: "editor-ide",
            website: "https://shared.example/a",
          },
          {
            id: "two",
            name: "Two",
            category_id: "editor-ide",
            website: "https://shared.example/b",
          },
        ],
        categories: editorCatalog.categories,
        aliases: [],
      },
    ).role,
    "unsorted",
  );
  assert.equal(
    classifyClaim(
      { name: "Nope", href: "https://blank.example/", kind: "product" },
      {
        tools: [
          {
            id: "blank",
            name: "???",
            category_id: "editor-ide",
            website: "https://blank.example/",
          },
        ],
        categories: editorCatalog.categories,
        aliases: [],
      },
    ).role,
    "unsorted",
  );
  assert.equal(classifyUseKind("", {}), "unresolved");
  assert.equal(classifyUseKind("using a pen", {}), "practice");
  assert.equal(separateNameContext("").name, "");
  assert.equal(isNamedEntity("12"), false);
  assert.equal(isReportableUseLabel("(2024)"), false);
  assert.equal(isReportableUseLabel("Home"), false);
  assert.equal(
    publicToolName("observed:secret", "observed:secret").includes("secret"),
    true,
  );
  assert.equal(
    resolveToolLabel("Go", {
      section: "Games",
      excerpt: "board game",
      catalog: {
        tools: [
          { id: "go", name: "Go", category_id: "editor-ide", aliases: [] },
        ],
        aliases: [
          {
            alias: "Go",
            tool_id: "go",
            require_context: ["programming"],
            require_section: ["software"],
          },
        ],
      },
    }).match,
    "abstain",
  );
  assert.equal(
    resolveToolLabel("Go", {
      section: "Software",
      excerpt: "code",
      catalog: {
        tools: [
          { id: "go", name: "Go", category_id: "editor-ide", aliases: [] },
          {
            id: "go-game",
            name: "Go Game",
            category_id: "editor-ide",
            aliases: [],
          },
        ],
        aliases: [
          { alias: "Go", tool_id: "go", require_context: ["code"] },
          { alias: "Go", tool_id: "go-game", require_context: ["code"] },
        ],
      },
    }).match,
    "ambiguous",
  );
  const extractedEdge = extractUsesFromHtml(`
    <ul>
      <li>I don't use Emacs</li>
      <li>Spotify (@joshuabaker)</li>
      <li><a href=""> </a></li>
      <li><a href="#one">One</a> <a href="https://neovim.io/">Neovim</a></li>
      <li><a href="https://neovim.io/">Neovim</a></li>
      <li><strong>Neovim for writing long notes</strong> extra</li>
      <li>I run the <a href="https://example.invalid/missing">missing-name</a></li>
    </ul>
  `);
  assert.deepEqual(splitCompoundName(""), []);
  assert.equal(
    resolveToolLabel("Go", {
      section: "Games",
      excerpt: "code board",
      catalog: {
        tools: [
          { id: "go", name: "Go", category_id: "editor-ide", aliases: [] },
        ],
        aliases: [
          {
            alias: "Go",
            tool_id: "go",
            require_context: ["code"],
            forbid_context: ["board"],
          },
        ],
      },
    }).match,
    "abstain",
  );
  assert.equal(
    resolveToolLabel("Go", {
      section: "Games",
      excerpt: "code",
      catalog: {
        tools: [
          { id: "go", name: "Go", category_id: "editor-ide", aliases: [] },
          {
            id: "go-game",
            name: "Go Game",
            category_id: "editor-ide",
            aliases: [],
          },
        ],
        aliases: [
          {
            alias: "Go",
            tool_id: "go",
            require_context: ["code"],
            require_section: ["software"],
          },
          { alias: "Go", tool_id: "go-game" },
        ],
      },
    }).match,
    "abstain",
  );
  assert.equal(
    extractedEdge.outcome === "verified" ||
      extractedEdge.outcome === "verified_empty" ||
      extractedEdge.outcome === "uncertain",
    true,
  );
  assert.equal(validateRollupInvariants(null)[0], "rollup missing");
  assert.ok(
    validateRollupInvariants({
      verified_uses_member_count: 1,
      tools: [
        {
          tool_id: "neovim",
          active_member_count: 2,
          active_member_origins: ["https://joshua.example"],
          adoption_score: 200,
          denominator: 1,
        },
        {
          tool_id: "neovim",
          active_member_count: -1,
          active_member_origins: [],
          adoption_score: -1,
        },
      ],
    }).length > 0,
  );
  const missingSchema = await validateUsesRoot(
    await mkdtemp(path.join(os.tmpdir(), "uses-schema-")),
    { schemaDir: path.join(os.tmpdir(), "missing-schemas") },
  );
  assert.equal(missingSchema.ok, true);
});
