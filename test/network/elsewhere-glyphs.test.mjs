/**
 * Goal: Elsewhere glyph CSS stays generated from the sprite order file.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildElsewhereGlyphCss } from "../../scripts/network/elsewhere-glyph-css.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("elsewhere glyph CSS matches the sprite order generator", async () => {
  const order = JSON.parse(
    await readFile(
      path.join(root, "scripts/network/elsewhere-sprite-order.json"),
      "utf8",
    ),
  );
  const committed = await readFile(
    path.join(root, "assets/css/elsewhere-glyphs.css"),
    "utf8",
  );
  const mainCss = await readFile(
    path.join(root, "assets/css/main.css"),
    "utf8",
  );
  const layout = await readFile(
    path.join(root, "_layouts/default.html"),
    "utf8",
  );

  assert.equal(committed, buildElsewhereGlyphCss(order));
  assert.match(layout, /elsewhere-glyphs\.css/);
  assert.doesNotMatch(mainCss, /\.network-card__elsewhere-glyph--github\s*\{/);
  assert.match(committed, /\.network-card__elsewhere-glyph--github\s*\{/);
  assert.match(committed, /\.network-card__elsewhere-glyph--weibo\s*\{/);
  assert.match(committed, /\.network-card__elsewhere-glyph--web\s*\{/);
});

// ─── buildElsewhereGlyphCss error paths ───────────────────────────────────────

test("buildElsewhereGlyphCss throws when cell is not a positive integer", () => {
  assert.throws(
    () => buildElsewhereGlyphCss({ cell: 0, cols: 8, networks: ["github"] }),
    /positive cell size/,
  );
  assert.throws(
    () => buildElsewhereGlyphCss({ cell: -1, cols: 8, networks: ["github"] }),
    /positive cell size/,
  );
  assert.throws(
    () =>
      buildElsewhereGlyphCss({ cell: "big", cols: 8, networks: ["github"] }),
    /positive cell size/,
  );
});

test("buildElsewhereGlyphCss throws when cols is not a positive integer", () => {
  assert.throws(
    () => buildElsewhereGlyphCss({ cell: 48, cols: 0, networks: ["github"] }),
    /positive column count/,
  );
  assert.throws(
    () => buildElsewhereGlyphCss({ cell: 48, cols: -2, networks: ["github"] }),
    /positive column count/,
  );
});

test("buildElsewhereGlyphCss throws when networks array is empty", () => {
  assert.throws(
    () => buildElsewhereGlyphCss({ cell: 48, cols: 8, networks: [] }),
    /requires networks/,
  );
});

test("buildElsewhereGlyphCss throws when a network id is invalid", () => {
  assert.throws(
    () =>
      buildElsewhereGlyphCss({
        cell: 48,
        cols: 8,
        networks: ["github", "Bad Network"],
      }),
    /invalid elsewhere network id/,
  );
  assert.throws(
    () => buildElsewhereGlyphCss({ cell: 48, cols: 8, networks: [123] }),
    /invalid elsewhere network id/,
  );
});

// ─── Phase-3 branch gap closer: non-array networks fires ': []' (L15) ─────────
test("buildElsewhereGlyphCss: null networks fires ': []' branch then throws (L15)", () => {
  // networks: null → Array.isArray(null) = false → ': []' branch fires
  // then networks.length === 0 → throws "requires networks"
  assert.throws(
    () => buildElsewhereGlyphCss({ cell: 48, cols: 8, networks: null }),
    /requires networks/,
  );
});
