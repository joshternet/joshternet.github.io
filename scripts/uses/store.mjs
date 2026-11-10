/**
 * Goal & Constraints:
 * Append-only event/check shard IO and deterministic state replay. State is a
 * cache; history shards are authoritative.
 */

import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { writeJSONAtomic } from "../nlp/lib.mjs";
import { decodeCrawlValue } from "../nlp/site-record.mjs";

import { USES_SCHEMA_VERSION } from "./constants.mjs";
import { isReportableUseLabel, sanitizeLabel } from "./normalize.mjs";
import { compareEvents } from "./reconcile.mjs";

/**
 * Instant strictly after `iso` for inclusive “as of now” replay filters.
 * @param {string} iso
 * @returns {string}
 */
export function exclusiveAfter(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid timestamp: ${iso}`);
  }
  return new Date(ms + 1).toISOString();
}

/**
 * Earlier of two exclusive bounds (ISO timestamps).
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function earlierExclusive(a, b) {
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

/**
 * UTC month key for an RFC3339 timestamp.
 * @param {string} iso
 * @returns {string} YYYY-MM
 */
export function periodKeyFromIso(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid timestamp: ${iso}`);
  }
  return new Date(ms).toISOString().slice(0, 7);
}

/**
 * UTC date key YYYY-MM-DD.
 * @param {string} iso
 * @returns {string}
 */
