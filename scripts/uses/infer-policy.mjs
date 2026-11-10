/**
 * Goal & Constraints:
 * Acceptance rules for one allowlisted local model. A top score is not
 * acceptance. The policy does not load a model or open a network connection.
 */

import { createHash } from "node:crypto";

/**
 * @param {object} lock
 * @param {string} modelId
 * @param {string} [revision]
 * @returns {void}
 */
export function assertAllowedModel(lock, modelId, revision) {
  const allowedId = lock?.model_id;
  const allowedRevision = lock?.revision;
  if (modelId !== allowedId || (revision && revision !== allowedRevision)) {
    throw new Error(`model is not allowlisted: ${modelId || "unknown"}`);
  }
}

/**
 * Ranked slot descriptions. Empty scope text is not a label.
 * Excluded and retired slots are not choices.
 * @param {{ categories?: object[] }} catalog
 * @returns {Array<{ id: string, description: string }>}
 */
export function slotLabels(catalog) {
  /** @type {Array<{ id: string, description: string }>} */
  const labels = [];
  for (const category of catalog?.categories || []) {
    if (!category || category.role !== "ranked" || !category.id) {
      continue;
    }
    const scope =
      typeof category.scope === "string" ? category.scope.trim() : "";
    labels.push({
      id: category.id,
      description: scope || `a ${category.name || category.id}`,
    });
  }
  return labels.sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * @param {string} text
 * @param {string} target
 * @param {number} [radius]
 * @returns {string}
 */
export function windowText(text, target, radius = 240) {
  const source = String(text || "");
  const needle = String(target || "");
  if (!source || !needle) {
    return source.slice(0, radius);
  }
  const at = source.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) {
    return source.slice(0, radius);
  }
  let start = Math.max(0, at - radius);
  const prefix = source.slice(Math.max(0, start - 40), at).toLowerCase();
  if (
    /\b(no longer|not|never|formerly|considering)\b/.test(prefix) &&
    start > 0
  ) {
    start = Math.max(0, start - 40);
  }
  return source.slice(start, at + needle.length + radius);
}

/**
 * @param {Array<{ id: string, score: number }>} scores
 * @param {{ threshold: number, margin: number }} policy
 * @returns {{ accepted: boolean, slot_id: string, reason: string }}
 */
export function acceptProposal(scores, policy) {
  const ranked = (Array.isArray(scores) ? scores : [])
    .filter(
      (row) => row && typeof row.id === "string" && Number.isFinite(row.score),
    )
    .sort(
      (left, right) =>
        right.score - left.score || left.id.localeCompare(right.id),
    );
  if (ranked.length === 0) {
    return { accepted: false, slot_id: "", reason: "no-scores" };
  }
  const top = ranked[0];
  const second = ranked[1];
  if (top.score < policy.threshold) {
    return { accepted: false, slot_id: "", reason: "below-threshold" };
  }
  if (second && top.score - second.score < policy.margin) {
    return { accepted: false, slot_id: "", reason: "margin" };
  }
  return { accepted: true, slot_id: top.id, reason: "accepted" };
}

const NEGATION =
  /\b(?:no longer|not|never|formerly|considering|replaced by)\b/i;

/**
 * A dropped negation cannot be published automatically.
 * @param {string} fullText
 * @param {string} windowedText
 * @param {{ accepted?: boolean }} proposal
 * @returns {boolean}
 */
export function automaticPublishAllowed(fullText, windowedText, proposal) {
  if (!proposal || proposal.accepted !== true) {
    return false;
  }
  const source = String(fullText || "");
  if (NEGATION.test(source) && !NEGATION.test(String(windowedText || ""))) {
    return false;
  }
  return true;
}

/**
 * @param {object} parts
 * @returns {string}
 */
/**
 * Maps classifier label strings back to ranked slot ids.
 * @param {{ labels?: string[], scores?: number[] }|null|undefined} result
 * @param {Array<{ id: string, description: string }>} labels
 * @returns {Array<{ id: string, score: number }>}
 */
export function pairSlotScores(result, labels) {
  /** @type {Map<string, string>} */
  const byText = new Map();
  for (const label of labels || []) {
    if (label && label.description && label.id) {
      byText.set(label.description, label.id);
    }
  }
  const texts = Array.isArray(result?.labels) ? result.labels : [];
  const scores = Array.isArray(result?.scores) ? result.scores : [];
  /** @type {Array<{ id: string, score: number }>} */
  const rows = [];
  for (let index = 0; index < texts.length; index += 1) {
    const id = byText.get(texts[index]);
    const score = scores[index];
    if (!id || !Number.isFinite(score)) {
      continue;
    }
    rows.push({ id, score });
  }
  return rows;
}

