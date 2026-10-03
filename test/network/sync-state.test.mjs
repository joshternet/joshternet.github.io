import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  partitionPublicParticipants,
  screenshotPath,
} from "../../scripts/network/lib.mjs";

import {
  fallbackEntry,
  registryNeedsSync,
  removeOrphanScreenshots,
  withFeeds,
} from "../../scripts/network/state.mjs";

function participating({
  origin = "https://example.com",
  identity = "undeclared",
} = {}) {
  const declaration = {
    version: 1,
  };

  if (identity === "affirmed") {
    declaration.josh = true;
  } else if (identity === "declined") {
    declaration.josh = false;
  }

  return {
    origin,
    domain: new URL(origin).host,
    identity,
    declaration,
    initial_declaration: {
      ...declaration,
    },
    first_participated_at: "2026-09-01T00:00:00.000Z",
    latest_declaration_check_at: "2026-09-15T00:00:00.000Z",
    latest_declaration_check_outcome: "valid",
  };
}

test("existing capture survives a refresh failure", () => {
  const participant = participating({
    identity: "declined",
  });

  const previous = {
    ...participating({
      identity: "affirmed",
    }),
    title: "Existing title",
    description: "Existing description",
    screenshot: screenshotPath("https://example.com"),
    embeddable: true,
    frame_reason: "allowed",
    captured_at: "2026-09-14T12:00:00Z",
    feeds: [
      {
        url: "https://example.com/rss.xml",
        type: "application/rss+xml",
        title: "Example RSS",
      },
    ],
    blogroll: "https://example.com/blogroll.opml",
    elsewhere: [
      {
        url: "https://github.com/example",
        network: "github",
        label: "GitHub",
      },
    ],
  };

  const result = fallbackEntry(participant, previous);

  assert.equal(result.identity, "declined");
  assert.equal(result.first_participated_at, participant.first_participated_at);
  assert.deepEqual(result.declaration, participant.declaration);
  assert.equal(result.title, "Existing title");
  assert.equal(result.description, "Existing description");
  assert.equal(result.screenshot, previous.screenshot);
  assert.equal(result.embeddable, true);
  assert.equal(result.frame_reason, "allowed");
  assert.equal(result.captured_at, previous.captured_at);
  assert.deepEqual(result.feeds, previous.feeds);
  assert.equal(result.blogroll, previous.blogroll);
  assert.deepEqual(result.elsewhere, previous.elsewhere);
});

test("fallback omits feeds when the previous entry had none", () => {
  const participant = participating();
  const previous = {
    ...participating(),
    title: "Existing title",
    description: "Existing description",
    screenshot: screenshotPath("https://example.com"),
    embeddable: true,
    frame_reason: "allowed",
    captured_at: "2026-09-14T12:00:00Z",
    feeds: [],
  };

  const result = fallbackEntry(participant, previous);

  assert.equal(Object.hasOwn(result, "feeds"), false);
});

test("withFeeds publishes feeds or omits the field", () => {
  const base = {
    origin: "https://example.com",
    domain: "example.com",
    feeds: [
      {
        url: "https://example.com/old.xml",
        type: "application/rss+xml",
      },
    ],
  };

  assert.deepEqual(
    withFeeds(base, [
      {
        url: "https://example.com/rss.xml",
        type: "application/rss+xml",
      },
    ]).feeds,
    [
      {
        url: "https://example.com/rss.xml",
        type: "application/rss+xml",
      },
    ],
  );

  assert.equal(Object.hasOwn(withFeeds(base, []), "feeds"), false);
  assert.equal(Object.hasOwn(withFeeds(base, null), "feeds"), false);
});

test("new participant survives a first capture failure", () => {
  const participant = participating({
    identity: "undeclared",
  });
  const result = fallbackEntry(participant);

  assert.deepEqual(result, {
    ...participant,
    title: "example.com",
    description: "",
    screenshot: "",
    embeddable: false,
    frame_reason: "unknown",
    captured_at: "",
  });
});