export function dateKeyFromIso(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid timestamp: ${iso}`);
  }
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Path to a monthly event shard.
 * @param {string} rootDir - data/uses root.
 * @param {string} period - YYYY-MM
 * @returns {string}
 */
export function eventsShardPath(rootDir, period) {
  const year = period.slice(0, 4);
  return path.join(rootDir, "events", year, `${period}.json`);
}

/**
 * Path to a monthly checks shard.
 * @param {string} rootDir
 * @param {string} period
 * @returns {string}
 */
export function checksShardPath(rootDir, period) {
  const year = period.slice(0, 4);
  return path.join(rootDir, "checks", year, `${period}.json`);
}

/**
 * Reads JSON if present.
 * @param {string} filePath
 * @param {unknown} fallback
 * @returns {Promise<any>}
 */
export async function readJson(filePath, fallback) {
  try {
    return decodeCrawlValue(JSON.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if (
      error &&
      /** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT"
    ) {
      return fallback;
    }
    throw error;
  }
}

/**
 * Appends events to the month shard (deduping by event_id).
 * @param {string} rootDir
 * @param {object[]} events
 * @returns {Promise<{ period: string, added: number }>}
 */
export async function appendEvents(rootDir, events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { period: "", added: 0 };
  }
  const byPeriod = new Map();
  for (const event of events) {
    const period = periodKeyFromIso(event.observed_at);
    if (!byPeriod.has(period)) {
      byPeriod.set(period, []);
    }
    byPeriod.get(period).push(event);
  }

  let added = 0;
  let lastPeriod = "";
  for (const [period, batch] of [...byPeriod.entries()].sort()) {
    lastPeriod = period;
    const filePath = eventsShardPath(rootDir, period);
    await mkdir(path.dirname(filePath), { recursive: true });
    const existing = await readJson(filePath, {
      schema_version: USES_SCHEMA_VERSION,
      period,
      events: [],
    });
    const ids = new Set(
      (existing.events || []).map(
        (/** @type {{ event_id: string }} */ e) => e.event_id,
      ),
    );
    const merged = [...(existing.events || [])];
    for (const event of batch) {
      if (ids.has(event.event_id)) {
        continue;
      }
      ids.add(event.event_id);
      merged.push(event);
      added += 1;
    }
    merged.sort(compareEvents);
    await writeJSONAtomic(filePath, {
      schema_version: USES_SCHEMA_VERSION,
      period,
      events: merged,
    });
  }
  return { period: lastPeriod, added };
}

/**
 * Upserts a daily check row (one per origin/day).
 * @param {string} rootDir
 * @param {object} check
 * @returns {Promise<void>}
 */
export async function upsertDailyCheck(rootDir, check) {
  const period = periodKeyFromIso(`${check.date}T00:00:00Z`);
  const filePath = checksShardPath(rootDir, period);
  await mkdir(path.dirname(filePath), { recursive: true });
  const existing = await readJson(filePath, {
    schema_version: USES_SCHEMA_VERSION,
    period,
    checks: [],
  });
  const checks = [...(existing.checks || [])];
  const index = checks.findIndex(
    (row) => row.date === check.date && row.origin === check.origin,
  );
  if (index >= 0) {
    const prior = checks[index];
    // Replace only when materially better evidence.
    if (
      (check.verified_item_count || 0) >= (prior.verified_item_count || 0) ||
      check.outcome === "verified"
    ) {
      checks[index] = check;
    }
  } else {
    checks.push(check);
  }
  checks.sort((a, b) => {
    const d = String(a.date).localeCompare(String(b.date));
    if (d !== 0) {
      return d;
    }
    return String(a.origin).localeCompare(String(b.origin));
  });
  await writeJSONAtomic(filePath, {
    schema_version: USES_SCHEMA_VERSION,
    period,
    checks,
  });
}

/**
 * Loads all events from shards under rootDir/events.
 * @param {string} rootDir
 * @returns {Promise<object[]>}
 */
export async function loadAllEvents(rootDir) {
  const eventsRoot = path.join(rootDir, "events");
  /** @type {object[]} */
  const all = [];
  let years;
  try {
    years = await readdir(eventsRoot, { withFileTypes: true });
  } catch (error) {
    if (
      error &&
      /** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }
  for (const yearEnt of years) {
    if (!yearEnt.isDirectory()) {
      continue;
    }
    const yearDir = path.join(eventsRoot, yearEnt.name);
    const files = await readdir(yearDir);
    for (const name of files.filter((f) => f.endsWith(".json")).sort()) {
      const doc = await readJson(path.join(yearDir, name), { events: [] });
      for (const event of doc.events || []) {
        all.push(event);
      }
    }
  }
  all.sort(compareEvents);
  return all;
}

/**
 * Replays events into member state.
 * When `asOfExclusive` is set, only events strictly before that instant count
 * so a closed month keeps the setup as of its UTC boundary.
 * @param {object[]} events
 * @param {{ asOfExclusive?: string }} [options]
 * @returns {{ schema_version: number, through_event_id: string, members: object[] }}
 */
export function replayState(events, options = {}) {
  /** @type {Map<string, object>} */
  const members = new Map();

  const asOfExclusive = options.asOfExclusive
    ? Date.parse(options.asOfExclusive)
    : Number.NaN;
  const ordered = [...events]
    .filter((event) => {
      if (!Number.isFinite(asOfExclusive)) {
        return true;
      }
      const observed = Date.parse(event.observed_at);
      return Number.isFinite(observed) && observed < asOfExclusive;
    })
    .sort(compareEvents);
  let through = "";

  for (const event of ordered) {
    through = event.event_id;
    const origin = event.origin;
    if (!members.has(origin)) {
      members.set(origin, {
        origin,
        page_url: event.page_url || "",
        page_status: "verified",
        first_valid_observation_at: event.observed_at,
        last_valid_observation_at: event.observed_at,
        tools: [],
      });
    }
    const member = members.get(origin);
    member.page_url = event.page_url || member.page_url;
    member.last_valid_observation_at = event.observed_at;

    if (event.event_type === "source_status_changed") {
      continue;
    }
    if (event.event_type === "member_eligibility_changed") {
      continue;
    }
    if (!event.tool_id) {
      continue;
    }

    /** @type {object[]} */
    const tools = member.tools;
    const index = tools.findIndex((t) => t.tool_id === event.tool_id);

    if (
      event.event_type === "usage_removed" ||
      (event.event_type === "correction" && event.status === "removed")
    ) {
      if (index >= 0) {
        tools.splice(index, 1);
      }
      continue;
    }

    const label = sanitizeLabel(event.evidence?.label || "");
    const priorTool = index >= 0 ? tools[index] : null;
    const evidenceQuantity = event.evidence?.quantity;
    const quantity =
      Number.isFinite(evidenceQuantity) && evidenceQuantity > 0
        ? Math.min(99, Math.floor(evidenceQuantity))
        : Number.isFinite(priorTool?.quantity) && priorTool.quantity > 0
          ? Math.min(99, Math.floor(priorTool.quantity))
          : 1;
    const nextTool = {
      tool_id: event.tool_id,
      name: isReportableUseLabel(label)
        ? label
        : priorTool
          ? priorTool.name || ""
          : "",
      kind: event.evidence?.kind || priorTool?.kind || "product",
      context: event.evidence?.context || "",
      section: event.evidence?.section || "",
      section_path: event.evidence?.section_path || "",
      href: event.evidence?.href || "",
      status: event.status,
      quantity,
      use_case_ids: [...(event.use_case_ids || [])].sort(),
      first_observed_at: priorTool
        ? priorTool.first_observed_at
        : event.observed_at,
      last_event_at: event.observed_at,
      evidence_event_id: event.event_id,
    };

    if (index >= 0) {
      tools[index] = nextTool;
    } else {
      tools.push(nextTool);
    }
    tools.sort((a, b) => a.tool_id.localeCompare(b.tool_id));
  }

  const memberList = [...members.values()].sort((a, b) =>
    a.origin.localeCompare(b.origin),
  );

  return {
    schema_version: USES_SCHEMA_VERSION,
    through_event_id: through,
    members: memberList,
  };
}

/**
 * Writes state.json atomically.
 * @param {string} rootDir
 * @param {object} state
 * @returns {Promise<void>}
 */
export async function writeState(rootDir, state) {
  await mkdir(rootDir, { recursive: true });
  await writeJSONAtomic(path.join(rootDir, "state.json"), state);
}
