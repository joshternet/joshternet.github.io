/**
 * Goal & Constraints:
 * Authoritative observation history survives runners and stays out of Git by
 * default. Append-safe resource + generation records with deterministic replay
 * ordering. Semantic vs operational retention is policy-driven.
 */

import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";

import { OBSERVATION_GENERATION_SCHEMA } from "./constants.mjs";
import { isObservationRunStatus } from "./family-contract.mjs";

/**
 * @typedef {object} ObservationGenerationRecord
 * @property {string} schema
 * @property {string} observation_run_id
 * @property {import('./constants.mjs').ObservationRunStatus} run_status
 * @property {string} started_at
 * @property {string} [validated_at]
 * @property {string} [committed_at]
 * @property {string} base_git_sha
 * @property {string} [generation_git_sha]
 * @property {string} [registry_snapshot_id]
 * @property {string} [parser_schema_versions]
 * @property {string} [family_versions]
 */

/**
 * @typedef {object} ObservationStore
 * @property {(generation: ObservationGenerationRecord) => Promise<ObservationGenerationRecord>} putGeneration
 * @property {(runId: string) => Promise<ObservationGenerationRecord|null>} getGeneration
 * @property {(observation: object) => Promise<object>} appendResourceObservation
 * @property {(query: { observation_run_id?: string, member_origin?: string, run_status?: string }) => Promise<object[]>} listResourceObservations
 * @property {(statuses?: string[]) => Promise<ObservationGenerationRecord[]>} listGenerations
 */

/**
 * @param {string} rootDir
 * @returns {ObservationStore}
 */
