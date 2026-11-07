/**
 * Goal & Constraints:
 * Local CPU classification only. Remote model loading is disabled before
 * the pipeline is created. Any model id other than the lock throws first.
 * Coverage-excluded: the ONNX runtime is not part of the unit-coverage run.
 */

import { readFile } from "node:fs/promises";

import { assertAllowedModel, cacheMatchesLock } from "./infer-policy.mjs";
import { hashTree } from "./prepare-model.mjs";

/**
 * Loads the allowlisted classifier from local files.
 * @param {{
 *   lockPath: string,
 *   localModelPath: string,
 *   requestedModelId?: string,
 * }} options
 * @returns {Promise<{ lock: object, classify: (text: string, labels: string[]) => Promise<object> }>}
 */
export async function loadLockedClassifier(options) {
  const lock = JSON.parse(await readFile(options.lockPath, "utf8"));
  const requested = options.requestedModelId || lock.model_id;
  assertAllowedModel(lock, requested, lock.revision);
  if (requested !== lock.model_id) {
    throw new Error(`model is not allowlisted: ${requested}`);
  }
  let cachedFiles;
  try {
    cachedFiles = await hashTree(options.localModelPath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error("uses model cache is missing");
    }
    throw error;
  }
  const check = cacheMatchesLock(lock.files, cachedFiles);
  if (!check.ok) {
    throw new Error(`uses model cache ${check.reason}`);
  }

  const { env, pipeline } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.cacheDir = options.localModelPath;
  env.localModelPath = options.localModelPath;

  const classifier = await pipeline("zero-shot-classification", lock.model_id, {
    dtype: lock.quantization || "q8",
    revision: lock.revision,
    local_files_only: true,
  });

  return {
    lock,
    /**
     * @param {string} text
     * @param {string[]} labels
     * @returns {Promise<object>}
     */
    classify(text, labels) {
      return classifier(text, labels, {
        hypothesis_template: "This text is about {}.",
        multi_label: false,
      });
    },
  };
}
