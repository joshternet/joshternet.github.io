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
} from "../../scripts/network/state.mjs";

test("existing capture survives a refresh failure", () => {
  const participant = {
    origin: "https://example.com",
    domain: "example.com",
    identity: "declined",
  };

  const previous = {
    origin: "https://example.com",
    domain: "example.com",
    identity: "affirmed",
    title: "Existing title",
    description: "Existing description",
    screenshot: screenshotPath("https://example.com"),
    embeddable: true,
    frame_reason: "allowed",
    captured_at: "2026-09-14T12:00:00Z",
  };

  const result = fallbackEntry(participant, previous);

  assert.equal(result.identity, "declined");
  assert.equal(result.title, "Existing title");
  assert.equal(result.description, "Existing description");
  assert.equal(result.screenshot, previous.screenshot);
  assert.equal(result.embeddable, true);
  assert.equal(result.frame_reason, "allowed");
  assert.equal(result.captured_at, previous.captured_at);
});

test("new participant survives a first capture failure", () => {
  const result = fallbackEntry({
    origin: "https://example.com",
    domain: "example.com",
    identity: "undeclared",
  });

  assert.deepEqual(result, {
    origin: "https://example.com",
    domain: "example.com",
    identity: "undeclared",
    title: "example.com",
    description: "",
    screenshot: "",
    embeddable: false,
    frame_reason: "unknown",
    captured_at: "",
  });
});

test("public participant remains eligible for fallback after boundary validation", async () => {
  const participant = {
    origin: "https://example.com",
    domain: "example.com",
    identity: "declined",
  };

  const previous = {
    origin: "https://example.com",
    domain: "example.com",
    identity: "affirmed",
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
  const participant = {
    origin: "https://example.com",
    domain: "example.com",
    identity: "affirmed",
  };

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
    {
      origin: "https://example.com",
      domain: "example.com",
      identity: "affirmed",
    },
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
    {
      origin: "https://example.com",
      domain: "example.com",
      identity: "declined",
    },
  ];

  const existing = [
    {
      origin: "https://example.com",
      domain: "example.com",
      identity: "affirmed",
      captured_at: new Date().toISOString(),
    },
  ];

  assert.equal(registryNeedsSync(participants, existing), true);
});

test("participant removal requires sync", () => {
  const participants = [];

  const existing = [
    {
      origin: "https://example.com",
      domain: "example.com",
      identity: "affirmed",
      captured_at: new Date().toISOString(),
    },
  ];

  assert.equal(registryNeedsSync(participants, existing), true);
});

test("stale capture requires sync", () => {
  const now = Date.parse("2026-09-15T20:00:00Z");

  const participants = [
    {
      origin: "https://example.com",
      domain: "example.com",
      identity: "undeclared",
    },
  ];

  const existing = [
    {
      ...participants[0],
      captured_at: "2026-09-14T19:59:59Z",
    },
  ];

  assert.equal(registryNeedsSync(participants, existing, now), true);
});
