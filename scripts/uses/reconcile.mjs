/**
 * Goal & Constraints:
 * Diff prior member tool state against new evidence to emit append-only
 * semantic events. Missed crawls never invent removals.
 */

import {
  EXTRACTOR_VERSION,
  REMOVAL_CONFIRMATION_HOURS,
  TAXONOMY_VERSION,
} from "./constants.mjs";
import { isKeptInState } from "./evidence.mjs";
import { deterministicEventId, supersededObservedIds } from "./normalize.mjs";

/**
 * @typedef {object} MemberToolState
 * @property {string} tool_id
 * @property {string} status
 * @property {string[]} use_case_ids
 * @property {string} first_observed_at
 * @property {string} last_event_at
 * @property {string} evidence_event_id
 * @property {string} [pending_absence_at]
 */

/**
 * @typedef {object} MemberState
 * @property {string} origin
 * @property {string} page_url
 * @property {string} page_status
 * @property {string} first_valid_observation_at
 * @property {string} last_valid_observation_at
 * @property {MemberToolState[]} tools
 */

/**
 * Compares previous member state with new verified evidence.
 * @param {object} input
 * @param {MemberState|null} input.previous
 * @param {string} input.origin
 * @param {string} input.page_url
 * @param {string} input.page_status
 * @param {string} input.observed_at
 * @param {import('./evidence.mjs').EvidenceRecord[]} input.evidence
 * @param {boolean} [input.pageComplete] - Materially complete parse for removals.
 * @param {boolean} [input.bodyComplete] - False when the response was truncated. Blocks removals.
 * @param {'adoption'|'correction'} [input.mode] - Correction rewrites state without adoption events.
 * @param {{ tools?: object[], aliases?: object[] }} [input.catalog] - Resolves duplicate observed ids.
 * @returns {{ events: object[], next: MemberState }}
 */
