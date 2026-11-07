/**
 * Goal & Constraints:
 * Download the locked ONNX model once, then refuse any other id. Weights stay
 * in .tmp/models and are never committed. Coverage-excluded.
 */

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
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
 * Downloads the allowlisted model into the local cache.
 * @param {{ writeLock?: boolean }} [options]
 * @returns {Promise<{ revision: string, files: Array<{ path: string, sha256: string }> }>}
 */
export async function prepareLockedModel(options = {}) {
  const lock = JSON.parse(await readFile(LOCK_PATH, "utf8"));
  if (lock.model_id !== "Xenova/nli-deberta-v3-xsmall") {
    throw new Error(`model is not allowlisted: ${lock.model_id}`);
  }
  /** @type {Array<{ path: string, sha256: string }>} */
  let files = [];
  try {
    files = await hashTree(MODEL_CACHE);
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }
  const cached = cacheMatchesLock(lock.files, files);
  if (cached.ok && !options.writeLock) {
    return { revision: lock.revision, files, downloaded: false };
  }
  const { env, pipeline } = await import("@huggingface/transformers");
  env.cacheDir = MODEL_CACHE;
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  await pipeline("zero-shot-classification", lock.model_id, {
    dtype: lock.quantization || "q8",
    revision: lock.revision,
  });
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
