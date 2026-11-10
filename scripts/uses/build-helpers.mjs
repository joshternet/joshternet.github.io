/**
 * Goal & Constraints:
 * Tiny helpers shared by the uses build orchestrator without circular imports.
 */

export { contentFingerprint } from "./normalize.mjs";
export { periodKeyFromIso as periodKeySafe } from "./store.mjs";

/**
 * Orders comparable slots by site coverage, then choice count, then name.
 * @param {{ denominator?: number, products?: unknown[], name?: string }} a
 * @param {{ denominator?: number, products?: unknown[], name?: string }} b
 * @returns {number}
 */
export function compareSlotsByCoverage(a, b) {
  const denomA = Number.isFinite(a.denominator) ? a.denominator : 0;
  const denomB = Number.isFinite(b.denominator) ? b.denominator : 0;
  const byDenom = denomB - denomA;
  if (byDenom !== 0) {
    return byDenom;
  }
  const lenA = Array.isArray(a.products) ? a.products.length : 0;
  const lenB = Array.isArray(b.products) ? b.products.length : 0;
  const byProducts = lenB - lenA;
  if (byProducts !== 0) {
    return byProducts;
  }
  const nameA = typeof a.name === "string" ? a.name : "";
  const nameB = typeof b.name === "string" ? b.name : "";
  return nameA.localeCompare(nameB);
}
