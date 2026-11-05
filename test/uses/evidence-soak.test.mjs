/**
 * Goal: Evidence eligibility + multi-day replay soak (bounded).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEvidenceRecords,
  isAdoptionEligible,
} from "../../scripts/uses/evidence.mjs";
import { reconcileMemberUsage } from "../../scripts/uses/reconcile.mjs";
import { compareEvents } from "../../scripts/uses/reconcile.mjs";
import { replayState } from "../../scripts/uses/store.mjs";
import { extractUsesFromHtml } from "../../scripts/uses/extract.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("evidence resolves catalog tools from plain-list fixture", async () => {
  const html = await readFile(
    path.join(root, "test/fixtures/uses/plain-list.html"),
    "utf8",
  );
  const tools = JSON.parse(
    await readFile(path.join(root, "data/uses/catalog/tools.json"), "utf8"),
  );
  const useCases = JSON.parse(
    await readFile(path.join(root, "data/uses/catalog/use-cases.json"), "utf8"),
  );
  const extracted = extractUsesFromHtml(html);
  const records = buildEvidenceRecords({
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    content_hash_source: extracted.content_hash_source,
    items: extracted.items,
    catalog: {
      tools: tools.tools,
      aliases: [],
      useCases: useCases.use_cases,
    },
  });
  const vscode = records.find((r) => r.tool_id === "visual-studio-code");
  assert.ok(vscode);
  assert.equal(vscode.name, "Visual Studio Code");
  assert.equal(isAdoptionEligible(vscode), true);
  const unresolved = records.filter((r) => r.unresolved);
  assert.ok(unresolved.every((r) => !isAdoptionEligible(r)));
});

test("site paths are not usage evidence", () => {
  const records = buildEvidenceRecords({
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    content_hash_source: "paths",
    items: [
      { label: "/cv", status: "current", section: "Elsewhere", excerpt: "/cv" },
      {
        label: "/now",
        status: "current",
        section: "Elsewhere",
        excerpt: "/now",
      },
      {
        label: "/links",
        status: "current",
        section: "Elsewhere",
        excerpt: "/links",
      },
      {
        label: "1Password",
        status: "current",
        section: "Apps",
        excerpt: "1Password",
      },
    ],
    catalog: { tools: [], aliases: [], useCases: [] },
  });
  assert.deepEqual(
    records.map((record) => record.name),
    ["1Password"],
  );
  assert.equal(records[0].tool_id, "observed:1password");
});

test("unlisted current tools stay in the report under an observed id", () => {
  const records = buildEvidenceRecords({
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    content_hash_source: "obsidian",
    items: [
      {
        label: "Obsidian",
        status: "current",
        section: "Software",
        excerpt: "Obsidian for notes",
      },
    ],
    catalog: { tools: [], aliases: [], useCases: [] },
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].tool_id, "observed:obsidian");
  assert.equal(records[0].name, "Obsidian");
  assert.equal(records[0].unresolved, false);
  assert.equal(isAdoptionEligible(records[0]), true);

  const reconciled = reconcileMemberUsage({
    previous: null,
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    page_status: "verified",
    observed_at: "2026-11-04T00:00:00.000Z",
    evidence: records,
    pageComplete: true,
  });
  assert.equal(reconciled.next.tools.length, 1);
  assert.equal(reconciled.next.tools[0].name, "Obsidian");
});

test("context-rejected catalog aliases stay unresolved", async () => {
  const tools = JSON.parse(
    await readFile(path.join(root, "data/uses/catalog/tools.json"), "utf8"),
  );
  const aliases = JSON.parse(
    await readFile(path.join(root, "data/uses/catalog/aliases.json"), "utf8"),
  );
  const records = buildEvidenceRecords({
    origin: "https://example.com",
    page_url: "https://example.com/uses/",
    content_hash_source: "go",
    items: [
      {
        label: "Go",
        status: "current",
        section: "Games",
        excerpt: "board game of go",
      },
    ],
    catalog: { tools: tools.tools, aliases: aliases.aliases, useCases: [] },
  });
  assert.equal(records[0].unresolved, true);
  assert.equal(records[0].tool_id, null);
  assert.equal(isAdoptionEligible(records[0]), false);
});

test("400 synthetic daily checkpoints replay deterministically", () => {
  /** @type {object[]} */
  let events = [];
  let previous = null;
  const start = Date.UTC(2025, 0, 1);

  for (let day = 0; day < 400; day += 1) {
    const observed_at = new Date(start + day * 86400000).toISOString();
    const hasTool = day % 7 !== 0;
    const result = reconcileMemberUsage({
      previous,
      origin: "https://soak.example",
      page_url: "https://soak.example/uses/",
      page_status: hasTool ? "verified" : "verified_empty",
      observed_at,
      evidence: hasTool
        ? [
            {
              origin: "https://soak.example",
              page_url: "https://soak.example/uses/",
              label: "Firefox",
              comparison: "firefox",
              tool_id: "firefox",
              unresolved: false,
              status: "current",
              use_case_ids: [],
              section: "Browsers",
              excerpt: "Firefox",
              source_hash: "sha256:ff",
              extractor_version: 1,
              taxonomy_version: 1,
              confidence: 0.9,
            },
          ]
        : [],
      pageComplete: true,
    });
    events = [...events, ...result.events].sort(compareEvents);
    previous = result.next;
  }

  const stateA = replayState(events);
  const stateB = replayState([...events].reverse().sort(compareEvents));
  assert.equal(
    JSON.stringify(stateA.members.map((m) => m.tools)),
    JSON.stringify(stateB.members.map((m) => m.tools)),
  );
  assert.ok(events.length >= 1);
});
