/**
 * Goal & Constraints:
 * Quality tripwires for uses extraction (sudden zeros, removal spikes).
 * Separates crawl health from adoption trends.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { decodeCrawlValue } from "../nlp/site-record.mjs";

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
 * @property {number} [identity_corrections]
 * @property {number} [model_decisions]
 * @property {number} [model_abstentions]
 * @property {number} [ranked_count]
 * @property {Record<string, number>} [slot_shares]
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

  if (
    previous &&
    previous.extraction_item_count >= 10 &&
    current.verified_count >= previous.verified_count &&
    current.extraction_item_count * 2 < previous.extraction_item_count
  ) {
    reasons.push("extraction_drop");
  }

  if (
    previous &&
    previous.unresolved_count >= 5 &&
    current.unresolved_count >= 10 &&
    current.unresolved_count > previous.unresolved_count * 2
  ) {
    reasons.push("unresolved_spike");
  }

  if (
    current.identity_corrections > 0 &&
    current.prior_active_edges > 0 &&
    current.identity_corrections / current.prior_active_edges > 0.35
  ) {
    reasons.push("identity_shift");
  }

  if (
    previous &&
    previous.model_decisions >= 20 &&
    current.model_decisions >= 20
  ) {
    const before = previous.model_abstentions / previous.model_decisions;
    const after = current.model_abstentions / current.model_decisions;
    if (after - before > 0.25) {
      reasons.push("abstention_spike");
    }
  }

  if (previous && previous.ranked_count >= 20 && current.ranked_count >= 20) {
    /** @type {Set<string>} */
    const slots = new Set([
      ...Object.keys(previous.slot_shares || {}),
      ...Object.keys(current.slot_shares || {}),
    ]);
    for (const slot of slots) {
      const delta = Math.abs(
        (current.slot_shares?.[slot] || 0) -
          (previous.slot_shares?.[slot] || 0),
      );
      if (delta > 0.25) {
        reasons.push("category_distribution_shift");
        break;
      }
    }
  }

  return { block: reasons.length > 0, reasons };
}

/**
 * Observed-id retirements whose catalog id is still current are collapses.
 * Other correction removals count toward the identity-shift gate.
 * @param {object[]} events
 * @param {Array<{ observed_id?: string, canonical_id?: string }>} pairs
 * @param {Iterable<string>} remainingCurrentIds
 * @returns {{ collapses: number, identity_corrections: number }}
 */
export function partitionIdentityCorrections(
  events,
  pairs,
  remainingCurrentIds,
) {
  const remaining = new Set(
    [...(remainingCurrentIds || [])]
      .map((id) => String(id || ""))
      .filter(Boolean),
  );
  /** @type {Map<string, string>} */
  const canonicalByObserved = new Map();
  for (const pair of pairs || []) {
    if (pair && pair.observed_id && pair.canonical_id) {
      canonicalByObserved.set(
        String(pair.observed_id),
        String(pair.canonical_id),
      );
    }
  }
  let collapses = 0;
  let identityCorrections = 0;
  for (const event of events || []) {
    if (
      !event ||
      event.event_type !== "correction" ||
      event.status !== "removed"
    ) {
      continue;
    }
    const toolId = String(event.tool_id || "");
    if (!toolId) {
      continue;
    }
    const canonical = canonicalByObserved.get(toolId) || "";
    if (
      toolId.startsWith("observed:") &&
      canonical &&
      remaining.has(canonical)
    ) {
      collapses += 1;
      continue;
    }
    identityCorrections += 1;
  }
  return { collapses, identity_corrections: identityCorrections };
}

/**
 * Reads one JSON file. A missing file is null.
 * @param {string} filePath
 * @returns {Promise<object|null>}
 */
async function readJsonFile(filePath) {
  try {
    return decodeCrawlValue(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * CLI for npm run uses:quality. Compares the latest run with the baseline.
 * @param {string[]} [argv]
 * @returns {Promise<number>}
 */
export async function main(argv = process.argv.slice(2)) {
  const metricsFlag = argv.indexOf("--metrics");
  const baselineFlag = argv.indexOf("--baseline");
  const metricsPath =
    metricsFlag >= 0 && argv[metricsFlag + 1]
      ? argv[metricsFlag + 1]
      : path.resolve("data/classification/run-metrics.json");
  const baselinePath =
    baselineFlag >= 0 && argv[baselineFlag + 1]
      ? argv[baselineFlag + 1]
      : path.resolve("data/classification/quality-baseline.json");
  const metrics = await readJsonFile(metricsPath);
  const baseline = await readJsonFile(baselinePath);
  if (!metrics && baseline) {
    console.error("uses:quality blocked: missing run metrics");
    return 1;
  }
  if (!metrics) {
    console.log("uses:quality ok (no run metrics)");
    return 0;
  }
  const quality = evaluateUsesQuality(metrics, baseline);
  if (quality.block) {
    console.error(`uses:quality blocked: ${quality.reasons.join(", ")}`);
    return 1;
  }
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
