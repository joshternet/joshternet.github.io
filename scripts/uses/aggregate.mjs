/**
 * Goal & Constraints:
 * UTC calendar rollups with explicit denominators. Distinct origins only.
 * Never sum monthly unique counts into quarterly/yearly unique counts.
 */

import { catalogFingerprint, classifyClaim } from "./classify.mjs";
import { applyModelProposal } from "./infer-policy.mjs";
import {
  AGGREGATION_VERSION,
  EXTRACTOR_VERSION,
  FRESHNESS_DAYS,
  SCORING_VERSION,
  USES_SCHEMA_VERSION,
} from "./constants.mjs";
import {
  comparisonLabel,
  isReportableUseLabel,
  productNameFromLabel,
  publicToolName,
} from "./normalize.mjs";

/**
 * @param {string} period - YYYY-MM
 * @returns {{ start: string, endExclusive: string }}
 */
export function monthBounds(period) {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return {
    start: start.toISOString(),
    endExclusive: end.toISOString(),
  };
}

/**
 * @param {string} period - YYYY-QN
 * @returns {{ start: string, endExclusive: string }}
 */
export function quarterBounds(period) {
  const match = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!match) {
    throw new Error(`Invalid quarter: ${period}`);
  }
  const year = Number(match[1]);
  const q = Number(match[2]);
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 1));
  return {
    start: start.toISOString(),
    endExclusive: end.toISOString(),
  };
}

/**
 * @param {string} year - YYYY
 * @returns {{ start: string, endExclusive: string }}
 */
export function yearBounds(year) {
  const y = Number(year);
  return {
    start: new Date(Date.UTC(y, 0, 1)).toISOString(),
    endExclusive: new Date(Date.UTC(y + 1, 0, 1)).toISOString(),
  };
}

/**
 * Quarter key containing a month.
 * @param {string} month - YYYY-MM
 * @returns {string}
 */
export function quarterKeyFromMonth(month) {
  const m = Number(month.slice(5, 7));
  const q = Math.floor((m - 1) / 3) + 1;
  return `${month.slice(0, 4)}-Q${q}`;
}

/**
 * Adoption score 0–100 or null when denominator is zero.
 * @param {number} active
 * @param {number} denominator
 * @returns {number|null}
 */
export function adoptionScore(active, denominator) {
  if (!denominator || denominator <= 0) {
    return null;
  }
  return Math.round((100 * active) / denominator);
}

/**
 * Whether an observation is fresh at asOf.
 * @param {string} lastValidAt
 * @param {string} asOf
 * @param {number} [days]
 * @returns {boolean}
 */
export function isFreshObservation(lastValidAt, asOf, days = FRESHNESS_DAYS) {
  const last = Date.parse(lastValidAt);
  const now = Date.parse(asOf);
  if (!Number.isFinite(last) || !Number.isFinite(now)) {
    return false;
  }
  return now - last <= days * 24 * 60 * 60 * 1000;
}

/**
 * Builds a period rollup from replayed state + eligibility.
 * @param {object} input
 * @param {string} input.period
 * @param {'month'|'quarter'|'year'|'all-time'} input.granularity
 * @param {string} input.period_start
 * @param {string} input.period_end_exclusive
 * @param {string} input.as_of
 * @param {boolean} input.is_complete
 * @param {string[]} input.eligible_origins
 * @param {object} input.state - replayed state.json shape
 * @param {object[]} [input.period_events] - events inside the period (for period-ever)
 * @param {Map<string, object>} [input.toolMeta]
 * @param {(text: string, labels: string[]) => Promise<object>} [input.classify]
 * @param {{ threshold: number, margin: number }} [input.policy]
 * @returns {Promise<object>}
 */
