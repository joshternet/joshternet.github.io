/**
 * Goal & Constraints:
 * Persist Showcase once to both made.json and showcase.json so the alias cannot
 * drift mid-run. Authoritative projection remains Showcase; made is a stable
 * path alias only. Inputs: data directory + showcase document. Errors: IO from
 * read/write helpers. Acceptance: after write, both files deep-equal.
 */

import path from "node:path";

import { readJSONIfExists, writeJSONAtomic } from "../nlp/lib.mjs";
import { semanticallyEqual } from "../nlp/publish.mjs";

/**
 * True when two JSON values are deep-equal via stable serialization.
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
export function deepJsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Writes the same Showcase document to made.json and showcase.json together.
 * Rewrites both when either is missing, semantically stale, or the pair already
 * drifted (including timestamp-only drift).
 * @param {string} dataDir - Absolute `_data` directory.
 * @param {Record<string, unknown>} showcase - Showcase projection document.
 * @returns {Promise<{ wrote: boolean, madePath: string, showcasePath: string }>}
 */
export async function writeShowcaseAliasFiles(dataDir, showcase) {
  const madePath = path.join(dataDir, "made.json");
  const showcasePath = path.join(dataDir, "showcase.json");
  const previousMade = await readJSONIfExists(madePath, null);
  const previousShowcase = await readJSONIfExists(showcasePath, null);

  const pairDrifted =
    previousMade !== null &&
    previousShowcase !== null &&
    !deepJsonEqual(previousMade, previousShowcase);

  const contentChanged =
    !previousMade ||
    !previousShowcase ||
    !semanticallyEqual(previousMade, showcase) ||
    !semanticallyEqual(previousShowcase, showcase) ||
    pairDrifted;

  if (contentChanged) {
    await writeJSONAtomic(madePath, showcase);
    await writeJSONAtomic(showcasePath, showcase);
  }

  return { wrote: contentChanged, madePath, showcasePath };
}