test("public participant remains eligible for fallback after boundary validation", async () => {
  const participant = participating({
    identity: "declined",
  });

  const previous = {
    ...participating({
      identity: "affirmed",
    }),
    title: "Existing title",
    description: "Existing description",
    screenshot: screenshotPath("https://example.com"),
    embeddable: true,
    frame_reason: "allowed",
    captured_at: "2026-09-14T12:00:00Z",
  };

  const { accepted, rejected } = await partitionPublicParticipants(
    [participant],
    {
      lookup: async () => {
        return [
          {
            address: "93.184.216.34",
            family: 4,
          },
        ];
      },
    },
  );

  assert.deepEqual(accepted, [participant]);
  assert.deepEqual(rejected, []);

  const result = fallbackEntry(accepted[0], previous);

  assert.equal(result.origin, participant.origin);
  assert.equal(result.identity, "declined");
  assert.equal(result.title, previous.title);
  assert.equal(result.screenshot, previous.screenshot);
  assert.equal(result.captured_at, previous.captured_at);
});

test("unsafe participant is removed from desired publication state", async () => {
  const participant = participating({
    identity: "affirmed",
  });

  const existing = [
    {
      ...participant,
      title: "Existing title",
      description: "Existing description",
      screenshot: screenshotPath(participant.origin),
      embeddable: true,
      frame_reason: "allowed",
      captured_at: new Date().toISOString(),
    },
  ];

  const { accepted, rejected } = await partitionPublicParticipants(
    [participant],
    {
      lookup: async () => {
        return [
          {
            address: "127.0.0.1",
            family: 4,
          },
        ];
      },
    },
  );

  assert.deepEqual(accepted, []);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].participant, participant);

  assert.equal(registryNeedsSync(accepted, existing), true);
});

test("removed participant screenshot is deleted as an orphan", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "joshternet-network-state-"),
  );

  try {
    const kept = "kept.webp";
    const removed = "removed.webp";
    const unrelated = "notes.txt";

    await fs.writeFile(path.join(root, kept), "kept");
    await fs.writeFile(path.join(root, removed), "removed");
    await fs.writeFile(path.join(root, unrelated), "unrelated");

    await removeOrphanScreenshots(
      [
        {
          screenshot: `/assets/network/sites/${kept}`,
        },
      ],
      root,
    );

    const remaining = (await fs.readdir(root)).sort();

    assert.deepEqual(remaining, [kept, unrelated]);
  } finally {
    await fs.rm(root, {
      recursive: true,
      force: true,
    });
  }
});

test("missing screenshot directory is harmless", async () => {
  const root = path.join(
    os.tmpdir(),
    `joshternet-network-missing-${process.pid}-${Date.now()}`,
  );

  await assert.doesNotReject(removeOrphanScreenshots([], root));
});

test("matching fresh registry does not require sync", () => {
  const now = Date.parse("2026-09-15T20:00:00Z");

  const participants = [
    participating({
      identity: "affirmed",
    }),
  ];

  const existing = [
    {
      ...participants[0],
      captured_at: "2026-09-15T19:00:00Z",
    },
  ];

  assert.equal(registryNeedsSync(participants, existing, now), false);
});

test("identity change requires sync", () => {
  const participants = [
    participating({
      identity: "declined",
    }),
  ];

  const existing = [
    {
      ...participating({
        identity: "affirmed",
      }),
      captured_at: new Date().toISOString(),
    },
  ];

  assert.equal(registryNeedsSync(participants, existing), true);
});

test("participation timestamp change requires sync", () => {
  const participants = [
    participating({
      identity: "affirmed",
    }),
  ];

  const existing = [
    {
      ...participants[0],
      first_participated_at: "2026-08-01T00:00:00.000Z",
      captured_at: new Date().toISOString(),
    },
  ];

  assert.equal(registryNeedsSync(participants, existing), true);
});

test("participant removal requires sync", () => {
  const participants = [];

  const existing = [
    {
      ...participating({
        identity: "affirmed",
      }),
      captured_at: new Date().toISOString(),
    },
  ];

  assert.equal(registryNeedsSync(participants, existing), true);
});

test("stale capture requires sync", () => {
  const now = Date.parse("2026-09-15T20:00:00Z");

  const participants = [
    participating({
      identity: "undeclared",
    }),
  ];

  const existing = [
    {
      ...participants[0],
      captured_at: "2026-09-14T19:59:59Z",
    },
  ];

  assert.equal(registryNeedsSync(participants, existing, now), true);
});
