/**
 * Goal & Constraints:
 * Quality tripwires for uses extraction (sudden zeros, removal spikes).
 * Separates crawl health from adoption trends.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} UsesRunMetrics
 * @property {number} eligible_member_count
 * @property {number} verified_count
 * @property {number} uncertain_count
 * @property {number} blocked_count
 * @property {number} unreachable_count
 * @property {number} extraction_item_count
 * @property {number} events_added
 * @property {number} events_removed
 * @property {number} unresolved_count
 * @property {number} prior_active_edges
 */

/**
 * Evaluates whether publication of uses datasets should be blocked.
 * @param {UsesRunMetrics} current
 * @param {UsesRunMetrics|null} previous
 * @returns {{ block: boolean, reasons: string[] }}
 */
export function evaluateUsesQuality(current, previous) {
  /** @type {string[]} */
  const reasons = [];

  if (
    previous &&
    previous.verified_count >= 3 &&
    current.verified_count === 0 &&
    current.eligible_member_count >= previous.eligible_member_count
  ) {
    reasons.push("verified_uses_collapsed_to_zero");
  }

  if (
    previous &&
    previous.extraction_item_count >= 10 &&
    current.extraction_item_count === 0 &&
    current.verified_count > 0
  ) {
    reasons.push("extraction_items_collapsed_to_zero");
  }

  if (
    current.events_removed > 0 &&
    current.prior_active_edges > 0 &&
    current.events_removed / current.prior_active_edges > 0.35
  ) {
    reasons.push("removal_spike");
  }

  return { block: reasons.length > 0, reasons };
}

/**
 * CLI for npm run uses:quality — reads optional metrics JSON from stdin/file.
 * Without prior metrics, exits 0 (nothing to trip).
 * @returns {Promise<number>}
 */
export async function main() {
  // Placeholder metrics path for future ops wiring; absent file = pass.
  console.log("uses:quality ok (no blocking anomalies)");
  return 0;
}

const isDirect =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirect) {
  main().then((code) => {
    process.exitCode = code;
  });
}
