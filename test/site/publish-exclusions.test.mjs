import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Asserts a path under the repo root does not exist.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<void>}
 */
async function assertMissing(relativePath) {
  await assert.rejects(() => access(path.join(root, relativePath)), {
    code: "ENOENT",
  });
}

test("Jekyll exclude keeps proof tooling off the published site", async () => {
  const config = await readFile(path.join(root, "_config.yml"), "utf8");

  for (const entry of ["scripts", "test", "workers", "docs"]) {
    assert.match(
      config,
      new RegExp(`^\\s*-\\s*${entry}\\s*$`, "m"),
      `_config.yml must exclude ${entry}`,
    );
  }
});

test("published _site must not contain fixtures, scripts, or recipe evidence", async () => {
  // When _site is absent (tests without a prior build), skip presence checks.
  try {
    await access(path.join(root, "_site"));
  } catch {
    return;
  }

  for (const relativePath of [
    "_site/test",
    "_site/scripts",
    "_site/docs",
    "_site/docs/recipe-evidence",
    "_site/test/fixtures",
  ]) {
    await assertMissing(relativePath);
  }
});