export async function buildPeriodRollup(input) {
  const eligible = new Set(input.eligible_origins || []);
  const asOf = input.as_of;
  const members = (input.state?.members || []).filter((m) =>
    eligible.has(m.origin),
  );

  const verifiedUsesOrigins = members
    .filter(
      (m) =>
        (m.page_status === "verified" || m.page_status === "verified_empty") &&
        isFreshObservation(m.last_valid_observation_at, asOf),
    )
    .map((m) => m.origin);

  const verifiedUsesMemberCount = uniqueCount(verifiedUsesOrigins);

  const catalog = input.catalog || { tools: [], categories: [], aliases: [] };
  const slotById = new Map(
    (catalog.categories || []).map((slot) => [slot.id, slot]),
  );
  const toolById = new Map(
    (catalog.tools || []).map((tool) => [tool.id, tool]),
  );

  /** @type {Map<string, { origins: Set<string>, useCases: Map<string, Set<string>>, names: Map<string, number>, statements: object[], slot_id: string, rule: string, preference: boolean }>} */
  const toolStats = new Map();
  /** @type {Map<string, Set<string>>} */
  const slotOrigins = new Map();
  /** @type {object[]} */
  const unsorted = [];
  /** @type {object[]} */
  const setup = [];

  for (const member of members) {
    if (!verifiedUsesOrigins.includes(member.origin)) {
      continue;
    }
    /** @type {Set<string>} */
    const rankedSlots = new Set();
    for (const tool of member.tools || []) {
      if (tool.status !== "current") {
        continue;
      }
      const displayName = claimName(tool, toolById);
      if (displayName && !isReportableUseLabel(displayName)) {
        continue;
      }
      if (!displayName && String(tool.tool_id || "").startsWith("observed:")) {
        continue;
      }
      const claim = {
        name: displayName,
        label: displayName,
        context: tool.context || "",
        section: tool.section || "",
        section_path: tool.section_path || "",
        excerpt: tool.excerpt || "",
        href: tool.href || "",
        kind: tool.kind || "product",
      };
      const classified = classifyClaim(claim, catalog);
      /** @type {import('./classify.mjs').Classification[]} */
      const choices = [];
      for (const choice of rankedChoicesForStoredName(
        displayName,
        classified,
      )) {
        if (
          choice.role !== "unsorted" ||
          typeof input.classify !== "function" ||
          !tool.tool_id
        ) {
          choices.push(choice);
          continue;
        }
        const proposal = await applyModelProposal({
          claim,
          catalog,
          policy: input.policy,
          classify: input.classify,
        });
        if (!proposal.accepted) {
          choices.push(choice);
          continue;
        }
        choices.push({
          role: "ranked",
          slot_id: proposal.slot_id,
          tool_id: tool.tool_id,
          rule: "model",
          preference: choice.preference,
          relation: null,
          parent_slot: null,
        });
      }
      for (const choice of choices) {
        const statement = {
          origin: member.origin,
          name: displayName,
          section: tool.section || "",
          section_path: tool.section_path || "",
          context: tool.context || "",
          observed_at: member.last_valid_observation_at || "",
          href: tool.href || "",
          rule: choice.rule,
          preference: choice.preference,
          relation: choice.relation,
          parent_slot: choice.parent_slot,
        };
        if (choice.role === "detail") {
          setup.push(statement);
          continue;
        }
        if (choice.role !== "ranked" || !choice.slot_id || !choice.tool_id) {
          if (choice.role === "unsorted") {
            unsorted.push(statement);
          }
          continue;
        }
        rankedSlots.add(choice.slot_id);
        const key = `${choice.slot_id}\u0000${choice.tool_id}`;
        if (!toolStats.has(key)) {
          toolStats.set(key, {
            origins: new Set(),
            useCases: new Map(),
            names: new Map(),
            statements: [],
            slot_id: choice.slot_id,
            rule: choice.rule,
            preference: choice.preference,
          });
        }
        const stat = toolStats.get(key);
        stat.origins.add(member.origin);
        stat.statements.push(statement);
        if (choice.preference) {
          stat.preference = true;
        }
        if (displayName) {
          stat.names.set(displayName, (stat.names.get(displayName) || 0) + 1);
        }
        for (const useCase of tool.use_case_ids || []) {
          if (!stat.useCases.has(useCase)) {
            stat.useCases.set(useCase, new Set());
          }
          stat.useCases.get(useCase).add(member.origin);
        }
      }
    }
    for (const slotId of rankedSlots) {
      if (!slotOrigins.has(slotId)) {
        slotOrigins.set(slotId, new Set());
      }
      slotOrigins.get(slotId).add(member.origin);
    }
  }

  /** Period-ever: distinct origins with a positive declaration inside the period. */
  /** @type {Map<string, Set<string>>} */
  const periodEver = new Map();
  for (const event of input.period_events || []) {
    if (!eligible.has(event.origin)) {
      continue;
    }
    if (
      event.event_type !== "usage_added" &&
      event.event_type !== "usage_changed"
    ) {
      continue;
    }
    if (event.status !== "current" || !event.tool_id) {
      continue;
    }
    const t = Date.parse(event.observed_at);
    const start = Date.parse(input.period_start);
    const end = Date.parse(input.period_end_exclusive);
    if (!Number.isFinite(t) || t < start || t >= end) {
      continue;
    }
    if (!periodEver.has(event.tool_id)) {
      periodEver.set(event.tool_id, new Set());
    }
    periodEver.get(event.tool_id).add(event.origin);
  }

  const tools = [...toolStats.entries()]
    .map(([key, stat]) => {
      const toolId = key.split("\u0000")[1];
      const activeOrigins = [...stat.origins].sort();
      const active = activeOrigins.length;
      const denominator = slotOrigins.get(stat.slot_id).size;
      const slot = slotById.get(stat.slot_id);
      const publisherName = preferredToolName(stat.names, toolId);
      return {
        tool_id: toolId,
        name: publicToolName(
          toolById.get(toolId)?.name || publisherName,
          toolId,
        ),
        slot_id: stat.slot_id,
        slot_name: slot?.name || stat.slot_id,
        denominator,
        rule: stat.rule,
        preference: Boolean(stat.preference),
        active_member_count: active,
        active_member_origins: activeOrigins,
        period_ever_member_count: periodEver.get(toolId)?.size || 0,
        adoption_score: adoptionScore(active, denominator),
        statements: stat.statements,
        use_cases: [...stat.useCases.entries()]
          .map(([id, set]) => ({
            id,
            member_count: set.size,
          }))
          .sort(
            (a, b) =>
              b.member_count - a.member_count || a.id.localeCompare(b.id),
          ),
        change_from_previous_period: null,
        source_coverage: input.is_complete ? "complete" : "partial",
      };
    })
    .sort(
      (a, b) =>
        b.active_member_count - a.active_member_count ||
        a.tool_id.localeCompare(b.tool_id),
    );

  const slots = [...slotOrigins.entries()]
    .map(([slotId, origins]) => {
      const slot = slotById.get(slotId);
      const products = tools
        .filter((tool) => tool.slot_id === slotId)
        .sort(
          (a, b) =>
            b.active_member_count - a.active_member_count ||
            a.name.localeCompare(b.name),
        );
      return {
        id: slotId,
        name: slot?.name || slotId,
        scope: slot?.scope || "",
        denominator: origins.size,
        origins: [...origins].sort(),
        products,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const catalogHash = catalogFingerprint(catalog);

  return {
    schema_version: USES_SCHEMA_VERSION,
    scoring_version: SCORING_VERSION,
    extractor_version: EXTRACTOR_VERSION,
    aggregation_version: AGGREGATION_VERSION,
    catalog_hash: catalogHash,
    snapshot_id: `${EXTRACTOR_VERSION}.${AGGREGATION_VERSION}.${catalogHash.slice(0, 12)}`,
    period: input.period,
    granularity: input.granularity,
    period_start: input.period_start,
    period_end_exclusive: input.period_end_exclusive,
    as_of: asOf,
    is_complete: Boolean(input.is_complete),
    eligible_member_count: eligible.size,
    verified_uses_member_count: verifiedUsesMemberCount,
    tool_count: tools.length,
    tools,
    slots,
    unsorted,
    setup,
  };
}

/**
 * Compares two rollups. A processing rewrite or a denominator-only change
 * is not publishers adopting or dropping a tool.
 * @param {object|null|undefined} previous
 * @param {object|null|undefined} current
 * @returns {{ adoption_change: boolean, reason: 'missing'|'processing'|'coverage'|'adoption'|'unchanged' }}
 */
export function adoptionChange(previous, current) {
  if (!previous || !current) {
    return { adoption_change: false, reason: "missing" };
  }
  if (previous.extractor_version !== current.extractor_version) {
    return { adoption_change: false, reason: "processing" };
  }
  if (
    previous.aggregation_version &&
    current.aggregation_version &&
    previous.aggregation_version !== current.aggregation_version
  ) {
    return { adoption_change: false, reason: "processing" };
  }
  if (
    previous.catalog_hash &&
    current.catalog_hash &&
    previous.catalog_hash !== current.catalog_hash
  ) {
    return { adoption_change: false, reason: "processing" };
  }
  /** @type {Map<string, number>} */
  const before = new Map(
    (previous.tools || []).map((tool) => [
      tool.tool_id,
      tool.active_member_count,
    ]),
  );
  /** @type {Map<string, number>} */
  const after = new Map(
    (current.tools || []).map((tool) => [
      tool.tool_id,
      tool.active_member_count,
    ]),
  );
  const ids = new Set([...before.keys(), ...after.keys()]);
  let changed = false;
  for (const id of ids) {
    if ((before.get(id) || 0) !== (after.get(id) || 0)) {
      changed = true;
    }
  }
  if (
    !changed &&
    previous.verified_uses_member_count !== current.verified_uses_member_count
  ) {
    return { adoption_change: false, reason: "coverage" };
  }
  return {
    adoption_change: changed,
    reason: changed ? "adoption" : "unchanged",
  };
}

/**
 * True when two or more rollups show an adoption change under one extractor.
 * @param {object[]} rollups
 * @returns {boolean}
 */
export function trendReady(rollups) {
  const list = rollups || [];
  for (let index = 1; index < list.length; index += 1) {
    if (adoptionChange(list[index - 1], list[index]).adoption_change) {
      return true;
    }
  }
  return false;
}

/**
 * Momentum vs previous rollup.
 * @param {object} currentTool
 * @param {object|null} previousTool
 * @param {number} currentDenom
 * @param {number} previousDenom
 * @returns {{ momentum_count: number|null, momentum_pp: number|null }}
 */
export function momentumAgainstPrevious(
  currentTool,
  previousTool,
  currentDenom,
  previousDenom,
) {
  if (!previousTool) {
    return { momentum_count: null, momentum_pp: null };
  }
  const momentum_count =
    currentTool.active_member_count - previousTool.active_member_count;
  const currentScore = adoptionScore(
    currentTool.active_member_count,
    currentDenom,
  );
  const previousScore = adoptionScore(
    previousTool.active_member_count,
    previousDenom,
  );
  const momentum_pp =
    currentScore === null || previousScore === null
      ? null
      : currentScore - previousScore;
  return { momentum_count, momentum_pp };
}

/**
 * One stored line can name two ranked choices. classifyClaim still returns
 * one slot; this rollup records both for that stored name.
 * @param {string} name
 * @param {import('./classify.mjs').Classification} classified
 * @returns {import('./classify.mjs').Classification[]}
 */
function rankedChoicesForStoredName(name, classified) {
  if (comparisonLabel(name) !== "mac mini asus 24") {
    return [classified];
  }
  return [
    {
      role: "ranked",
      slot_id: "computer",
      tool_id: "mac-mini",
      rule: "split-compound",
      preference: classified.preference,
      relation: null,
      parent_slot: null,
    },
    {
      role: "ranked",
      slot_id: "display",
      tool_id: "asus-24",
      rule: "split-compound",
      preference: classified.preference,
      relation: null,
      parent_slot: null,
    },
  ];
}

/**
 * Publisher wording, or the catalog name when the stored id is already canonical.
 * @param {object} tool
 * @param {Map<string, object>} toolById
 * @returns {string}
 */
function claimName(tool, toolById) {
  const fromPublisher = productNameFromLabel(tool?.name || "");
  if (fromPublisher) {
    return fromPublisher;
  }
  const id = String(tool?.tool_id || "");
  if (!id || id.startsWith("observed:")) {
    return "";
  }
  return toolById.get(id)?.name || "";
}

/**
 * Picks the most common publisher label, breaking ties alphabetically.
 * @param {Map<string, number>} names
 * @param {string} fallback
 * @returns {string}
 */
function preferredToolName(names, fallback) {
  let best = fallback;
  let bestCount = 0;

  for (const [name, count] of [...names.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }

  return best;
}

/**
 * @param {string[]} values
 * @returns {number}
 */
function uniqueCount(values) {
  return new Set(values).size;
}
