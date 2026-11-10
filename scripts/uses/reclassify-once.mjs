/**
 * One-shot reclassification of stored Uses evidence. Not a crawl.
 * Replays point-in-time state per period (same rules as buildUsesDatasets).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { writeJSONAtomic } from "../nlp/lib.mjs";
import { decodeCrawlValue } from "../nlp/site-record.mjs";

import {
  buildPeriodRollup,
  monthBounds,
  quarterBounds,
  quarterKeyFromMonth,
  trendReady,
  withPreviousPeriodChanges,
  yearBounds,
} from "./aggregate.mjs";
import { loadCatalog } from "./build.mjs";
import { buildMigrationReport } from "./classify.mjs";
import { USES_SCHEMA_VERSION } from "./constants.mjs";
import { buildUsageGraph } from "./graph.mjs";
import { normalizeOrigin } from "./discover.mjs";
import {
  closeMonthPeriod,
  closeQuarterPeriod,
  closeYearPeriod,
  listStoredPeriodEntries,
  previousCompletePeriodKeys,
} from "./period-close.mjs";
import {
  earlierExclusive,
  exclusiveAfter,
  loadAllEvents,
  periodKeyFromIso,
  readJson,
  replayState,
} from "./store.mjs";
import { validateRollupInvariants, validateUsesRoot } from "./validate.mjs";
import {
  buildPublicIndex,
  buildUsesSummary,
  writePublicViews,
} from "./view.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const usesRoot = path.join(repoRoot, "data", "uses");
const catalog = await loadCatalog(usesRoot);
const durableState = await readJson(path.join(usesRoot, "state.json"), {
  members: [],
});
const allEvents = await loadAllEvents(usesRoot);
const network = decodeCrawlValue(
  JSON.parse(
    await readFile(path.join(repoRoot, "_data", "network.json"), "utf8"),
  ),
);
const eligibleOrigins = network.map((site) => site.origin).filter(Boolean);

const priorHint = await readJson(
  path.join(
    usesRoot,
    "rollups",
    "month",
    `${periodKeyFromIso(new Date().toISOString())}.json`,
  ),
  null,
);
const observedAt =
  priorHint?.as_of ||
  durableState.members?.[0]?.last_valid_observation_at ||
  new Date().toISOString();
const period = periodKeyFromIso(observedAt);
const bounds = monthBounds(period);
const asOfNowExclusive = exclusiveAfter(observedAt);

/**
 * @param {{ members?: object[] }} pointInTime
 * @returns {{ members?: object[] }}
 */
