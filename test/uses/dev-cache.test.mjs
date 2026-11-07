/**
 * Goal: Section slots, identity collapses, and the append-only dev cache.
 */
import assert from "node:assert/strict";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  mkdir,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { pruneContentItems } from "../../scripts/nlp/content-retention.mjs";
import { classifyClaim, sectionSlotId } from "../../scripts/uses/classify.mjs";
import {
  compareUsesUrls,
  devCacheEnabled,
  latestUsesOrigins,
  localDevCacheParticipants,
  participantsForThisRun,
  participantsFromCachedOrigins,
  isPermanentUsesMiss,
  isSharedPlatformHost,
  rememberMemberCrawl,
  rememberUnavailableUsesPage,
  LOCAL_NONJOSHTERNET_INTAKE_LIMIT,
  clearLocalIntakeOrigins,
  readLocalIntakeOrigins,
  selectLocalDevCacheIntake,
  selectNewUsesLinks,
  writeLocalIntakeOrigins,
  splitUsesPreviewInputs,
  unavailableUsesUrls,
  usesTechHrefs,
  devCacheRoot,
} from "../../scripts/uses/dev-cache.mjs";
import { partitionIdentityCorrections } from "../../scripts/uses/quality.mjs";

const categories = [
  { id: "editor-ide", name: "Editors", role: "ranked" },
  { id: "browser", name: "Browsers", role: "ranked" },
  { id: "old", name: "Old", role: "retired" },
  { id: "editor-copy", name: "Editors", role: "ranked" },
  null,
  { id: "nameless", name: "", role: "ranked" },
  { role: "ranked" },
];

test("a section path names one ranked slot", () => {
  assert.equal(sectionSlotId("Hardware / Editors", categories), null);
  assert.equal(
    sectionSlotId("Editors", [
      { id: "editor-ide", name: "Editors", role: "ranked" },
    ]),
    "editor-ide",
  );
  assert.equal(sectionSlotId("editor-ide", categories), "editor-ide");
  assert.equal(sectionSlotId("Browsers / editor-ide", categories), null);
  assert.equal(sectionSlotId("Old", categories), null);
  assert.equal(sectionSlotId("", categories), null);
  assert.equal(sectionSlotId("Nowhere", categories), null);
  assert.equal(sectionSlotId("Editors"), null);
  const classified = classifyClaim(
    {
      name: "Pocket Knife",
      section_path: "Editors",
      tool_id: "observed:pocket-knife",
      kind: "product",
    },
    {
      tools: [],
      aliases: [],
      categories: [{ id: "editor-ide", name: "Editors", role: "ranked" }],
    },
  );
  assert.equal(classified.role, "ranked");
  assert.equal(classified.rule, "section");
  assert.equal(classified.slot_id, "editor-ide");
  assert.equal(classified.tool_id, "observed:pocket-knife");
  const fromSectionOnly = classifyClaim(
    { name: "Pocket Knife", section: "Editors", tool_id: "", kind: "product" },
    {
      tools: [],
      aliases: [],
      categories: [{ id: "editor-ide", name: "Editors", role: "ranked" }],
    },
  );
  assert.equal(fromSectionOnly.rule, "section");
  assert.equal(typeof fromSectionOnly.tool_id === "string", false);
  const first = "https://joshua.example/uses/";
  const second = "https://friends.joshua.example/uses/";
  assert.equal(
    compareUsesUrls("uses-tech", first, second),
    -compareUsesUrls("uses-tech", second, first),
  );
});

test("identity collapses keep the catalog id out of the shift count", () => {
  const events = [
    {
      event_type: "correction",
      status: "removed",
      tool_id: "observed:apple-magic-keyboard",
    },
    {
      event_type: "correction",
      status: "removed",
      tool_id: "observed:gone",
    },
    {
      event_type: "correction",
      status: "removed",
      tool_id: "vim",
    },
    { event_type: "usage_added", status: "current", tool_id: "neovim" },
    { event_type: "correction", status: "removed", tool_id: "" },
    null,
  ];
  const counts = partitionIdentityCorrections(
    events,
    [
      {
        observed_id: "observed:apple-magic-keyboard",
        canonical_id: "apple-magic-keyboard",
      },
      { observed_id: "observed:half" },
      null,
    ],
    ["", "apple-magic-keyboard"],
  );
  assert.equal(counts.collapses, 1);
  assert.equal(counts.identity_corrections, 2);
  assert.deepEqual(
    partitionIdentityCorrections(undefined, undefined, undefined),
    {
      collapses: 0,
      identity_corrections: 0,
    },
  );
});

