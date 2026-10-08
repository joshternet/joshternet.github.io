/**
 * Goal: Local preview participants follow a valid live declaration and stay
 * out of CI. Fetch is injected because HTTP is an external boundary.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  localPreviewEnabled,
  mergePreviewParticipants,
  parsePreviewDocument,
  readPreviewFile,
  simulatedParticipants,
} from "../../scripts/network/preview.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const tempDir = path.join(root, ".tmp", "preview-tests");

const timestamps = {
  first_participated_at: "2026-10-08T02:03:29.000Z",
  latest_declaration_check_at: "2026-10-08T02:03:29.000Z",
};

/**
 * @param {string} origin
 * @returns {{ origin: string, first_participated_at: string, latest_declaration_check_at: string }}
 */
function row(origin) {
  return {
    origin,
    ...timestamps,
  };
}

/**
 * @param {{ status?: number, body?: string, headers?: Record<string, string>, textError?: unknown }} [options]
 * @returns {{ status: number, headers: { get: (name: string) => string | null }, text: () => Promise<string> }}
 */
function response({
  status = 200,
  body = "",
  headers = {},
  textError = null,
} = {}) {
  return {
    status,
    headers: {
      /**
       * @param {string} name
       * @returns {string | null}
       */
      get(name) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
    /**
     * @returns {Promise<string>}
     */
    text: async () => {
      if (textError) {
        throw textError;
      }

      return body;
    },
  };
}

test("local preview is off in CI and GitHub Actions", () => {
  assert.equal(typeof localPreviewEnabled(), "boolean");
  assert.equal(localPreviewEnabled({}), true);
  assert.equal(localPreviewEnabled({ CI: "false" }), true);
  assert.equal(localPreviewEnabled({ CI: "true" }), false);
  assert.equal(localPreviewEnabled({ CI: "1" }), false);
  assert.equal(localPreviewEnabled({ GITHUB_ACTIONS: "true" }), false);
});

test("preview document rejects the wrong shape", () => {
  assert.throws(
    () => parsePreviewDocument(null),
    /preview document must be an object/,
  );
  assert.throws(
    () => parsePreviewDocument([]),
    /preview document must be an object/,
  );
  assert.throws(
    () => parsePreviewDocument({ schema_version: 2, participants: [] }),
    /schema_version must be 1/,
  );
  assert.throws(
    () => parsePreviewDocument({ schema_version: 1 }),
    /participants must be an array/,
  );
  assert.throws(
    () =>
      parsePreviewDocument({
        schema_version: 1,
        participants: [null],
      }),
    /preview participant must be an object/,
  );
  assert.throws(
    () =>
      parsePreviewDocument({
        schema_version: 1,
        participants: [[]],
      }),
    /preview participant must be an object/,
  );
  assert.throws(
    () =>
      parsePreviewDocument({
        schema_version: 1,
        participants: [{ ...timestamps }],
      }),
    /origin must be a non-empty canonical URL/,
  );
  assert.throws(
    () =>
      parsePreviewDocument({
        schema_version: 1,
        participants: [
          row("https://joshmuller.ca"),
          row("https://joshmuller.ca"),
        ],
      }),
    /duplicate preview origin/,
  );
  assert.throws(
    () =>
      parsePreviewDocument({
        schema_version: 1,
        participants: [
          {
            origin: "https://joshmuller.ca",
            latest_declaration_check_at: timestamps.latest_declaration_check_at,
          },
        ],
      }),
    /invalid registry first_participated_at/,
  );
  assert.throws(
    () =>
      parsePreviewDocument({
        schema_version: 1,
        participants: [
          {
            origin: "https://joshmuller.ca",
            first_participated_at: "yesterday",
            latest_declaration_check_at: timestamps.latest_declaration_check_at,
          },
        ],
      }),
    /invalid registry first_participated_at/,
  );
});

test("preview file reads, misses, and rejects bad JSON", async () => {
  await fs.mkdir(tempDir, { recursive: true });
  const missing = path.join(tempDir, "missing.json");
  const invalid = path.join(tempDir, "invalid.json");

  await fs.rm(missing, { force: true });
  await fs.writeFile(invalid, "{", "utf8");

  const empty = await readPreviewFile(missing);
  assert.deepEqual(empty.participants, []);

  await assert.rejects(readPreviewFile(tempDir), (error) => {
    assert.equal(error.code, "EISDIR");
    return true;
  });
  await assert.rejects(readPreviewFile(invalid), SyntaxError);

  const committed = await readPreviewFile(
    path.join(root, "_data/network_preview.json"),
  );
  assert.deepEqual(committed.participants, []);
});

test("simulated participants keep a valid declaration and skip the rest", async () => {
  const affirmed = '{"version":1,"josh":true}\n';
  const calls = [];

  const fetchImpl = async (url) => {
    calls.push(String(url));
    const target = String(url);

    if (target === "https://joshmuller.ca/.well-known/josh") {
      return response({
        body: affirmed,
        headers: { "content-type": "application/json" },
      });
    }

    if (target === "https://declined.example/.well-known/josh") {
      return response({
        body: '{"version":1,"josh":false}',
        headers: { "content-type": "application/json" },
      });
    }

    if (target === "https://undeclared.example/.well-known/josh") {
      return response({
        body: '{"version":1}',
        headers: { "content-type": "" },
      });
    }

    if (target === "https://missing.example/.well-known/josh") {
      return response({ status: 404, body: "nope" });
    }

    if (target === "https://broken.example/.well-known/josh") {
      return response({
        status: 400,
        body: "no",
        headers: { location: "https://broken.example/elsewhere" },
      });
    }

    if (target === "https://invalid.example/.well-known/josh") {
      return response({ body: "{" });
    }

    if (target === "https://redirect.example/.well-known/josh") {
      return response({
        status: 302,
        headers: { location: "/declaration.json" },
      });
    }

    if (target === "https://redirect.example/declaration.json") {
      return response({
        body: affirmed,
        headers: { "content-type": "application/json" },
      });
    }

    if (target === "https://cross.example/.well-known/josh") {
      return response({
        status: 302,
        headers: { location: "https://other.example/.well-known/josh" },
      });
    }

    if (target === "https://nolocation.example/.well-known/josh") {
      return response({ status: 302, body: "" });
    }

    if (target === "https://badlocation.example/.well-known/josh") {
      return response({
        status: 302,
        headers: { location: "http://[" },
      });
    }

    if (target === "https://bodyfail.example/.well-known/josh") {
      return response({ textError: "body failed" });
    }

    if (target.startsWith("https://loop.example/")) {
      return response({
        status: 302,
        headers: { location: "/.well-known/josh" },
      });
    }

    if (target.startsWith("https://chain.example/step-")) {
      const step = Number(target.slice("https://chain.example/step-".length));

      if (step < 5) {
        return response({
          status: 302,
          headers: { location: `/step-${step + 1}` },
        });
      }

      return response({
        body: affirmed,
        headers: { "content-type": "application/json" },
      });
    }

    if (target === "https://chain.example/.well-known/josh") {
      return response({
        status: 302,
        headers: { location: "/step-1" },
      });
    }

    if (target === "https://offline.example/.well-known/josh") {
      throw new Error("offline");
    }

    if (target === "https://stringfail.example/.well-known/josh") {
      throw "network down";
    }

    throw new Error(`unexpected ${target}`);
  };

  await assert.rejects(
    simulatedParticipants([row("https://joshmuller.ca")]),
    /preview fetch implementation is required/,
  );

  const result = await simulatedParticipants(
    [
      row("https://joshmuller.ca"),
      row("https://declined.example"),
      row("https://undeclared.example"),
      row("https://missing.example"),
      row("https://broken.example"),
      row("https://invalid.example"),
      row("https://redirect.example"),
      row("https://cross.example"),
      row("https://nolocation.example"),
      row("https://badlocation.example"),
      row("https://bodyfail.example"),
      row("https://loop.example"),
      row("https://chain.example"),
      row("https://offline.example"),
      row("https://stringfail.example"),
    ],
    { fetchImpl },
  );

  const byOrigin = new Map(
    result.participants.map((participant) => [participant.origin, participant]),
  );

  assert.equal(byOrigin.get("https://joshmuller.ca").identity, "affirmed");
  assert.deepEqual(byOrigin.get("https://joshmuller.ca").declaration, {
    version: 1,
    josh: true,
  });
  assert.equal(byOrigin.get("https://declined.example").identity, "declined");
  assert.equal(
    byOrigin.get("https://undeclared.example").identity,
    "undeclared",
  );
  assert.equal(byOrigin.get("https://redirect.example").declaration.josh, true);
  assert.equal(byOrigin.get("https://chain.example").identity, "affirmed");
  assert.equal(byOrigin.get("https://joshmuller.ca").domain, "joshmuller.ca");
  assert.equal(
    byOrigin.get("https://joshmuller.ca").latest_declaration_check_outcome,
    "valid",
  );

  const skipped = new Map(
    result.skipped.map((entry) => [entry.origin, entry.reason]),
  );
  assert.match(skipped.get("https://missing.example"), /not publishing/);
  assert.match(skipped.get("https://broken.example"), /could not be read/);
  assert.match(skipped.get("https://invalid.example"), /not valid JSON/);
  assert.equal(
    skipped.get("https://cross.example"),
    "redirected to a different origin",
  );
  assert.match(skipped.get("https://nolocation.example"), /could not be read/);
  assert.match(skipped.get("https://badlocation.example"), /Invalid URL/);
  assert.equal(skipped.get("https://bodyfail.example"), "body failed");
  assert.equal(skipped.get("https://loop.example"), "too many redirects");
  assert.equal(skipped.get("https://offline.example"), "offline");
  assert.equal(skipped.get("https://stringfail.example"), "network down");
  assert.ok(calls.includes("https://joshmuller.ca/.well-known/josh"));
});

test("merge keeps registry rows and sorts new preview origins", () => {
  const preview = {
    origin: "https://joshmuller.ca",
    identity: "affirmed",
  };
  const merged = mergePreviewParticipants(
    [
      { origin: "https://joshtronic.com" },
      null,
      { title: "missing origin" },
      { origin: "https://joshghent.com" },
    ],
    [
      null,
      { origin: 12 },
      preview,
      { origin: "https://joshghent.com", identity: "duplicate" },
    ],
  );

  assert.deepEqual(
    merged.map((entry) => entry.origin),
    [
      "https://joshghent.com",
      "https://joshmuller.ca",
      "https://joshtronic.com",
    ],
  );
  assert.equal(merged[1], preview);

  const onlyPreview = mergePreviewParticipants(null, [preview]);
  assert.deepEqual(onlyPreview, [preview]);
  assert.deepEqual(mergePreviewParticipants([], undefined), []);
  assert.deepEqual(
    mergePreviewParticipants(
      [
        { origin: "https://joshghent.com" },
        { origin: "https://joshghent.com" },
      ],
      [],
    ).map((entry) => entry.origin),
    ["https://joshghent.com"],
  );
});

test("network sync applies preview only through localPreviewEnabled", async () => {
  const source = await fs.readFile(
    path.join(root, "scripts/network/sync.mjs"),
    "utf8",
  );

  assert.match(source, /if \(localPreviewEnabled\(\)\)/);
  assert.match(source, /readPreviewFile/);
  assert.match(source, /simulatedParticipants/);
  assert.match(source, /mergePreviewParticipants/);
});
