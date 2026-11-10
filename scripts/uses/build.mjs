/**
 * Goal & Constraints:
 * Orchestrates uses discovery → extract → evidence → reconcile → store →
 * rollups → public views. Called from nlp:sync. No network side effects on
 * import. Public paths use resolvePreviewPublish(JOSHTERNET_USES_PUBLISH):
 * local crawls default on so /uses/ previews; CI stays shadow unless opted in.
 *
 * Coverage-excluded CLI entrypoint (like scripts/nlp/sync.mjs).
 */

import { mkdir, mkdtemp, readFile, rm, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeJSONAtomic } from "../nlp/lib.mjs";
import { resolvePreviewPublish } from "../nlp/preview-publish.mjs";

import { cacheMatchesLock } from "./infer-policy.mjs";
import { loadLockedClassifier } from "./infer-local.mjs";
import { hashTree } from "./prepare-model.mjs";

import {
  EXTRACTOR_VERSION,
  isHubOrigin,
  TAXONOMY_VERSION,
  USES_SCHEMA_VERSION,
} from "./constants.mjs";
import {
  buildPeriodRollup,
  trendReady,
  withPreviousPeriodChanges,
  monthBounds,
  quarterBounds,
  quarterKeyFromMonth,
  yearBounds,
} from "./aggregate.mjs";
import {
  closeMonthPeriod,
  closeQuarterPeriod,
  closeYearPeriod,
  listStoredPeriodEntries,
  previousCompletePeriodKeys,
} from "./period-close.mjs";
import { contentFingerprint } from "./build-helpers.mjs";
import {
  discoverUsesPages,
  homeHtmlFromPages,
  normalizeOrigin,
  usesHtmlRepeatsHomepage,
} from "./discover.mjs";
import { buildEvidenceRecords } from "./evidence.mjs";
import { extractUsesFromHtml } from "./extract.mjs";
import { buildUsageGraph } from "./graph.mjs";
import {
  evaluateUsesQuality,
  partitionIdentityCorrections,
} from "./quality.mjs";
import { buildMigrationReport } from "./classify.mjs";
import { reconcileMemberUsage } from "./reconcile.mjs";
import {
  appendEvents,
  dateKeyFromIso,
  earlierExclusive,
  exclusiveAfter,
  loadAllEvents,
  periodKeyFromIso,
  readJson,
  replayState,
  upsertDailyCheck,
  writeState,
} from "./store.mjs";
import { validateRollupInvariants, validateUsesRoot } from "./validate.mjs";
import {
  buildPublicIndex,
  buildUsesSummary,
  writePublicViews,
} from "./view.mjs";

/**
 * Loads catalog documents from data/uses/catalog.
 * @param {string} usesRoot
 * @returns {Promise<object>}
 */
export async function loadCatalog(usesRoot) {
  const catalogDir = path.join(usesRoot, "catalog");
  const tools = await readJson(path.join(catalogDir, "tools.json"), {
    schema_version: 1,
    taxonomy_version: TAXONOMY_VERSION,
    tools: [],
  });
  const aliases = await readJson(path.join(catalogDir, "aliases.json"), {
    schema_version: 1,
    aliases: [],
  });
  const categories = await readJson(path.join(catalogDir, "categories.json"), {
    schema_version: 1,
    categories: [],
  });
  const useCases = await readJson(path.join(catalogDir, "use-cases.json"), {
    schema_version: 1,
    use_cases: [],
  });
  return {
    tools: tools.tools || [],
    aliases: aliases.aliases || [],
    categories: categories.categories || [],
    useCases: useCases.use_cases || [],
    taxonomy_version: tools.taxonomy_version || TAXONOMY_VERSION,
  };
}

/**
 * Loads the allowlisted classifier from the local cache.
 * A missing file or a hash that does not match the lock fails the Uses build.
 * @param {string} repoRoot
 * @returns {Promise<{ policy: { threshold: number, margin: number }, classify: (text: string, labels: string[]) => Promise<object> }>}
 */
