/**
 * Goal: Rollup denominators, adoption scores, graph invariants, early sample.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  adoptionScore,
  buildPeriodRollup,
  monthBounds,
  quarterKeyFromMonth,
} from "../../scripts/uses/aggregate.mjs";
import { buildUsageGraph } from "../../scripts/uses/graph.mjs";
import {
  isEarlySample,
  validateGraphInvariants,
  validateRollupInvariants,
} from "../../scripts/uses/validate.mjs";
import { evaluateUsesQuality } from "../../scripts/uses/quality.mjs";
import { buildUsesSummary } from "../../scripts/uses/view.mjs";

test("adoptionScore and month/quarter helpers", () => {
  assert.equal(adoptionScore(1, 4), 25);
  assert.equal(adoptionScore(1, 0), null);
  assert.equal(quarterKeyFromMonth("2026-11"), "2026-Q4");
  const bounds = monthBounds("2026-11");
  assert.equal(bounds.start, "2026-11-01T00:00:00.000Z");
  assert.equal(bounds.endExclusive, "2026-12-01T00:00:00.000Z");
});

test("buildPeriodRollup counts distinct origins and scores", async () => {
  const state = {
    members: [
      {
        origin: "https://a.example",
        page_status: "verified",
        last_valid_observation_at: "2026-11-03T12:00:00.000Z",
        tools: [
          {
            tool_id: "visual-studio-code",
            status: "current",
            use_case_ids: ["programming"],
            evidence_event_id: "sha256:1",
          },
        ],
      },
      {
        origin: "https://b.example",
        page_status: "verified",
        last_valid_observation_at: "2026-11-03T12:00:00.000Z",
        tools: [
          {
            tool_id: "visual-studio-code",
            status: "current",
            use_case_ids: ["programming"],
            evidence_event_id: "sha256:2",
          },
          {
            tool_id: "firefox",
            status: "current",
            use_case_ids: [],
            evidence_event_id: "sha256:3",
          },
        ],
      },
    ],
  };
  const rollup = await buildPeriodRollup({
    period: "2026-11",
    granularity: "month",
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: "2026-11-03T16:00:00.000Z",
    is_complete: false,
    eligible_origins: ["https://a.example", "https://b.example"],
    state,
    period_events: [],
    catalog: {
      tools: [
        {
          id: "visual-studio-code",
          name: "Visual Studio Code",
          category_id: "editor-ide",
          aliases: [],
        },
        {
          id: "firefox",
          name: "Firefox",
          category_id: "browser",
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
        {
          id: "browser",
          name: "Browsers",
          role: "ranked",
          scope: "The browser a site says it uses.",
        },
      ],
      aliases: [],
    },
  });
  assert.equal(rollup.verified_uses_member_count, 2);
  const vscode = rollup.tools.find((t) => t.tool_id === "visual-studio-code");
  assert.equal(vscode.active_member_count, 2);
  assert.equal(vscode.adoption_score, 100);
  assert.deepEqual(validateRollupInvariants(rollup), []);
});

test("rollup shows publisher names and skips site-path rows", async () => {
  const rollup = await buildPeriodRollup({
    period: "2026-11",
    granularity: "month",
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: "2026-11-04T16:00:00.000Z",
    is_complete: false,
    eligible_origins: ["https://a.example"],
    state: {
      members: [
        {
          origin: "https://a.example",
          page_status: "verified",
          last_valid_observation_at: "2026-11-04T12:00:00.000Z",
          tools: [
            {
              tool_id: "observed:1password",
              name: "1Password",
              status: "current",
              use_case_ids: [],
            },
            {
              tool_id: "observed:cv",
              name: "/cv",
              status: "current",
              use_case_ids: [],
            },
            {
              tool_id:
                "observed:16-second-monitor-a-second-screen-off-to-the-side-for-docs-reference-and-anything-i-want-to-keep-half-an-eye-on",
              name: "16” second monitor A second screen off to the side for docs, reference, and anything I want to keep half an eye on.",
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
          id: "1password",
          name: "1Password",
          category_id: "password-manager",
          aliases: [],
        },
      ],
      categories: [
        {
          id: "password-manager",
          name: "Password managers",
          role: "ranked",
          scope: "The password manager a site says it uses.",
        },
      ],
      aliases: [],
    },
  });
  assert.deepEqual(
    rollup.tools.map((tool) => tool.name),
    ["1Password"],
  );
  assert.ok(
    rollup.tools.every((tool) => !String(tool.name).includes("observed:")),
  );
});

test("graph has uses edges with evidence and no member-member links", () => {
  const rollup = {
    period: "2026-11",
    tools: [
      {
        tool_id: "visual-studio-code",
        active_member_origins: ["https://a.example", "https://b.example"],
        use_cases: [{ id: "programming", member_count: 2 }],
      },
      {
        tool_id: "firefox",
        active_member_origins: ["https://a.example", "https://b.example"],
        use_cases: [],
      },
    ],
  };
  const state = {
    members: [
      {
        origin: "https://a.example",
        tools: [
          {
            tool_id: "visual-studio-code",
            evidence_event_id: "sha256:aa",
          },
          { tool_id: "firefox", evidence_event_id: "sha256:bb" },
        ],
      },
      {
        origin: "https://b.example",
        tools: [
          {
            tool_id: "visual-studio-code",
            evidence_event_id: "sha256:cc",
          },
          { tool_id: "firefox", evidence_event_id: "sha256:dd" },
        ],
      },
    ],
  };
  const graph = buildUsageGraph({
    rollup,
    state,
    tools: [
      {
        id: "visual-studio-code",
        name: "Visual Studio Code",
        category_id: "editor-ide",
      },
      { id: "firefox", name: "Firefox", category_id: "browser" },
    ],
    categories: [
      { id: "editor-ide", name: "Editors" },
      { id: "browser", name: "Browsers" },
    ],
    useCases: [{ id: "programming", name: "Programming" }],
  });
  assert.deepEqual(validateGraphInvariants(graph), []);
  assert.ok(graph.edges.some((e) => e.relation === "co_used_with"));
  assert.ok(
    !graph.edges.some(
      (e) => e.from.startsWith("member:") && e.to.startsWith("member:"),
    ),
  );
});

test("early sample and quality tripwires", () => {
  assert.equal(isEarlySample(3, 20), true);
  assert.equal(isEarlySample(10, 20), false);
  const blocked = evaluateUsesQuality(
    {
      eligible_member_count: 20,
      verified_count: 0,
      uncertain_count: 0,
      blocked_count: 0,
      unreachable_count: 0,
      extraction_item_count: 0,
      events_added: 0,
      events_removed: 0,
      unresolved_count: 0,
      prior_active_edges: 0,
    },
    {
      eligible_member_count: 20,
      verified_count: 8,
      uncertain_count: 0,
      blocked_count: 0,
      unreachable_count: 0,
      extraction_item_count: 40,
      events_added: 0,
      events_removed: 0,
      unresolved_count: 0,
      prior_active_edges: 10,
    },
  );
  assert.equal(blocked.block, true);
  assert.ok(blocked.reasons.includes("verified_uses_collapsed_to_zero"));
});

test("buildUsesSummary marks early sample", () => {
  const summary = buildUsesSummary({
    rollup: {
      period: "2026-11",
      is_complete: false,
      tools: [
        {
          tool_id: "firefox",
          active_member_count: 1,
          active_member_origins: ["https://example.com"],
          adoption_score: 50,
        },
      ],
      verified_uses_member_count: 2,
    },
    supported_periods: ["2026-11"],
    as_of: "2026-11-03T16:00:00.000Z",
    eligible_member_count: 20,
    verified_uses_member_count: 2,
    members: [
      {
        origin: "https://example.com",
        page_url: "https://example.com/uses/",
      },
    ],
  });
  assert.equal(summary.early_sample, true);
  assert.equal(summary.methodology_url, "/implement/content/uses/");
  assert.match(summary.coverage_note, /small part of the network/i);
  assert.equal(summary.top_tools.length, 1);
  assert.deepEqual(summary.top_tools[0].sources, [
    {
      origin: "https://example.com",
      page_url: "https://example.com/uses/",
      label: "example.com",
      section: "",
      context: "",
      observed_at: "",
      preference: false,
    },
  ]);
});
