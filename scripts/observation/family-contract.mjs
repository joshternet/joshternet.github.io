/**
 * Goal & Constraints:
 * Shared registration contract for crawl-derived content families. Domain
 * modules own discovery/extract/reconcile/project; orchestration owns fetch,
 * evidence, replay, validation and publish. Share lifecycle, not one schema.
 */

import { OBSERVATION_RUN_STATUSES } from "./constants.mjs";

/**
 * @typedef {object} ContentFamilyContract
 * @property {string} id
 * @property {string} description
 * @property {(ctx: object) => Array<object>|Promise<Array<object>>} [discover]
 * @property {(ctx: object) => Array<object>|Promise<Array<object>>} [extract]
 * @property {(ctx: object) => object|Promise<object>} [reconcile]
 * @property {(ctx: object) => object|Promise<object>} [project]
 * @property {string[]} acceptedSourceTypes
 * @property {string} normalizedEvidenceSchema
 * @property {string} identityStrategy
 * @property {string} freshnessPolicy
 * @property {string} coverageCompletenessPolicy
 * @property {string} presenceEvidencePolicy
 * @property {string} absenceRemovalEvidencePolicy
 * @property {string} verifiedRemovalSemantics
 * @property {string} provenanceRequirements
 * @property {string} schemaVersion
 * @property {string[]} publicOutputs
 * @property {string} [privacyPublicationPolicy]
 */

/** @type {Map<string, ContentFamilyContract>} */
const registry = new Map();

/**
 * Required string fields on every family contract.
 * @type {ReadonlyArray<keyof ContentFamilyContract>}
 */
const REQUIRED_STRING_FIELDS = Object.freeze([
  "id",
  "description",
  "normalizedEvidenceSchema",
  "identityStrategy",
  "freshnessPolicy",
  "coverageCompletenessPolicy",
  "presenceEvidencePolicy",
  "absenceRemovalEvidencePolicy",
  "verifiedRemovalSemantics",
  "provenanceRequirements",
  "schemaVersion",
]);

/**
 * Validates a content-family contract declaration.
 * @param {unknown} candidate
 * @returns {ContentFamilyContract}
 * @throws {Error} when the contract is incomplete or invalid
 */
export function assertContentFamilyContract(candidate) {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("content family contract must be an object");
  }
  /** @type {Record<string, unknown>} */
  const row = /** @type {Record<string, unknown>} */ (candidate);
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof row[field] !== "string" || !String(row[field]).trim()) {
      throw new Error(`content family contract missing ${field}`);
    }
  }
  if (
    !Array.isArray(row.acceptedSourceTypes) ||
    row.acceptedSourceTypes.length === 0
  ) {
    throw new Error("content family contract requires acceptedSourceTypes");
  }
  if (!Array.isArray(row.publicOutputs)) {
    throw new Error("content family contract requires publicOutputs array");
  }
  for (const type of row.acceptedSourceTypes) {
    if (typeof type !== "string" || !type.trim()) {
      throw new Error("acceptedSourceTypes entries must be non-empty strings");
    }
  }
  return /** @type {ContentFamilyContract} */ (candidate);
}

/**
 * Registers a content family. Replacing an existing id fails unless replace=true.
 * @param {ContentFamilyContract} contract
 * @param {{ replace?: boolean }} [options]
 * @returns {ContentFamilyContract}
 */
export function registerContentFamily(contract, options = {}) {
  const valid = assertContentFamilyContract(contract);
  if (registry.has(valid.id) && options.replace !== true) {
    throw new Error(`content family already registered: ${valid.id}`);
  }
  registry.set(valid.id, Object.freeze({ ...valid }));
  return registry.get(valid.id);
}

/**
 * @param {string} id
 * @returns {ContentFamilyContract|undefined}
 */
export function getContentFamily(id) {
  return registry.get(String(id || ""));
}

/**
 * @returns {ContentFamilyContract[]}
 */
export function listContentFamilies() {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Clears the in-process registry (tests only).
 * @returns {void}
 */
export function clearContentFamilyRegistry() {
  registry.clear();
}

/**
 * True when a run status may participate in published-state replay.
 * @param {string} status
 * @returns {boolean}
 */
export function isCommittedRunStatus(status) {
  return status === "committed";
}

/**
 * True when a run status is a known lifecycle value.
 * @param {string} status
 * @returns {boolean}
 */
export function isObservationRunStatus(status) {
  return OBSERVATION_RUN_STATUSES.includes(
    /** @type {import('./constants.mjs').ObservationRunStatus} */ (status),
  );
}
