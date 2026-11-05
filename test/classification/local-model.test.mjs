/**
 * Goal: The locked classifier answers from local files while DNS and HTTP are blocked.
 * This file is outside npm test. Run it with npm run test:classify-local.
 */

import assert from "node:assert/strict";
import dns from "node:dns";
import { readFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import test from "node:test";

import { LOCK_PATH, MODEL_CACHE } from "../../scripts/uses/prepare-model.mjs";
import { loadLockedClassifier } from "../../scripts/uses/infer-local.mjs";

test("classification makes no outbound request", async () => {
  const blocked = (target) => {
    const error = new Error(`network blocked: ${target}`);
    error.code = "ENETUNREACH";
    return error;
  };
  dns.lookup = (_hostname, options, callback) => {
    const done = typeof options === "function" ? options : callback;
    done(blocked("dns"));
  };
  dns.promises.lookup = async (hostname) => {
    throw blocked(hostname);
  };
  const rejectRequest = () => {
    throw blocked("http");
  };
  http.request = rejectRequest;
  https.request = rejectRequest;
  http.get = rejectRequest;
  https.get = rejectRequest;
  globalThis.fetch = async (url) => {
    throw blocked(String(url));
  };

  const loaded = await loadLockedClassifier({
    lockPath: LOCK_PATH,
    localModelPath: MODEL_CACHE,
    requestedModelId: "Xenova/nli-deberta-v3-xsmall",
  });
  const result = await loaded.classify(
    "I use a mechanical keyboard every day.",
    ["a keyboard", "a lamp"],
  );
  assert.equal(typeof result.scores[0], "number");
  assert.ok(result.labels.includes("a keyboard"));

  const snapshotPath = new URL(
    "../../data/classification/evidence-snapshot.json",
    import.meta.url,
  );
  const before = await readFile(snapshotPath, "utf8");
  const snapshot = JSON.parse(before);
  for (const record of snapshot.records) {
    const scored = await loaded.classify(record.target_text, [
      "a keyboard",
      "a lamp",
    ]);
    assert.equal(typeof scored.scores[0], "number");
    assert.equal(record.target_text, "CODE Keyboard");
  }
  assert.equal(await readFile(snapshotPath, "utf8"), before);
});
