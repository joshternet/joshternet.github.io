/**
 * Goal & Constraints:
 * Validate extracted items into provenance-backed evidence records. Catalog
 * matches keep canonical ids. Unlisted products still count, under a stable
 * observed id and the publisher's label. Ambiguous or context-rejected catalog
 * aliases stay unresolved.
 */

import {
  EXTRACTOR_VERSION,
  MAX_EXCERPT_CHARS,
  TAXONOMY_VERSION,
  TOOL_STATUSES,
} from "./constants.mjs";
import { blockId } from "../nlp/structured-html.mjs";
import {
  contentFingerprint,
  indexCatalog,
  isReportableUseLabel,
  observedToolId,
  peelCatalogLead,
  peelDeclarativeLeadIn,
  productNameFromLabel,
  resolveToolLabel,
  sanitizeLabel,
  separateNameContext,
} from "./normalize.mjs";

/**
 * @typedef {object} EvidenceRecord
 * @property {string} origin
 * @property {string} page_url
 * @property {string} label
 * @property {string} name
 * @property {string} comparison
 * @property {string|null} tool_id
 * @property {boolean} unresolved
 * @property {string} status
 * @property {string[]} use_case_ids
 * @property {string} section
 * @property {string} section_path
 * @property {string} href
 * @property {number} list_depth
 * @property {string} context
 * @property {number} [quantity]
 * @property {'product'|'equipment'|'practice'|'unresolved'} kind
 * @property {string} excerpt
 * @property {string} source_hash
 * @property {number} extractor_version
 * @property {number} taxonomy_version
 * @property {number} confidence
 */

/**
 * Builds evidence records from raw extract items + catalog.
 * @param {object} input
 * @param {string} input.origin
 * @param {string} input.page_url
 * @param {string} input.content_hash_source
 * @param {Array<{ label: string, status: string, section: string, excerpt: string, context?: string, kind?: string, use_case_hints?: string[] }>} input.items
 * @param {{ tools?: object[], aliases?: object[], useCases?: Array<{ id: string }> }} input.catalog
 * @returns {EvidenceRecord[]}
 */
export function buildEvidenceRecords(input) {
  const sourceHash = contentFingerprint(input.content_hash_source || "");
  const allowedUseCases = new Set(
    (input.catalog?.useCases || []).map((entry) => entry.id),
  );
  const catalogIndex = indexCatalog(input.catalog || {});

  /** @type {EvidenceRecord[]} */
  const records = [];

  for (const item of input.items || []) {
    const rawLabel = productNameFromLabel(sanitizeLabel(item.label));
    const peeled = peelDeclarativeLeadIn(rawLabel);
    const separated = separateNameContext(peeled.name);
    const catalogLead = peelCatalogLead(separated.name, input.catalog);
    const label = productNameFromLabel(catalogLead.name || separated.name);
    if (!isReportableUseLabel(label)) {
      continue;
    }

    let status = String(item.status || "unspecified");
    if (!TOOL_STATUSES.has(/** @type {*} */ (status))) {
      status = "unspecified";
    }

    const resolved = resolveToolLabel(label, {
      section: item.section,
      excerpt: item.excerpt,
      catalog: input.catalog,
    });

    let toolId = resolved.tool_id;
    let unresolved = resolved.unresolved;
    let name = label;

    if (catalogLead.tool_id) {
      toolId = catalogLead.tool_id;
      unresolved = false;
      const catalogTool = catalogIndex.byId.get(toolId);
      name = catalogTool && catalogTool.name ? catalogTool.name : label;
    } else if (resolved.match === "unique" && toolId) {
      const catalogTool = catalogIndex.byId.get(toolId);
      name = catalogTool && catalogTool.name ? catalogTool.name : label;
    } else if (resolved.match === "none") {
      const observed = observedToolId(resolved.comparison);
      if (observed) {
        toolId = observed;
        unresolved = false;
      }
    }

    /** @type {string[]} */
    const useCaseIds = [];
    for (const hint of item.use_case_hints || []) {
      if (allowedUseCases.size === 0 || allowedUseCases.has(hint)) {
        if (!useCaseIds.includes(hint)) {
          useCaseIds.push(hint);
        }
      }
    }

    const kind = normalizeKind(item.kind);
    if (kind === "unresolved") {
      unresolved = true;
      toolId = null;
    }

    const confidence = scoreConfidence({
      unresolved,
      status,
      hasSection: Boolean(item.section),
      useCaseCount: useCaseIds.length,
    });
    const sectionPath = sanitizeLabel(
      item.section_path || item.section || "",
    ).slice(0, 240);

    records.push({
      evidence_id: blockId([
        input.origin,
        input.page_url,
        resolved.comparison,
        sectionPath,
      ]),
      source_origin: input.origin,
      requested_url: input.requested_url || input.page_url,
      final_url: input.final_url || input.page_url,
      source_body_hash: sourceHash,
      fetch_status:
        typeof input.fetch_status === "number" ? input.fetch_status : null,
      body_complete: input.bodyComplete !== false,
      extraction_status: input.extraction_status || "extracted",
      block_type: item.block_type || "item",
      target_text: label,
      context_before: sanitizeLabel(item.context_before || ""),
      context_after: sanitizeLabel(item.context || "").slice(
        0,
        MAX_EXCERPT_CHARS,
      ),
      relevant_links: Array.isArray(item.relevant_links)
        ? item.relevant_links
        : [],
      parent_block_id: item.parent_block_id || "",
      child_block_ids: Array.isArray(item.child_block_ids)
        ? item.child_block_ids
        : [],
      language: item.language || "",
      observed_at: input.observed_at || "",
      origin: input.origin,
      page_url: input.page_url,
      label,
      name,
      comparison: resolved.comparison,
      tool_id: toolId,
      unresolved,
      status,
      use_case_ids: useCaseIds,
      section: sanitizeLabel(item.section || "").slice(0, 120),
      section_path: sectionPath,
      href: String(item.href || ""),
      list_depth: Number.isFinite(item.list_depth) ? item.list_depth : 0,
      context: sanitizeLabel(item.context || "").slice(0, MAX_EXCERPT_CHARS),
      quantity:
        Number.isFinite(item.quantity) && item.quantity > 0
          ? Math.min(99, Math.floor(item.quantity))
          : 1,
      kind,
      excerpt: String(item.excerpt || item.context || "").slice(
        0,
        MAX_EXCERPT_CHARS,
      ),
      source_hash: sourceHash,
      extractor_version: EXTRACTOR_VERSION,
      taxonomy_version: TAXONOMY_VERSION,
      confidence,
    });
  }

  return dedupeEvidence(records);
}