export function reconcileMemberUsage(input) {
  const observedAt = input.observed_at;
  const previous = input.previous;
  const correction = input.mode === "correction";
  /** @type {object[]} */
  const events = [];

  /** @type {Map<string, MemberToolState>} */
  const priorTools = new Map();
  for (const tool of previous?.tools || []) {
    priorTools.set(tool.tool_id, { ...tool });
  }

  /** @type {Map<string, import('./evidence.mjs').EvidenceRecord>} */
  const currentByTool = new Map();
  for (const record of input.evidence || []) {
    if (!isKeptInState(record)) {
      continue;
    }
    currentByTool.set(record.tool_id, record);
  }

  const identityPairs = input.catalog
    ? supersededObservedIds(
        previous?.tools || [],
        input.catalog,
        currentByTool.keys(),
      )
    : [];
  /** @type {Set<string>} */
  const dropObserved = new Set(identityPairs.map((pair) => pair.observed_id));
  /** @type {Set<string>} */
  const canonicalFromObserved = new Set(
    identityPairs.map((pair) => pair.canonical_id),
  );
  for (const observedId of dropObserved) {
    currentByTool.delete(observedId);
  }

  /** @type {MemberToolState[]} */
  const nextTools = [];

  for (const [toolId, record] of currentByTool) {
    const prior = priorTools.get(toolId);
    const useCases = [...(record.use_case_ids || [])].sort();
    if (!prior) {
      const event = makeEvent({
        event_type:
          correction || canonicalFromObserved.has(toolId)
            ? "correction"
            : "usage_added",
        observed_at: observedAt,
        origin: input.origin,
        page_url: input.page_url,
        tool_id: toolId,
        status: record.status,
        use_case_ids: useCases,
        evidence: evidencePayload(record),
      });
      events.push(event);
      nextTools.push(
        toolStateFromRecord(toolId, record, null, event, observedAt),
      );
      continue;
    }

    const sameStatus = prior.status === record.status;
    const sameCases =
      JSON.stringify([...(prior.use_case_ids || [])].sort()) ===
      JSON.stringify(useCases);
    const sameClaim =
      (prior.name || "") === (record.name || record.label || "") &&
      (prior.kind || "product") === (record.kind || "product") &&
      (prior.context || "") === (record.context || "") &&
      (prior.section || "") === (record.section || "");
    const sameStructure =
      (prior.href || "") === (record.href || "") &&
      (prior.section_path || "") === (record.section_path || "");
    if (
      !sameStatus ||
      !sameCases ||
      !sameStructure ||
      (correction && !sameClaim)
    ) {
      const structureOnly = sameStatus && sameCases && !sameStructure;
      const event = makeEvent({
        event_type:
          correction || structureOnly ? "correction" : "usage_changed",
        observed_at: observedAt,
        origin: input.origin,
        page_url: input.page_url,
        tool_id: toolId,
        status: record.status,
        use_case_ids: useCases,
        evidence: evidencePayload(record),
      });
      events.push(event);
      nextTools.push(
        toolStateFromRecord(toolId, record, prior, event, observedAt),
      );
    } else {
      nextTools.push({
        ...prior,
        name: record.name || record.label || prior.name || toolId,
        kind: record.kind || prior.kind || "product",
        context: record.context || prior.context || "",
        section: record.section || prior.section || "",
        section_path: record.section_path || prior.section_path || "",
        href: record.href || prior.href || "",
        pending_absence_at: undefined,
      });
    }
    priorTools.delete(toolId);
  }

  // Removals: tools present before but absent on a complete verified page.
  // A URL that only repeats the homepage is not a Uses page, so its prior
  // declarations leave immediately.
  const notAUsesPage =
    input.bodyComplete !== false &&
    input.pageComplete === true &&
    input.page_status === "out_of_scope";
  const canRemove =
    input.bodyComplete !== false &&
    (notAUsesPage ||
      (input.pageComplete === true &&
        (input.page_status === "verified" ||
          input.page_status === "verified_empty")));

  for (const [toolId, prior] of priorTools) {
    if (!canRemove) {
      // Keep prior state; mark stale via pending absence only when verified empty/complete.
      nextTools.push(prior);
      continue;
    }

    if (correction || dropObserved.has(toolId)) {
      const event = makeEvent({
        event_type: "correction",
        observed_at: observedAt,
        origin: input.origin,
        page_url: input.page_url,
        tool_id: toolId,
        status: "removed",
        use_case_ids: [],
        evidence: {
          source_url: input.page_url,
          source_hash: "",
          label: prior.name || toolId,
          section: prior.section || "",
          context: prior.context || "",
          kind: prior.kind || "product",
          excerpt: "replaced by a later read of the same page",
        },
      });
      events.push(event);
      continue;
    }

    if (notAUsesPage) {
      const event = makeEvent({
        event_type: "usage_removed",
        observed_at: observedAt,
        origin: input.origin,
        page_url: input.page_url,
        tool_id: toolId,
        status: "removed",
        use_case_ids: [],
        evidence: {
          source_url: input.page_url,
          source_hash: "",
          label: prior.name || toolId,
          section: "",
          excerpt: "source URL repeats the homepage and is not a Uses page",
        },
      });
      events.push(event);
      continue;
    }

    const pending = prior.pending_absence_at;
    if (!pending) {
      nextTools.push({
        ...prior,
        pending_absence_at: observedAt,
      });
      continue;
    }

    const elapsedMs = Date.parse(observedAt) - Date.parse(pending);
    const needMs = REMOVAL_CONFIRMATION_HOURS * 60 * 60 * 1000;
    if (!Number.isFinite(elapsedMs) || elapsedMs < needMs) {
      nextTools.push(prior);
      continue;
    }

    const event = makeEvent({
      event_type: "usage_removed",
      observed_at: observedAt,
      origin: input.origin,
      page_url: input.page_url,
      tool_id: toolId,
      status: "removed",
      use_case_ids: [],
      evidence: {
        source_url: input.page_url,
        source_hash: "",
        label: toolId,
        section: "",
        excerpt: "absent on verified complete uses page",
      },
    });
    events.push(event);
    // Removed tools leave current state (history retained in events).
  }

  nextTools.sort((a, b) => a.tool_id.localeCompare(b.tool_id));

  const next = {
    origin: input.origin,
    page_url: input.page_url,
    page_status: input.page_status,
    first_valid_observation_at:
      previous?.first_valid_observation_at || observedAt,
    last_valid_observation_at: observedAt,
    tools: nextTools,
  };

  const firstVerifiedSighting =
    !previous &&
    (input.page_status === "verified" ||
      input.page_status === "verified_empty");
  const statusChanged = previous && previous.page_status !== input.page_status;
  if (firstVerifiedSighting || statusChanged) {
    const fromStatus = previous ? previous.page_status : "";
    events.push(
      makeEvent({
        event_type: "source_status_changed",
        observed_at: observedAt,
        origin: input.origin,
        page_url: input.page_url,
        tool_id: "",
        status: "unspecified",
        use_case_ids: [],
        evidence: {
          source_url: input.page_url,
          source_hash: "",
          label: `${fromStatus}->${input.page_status}`,
          section: "",
          excerpt: "",
        },
      }),
    );
  }

  events.sort(compareEvents);
  return { events, next, identityPairs };
}

