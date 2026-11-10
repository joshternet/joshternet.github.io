/**
 * Goal & Constraints:
 * Mark calendar periods complete after UTC boundary + successful reconciliation.
 * Weekly full replay helper for ops. Fail closed on invariant errors.
 * Closed rollups use point-in-time state at the period end.
 */

import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import { writeJSONAtomic } from "../nlp/lib.mjs";

import { AGGREGATION_VERSION, EXTRACTOR_VERSION } from "./constants.mjs";
import {
  buildPeriodRollup,
  monthBounds,
  quarterBounds,
  quarterKeyFromMonth,
  yearBounds,
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
 * Whether an existing complete rollup should be left alone.
 * @param {object|null} existing
 * @returns {boolean}
 */
function shouldKeepClosedRollup(existing) {
  if (!existing || existing.is_complete !== true) {
    return false;
  }
  if (
    existing.aggregation_version &&
    existing.aggregation_version !== AGGREGATION_VERSION
  ) {
    return false;
  }
  if (
    existing.extractor_version &&
    existing.extractor_version !== EXTRACTOR_VERSION
  ) {
    return false;
  }
  return true;
}

/**
 * Copies crawl page_status / URLs from durable state onto a point-in-time
 * replay. Close must not rewrite state.json (build owns the overlay).
 * @param {{ members?: object[] }} pointInTime
 * @param {{ members?: object[] }|null} durable
 * @returns {{ members?: object[], schema_version?: number, through_event_id?: string }}
 */
export function mergeDurablePageMeta(pointInTime, durable) {
  /** @type {Map<string, object>} */
  const byOrigin = new Map(
    (durable?.members || []).map((member) => [member.origin, member]),
  );
  for (const member of pointInTime.members || []) {
    const overlay = byOrigin.get(member.origin);
    if (!overlay) {
      continue;
    }
    if (overlay.page_status) {
      member.page_status = overlay.page_status;
    }
    if (overlay.page_url) {
      member.page_url = overlay.page_url;
    }
  }
  return pointInTime;
}

/**
 * Closes a calendar period when the UTC boundary has passed.
 * Does not rewrite state.json — only writes the complete rollup file.
 * @param {object} input
 * @param {string} input.usesRoot
 * @param {string} input.period
 * @param {'month'|'quarter'|'year'} input.granularity
 * @param {string} input.as_of
 * @param {string[]} input.eligible_origins
 * @param {object} [input.catalog]
 * @param {(text: string, labels: string[]) => Promise<object>} [input.classify]
 * @param {{ threshold: number, margin: number }} [input.policy]
 * @param {Map<string, object>} [input.inferenceCache]
 * @param {{ hits: number, misses: number, decisions: number, abstained: number }} [input.inferenceStats]
 * @param {string} [input.modelRevision]
 * @param {string} [input.templateVersion]
 * @param {string} [input.hypothesisTemplate]
 * @returns {Promise<{ closed: boolean, rollup: object|null, reason?: string }>}
 */
export async function closeCalendarPeriod(input) {
  const granularity = input.granularity || "month";
  const bounds =
    granularity === "quarter"
      ? quarterBounds(input.period)
      : granularity === "year"
        ? yearBounds(input.period)
        : monthBounds(input.period);
  if (!periodBoundaryPassed(bounds.endExclusive, input.as_of)) {
    return {
      closed: false,
      rollup: null,
      reason: "boundary_not_reached",
    };
  }

  const rollupPath = path.join(
    input.usesRoot,
    "rollups",
    granularity,
    `${input.period}.json`,
  );
  const existing = await readJson(rollupPath, null);
  if (shouldKeepClosedRollup(existing)) {
    return { closed: true, rollup: existing, reason: "already_complete" };
  }

  const validation = await validateUsesRoot(input.usesRoot);
  if (!validation.ok) {
    return {
      closed: false,
      rollup: null,
      reason: validation.errors.join("; "),
    };
  }

  const events = await loadAllEvents(input.usesRoot);
  const durable = await readJson(path.join(input.usesRoot, "state.json"), null);
  const state = mergeDurablePageMeta(
    replayState(events, { asOfExclusive: bounds.endExclusive }),
    durable,
  );

  const periodEvents = events.filter((event) => {
    const t = Date.parse(event.observed_at);
    return t >= Date.parse(bounds.start) && t < Date.parse(bounds.endExclusive);
  });

  const rollup = await buildPeriodRollup({
    period: input.period,
    granularity,
    period_start: bounds.start,
    period_end_exclusive: bounds.endExclusive,
    as_of: bounds.endExclusive,
    is_complete: true,
    eligible_origins: input.eligible_origins,
    state,
    period_events: periodEvents,
    catalog: input.catalog || (await loadCloseCatalog(input.usesRoot)),
    classify: input.classify,
    policy: input.policy,
    inferenceCache: input.inferenceCache,
    inferenceStats: input.inferenceStats,
    modelRevision: input.modelRevision,
    templateVersion: input.templateVersion,
    hypothesisTemplate: input.hypothesisTemplate,
  });

  await mkdir(path.join(input.usesRoot, "rollups", granularity), {
    recursive: true,
  });
  await writeJSONAtomic(rollupPath, rollup);

  return { closed: true, rollup };
}

/**
 * Closes a month period when the UTC boundary has passed.
 * @param {object} input
 * @param {string} input.usesRoot
 * @param {string} input.period - YYYY-MM
 * @param {string} input.as_of
 * @param {string[]} input.eligible_origins
 * @param {object} [input.catalog]
 * @returns {Promise<{ closed: boolean, rollup: object|null, reason?: string }>}
 */
export async function closeMonthPeriod(input) {
  return closeCalendarPeriod({ ...input, granularity: "month" });
}

/**
 * Closes a quarter when its UTC boundary has passed.
 * @param {object} input
 * @returns {Promise<{ closed: boolean, rollup: object|null, reason?: string }>}
 */
export async function closeQuarterPeriod(input) {
  return closeCalendarPeriod({ ...input, granularity: "quarter" });
}

/**
 * Closes a year when its UTC boundary has passed.
 * @param {object} input
 * @returns {Promise<{ closed: boolean, rollup: object|null, reason?: string }>}
 */
export async function closeYearPeriod(input) {
  return closeCalendarPeriod({ ...input, granularity: "year" });
}

/**
 * Lists stored rollup period entries under a uses root.
 * @param {string} usesRoot
 * @returns {Promise<Array<{ id: string, granularity: string, complete: boolean, path: string }>>}
 */
export async function listStoredPeriodEntries(usesRoot) {
  /** @type {Array<{ id: string, granularity: string, complete: boolean, path: string }>} */
  const entries = [];
  for (const granularity of ["month", "quarter", "year"]) {
    const dir = path.join(usesRoot, "rollups", granularity);
    let names = [];
    try {
      names = await readdir(dir);
    } catch {
      names = [];
    }
    for (const name of names.filter((file) => file.endsWith(".json")).sort()) {
      const id = name.replace(/\.json$/, "");
      const full = path.join(dir, name);
      const doc = await readJson(full, null);
      entries.push({
        id,
        granularity,
        complete: Boolean(doc?.is_complete),
        path: full,
      });
    }
  }
  const allTimePath = path.join(usesRoot, "rollups", "all-time.json");
  const allTime = await readJson(allTimePath, null);
  if (allTime) {
    entries.push({
      id: "all-time",
      granularity: "all-time",
      complete: Boolean(allTime.is_complete),
      path: allTimePath,
    });
  }
  return entries;
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
