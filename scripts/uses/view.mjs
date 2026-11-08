/**
 * Goal & Constraints:
 * Compact UI projections for Jekyll SSR and public JSON endpoints.
 * Source links join rollup origins to member page URLs; no invented counts.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { writeJSONAtomic } from "../nlp/lib.mjs";

import { EXTRACTOR_VERSION, USES_SCHEMA_VERSION } from "./constants.mjs";
import { publicToolName } from "./normalize.mjs";
import { isEarlySample } from "./validate.mjs";

const STORE_HOSTS = new Set([
  "amazon.com",
  "play.google.com",
  "apps.apple.com",
]);

/**
 * Project or manufacturer URL for a choice. Store listings are left blank.
 * @param {unknown} website
 * @returns {string}
 */
function publicProductWebsite(website) {
  const value = String(website || "").trim();
  if (!value) {
    return "";
  }
  let host = "";
  try {
    host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
  if (STORE_HOSTS.has(host)) {
    return "";
  }
  return value;
}

/**
 * Ranked row with anonymous site counts for the public explorer.
 * Per-member source lists stay out of the published summary.
 * @param {object} tool
 * @param {Map<string, object>} memberByOrigin
 * @param {object} rollup
 * @param {Map<string, string>} websiteByToolId
 * @returns {object}
 */
function presentRankedTool(tool, memberByOrigin, rollup, websiteByToolId) {
  void memberByOrigin;
  return {
    tool_id: tool.tool_id,
    name: publicToolName(tool.name, tool.tool_id),
    active_member_count: tool.active_member_count,
    adoption_score: tool.adoption_score,
    denominator: Number.isFinite(tool.denominator)
      ? tool.denominator
      : rollup.verified_uses_member_count,
    slot_id: tool.slot_id || "",
    slot_name: tool.slot_name || "",
    preference: Boolean(tool.preference),
    website: publicProductWebsite(websiteByToolId.get(tool.tool_id)),
  };
}

/**
 * Unsorted name or setup detail, with a link back to the publisher.
 * @param {object} item
 * @param {Map<string, object>} memberByOrigin
 * @returns {object}
 */
function presentClaim(item, memberByOrigin) {
  const member = memberByOrigin.get(item.origin);
  return {
    name: item.name || "",
    origin: item.origin || "",
    page_url: member?.page_url || `${item.origin || ""}/uses/`,
    label: sourceLabelFromOrigin(item.origin),
    section: item.section || "",
    context: item.context || "",
    observed_at: item.observed_at || "",
    relation: item.relation || "",
    parent_slot: item.parent_slot || "",
  };
}

/**
 * One public row per product name with every publisher that listed it.
 * @param {object[]} claims
 * @returns {object[]}
 */
function collapseClaimsByName(claims) {
  /** @type {Map<string, object>} */
  const byName = new Map();
  for (const claim of claims) {
    const name = String(claim.name || "").trim();
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    const source = {
      origin: claim.origin || "",
      page_url: claim.page_url || "",
      label: claim.label || sourceLabelFromOrigin(claim.origin),
      section: claim.section || "",
      context: claim.context || "",
      observed_at: claim.observed_at || "",
    };
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, {
        name,
        relation: claim.relation || "",
        parent_slot: claim.parent_slot || "",
        sources: [source],
      });
      continue;
    }
    if (
      !existing.sources.some(
        (entry) =>
          entry.origin === source.origin && entry.page_url === source.page_url,
      )
    ) {
      existing.sources.push(source);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Hostname label for a source origin (never invents people counts).
 * @param {string} origin
 * @returns {string}
 */
function sourceLabelFromOrigin(origin) {
  try {
    return new URL(origin).hostname || origin;
  } catch {
    return origin || "";
  }
}

/**
 * Why an assessed origin is in, or out of, the Uses denominator.
 * @param {import('./constants.mjs').PageOutcome} status
 * @returns {string}
 */
export function coverageReason(status) {
  switch (status) {
    case "verified":
      return "Assessed Uses page";
    case "verified_empty":
      return "Assessed page with no accepted named tools. It stays in the count.";
    case "out_of_scope":
      return "This URL repeats the homepage and is not a Uses page.";
    case "not_found":
      return "Uses page was not found.";
    case "unreachable":
      return "Uses page could not be reached.";
    case "uncertain":
      return "Uses page was not recognized.";
    case "disallowed":
      return "Fetching this page is not allowed.";
    case "parse_error":
      return "Uses page could not be read.";
    case "not_checked":
      return "Not assessed in this sample.";
    default: {
      const exhaustive = /** @type {never} */ (status);
      return exhaustive;
    }
  }
}

/**
 * Builds `_data/uses_summary.json` for no-JS landing content.
 * @param {object} input
 * @param {object} input.rollup - latest rollup (prefer complete, else in-progress)
 * @param {string[]} input.supported_periods
 * @param {string} input.as_of
 * @param {number} input.eligible_member_count
 * @param {number} input.verified_uses_member_count
 * @param {string} [input.methodology_url]
 * @param {Array<{ origin: string, page_url?: string }>} [input.members]
 * @param {{ tools?: object[] }} [input.catalog]
 * @returns {object}
 */
export function buildUsesSummary(input) {
  const rollup = input.rollup || {
    tools: [],
    verified_uses_member_count: 0,
    eligible_member_count: 0,
    period: "",
    is_complete: false,
  };

  /** @type {Map<string, { origin: string, page_url: string, page_status?: string }>} */
  const memberByOrigin = new Map();
  for (const member of input.members || []) {
    if (!member?.origin) {
      continue;
    }
    memberByOrigin.set(member.origin, {
      origin: member.origin,
      page_url: member.page_url || `${member.origin}/uses/`,
      page_status: member.page_status,
    });
  }

  /** @type {Map<string, string>} */
  const websiteByToolId = new Map();
  for (const tool of input.catalog?.tools || []) {
    if (tool?.id) {
      websiteByToolId.set(tool.id, tool.website || "");
    }
  }

  const topTools = (rollup.tools || []).map((tool) =>
    presentRankedTool(tool, memberByOrigin, rollup, websiteByToolId),
  );
  const slots = (rollup.slots || []).map((slot) => ({
    id: slot.id,
    name: slot.name,
    scope: slot.scope || "",
    kind: slot.kind || "",
    denominator: slot.denominator,
    origins: slot.origins || [],
    products: (slot.products || []).map((tool) =>
      presentRankedTool(tool, memberByOrigin, rollup, websiteByToolId),
    ),
  }));
  const unsorted = collapseClaimsByName(
    (rollup.unsorted || []).map((item) => presentClaim(item, memberByOrigin)),
  );
  const setup = collapseClaimsByName(
    (rollup.setup || []).map((item) => presentClaim(item, memberByOrigin)),
  ).map((item) => ({
    name: item.name,
    relation: item.relation || "",
    parent_slot: item.parent_slot || "",
    site_count: Array.isArray(item.sources) ? item.sources.length : 0,
  }));

  const early = isEarlySample(
    input.verified_uses_member_count,
    input.eligible_member_count,
  );

  /** @type {Map<string, number>} */
  const useCaseCounts = new Map();
  for (const tool of rollup.tools || []) {
    for (const useCase of tool.use_cases || []) {
      useCaseCounts.set(
        useCase.id,
        (useCaseCounts.get(useCase.id) || 0) + useCase.member_count,
      );
    }
  }

  return {
    schema_version: USES_SCHEMA_VERSION,
    as_of: input.as_of,
    period: rollup.period,
    period_complete: Boolean(rollup.is_complete),
    extractor_version: rollup.extractor_version || EXTRACTOR_VERSION,
    snapshot_id: rollup.snapshot_id || "",
    slots,
    unsorted,
    setup,
    eligible_member_count: input.eligible_member_count,
    verified_uses_member_count: input.verified_uses_member_count,
    distinct_tool_count: (rollup.tools || []).length,
    early_sample: early,
    trend_ready: Boolean(input.trend_ready),
    top_tools: topTools,
    use_case_counts: [...useCaseCounts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
    supported_periods: input.supported_periods || [],
    methodology_url: input.methodology_url || "/implement/content/uses/",
    denominator_note:
      "A verified Uses page with no accepted tools stays in the count. A URL that only repeats the homepage does not.",
    coverage_note: early
      ? "These observations cover a small part of the network. They describe anonymous counts for the sites included so far, not the Joshternet as a whole."
      : "Counts show how many verified Uses pages report each choice—anonymous aggregates, not a roster of member setups.",
  };
}

/**
 * Builds public manifest index.json.
 * @param {object} input
 * @returns {object}
 */
export function buildPublicIndex(input) {
  return {
    schema_version: USES_SCHEMA_VERSION,
    as_of: input.as_of,
    periods: input.periods || [],
    early_sample: Boolean(input.early_sample),
    trend_ready: Boolean(input.trend_ready),
    extractor_version: input.extractor_version || EXTRACTOR_VERSION,
    snapshot_id: input.snapshot_id || "",
    endpoints: {
      members: "/assets/data/uses/members.json",
      tools: "/assets/data/uses/tools.json",
      periods: "/assets/data/uses/periods/",
      graph: "/assets/data/uses/graph/",
    },
  };
}

/**
 * Writes public projection files under assets/data/uses and _data.
 * @param {object} input
 * @param {string} input.repoRoot
 * @param {object} input.summary
 * @param {object} input.index
 * @param {object} input.membersDoc
 * @param {object} input.toolsDoc
 * @param {Array<{ path: string, document: object }>} input.periodDocs
 * @param {Array<{ path: string, document: object }>} input.graphDocs
 * @returns {Promise<void>}
 */
export async function writePublicViews(input) {
  const dataDir = path.join(input.repoRoot, "_data");
  const publicDir = path.join(input.repoRoot, "assets", "data", "uses");
  await mkdir(dataDir, { recursive: true });
  await mkdir(path.join(publicDir, "periods", "month"), { recursive: true });
  await mkdir(path.join(publicDir, "periods", "quarter"), { recursive: true });
  await mkdir(path.join(publicDir, "periods", "year"), { recursive: true });
  await mkdir(path.join(publicDir, "graph"), { recursive: true });

  await writeJSONAtomic(path.join(dataDir, "uses_summary.json"), input.summary);
  await writeJSONAtomic(path.join(publicDir, "index.json"), input.index);
  await writeJSONAtomic(path.join(publicDir, "members.json"), input.membersDoc);
  await writeJSONAtomic(path.join(publicDir, "tools.json"), input.toolsDoc);

  for (const doc of input.periodDocs || []) {
    const full = path.join(publicDir, doc.path);
    await mkdir(path.dirname(full), { recursive: true });
    await writeJSONAtomic(full, doc.document);
  }
  for (const doc of input.graphDocs || []) {
    const full = path.join(publicDir, doc.path);
    await mkdir(path.dirname(full), { recursive: true });
    await writeJSONAtomic(full, doc.document);
  }
}