function overlayFromDurable(pointInTime) {
  /** @type {Map<string, object>} */
  const byOrigin = new Map(
    (durableState.members || []).map((member) => [member.origin, member]),
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

const monthState = overlayFromDurable(
  replayState(allEvents, {
    asOfExclusive: earlierExclusive(asOfNowExclusive, bounds.endExclusive),
  }),
);
const monthEvents = allEvents.filter((event) => {
  const t = Date.parse(event.observed_at);
  return t >= Date.parse(bounds.start) && t < Date.parse(bounds.endExclusive);
});

let monthRollup = await buildPeriodRollup({
  as_of: observedAt,
  is_complete: false,
  eligible_origins: eligibleOrigins,
  state: monthState,
  catalog,
  period,
  granularity: "month",
  period_start: bounds.start,
  period_end_exclusive: bounds.endExclusive,
  period_events: monthEvents,
});
const errors = validateRollupInvariants(monthRollup);
if (errors.length) {
  throw new Error(errors.join("; "));
}

const qKey = quarterKeyFromMonth(period);
const qBounds = quarterBounds(qKey);
const quarterState = overlayFromDurable(
  replayState(allEvents, {
    asOfExclusive: earlierExclusive(asOfNowExclusive, qBounds.endExclusive),
  }),
);
let quarterRollup = await buildPeriodRollup({
  as_of: observedAt,
  is_complete: false,
  eligible_origins: eligibleOrigins,
  state: quarterState,
  catalog,
  period: qKey,
  granularity: "quarter",
  period_start: qBounds.start,
  period_end_exclusive: qBounds.endExclusive,
  period_events: allEvents.filter((event) => {
    const t = Date.parse(event.observed_at);
    return (
      t >= Date.parse(qBounds.start) && t < Date.parse(qBounds.endExclusive)
    );
  }),
});
const year = period.slice(0, 4);
const yBounds = yearBounds(year);
const yearState = overlayFromDurable(
  replayState(allEvents, {
    asOfExclusive: earlierExclusive(asOfNowExclusive, yBounds.endExclusive),
  }),
);
let yearRollup = await buildPeriodRollup({
  as_of: observedAt,
  is_complete: false,
  eligible_origins: eligibleOrigins,
  state: yearState,
  catalog,
  period: year,
  granularity: "year",
  period_start: yBounds.start,
  period_end_exclusive: yBounds.endExclusive,
  period_events: allEvents.filter((event) => {
    const t = Date.parse(event.observed_at);
    return (
      t >= Date.parse(yBounds.start) && t < Date.parse(yBounds.endExclusive)
    );
  }),
});
const allTimeRollup = await buildPeriodRollup({
  as_of: observedAt,
  is_complete: false,
  eligible_origins: eligibleOrigins,
  state: overlayFromDurable(replayState(allEvents)),
  catalog,
  period: "all-time",
  granularity: "all-time",
  period_start: "1970-01-01T00:00:00.000Z",
  period_end_exclusive: "9999-01-01T00:00:00.000Z",
  period_events: allEvents,
});

await writeJSONAtomic(
  path.join(usesRoot, "rollups", "month", `${period}.json`),
  monthRollup,
);
await writeJSONAtomic(
  path.join(usesRoot, "rollups", "quarter", `${qKey}.json`),
  quarterRollup,
);
await writeJSONAtomic(
  path.join(usesRoot, "rollups", "year", `${year}.json`),
  yearRollup,
);
await writeJSONAtomic(
  path.join(usesRoot, "rollups", "all-time.json"),
  allTimeRollup,
);

const priorKeys = previousCompletePeriodKeys(observedAt);
const closeOpts = {
  usesRoot,
  as_of: observedAt,
  eligible_origins: eligibleOrigins,
  catalog,
};
await closeMonthPeriod({ ...closeOpts, period: priorKeys.month });
await closeQuarterPeriod({ ...closeOpts, period: priorKeys.quarter });
await closeYearPeriod({ ...closeOpts, period: priorKeys.year });

const priorMonthRollup = await readJson(
  path.join(usesRoot, "rollups", "month", `${priorKeys.month}.json`),
  null,
);
monthRollup = withPreviousPeriodChanges(monthRollup, priorMonthRollup);
await writeJSONAtomic(
  path.join(usesRoot, "rollups", "month", `${period}.json`),
  monthRollup,
);
const priorQuarterRollup = await readJson(
  path.join(usesRoot, "rollups", "quarter", `${priorKeys.quarter}.json`),
  null,
);
quarterRollup = withPreviousPeriodChanges(quarterRollup, priorQuarterRollup);
await writeJSONAtomic(
  path.join(usesRoot, "rollups", "quarter", `${qKey}.json`),
  quarterRollup,
);
const priorYearRollup = await readJson(
  path.join(usesRoot, "rollups", "year", `${priorKeys.year}.json`),
  null,
);
yearRollup = withPreviousPeriodChanges(yearRollup, priorYearRollup);
await writeJSONAtomic(
  path.join(usesRoot, "rollups", "year", `${year}.json`),
  yearRollup,
);

const trend_ready = trendReady([priorMonthRollup, monthRollup]);

await writeJSONAtomic(
  path.join(usesRoot, "slot-migration.json"),
  buildMigrationReport(durableState.members, catalog),
);

const summary = buildUsesSummary({
  rollup: monthRollup,
  supported_periods: [period, qKey, year, "all-time"],
  as_of: observedAt,
  eligible_member_count: eligibleOrigins.length,
  verified_uses_member_count: monthRollup.verified_uses_member_count,
  trend_ready,
  members: durableState.members.map((member) => ({
    origin: member.origin,
    page_url: member.page_url,
    page_status: member.page_status,
    accepted_count: (member.tools || []).filter(
      (tool) =>
        tool.status === "current" && (tool.kind || "product") === "product",
    ).length,
  })),
  catalog,
});
const graph = buildUsageGraph({
  rollup: monthRollup,
  state: durableState,
  tools: catalog.tools,
  categories: catalog.categories,
  useCases: catalog.useCases,
  memberLabels: new Map(
    network.map((site) => [
      normalizeOrigin(site.origin),
      site.title || normalizeOrigin(site.origin),
    ]),
  ),
});

const storedPeriods = await listStoredPeriodEntries(usesRoot);
/** @type {Array<{ id: string, granularity: string, complete: boolean }>} */
const periodIndex = [
  { id: period, granularity: "month", complete: false },
  { id: qKey, granularity: "quarter", complete: false },
  { id: year, granularity: "year", complete: false },
  { id: "all-time", granularity: "all-time", complete: false },
];
const seen = new Set(periodIndex.map((row) => `${row.granularity}:${row.id}`));
for (const entry of storedPeriods) {
  const key = `${entry.granularity}:${entry.id}`;
  if (seen.has(key)) {
    const match = periodIndex.find(
      (row) => row.granularity === entry.granularity && row.id === entry.id,
    );
    if (match) {
      match.complete = entry.complete;
    }
    continue;
  }
  seen.add(key);
  periodIndex.push({
    id: entry.id,
    granularity: entry.granularity,
    complete: entry.complete,
  });
}

/** @type {Array<{ path: string, document: object }>} */
const periodDocs = [];
for (const entry of storedPeriods) {
  const document = await readJson(entry.path, null);
  if (!document) {
    continue;
  }
  const rel =
    entry.granularity === "all-time"
      ? "periods/all-time.json"
      : `periods/${entry.granularity}/${entry.id}.json`;
  periodDocs.push({ path: rel, document });
}

await writePublicViews({
  repoRoot,
  summary,
  index: buildPublicIndex({
    as_of: observedAt,
    periods: periodIndex,
    early_sample: summary.early_sample,
    trend_ready: summary.trend_ready,
    extractor_version: monthRollup.extractor_version,
    snapshot_id: monthRollup.snapshot_id,
  }),
  membersDoc: {
    schema_version: USES_SCHEMA_VERSION,
    members: durableState.members.map((member) => ({
      origin: member.origin,
      page_url: member.page_url,
      page_status: member.page_status,
      tool_count: (member.tools || []).filter(
        (tool) =>
          tool.status === "current" && (tool.kind || "product") === "product",
      ).length,
    })),
  },
  toolsDoc: {
    schema_version: USES_SCHEMA_VERSION,
    taxonomy_version: catalog.taxonomy_version,
    tools: catalog.tools,
  },
  periodDocs,
  graphDocs: [{ path: `graph/${period}.json`, document: graph }],
});

const validation = await validateUsesRoot(usesRoot);
if (!validation.ok) {
  throw new Error(validation.errors.join("; "));
}

console.log(
  JSON.stringify({
    snapshot_id: summary.snapshot_id,
    coverage: summary.verified_uses_member_count,
    slots: summary.slots.map((slot) => ({
      id: slot.id,
      denominator: slot.denominator,
      products: slot.products.map((product) => product.name),
    })),
    unsorted: summary.unsorted.length,
    setup: summary.setup.length,
    trend_ready: summary.trend_ready,
  }),
);
