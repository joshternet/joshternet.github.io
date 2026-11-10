/**
 * Goal & Constraints:
 * CI ownership guard. Fails on undeclared dataset paths and on observational /
 * reconstructed / derived edits outside the authorized writer (when provided).
 *
 * Usage:
 *   node scripts/observation/check-ownership.mjs [--writer=scripts/uses/build.mjs] path [path...]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertOwnershipManifest,
  auditPathsHaveOwnership,
  loadOwnershipManifest,
  matchOwnership,
  writerMayModify,
} from "./ownership.mjs";

/**
 * Parses CLI argv into writer + relative paths.
 * @param {string[]} argv
 * @returns {{ writer: string|null, paths: string[] }}
 */
export function parseOwnershipCheckArgs(argv) {
  /** @type {string|null} */
  let writer = null;
  /** @type {string[]} */
  const paths = [];
  for (const arg of argv) {
    if (arg.startsWith("--writer=")) {
      writer = arg.slice("--writer=".length);
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    paths.push(arg.replace(/\\/g, "/"));
  }
  return { writer, paths };
}

/**
 * Runs ownership audit for the provided relative paths.
 * @param {object} input
 * @param {string} input.repoRoot
 * @param {string[]} input.paths
 * @param {string|null} [input.writer]
 * @returns {Promise<{ ok: boolean, undeclared: string[], unauthorized: string[] }>}
 */
export async function runOwnershipCheck(input) {
  const entries = await loadOwnershipManifest(input.repoRoot);
  assertOwnershipManifest({ entries });
  const audit = auditPathsHaveOwnership(entries, input.paths);
  /** @type {string[]} */
  const unauthorized = [];
  if (input.writer) {
    for (const relative of input.paths) {
      const entry = matchOwnership(entries, relative);
      if (!entry) {
        continue;
      }
      if (
        entry.class !== "authored-policy" &&
        !writerMayModify(entries, relative, input.writer)
      ) {
        unauthorized.push(relative);
      }
    }
  }
  return {
    ok: audit.ok && unauthorized.length === 0,
    undeclared: audit.undeclared,
    unauthorized,
  };
}

/**
 * CLI entry.
 * @returns {Promise<void>}
 */
async function main() {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  );
  const { writer, paths } = parseOwnershipCheckArgs(process.argv.slice(2));
  if (paths.length === 0) {
    console.error("usage: check-ownership.mjs [--writer=…] path [path…]");
    process.exitCode = 2;
    return;
  }
  const result = await runOwnershipCheck({ repoRoot, paths, writer });
  if (!result.ok) {
    if (result.undeclared.length) {
      console.error(
        `undeclared ownership paths:\n${result.undeclared.join("\n")}`,
      );
    }
    if (result.unauthorized.length) {
      console.error(
        `unauthorized writer for paths:\n${result.unauthorized.join("\n")}`,
      );
    }
    process.exitCode = 1;
    return;
  }
  console.log(`ownership ok for ${paths.length} path(s)`);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  await main();
}
