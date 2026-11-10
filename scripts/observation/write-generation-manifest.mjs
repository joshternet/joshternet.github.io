/**
 * Goal & Constraints:
 * Writes the Git-owned generation provenance file before the atomic commit.
 * Never embeds generation_git_sha.
 *
 * Usage:
 *   OBSERVATION_RUN_ID=… BASE_GIT_SHA=… STARTED_AT=… VALIDATED_AT=… \
 *     node scripts/observation/write-generation-manifest.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildGitGenerationManifest } from "./provenance.mjs";

/**
 * Writes `_data/generation_manifest.json` for the current generation.
 * @param {object} input
 * @param {string} input.repoRoot
 * @param {string} input.observation_run_id
 * @param {string} input.started_at
 * @param {string} input.validated_at
 * @param {string} input.base_git_sha
 * @param {string} [input.registry_snapshot_id]
 * @param {string} [input.parser_schema_versions]
 * @param {string} [input.family_versions]
 * @returns {Promise<object>}
 */
export async function writeGenerationManifestFile(input) {
  const manifest = buildGitGenerationManifest(input);
  const outDir = path.join(input.repoRoot, "_data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "generation_manifest.json");
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  );
  const observationRunId =
    process.env.OBSERVATION_RUN_ID ||
    process.env.GITHUB_RUN_ID ||
    `local-${Date.now()}`;
  const now = new Date().toISOString();
  await writeGenerationManifestFile({
    repoRoot,
    observation_run_id: String(observationRunId),
    started_at: process.env.STARTED_AT || now,
    validated_at: process.env.VALIDATED_AT || now,
    base_git_sha: process.env.BASE_GIT_SHA || "",
    registry_snapshot_id: process.env.REGISTRY_SNAPSHOT_ID,
    parser_schema_versions: process.env.PARSER_SCHEMA_VERSIONS,
    family_versions: process.env.FAMILY_VERSIONS,
  });
  console.log(`wrote _data/generation_manifest.json for ${observationRunId}`);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  await main();
}
