/**
 * Goal & Constraints:
 * Shared constants for the crawl-derived observation platform. Lifecycle and
 * fetch outcomes are explicit enums so replay never invents authority.
 */

/** @typedef {'started'|'collecting'|'validated'|'committed'|'aborted'} ObservationRunStatus */

/** @type {ReadonlyArray<ObservationRunStatus>} */
export const OBSERVATION_RUN_STATUSES = Object.freeze([
  "started",
  "collecting",
  "validated",
  "committed",
  "aborted",
]);

/**
 * Fetch / broker outcomes recorded on every resource observation.
 * @typedef {'success'|'unchanged'|'robots_disallowed'|'deferred'|'timeout'|'http_failure'|'content_type_rejected'|'budget_exhausted'|'network_failure'|'dns_failure'|'tls_failure'} ResourceFetchOutcome
 */

/** @type {ReadonlyArray<ResourceFetchOutcome>} */
export const RESOURCE_FETCH_OUTCOMES = Object.freeze([
  "success",
  "unchanged",
  "robots_disallowed",
  "deferred",
  "timeout",
  "http_failure",
  "content_type_rejected",
  "budget_exhausted",
  "network_failure",
  "dns_failure",
  "tls_failure",
]);

/** @typedef {'semantic'|'operational'} ObservationRetentionClass */

/**
 * Ownership classes for persistent artifacts.
 * @typedef {'authored-policy'|'observed-history'|'reconstructed-state'|'derived-projection'} OwnershipClass
 */

/** @type {ReadonlyArray<OwnershipClass>} */
export const OWNERSHIP_CLASSES = Object.freeze([
  "authored-policy",
  "observed-history",
  "reconstructed-state",
  "derived-projection",
]);

/** Schema id for Git-owned generation manifests (no self-referential commit SHA). */
export const GENERATION_MANIFEST_SCHEMA = "joshternet.generation-manifest.v1";

/** Schema id for durable observation-generation records. */
export const OBSERVATION_GENERATION_SCHEMA =
  "joshternet.observation-generation.v1";

/** Schema id for resource observations. */
export const RESOURCE_OBSERVATION_SCHEMA = "joshternet.resource-observation.v1";