export function createFilesystemObservationStore(rootDir) {
  const raw = String(rootDir || "");
  if (!raw) {
    throw new Error("observation store rootDir is required");
  }
  const root = path.resolve(raw);
  const generationsDir = path.join(root, "generations");
  const resourcesDir = path.join(root, "resources");

  /**
   * @param {string} runId
   * @returns {string}
   */
  function generationPath(runId) {
    return path.join(generationsDir, `${runId}.json`);
  }

  return {
    /**
     * @param {ObservationGenerationRecord} generation
     * @returns {Promise<ObservationGenerationRecord>}
     */
    async putGeneration(generation) {
      if (!isObservationRunStatus(generation.run_status)) {
        throw new Error(`invalid run_status: ${generation.run_status}`);
      }
      if (generation.schema !== OBSERVATION_GENERATION_SCHEMA) {
        throw new Error("invalid observation generation schema");
      }
      if (
        generation.run_status === "committed" &&
        (!generation.generation_git_sha || !generation.committed_at)
      ) {
        throw new Error(
          "committed generation requires generation_git_sha and committed_at",
        );
      }
      if (
        generation.run_status !== "committed" &&
        (generation.generation_git_sha || generation.committed_at)
      ) {
        throw new Error(
          "generation_git_sha/committed_at only allowed when committed",
        );
      }
      await mkdir(generationsDir, { recursive: true });
      const target = generationPath(generation.observation_run_id);
      await writeFile(
        target,
        `${JSON.stringify(generation, null, 2)}\n`,
        "utf8",
      );
      return generation;
    },

    /**
     * @param {string} runId
     * @returns {Promise<ObservationGenerationRecord|null>}
     */
    async getGeneration(runId) {
      try {
        const raw = await readFile(generationPath(runId), "utf8");
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    /**
     * @param {object} observation
     * @returns {Promise<object>}
     */
    async appendResourceObservation(observation) {
      const runId = String(observation?.observation_run_id || "");
      const observationId = String(observation?.observation_id || "");
      if (!runId || !observationId) {
        throw new Error(
          "resource observation requires run and observation ids",
        );
      }
      if (observation.source_hash) {
        // Callers must persist+verify blobs before setting source_hash.
      }
      const dir = path.join(resourcesDir, runId);
      await mkdir(dir, { recursive: true });
      const target = path.join(dir, `${observationId}.json`);
      await writeFile(
        target,
        `${JSON.stringify(observation, null, 2)}\n`,
        "utf8",
      );
      return observation;
    },

    /**
     * @param {{ observation_run_id?: string, member_origin?: string, run_status?: string }} query
     * @returns {Promise<object[]>}
     */
    async listResourceObservations(query = {}) {
      /** @type {object[]} */
      const rows = [];
      const runFilter = query.observation_run_id
        ? [query.observation_run_id]
        : await listRunDirs(resourcesDir);
      for (const runId of runFilter) {
        const dir = path.join(resourcesDir, runId);
        let files = [];
        try {
          files = await readdir(dir);
        } catch {
          continue;
        }
        for (const file of files) {
          if (!file.endsWith(".json")) {
            continue;
          }
          const raw = await readFile(path.join(dir, file), "utf8");
          const row = JSON.parse(raw);
          if (
            query.member_origin &&
            row.member_origin !== query.member_origin
          ) {
            continue;
          }
          rows.push(row);
        }
      }
      rows.sort((a, b) =>
        String(a.observed_at).localeCompare(String(b.observed_at)),
      );
      return rows;
    },

    /**
     * @param {string[]} [statuses]
     * @returns {Promise<ObservationGenerationRecord[]>}
     */
    async listGenerations(statuses) {
      await mkdir(generationsDir, { recursive: true });
      const files = await readdir(generationsDir);
      /** @type {ObservationGenerationRecord[]} */
      const rows = [];
      for (const file of files) {
        if (!file.endsWith(".json")) {
          continue;
        }
        const raw = await readFile(path.join(generationsDir, file), "utf8");
        const row = JSON.parse(raw);
        if (statuses && !statuses.includes(row.run_status)) {
          continue;
        }
        rows.push(row);
      }
      rows.sort((a, b) =>
        String(a.started_at).localeCompare(String(b.started_at)),
      );
      return rows;
    },
  };
}

/**
 * @param {string} resourcesDir
 * @returns {Promise<string[]>}
 */
async function listRunDirs(resourcesDir) {
  try {
    const entries = await readdir(resourcesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Compacts operational observations that are not required for semantic replay.
 * Never deletes semantic observations or incomplete/failure records needed for
 * absence semantics when they are the latest for a URL in a committed run.
 * @param {ObservationStore} store
 * @param {{ keepLatestUnchangedPerUrl?: boolean, olderThanIso?: string }} [policy]
 * @returns {Promise<{ removed: number }>}
 */
export async function compactOperationalObservations(store, policy = {}) {
  const generations = await store.listGenerations(["committed"]);
  const committedIds = new Set(
    generations.map((row) => row.observation_run_id),
  );
  const observations = await store.listResourceObservations({});
  /** @type {Map<string, object[]>} */
  const byKey = new Map();
  for (const row of observations) {
    if (row.retention_class !== "operational") {
      continue;
    }
    if (!committedIds.has(row.observation_run_id)) {
      continue;
    }
    if (row.outcome !== "unchanged") {
      continue;
    }
    const key = `${row.member_origin}|${row.requested_url}`;
    const list = byKey.get(key) || [];
    list.push(row);
    byKey.set(key, list);
  }
  let removed = 0;
  if (policy.keepLatestUnchangedPerUrl === false) {
    return { removed };
  }
  // Filesystem store compaction is a no-op marker for tests unless store exposes unlink.
  // Callers using createFilesystemObservationStore may pass store.root for delete.
  for (const [, list] of byKey) {
    list.sort((a, b) =>
      String(a.observed_at).localeCompare(String(b.observed_at)),
    );
    const drop = list.slice(0, Math.max(0, list.length - 1));
    for (const row of drop) {
      if (
        policy.olderThanIso &&
        String(row.observed_at) >= String(policy.olderThanIso)
      ) {
        continue;
      }
      if (typeof store.deleteResourceObservation === "function") {
        await store.deleteResourceObservation(row);
        removed += 1;
      }
    }
  }
  return { removed };
}

/**
 * Extends filesystem observation store with deletion used by compaction tests.
 * @param {string} rootDir
 * @returns {ObservationStore & { deleteResourceObservation: (row: object) => Promise<void>, rootDir: string }}
 */
export function createFilesystemObservationStoreWithCompaction(rootDir) {
  const base = createFilesystemObservationStore(rootDir);
  return {
    ...base,
    rootDir: path.resolve(rootDir),
    /**
     * @param {object} row
     * @returns {Promise<void>}
     */
    async deleteResourceObservation(row) {
      const target = path.join(
        path.resolve(rootDir),
        "resources",
        String(row.observation_run_id),
        `${String(row.observation_id)}.json`,
      );
      await unlink(target);
    },
  };
}
