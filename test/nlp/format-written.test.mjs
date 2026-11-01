/**
 * Goal: Cover format helpers so sync-written files stay Prettier-clean and
 * scheduled updates never abort solely because Prettier skipped a file.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  GENERATED_PRETTIER_GLOBS,
  formatGeneratedOutputs,
  formatTextForPath,
  resolveGeneratedPaths,
} from "../../scripts/format-written.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

test("GENERATED_PRETTIER_GLOBS covers sync-written Prettier targets", () => {
  assert.ok(GENERATED_PRETTIER_GLOBS.includes("_data/*.json"));
  assert.ok(GENERATED_PRETTIER_GLOBS.includes("assets/network/*.opml"));
  assert.ok(GENERATED_PRETTIER_GLOBS.includes("assets/activity/*.xml"));
  assert.ok(
    GENERATED_PRETTIER_GLOBS.includes("assets/css/elsewhere-glyphs.css"),
  );
});

test("resolveGeneratedPaths: expands dir/*.ext and concrete files", async () => {
  const paths = await resolveGeneratedPaths(REPO_ROOT, [
    "_data/*.json",
    "assets/css/elsewhere-glyphs.css",
  ]);

  assert.ok(paths.some((p) => p.endsWith(`${path.sep}network.json`)));
  assert.ok(paths.some((p) => p.endsWith(`${path.sep}elsewhere-glyphs.css`)));
});

test("resolveGeneratedPaths: missing directory yields empty list", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "format-missing-dir-"));

  try {
    const paths = await resolveGeneratedPaths(dir, ["nope/*.json"]);
    assert.deepEqual(paths, []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("resolveGeneratedPaths: missing concrete file is skipped", async () => {
  const paths = await resolveGeneratedPaths(REPO_ROOT, [
    "assets/css/does-not-exist-glyphs.css",
  ]);
  assert.deepEqual(paths, []);
});

test("resolveGeneratedPaths: rejects unsupported glob shapes", async () => {
  await assert.rejects(
    () => resolveGeneratedPaths(REPO_ROOT, ["_data/file*.json"]),
    /Unsupported generated Prettier glob/,
  );
});

test("formatTextForPath: formats messy JSON with repo Prettier config", async () => {
  const messy = '{"alpha":1,"beta":2}';
  const filePath = path.join(REPO_ROOT, "_data", "format-written-probe.json");
  const formatted = await formatTextForPath(filePath, messy, {
    root: REPO_ROOT,
  });

  assert.notEqual(formatted, messy);
  assert.equal(JSON.parse(formatted).alpha, 1);
  assert.match(formatted, /\n$/);
  assert.ok(formatted.includes("\n"));
});

test("formatTextForPath: formats CSS", async () => {
  const messy = ".elsewhere-glyph--x{background-position:0 0}";
  const filePath = path.join(
    REPO_ROOT,
    "assets/css/elsewhere-glyphs-probe.css",
  );
  const formatted = await formatTextForPath(filePath, messy, {
    root: REPO_ROOT,
  });

  assert.notEqual(formatted, messy);
  assert.match(formatted, /\{\n/);
});

test("formatTextForPath: returns text unchanged when no parser (binary-ish ext)", async () => {
  const raw = "not-a-prettier-target";
  const filePath = path.join(REPO_ROOT, "assets/network/sites/probe.webp");
  const formatted = await formatTextForPath(filePath, raw, {
    root: REPO_ROOT,
  });

  assert.equal(formatted, raw);
});

test("formatTextForPath: returns text unchanged for prettierignored markdown", async () => {
  const raw = "# Title\n\n*item*\n";
  const filePath = path.join(REPO_ROOT, "README.md");
  const formatted = await formatTextForPath(filePath, raw, {
    root: REPO_ROOT,
  });

  assert.equal(formatted, raw);
});

test("formatTextForPath: empty root option falls back to repo root", async () => {
  const messy = '{"k":1}';
  const filePath = path.join(REPO_ROOT, "_data", "format-written-probe.json");
  const formatted = await formatTextForPath(filePath, messy, { root: "" });
  assert.equal(JSON.parse(formatted).k, 1);
  assert.match(formatted, /\n$/);
});

test("formatTextForPath: uses package.json Prettier config for paths outside the repo", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "format-outside-"));
  const filePath = path.join(dir, "lonely.json");

  try {
    const formatted = await formatTextForPath(filePath, '{"a":1}', {
      root: REPO_ROOT,
    });
    assert.equal(JSON.parse(formatted).a, 1);
    assert.match(formatted, /\n$/);
    assert.ok(formatted.includes("\n"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("formatTextForPath: default options use repo root", async () => {
  const filePath = path.join(REPO_ROOT, "_data", "format-written-probe.json");
  const formatted = await formatTextForPath(filePath, '{"solo":true}');
  assert.equal(JSON.parse(formatted).solo, true);
});

test("formatTextForPath: invalid JSON keeps original text instead of throwing", async () => {
  const raw = "{not-json";
  const filePath = path.join(REPO_ROOT, "_data", "format-written-probe.json");
  const formatted = await formatTextForPath(filePath, raw, {
    root: REPO_ROOT,
  });
  assert.equal(formatted, raw);
});

test("formatTextForPath: strict mode rethrows format failures", async () => {
  const raw = "{not-json";
  const filePath = path.join(REPO_ROOT, "_data", "format-written-probe.json");
  await assert.rejects(
    () =>
      formatTextForPath(filePath, raw, {
        root: REPO_ROOT,
        strict: true,
      }),
    /JSON|Syntax|Unexpected/i,
  );
});

test("formatTextForPath: getFileInfo failure keeps original text", async () => {
  const raw = '{"keep":true}';
  const formatted = await formatTextForPath(
    path.join(REPO_ROOT, "_data", "format-written-probe.json"),
    raw,
    {
      root: REPO_ROOT,
      prettierApi: {
        async getFileInfo() {
          throw new Error("getFileInfo boom");
        },
        async resolveConfig() {
          return null;
        },
        async format() {
          return raw;
        },
      },
    },
  );
  assert.equal(formatted, raw);
});

test("formatTextForPath: strict getFileInfo failure throws", async () => {
  await assert.rejects(
    () =>
      formatTextForPath(
        path.join(REPO_ROOT, "_data", "format-written-probe.json"),
        '{"keep":true}',
        {
          root: REPO_ROOT,
          strict: true,
          prettierApi: {
            async getFileInfo() {
              throw new Error("getFileInfo boom");
            },
            async resolveConfig() {
              return null;
            },
            async format() {
              return "{}";
            },
          },
        },
      ),
    /getFileInfo boom/,
  );
});

test("formatTextForPath: resolveConfig failure keeps original text", async () => {
  const raw = '{"keep":true}';
  const formatted = await formatTextForPath(
    path.join(REPO_ROOT, "_data", "format-written-probe.json"),
    raw,
    {
      root: REPO_ROOT,
      prettierApi: {
        async getFileInfo() {
          return { ignored: false, inferredParser: "json" };
        },
        async resolveConfig() {
          throw new Error("resolveConfig boom");
        },
        async format() {
          return raw;
        },
      },
    },
  );
  assert.equal(formatted, raw);
});

test("formatTextForPath: strict resolveConfig failure throws", async () => {
  await assert.rejects(
    () =>
      formatTextForPath(
        path.join(REPO_ROOT, "_data", "format-written-probe.json"),
        '{"keep":true}',
        {
          root: REPO_ROOT,
          strict: true,
          prettierApi: {
            async getFileInfo() {
              return { ignored: false, inferredParser: "json" };
            },
            async resolveConfig() {
              throw new Error("resolveConfig boom");
            },
            async format() {
              return "{}";
            },
          },
        },
      ),
    /resolveConfig boom/,
  );
});

test("resolveGeneratedPaths: directory path for concrete pattern is skipped", async () => {
  const paths = await resolveGeneratedPaths(REPO_ROOT, ["_data"]);
  assert.deepEqual(paths, []);
});

test("formatGeneratedOutputs: writes Prettier output for provided globs", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "format-generated-"));
  const filePath = path.join(dir, "messy.json");
  const hiddenPath = path.join(dir, ".hidden.json");

  try {
    await fs.writeFile(filePath, '{"z":1,"a":2}', "utf8");
    await fs.writeFile(hiddenPath, '{"hidden":true}', "utf8");
    await formatGeneratedOutputs({
      root: dir,
      globs: ["*.json"],
    });
    const content = await fs.readFile(filePath, "utf8");
    assert.deepEqual(JSON.parse(content), { z: 1, a: 2 });
    assert.notEqual(content, '{"z":1,"a":2}');
    assert.match(content, /\n$/);
    assert.equal(await fs.readFile(hiddenPath, "utf8"), '{"hidden":true}');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("formatGeneratedOutputs: default options format repo generated outputs", async () => {
  await formatGeneratedOutputs();
});

test("formatGeneratedOutputs: empty globs array uses GENERATED_PRETTIER_GLOBS", async () => {
  await formatGeneratedOutputs({ root: REPO_ROOT, globs: [] });
});

test("formatGeneratedOutputs: non-array globs use GENERATED_PRETTIER_GLOBS", async () => {
  await formatGeneratedOutputs({
    root: REPO_ROOT,
    globs: "not-an-array",
  });
});

test("formatGeneratedOutputs: already-formatted file is left unchanged", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "format-stable-"));
  const filePath = path.join(dir, "stable.json");
  const formatted = await formatTextForPath(filePath, '{"ok":true}', {
    root: REPO_ROOT,
  });

  try {
    await fs.writeFile(filePath, formatted, "utf8");
    const before = await fs.readFile(filePath, "utf8");
    await formatGeneratedOutputs({ root: dir, globs: ["*.json"] });
    const after = await fs.readFile(filePath, "utf8");
    assert.equal(after, before);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("formatGeneratedOutputs: strict mode writes when formatting changes bytes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "format-strict-write-"));
  const filePath = path.join(dir, "messy.json");

  try {
    await fs.writeFile(filePath, '{"z":1,"a":2}', "utf8");
    await formatGeneratedOutputs({
      root: dir,
      globs: ["*.json"],
      strict: true,
    });
    const content = await fs.readFile(filePath, "utf8");
    assert.deepEqual(JSON.parse(content), { z: 1, a: 2 });
    assert.notEqual(content, '{"z":1,"a":2}');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("formatGeneratedOutputs: strict mode fails closed on Prettier errors", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "format-strict-"));
  const filePath = path.join(dir, "bad.json");

  try {
    await fs.writeFile(filePath, "{not-json", "utf8");
    await assert.rejects(
      () =>
        formatGeneratedOutputs({
          root: dir,
          globs: ["*.json"],
          strict: true,
        }),
      /Prettier failed/,
    );
    assert.equal(await fs.readFile(filePath, "utf8"), "{not-json");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("formatGeneratedOutputs: strict mode stringifies non-Error throw values", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "format-strict-str-"));
  const filePath = path.join(dir, "ok.json");

  try {
    await fs.writeFile(filePath, '{"a":1}\n', "utf8");
    await assert.rejects(
      () =>
        formatGeneratedOutputs({
          root: dir,
          globs: ["*.json"],
          strict: true,
          prettierApi: {
            async getFileInfo() {
              return { ignored: false, inferredParser: "json" };
            },
            async resolveConfig() {
              return {};
            },
            async format() {
              throw "plain-string-boom";
            },
          },
        }),
      /plain-string-boom/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
