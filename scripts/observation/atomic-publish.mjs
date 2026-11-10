/**
 * Goal & Constraints:
 * Stage ALL Git-owned generated outputs into one generation commit with
 * observation-run provenance; push only when base SHA still matches. Source
 * blobs and observation ledgers stay in durable stores—not Git.
 */

import { buildGitGenerationManifest } from "./provenance.mjs";

/**
 * Paths that must never enter a generation commit.
 * @type {readonly string[]}
 */
export const FORBIDDEN_GENERATION_PATH_PREFIXES = Object.freeze([
  "data/observation/store/",
  "data/observation/sources/",
  ".tmp/",
  "node_modules/",
]);

/**
 * Asserts staged paths are allowed in a generation commit.
 * @param {string[]} relativePaths
 * @returns {{ ok: boolean, forbidden: string[] }}
 */
export function assertGenerationCommitPaths(relativePaths) {
  /** @type {string[]} */
  const forbidden = [];
  for (const relative of relativePaths || []) {
    const normalized = String(relative || "").replace(/\\/g, "/");
    for (const prefix of FORBIDDEN_GENERATION_PATH_PREFIXES) {
      if (normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)) {
        forbidden.push(normalized);
      }
    }
  }
  return { ok: forbidden.length === 0, forbidden };
}

/**
 * Builds the Git-owned generation provenance payload for staging.
 * @param {object} input
 * @param {string} input.observation_run_id
 * @param {string} input.started_at
 * @param {string} input.validated_at
 * @param {string} input.base_git_sha
 * @param {string} [input.registry_snapshot_id]
 * @param {string} [input.parser_versions]
 * @param {string} [input.schema_versions]
 * @param {string} [input.family_versions]
 * @returns {object}
 */
export function stageGenerationProvenance(input) {
  return buildGitGenerationManifest(input);
}

/**
 * Ensures the working base still matches the generation base before push.
 * @param {string} expectedBaseSha
 * @param {string} currentBaseSha
 * @returns {{ ok: boolean, reason?: string }}
 */
export function assertBaseShaUnchanged(expectedBaseSha, currentBaseSha) {
  if (!expectedBaseSha || !currentBaseSha) {
    return { ok: false, reason: "missing-base-sha" };
  }
  if (String(expectedBaseSha) !== String(currentBaseSha)) {
    return { ok: false, reason: "base-sha-changed" };
  }
  return { ok: true };
}

/**
 * Conventional generation commit subject/body (no self-referential SHA).
 * @param {object} manifest
 * @returns {{ subject: string, body: string }}
 */
export function generationCommitMessage(manifest) {
  const runId = String(manifest?.observation_run_id || "unknown");
  return {
    subject: `chore(observation): publish generation ${runId}`,
    body: [
      `observation_run_id: ${runId}`,
      `run_status_at_build: ${manifest?.run_status_at_build || "validated"}`,
      `base_git_sha: ${manifest?.base_git_sha || ""}`,
      "",
      "Durable source blobs and observation ledgers remain outside Git.",
    ].join("\n"),
  };
}

/**
 * True when a workflow may publish (not dry/read-only).
 * @param {{ dry_run?: boolean, read_only?: boolean }} flags
 * @returns {boolean}
 */
export function mayPublishGeneration(flags = {}) {
  return !flags.dry_run && !flags.read_only;
}
