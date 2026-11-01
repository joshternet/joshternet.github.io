/**
 * Goal & Constraints:
 * Format sync-generated text the way CI `format:check` expects. Mid-harvest
 * writers soft-skip Prettier errors so one bad file cannot abort a crawl.
 * CLI `format:data` and publish gates use strict mode so unformatted output
 * never ships.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import prettier from "prettier";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Globs/files written by network/nlp/views sync that Prettier may check. */
export const GENERATED_PRETTIER_GLOBS = [
  "_data/*.json",
  "assets/network/*.opml",
  "assets/activity/*.xml",
  "assets/css/elsewhere-glyphs.css",
];

/**
 * Resolves simple `dir/*.ext` globs and concrete relative paths under root.
 * Missing or unreadable paths yield no entries (never throw).
 * @param {string} root
 * @param {string[]} patterns
 * @returns {Promise<string[]>} Absolute file paths, sorted.
 */
export async function resolveGeneratedPaths(root, patterns) {
  /** @type {Set<string>} */
  const found = new Set();

  for (const pattern of patterns) {
    if (!pattern.includes("*")) {
      const absolute = path.resolve(root, pattern);
      try {
        const stat = await fs.stat(absolute);
        if (stat.isFile()) {
          found.add(absolute);
        }
      } catch {
        // Missing or unreadable — skip so sync/publish still proceeds.
      }
      continue;
    }

    const slash = pattern.lastIndexOf("/");
    const dirPart = slash === -1 ? "." : pattern.slice(0, slash);
    const namePart = slash === -1 ? pattern : pattern.slice(slash + 1);

    if (!namePart.startsWith("*.")) {
      throw new Error(
        `Unsupported generated Prettier glob (use dir/*.ext or a file): ${pattern}`,
      );
    }

    const extension = namePart.slice(1); // e.g. ".json"
    const absoluteDir = path.resolve(root, dirPart);

    let entries;
    try {
      entries = await fs.readdir(absoluteDir);
    } catch {
      continue;
    }

    for (const name of entries) {
      if (!name.endsWith(extension) || name.startsWith(".")) {
        continue;
      }
      found.add(path.join(absoluteDir, name));
    }
  }

  return [...found].sort();
}

/**
 * Formats text with the repo Prettier config when the path is supported.
 * Soft mode (default): on Prettier errors, returns the original text.
 * Strict mode: rethrows so CLI/publish gates fail closed.
 * @param {string} filePath
 * @param {string} text
 * @param {{
 *   root?: string,
 *   strict?: boolean,
 *   prettierApi?: {
 *     getFileInfo: typeof prettier.getFileInfo,
 *     resolveConfig: typeof prettier.resolveConfig,
 *     format: typeof prettier.format,
 *   },
 * }} [options]
 * @returns {Promise<string>}
 */
export async function formatTextForPath(filePath, text, options = {}) {
  const root =
    typeof options.root === "string" && options.root ? options.root : REPO_ROOT;
  const strict = options.strict === true;
  const prettierApi = options.prettierApi || prettier;
  const absolute = path.resolve(filePath);
  const ignorePath = path.join(root, ".prettierignore");

  let fileInfo;
  try {
    fileInfo = await prettierApi.getFileInfo(absolute, {
      ignorePath,
      resolveConfig: true,
    });
  } catch (error) {
    if (strict) {
      throw error;
    }

    process.stderr.write(
      `prettier getFileInfo skipped ${absolute}: ${error}\n`,
    );
    return text;
  }

  if (fileInfo.ignored || !fileInfo.inferredParser) {
    return text;
  }

  let config;
  try {
    config =
      (await prettierApi.resolveConfig(absolute)) ||
      (await prettierApi.resolveConfig(path.join(root, "package.json")));
  } catch (error) {
    if (strict) {
      throw error;
    }

    process.stderr.write(
      `prettier resolveConfig skipped ${absolute}: ${error}\n`,
    );
    return text;
  }

  try {
    return await prettierApi.format(text, {
      ...config,
      filepath: absolute,
      parser: fileInfo.inferredParser,
    });
  } catch (error) {
    if (strict) {
      throw error;
    }

    process.stderr.write(`prettier format skipped ${absolute}: ${error}\n`);
    return text;
  }
}

/**
 * Formats generated sync outputs in place via the Prettier API.
 * Missing paths are skipped. Soft mode leaves failed files unchanged; strict
 * mode aggregates failures and throws after attempting all paths.
 * @param {{
 *   root?: string,
 *   globs?: string[],
 *   strict?: boolean,
 *   prettierApi?: {
 *     getFileInfo: typeof prettier.getFileInfo,
 *     resolveConfig: typeof prettier.resolveConfig,
 *     format: typeof prettier.format,
 *   },
 * }} [options]
 * @returns {Promise<void>}
 */
export async function formatGeneratedOutputs(options = {}) {
  const root =
    typeof options.root === "string" && options.root ? options.root : REPO_ROOT;
  const strict = options.strict === true;
  const globs =
    Array.isArray(options.globs) && options.globs.length > 0
      ? options.globs
      : GENERATED_PRETTIER_GLOBS;

  const paths = await resolveGeneratedPaths(root, globs);
  /** @type {string[]} */
  const failures = [];

  for (const filePath of paths) {
    const text = await fs.readFile(filePath, "utf8");

    if (!strict) {
      const formatted = await formatTextForPath(filePath, text, {
        root,
        prettierApi: options.prettierApi,
      });
      if (formatted !== text) {
        await fs.writeFile(filePath, formatted, "utf8");
      }
      continue;
    }

    try {
      const formatted = await formatTextForPath(filePath, text, {
        root,
        strict: true,
        prettierApi: options.prettierApi,
      });
      if (formatted !== text) {
        await fs.writeFile(filePath, formatted, "utf8");
      }
    } catch (error) {
      failures.push(
        `${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Prettier failed on ${failures.length} generated file(s):\n${failures.join("\n")}`,
    );
  }
}
