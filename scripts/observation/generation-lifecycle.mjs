/**
 * Goal & Constraints:
 * Observation-run lifecycle. Published replay uses committed only. Candidate
 * reconstruction uses committed history + current-run observations. Commit
 * status and generation_git_sha live only in the durable store after push.
 */

import { randomUUID } from "node:crypto";

import {
  OBSERVATION_GENERATION_SCHEMA,
  OBSERVATION_RUN_STATUSES,
} from "./constants.mjs";

/**
 * @typedef {import('./observation-store.mjs').ObservationGenerationRecord} ObservationGenerationRecord
 * @typedef {import('./observation-store.mjs').ObservationStore} ObservationStore
 */

/**
 * Starts a new observation generation in `started` then `collecting`.
 * @param {ObservationStore} store
 * @param {{
 *   observation_run_id?: string,
 *   base_git_sha: string,
 *   registry_snapshot_id?: string,
 *   parser_schema_versions?: string,
 *   family_versions?: string,
 *   started_at?: string,
 * }} input
 * @returns {Promise<ObservationGenerationRecord>}
 */
export async function startObservationGeneration(store, input) {
  const startedAt = input.started_at || new Date().toISOString();
  /** @type {ObservationGenerationRecord} */
  const record = {
    schema: OBSERVATION_GENERATION_SCHEMA,
    observation_run_id: String(input.observation_run_id || randomUUID()),
    run_status: "collecting",
    started_at: startedAt,
    base_git_sha: String(input.base_git_sha || ""),
    registry_snapshot_id: input.registry_snapshot_id,
    parser_schema_versions: input.parser_schema_versions,
    family_versions: input.family_versions,
  };
  return store.putGeneration(record);
}

/**
 * Marks a generation validated (publication candidate only).
 * @param {ObservationStore} store
 * @param {string} observationRunId
 * @param {string} [validatedAt]
 * @returns {Promise<ObservationGenerationRecord>}
 */
export async function markGenerationValidated(
  store,
  observationRunId,
  validatedAt = new Date().toISOString(),
) {
  const prior = await store.getGeneration(observationRunId);
  if (!prior) {
    throw new Error(`unknown observation generation: ${observationRunId}`);
  }
  if (prior.run_status !== "collecting" && prior.run_status !== "started") {
    throw new Error(`cannot validate generation in status ${prior.run_status}`);
  }
  return store.putGeneration({
    ...prior,
    run_status: "validated",
    validated_at: validatedAt,
  });
}

/**
 * Marks a generation committed after a successful Git push.
 * @param {ObservationStore} store
 * @param {string} observationRunId
 * @param {{ generation_git_sha: string, committed_at?: string }} input
 * @returns {Promise<ObservationGenerationRecord>}
 */
export async function markGenerationCommitted(store, observationRunId, input) {
  const prior = await store.getGeneration(observationRunId);
  if (!prior) {
    throw new Error(`unknown observation generation: ${observationRunId}`);
  }
  if (prior.run_status !== "validated") {
    throw new Error(
      `cannot commit generation in status ${prior.run_status}; must be validated`,
    );
  }
  const sha = String(input.generation_git_sha || "").trim();
  if (!sha) {
    throw new Error("generation_git_sha required after successful push");
  }
  return store.putGeneration({
    ...prior,
    run_status: "committed",
    generation_git_sha: sha,
    committed_at: input.committed_at || new Date().toISOString(),
  });
}

/**
 * Aborts a generation. Operational observations may remain; semantic authority does not.
 * @param {ObservationStore} store
 * @param {string} observationRunId
 * @returns {Promise<ObservationGenerationRecord>}
 */
export async function markGenerationAborted(store, observationRunId) {
  const prior = await store.getGeneration(observationRunId);
  if (!prior) {
    throw new Error(`unknown observation generation: ${observationRunId}`);
  }
  if (prior.run_status === "committed") {
    throw new Error("cannot abort a committed generation");
  }
  return store.putGeneration({
    ...prior,
    run_status: "aborted",
    generation_git_sha: undefined,
    committed_at: undefined,
  });
}

/**
 * Filters generations for published-state replay (committed only).
 * @param {ObservationGenerationRecord[]} generations
 * @returns {ObservationGenerationRecord[]}
 */
export function selectPublishedGenerations(generations) {
  return (generations || []).filter((row) => row.run_status === "committed");
}

/**
 * Filters resource observations for published-state replay.
 * @param {object[]} observations
 * @param {Set<string>|string[]} committedRunIds
 * @returns {object[]}
 */
export function selectPublishedObservations(observations, committedRunIds) {
  const allowed =
    committedRunIds instanceof Set
      ? committedRunIds
      : new Set(committedRunIds || []);
  return (observations || []).filter((row) =>
    allowed.has(String(row.observation_run_id || "")),
  );
}

/**
 * Builds the observation set for candidate reconstruction of the current run.
 * @param {object[]} allObservations
 * @param {Set<string>|string[]} committedRunIds
 * @param {string} currentRunId
 * @returns {object[]}
 */
export function selectCandidateObservations(
  allObservations,
  committedRunIds,
  currentRunId,
) {
  const allowed =
    committedRunIds instanceof Set
      ? committedRunIds
      : new Set(committedRunIds || []);
  const current = String(currentRunId || "");
  return (allObservations || []).filter((row) => {
    const runId = String(row.observation_run_id || "");
    return allowed.has(runId) || runId === current;
  });
}

/**
 * Deterministic handling when a validated generation failed to push.
 * @param {ObservationGenerationRecord} generation
 * @param {{ current_base_git_sha: string, mode?: 'retry'|'supersede'|'abort' }} policy
 * @returns {'retry'|'supersede'|'abort'}
 */
export function decideValidatedUncommittedFate(generation, policy) {
  if (generation.run_status !== "validated") {
    throw new Error("fate decision only applies to validated generations");
  }
  if (
    policy.mode === "abort" ||
    policy.mode === "supersede" ||
    policy.mode === "retry"
  ) {
    if (
      policy.mode === "retry" &&
      generation.base_git_sha !== policy.current_base_git_sha
    ) {
      return "supersede";
    }
    return policy.mode;
  }
  if (generation.base_git_sha === policy.current_base_git_sha) {
    return "retry";
  }
  return "supersede";
}

/**
 * @returns {ReadonlyArray<string>}
 */
export function listRunStatuses() {
  return OBSERVATION_RUN_STATUSES;
}
