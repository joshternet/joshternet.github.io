/**
 * Goal: The locked classifier answers from local files while DNS and HTTP are blocked.
 * This file is outside npm test. Run it with npm run test:classify-local.
 */

import assert from "node:assert/strict";
import dns from "node:dns";
import { readFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  acceptProposal,
  modelClaimText,
  pairSlotScores,
  slotLabels,
} from "../../scripts/uses/infer-policy.mjs";
import { loadLockedClassifier } from "../../scripts/uses/infer-local.mjs";
import { LOCK_PATH, MODEL_CACHE } from "../../scripts/uses/prepare-model.mjs";

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
    "../../test/fixtures/uses/evidence-snapshot.json",
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

  const root = fileURLToPath(new URL("../../", import.meta.url));
  const benchmark = JSON.parse(
    await readFile(
      path.join(root, "test/fixtures/uses/benchmark.json"),
      "utf8",
    ),
  );
  const categories = JSON.parse(
    await readFile(
      path.join(root, "data/uses/catalog/categories.json"),
      "utf8",
    ),
  );
  const policy = JSON.parse(
    await readFile(path.join(root, "data/classification/policy.json"), "utf8"),
  );
  const labels = slotLabels({ categories: categories.categories });
  const descriptions = labels.map((label) => label.description);
  let accepted = 0;
  let correct = 0;
  let abstained = 0;
  const scored = benchmark.examples.filter(
    (example) =>
      example.split === "category" && example.expected_slot_id !== "unsorted",
  );
  for (const example of scored) {
    const text = modelClaimText({
      name: example.name,
      section_path: example.expected_section_path,
      context: example.context,
    });
    const raw = await loaded.classify(text.presented, descriptions);
    const proposal = acceptProposal(pairSlotScores(raw, labels), {
      threshold: policy.threshold,
      margin: policy.margin,
    });
    if (!proposal.accepted) {
      abstained += 1;
      continue;
    }
    accepted += 1;
    if (proposal.slot_id === example.expected_slot_id) {
      correct += 1;
    }
  }
  const precision = accepted === 0 ? 1 : correct / accepted;
  assert.ok(benchmark.examples.length >= 75);
  assert.ok(scored.length > 0);
  assert.equal(
    precision >= 0.95,
    true,
    `accepted ${correct}/${accepted}, abstained ${abstained}, precision ${precision}`,
  );
});
