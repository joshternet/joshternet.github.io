/**
 * One-shot reclassification of stored Uses evidence. Not a crawl.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { writeJSONAtomic } from "../nlp/lib.mjs";

import {
  buildPeriodRollup,
  monthBounds,
  quarterBounds,
  quarterKeyFromMonth,
  trendReady,
  yearBounds,
} from "./aggregate.mjs";
import { loadCatalog } from "./build.mjs";
import { buildMigrationReport } from "./classify.mjs";
import { USES_SCHEMA_VERSION } from "./constants.mjs";
import { buildUsageGraph } from "./graph.mjs";
import { normalizeOrigin } from "./discover.mjs";
import { readJson } from "./store.mjs";
import { validateRollupInvariants, validateUsesRoot } from "./validate.mjs";
import {
  buildPublicIndex,
  buildUsesSummary,
  writePublicViews,
} from "./view.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const usesRoot = path.join(repoRoot, "data", "uses");
const catalog = await loadCatalog(usesRoot);
const state = await readJson(path.join(usesRoot, "state.json"), {
  members: [],
});
const network = JSON.parse(
  await readFile(path.join(repoRoot, "_data", "network.json"), "utf8"),
);
const eligibleOrigins = network.map((site) => site.origin);
const prior = await readJson(
  path.join(usesRoot, "rollups", "month", "2026-11.json"),
  {
    as_of: "2026-11-05T01:03:21.897Z",
  },
);
const observedAt = prior.as_of;
const period = "2026-11";
const bounds = monthBounds(period);
const input = {
  as_of: observedAt,
  is_complete: false,
  eligible_origins: eligibleOrigins,
  state,
  catalog,
};

const monthRollup = await buildPeriodRollup({
  ...input,
  period,
  granularity: "month",
  period_start: bounds.start,
  period_end_exclusive: bounds.endExclusive,
  period_events: [],
});
const errors = validateRollupInvariants(monthRollup);
if (errors.length) {
  throw new Error(errors.join("; "));
}
const qKey = quarterKeyFromMonth(period);
const qBounds = quarterBounds(qKey);
const quarterRollup = await buildPeriodRollup({
  ...input,
  period: qKey,
  granularity: "quarter",
  period_start: qBounds.start,
  period_end_exclusive: qBounds.endExclusive,
  period_events: [],
});
const year = period.slice(0, 4);
const yBounds = yearBounds(year);
const yearRollup = await buildPeriodRollup({
  ...input,
  period: year,
  granularity: "year",
  period_start: yBounds.start,
  period_end_exclusive: yBounds.endExclusive,
  period_events: [],
});
const allTimeRollup = await buildPeriodRollup({
  ...input,
  period: "all-time",
  granularity: "all-time",
  period_start: "1970-01-01T00:00:00.000Z",
  period_end_exclusive: "9999-01-01T00:00:00.000Z",
  period_events: [],
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
await writeJSONAtomic(
  path.join(usesRoot, "slot-migration.json"),
  buildMigrationReport(state.members, catalog),
);

const summary = buildUsesSummary({
  rollup: monthRollup,
  supported_periods: [period, qKey, year, "all-time"],
  as_of: observedAt,
  eligible_member_count: eligibleOrigins.length,
  verified_uses_member_count: monthRollup.verified_uses_member_count,
  trend_ready: trendReady([
    monthRollup,
    quarterRollup,
    yearRollup,
    allTimeRollup,
  ]),
  members: state.members.map((member) => ({
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
  state,
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
await writePublicViews({
  repoRoot,
  summary,
  index: buildPublicIndex({
    as_of: observedAt,
    periods: [
      { id: period, granularity: "month", complete: false },
      { id: qKey, granularity: "quarter", complete: false },
      { id: year, granularity: "year", complete: false },
      { id: "all-time", granularity: "all-time", complete: false },
    ],
    early_sample: summary.early_sample,
    trend_ready: summary.trend_ready,
    extractor_version: monthRollup.extractor_version,
    snapshot_id: monthRollup.snapshot_id,
  }),
  membersDoc: {
    schema_version: USES_SCHEMA_VERSION,
    members: state.members.map((member) => ({
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
  periodDocs: [
    { path: `periods/month/${period}.json`, document: monthRollup },
    { path: `periods/quarter/${qKey}.json`, document: quarterRollup },
    { path: `periods/year/${year}.json`, document: yearRollup },
    { path: "periods/all-time.json", document: allTimeRollup },
  ],
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
