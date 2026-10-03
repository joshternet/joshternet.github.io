/**
 * Goal & Constraints:
 * Semantic hashing so timestamp-only rebuilds do not churn committed artifacts.
 * Previous snapshots may supply first_seen_at only—never semantic evidence.
 */

import crypto from "node:crypto";

const TIMESTAMP_KEYS = new Set([
  "generated_at",
  "crawled_at",
  "observed_at",
  "last_checked_at",
  "last_attempt_at",
  "last_success_at",
  "verified_at",
  // Lifecycle fields follow membership semantics (hashed via sites[]); strip so
  // carry-forward of first_seen_at / last_changed_at cannot churn alone.
  "first_seen_at",
  "last_changed_at",
  "stale_since",
]);

/**
 * Deep-clones JSON removing operational timestamp fields for hashing.
 * @param {unknown} value
 * @returns {unknown}
 */
export function stripOperationalTimestamps(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripOperationalTimestamps(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  /** @type {Record<string, unknown>} */
  const out = {};

  for (const [key, nested] of Object.entries(value)) {
    if (TIMESTAMP_KEYS.has(key)) {
      continue;
    }

    out[key] = stripOperationalTimestamps(nested);
  }

  return out;
}

/**
 * Stable JSON stringify with sorted object keys.
 * @param {unknown} value
 * @returns {string}
 */
export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

/**
 * SHA-256 semantic hash of a dataset (timestamps stripped).
 * @param {unknown} value
 * @returns {string}
 */
export function semanticHash(value) {
  const payload = stableStringify(stripOperationalTimestamps(value));
  return `sha256:${crypto.createHash("sha256").update(payload).digest("hex")}`;
}

/**
 * True when two dataset documents match aside from operational timestamps.
 * @param {unknown} previous
 * @param {unknown} next
 * @returns {boolean}
 */
export function semanticallyEqual(previous, next) {
  return semanticHash(previous) === semanticHash(next);
}

/**
 * Whether public artifacts should be rewritten.
 * @param {string | undefined} previousHash
 * @param {string} nextHash
 * @returns {boolean}
 */
export function shouldPublishSemanticChange(previousHash, nextHash) {
  return !previousHash || previousHash !== nextHash;
}

/**
 * Builds data_manifest.json document.
 * @param {{
 *   generatedAt: string,
 *   hashes: Record<string, string>,
 * }} input
 * @returns {Record<string, unknown>}
 */
export function buildDataManifest(input) {
  return {
    schema_version: 1,
    generated_at: input.generatedAt,
    datasets: {
      network: 1,
      site_signals: 1,
      content: 1,
      topics: 1,
      connections: 1,
      blogrolls: 1,
      mentions: 1,
    },
    extractors: {
      html: 1,
      topics: 1,
      relationships: 1,
      feeds: 1,
    },
    schemas: {
      network: "https://joshternet.org/schemas/network.schema.json",
      site_signals: "https://joshternet.org/schemas/site-signals.schema.json",
      content: "https://joshternet.org/schemas/content.schema.json",
      topics: "https://joshternet.org/schemas/topics.schema.json",
      connections: "https://joshternet.org/schemas/connections.schema.json",
      blogrolls: "https://joshternet.org/schemas/blogrolls.schema.json",
      mentions: "https://joshternet.org/schemas/mentions.schema.json",
      data_manifest: "https://joshternet.org/schemas/data-manifest.schema.json",
    },
    semantic_hashes: input.hashes,
  };
}
