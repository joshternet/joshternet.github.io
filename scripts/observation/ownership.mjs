/**
 * Goal & Constraints:
 * Every persistent artifact has exactly one ownership class and authorized
 * writer. CI fails undeclared paths and authored-policy files rewritten by
 * pipelines (and the reverse).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { OWNERSHIP_CLASSES } from "./constants.mjs";

/**
 * @typedef {object} OwnershipEntry
 * @property {string} pattern
 * @property {import('./constants.mjs').OwnershipClass} class
 * @property {string} writer
 * @property {string} [notes]
 */

/**
 * @param {unknown} manifest
 * @returns {OwnershipEntry[]}
 */
export function assertOwnershipManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("ownership manifest must be an object");
  }
  const entries = /** @type {{ entries?: unknown }} */ (manifest).entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("ownership manifest requires entries");
  }
  /** @type {OwnershipEntry[]} */
  const rows = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      throw new Error("ownership entry must be an object");
    }
    const pattern = String(entry.pattern || "");
    const ownershipClass = String(entry.class || "");
    const writer = String(entry.writer || "");
    if (!pattern || !writer) {
      throw new Error("ownership entry requires pattern and writer");
    }
    if (!OWNERSHIP_CLASSES.includes(/** @type {any} */ (ownershipClass))) {
      throw new Error(`unknown ownership class: ${ownershipClass}`);
    }
    rows.push({
      pattern,
      class: /** @type {import('./constants.mjs').OwnershipClass} */ (
        ownershipClass
      ),
      writer,
      notes: entry.notes ? String(entry.notes) : undefined,
    });
  }
  return rows;
}

/**
 * Converts a simple glob (`**` and `*`) to a RegExp.
 * @param {string} pattern
 * @returns {RegExp}
 */
export function ownershipPatternToRegExp(pattern) {
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{GLOBSTAR}}/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/**
 * Finds the ownership entry for a relative path.
 * @param {OwnershipEntry[]} entries
 * @param {string} relativePath
 * @returns {OwnershipEntry|null}
 */
export function matchOwnership(entries, relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  /** @type {OwnershipEntry|null} */
  let best = null;
  let bestLength = -1;
  for (const entry of entries) {
    if (ownershipPatternToRegExp(entry.pattern).test(normalized)) {
      if (entry.pattern.length > bestLength) {
        best = entry;
        bestLength = entry.pattern.length;
      }
    }
  }
  return best;
}

/**
 * Loads ownership.json from the repo.
 * @param {string} repoRoot
 * @returns {Promise<OwnershipEntry[]>}
 */
export async function loadOwnershipManifest(repoRoot) {
  const filePath = path.join(repoRoot, "data", "ownership.json");
  const raw = await readFile(filePath, "utf8");
  return assertOwnershipManifest(JSON.parse(raw));
}

/**
 * True when a writer may modify a path under the ownership model.
 * @param {OwnershipEntry[]} entries
 * @param {string} relativePath
 * @param {string} writer
 * @returns {boolean}
 */
export function writerMayModify(entries, relativePath, writer) {
  const match = matchOwnership(entries, relativePath);
  if (!match) {
    return false;
  }
  return match.writer === writer || match.writer === "any-reviewed-development";
}

/**
 * Asserts every provided path has an ownership declaration.
 * @param {OwnershipEntry[]} entries
 * @param {string[]} relativePaths
 * @returns {{ ok: boolean, undeclared: string[] }}
 */
export function auditPathsHaveOwnership(entries, relativePaths) {
  /** @type {string[]} */
  const undeclared = [];
  for (const relativePath of relativePaths) {
    if (!matchOwnership(entries, relativePath)) {
      undeclared.push(relativePath);
    }
  }
  return { ok: undeclared.length === 0, undeclared };
}
