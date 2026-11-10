/**
 * Goal & Constraints:
 * Download the locked ONNX model once, then refuse any other id. Weights stay
 * in .tmp/models and are never committed. Coverage-excluded.
 * Transformers.js caches pinned revisions under modelId/<revision>/…; the lock
 * and localModelPath expect modelId/…. Promote after download (and before
 * re-download) so cold CI matches the lock.
 */

import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { cacheMatchesLock } from "./infer-policy.mjs";

export const MODEL_CACHE = path.resolve(".tmp/models");
export const LOCK_PATH = path.resolve("data/classification/model-lock.json");

/**
 * @param {string} dir
 * @param {string[]} [files]
 * @returns {Promise<string[]>}
 */
async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

/**
 * @param {string} dir
 * @returns {Promise<Array<{ path: string, sha256: string }>>}
 */
export async function hashTree(dir) {
  const files = (await walk(dir)).sort();
  const records = [];
  for (const file of files) {
    const bytes = await readFile(file);
    records.push({
      path: path.relative(dir, file).split(path.sep).join("/"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return records;
}

/**
 * Hub FileCache key for a non-main revision: modelId/<revision>/<rest>.
 * @param {string} lockPath Relative lock path (modelId/…).
 * @param {string} modelId
 * @param {string} revision
 * @returns {string} Prefixed path, or empty when promotion does not apply.
 */
export function revisionPrefixedPath(lockPath, modelId, revision) {
  const rel = String(lockPath || "");
  const id = String(modelId || "");
  const rev = String(revision || "").trim();
  if (!rel || !id || !rev || rev === "main") {
    return "";
  }
  const prefix = `${id}/`;
  if (!rel.startsWith(prefix)) {
    return "";
  }
  return `${id}/${rev}/${rel.slice(prefix.length)}`;
}

/**
 * Move Hub revision-prefixed files into the flat lock layout when needed.
 * @param {string} cacheDir
 * @param {{ model_id?: string, revision?: string, files?: Array<{ path?: string }> }} lock
 * @returns {Promise<boolean>} True when at least one file was moved.
 */
export async function promoteRevisionCache(cacheDir, lock) {
  const modelId = typeof lock?.model_id === "string" ? lock.model_id : "";
  const revision =
    typeof lock?.revision === "string" ? lock.revision.trim() : "";
  if (!modelId || !revision || revision === "main") {
    return false;
  }
  let moved = false;
  for (const row of lock?.files || []) {
    const destRel = typeof row?.path === "string" ? row.path : "";
    if (!destRel) {
      continue;
    }
    const srcRel = revisionPrefixedPath(destRel, modelId, revision);
    if (!srcRel) {
      continue;
    }
    const dest = path.join(cacheDir, ...destRel.split("/"));
    const src = path.join(cacheDir, ...srcRel.split("/"));
    try {
      await access(dest);
      continue;
    } catch {
      // Dest missing; try promoting from the revision-prefixed Hub path.
    }
    try {
      await access(src);
    } catch {
      continue;
    }
    await mkdir(path.dirname(dest), { recursive: true });
    await rename(src, dest);
    moved = true;
  }
  return moved;
}

/**
 * @param {string} cacheDir
 * @returns {Promise<Array<{ path: string, sha256: string }>>}
 */
async function hashTreeOrEmpty(cacheDir) {
  try {
    return await hashTree(cacheDir);
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
    return [];
  }
}

/**
 * Downloads the allowlisted model into the local cache.
 * @param {{ writeLock?: boolean }} [options]
 * @returns {Promise<{ revision: string, files: Array<{ path: string, sha256: string }>, downloaded: boolean }>}
 */
export async function prepareLockedModel(options = {}) {
  const lock = JSON.parse(await readFile(LOCK_PATH, "utf8"));
  if (lock.model_id !== "Xenova/nli-deberta-v3-xsmall") {
    throw new Error(`model is not allowlisted: ${lock.model_id}`);
  }
  /** @type {Array<{ path: string, sha256: string }>} */
  let files = await hashTreeOrEmpty(MODEL_CACHE);
  let cached = cacheMatchesLock(lock.files, files);
  if (!cached.ok) {
    await promoteRevisionCache(MODEL_CACHE, lock);
    files = await hashTreeOrEmpty(MODEL_CACHE);
    cached = cacheMatchesLock(lock.files, files);
  }
  if (cached.ok && !options.writeLock) {
    return { revision: lock.revision, files, downloaded: false };
  }
  const { env, pipeline } = await import("@huggingface/transformers");
  env.cacheDir = MODEL_CACHE;
  env.localModelPath = MODEL_CACHE;
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  await pipeline("zero-shot-classification", lock.model_id, {
    dtype: lock.quantization || "q8",
    revision: lock.revision,
  });
  await promoteRevisionCache(MODEL_CACHE, lock);
  files = await hashTree(MODEL_CACHE);
  const check = cacheMatchesLock(lock.files, files);
  if (!check.ok && !options.writeLock) {
    throw new Error(`uses model cache ${check.reason}`);
  }
  if (options.writeLock) {
    lock.files = files;
    await writeFile(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
  }
  return { revision: lock.revision, files, downloaded: true };
}

const writeLock = process.argv.includes("--write-lock");
if (process.argv[1] && process.argv[1].endsWith("prepare-model.mjs")) {
  prepareLockedModel({ writeLock })
    .then((result) => {
      process.stdout.write(
        `prepared ${result.files.length} files revision ${result.revision}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : error}\n`,
      );
      process.exitCode = 1;
    });
}
