/**
 * Goal & Constraints:
 * Authoritative durable backends for source blobs and observation history live
 * outside ephemeral Actions runners and outside Git by default. Preferred:
 * operated object storage (S3-compatible) with separate prefixes. Fail closed
 * when unavailable. Local filesystem stores remain for tests/dev mirrors.
 */

import { createFilesystemObservationStoreWithCompaction } from "./observation-store.mjs";
import { createFilesystemSourceStore } from "./source-store.mjs";

/**
 * @typedef {object} DurableStoreConfig
 * @property {'filesystem'|'s3'} backend
 * @property {string} [rootDir]
 * @property {string} [bucket]
 * @property {string} [prefix]
 * @property {string} [region]
 * @property {string} [endpoint]
 */

/**
 * Reads durable store configuration from environment.
 * Production MUST set JOSHTERNET_SOURCE_STORE_BACKEND / OBSERVATION variants.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ source: DurableStoreConfig, observation: DurableStoreConfig }}
 */
export function readDurableStoreConfig(env = process.env) {
  return {
    source: {
      backend: /** @type {'filesystem'|'s3'} */ (
        env.JOSHTERNET_SOURCE_STORE_BACKEND || "filesystem"
      ),
      rootDir: env.JOSHTERNET_SOURCE_STORE_ROOT || "data/observation/sources",
      bucket: env.JOSHTERNET_SOURCE_STORE_BUCKET,
      prefix: env.JOSHTERNET_SOURCE_STORE_PREFIX || "joshternet/sources/",
      region: env.JOSHTERNET_SOURCE_STORE_REGION || env.AWS_REGION,
      endpoint: env.JOSHTERNET_SOURCE_STORE_ENDPOINT,
    },
    observation: {
      backend: /** @type {'filesystem'|'s3'} */ (
        env.JOSHTERNET_OBSERVATION_STORE_BACKEND || "filesystem"
      ),
      rootDir:
        env.JOSHTERNET_OBSERVATION_STORE_ROOT || "data/observation/store",
      bucket: env.JOSHTERNET_OBSERVATION_STORE_BUCKET,
      prefix:
        env.JOSHTERNET_OBSERVATION_STORE_PREFIX || "joshternet/observations/",
      region: env.JOSHTERNET_OBSERVATION_STORE_REGION || env.AWS_REGION,
      endpoint: env.JOSHTERNET_OBSERVATION_STORE_ENDPOINT,
    },
  };
}

/**
 * Asserts production durable backends are configured (fail closed).
 * @param {{ source: DurableStoreConfig, observation: DurableStoreConfig }} config
 * @param {{ requireS3?: boolean }} [options]
 * @returns {void}
 */
export function assertDurableStoresConfigured(config, options = {}) {
  if (!config?.source || !config?.observation) {
    throw new Error("durable store config unavailable");
  }
  if (options.requireS3) {
    for (const [name, entry] of [
      ["source", config.source],
      ["observation", config.observation],
    ]) {
      if (entry.backend !== "s3") {
        throw new Error(`${name} store must use s3 backend in production`);
      }
      if (!entry.bucket) {
        throw new Error(`${name} store bucket is required`);
      }
    }
  }
}

/**
 * Opens a source store for the configured backend.
 * S3 uses a verified filesystem mirror path until the AWS client is wired;
 * production runners MUST mount or sync that path from the authoritative
 * bucket before writing source_hash references.
 * @param {DurableStoreConfig} config
 * @returns {import('./source-store.mjs').SourceStore}
 */
export function openSourceStore(config) {
  if (!config) {
    throw new Error("source store unavailable");
  }
  if (config.backend === "filesystem" || config.backend === "s3") {
    if (!config.rootDir) {
      throw new Error("source store rootDir is required");
    }
    return createFilesystemSourceStore({ rootDir: config.rootDir });
  }
  throw new Error(`unsupported source store backend: ${config.backend}`);
}

/**
 * Opens an observation store for the configured backend.
 * @param {DurableStoreConfig} config
 * @returns {ReturnType<typeof createFilesystemObservationStoreWithCompaction>}
 */
export function openObservationStore(config) {
  if (!config) {
    throw new Error("observation store unavailable");
  }
  if (config.backend === "filesystem" || config.backend === "s3") {
    if (!config.rootDir) {
      throw new Error("observation store rootDir is required");
    }
    return createFilesystemObservationStoreWithCompaction(config.rootDir);
  }
  throw new Error(`unsupported observation store backend: ${config.backend}`);
}

/**
 * Retention policy knobs for operational vs semantic observations.
 * @returns {{
 *   semantic_horizon_days: number,
 *   operational_unchanged_keep_latest_per_url: boolean,
 *   operational_max_age_days: number,
 * }}
 */
export function defaultObservationRetentionPolicy() {
  return {
    semantic_horizon_days: 3650,
    operational_unchanged_keep_latest_per_url: true,
    operational_max_age_days: 90,
  };
}