/**
 * @param {unknown} kind
 * @returns {'product'|'equipment'|'practice'|'unresolved'}
 */
function normalizeKind(kind) {
  if (
    kind === "equipment" ||
    kind === "practice" ||
    kind === "unresolved" ||
    kind === "product"
  ) {
    return kind;
  }
  return "product";
}

/**
 * True when a record is stored on the publisher's setup.
 * Ranking uses {@link isAdoptionEligible}, which keeps products only.
 * @param {EvidenceRecord} record
 * @returns {boolean}
 */
export function isKeptInState(record) {
  if (!record || record.unresolved || !record.tool_id) {
    return false;
  }
  const kind = record.kind || "product";
  if (kind !== "product" && kind !== "equipment" && kind !== "practice") {
    return false;
  }
  return record.confidence >= 0.5;
}

/**
 * Only current resolved products contribute to adoption counts.
 * @param {EvidenceRecord} record
 * @returns {boolean}
 */
export function isAdoptionEligible(record) {
  return (
    isKeptInState(record) &&
    (record.kind || "product") === "product" &&
    record.status === "current"
  );
}

/**
 * @param {object} input
 * @param {boolean} input.unresolved
 * @param {string} input.status
 * @param {boolean} input.hasSection
 * @param {number} input.useCaseCount
 * @returns {number}
 */
function scoreConfidence(input) {
  let score = 0.4;
  if (!input.unresolved) {
    score += 0.35;
  }
  if (input.status === "current") {
    score += 0.1;
  }
  if (input.hasSection) {
    score += 0.1;
  }
  if (input.useCaseCount > 0) {
    score += 0.05;
  }
  return Math.min(1, Math.round(score * 100) / 100);
}

/**
 * @param {EvidenceRecord[]} records
 * @returns {EvidenceRecord[]}
 */
function dedupeEvidence(records) {
  /** @type {Map<string, EvidenceRecord>} */
  const map = new Map();
  for (const record of records) {
    const key = `${record.tool_id || record.comparison}|${record.status}`;
    const existing = map.get(key);
    if (!existing || record.confidence > existing.confidence) {
      map.set(key, record);
    }
  }
  return [...map.values()].sort((a, b) => {
    const toolCmp = String(a.tool_id || a.comparison).localeCompare(
      String(b.tool_id || b.comparison),
    );
    if (toolCmp !== 0) {
      return toolCmp;
    }
    return a.status.localeCompare(b.status);
  });
}
