/**
 * Goal & Constraints:
 * Uses family adapter over shared resource observations. Extract/classify/
 * reconcile from durable source bodies only—never independent fetches or
 * hand-edited member state.
 */

import { buildPeriodRollup } from "../uses/aggregate.mjs";
import { classifyClaim } from "../uses/classify.mjs";
import { buildEvidenceRecords } from "../uses/evidence.mjs";
import { extractUsesFromHtml } from "../uses/extract.mjs";
import { reconcileMemberUsage } from "../uses/reconcile.mjs";

/**
 * @typedef {object} UsesCatalog
 * @property {object[]} tools
 * @property {object[]} aliases
 * @property {object[]} [categories]
 * @property {object[]} [useCases]
 */

/**
 * Loads a uses page body from the source store for a successful observation.
 * @param {import('./source-store.mjs').SourceStore} sourceStore
 * @param {object} observation
 * @returns {Promise<string>}
 */
export async function loadObservationHtml(sourceStore, observation) {
  if (!observation?.source_hash) {
    throw new Error("observation missing source_hash");
  }
  const body = await sourceStore.get(observation.source_hash);
  return body.toString("utf8");
}

/**
 * Extracts Uses claims from a durable resource observation body.
 * @param {object} input
 * @param {import('./source-store.mjs').SourceStore} input.sourceStore
 * @param {object} input.observation
 * @param {string} [input.page_url]
 * @returns {Promise<ReturnType<typeof extractUsesFromHtml>>}
 */
export async function extractUsesFromObservation(input) {
  const html = await loadObservationHtml(input.sourceStore, input.observation);
  const pageUrl =
    input.page_url ||
    input.observation.final_url ||
    input.observation.requested_url;
  return extractUsesFromHtml(html, { url: pageUrl });
}

/**
 * Builds evidence + member state from one verified Uses observation.
 * @param {object} input
 * @param {import('./source-store.mjs').SourceStore} input.sourceStore
 * @param {object} input.observation
 * @param {string} input.origin
 * @param {UsesCatalog} input.catalog
 * @param {object|null} [input.previous]
 * @param {string} [input.observed_at]
 * @returns {Promise<{
 *   extracted: ReturnType<typeof extractUsesFromHtml>,
 *   evidence: object[],
 *   events: object[],
 *   next: object,
 * }>}
 */
export async function processUsesObservation(input) {
  const pageUrl =
    input.observation.final_url || input.observation.requested_url;
  const extracted = await extractUsesFromObservation({
    sourceStore: input.sourceStore,
    observation: input.observation,
    page_url: pageUrl,
  });
  const evidence = buildEvidenceRecords({
    origin: input.origin,
    page_url: pageUrl,
    content_hash_source: extracted.content_hash_source,
    items: extracted.items,
    catalog: {
      tools: input.catalog.tools,
      aliases: input.catalog.aliases,
      useCases: input.catalog.useCases,
    },
  });
  const observedAt =
    input.observed_at ||
    input.observation.observed_at ||
    new Date().toISOString();
  const { events, next } = reconcileMemberUsage({
    previous: input.previous || null,
    origin: input.origin,
    page_url: pageUrl,
    page_status: extracted.outcome,
    observed_at: observedAt,
    evidence,
    pageComplete:
      extracted.outcome === "verified" ||
      extracted.outcome === "verified_empty",
    catalog: {
      tools: input.catalog.tools,
      aliases: input.catalog.aliases,
    },
  });
  return { extracted, evidence, events, next };
}

/**
 * Classifies extracted labels with the production catalog.
 * @param {Array<{ label: string, kind?: string, quantity?: number }>} items
 * @param {UsesCatalog} catalog
 * @returns {Array<object>}
 */
export function classifyExtractedItems(items, catalog) {
  return (items || []).map((item) => ({
    ...item,
    classification: classifyClaim(
      {
        name: item.label,
        kind: item.kind || "product",
        quantity: item.quantity,
      },
      catalog,
    ),
  }));
}

/**
 * Builds a period rollup from crawl-derived member state (no synthetic tools).
 * @param {object} input
 * @param {UsesCatalog} input.catalog
 * @param {object[]} input.members
 * @param {string[]} input.eligible_origins
 * @param {string} [input.period]
 * @param {string} [input.as_of]
 * @returns {Promise<object>}
 */
export async function rollupFromObservedMembers(input) {
  const period = input.period || "2026-11";
  const asOf = input.as_of || "2026-11-15T00:00:00.000Z";
  return buildPeriodRollup({
    period,
    granularity: "month",
    period_start: `${period}-01T00:00:00.000Z`,
    period_end_exclusive: "2026-12-01T00:00:00.000Z",
    as_of: asOf,
    is_complete: true,
    catalog: input.catalog,
    eligible_origins: input.eligible_origins,
    period_events: [],
    state: { members: input.members },
  });
}
