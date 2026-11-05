/**
 * Goal & Constraints:
 * Mark calendar periods complete after UTC boundary + successful reconciliation.
 * Weekly full replay helper for ops. Fail closed on invariant errors.
 */

import path from "node:path";

import { writeJSONAtomic } from "../nlp/lib.mjs";

import {
  buildPeriodRollup,
  monthBounds,
  quarterKeyFromMonth,
} from "./aggregate.mjs";
import { loadAllEvents, readJson, replayState, writeState } from "./store.mjs";
import { validateUsesRoot } from "./validate.mjs";

/**
 * Reads the slot catalog stored beside a uses root.
 * @param {string} usesRoot
 * @returns {Promise<object>}
 */
async function loadCloseCatalog(usesRoot) {
  const base = path.join(usesRoot, "catalog");
  const toolsDoc = await readJson(path.join(base, "tools.json"), {
    tools: [],
  });
  const aliasDoc = await readJson(path.join(base, "aliases.json"), {
    aliases: [],
  });
  const categoryDoc = await readJson(path.join(base, "categories.json"), {
    categories: [],
  });
  return {
    tools: toolsDoc.tools || [],
    aliases: aliasDoc.aliases || [],
    categories: categoryDoc.categories || [],
  };
}

/**
 * Returns whether `asOf` is strictly after the period end boundary.
 * @param {string} periodEndExclusive
 * @param {string} asOf
 * @returns {boolean}
 */
export function periodBoundaryPassed(periodEndExclusive, asOf) {
  return Date.parse(asOf) >= Date.parse(periodEndExclusive);
}

/**
 * Closes a month period when the UTC boundary has passed.
 * @param {object} input
 * @param {string} input.usesRoot
 * @param {string} input.period - YYYY-MM
 * @param {string} input.as_of
 * @param {string[]} input.eligible_origins
 * @returns {Promise<{ closed: boolean, rollup: object|null, reason?: string }>}
 */
export async function closeMonthPeriod(input) {
  const bounds = monthBounds(input.period);
  if (!periodBoundaryPassed(bounds.endExclusive, input.as_of)) {
    return {
      closed: false,
      rollup: null,
      reason: "boundary_not_reached",
    };
  }

  const events = await loadAllEvents(input.usesRoot);
  const state = replayState(events);
  await writeState(input.usesRoot, state);

  const periodEvents = events.filter((event) => {
    const t = Date.parse(event.observed_at);
    return t >= Date.parse(bounds.start) && t < Date.parse(bounds.endExclusive);
  });

  const rollup = await buildPeriodRollup({
    period: input.period,
    granularity: "month",
    period_start: bounds.start,
    period_end_exclusive: bounds.endExclusive,
    as_of: input.as_of,
    is_complete: true,
    eligible_origins: input.eligible_origins,
    state,
    period_events: periodEvents,
    catalog: input.catalog || (await loadCloseCatalog(input.usesRoot)),
  });

  const validation = await validateUsesRoot(input.usesRoot);
  if (!validation.ok) {
    return {
      closed: false,
      rollup: null,
      reason: validation.errors.join("; "),
    };
  }

  await writeJSONAtomic(
    path.join(input.usesRoot, "rollups", "month", `${input.period}.json`),
    rollup,
  );

  return { closed: true, rollup };
}

/**
 * Full deterministic weekly reconciliation: replay events → state → validate.
 * @param {string} usesRoot
 * @returns {Promise<{ ok: boolean, through_event_id: string, errors: string[] }>}
 */
export async function weeklyReconcile(usesRoot) {
  const events = await loadAllEvents(usesRoot);
  const state = replayState(events);
  await writeState(usesRoot, state);
  const validation = await validateUsesRoot(usesRoot);
  return {
    ok: validation.ok,
    through_event_id: state.through_event_id,
    errors: validation.errors,
  };
}

/**
 * Suggests which periods to attempt closing at asOf.
 * @param {string} asOf
 * @returns {{ month: string, quarter: string, year: string }}
 */
export function previousCompletePeriodKeys(asOf) {
  const ms = Date.parse(asOf);
  const d = new Date(ms);
  const prevMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1),
  );
  const month = prevMonth.toISOString().slice(0, 7);
  return {
    month,
    quarter: quarterKeyFromMonth(month),
    year: String(prevMonth.getUTCFullYear()),
  };
}

/**
 * Ops metrics snapshot for a run.
 * @param {object} metrics
 * @returns {object}
 */
export function formatOpsMetrics(metrics) {
  return {
    registry_eligible: metrics.eligible_member_count || 0,
    verified: metrics.verified_count || 0,
    uncertain: metrics.uncertain_count || 0,
    blocked: metrics.blocked_count || 0,
    unreachable: metrics.unreachable_count || 0,
    extraction_items: metrics.extraction_item_count || 0,
    events_added: metrics.events_added || 0,
    events_removed: metrics.events_removed || 0,
    unresolved: metrics.unresolved_count || 0,
    publish: Boolean(metrics.publish),
    as_of: metrics.as_of || new Date().toISOString(),
  };
}
