/**
 * Goal: Generate elsewhere glyph mask-position CSS from the sprite order file
 * so main.css does not hand-sync ~40 network selectors.
 *
 * @param {{
 *   cell?: number,
 *   cols?: number,
 *   networks?: string[],
 * }} order
 * @returns {string}
 */
export function buildElsewhereGlyphCss(order) {
  const cell = Number(order?.cell);
  const cols = Number(order?.cols);
  const networks = Array.isArray(order?.networks) ? order.networks : [];

  if (!Number.isInteger(cell) || cell <= 0) {
    throw new Error("elsewhere sprite order requires a positive cell size");
  }

  if (!Number.isInteger(cols) || cols <= 0) {
    throw new Error("elsewhere sprite order requires a positive column count");
  }

  if (networks.length === 0) {
    throw new Error("elsewhere sprite order requires networks");
  }

  const rem = cell / 16;
  const lines = [
    "/* Generated from scripts/network/elsewhere-sprite-order.json.",
    " * Do not edit by hand. Run: npm run elsewhere:glyphs",
    " */",
    "",
  ];

  for (const [index, network] of networks.entries()) {
    if (typeof network !== "string" || !/^[a-z][a-z0-9]*$/.test(network)) {
      throw new Error(`invalid elsewhere network id: ${String(network)}`);
    }

    const column = index % cols;
    const row = Math.floor(index / cols);
    const x = column === 0 ? "0" : `-${column * rem}rem`;
    const y = row === 0 ? "0" : `-${row * rem}rem`;

    lines.push(`.network-card__elsewhere-glyph--${network} {`);
    lines.push(`  -webkit-mask-position: ${x} ${y};`);
    lines.push(`  mask-position: ${x} ${y};`);
    lines.push("}");
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
