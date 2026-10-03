/**
 * Goal: Write assets/css/elsewhere-glyphs.css from elsewhere-sprite-order.json.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildElsewhereGlyphCss } from "./elsewhere-glyph-css.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const orderPath = path.join(
  root,
  "scripts/network/elsewhere-sprite-order.json",
);
const outputPath = path.join(root, "assets/css/elsewhere-glyphs.css");

const order = JSON.parse(await fs.readFile(orderPath, "utf8"));
const css = buildElsewhereGlyphCss(order);

await fs.mkdir(path.dirname(outputPath), {
  recursive: true,
});
await fs.writeFile(outputPath, css, "utf8");

process.stdout.write(
  `Wrote ${path.relative(root, outputPath)} (${order.networks.length} glyphs)\n`,
);
