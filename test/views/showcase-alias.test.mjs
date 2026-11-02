/**
 * Goal: made.json and showcase.json stay byte-identical after alias writes.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  deepJsonEqual,
  writeShowcaseAliasFiles,
} from "../../scripts/views/showcase-alias.mjs";

test("deepJsonEqual distinguishes document drift", () => {
  assert.equal(deepJsonEqual({ a: 1 }, { a: 1 }), true);
  assert.equal(
    deepJsonEqual(
      { generated_at: "2026-01-01T00:00:00.000Z", items: [] },
      { generated_at: "2026-01-02T00:00:00.000Z", items: [] },
    ),
    false,
  );
});

test("writeShowcaseAliasFiles persists identical made and showcase documents", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "showcase-alias-"));
  const showcase = {
    generated_at: "2026-11-02T12:00:00.000Z",
    item_count: 1,
    items: [{ url: "https://a.example/projects/toy/", title: "Toy" }],
  };

  const first = await writeShowcaseAliasFiles(dataDir, showcase);
  assert.equal(first.wrote, true);

  const made = JSON.parse(await fs.readFile(first.madePath, "utf8"));
  const show = JSON.parse(await fs.readFile(first.showcasePath, "utf8"));
  assert.equal(deepJsonEqual(made, show), true);
  assert.deepEqual(made, showcase);

  const second = await writeShowcaseAliasFiles(dataDir, showcase);
  assert.equal(second.wrote, false);

  // Repair timestamp-only drift between the pair.
  await fs.writeFile(
    first.madePath,
    `${JSON.stringify({ ...showcase, generated_at: "2020-01-01T00:00:00.000Z" }, null, 2)}\n`,
    "utf8",
  );
  const repaired = await writeShowcaseAliasFiles(dataDir, showcase);
  assert.equal(repaired.wrote, true);
  const madeAfter = JSON.parse(await fs.readFile(first.madePath, "utf8"));
  const showAfter = JSON.parse(await fs.readFile(first.showcasePath, "utf8"));
  assert.equal(deepJsonEqual(madeAfter, showAfter), true);
  assert.equal(madeAfter.generated_at, showcase.generated_at);

  await fs.rm(dataDir, { recursive: true, force: true });
});
