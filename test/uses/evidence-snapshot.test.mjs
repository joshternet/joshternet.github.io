/**
 * Goal: A frozen evidence snapshot ignores observation time.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildEvidenceRecords } from "../../scripts/uses/evidence.mjs";
import { freezeEvidenceSnapshot } from "../../scripts/uses/evidence-snapshot.mjs";

test("freezeEvidenceSnapshot is stable when only the observation time changes", async () => {
  const records = buildEvidenceRecords({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    requested_url: "https://joshua.example/uses/",
    final_url: "https://joshua.example/uses/",
    fetch_status: 200,
    bodyComplete: true,
    observed_at: "2026-11-01T00:00:00.000Z",
    content_hash_source: "<ul><li>Neovim</li></ul>",
    items: [
      {
        label: "Neovim",
        status: "current",
        section: "Editor",
        excerpt: "Neovim",
        context: "daily editor",
        kind: "product",
        block_type: "li",
        language: "en",
      },
    ],
    catalog: { tools: [], aliases: [], useCases: [] },
  });
  assert.equal(records[0].target_text, "Neovim");
  assert.equal(records[0].body_complete, true);
  assert.equal(records[0].fetch_status, 200);
  const first = freezeEvidenceSnapshot(records);
  const second = freezeEvidenceSnapshot(
    records.map((record) => ({
      ...record,
      observed_at: "2026-12-01T00:00:00.000Z",
    })),
  );
  assert.equal(first.snapshot_id, second.snapshot_id);
  assert.equal(first.records[0].observed_at, undefined);
  assert.equal(freezeEvidenceSnapshot(null).records.length, 0);
  const minimal = buildEvidenceRecords({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    content_hash_source: "x",
    bodyComplete: false,
    items: [{ label: "Vim", excerpt: "Vim" }],
    catalog: { tools: [], aliases: [], useCases: [] },
  });
  assert.equal(minimal[0].fetch_status, null);
  assert.equal(minimal[0].body_complete, false);
  assert.deepEqual(minimal[0].relevant_links, []);
  assert.equal(
    freezeEvidenceSnapshot([null, { note: "none" }]).records.length,
    2,
  );
  const unordered = freezeEvidenceSnapshot([
    { evidence_id: "b", observed_at: "x" },
    { evidence_id: "a" },
  ]);
  assert.deepEqual(
    unordered.records.map((record) => record.evidence_id),
    ["a", "b"],
  );
  const stored = JSON.parse(
    await readFile(
      new URL(
        "../../data/classification/evidence-snapshot.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(
    freezeEvidenceSnapshot(stored.records).snapshot_id,
    stored.snapshot_id,
  );
});
