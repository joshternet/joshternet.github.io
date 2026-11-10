/**
 * Goal: Observation platform contracts—family registry, fetch broker, durable
 * stores, generation lifecycle, provenance, completeness, ownership.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertContentFamilyContract,
  assertOwnershipManifest,
  assertSourceBlobReady,
  auditPathsHaveOwnership,
  bookIdentityKey,
  booksMustRemainSeparate,
  buildGitGenerationManifest,
  assertBaseShaUnchanged,
  assertDurableStoresConfigured,
  assertGenerationCommitPaths,
  clearContentFamilyRegistry,
  clearRepresentationMigrations,
  compactOperationalObservations,
  createArticlesAbsencePolicy,
  createFetchBroker,
  createFilesystemObservationStoreWithCompaction,
  createFilesystemSourceStore,
  createResourceObservation,
  decideValidatedUncommittedFate,
  defaultObservationRetentionPolicy,
  evaluateVerifiedAbsence,
  generationCommitMessage,
  getOpenWebEvidenceMechanism,
  groupBySemanticIdentity,
  hashSourceBody,
  listContentFamilies,
  loadOwnershipManifest,
  markGenerationAborted,
  markGenerationCommitted,
  markGenerationValidated,
  matchOwnership,
  mayMutatePublisherContentRecords,
  mayPublishGeneration,
  memberIdentityKey,
  membershipTransitions,
  migrateObservationRepresentation,
  OPEN_WEB_EVIDENCE_MECHANISMS,
  parseOwnershipCheckArgs,
  publicationIdentityKey,
  readDurableStoreConfig,
  recordSuccessfulGenerationPush,
  registerDefaultContentFamilies,
  registerDefaultUsesMigrations,
  registerRepresentationMigration,
  runIterativeDiscovery,
  runMemberObservation,
  runOwnershipCheck,
  runUsesFixturePipeline,
  selectCandidateObservations,
  selectPublishedGenerations,
  selectPublishedObservations,
  stageGenerationProvenance,
  startObservationGeneration,
  validateCanonicalRegistry,
  verifyGenerationProvenance,
  verifyProvenanceAgainstCommit,
  writerMayModify,
} from "../../scripts/observation/index.mjs";
import { classifyClaim } from "../../scripts/uses/classify.mjs";
import { extractUsesFromHtml } from "../../scripts/uses/extract.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

test("content family contracts register with required policies", () => {
  clearContentFamilyRegistry();
  registerDefaultContentFamilies({ replace: true });
  const families = listContentFamilies();
  assert.equal(families.length, 8);
  for (const family of families) {
    assertContentFamilyContract(family);
  }
  assert.ok(families.some((family) => family.id === "now"));
  assert.ok(families.some((family) => family.id === "reading"));
  assert.equal(
    families.find((family) => family.id === "seeking")?.freshnessPolicy,
    "timestamp-and-successful-verification",
  );
});

test("resource observations record failed outcomes without implying absence", () => {
  const observation = createResourceObservation({
    observation_run_id: "run-1",
    member_origin: "https://joshua.example",
    requested_url: "https://joshua.example/now/",
    outcome: "timeout",
    failure_reason: "abort",
    coverage: "incomplete",
  });
  assert.equal(observation.outcome, "timeout");
  assert.equal(observation.schema.includes("resource-observation"), true);
  const policy = createArticlesAbsencePolicy();
  const decision = evaluateVerifiedAbsence(policy, [observation]);
  assert.equal(decision.may_remove, false);
});

test("source store persists verified blobs and refuses GC of referenced hashes", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "josh-src-"));
  try {
    const store = createFilesystemSourceStore({ rootDir: dir });
    const hash = hashSourceBody("hello printers");
    const put = await store.put("hello printers");
    assert.equal(put.source_hash, hash);
    await assertSourceBlobReady(store, hash);
    await store.put("hello printers");
    const gc = await store.garbageCollect([hash]);
    assert.equal(gc.deleted, 0);
    assert.equal(await store.has(hash), true);
    const orphan = await store.put("orphan body");
    const gc2 = await store.garbageCollect([hash]);
    assert.equal(gc2.deleted, 1);
    assert.equal(await store.has(orphan.source_hash), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("fetch broker dedupes URLs and retains bodies before source_hash", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "josh-obs-"));
  try {
    const sourceStore = createFilesystemSourceStore({
      rootDir: path.join(root, "src"),
    });
    const observationStore = createFilesystemObservationStoreWithCompaction(
      path.join(root, "obs"),
    );
    const generation = await startObservationGeneration(observationStore, {
      observation_run_id: "run-dedupe",
      base_git_sha: "abc",
    });
    const bodies = new Map([
      ["https://joshua.example/uses/", "<html>FLSUN QQ-S Pro</html>"],
      ["https://joshua.example/reading/", "<html>reading</html>"],
    ]);
    let fetches = 0;
    const broker = createFetchBroker({
      observation_run_id: generation.observation_run_id,
      member_origin: "https://joshua.example",
      sourceStore,
      observationStore,
      fetchImpl: async (url) => {
        fetches += 1;
        return {
          ok: true,
          status: 200,
          url,
          headers: { "content-type": "text/html" },
          body: bodies.get(url) || "",
        };
      },
    });
    broker.request({ url: "https://joshua.example/uses/" });
    broker.request({ url: "https://joshua.example/uses/" });
    broker.request({ url: "https://joshua.example/reading/" });
    await broker.drain();
    assert.equal(fetches, 2);
    const uses = broker.get("https://joshua.example/uses/");
    assert.equal(uses.outcome, "success");
    assert.ok(uses.source_hash);
    await assertSourceBlobReady(sourceStore, uses.source_hash);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("iterative discovery continues until idle and budget exhaustion is incomplete", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "josh-iter-"));
  try {
    const sourceStore = createFilesystemSourceStore({
      rootDir: path.join(root, "src"),
    });
    const observationStore = createFilesystemObservationStoreWithCompaction(
      path.join(root, "obs"),
    );
    await startObservationGeneration(observationStore, {
      observation_run_id: "run-iter",
      base_git_sha: "abc",
    });
    const broker = createFetchBroker({
      observation_run_id: "run-iter",
      member_origin: "https://joshua.example",
      sourceStore,
      observationStore,
      maxFetches: 2,
      fetchImpl: async (url) => ({
        ok: true,
        status: 200,
        url,
        headers: { "content-type": "text/html" },
        body: `<html>${url}</html>`,
      }),
    });
    broker.request({ url: "https://joshua.example/" });
    await broker.drain();
    const result = await runIterativeDiscovery({
      broker,
      maxRounds: 5,
      adapters: [
        {
          id: "seed-child",
          async discover({ broker: active, observations, round }) {
            if (
              round === 1 &&
              observations.some((row) => row.outcome === "success")
            ) {
              active.request({ url: "https://joshua.example/reading/" });
              active.request({ url: "https://joshua.example/now/" });
            }
          },
        },
      ],
    });
    assert.equal(result.budget_exhausted, true);
    assert.ok(
      result.observations.some((row) => row.outcome === "budget_exhausted"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generation lifecycle: validated is candidate; committed only after push SHA", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "josh-life-"));
  try {
    const store = createFilesystemObservationStoreWithCompaction(root);
    const generation = await startObservationGeneration(store, {
      observation_run_id: "run-life",
      base_git_sha: "base1",
    });
    assert.equal(generation.run_status, "collecting");
    const validated = await markGenerationValidated(store, "run-life");
    assert.equal(validated.run_status, "validated");
    assert.equal(validated.generation_git_sha, undefined);
    await assert.rejects(() =>
      markGenerationCommitted(store, "run-life", { generation_git_sha: "" }),
    );
    const committed = await recordSuccessfulGenerationPush(
      store,
      "run-life",
      "deadbeef",
    );
    assert.equal(committed.run_status, "committed");
    assert.equal(committed.generation_git_sha, "deadbeef");

    const other = await startObservationGeneration(store, {
      observation_run_id: "run-abort",
      base_git_sha: "base1",
    });
    await markGenerationValidated(store, other.observation_run_id);
    await markGenerationAborted(store, other.observation_run_id);
    const published = selectPublishedGenerations(await store.listGenerations());
    assert.deepEqual(
      published.map((row) => row.observation_run_id),
      ["run-life"],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("candidate reconstruction includes current run; published replay does not until commit", async () => {
  const observations = [
    { observation_run_id: "old", name: "Neovim" },
    { observation_run_id: "current", name: "FLSUN QQ-S Pro" },
    { observation_run_id: "aborted", name: "noise" },
  ];
  const published = selectPublishedObservations(observations, ["old"]);
  assert.deepEqual(
    published.map((row) => row.name),
    ["Neovim"],
  );
  const candidate = selectCandidateObservations(
    observations,
    ["old"],
    "current",
  );
  assert.deepEqual(candidate.map((row) => row.name).sort(), [
    "FLSUN QQ-S Pro",
    "Neovim",
  ]);
});

test("Git provenance manifest never embeds generation_git_sha", () => {
  assert.throws(() =>
    buildGitGenerationManifest({
      observation_run_id: "run-1",
      started_at: "t0",
      validated_at: "t1",
      base_git_sha: "base",
      generation_git_sha: "nope",
    }),
  );
  const manifest = buildGitGenerationManifest({
    observation_run_id: "run-1",
    started_at: "t0",
    validated_at: "t1",
    base_git_sha: "base",
  });
  assert.equal(manifest.run_status_at_build, "validated");
  assert.equal("generation_git_sha" in manifest, false);
  const durable = {
    schema: "joshternet.observation-generation.v1",
    observation_run_id: "run-1",
    run_status: "committed",
    started_at: "t0",
    validated_at: "t1",
    committed_at: "t2",
    base_git_sha: "base",
    generation_git_sha: "abc123",
  };
  assert.equal(verifyGenerationProvenance(manifest, durable).ok, true);
  assert.equal(
    verifyProvenanceAgainstCommit(manifest, durable, "wrong").ok,
    false,
  );
});

test("validated-but-unpushed fate is deterministic", () => {
  const generation = {
    schema: "joshternet.observation-generation.v1",
    observation_run_id: "run-x",
    run_status: "validated",
    started_at: "t0",
    validated_at: "t1",
    base_git_sha: "base-a",
  };
  assert.equal(
    decideValidatedUncommittedFate(generation, {
      current_base_git_sha: "base-a",
    }),
    "retry",
  );
  assert.equal(
    decideValidatedUncommittedFate(generation, {
      current_base_git_sha: "base-b",
    }),
    "supersede",
  );
});

test("book identity ladder does not merge title-only Dune", () => {
  const a = {
    normalized_title: "dune",
    source_observation_id: "obs-1",
  };
  const b = {
    normalized_title: "dune",
    source_observation_id: "obs-2",
  };
  assert.equal(booksMustRemainSeparate(a, b), true);
  assert.notEqual(bookIdentityKey(a).key, bookIdentityKey(b).key);
  const withIsbn = {
    isbn: "9780441172719",
    normalized_title: "dune",
    source_observation_id: "obs-3",
  };
  assert.equal(bookIdentityKey(withIsbn).strength, "isbn");
});

test("cross-source publication identity groups by canonical URL", () => {
  const groups = groupBySemanticIdentity(
    [
      {
        canonical_url: "https://joshua.example/notes/one/",
        source_observation_id: "feed",
      },
      {
        canonical_url: "https://joshua.example/notes/one/",
        source_observation_id: "html",
      },
    ],
    publicationIdentityKey,
  );
  assert.equal(groups.size, 1);
  assert.equal([...groups.values()][0].length, 2);
});

test("ownership manifest covers known dataset paths", async () => {
  const entries = await loadOwnershipManifest(repoRoot);
  assertOwnershipManifest({ entries });
  assert.ok(matchOwnership(entries, "data/uses/catalog/tools.json"));
  assert.ok(matchOwnership(entries, "_data/uses_summary.json"));
  assert.equal(
    writerMayModify(entries, "data/uses/state.json", "scripts/nlp/sync.mjs"),
    false,
  );
  assert.equal(
    writerMayModify(entries, "data/uses/state.json", "scripts/uses/build.mjs"),
    true,
  );
  assert.equal(
    writerMayModify(
      entries,
      "_data/topic_aliases.json",
      "any-reviewed-development",
    ),
    true,
  );
  const audit = auditPathsHaveOwnership(entries, [
    "data/uses/state.json",
    "missing/path.json",
  ]);
  assert.equal(audit.ok, false);
  assert.deepEqual(audit.undeclared, ["missing/path.json"]);
});

test("open-web evidence keeps webmentions outside publisher content mutation", () => {
  assert.ok(OPEN_WEB_EVIDENCE_MECHANISMS.length >= 10);
  assert.ok(getOpenWebEvidenceMechanism("opml"));
  assert.equal(mayMutatePublisherContentRecords("webmention"), false);
  assert.equal(mayMutatePublisherContentRecords("rss"), true);
});

test("member observation run is coordinated through the broker", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "josh-member-"));
  try {
    clearContentFamilyRegistry();
    registerDefaultContentFamilies({ replace: true });
    const sourceStore = createFilesystemSourceStore({
      rootDir: path.join(root, "src"),
    });
    const observationStore = createFilesystemObservationStoreWithCompaction(
      path.join(root, "obs"),
    );
    const result = await runMemberObservation({
      member_origin: "https://joshua.example",
      base_git_sha: "base",
      sourceStore,
      observationStore,
      seed_urls: [
        { url: "https://joshua.example/uses/", discovery_reason: "seed" },
      ],
      maxRounds: 2,
      fetchImpl: async (url) => ({
        ok: true,
        status: 200,
        url,
        headers: { "content-type": "text/html" },
        body: "<html><h2>3D printers</h2><p>FLSUN QQ-S Pro</p></html>",
      }),
    });
    assert.equal(result.generation.run_status, "collecting");
    assert.ok(result.observations.length >= 1);
    assert.equal(result.observations[0].outcome, "success");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("operational unchanged compaction keeps latest per URL", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "josh-compact-"));
  try {
    const store = createFilesystemObservationStoreWithCompaction(root);
    await startObservationGeneration(store, {
      observation_run_id: "run-c",
      base_git_sha: "b",
    });
    await markGenerationValidated(store, "run-c");
    await markGenerationCommitted(store, "run-c", {
      generation_git_sha: "sha",
    });
    for (const [id, at] of [
      ["o1", "2026-01-01T00:00:00.000Z"],
      ["o2", "2026-01-02T00:00:00.000Z"],
      ["o3", "2026-01-03T00:00:00.000Z"],
    ]) {
      await store.appendResourceObservation(
        createResourceObservation({
          observation_id: id,
          observation_run_id: "run-c",
          member_origin: "https://joshua.example",
          requested_url: "https://joshua.example/now/",
          outcome: "unchanged",
          observed_at: at,
          retention_class: "operational",
          coverage: "complete",
        }),
      );
    }
    const result = await compactOperationalObservations(store, {
      keepLatestUnchangedPerUrl: true,
    });
    assert.equal(result.removed, 2);
    const left = await store.listResourceObservations({
      observation_run_id: "run-c",
    });
    assert.equal(left.length, 1);
    assert.equal(left[0].observation_id, "o3");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("registry integrity fails closed on empty and shrink", () => {
  assert.equal(validateCanonicalRegistry(null).ok, false);
  assert.equal(
    validateCanonicalRegistry({ members: [] }).reason,
    "registry-below-minimum",
  );
  const ok = validateCanonicalRegistry({
    members: [{ origin: "https://joshua.example" }],
  });
  assert.equal(ok.ok, true);
  const shrink = validateCanonicalRegistry(
    { members: [{ origin: "https://joshua.example" }] },
    { previousMemberCount: 10, maxShrinkRatio: 0.5 },
  );
  assert.equal(shrink.ok, false);
  assert.equal(shrink.reason, "registry-unexpected-shrink");
  const transitions = membershipTransitions(
    ["https://a.example", "https://b.example"],
    ["https://b.example", "https://c.example"],
  );
  assert.deepEqual(transitions.added, ["https://c.example"]);
  assert.deepEqual(transitions.removed, ["https://a.example"]);
  assert.equal(
    memberIdentityKey("https://joshua.example/path"),
    "https://joshua.example",
  );
});

test("atomic publish forbids durable store paths and checks base SHA", () => {
  const paths = assertGenerationCommitPaths([
    "_data/uses_summary.json",
    "data/observation/sources/ab/cd/deadbeef",
  ]);
  assert.equal(paths.ok, false);
  assert.equal(assertBaseShaUnchanged("abc", "abc").ok, true);
  assert.equal(assertBaseShaUnchanged("abc", "def").ok, false);
  assert.equal(mayPublishGeneration({ dry_run: true }), false);
  const manifest = stageGenerationProvenance({
    observation_run_id: "run-pub",
    started_at: "t0",
    validated_at: "t1",
    base_git_sha: "base",
  });
  const message = generationCommitMessage(manifest);
  assert.match(message.subject, /run-pub/);
});

test("ownership CI helper rejects undeclared paths", async () => {
  const parsed = parseOwnershipCheckArgs([
    "--writer=scripts/uses/build.mjs",
    "data/uses/state.json",
    "mystery/file.json",
  ]);
  assert.equal(parsed.writer, "scripts/uses/build.mjs");
  const result = await runOwnershipCheck({
    repoRoot,
    paths: parsed.paths,
    writer: parsed.writer,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.undeclared, ["mystery/file.json"]);
});

test("representation migrations replay old evidence shapes", () => {
  clearRepresentationMigrations();
  registerDefaultUsesMigrations();
  const migrated = migrateObservationRepresentation(
    { source_body_hash: "abc", schema_version: "1" },
    { family_id: "uses", target_version: "2" },
  );
  assert.equal(migrated.source_hash, "abc");
  assert.equal(migrated.schema_version, "2");
  clearRepresentationMigrations();
  registerRepresentationMigration({
    family_id: "uses",
    from_version: "2",
    to_version: "3",
    migrate: (row) => ({ ...row, label: String(row.label || "").trim() }),
  });
});

test("durable store config and retention policy are explicit", () => {
  const config = readDurableStoreConfig({
    JOSHTERNET_SOURCE_STORE_BACKEND: "s3",
    JOSHTERNET_SOURCE_STORE_BUCKET: "evidence",
    JOSHTERNET_OBSERVATION_STORE_BACKEND: "s3",
    JOSHTERNET_OBSERVATION_STORE_BUCKET: "evidence",
  });
  assert.equal(config.source.backend, "s3");
  assert.doesNotThrow(() =>
    assertDurableStoresConfigured(config, { requireS3: true }),
  );
  const retention = defaultObservationRetentionPolicy();
  assert.equal(retention.operational_unchanged_keep_latest_per_url, true);
});

test("historical replay preserves failures and supports classifier-only replay", async () => {
  const work = await mkdtemp(path.join(os.tmpdir(), "josh-hist-"));
  try {
    const sourceStore = createFilesystemSourceStore({
      rootDir: path.join(work, "src"),
    });
    const observationStore = createFilesystemObservationStoreWithCompaction(
      path.join(work, "obs"),
    );
    const bodies = new Map([
      ["https://joshua.example/uses/", "<html><p>Neovim</p></html>"],
    ]);
    const first = await runMemberObservation({
      observation_run_id: "hist-1",
      member_origin: "https://joshua.example",
      base_git_sha: "b1",
      sourceStore,
      observationStore,
      seed_urls: [{ url: "https://joshua.example/uses/" }],
      maxRounds: 1,
      fetchImpl: async (url) => ({
        ok: true,
        status: 200,
        url,
        headers: { "content-type": "text/html" },
        body: bodies.get(url) || "",
      }),
    });
    await markGenerationValidated(observationStore, "hist-1");
    await markGenerationCommitted(observationStore, "hist-1", {
      generation_git_sha: "sha1",
    });
    const second = await runMemberObservation({
      observation_run_id: "hist-2",
      member_origin: "https://joshua.example",
      base_git_sha: "b1",
      sourceStore,
      observationStore,
      seed_urls: [{ url: "https://joshua.example/uses/" }],
      maxRounds: 1,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        url: "https://joshua.example/uses/",
        headers: {},
        body: "",
        error: new Error("temporary"),
      }),
    });
    const all = await observationStore.listResourceObservations({});
    assert.ok(all.some((row) => row.observation_run_id === "hist-1"));
    assert.ok(
      second.observations.some(
        (row) =>
          row.outcome === "http_failure" ||
          row.outcome === "timeout" ||
          row.failure_reason,
      ),
    );
    const published = selectPublishedObservations(all, ["hist-1"]);
    assert.ok(published.every((row) => row.observation_run_id === "hist-1"));
    const hash = first.observations.find((row) => row.source_hash)?.source_hash;
    assert.ok(hash);
    const body = (await sourceStore.get(hash)).toString("utf8");
    assert.match(body, /Neovim/);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test("clean-room uses fixture rebuilds FDM facts without Git state", async () => {
  const catalog = {
    tools: JSON.parse(
      await readFile(
        path.join(repoRoot, "data/uses/catalog/tools.json"),
        "utf8",
      ),
    ).tools,
    aliases: JSON.parse(
      await readFile(
        path.join(repoRoot, "data/uses/catalog/aliases.json"),
        "utf8",
      ),
    ).aliases,
    categories: JSON.parse(
      await readFile(
        path.join(repoRoot, "data/uses/catalog/categories.json"),
        "utf8",
      ),
    ).categories,
  };
  const workRoot = await mkdtemp(path.join(os.tmpdir(), "josh-clean-"));
  try {
    const pipeline = await runUsesFixturePipeline({
      workRoot,
      repoRoot,
      origin: "https://joshuamorris.info",
      uses_url: "https://joshuamorris.info/uses/",
      fixture_file: "test/fixtures/uses/members/joshuamorris.info.html",
      catalog,
    });
    const slot = pipeline.summary.slots.find(
      (row) => row.id === "3d-printer-fdm",
    );
    assert.ok(slot?.products.some((tool) => tool.tool_id === "flsun-qq-s-pro"));
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test("multi-family harness fetches each seeded resource once via broker", async () => {
  const manifest = JSON.parse(
    await readFile(
      path.join(
        repoRoot,
        "test/fixtures/observation/multi-family-manifest.json",
      ),
      "utf8",
    ),
  );
  const workRoot = await mkdtemp(path.join(os.tmpdir(), "josh-multi-"));
  try {
    clearContentFamilyRegistry();
    registerDefaultContentFamilies({ replace: true });
    const bodies = new Map();
    for (const page of manifest.pages) {
      bodies.set(
        page.url,
        await readFile(path.join(repoRoot, page.file), "utf8"),
      );
    }
    let fetches = 0;
    const sourceStore = createFilesystemSourceStore({
      rootDir: path.join(workRoot, "src"),
    });
    const observationStore = createFilesystemObservationStoreWithCompaction(
      path.join(workRoot, "obs"),
    );
    const result = await runMemberObservation({
      member_origin: manifest.member_origin,
      base_git_sha: "multi-base",
      sourceStore,
      observationStore,
      seed_urls: manifest.pages.map((page) => ({
        url: page.url,
        discovery_reason: page.family,
      })),
      maxRounds: 1,
      fetchImpl: async (url) => {
        fetches += 1;
        return {
          ok: true,
          status: 200,
          url,
          headers: { "content-type": "text/html" },
          body: bodies.get(url) || "",
        };
      },
    });
    assert.equal(fetches, manifest.pages.length);
    assert.equal(
      result.observations.filter((row) => row.outcome === "success").length,
      manifest.pages.length,
    );
    for (const observation of result.observations) {
      if (observation.source_hash) {
        await assertSourceBlobReady(sourceStore, observation.source_hash);
      }
    }
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test("autonomous member discovery needs only registry origin + seed URL", async () => {
  const catalog = {
    tools: JSON.parse(
      await readFile(
        path.join(repoRoot, "data/uses/catalog/tools.json"),
        "utf8",
      ),
    ).tools,
    aliases: JSON.parse(
      await readFile(
        path.join(repoRoot, "data/uses/catalog/aliases.json"),
        "utf8",
      ),
    ).aliases,
    categories: [],
  };
  const workRoot = await mkdtemp(path.join(os.tmpdir(), "josh-auto-"));
  try {
    const pipeline = await runUsesFixturePipeline({
      workRoot,
      repoRoot,
      origin: "https://joshuamorris.info",
      uses_url: "https://joshuamorris.info/uses/",
      fixture_file: "test/fixtures/uses/members/joshuamorris.info.html",
      catalog,
    });
    assert.ok(pipeline.member.origin === "https://joshuamorris.info");
    assert.ok(pipeline.evidence.length >= 1);
    assert.ok(
      pipeline.evidence.every(
        (row) => row.origin === "https://joshuamorris.info",
      ),
    );
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test("classifier replay uses durable source bodies without recrawl", async () => {
  const catalog = {
    tools: JSON.parse(
      await readFile(
        path.join(repoRoot, "data/uses/catalog/tools.json"),
        "utf8",
      ),
    ).tools,
    aliases: JSON.parse(
      await readFile(
        path.join(repoRoot, "data/uses/catalog/aliases.json"),
        "utf8",
      ),
    ).aliases,
    categories: JSON.parse(
      await readFile(
        path.join(repoRoot, "data/uses/catalog/categories.json"),
        "utf8",
      ),
    ).categories,
  };
  const workRoot = await mkdtemp(path.join(os.tmpdir(), "josh-reclass-"));
  try {
    const first = await runUsesFixturePipeline({
      workRoot,
      repoRoot,
      origin: "https://joshuamorris.info",
      uses_url: "https://joshuamorris.info/uses/",
      fixture_file: "test/fixtures/uses/members/joshuamorris.info.html",
      catalog,
    });
    const hash = first.observations[0].source_hash;
    const html = (await first.sourceStore.get(hash)).toString("utf8");
    const extracted = extractUsesFromHtml(html, {
      url: "https://joshuamorris.info/uses/",
    });
    const flsun = extracted.items.find(
      (item) => item.label === "FLSUN QQ-S Pro",
    );
    assert.ok(flsun);
    assert.equal(
      classifyClaim({ name: flsun.label, kind: "product" }, catalog).tool_id,
      "flsun-qq-s-pro",
    );
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
});

test("deterministic repeat of fixture observation yields same source hash", async () => {
  const catalog = {
    tools: [],
    aliases: [],
    categories: [],
  };
  const workA = await mkdtemp(path.join(os.tmpdir(), "josh-det-a-"));
  const workB = await mkdtemp(path.join(os.tmpdir(), "josh-det-b-"));
  try {
    const a = await runUsesFixturePipeline({
      workRoot: workA,
      repoRoot,
      origin: "https://joshuamorris.info",
      uses_url: "https://joshuamorris.info/uses/",
      fixture_file: "test/fixtures/uses/members/joshuamorris.info.html",
      catalog,
    });
    const b = await runUsesFixturePipeline({
      workRoot: workB,
      repoRoot,
      origin: "https://joshuamorris.info",
      uses_url: "https://joshuamorris.info/uses/",
      fixture_file: "test/fixtures/uses/members/joshuamorris.info.html",
      catalog,
    });
    assert.equal(a.observations[0].source_hash, b.observations[0].source_hash);
    assert.deepEqual(
      a.extracted.items.map((item) => item.label).sort(),
      b.extracted.items.map((item) => item.label).sort(),
    );
  } finally {
    await rm(workA, { recursive: true, force: true });
    await rm(workB, { recursive: true, force: true });
  }
});