async function loadUsesClassifier(repoRoot) {
  const lockPath = path.join(repoRoot, "data/classification/model-lock.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  const policy = JSON.parse(
    await readFile(
      path.join(repoRoot, "data/classification/policy.json"),
      "utf8",
    ),
  );
  const modelCache = path.join(repoRoot, ".tmp/models");
  let files;
  try {
    files = await hashTree(modelCache);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error("uses model cache is missing");
    }
    throw error;
  }
  const check = cacheMatchesLock(lock.files, files);
  if (!check.ok) {
    throw new Error(`uses model cache ${check.reason}`);
  }
  const loaded = await loadLockedClassifier({
    lockPath,
    localModelPath: modelCache,
  });
  return {
    policy: { threshold: policy.threshold, margin: policy.margin },
    revision: lock.revision || "",
    templateVersion: policy.template_version || 1,
    hypothesisTemplate: policy.hypothesis_template || "",
    classify: (text, labels) => loaded.classify(text, labels),
  };
}

/**
 * Processes in-memory crawl pages into uses updates for one sync run.
 * @param {object} input
 * @param {string} input.repoRoot
 * @param {Array<{ origin: string, title?: string, pages?: Array<{ url: string, html?: string }> }>} input.origins
 * @param {string} [input.observed_at]
 * @param {boolean} [input.publish]
 * @param {boolean} [input.dryRun]
 * @returns {Promise<object>} run metrics
 */