test("the dev cache only grows and CI does not write it", async () => {
  assert.equal(devCacheEnabled({ CI: "true" }), false);
  assert.equal(devCacheEnabled({ CI: "1" }), false);
  assert.equal(devCacheEnabled({ GITHUB_ACTIONS: "true" }), false);
  assert.equal(devCacheEnabled({}), true);
  assert.equal(devCacheEnabled(null), true);
  assert.equal(devCacheRoot().endsWith("data/dev-crawl-cache"), true);

  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-dev-cache-"));
  await writeFile(path.join(dir, "sentinel.txt"), "keep");
  const skipped = await rememberMemberCrawl({
    enabled: false,
    root: dir,
    origin: "https://joshua.example",
    pages: [{ url: "https://joshua.example/uses/", html: "<p>VS Code</p>" }],
  });
  assert.equal(skipped.appended, 0);
  assert.equal((await rememberMemberCrawl(null)).appended, 0);
  assert.equal(await readFile(path.join(dir, "sentinel.txt"), "utf8"), "keep");

  const first = await rememberMemberCrawl({
    enabled: true,
    root: dir,
    origin: "https://joshua.example",
    pages: [{ url: "https://joshua.example/", html: "" }],
    usesPages: [
      { url: "https://joshua.example/uses/", html: "<p>VS Code</p>" },
    ],
    seekingPages: [
      { url: "https://joshua.example/seeking/", html: "<p>Wanted</p>" },
    ],
    subjects: [{ name: "editors" }],
  });
  assert.equal(first.appended, 3);
  const again = await rememberMemberCrawl({
    enabled: true,
    root: dir,
    origin: "https://joshua.example",
    usesPages: [{ url: "https://joshua.example/uses/", html: "<p>Neovim</p>" }],
    subjects: [],
  });
  assert.equal(again.appended, 1);
  const manifest = JSON.parse(
    await readFile(path.join(dir, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.length, 4);
  assert.equal(await readFile(path.join(dir, "sentinel.txt"), "utf8"), "keep");
  const origins = await latestUsesOrigins(dir);
  assert.equal(origins.length, 1);
  assert.equal(origins[0].pages.length, 1);
  assert.equal(origins[0].pages[0].html, "<p>Neovim</p>");
  const repeat = await rememberMemberCrawl({
    enabled: true,
    root: dir,
    origin: "https://joshua.example",
    usesPages: [{ url: "https://joshua.example/uses/", html: "<p>Neovim</p>" }],
  });
  assert.equal(repeat.appended, 1);
  pruneContentItems(
    [{ url: "https://joshua.example/note", published_at: "2000-01-01" }],
    new Date().toISOString(),
  );
  assert.equal(await readFile(path.join(dir, "sentinel.txt"), "utf8"), "keep");
  const workflow = await readFile(
    path.join(
      fileURLToPath(new URL("../../", import.meta.url)),
      ".github/workflows/network-sync.yml",
    ),
    "utf8",
  );
  assert.equal(workflow.includes("data/dev-crawl-cache"), false);

  await writeFile(path.join(dir, "manifest.json"), "{}\n");
  assert.deepEqual(await latestUsesOrigins(dir), []);
  await assert.rejects(
    rememberMemberCrawl({
      enabled: true,
      root: dir,
      origin: "https://joshua.example",
      usesPages: [{ url: "https://joshua.example/uses/", html: "<p>x</p>" }],
    }),
  );
});

test("uses.tech links are a seeded append of new Uses URLs", () => {
  const hrefs = usesTechHrefs(`
    <a href="https://joshua.example/uses/">Joshua</a>
    <a href="https://friends.joshua.example/uses/">Friend</a>
    <a href="https://profiles.joshua.example/uses/">Profile</a>
    <a href="">Empty</a>
    <a href="#top">Top</a>
    <a href="javascript:void(0)">Skip</a>
    <a href="https://www.notion.so/Dev-environment">Notes</a>
    <a href="https://github.com/someone/uses">GitHub</a>
    <a href="https://gist.github.com/someone/uses">Gist</a>
    <a href="https://joshua.github.io/uses/">Pages</a>
    <a href="https://friends.joshua.example/about">About</a>
    <a href="notaurl">Bad</a>
    <a href="mailto:ada@joshua.example">Mail</a>
  `);
  const selected = selectNewUsesLinks(hrefs, {
    seed: "uses-tech",
    limit: 24,
    already: [],
  });
  assert.equal(selected.length, 4);
  assert.ok(selected.includes("https://joshua.example/uses/"));
  assert.ok(selected.includes("https://joshua.github.io/uses/"));
  assert.equal(selected.includes("https://github.com/someone/uses"), false);
  assert.equal(isSharedPlatformHost("github.com"), true);
  assert.equal(isSharedPlatformHost("www.github.com"), true);
  assert.equal(isSharedPlatformHost("joshua.github.io"), false);
  assert.equal(isSharedPlatformHost(""), false);
  assert.equal(isSharedPlatformHost(null), false);
  assert.equal(
    selectNewUsesLinks(hrefs, {
      already: ["https://joshua.example/uses/"],
    }).length,
    3,
  );
  assert.equal(LOCAL_NONJOSHTERNET_INTAKE_LIMIT, 5);
  assert.equal(
    selectNewUsesLinks(hrefs, { already: [] }).length,
    Math.min(4, LOCAL_NONJOSHTERNET_INTAKE_LIMIT),
  );
  assert.deepEqual(selectNewUsesLinks(hrefs, { limit: 0 }), []);
  assert.deepEqual(selectNewUsesLinks(null, { limit: Number.NaN }), []);
});

test("local non-Joshternet intake is capped and recorded", async () => {
  const sites = [
    { origin: "https://joshua.example" },
    { origin: "https://other.example" },
    { origin: "https://friends.joshua.example" },
    { origin: "https://profiles.joshua.example" },
    { origin: "https://a.joshua.example" },
    { origin: "https://b.joshua.example" },
  ];
  assert.deepEqual(
    selectLocalDevCacheIntake(sites, {
      already: ["https://joshua.example"],
      limit: 5,
    }).map((site) => site.origin),
    [
      "https://other.example",
      "https://friends.joshua.example",
      "https://profiles.joshua.example",
      "https://a.joshua.example",
      "https://b.joshua.example",
    ],
  );
  assert.deepEqual(selectLocalDevCacheIntake(sites, { limit: 0 }), []);
  assert.deepEqual(selectLocalDevCacheIntake(null, {}), []);
  assert.deepEqual(
    selectLocalDevCacheIntake(sites, {
      already: [null, "", "https://other.example"],
      limit: 1,
    }).map((site) => site.origin),
    ["https://joshua.example"],
  );

  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-intake-"));
  try {
    await writeLocalIntakeOrigins(dir, /** @type {any} */ (null));
    assert.deepEqual(await readLocalIntakeOrigins(dir), []);
    await writeLocalIntakeOrigins(dir, [
      "https://other.example/",
      "https://other.example",
      "notaurl",
    ]);
    assert.deepEqual(await readLocalIntakeOrigins(dir), [
      "https://other.example",
    ]);
    await clearLocalIntakeOrigins(dir);
    assert.deepEqual(await readLocalIntakeOrigins(dir), []);
    assert.deepEqual(
      await readLocalIntakeOrigins(path.join(dir, "missing-root")),
      [],
    );
    await writeFile(path.join(dir, "intake-origins.json"), "null\n", "utf8");
    assert.deepEqual(await readLocalIntakeOrigins(dir), []);
    await writeFile(path.join(dir, "intake-origins.json"), "[]\n", "utf8");
    assert.deepEqual(await readLocalIntakeOrigins(dir), []);
    await writeFile(
      path.join(dir, "intake-origins.json"),
      '{"origins":null}\n',
      "utf8",
    );
    assert.deepEqual(await readLocalIntakeOrigins(dir), []);
    await writeFile(path.join(dir, "intake-origins.json"), "{\n", "utf8");
    await assert.rejects(readLocalIntakeOrigins(dir));
    await clearLocalIntakeOrigins(path.join(dir, "absent-clear-root"));
    await mkdir(path.join(dir, "blocked-file"));
    await mkdir(path.join(dir, "blocked-file", "intake-origins.json"));
    await assert.rejects(clearLocalIntakeOrigins(path.join(dir, "blocked-file")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a gone Uses page is skipped next time and stays out of the local set", async () => {
  assert.equal(
    isPermanentUsesMiss("HTTP 404 for https://other.example/uses/"),
    true,
  );
  assert.equal(isPermanentUsesMiss("HTTP 410"), true);
  assert.equal(
    isPermanentUsesMiss("HTTP 500 for https://other.example/uses/"),
    false,
  );
  assert.equal(isPermanentUsesMiss(""), false);
  assert.equal(isPermanentUsesMiss(null), false);

  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-dev-cache-gone-"));
  assert.deepEqual(await unavailableUsesUrls(dir), []);
  await rememberUnavailableUsesPage(null);
  await rememberUnavailableUsesPage({
    root: "",
    url: "https://other.example/uses/",
  });
  await rememberUnavailableUsesPage({
    root: dir,
    url: "https://other.example/uses/",
    reason: "HTTP 404 for https://other.example/uses/",
  });
  await rememberUnavailableUsesPage({
    root: dir,
    url: "https://other.example/uses/",
    reason: "again",
  });
  await rememberUnavailableUsesPage({ root: dir, url: "not a url" });
  assert.deepEqual(await unavailableUsesUrls(dir), [
    "https://other.example/uses/",
    "not a url",
  ]);

  const hash = "abc";
  await mkdir(path.join(dir, "bodies"), { recursive: true });
  await writeFile(path.join(dir, "bodies", `${hash}.html`), "<p>gone</p>");
  const manifest = JSON.parse(
    await readFile(path.join(dir, "manifest.json"), "utf8"),
  );
  manifest.push(null, {
    origin: "https://other.example",
    url: "https://other.example/uses/",
    kind: "uses-unavailable",
    hash,
  });
  await writeFile(
    path.join(dir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await rememberUnavailableUsesPage({
    root: dir,
    url: "https://friends.joshua.example/uses/",
  });
  assert.ok(
    (await unavailableUsesUrls(dir)).includes(
      "https://friends.joshua.example/uses/",
    ),
  );
  assert.deepEqual(await latestUsesOrigins(dir), []);

  await writeFile(path.join(dir, "manifest.json"), "{}\n");
  assert.deepEqual(await unavailableUsesUrls(dir), []);
  await assert.rejects(
    rememberUnavailableUsesPage({
      root: dir,
      url: "https://friends.joshua.example/uses/",
    }),
  );
});

test("a missing cache body is skipped and a missing manifest is empty", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-dev-cache-miss-"));
  assert.deepEqual(await latestUsesOrigins(dir), []);
  await mkdir(path.join(dir, "bodies"), { recursive: true });
  await writeFile(
    path.join(dir, "manifest.json"),
    `${JSON.stringify(
      [
        null,
        { url: "https://joshua.example/uses/", hash: "missing", kind: "uses" },
        { hash: "no-url", kind: "uses" },
        {
          url: "https://joshua.example/",
          hash: "home",
          kind: "page",
          origin: "https://joshua.example",
        },
        {
          url: "https://other.example/uses/",
          hash: "present",
          kind: "uses",
        },
        {
          url: "https://profiles.joshua.example/uses/",
          hash: "present",
        },
        {
          url: "::::",
          hash: "bad",
          kind: "uses",
          origin: "",
        },
      ],
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(dir, "bodies", "present.html"), "<p>Tool</p>");
  await writeFile(path.join(dir, "bodies", "bad.html"), "<p>Bad</p>");
  const origins = await latestUsesOrigins(dir);
  assert.equal(origins[0].origin, "https://other.example");
  assert.equal(origins[0].pages[0].html, "<p>Tool</p>");
  const originless = await mkdtemp(
    path.join(os.tmpdir(), "uses-dev-cache-origin-"),
  );
  const stored = await rememberMemberCrawl({
    enabled: true,
    root: originless,
    usesPages: [
      { url: "https://joshua.example/uses/", html: "<p>Originless</p>" },
    ],
  });
  assert.equal(stored.appended, 1);
  const blocked = await mkdtemp(
    path.join(os.tmpdir(), "uses-dev-cache-block-"),
  );
  await writeFile(path.join(blocked, "bodies"), "not-a-directory");
  await assert.rejects(
    rememberMemberCrawl({
      enabled: true,
      root: blocked,
      origin: "https://joshua.example",
      usesPages: [{ url: "https://joshua.example/uses/", html: "<p>x</p>" }],
    }),
  );
  const locked = await mkdtemp(path.join(os.tmpdir(), "uses-dev-cache-lock-"));
  const bodies = path.join(locked, "bodies");
  await mkdir(bodies);
  await chmod(bodies, 0o500);
  try {
    await assert.rejects(
      rememberMemberCrawl({
        enabled: true,
        root: locked,
        origin: "https://joshua.example",
        usesPages: [{ url: "https://joshua.example/uses/", html: "<p>y</p>" }],
      }),
    );
  } finally {
    await chmod(bodies, 0o700);
  }
});

test("cached personal sites become local participants and stay out of the ledger", async () => {
  assert.deepEqual(participantsFromCachedOrigins(null), []);
  assert.deepEqual(
    participantsFromCachedOrigins([
      null,
      { origin: "" },
      { origin: "not a url" },
      { origin: "ftp://files.joshua.example" },
      { origin: "https://user:pass@joshua.example" },
      { origin: "https://joshternet.org" },
      { origin: "https://github.com" },
      { origin: "https://www.github.com/about" },
      { origin: "https://joshua.github.io" },
      { origin: "https://friends.joshua.example/uses/" },
      { origin: "https://friends.joshua.example" },
      { origin: "http://profiles.joshua.example" },
    ]).map((site) => site.origin),
    [
      "https://joshua.github.io",
      "https://friends.joshua.example",
      "http://profiles.joshua.example",
    ],
  );
  const site = participantsFromCachedOrigins(
    [{ origin: "https://other.example" }],
    "2026-02-02T00:00:00.000Z",
  )[0];
  assert.equal(site.identity, "undeclared");
  assert.equal(site.declaration.version, 1);
  assert.equal(site.latest_declaration_check_outcome, "local");
  assert.equal(site.domain, "other.example");
  assert.equal(site.first_participated_at, "2026-02-02T00:00:00.000Z");

  const dir = await mkdtemp(path.join(os.tmpdir(), "uses-dev-cache-sites-"));
  assert.deepEqual(await localDevCacheParticipants(dir, false), []);
  await rememberMemberCrawl({
    enabled: true,
    root: dir,
    origin: "https://other.example",
    usesPages: [
      {
        url: "https://other.example/uses/",
        html: "<h2>Tools</h2><ul><li>Neovim</li></ul>",
      },
    ],
  });
  const loaded = await localDevCacheParticipants(dir, true);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].origin, "https://other.example");

  const split = splitUsesPreviewInputs(
    [
      null,
      { origin: "https://joshua.example", local_dev_cache: false },
      { origin: "https://other.example", local_dev_cache: true },
      { local_dev_cache: false },
    ],
    [
      null,
      { origin: "" },
      { origin: "https://joshua.example" },
      { origin: "https://friends.joshua.example" },
    ],
  );
  assert.deepEqual(
    split.ledger.map((entry) => entry.origin),
    ["https://joshua.example", undefined],
  );
  assert.deepEqual(
    split.preview.map((entry) => entry.origin),
    ["https://other.example", "https://friends.joshua.example"],
  );
  assert.deepEqual(splitUsesPreviewInputs(null, null), {
    ledger: [],
    preview: [],
  });
  const kept = participantsForThisRun(
    [
      null,
      { origin: "" },
      { origin: "https://joshua.example" },
      { origin: "https://other.example", local_dev_cache: true },
    ],
    false,
  );
  assert.deepEqual(
    kept.map((entry) => entry.origin),
    ["https://joshua.example"],
  );
  assert.deepEqual(
    participantsForThisRun(
      [
        { origin: "https://joshua.example" },
        { origin: "https://other.example", local_dev_cache: true },
      ],
      true,
    ).map((entry) => entry.origin),
    ["https://joshua.example", "https://other.example"],
  );
  assert.deepEqual(participantsForThisRun(null, false), []);
});
