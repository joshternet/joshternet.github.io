/**
 * Goal: Real member Uses pages keep their labeled section, status, and identity.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { extractUsesFromHtml } from "../../scripts/uses/extract.mjs";
import {
  observedToolId,
  resolveToolLabel,
} from "../../scripts/uses/normalize.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("benchmark examples match extraction and catalog identity", async () => {
  const benchmark = JSON.parse(
    await readFile(
      path.join(root, "test/fixtures/uses/benchmark.json"),
      "utf8",
    ),
  );
  const tools = JSON.parse(
    await readFile(path.join(root, "data/uses/catalog/tools.json"), "utf8"),
  );
  const aliases = JSON.parse(
    await readFile(path.join(root, "data/uses/catalog/aliases.json"), "utf8"),
  );
  const catalog = { tools: tools.tools, aliases: aliases.aliases };
  assert.ok(benchmark.examples.length >= 75);
  /** @type {Map<string, object[]>} */
  const byFixture = new Map();
  for (const example of benchmark.examples) {
    const rows = byFixture.get(example.html_fixture) || [];
    rows.push(example);
    byFixture.set(example.html_fixture, rows);
  }
  let extractionChecked = 0;
  let identityChecked = 0;
  let categoryChecked = 0;
  for (const [fixture, rows] of byFixture) {
    const html = await readFile(path.join(root, fixture), "utf8");
    const extracted = extractUsesFromHtml(html);
    for (const example of rows) {
      const item = extracted.items.find(
        (candidate) =>
          candidate.label === example.name &&
          candidate.section_path === example.expected_section_path,
      );
      assert.ok(item, `${example.name} @ ${example.expected_section_path}`);
      assert.equal(item.section, example.expected_section);
      assert.equal(item.status, example.expected_status);
      const resolved = resolveToolLabel(item.label, {
        section: item.section_path,
        excerpt: item.context,
        catalog,
      });
      if (example.expected_tool_id === "abstain") {
        assert.ok(
          resolved.match === "abstain" || resolved.match === "ambiguous",
        );
      } else if (String(example.expected_tool_id).startsWith("observed:")) {
        assert.equal(resolved.match, "none");
        assert.equal(
          observedToolId(resolved.comparison),
          example.expected_tool_id,
        );
      } else {
        assert.equal(resolved.tool_id, example.expected_tool_id);
      }
      if (example.split === "extraction") extractionChecked += 1;
      if (example.split === "identity") identityChecked += 1;
      if (example.split === "category") categoryChecked += 1;
    }
  }
  assert.ok(extractionChecked >= 4);
  assert.ok(identityChecked >= 1);
  assert.ok(categoryChecked >= 1);
  const keyboard = benchmark.examples.find(
    (example) => example.name === "Apple Magic Keyboard",
  );
  assert.equal(keyboard.expected_section, "Workstation");
  assert.equal(
    benchmark.examples.find(
      (example) =>
        example.name === "Cloudflare" && example.source_url.includes("joshcox"),
    ).expected_section,
    "Development",
  );
});
