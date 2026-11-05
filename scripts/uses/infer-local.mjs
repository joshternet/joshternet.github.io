/**
 * Goal & Constraints:
 * Local CPU classification only. Remote model loading is disabled before
 * the pipeline is created. Any model id other than the lock throws first.
 * Coverage-excluded: the ONNX runtime is not part of the unit-coverage run.
 */

import { readFile } from "node:fs/promises";

import { assertAllowedModel } from "./infer-policy.mjs";

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

  const { env, pipeline } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.cacheDir = options.localModelPath;
  env.localModelPath = options.localModelPath;

  const classifier = await pipeline("zero-shot-classification", lock.model_id, {
    dtype: lock.quantization || "q8",
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
