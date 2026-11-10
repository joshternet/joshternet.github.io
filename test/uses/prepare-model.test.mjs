/**
 * Prepare-model: revision-prefixed Hub cache must flatten to lock paths.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  promoteRevisionCache,
  revisionPrefixedPath,
} from "../../scripts/uses/prepare-model.mjs";

test("revisionPrefixedPath inserts the revision after the model id", () => {
  assert.equal(
    revisionPrefixedPath(
      "Xenova/nli-deberta-v3-xsmall/onnx/model_quantized.onnx",
      "Xenova/nli-deberta-v3-xsmall",
      "abc123",
    ),
    "Xenova/nli-deberta-v3-xsmall/abc123/onnx/model_quantized.onnx",
  );
  assert.equal(
    revisionPrefixedPath(
      "Xenova/nli-deberta-v3-xsmall/config.json",
      "Xenova/nli-deberta-v3-xsmall",
      "abc123",
    ),
    "Xenova/nli-deberta-v3-xsmall/abc123/config.json",
  );
  assert.equal(
    revisionPrefixedPath(
      "other/model/config.json",
      "Xenova/nli-deberta-v3-xsmall",
      "abc123",
    ),
    "",
  );
  assert.equal(
    revisionPrefixedPath(
      "Xenova/nli-deberta-v3-xsmall/config.json",
      "Xenova/nli-deberta-v3-xsmall",
      "",
    ),
    "",
  );
  assert.equal(
    revisionPrefixedPath(
      "Xenova/nli-deberta-v3-xsmall/config.json",
      "Xenova/nli-deberta-v3-xsmall",
      "main",
    ),
    "",
  );
});

test("promoteRevisionCache moves Hub revision paths into the lock layout", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "joshternet-prepare-"));
  try {
    const modelId = "Xenova/nli-deberta-v3-xsmall";
    const revision = "2a4f614a701367a02d51389039afc998faeda637";
    const lockFiles = [
      { path: `${modelId}/config.json`, sha256: "a" },
      { path: `${modelId}/onnx/model_quantized.onnx`, sha256: "b" },
    ];
    const revisionRoot = path.join(root, modelId, revision);
    await mkdir(path.join(revisionRoot, "onnx"), { recursive: true });
    await writeFile(path.join(revisionRoot, "config.json"), "config-bytes");
    await writeFile(
      path.join(revisionRoot, "onnx", "model_quantized.onnx"),
      "onnx-bytes",
    );

    const moved = await promoteRevisionCache(root, {
      model_id: modelId,
      revision,
      files: lockFiles,
    });
    assert.equal(moved, true);
    assert.equal(
      await readFile(path.join(root, modelId, "config.json"), "utf8"),
      "config-bytes",
    );
    assert.equal(
      await readFile(
        path.join(root, modelId, "onnx", "model_quantized.onnx"),
        "utf8",
      ),
      "onnx-bytes",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("promoteRevisionCache is a no-op when lock paths already exist", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "joshternet-prepare-"));
  try {
    const modelId = "Org/model";
    const revision = "deadbeef";
    await mkdir(path.join(root, modelId), { recursive: true });
    await writeFile(path.join(root, modelId, "config.json"), "already-flat");
    await mkdir(path.join(root, modelId, revision), { recursive: true });
    await writeFile(path.join(root, modelId, revision, "config.json"), "rev");

    const moved = await promoteRevisionCache(root, {
      model_id: modelId,
      revision,
      files: [{ path: `${modelId}/config.json`, sha256: "a" }],
    });
    assert.equal(moved, false);
    assert.equal(
      await readFile(path.join(root, modelId, "config.json"), "utf8"),
      "already-flat",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