/**
 * @param {object} fields
 * @returns {object}
 */
function makeEvent(fields) {
  const semantic = {
    event_type: fields.event_type,
    origin: fields.origin,
    page_url: fields.page_url,
    tool_id: fields.tool_id || null,
    status: fields.status,
    use_case_ids: fields.use_case_ids,
    evidence: fields.evidence,
    extractor_version: EXTRACTOR_VERSION,
    taxonomy_version: TAXONOMY_VERSION,
  };
  return {
    event_id: deterministicEventId(semantic),
    ...semantic,
    observed_at: fields.observed_at,
  };
}

/**
 * @param {import('./evidence.mjs').EvidenceRecord} record
 * @returns {object}
 */
function evidencePayload(record) {
  return {
    source_url: record.page_url,
    source_hash: record.source_hash,
    label: record.label,
    section: record.section,
    section_path: record.section_path || "",
    href: record.href || "",
    context: record.context || "",
    kind: record.kind || "product",
    excerpt: record.excerpt,
    quantity:
      Number.isFinite(record.quantity) && record.quantity > 0
        ? Math.min(99, Math.floor(record.quantity))
        : 1,
  };
}

/**
 * @param {string} toolId
 * @param {import('./evidence.mjs').EvidenceRecord} record
 * @param {MemberToolState|null} prior
 * @param {object} event
 * @param {string} observedAt
 * @returns {MemberToolState}
 */
function toolStateFromRecord(toolId, record, prior, event, observedAt) {
  const quantity =
    Number.isFinite(record.quantity) && record.quantity > 0
      ? Math.min(99, Math.floor(record.quantity))
      : Number.isFinite(prior?.quantity) && prior.quantity > 0
        ? Math.min(99, Math.floor(prior.quantity))
        : 1;
  return {
    tool_id: toolId,
    name: record.name || record.label || prior?.name || toolId,
    kind: record.kind || "product",
    context: record.context || "",
    section: record.section || "",
    section_path: record.section_path || "",
    href: record.href || "",
    status: record.status,
    quantity,
    use_case_ids: [...(record.use_case_ids || [])].sort(),
    first_observed_at: prior?.first_observed_at || observedAt,
    last_event_at: observedAt,
    evidence_event_id: event.event_id,
  };
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareEvents(a, b) {
  const t = String(a.observed_at).localeCompare(String(b.observed_at));
  if (t !== 0) {
    return t;
  }
  const o = String(a.origin).localeCompare(String(b.origin));
  if (o !== 0) {
    return o;
  }
  const tool = String(a.tool_id || "").localeCompare(String(b.tool_id || ""));
  if (tool !== 0) {
    return tool;
  }
  return String(a.event_id).localeCompare(String(b.event_id));
}
