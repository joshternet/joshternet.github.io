/**
 * Goal: Star-count updater writes only on change and fail-closes on bad API
 * responses. fetch is mocked as an external boundary only.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  GITHUB_REPOSITORY,
  fetchStargazersCount,
  readGithubStarData,
  updateGithubStars,
  writeGithubStarData,
} from "../../scripts/github-stars/update.mjs";

/**
 * Builds a temporary `_data/github.json` path with seed contents.
 * @param {object} seed
 * @returns {Promise<{ dir: string, filePath: string }>}
 */
async function withSeedFile(seed) {
  const dir = await mkdtemp(path.join(tmpdir(), "joshternet-github-stars-"));
  const filePath = path.join(dir, "github.json");
  await writeFile(filePath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  return { dir, filePath };
}

/**
 * Mock fetch justified as the external GitHub API boundary.
 * @param {unknown} body
 * @param {{ ok?: boolean, status?: number, jsonThrows?: boolean }} [options]
 * @returns {typeof fetch}
 */
function mockFetch(body, options = {}) {
  return async () => {
    if (options.jsonThrows) {
      return {
        ok: options.ok !== false,
        status: options.status ?? 200,
        async json() {
          throw new Error("boom");
        },
      };
    }

    return {
      ok: options.ok !== false,
      status: options.status ?? 200,
      async json() {
        return body;
      },
    };
  };
}

test("fetchStargazersCount returns a numeric count", async () => {
  const count = await fetchStargazersCount({
    // External boundary: GitHub REST API.
    fetchImpl: mockFetch({ stargazers_count: 12 }),
    token: "test-token",
  });

  assert.equal(count, 12);
});

test("fetchStargazersCount rejects HTTP and malformed payloads", async () => {
  await assert.rejects(
    () =>
      fetchStargazersCount({
        // External boundary: GitHub REST API.
        fetchImpl: mockFetch({}, { ok: false, status: 503 }),
      }),
    /status 503/,
  );

  await assert.rejects(
    () =>
      fetchStargazersCount({
        // External boundary: GitHub REST API.
        fetchImpl: mockFetch({ stargazers_count: "nope" }),
      }),
    /stargazers_count/,
  );

  await assert.rejects(
    () =>
      fetchStargazersCount({
        // External boundary: GitHub REST API.
        fetchImpl: mockFetch({}, { jsonThrows: true }),
      }),
    /invalid JSON/,
  );
});

test("updateGithubStars leaves the file untouched when unchanged", async () => {
  const { dir, filePath } = await withSeedFile({
    repository: GITHUB_REPOSITORY,
    stars: 3,
    updated_at: "2026-11-08T00:00:00Z",
  });

  try {
    const before = await readFile(filePath, "utf8");
    const result = await updateGithubStars({
      dataPath: filePath,
      // External boundary: GitHub REST API.
      fetchImpl: mockFetch({ stargazers_count: 3 }),
    });

    assert.deepEqual(result, { changed: false, stars: 3 });
    assert.equal(await readFile(filePath, "utf8"), before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("updateGithubStars rewrites the file when the count changes", async () => {
  const { dir, filePath } = await withSeedFile({
    repository: GITHUB_REPOSITORY,
    stars: 0,
    updated_at: "2026-11-08T00:00:00Z",
  });

  try {
    const result = await updateGithubStars({
      dataPath: filePath,
      // External boundary: GitHub REST API.
      fetchImpl: mockFetch({ stargazers_count: 7 }),
      now: () => new Date("2026-11-09T12:00:00.000Z"),
    });

    assert.deepEqual(result, { changed: true, stars: 7 });

    const written = await readGithubStarData(filePath);
    assert.deepEqual(written, {
      repository: GITHUB_REPOSITORY,
      stars: 7,
      updated_at: "2026-11-09T12:00:00.000Z",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("updateGithubStars does not overwrite on API failure", async () => {
  const { dir, filePath } = await withSeedFile({
    repository: GITHUB_REPOSITORY,
    stars: 4,
    updated_at: "2026-11-08T00:00:00Z",
  });

  try {
    const before = await readFile(filePath, "utf8");

    await assert.rejects(
      () =>
        updateGithubStars({
          dataPath: filePath,
          // External boundary: GitHub REST API.
          fetchImpl: mockFetch({}, { ok: false, status: 500 }),
        }),
      /status 500/,
    );

    assert.equal(await readFile(filePath, "utf8"), before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeGithubStarData round-trips through readGithubStarData", async () => {
  const { dir, filePath } = await withSeedFile({
    repository: GITHUB_REPOSITORY,
    stars: 1,
    updated_at: "2026-11-08T00:00:00Z",
  });

  try {
    await writeGithubStarData(filePath, {
      repository: GITHUB_REPOSITORY,
      stars: 9,
      updated_at: "2026-11-10T01:02:03.000Z",
    });

    assert.deepEqual(await readGithubStarData(filePath), {
      repository: GITHUB_REPOSITORY,
      stars: 9,
      updated_at: "2026-11-10T01:02:03.000Z",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
