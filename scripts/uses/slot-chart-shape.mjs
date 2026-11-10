/**
 * Goal & Constraints:
 * Classify a Uses slot's product shares into a chart shape for honest coverage
 * visuals (never exclusive pie when shares sum past ~100%). Pure; no DOM.
 * @module scripts/uses/slot-chart-shape
 */

/**
 * @typedef {{ share: number|null, count?: number, name?: string, id?: string }} SlotChartProduct
 */

/**
 * Normalizes a share value to a finite number or null.
 * @param {unknown} value
 * @returns {number|null}
 */
export function normalizeShare(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

/**
 * Picks a chart shape from product share coverage of a slot denominator.
 * @param {SlotChartProduct[]} products - Ranked choices with share 0–100 (or null).
 * @returns {'solo'|'head_to_head'|'even_pack'|'leader_field'|'long_tail'|'overlapping'}
 */
export function classifySlotChartShape(products) {
  const list = Array.isArray(products) ? products : [];
  const shares = list
    .map((p) => normalizeShare(p && p.share))
    .filter((s) => s !== null)
    .sort((a, b) => b - a);

  if (list.length === 0 || shares.length === 0) {
    return "solo";
  }

  if (list.length === 1 || (shares.length === 1 && shares[0] >= 100)) {
    return "solo";
  }

  const sum = shares.reduce((acc, s) => acc + s, 0);
  const max = shares[0];
  const second = shares[1] ?? 0;
  const hasClearLeader = max >= second * 2 || (max >= 80 && second < 50);

  if (sum > 105) {
    if (list.length >= 5) {
      return "long_tail";
    }
    if (list.length >= 3 && hasClearLeader) {
      return "leader_field";
    }
    return "overlapping";
  }

  if (list.length >= 5) {
    return "long_tail";
  }

  if (list.length === 2) {
    return "head_to_head";
  }

  const min = shares[shares.length - 1];
  const spread = max - min;

  if (list.length >= 3 && list.length <= 4 && spread <= 15) {
    return "even_pack";
  }

  if (hasClearLeader) {
    return "leader_field";
  }

  // Remaining exclusive-ish packs (3–4 choices without a clear leader).
  return "even_pack";
}
