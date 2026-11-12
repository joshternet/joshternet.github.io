/**
 * Goal & Constraints:
 * UTC calendar rollups with explicit denominators. Site slots count distinct
 * origins; unit slots (e.g. FDM printers) sum stated machine quantities.
 * Never sum monthly unique counts into quarterly/yearly unique counts.
 */

import { catalogFingerprint, classifyClaim } from "./classify.mjs";
import {
  applyModelProposal,
  classificationFingerprint,
  modelClaimText,
  slotLabels,
} from "./infer-policy.mjs";
import { compareSlotsByCoverage } from "./build-helpers.mjs";
import {
  AGGREGATION_VERSION,
  EXTRACTOR_VERSION,
  FRESHNESS_DAYS,
  SCORING_VERSION,
  USES_SCHEMA_VERSION,
} from "./constants.mjs";
import {
  catalogPeelCandidates,
  comparisonLabel,
  is3dPrinterUmbrellaLabel,
  isReportableUseLabel,
  peelCatalogLead,
  peelDeclarativeLeadIn,
  productNameFromLabel,
  publicToolName,
  quantityNearLabel,
  separateNameContext,
  splitCompoundName,
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
  // Single predicate avoids V8 experimental-coverage flaps on `!x || x <= 0`.
  if (!(Number(denominator) > 0)) {
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
  // Avoid `||` short-circuit branch pairs that flake under parallel coverage.
  if (!Number.isFinite(last)) {
    return false;
  }
  if (!Number.isFinite(now)) {
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
  const stateMembers =
    input.state && Array.isArray(input.state.members)
      ? input.state.members
      : [];
  const members = stateMembers.filter((m) => eligible.has(m.origin));

  const verifiedUsesOrigins = members
    .filter(
      (m) =>
        (m.page_status === "verified" || m.page_status === "verified_empty") &&
        isFreshObservation(m.last_valid_observation_at, asOf),
    )
    .map((m) => m.origin);

  const verifiedUsesMemberCount = uniqueCount(verifiedUsesOrigins);

  const catalog = input.catalog || { tools: [], categories: [], aliases: [] };
  const catalogHashForModel = catalogFingerprint(catalog);
  const labelHash = slotLabels(catalog)
    .map((label) => label.description)
    .join("\n");
  const policyThreshold =
    input.policy && input.policy.threshold != null
      ? String(input.policy.threshold)
      : "";
  const policyMargin =
    input.policy && input.policy.margin != null
      ? String(input.policy.margin)
      : "";
  const policyHash = `${policyThreshold}|${policyMargin}|${input.hypothesisTemplate || ""}`;
  const slotById = new Map(
    (catalog.categories || []).map((slot) => [slot.id, slot]),
  );
  const toolById = new Map(
    (catalog.tools || []).map((tool) => [tool.id, tool]),
  );

  /** @type {Map<string, { origins: Set<string>, unitsByOrigin: Map<string, number>, useCases: Map<string, Set<string>>, names: Map<string, number>, statements: object[], slot_id: string, rule: string, preference: boolean }>} */
  const toolStats = new Map();
  /** @type {Map<string, Set<string>>} */
  const slotOrigins = new Map();
  /** @type {Map<string, number>} */
  const slotUnits = new Map();
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
    /** @type {Map<string, number>} */
    const rankedSlotUnits = new Map();
    for (const tool of member.tools || []) {
      if (tool.status !== "current") {
        continue;
      }
      const displayName = claimName(tool, toolById, catalog);
      if (displayName && !isReportableUseLabel(displayName)) {
        continue;
      }
      const contextText = tool.context || "";
      const printerPeel = peel3dPrintersFromContext(
        displayName || tool.section || "",
        contextText,
        catalog,
        { toolId: tool.tool_id || "", section: tool.section || "" },
      );
      if (
        !displayName &&
        String(tool.tool_id || "").startsWith("observed:") &&
        printerPeel.length === 0
      ) {
        continue;
      }
      const claim = {
        name: displayName,
        label: displayName,
        context: contextText,
        section: tool.section || "",
        section_path: tool.section_path || "",
        excerpt: tool.excerpt || "",
        href: tool.href || "",
        tool_id: tool.tool_id || "",
        kind: tool.kind || "product",
      };
      const classified =
        displayName || printerPeel.length === 0
          ? classifyClaim(claim, catalog)
          : {
              role: "unsorted",
              slot_id: null,
              tool_id: null,
              rule: "unresolved",
              preference: false,
              relation: null,
              parent_slot: null,
            };
      /** @type {import('./classify.mjs').Classification[]} */
      const choices = [];
      for (const choice of rankedChoicesForStoredName(
        displayName,
        classified,
        catalog,
        contextText,
        { toolId: tool.tool_id || "", section: tool.section || "" },
      )) {
        if (
          choice.role !== "unsorted" ||
          typeof input.classify !== "function" ||
          !tool.tool_id
        ) {
          choices.push(choice);
          continue;
        }
        const claimText = modelClaimText(claim);
        const proposal = await applyModelProposal({
          claim,
          catalog,
          policy: input.policy,
          classify: input.classify,
          cache: input.inferenceCache,
          cacheKey: classificationFingerprint({
            evidenceHash: claimText.presented,
            extractorVersion: EXTRACTOR_VERSION,
            modelRevision: input.modelRevision || "",
            templateVersion: input.templateVersion || 0,
            labelHash,
            catalogHash: catalogHashForModel,
            policyHash,
          }),
          stats: input.inferenceStats,
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
        const catalogTool = toolById.get(choice.tool_id);
        const catalogName =
          catalogTool && typeof catalogTool.name === "string"
            ? catalogTool.name
            : "";
        // Explicit fallbacks avoid V8 `a || b || ""` branch flaps under
        // parallel experimental-coverage merges (seen as ~99.36%).
        let choiceName = "";
        if (catalogName) {
          choiceName = catalogName;
        } else if (displayName) {
          choiceName = displayName;
        }
        const statement = {
          origin: member.origin,
          name: choiceName,
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
          // Peeling replaces the umbrella row with ranked machines, so an
          // unsorted umbrella choice only appears when peel found nothing.
          if (choice.role === "unsorted") {
            unsorted.push(statement);
          }
          continue;
        }
        const quantity = Math.max(
          1,
          Number(choice.quantity) ||
            Number(tool.quantity) ||
            quantityNearLabel(
              `${tool.context || ""} ${displayName}`,
              choiceName,
            ),
        );
        rankedSlots.add(choice.slot_id);
        rankedSlotUnits.set(
          choice.slot_id,
          (rankedSlotUnits.get(choice.slot_id) || 0) + quantity,
        );
        const key = `${choice.slot_id}\u0000${choice.tool_id}`;
        if (!toolStats.has(key)) {
          toolStats.set(key, {
            origins: new Set(),
            unitsByOrigin: new Map(),
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
        const priorUnits = stat.unitsByOrigin.get(member.origin) || 0;
        stat.unitsByOrigin.set(member.origin, Math.max(priorUnits, quantity));
        stat.statements.push(statement);
        if (choice.preference) {
          stat.preference = true;
        }
        if (choiceName) {
          // choiceName already falls back to displayName when the catalog
          // row has no title, so a separate displayName branch is unreachable.
          stat.names.set(choiceName, (stat.names.get(choiceName) || 0) + 1);
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
      slotUnits.set(
        slotId,
        (slotUnits.get(slotId) || 0) + rankedSlotUnits.get(slotId),
      );
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

  const rankedRows = [...toolStats.entries()].map(([key, stat]) => {
    const toolId = key.split("\u0000")[1];
    const activeOrigins = [...stat.origins].sort();
    const slot = slotById.get(stat.slot_id);
    const countsUnits = Boolean(slot && slot.count_basis === "units");
    const unitTotal = [...stat.unitsByOrigin.values()].reduce(
      (sum, value) => sum + value,
      0,
    );
    const active = countsUnits ? unitTotal : activeOrigins.length;
    // slotUnits is filled for every ranked slot_id above; avoid `get() ||`
    // fallbacks that stay at count 0 and flap under parallel coverage merges.
    let denominator;
    if (countsUnits) {
      denominator = slotUnits.get(stat.slot_id);
    } else {
      denominator = slotOrigins.get(stat.slot_id).size;
    }
    const publisherName = preferredToolName(stat.names, toolId);
    const catalogTool = toolById.get(toolId);
    const catalogToolName =
      catalogTool && typeof catalogTool.name === "string"
        ? catalogTool.name
        : "";
    const periodOrigins = periodEver.get(toolId);
    return {
      tool_id: toolId,
      name: publicToolName(catalogToolName || publisherName, toolId),
      slot_id: stat.slot_id,
      slot_name: (slot && slot.name) || stat.slot_id,
      denominator,
      rule: stat.rule,
      preference: Boolean(stat.preference),
      active_member_count: active,
      active_member_origins: activeOrigins,
      count_basis: countsUnits ? "units" : "sites",
      period_ever_member_count: periodOrigins ? periodOrigins.size : 0,
      adoption_score: adoptionScore(active, denominator),
      statements: stat.statements,
      use_cases: [...stat.useCases.entries()]
        .map(([id, set]) => ({
          id,
          member_count: set.size,
        }))
        .sort(
          (a, b) => b.member_count - a.member_count || a.id.localeCompare(b.id),
        ),
      change_from_previous_period: null,
      source_coverage: input.is_complete ? "complete" : "partial",
    };
  });
  const tools = collapseDuplicateToolRows(rankedRows, toolById);

  const slots = [...slotOrigins.entries()]
    .map(([slotId, origins]) => {
      const slot = slotById.get(slotId);
      const countsUnits = Boolean(slot && slot.count_basis === "units");
      const products = tools
        .filter((tool) => tool.slot_id === slotId)
        .sort(
          (a, b) =>
            b.active_member_count - a.active_member_count ||
            a.name.localeCompare(b.name),
        );
      let denominator;
      if (countsUnits) {
        denominator = slotUnits.get(slotId);
      } else {
        denominator = origins.size;
      }
      return {
        id: slotId,
        name: (slot && slot.name) || slotId,
        scope: (slot && slot.scope) || "",
        kind: (slot && slot.kind) || "",
        denominator,
        count_basis: countsUnits ? "units" : "sites",
        origins: [...origins].sort(),
        products,
      };
    })
    .sort(compareSlotsByCoverage);

  const catalogHash = catalogHashForModel;

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
 * True when consecutive same-granularity rollups show an adoption change
 * under one extractor/aggregation/catalog. Pass prior then current month
 * (or quarter/year), not month/quarter/year from a single run.
 * @param {object[]} rollups
 * @returns {boolean}
 */
export function trendReady(rollups) {
  const list = (rollups || []).filter(Boolean);
  for (let index = 1; index < list.length; index += 1) {
    if (adoptionChange(list[index - 1], list[index]).adoption_change) {
      return true;
    }
  }
  return false;
}

/**
 * Fills change_from_previous_period from a prior same-granularity rollup.
 * @param {object} rollup
 * @param {object|null|undefined} previous
 * @returns {object}
 */
export function withPreviousPeriodChanges(rollup, previous) {
  if (!rollup || !previous) {
    return rollup;
  }
  /** @type {Map<string, object>} */
  const priorTools = new Map(
    (previous.tools || []).map((tool) => [tool.tool_id, tool]),
  );
  const tools = (rollup.tools || []).map((tool) => {
    const prior = priorTools.get(tool.tool_id) || null;
    const momentum = momentumAgainstPrevious(
      tool,
      prior,
      tool.denominator || 0,
      (prior && prior.denominator) || 0,
    );
    return {
      ...tool,
      change_from_previous_period: prior
        ? {
            active_delta: tool.active_member_count - prior.active_member_count,
            momentum_count: momentum.momentum_count,
            momentum_pp: momentum.momentum_pp,
          }
        : null,
    };
  });
  return { ...rollup, tools };
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
 * Collapses ranked rows that share a tool id (same product, different slots).
 * One product id is one rollup row. Context can file the same id under two
 * slots; the public row keeps the larger count, then the catalog slot.
 * @param {object[]} rows
 * @param {Map<string, { category_id?: string }>} toolById
 * @returns {object[]}
 */
export function collapseDuplicateToolRows(rows, toolById) {
  /** @type {Map<string, object>} */
  const byId = new Map();
  for (const row of rows) {
    const current = byId.get(row.tool_id);
    if (!current || preferToolRow(row, current, toolById)) {
      byId.set(row.tool_id, row);
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      b.active_member_count - a.active_member_count ||
      a.tool_id.localeCompare(b.tool_id),
  );
}

/**
 * True when the candidate row should replace the current row for one tool id.
 * @param {object} candidate
 * @param {object} current
 * @param {Map<string, { category_id?: string }>} toolById
 * @returns {boolean}
 */
export function preferToolRow(candidate, current, toolById) {
  if (candidate.active_member_count !== current.active_member_count) {
    return candidate.active_member_count > current.active_member_count;
  }
  const homeTool = toolById.get(candidate.tool_id);
  const home =
    homeTool && typeof homeTool.category_id === "string"
      ? homeTool.category_id
      : "";
  if (home && candidate.slot_id === home) {
    return true;
  }
  if (home && current.slot_id === home) {
    return false;
  }
  return String(candidate.slot_id) < String(current.slot_id);
}

/**
 * Peels a space-joined line into catalog products when every segment matches
 * (Mac Mini ASUS 24" Apple Magic Keyboard Logitech MX Ergo).
 * @param {string} name
 * @param {object} catalog
 * @returns {string[]}
 */
function peelCatalogProductNames(name, catalog) {
  let text = comparisonLabel(name);
  if (!text) {
    return [];
  }
  const candidates = catalogPeelCandidates(catalog);
  /** @type {string[]} */
  const parts = [];
  while (text) {
    const hit = candidates.find(
      (candidate) =>
        text === candidate.key || text.startsWith(`${candidate.key} `),
    );
    if (!hit) {
      return [];
    }
    parts.push(hit.name);
    text = text.slice(hit.key.length).trim();
  }
  return parts.length >= 2 ? parts : [];
}

/**
 * One stored line can name two ranked or detail choices (computer + display,
 * browser + extension, laptop + memory). classifyClaim still returns one slot
 * for the whole line; this rollup records each part.
 * Umbrella “3D printers” rows peel named machines out of context.
 * @param {string} name
 * @param {import('./classify.mjs').Classification} classified
 * @param {object} catalog
 * @param {string} [context]
 * @param {{ toolId?: string, section?: string }} [options]
 * @returns {Array<import('./classify.mjs').Classification & { quantity?: number }>}
 */
function rankedChoicesForStoredName(
  name,
  classified,
  catalog,
  context = "",
  options = {},
) {
  const fromUmbrella = peel3dPrintersFromContext(
    name,
    context,
    catalog,
    options,
  );
  if (fromUmbrella.length >= 1) {
    return fromUmbrella.map((part) => ({
      ...part.classified,
      quantity: part.quantity,
      // Peel only keeps ranked rows, so unresolved → split-compound never applies.
      rule: part.classified.rule,
      preference: classified.preference || part.classified.preference,
    }));
  }
  const peeled = peelCatalogProductNames(name, catalog);
  const parts = peeled.length >= 2 ? peeled : splitCompoundName(name);
  if (parts.length < 2) {
    return [classified];
  }
  /** @type {Array<import('./classify.mjs').Classification & { quantity?: number }>} */
  const choices = [];
  for (const part of parts) {
    const partClaim = classifyClaim(
      {
        name: part,
        kind: "product",
      },
      catalog,
    );
    if (
      partClaim.role === "ranked" ||
      partClaim.role === "detail" ||
      partClaim.role === "unsorted"
    ) {
      choices.push({
        ...partClaim,
        quantity: quantityNearLabel(`${context} ${name}`, part),
        rule:
          partClaim.rule === "unresolved" ? "split-compound" : partClaim.rule,
        preference: classified.preference || partClaim.preference,
      });
    }
  }
  if (choices.length >= 2) {
    return choices;
  }
  return [classified];
}

/**
 * Peels catalog 3D printers named in context under an umbrella heading.
 * Also recovers ledger rows stored as observed:3d-printing with an empty name
 * when the section or tool id marks a printer umbrella.
 * @param {string} name
 * @param {string} context
 * @param {object} catalog
 * @param {{ toolId?: string, section?: string }} [options]
 * @returns {Array<{ classified: import('./classify.mjs').Classification, quantity: number }>}
 */
export function peel3dPrintersFromContext(
  name,
  context,
  catalog,
  options = {},
) {
  const toolId = String(options.toolId || "");
  const section = String(options.section || "");
  const umbrella =
    is3dPrinterUmbrellaLabel(name) ||
    is3dPrinterUmbrellaLabel(section) ||
    /^observed:3d-print(?:ers?|ing)?$/i.test(toolId);
  if (!umbrella) {
    return [];
  }
  const hay = comparisonLabel(context);
  if (!hay) {
    return [];
  }
  /** @type {Array<{ id: string, name: string, key: string }>} */
  const candidates = [];
  const catalogTools =
    catalog && Array.isArray(catalog.tools) ? catalog.tools : [];
  for (const tool of catalogTools) {
    if (!tool || tool.retired) {
      continue;
    }
    if (!String(tool.category_id || "").startsWith("3d-printer")) {
      continue;
    }
    const labels = [tool.name, ...(tool.aliases || [])].filter(Boolean);
    for (const label of labels) {
      const key = comparisonLabel(label);
      if (!key || key.length < 4) {
        continue;
      }
      candidates.push({ id: tool.id, name: String(tool.name || label), key });
    }
  }
  candidates.sort(
    (a, b) => b.key.length - a.key.length || a.key.localeCompare(b.key),
  );
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Array<{ classified: import('./classify.mjs').Classification, quantity: number }>} */
  const hits = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) {
      continue;
    }
    if (!hay.includes(candidate.key)) {
      continue;
    }
    seen.add(candidate.id);
    const classified = classifyClaim(
      { name: candidate.name, context, kind: "product" },
      catalog,
    );
    if (classified.role !== "ranked" || !classified.tool_id) {
      continue;
    }
    hits.push({
      classified,
      quantity: quantityNearLabel(context, candidate.name),
    });
  }
  return hits;
}

/**
 * Publisher wording, or the catalog name when the stored id is already canonical.
 * @param {object} tool
 * @param {Map<string, object>} toolById
 * @param {object} [catalog]
 * @returns {string}
 */
function claimName(tool, toolById, catalog) {
  const toolName = tool && typeof tool.name === "string" ? tool.name : "";
  const raw = productNameFromLabel(toolName);
  if (!raw) {
    const id = String((tool && tool.tool_id) || "");
    if (!id || id.startsWith("observed:")) {
      return "";
    }
    const catalogTool = toolById.get(id);
    return catalogTool && typeof catalogTool.name === "string"
      ? catalogTool.name
      : "";
  }
  const peeled = peelDeclarativeLeadIn(raw);
  const separated = separateNameContext(peeled.name);
  const catalogLead = peelCatalogLead(separated.name, catalog);
  return productNameFromLabel(catalogLead.name);
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
