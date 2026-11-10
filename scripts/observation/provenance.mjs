/**
 * Goal & Constraints:
 * Git-owned generation manifests never embed their own commit SHA. After a
 * successful push, the durable observation-generation record stores
 * generation_git_sha and committed status. Bidirectional provenance must match.
 */

import { GENERATION_MANIFEST_SCHEMA } from "./constants.mjs";
import { markGenerationCommitted } from "./generation-lifecycle.mjs";

/**
 * @typedef {object} GitGenerationManifest
 * @property {string} schema
 * @property {string} observation_run_id
 * @property {'validated'} run_status_at_build
 * @property {string} started_at
 * @property {string} validated_at
 * @property {string} base_git_sha
 * @property {string} [registry_snapshot_id]
 * @property {string} [parser_schema_versions]
 * @property {string} [family_versions]
 */

/**
 * Builds the Git-owned generation manifest (no generation_git_sha).
 * @param {object} input
 * @param {string} input.observation_run_id
 * @param {string} input.started_at
 * @param {string} input.validated_at
 * @param {string} input.base_git_sha
 * @param {string} [input.registry_snapshot_id]
 * @param {string} [input.parser_schema_versions]
 * @param {string} [input.family_versions]
 * @returns {GitGenerationManifest}
 */
export function buildGitGenerationManifest(input) {
  if ("generation_git_sha" in (input || {})) {
    throw new Error(
      "Git generation manifest must not include generation_git_sha",
    );
  }
  if ("committed_at" in (input || {})) {
    throw new Error("Git generation manifest must not include committed_at");
  }
  return {
    schema: GENERATION_MANIFEST_SCHEMA,
    observation_run_id: String(input.observation_run_id || ""),
    run_status_at_build: "validated",
    started_at: String(input.started_at || ""),
    validated_at: String(input.validated_at || ""),
    base_git_sha: String(input.base_git_sha || ""),
    registry_snapshot_id: input.registry_snapshot_id,
    parser_schema_versions: input.parser_schema_versions,
    family_versions: input.family_versions,
  };
}

/**
 * After a successful push, mark the durable observation generation committed.
 * @param {import('./observation-store.mjs').ObservationStore} store
 * @param {string} observationRunId
 * @param {string} generationGitSha
 * @param {string} [committedAt]
 * @returns {Promise<import('./observation-store.mjs').ObservationGenerationRecord>}
 */
export async function recordSuccessfulGenerationPush(
  store,
  observationRunId,
  generationGitSha,
  committedAt,
) {
  return markGenerationCommitted(store, observationRunId, {
    generation_git_sha: generationGitSha,
    committed_at: committedAt,
  });
}

/**
 * Verifies bidirectional provenance between Git manifest and durable record.
 * @param {GitGenerationManifest} manifest
 * @param {import('./observation-store.mjs').ObservationGenerationRecord} durable
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function verifyGenerationProvenance(manifest, durable) {
  /** @type {string[]} */
  const errors = [];
  if (!manifest || !durable) {
    return { ok: false, errors: ["missing manifest or durable record"] };
  }
  if (manifest.observation_run_id !== durable.observation_run_id) {
    errors.push("observation_run_id mismatch");
  }
  if (durable.run_status !== "committed") {
    errors.push("durable generation is not committed");
  }
  if (!durable.generation_git_sha) {
    errors.push("missing generation_git_sha on durable record");
  }
  if (manifest.run_status_at_build !== "validated") {
    errors.push("Git manifest run_status_at_build must be validated");
  }
  if ("generation_git_sha" in manifest) {
    errors.push("Git manifest must not contain generation_git_sha");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Detects either direction of provenance mismatch for tests and gates.
 * @param {GitGenerationManifest} manifest
 * @param {import('./observation-store.mjs').ObservationGenerationRecord} durable
 * @param {string} expectedCommitSha
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function verifyProvenanceAgainstCommit(
  manifest,
  durable,
  expectedCommitSha,
) {
  const base = verifyGenerationProvenance(manifest, durable);
  /** @type {string[]} */
  const errors = [...base.errors];
  if (durable.generation_git_sha !== expectedCommitSha) {
    errors.push("durable generation_git_sha does not match pushed commit");
  }
  if (manifest.observation_run_id !== durable.observation_run_id) {
    errors.push("Git generation references wrong observation run");
  }
  return { ok: errors.length === 0, errors };
}