export async function buildUsesDatasets(input) {
  const repoRoot = input.repoRoot;
  const usesRoot = path.join(repoRoot, "data", "uses");
  const observedAt = input.observed_at || new Date().toISOString();
  const publish = resolvePreviewPublish(
    "JOSHTERNET_USES_PUBLISH",
    input.publish,
  );

  await ensureCatalogScaffold(usesRoot);
  const catalog = await loadCatalog(usesRoot);
  const priorState = await readJson(path.join(usesRoot, "state.json"), {
    schema_version: USES_SCHEMA_VERSION,
    through_event_id: "",
    members: [],
  });
  /** @type {Map<string, object>} */
  const priorByOrigin = new Map(
    (priorState.members || []).map((m) => [m.origin, m]),
  );

  const workRoot = await mkdtemp(path.join(os.tmpdir(), "joshternet-uses-"));
  try {
    await cp(usesRoot, workRoot, { recursive: true });
  } catch {
    await ensureCatalogScaffold(workRoot);
  }

  /** @type {object[]} */
  const newEvents = [];
  let verified = 0;
  let uncertain = 0;
  let blocked = 0;
  let unreachable = 0;
  let extractionItems = 0;
  let unresolved = 0;
  let removals = 0;
  let identityCorrections = 0;

  /** @type {Map<string, object>} */
  const nextMembers = new Map(
    (priorState.members || []).map((m) => [m.origin, structuredClone(m)]),
  );

  /** @type {string[]} */
  const eligibleOrigins = [];

  for (const originEntry of input.origins || []) {
    const origin = normalizeOrigin(originEntry.origin);
    if (!origin || isHubOrigin(origin)) {
      continue;
    }
    eligibleOrigins.push(origin);

    const discovered = discoverUsesPages({
      origin,
      pages: originEntry.pages || [],
    });

    let html = "";
    let pageUrl = discovered[0]?.page_url || `${origin}/uses/`;
    let pageStatus = "not_found";
    let homepageDuplicate = false;
    /** @type {ReturnType<typeof extractUsesFromHtml> | null} */
    let extracted = null;
    const assessment = originEntry.assessment;

    if (assessment && typeof assessment === "object") {
      if (typeof assessment.page_url === "string" && assessment.page_url) {
        pageUrl = assessment.page_url;
      }
      homepageDuplicate = assessment.homepage_duplicate === true;
      if (
        typeof assessment.page_status === "string" &&
        assessment.page_status
      ) {
        pageStatus = assessment.page_status;
      }
      extracted =
        assessment.extracted && typeof assessment.extracted === "object"
          ? assessment.extracted
          : null;
    } else {
      for (const page of originEntry.pages || []) {
        if (page?.outcome === "out_of_scope") {
          homepageDuplicate = true;
          if (typeof page.url === "string" && page.url) {
            pageUrl = page.url;
          }
          break;
        }
        if (!page?.html || typeof page.url !== "string") {
          continue;
        }
        if (/\/uses(?:\/|\.html?)?(?:$|\?)/i.test(page.url)) {
          html = page.html;
          pageUrl = page.url;
          break;
        }
      }

      if (
        !homepageDuplicate &&
        html &&
        usesHtmlRepeatsHomepage(
          html,
          homeHtmlFromPages(originEntry.pages || []),
        )
      ) {
        homepageDuplicate = true;
        html = "";
      }
    }

    if (homepageDuplicate) {
      pageStatus = "out_of_scope";
      const previous = priorByOrigin.get(origin) || null;
      const { events } = reconcileMemberUsage({
        previous,
        origin,
        page_url: pageUrl,
        page_status: pageStatus,
        observed_at: observedAt,
        evidence: [],
        pageComplete: true,
      });
      removals += events.filter((e) => e.event_type === "usage_removed").length;
      newEvents.push(...events);
      nextMembers.set(origin, {
        ...(previous || {}),
        origin,
        page_url: pageUrl,
        page_status: pageStatus,
        last_valid_observation_at: observedAt,
        tools: [],
      });
      await upsertDailyCheck(workRoot, {
        date: dateKeyFromIso(observedAt),
        origin,
        page_url: pageUrl,
        outcome: pageStatus,
        content_hash: "",
        verified_item_count: 0,
        extractor_version: EXTRACTOR_VERSION,
      });
      continue;
    }

    if (!html && !extracted) {
      if (!assessment) {
        pageStatus = discovered.length ? "not_checked" : "not_found";
      }
      if (pageStatus === "not_found") {
        unreachable += 1;
      }
      await upsertDailyCheck(workRoot, {
        date: dateKeyFromIso(observedAt),
        origin,
        page_url: pageUrl,
        outcome: pageStatus,
        content_hash: "",
        verified_item_count: 0,
        extractor_version: EXTRACTOR_VERSION,
      });
      continue;
    }

    if (!extracted) {
      extracted = extractUsesFromHtml(html);
    }
    pageStatus = extracted.outcome;
    if (pageStatus === "verified" || pageStatus === "verified_empty") {
      verified += 1;
    } else if (pageStatus === "uncertain" || pageStatus === "parse_error") {
      uncertain += 1;
    } else if (pageStatus === "disallowed") {
      blocked += 1;
    }

    const evidence = buildEvidenceRecords({
      origin,
      page_url: pageUrl,
      content_hash_source: extracted.content_hash_source,
      items: extracted.items,
      catalog: {
        tools: catalog.tools,
        aliases: catalog.aliases,
        useCases: catalog.useCases,
      },
    });
    extractionItems += evidence.length;
    unresolved += evidence.filter((e) => e.unresolved).length;

    const previous = priorByOrigin.get(origin) || null;
    const { events, next, identityPairs } = reconcileMemberUsage({
      previous,
      origin,
      page_url: pageUrl,
      page_status: pageStatus,
      observed_at: observedAt,
      evidence,
      pageComplete:
        pageStatus === "verified" || pageStatus === "verified_empty",
      catalog: {
        tools: catalog.tools,
        aliases: catalog.aliases,
      },
    });
    removals += events.filter((e) => e.event_type === "usage_removed").length;
    const remainingIds = (next.tools || [])
      .filter((tool) => !tool.status || tool.status === "current")
      .map((tool) => tool.tool_id);
    identityCorrections += partitionIdentityCorrections(
      events,
      identityPairs,
      remainingIds,
    ).identity_corrections;
    newEvents.push(...events);
    nextMembers.set(origin, next);

    await upsertDailyCheck(workRoot, {
      date: dateKeyFromIso(observedAt),
      origin,
      page_url: pageUrl,
      outcome: pageStatus,
      content_hash: contentFingerprint(extracted.content_hash_source),
      verified_item_count: evidence.filter((e) => !e.unresolved).length,
      extractor_version: EXTRACTOR_VERSION,
    });
  }

  await appendEvents(workRoot, newEvents);
  const allEvents = await loadAllEvents(workRoot);
  const state = overlayMemberPageMeta(replayState(allEvents), nextMembers);
  await writeState(workRoot, state);
  await writeJSONAtomic(
    path.join(workRoot, "slot-migration.json"),
    buildMigrationReport(state.members, catalog),
  );

  const model = await loadUsesClassifier(repoRoot);
  /** @type {Map<string, object>} */
  const inferenceCache = new Map();
  const inferenceStats = { hits: 0, misses: 0, decisions: 0, abstained: 0 };
  const rollupModel = {
    classify: model.classify,
    policy: model.policy,
    inferenceCache,
    inferenceStats,
    modelRevision: model.revision,
    templateVersion: model.templateVersion,
    hypothesisTemplate: model.hypothesisTemplate,
  };
  const period = periodKeyFromIso(observedAt);
  const bounds = monthBounds(period);
  const asOfNowExclusive = exclusiveAfter(observedAt);
  const monthEvents = allEvents.filter((e) => {
    const t = Date.parse(e.observed_at);
    return t >= Date.parse(bounds.start) && t < Date.parse(bounds.endExclusive);
  });
  const monthState = overlayMemberPageMeta(
    replayState(allEvents, {
      asOfExclusive: earlierExclusive(asOfNowExclusive, bounds.endExclusive),
    }),
    nextMembers,
  );

  let monthRollup = await buildPeriodRollup({
    period,
    granularity: "month",
    period_start: bounds.start,
    period_end_exclusive: bounds.endExclusive,
    as_of: observedAt,
    is_complete: false,
    eligible_origins: eligibleOrigins,
    state: monthState,
    period_events: monthEvents,
    catalog,
    ...rollupModel,
  });
  const rollupErrors = validateRollupInvariants(monthRollup);
  if (rollupErrors.length) {
    throw new Error(`uses rollup invalid: ${rollupErrors.join("; ")}`);
  }

  await mkdir(path.join(workRoot, "rollups", "month"), { recursive: true });
  await writeJSONAtomic(
    path.join(workRoot, "rollups", "month", `${period}.json`),
    monthRollup,
  );

  const qKey = quarterKeyFromMonth(period);
  const qBounds = quarterBounds(qKey);
  const quarterState = overlayMemberPageMeta(
    replayState(allEvents, {
      asOfExclusive: earlierExclusive(asOfNowExclusive, qBounds.endExclusive),
    }),
    nextMembers,
  );
  let quarterRollup = await buildPeriodRollup({
    period: qKey,
    granularity: "quarter",
    period_start: qBounds.start,
    period_end_exclusive: qBounds.endExclusive,
    as_of: observedAt,
    is_complete: false,
    eligible_origins: eligibleOrigins,
    state: quarterState,
    period_events: allEvents.filter((e) => {
      const t = Date.parse(e.observed_at);
      return (
        t >= Date.parse(qBounds.start) && t < Date.parse(qBounds.endExclusive)
      );
    }),
    catalog,
    ...rollupModel,
  });
  await mkdir(path.join(workRoot, "rollups", "quarter"), { recursive: true });
  await writeJSONAtomic(
    path.join(workRoot, "rollups", "quarter", `${qKey}.json`),
    quarterRollup,
  );

  const year = period.slice(0, 4);
  const yBounds = yearBounds(year);
  const yearState = overlayMemberPageMeta(
    replayState(allEvents, {
      asOfExclusive: earlierExclusive(asOfNowExclusive, yBounds.endExclusive),
    }),
    nextMembers,
  );
  let yearRollup = await buildPeriodRollup({
    period: year,
    granularity: "year",
    period_start: yBounds.start,
    period_end_exclusive: yBounds.endExclusive,
    as_of: observedAt,
    is_complete: false,
    eligible_origins: eligibleOrigins,
    state: yearState,
    period_events: allEvents.filter((e) => {
      const t = Date.parse(e.observed_at);
      return (
        t >= Date.parse(yBounds.start) && t < Date.parse(yBounds.endExclusive)
      );
    }),
    catalog,
    ...rollupModel,
  });
  await mkdir(path.join(workRoot, "rollups", "year"), { recursive: true });
  await writeJSONAtomic(
    path.join(workRoot, "rollups", "year", `${year}.json`),
    yearRollup,
  );

  const allTimeRollup = await buildPeriodRollup({
    period: "all-time",
    granularity: "all-time",
    period_start: "1970-01-01T00:00:00.000Z",
    period_end_exclusive: "9999-01-01T00:00:00.000Z",
    as_of: observedAt,
    is_complete: false,
    eligible_origins: eligibleOrigins,
    state,
    period_events: allEvents,
    catalog,
    ...rollupModel,
  });
  await writeJSONAtomic(
    path.join(workRoot, "rollups", "all-time.json"),
    allTimeRollup,
  );

  const priorKeys = previousCompletePeriodKeys(observedAt);
  const closeOpts = {
    usesRoot: workRoot,
    as_of: observedAt,
    eligible_origins: eligibleOrigins,
    catalog,
    ...rollupModel,
  };
  await closeMonthPeriod({ ...closeOpts, period: priorKeys.month });
  await closeQuarterPeriod({ ...closeOpts, period: priorKeys.quarter });
  await closeYearPeriod({ ...closeOpts, period: priorKeys.year });

  const priorMonthRollup = await readJson(
    path.join(workRoot, "rollups", "month", `${priorKeys.month}.json`),
    null,
  );
  monthRollup = withPreviousPeriodChanges(monthRollup, priorMonthRollup);
  await writeJSONAtomic(
    path.join(workRoot, "rollups", "month", `${period}.json`),
    monthRollup,
  );
  const priorQuarterRollup = await readJson(
    path.join(workRoot, "rollups", "quarter", `${priorKeys.quarter}.json`),
    null,
  );
  quarterRollup = withPreviousPeriodChanges(quarterRollup, priorQuarterRollup);
  await writeJSONAtomic(
    path.join(workRoot, "rollups", "quarter", `${qKey}.json`),
    quarterRollup,
  );
  const priorYearRollup = await readJson(
    path.join(workRoot, "rollups", "year", `${priorKeys.year}.json`),
    null,
  );
  yearRollup = withPreviousPeriodChanges(yearRollup, priorYearRollup);
  await writeJSONAtomic(
    path.join(workRoot, "rollups", "year", `${year}.json`),
    yearRollup,
  );

  const trend_ready = trendReady([priorMonthRollup, monthRollup]);

  const graph = buildUsageGraph({
    rollup: monthRollup,
    state,
    tools: catalog.tools,
    categories: catalog.categories,
    useCases: catalog.useCases,
    memberLabels: new Map(
      (input.origins || []).map((o) => [
        normalizeOrigin(o.origin),
        o.title || normalizeOrigin(o.origin),
      ]),
    ),
  });

  const summary = buildUsesSummary({
    rollup: monthRollup,
    supported_periods: [period, qKey, year, "all-time"],
    as_of: observedAt,
    eligible_member_count: eligibleOrigins.length,
    verified_uses_member_count: monthRollup.verified_uses_member_count,
    trend_ready,
    members: state.members.map((m) => ({
      origin: m.origin,
      page_url: m.page_url,
      page_status: m.page_status,
      accepted_count: (m.tools || []).filter(
        (tool) =>
          tool.status === "current" && (tool.kind || "product") === "product",
      ).length,
    })),
    catalog,
  });

  /** @type {Record<string, number>} */
  const slotCounts = {};
  for (const tool of monthRollup.tools || []) {
    if (!tool?.slot_id) {
      continue;
    }
    slotCounts[tool.slot_id] = (slotCounts[tool.slot_id] || 0) + 1;
  }
  const rankedCount = Object.values(slotCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  /** @type {Record<string, number>} */
  const slotShares = {};
  for (const [slot, count] of Object.entries(slotCounts)) {
    slotShares[slot] = rankedCount > 0 ? count / rankedCount : 0;
  }

  const metrics = {
    eligible_member_count: eligibleOrigins.length,
    verified_count: verified,
    uncertain_count: uncertain,
    blocked_count: blocked,
    unreachable_count: unreachable,
    extraction_item_count: extractionItems,
    events_added: newEvents.length,
    events_removed: removals,
    unresolved_count: unresolved,
    prior_active_edges: countActiveEdges(priorState),
    identity_corrections: identityCorrections,
    model_decisions: inferenceStats.decisions,
    model_abstentions: inferenceStats.abstained,
    model_cache_hits: inferenceStats.hits,
    model_cache_misses: inferenceStats.misses,
    ranked_count: rankedCount,
    slot_shares: slotShares,
  };

  const baselinePath = path.join(
    repoRoot,
    "data",
    "classification",
    "quality-baseline.json",
  );
  const metricsPath = path.join(
    repoRoot,
    "data",
    "classification",
    "run-metrics.json",
  );
  const previousQuality = await readJson(baselinePath, null);
  await writeJSONAtomic(metricsPath, metrics);
  const quality = evaluateUsesQuality(metrics, previousQuality);
  if (quality.block) {
    throw new Error(`uses quality blocked: ${quality.reasons.join(", ")}`);
  }
  if (!input.dryRun) {
    await writeJSONAtomic(baselinePath, metrics);
  }

  const validation = await validateUsesRoot(workRoot);
  if (!validation.ok) {
    throw new Error(`uses validate failed: ${validation.errors.join("; ")}`);
  }

  if (!input.dryRun) {
    await mkdir(usesRoot, { recursive: true });
    await cp(workRoot, usesRoot, { recursive: true });
  }

  if (publish && !input.dryRun) {
    const storedPeriods = await listStoredPeriodEntries(workRoot);
    const periodIndex = preferredPeriodIndexEntries(storedPeriods, {
      month: period,
      quarter: qKey,
      year,
    });
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
        eligible_member_count: eligibleOrigins.length,
        verified_uses_member_count: verified,
        member_count: state.members.length,
      },
      toolsDoc: {
        schema_version: USES_SCHEMA_VERSION,
        taxonomy_version: catalog.taxonomy_version,
        tools: catalog.tools,
      },
      periodDocs,
      graphDocs: [{ path: `graph/${period}.json`, document: graph }],
    });
  }

  await rm(workRoot, { recursive: true, force: true });
  return {
    ...metrics,
    dry_run: Boolean(input.dryRun),
    publish: Boolean(publish && !input.dryRun),
  };
}

