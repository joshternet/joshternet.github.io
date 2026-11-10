/**
 * Goal & Constraints:
 * Family-independent durable resource observation envelope. Every fetch
 * decision/attempt is recorded—including failures—so absence is never inferred
 * from silence. Bodies are optional and only referenced after durable persist.
 */

import { createHash, randomUUID } from "node:crypto";

import {
  RESOURCE_FETCH_OUTCOMES,
  RESOURCE_OBSERVATION_SCHEMA,
} from "./constants.mjs";

/**
 * @typedef {object} ResourceObservation
 * @property {string} schema
 * @property {string} observation_id
 * @property {string} observation_run_id
 * @property {string} member_origin
 * @property {string} requested_url
 * @property {string} final_url
 * @property {string} content_type
 * @property {string} observed_at
 * @property {import('./constants.mjs').ResourceFetchOutcome} outcome
 * @property {string} [failure_reason]
 * @property {string} [defer_reason]
 * @property {number|null} http_status
 * @property {string} [etag]
 * @property {string} [last_modified]
 * @property {string} [robots_decision]
 * @property {string} [source_hash]
 * @property {boolean} content_unchanged
 * @property {string} discovery_reason
 * @property {string} coverage
 * @property {'semantic'|'operational'} retention_class
 */

/**
 * @param {string} value
 * @returns {string}
 */
function requireNonEmpty(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("required observation field is empty");
  }
  return text;
}

/**
 * Builds a durable resource observation for any fetch decision/attempt.
 * @param {object} input
 * @param {string} input.observation_run_id
 * @param {string} input.member_origin
 * @param {string} input.requested_url
 * @param {import('./constants.mjs').ResourceFetchOutcome} input.outcome
 * @param {string} [input.observation_id]
 * @param {string} [input.final_url]
 * @param {string} [input.content_type]
 * @param {string} [input.observed_at]
 * @param {string} [input.failure_reason]
 * @param {string} [input.defer_reason]
 * @param {number|null} [input.http_status]
 * @param {string} [input.etag]
 * @param {string} [input.last_modified]
 * @param {string} [input.robots_decision]
 * @param {string} [input.source_hash]
 * @param {boolean} [input.content_unchanged]
 * @param {string} [input.discovery_reason]
 * @param {string} [input.coverage]
 * @param {'semantic'|'operational'} [input.retention_class]
 * @returns {ResourceObservation}
 */
export function createResourceObservation(input) {
  const outcome = String(input?.outcome || "");
  if (!RESOURCE_FETCH_OUTCOMES.includes(/** @type {any} */ (outcome))) {
    throw new Error(`unknown resource fetch outcome: ${outcome}`);
  }
  if (input?.source_hash && typeof input.source_hash !== "string") {
    throw new Error("source_hash must be a string when present");
  }
  const requested = requireNonEmpty(input.requested_url);
  const observedAt =
    typeof input.observed_at === "string" && input.observed_at
      ? input.observed_at
      : new Date().toISOString();
  const retention =
    input.retention_class === "semantic" ? "semantic" : "operational";

  /** @type {ResourceObservation} */
  const observation = {
    schema: RESOURCE_OBSERVATION_SCHEMA,
    observation_id: requireNonEmpty(input.observation_id || randomUUID()),
    observation_run_id: requireNonEmpty(input.observation_run_id),
    member_origin: requireNonEmpty(input.member_origin),
    requested_url: requested,
    final_url: String(input.final_url || requested),
    content_type: String(input.content_type || ""),
    observed_at: observedAt,
    outcome: /** @type {import('./constants.mjs').ResourceFetchOutcome} */ (
      outcome
    ),
    http_status:
      typeof input.http_status === "number" ? input.http_status : null,
    content_unchanged: input.content_unchanged === true,
    discovery_reason: String(input.discovery_reason || "unspecified"),
    coverage: String(input.coverage || "unknown"),
    retention_class: retention,
  };
  if (input.failure_reason) {
    observation.failure_reason = String(input.failure_reason);
  }
  if (input.defer_reason) {
    observation.defer_reason = String(input.defer_reason);
  }
  if (input.etag) {
    observation.etag = String(input.etag);
  }
  if (input.last_modified) {
    observation.last_modified = String(input.last_modified);
  }
  if (input.robots_decision) {
    observation.robots_decision = String(input.robots_decision);
  }
  if (input.source_hash) {
    observation.source_hash = String(input.source_hash);
  }
  return observation;
}

/**
 * Hashes a body for content-addressed storage.
 * @param {string|Uint8Array|Buffer} body
 * @returns {string} sha256 hex digest
 */
export function hashSourceBody(body) {
  const hash = createHash("sha256");
  hash.update(body);
  return hash.digest("hex");
}

/**
 * True when an outcome may retain a source body.
 * @param {string} outcome
 * @returns {boolean}
 */
export function outcomeMayRetainBody(outcome) {
  return outcome === "success";
}

/**
 * Failed/denied/deferred outcomes must never establish verified absence alone.
 * @param {string} outcome
 * @returns {boolean}
 */
export function outcomeEstablishesVerifiedAbsence(outcome) {
  return false;
}

/**
 * Partial or failed coverage cannot prove removal.
 * @param {string} coverage
 * @returns {boolean}
 */
export function coverageMayEstablishRemoval(coverage) {
  return coverage === "complete";
}
