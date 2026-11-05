/**
 * Goal: Alias collisions and label normalization.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  comparisonLabel,
  contentFingerprint,
  deterministicEventId,
  resolveToolLabel,
  sanitizeLabel,
} from "../../scripts/uses/normalize.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @returns {Promise<object>}
 */
async function catalog() {
  const tools = JSON.parse(
    await readFile(path.join(root, "data/uses/catalog/tools.json"), "utf8"),
  );
  const aliases = JSON.parse(
    await readFile(path.join(root, "data/uses/catalog/aliases.json"), "utf8"),
  );
  return { tools: tools.tools, aliases: aliases.aliases };
}

test("sanitizeLabel and comparisonLabel fold case and accents", () => {
  assert.equal(sanitizeLabel("  VS   Code\n"), "VS Code");
  assert.equal(comparisonLabel("VS Code"), "vs code");
  assert.equal(comparisonLabel("Café"), "cafe");
});

test("VS Code maps; Visual Studio stays separate with context", async () => {
  const cat = await catalog();
  const vscode = resolveToolLabel("VS Code", {
    section: "Development",
    excerpt: "everyday development",
    catalog: cat,
  });
  assert.equal(vscode.tool_id, "visual-studio-code");

  const vs = resolveToolLabel("Visual Studio", {
    section: "Windows desktop",
    excerpt: "Visual Studio for Windows desktop apps",
    catalog: cat,
  });
  assert.equal(vs.tool_id, "visual-studio");
});

test("Go and Cursor require programming context", async () => {
  const cat = await catalog();
  const goOk = resolveToolLabel("Go", {
    section: "Programming",
    excerpt: "Go for backend services",
    catalog: cat,
  });
  assert.equal(goOk.tool_id, "go-language");

  const goBad = resolveToolLabel("Go", {
    section: "Games",
    excerpt: "board game of go",
    catalog: cat,
  });
  assert.equal(goBad.tool_id, null);
  assert.equal(goBad.unresolved, true);

  const cursor = resolveToolLabel("Cursor", {
    section: "Programming",
    excerpt: "Cursor as my editor for coding",
    catalog: cat,
  });
  assert.equal(cursor.tool_id, "cursor-editor");

  const cursorBare = resolveToolLabel("Cursor", {
    section: "Misc",
    excerpt: "mouse cursor",
    catalog: cat,
  });
  assert.equal(cursorBare.tool_id, null);
});

test("deterministic hashes are stable", () => {
  assert.equal(contentFingerprint("abc"), contentFingerprint("abc"));
  assert.notEqual(contentFingerprint("abc"), contentFingerprint("abd"));
  const a = deterministicEventId({ x: 1, y: 2 });
  const b = deterministicEventId({ y: 2, x: 1 });
  assert.equal(a, b);
});