/**
 * @param {object} state
 * @returns {number}
 */
function countActiveEdges(state) {
  let n = 0;
  for (const member of state.members || []) {
    for (const tool of member.tools || []) {
      if (tool.status === "current") {
        n += 1;
      }
    }
  }
  return n;
}

/**
 * Overlay page metadata only onto event-replayed members. Never invent
 * members outside the event log (breaks validateHistoryInvariants).
 * @param {{ members?: object[] }} state
 * @param {Map<string, object>} nextMembers
 * @returns {{ members: object[], schema_version?: number, through_event_id?: string }}
 */
function overlayMemberPageMeta(state, nextMembers) {
  for (const [origin, member] of nextMembers) {
    const replayed = (state.members || []).find((row) => row.origin === origin);
    if (!replayed) {
      continue;
    }
    replayed.page_status = member.page_status;
    replayed.page_url = member.page_url;
    replayed.first_valid_observation_at =
      member.first_valid_observation_at || replayed.first_valid_observation_at;
    replayed.last_valid_observation_at =
      member.last_valid_observation_at || replayed.last_valid_observation_at;
  }
  (state.members || []).sort((a, b) => a.origin.localeCompare(b.origin));
  return state;
}

/**
 * Public index lists every stored period; preferred current ids lead each
 * granularity so the browser `.find` resolves the live snapshot first.
 * @param {Array<{ id: string, granularity: string, complete: boolean }>} stored
 * @param {{ month: string, quarter: string, year: string }} current
 * @returns {Array<{ id: string, granularity: string, complete: boolean }>}
 */
