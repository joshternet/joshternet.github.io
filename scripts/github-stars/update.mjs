/**
 * Goal & Constraints:
 * Refresh `_data/github.json` from the public GitHub repository metadata.
 * Write only when `stargazers_count` changes. Never overwrite on HTTP or
 * parse failures. No browser/CSP dependency—Actions-only.
 *
 * @example
 * node scripts/github-stars/update.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const GITHUB_REPOSITORY = "joshternet/joshternet.github.io";
export const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;
export const DEFAULT_DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../_data/github.json",
);

/**
 * @typedef {{
 *   repository: string,
 *   stars: number,
 *   updated_at: string,
 * }} GithubStarData
 */

/**
 * Reads and validates the committed GitHub star data file.
 * @param {string} filePath - Absolute path to `_data/github.json`.
 * @returns {Promise<GithubStarData>} Parsed star data.
 * @throws {Error} When the file is missing, invalid JSON, or malformed.
 */
export async function readGithubStarData(filePath) {
  const raw = await readFile(filePath, "utf8");
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${filePath}: ${message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`GitHub star data must be an object: ${filePath}`);
  }

  if (typeof parsed.stars !== "number" || !Number.isFinite(parsed.stars)) {
    throw new Error(`GitHub star data missing numeric stars: ${filePath}`);
  }

  return {
    repository:
      typeof parsed.repository === "string" && parsed.repository
        ? parsed.repository
        : GITHUB_REPOSITORY,
    stars: parsed.stars,
    updated_at:
      typeof parsed.updated_at === "string" && parsed.updated_at
        ? parsed.updated_at
        : new Date(0).toISOString(),
  };
}

/**
 * Writes GitHub star data with stable JSON formatting.
 * @param {string} filePath - Absolute path to `_data/github.json`.
 * @param {GithubStarData} data - Star data to persist.
 * @returns {Promise<void>}
 */
export async function writeGithubStarData(filePath, data) {
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(filePath, payload, "utf8");
}

/**
 * Fetches `stargazers_count` from the GitHub repository API.
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   token?: string,
 *   apiUrl?: string,
 * }} [options]
 * @returns {Promise<number>} Current stargazer count.
 * @throws {Error} When the response is unavailable or malformed.
 */
export async function fetchStargazersCount(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const token = options.token || process.env.GITHUB_TOKEN || "";
  const apiUrl = options.apiUrl || GITHUB_API_URL;

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available");
  }

  /** @type {Record<string, string>} */
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "joshternet-github-stars-update",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchImpl(apiUrl, { headers });

  if (!response || typeof response.ok !== "boolean") {
    throw new Error("GitHub API returned an unusable response");
  }

  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}`);
  }

  let body;

  try {
    body = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GitHub API returned invalid JSON: ${message}`);
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof body.stargazers_count !== "number" ||
    !Number.isFinite(body.stargazers_count)
  ) {
    throw new Error("GitHub API response missing numeric stargazers_count");
  }

  return body.stargazers_count;
}

/**
 * Updates `_data/github.json` when the live star count differs.
 * @param {{
 *   dataPath?: string,
 *   fetchImpl?: typeof fetch,
 *   token?: string,
 *   apiUrl?: string,
 *   now?: () => Date,
 * }} [options]
 * @returns {Promise<{ changed: boolean, stars: number }>}
 */
export async function updateGithubStars(options = {}) {
  const dataPath = options.dataPath || DEFAULT_DATA_PATH;
  const current = await readGithubStarData(dataPath);
  const stars = await fetchStargazersCount({
    fetchImpl: options.fetchImpl,
    token: options.token,
    apiUrl: options.apiUrl,
  });

  if (stars === current.stars) {
    return { changed: false, stars };
  }

  const now = options.now ? options.now() : new Date();

  await writeGithubStarData(dataPath, {
    repository: GITHUB_REPOSITORY,
    stars,
    updated_at: now.toISOString(),
  });

  return { changed: true, stars };
}

/**
 * CLI entry: refresh star count and print whether a write occurred.
 * @returns {Promise<void>}
 */
async function main() {
  const result = await updateGithubStars();

  if (result.changed) {
    process.stdout.write(`Updated GitHub star count to ${result.stars}.\n`);
    return;
  }

  process.stdout.write(
    `GitHub star count unchanged (${result.stars}); no write.\n`,
  );
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
