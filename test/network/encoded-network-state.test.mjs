/**
 * Goal & Constraints:
 * Prove decode-aware network state stays incremental as members grow: encoded
 * on-disk rows round-trip to clear fields, fresh captures are reused, and
 * add/remove membership still indexes remaining origins.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readJSONIfExists, writeJSONAtomic } from "../../scripts/nlp/lib.mjs";
import {
  needsScreenshotCapture,
  registryNeedsSync,
} from "../../scripts/network/state.mjs";

const MEMBER_COUNT = 12;

/**
 * Builds a synthetic network entry with clear field names.
 * @param {number} index - Member index used in the host label.
 * @param {{ capturedAt?: string, screenshot?: string }} [options]
 * @returns {Record<string, unknown>}
 */
function clearNetworkEntry(index, options = {}) {
  const host = `member${index}.joshua.example`;
  const origin = `https://${host}`;
  const capturedAt =
    typeof options.capturedAt === "string"
      ? options.capturedAt
      : new Date().toISOString();
  const screenshot =
    typeof options.screenshot === "string"
      ? options.screenshot
      : `/assets/network/sites/member${index}.webp`;

  return {
    origin,
    domain: host,
    identity: index % 3 === 0 ? "declined" : "affirmed",
    declaration: { version: 1, josh: index % 3 !== 0 },
    initial_declaration: { version: 1, josh: index % 3 !== 0 },
    first_participated_at: "2026-09-01T00:00:00.000Z",
    latest_declaration_check_at: "2026-11-01T00:00:00.000Z",
    latest_declaration_check_outcome: "valid",
    title: `Member ${index}`,
    description: `Synthetic member ${index}`,
    screenshot,
    embeddable: true,
    frame_reason: "allowed",
    captured_at: capturedAt,
  };
}

/**
 * Projects a network entry into the participant shape used by registryNeedsSync.
 * @param {Record<string, unknown>} entry
 * @returns {Record<string, unknown>}
 */
function participantFromEntry(entry) {
  return {
    origin: entry.origin,
    domain: entry.domain,
    identity: entry.identity,
    declaration: entry.declaration,
    initial_declaration: entry.initial_declaration,
    first_participated_at: entry.first_participated_at,
    latest_declaration_check_at: entry.latest_declaration_check_at,
    latest_declaration_check_outcome: entry.latest_declaration_check_outcome,
  };
}

/**
 * Indexes decoded network entries by clear origin.
 * @param {unknown} entries
 * @returns {Map<string, Record<string, unknown>>}
 */
function existingByOrigin(entries) {
  const index = new Map();

  if (!Array.isArray(entries)) {
    return index;
  }

  for (const entry of entries) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof entry.origin === "string"
    ) {
      index.set(entry.origin, /** @type {Record<string, unknown>} */ (entry));
    }
  }

  return index;
}

test("encoded network.json round-trips N members to clear origins", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "encoded-network-"));
  const networkPath = path.join(dir, "_data", "network.json");

  try {
    const clear = Array.from({ length: MEMBER_COUNT }, (_, index) =>
      clearNetworkEntry(index),
    );
    await writeJSONAtomic(networkPath, clear);

    const raw = await fs.readFile(networkPath, "utf8");
    assert.equal(raw.includes('"origin"'), false);
    assert.equal(raw.includes('"k4b"'), true);

    const decoded = await readJSONIfExists(networkPath, []);
    assert.ok(Array.isArray(decoded));
    assert.equal(decoded.length, MEMBER_COUNT);

    const byOrigin = existingByOrigin(decoded);
    assert.equal(byOrigin.size, MEMBER_COUNT);

    for (const entry of clear) {
      const loaded = byOrigin.get(/** @type {string} */ (entry.origin));
      assert.ok(loaded);
      assert.equal(loaded.domain, entry.domain);
      assert.equal(loaded.identity, entry.identity);
      assert.equal(loaded.captured_at, entry.captured_at);
      assert.equal(loaded.screenshot, entry.screenshot);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("encoded fresh captures do not need sync or screenshot capture", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "encoded-network-"));
  const networkPath = path.join(dir, "_data", "network.json");
  const screenshotDir = path.join(dir, "assets", "network", "sites");

  try {
    await fs.mkdir(screenshotDir, { recursive: true });
    const now = Date.now();
    const clear = Array.from({ length: MEMBER_COUNT }, (_, index) =>
      clearNetworkEntry(index, {
        capturedAt: new Date(now - 60_000).toISOString(),
        screenshot: `/assets/network/sites/member${index}.webp`,
      }),
    );

    for (const entry of clear) {
      const absolute = path.join(
        dir,
        String(entry.screenshot).replace(/^\/+/, ""),
      );
      await fs.writeFile(absolute, "webp");
    }

    await writeJSONAtomic(networkPath, clear);
    const decoded = await readJSONIfExists(networkPath, []);
    const participants = clear.map(participantFromEntry);

    assert.equal(registryNeedsSync(participants, decoded, now), false);

    const previousCwd = process.cwd();
    process.chdir(dir);
    try {
      for (const entry of decoded) {
        assert.equal(
          await needsScreenshotCapture(entry, { currentTime: now }),
          false,
        );
      }
    } finally {
      process.chdir(previousCwd);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("adding one member keeps prior encoded origins indexed", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "encoded-network-"));
  const networkPath = path.join(dir, "_data", "network.json");

  try {
    const prior = Array.from({ length: MEMBER_COUNT }, (_, index) =>
      clearNetworkEntry(index),
    );
    await writeJSONAtomic(networkPath, prior);

    const decoded = await readJSONIfExists(networkPath, []);
    const byOrigin = existingByOrigin(decoded);
    assert.equal(byOrigin.size, MEMBER_COUNT);

    const newcomer = clearNetworkEntry(MEMBER_COUNT);
    const nextParticipants = [
      ...prior.map(participantFromEntry),
      participantFromEntry(newcomer),
    ];

    assert.equal(registryNeedsSync(nextParticipants, decoded), true);
    assert.equal(byOrigin.has(/** @type {string} */ (newcomer.origin)), false);

    for (const entry of prior) {
      assert.ok(byOrigin.has(/** @type {string} */ (entry.origin)));
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("removing one member still resolves remaining encoded origins", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "encoded-network-"));
  const networkPath = path.join(dir, "_data", "network.json");

  try {
    const prior = Array.from({ length: MEMBER_COUNT }, (_, index) =>
      clearNetworkEntry(index),
    );
    await writeJSONAtomic(networkPath, prior);

    const decoded = await readJSONIfExists(networkPath, []);
    const byOrigin = existingByOrigin(decoded);
    const removed = prior[0];
    const remaining = prior.slice(1);

    assert.equal(
      registryNeedsSync(remaining.map(participantFromEntry), decoded),
      true,
    );
    assert.ok(byOrigin.has(/** @type {string} */ (removed.origin)));

    for (const entry of remaining) {
      const loaded = byOrigin.get(/** @type {string} */ (entry.origin));
      assert.ok(loaded);
      assert.equal(loaded.title, entry.title);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