function preferredPeriodIndexEntries(stored, current) {
  /** @type {Array<{ id: string, granularity: string, complete: boolean }>} */
  const preferred = [
    {
      id: current.month,
      granularity: "month",
      complete: false,
    },
    {
      id: current.quarter,
      granularity: "quarter",
      complete: false,
    },
    {
      id: current.year,
      granularity: "year",
      complete: false,
    },
    {
      id: "all-time",
      granularity: "all-time",
      complete: false,
    },
  ];
  const seen = new Set(preferred.map((row) => `${row.granularity}:${row.id}`));
  for (const entry of stored) {
    const key = `${entry.granularity}:${entry.id}`;
    if (seen.has(key)) {
      const match = preferred.find(
        (row) => row.granularity === entry.granularity && row.id === entry.id,
      );
      if (match) {
        match.complete = entry.complete;
      }
      continue;
    }
    seen.add(key);
    preferred.push({
      id: entry.id,
      granularity: entry.granularity,
      complete: entry.complete,
    });
  }
  return preferred;
}

/**
 * Ensures catalog + revisions scaffolding exists.
 * @param {string} usesRoot
 * @returns {Promise<void>}
 */
export async function ensureCatalogScaffold(usesRoot) {
  await mkdir(path.join(usesRoot, "catalog"), { recursive: true });
  await mkdir(path.join(usesRoot, "events"), { recursive: true });
  await mkdir(path.join(usesRoot, "checks"), { recursive: true });
  await mkdir(path.join(usesRoot, "rollups", "month"), { recursive: true });
  await mkdir(path.join(usesRoot, "rollups", "quarter"), { recursive: true });
  await mkdir(path.join(usesRoot, "rollups", "year"), { recursive: true });

  const toolsPath = path.join(usesRoot, "catalog", "tools.json");
  try {
    await readFile(toolsPath, "utf8");
  } catch {
    // Seed catalog is committed under data/uses/catalog.
  }
}

const isDirect =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirect) {
  const dryRun = process.argv.includes("--dry-run");
  buildUsesDatasets({
    repoRoot: process.cwd(),
    origins: [],
    dryRun,
    publish: false,
  })
    .then((metrics) => {
      console.log(JSON.stringify(metrics));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
