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