/**
 * Classification text from the product, its section, and its own description.
 * Neighboring products are not included. Long text keeps the existing window.
 * @param {object} claim
 * @returns {{ full: string, presented: string }}
 */
export function modelClaimText(claim) {
  const name = typeof claim?.name === "string" ? claim.name.trim() : "";
  const sectionPath =
    typeof claim?.section_path === "string" ? claim.section_path.trim() : "";
  const section =
    sectionPath ||
    (typeof claim?.section === "string" ? claim.section.trim() : "");
  const context =
    typeof claim?.context === "string" ? claim.context.trim() : "";
  const excerpt =
    typeof claim?.excerpt === "string" ? claim.excerpt.trim() : "";
  const description = context || excerpt;
  /** @type {string[]} */
  const parts = [];
  if (name) {
    parts.push(name);
  }
  if (section && section !== name) {
    parts.push(section);
  }
  if (description && description !== name && description !== section) {
    parts.push(description);
  }
  const full = parts.join(". ");
  const presented = full.length > 240 ? windowText(full, name) : full;
  return { full, presented };
}

/**
 * Asks the injected classifier for a slot. A top score is not acceptance.
 * Cached scores still pass the threshold, margin, and negation checks.
 * @param {object} input
 * @param {object} input.claim
 * @param {object} input.catalog
 * @param {{ threshold: number, margin: number }} input.policy
 * @param {(text: string, labels: string[]) => Promise<{ labels?: string[], scores?: number[] }>} input.classify
 * @param {Map<string, object>} [input.cache]
 * @param {string} [input.cacheKey]
 * @param {{ hits?: number, misses?: number, decisions?: number, abstained?: number }} [input.stats]
 * @returns {Promise<{ accepted: boolean, slot_id: string, reason: string }>}
 */
export async function applyModelProposal(input) {
  const labels = slotLabels(input.catalog);
  if (labels.length === 0) {
    return { accepted: false, slot_id: "", reason: "no-labels" };
  }
  const claim = input.claim || {};
  const { full, presented } = modelClaimText(claim);
  const descriptions = labels.map((label) => label.description);
  const cache = input.cache;
  const cacheKey = typeof input.cacheKey === "string" ? input.cacheKey : "";
  let raw;
  if (cache && cacheKey && cache.has(cacheKey)) {
    if (input.stats) {
      input.stats.hits = (input.stats.hits || 0) + 1;
    }
    raw = cache.get(cacheKey);
  } else {
    if (input.stats) {
      input.stats.misses = (input.stats.misses || 0) + 1;
    }
    raw = await input.classify(presented, descriptions);
    if (cache && cacheKey) {
      cache.set(cacheKey, raw);
    }
  }
  const proposal = acceptProposal(pairSlotScores(raw, labels), input.policy);
  let result = proposal;
  if (
    proposal.accepted &&
    !automaticPublishAllowed(full, presented, proposal)
  ) {
    result = { accepted: false, slot_id: "", reason: "negation" };
  }
  if (input.stats) {
    input.stats.decisions = (input.stats.decisions || 0) + 1;
    if (!result.accepted) {
      input.stats.abstained = (input.stats.abstained || 0) + 1;
    }
  }
  return result;
}

/**
 * Locked files must be present with the recorded hash. Extra cache files are ignored.
 * @param {Array<{ path?: string, sha256?: string }>|undefined} expected
 * @param {Array<{ path?: string, sha256?: string }>|undefined} actual
 * @returns {{ ok: boolean, reason: string }}
 */
export function cacheMatchesLock(expected, actual) {
  const wanted = new Map();
  for (const row of expected || []) {
    if (row && row.path && row.sha256) {
      wanted.set(row.path, row.sha256);
    }
  }
  if (wanted.size === 0) {
    return { ok: false, reason: "lock has no files" };
  }
  const have = new Map();
  for (const row of actual || []) {
    if (row && row.path && row.sha256) {
      have.set(row.path, row.sha256);
    }
  }
  for (const [file, hash] of wanted) {
    if (!have.has(file)) {
      return { ok: false, reason: `missing ${file}` };
    }
    if (have.get(file) !== hash) {
      return { ok: false, reason: `hash mismatch ${file}` };
    }
  }
  return { ok: true, reason: "match" };
}

/**
 * @param {object} parts
 * @returns {string}
 */
export function classificationFingerprint(parts) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        parts.evidenceHash || "",
        parts.extractorVersion || 0,
        parts.modelRevision || "",
        parts.templateVersion || 0,
        parts.labelHash || "",
        parts.catalogHash || "",
        parts.policyHash || "",
      ]),
    )
    .digest("hex");
}
