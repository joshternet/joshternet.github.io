/**
 * Goal: A rules-unsorted claim can take a model slot. Ranked, rejected,
 * and detail claims never call the classifier.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildPeriodRollup } from "../../scripts/uses/aggregate.mjs";

const catalog = {
  categories: [
    { id: "keyboard", name: "Keyboards", role: "ranked", scope: "a keyboard" },
    { id: "computer", name: "Computers", role: "ranked", scope: "a computer" },
    { id: "games", name: "Games", role: "excluded", scope: "a game" },
  ],
  tools: [
    { id: "neovim", name: "Neovim", category_id: "keyboard" },
    { id: "minecraft", name: "Minecraft", category_id: "games" },
  ],
  aliases: [],
};

const policy = { threshold: 0.7, margin: 0.15 };

/**
 * @param {object[]} tools
 * @param {object} [extra]
 * @returns {object}
 */
function input(tools, extra = {}) {
  return {
    period: "2026-11",
    granularity: "month",
    period_start: "2026-11-01T00:00:00.000Z",
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: "2026-11-04T16:00:00.000Z",
    is_complete: true,
    eligible_origins: ["https://joshua.example"],
    state: {
      members: [
        {
          origin: "https://joshua.example",
          page_status: "verified",
          last_valid_observation_at: "2026-11-04T12:00:00.000Z",
          tools: tools.map((tool) => ({
            status: "current",
            use_case_ids: [],
            kind: "product",
            ...tool,
          })),
        },
      ],
    },
    period_events: [],
    catalog,
    ...extra,
  };
}

test("model slots are published only for rules-unsorted claims", async () => {
  let calls = 0;
  const classify = async () => {
    calls += 1;
    return { labels: ["a keyboard"], scores: [0.92] };
  };
  const ranked = await buildPeriodRollup(
    input(
      [
        { tool_id: "neovim", name: "Neovim" },
        { tool_id: "minecraft", name: "Minecraft" },
        { tool_id: "observed:cpu", name: "AMD Ryzen" },
      ],
      { classify, policy },
    ),
  );
  assert.equal(calls, 0);
  assert.equal(
    ranked.tools.find((tool) => tool.tool_id === "neovim").rule,
    "catalog",
  );
  assert.equal(ranked.unsorted.length, 0);

  calls = 0;
  const published = await buildPeriodRollup(
    input([{ tool_id: "observed:knife", name: "Pocket Knife" }], {
      classify,
      policy,
    }),
  );
  assert.equal(calls, 1);
  const knife = published.tools.find(
    (tool) => tool.tool_id === "observed:knife",
  );
  assert.equal(knife.rule, "model");
  assert.equal(knife.slot_id, "keyboard");
  assert.equal(published.unsorted.length, 0);

  calls = 0;
  const low = await buildPeriodRollup(
    input([{ tool_id: "observed:knife", name: "Pocket Knife" }], {
      policy,
      classify: async () => {
        calls += 1;
        return { labels: ["a keyboard"], scores: [0.2] };
      },
    }),
  );
  assert.equal(calls, 1);
  assert.equal(low.tools.length, 0);
  assert.equal(low.unsorted[0].name, "Pocket Knife");

  calls = 0;
  const unnamed = await buildPeriodRollup(
    input([{ name: "Pocket Knife" }], {
      policy,
      classify: async () => {
        calls += 1;
        return { labels: ["a keyboard"], scores: [0.99] };
      },
    }),
  );
  assert.equal(calls, 0);
  assert.equal(unnamed.unsorted[0].name, "Pocket Knife");

  const untouched = await buildPeriodRollup(
    input([{ tool_id: "observed:knife", name: "Pocket Knife" }]),
  );
  assert.equal(untouched.unsorted[0].name, "Pocket Knife");
  assert.equal(untouched.tools.length, 0);
});
