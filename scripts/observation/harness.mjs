/**
 * Goal & Constraints:
 * Multi-family observation harness for tests and clean-room rebuilds. Fixture
 * HTML is served through the fetch broker into durable stores; adapters never
 * fetch independently. Production extract/reconcile only.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { createFilesystemObservationStoreWithCompaction } from "./observation-store.mjs";
import { runMemberObservation } from "./member-observation.mjs";
import { createFilesystemSourceStore } from "./source-store.mjs";
import {
  extractUsesFromObservation,
  processUsesObservation,
  rollupFromObservedMembers,
} from "./uses-adapter.mjs";

/**
 * @typedef {object} FixturePage
 * @property {string} origin
 * @property {string} url
 * @property {string} file
 */

/**
 * Creates a fetchImpl that returns fixture HTML for known URLs.
 * @param {Map<string, string>} bodiesByUrl
 * @returns {(url: string) => Promise<object>}
 */
export function createFixtureFetch(bodiesByUrl) {
  return async (url) => {
    const body = bodiesByUrl.get(url);
    if (body === undefined) {
      return {
        ok: false,
        status: 404,
        url,
        headers: { "content-type": "text/html" },
        body: "",
        error: new Error(`fixture missing for ${url}`),
      };
    }
    return {
      ok: true,
      status: 200,
      url,
      headers: { "content-type": "text/html; charset=utf-8" },
      body,
    };
  };
}

/**
 * Loads member fixture pages into a URL→body map.
 * @param {string} repoRoot
 * @param {FixturePage[]} pages
 * @returns {Promise<Map<string, string>>}
 */
export async function loadFixtureBodies(repoRoot, pages) {
  /** @type {Map<string, string>} */
  const bodies = new Map();
  for (const page of pages) {
    const filePath = path.isAbsolute(page.file)
      ? page.file
      : path.join(repoRoot, page.file);
    bodies.set(page.url, await readFile(filePath, "utf8"));
  }
  return bodies;
}

/**
 * Runs one coordinated member observation against fixture HTML.
 * @param {object} input
 * @param {string} input.workRoot
 * @param {string} input.member_origin
 * @param {string} input.base_git_sha
 * @param {FixturePage[]} input.pages
 * @param {string} input.repoRoot
 * @param {number} [input.maxRounds]
 * @param {((url: string) => Promise<object>)|undefined} [input.fetchImpl]
 * @returns {Promise<{
 *   generation: object,
 *   observations: object[],
 *   sourceStore: import('./source-store.mjs').SourceStore,
 *   observationStore: import('./observation-store.mjs').ObservationStore,
 * }>}
 */
export async function runFixtureMemberObservation(input) {
  const sourceStore = createFilesystemSourceStore({
    rootDir: path.join(input.workRoot, "sources"),
  });
  const observationStore = createFilesystemObservationStoreWithCompaction(
    path.join(input.workRoot, "observations"),
  );
  const bodies = await loadFixtureBodies(input.repoRoot, input.pages);
  const seed_urls = input.pages.map((page) => ({
    url: page.url,
    discovery_reason: "fixture-seed",
  }));
  const result = await runMemberObservation({
    member_origin: input.member_origin,
    base_git_sha: input.base_git_sha,
    sourceStore,
    observationStore,
    seed_urls,
    maxRounds: input.maxRounds ?? 1,
    fetchImpl: input.fetchImpl ?? createFixtureFetch(bodies),
  });
  return {
    ...result,
    sourceStore,
    observationStore,
  };
}

/**
 * End-to-end Uses path: fixture → broker → extract → reconcile → rollup.
 * @param {object} input
 * @param {string} input.workRoot
 * @param {string} input.repoRoot
 * @param {string} input.origin
 * @param {string} input.uses_url
 * @param {string} input.fixture_file
 * @param {object} input.catalog
 * @param {string} [input.base_git_sha]
 * @param {((url: string) => Promise<object>)|undefined} [input.fetchImpl]
 * @returns {Promise<{
 *   observations: object[],
 *   extracted: object,
 *   evidence: object[],
 *   member: object,
 *   summary: object,
 *   sourceStore: import('./source-store.mjs').SourceStore,
 * }>}
 */
export async function runUsesFixturePipeline(input) {
  const run = await runFixtureMemberObservation({
    workRoot: input.workRoot,
    repoRoot: input.repoRoot,
    member_origin: input.origin,
    base_git_sha: input.base_git_sha || "fixture-base",
    pages: [
      {
        origin: input.origin,
        url: input.uses_url,
        file: input.fixture_file,
      },
    ],
    fetchImpl: input.fetchImpl,
  });
  const observation = run.observations.find(
    (row) => row.outcome === "success" && row.source_hash,
  );
  if (!observation) {
    throw new Error(`no successful Uses observation for ${input.uses_url}`);
  }
  const processed = await processUsesObservation({
    sourceStore: run.sourceStore,
    observation,
    origin: input.origin,
    catalog: input.catalog,
  });
  const summary = await rollupFromObservedMembers({
    catalog: input.catalog,
    eligible_origins: [input.origin],
    members: [processed.next],
  });
  return {
    observations: run.observations,
    extracted: processed.extracted,
    evidence: processed.evidence,
    member: processed.next,
    summary,
    sourceStore: run.sourceStore,
  };
}

export { extractUsesFromObservation, processUsesObservation };
