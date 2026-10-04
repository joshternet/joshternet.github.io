/**
 * Goal: Local preview script starts Jekyll + Workers without killing servers.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("dev script help and dry-run stay non-interactive", async () => {
  const script = path.join(root, "scripts/dev.sh");
  const help = await execFileAsync("bash", [script, "--help"], { cwd: root });

  assert.match(help.stdout, /http:\/\/127\.0\.0\.1:4000/);
  assert.match(help.stdout, /http:\/\/0\.0\.0\.0:4000/);
  assert.match(help.stdout, /this-machine-lan-ip/);
  assert.match(help.stdout, /8790/);
  assert.match(help.stdout, /8789/);
  assert.match(help.stdout, /8787/);
  assert.match(help.stdout, /LiveReload/);
  assert.match(help.stdout, /--dry-run/);
  assert.doesNotMatch(help.stdout, /pkill|kill -9|lsof|fuser/i);

  const dry = await execFileAsync("bash", [script, "--dry-run"], { cwd: root });

  assert.match(dry.stdout, /jekyll serve/);
  assert.match(dry.stdout, /--host 0\.0\.0\.0/);
  assert.match(dry.stdout, /--livereload/);
  assert.match(dry.stdout, /workers\/joshternet-button/);
  assert.match(dry.stdout, /workers\/declaration-check/);
  assert.match(dry.stdout, /workers\/seed-nominations/);
  assert.equal(dry.stderr, "");

  await assert.rejects(
    () => execFileAsync("bash", [script, "--explode"], { cwd: root }),
    (error) => {
      assert.equal(error.code, 2);
      assert.match(String(error.stderr), /unknown option/);
      assert.match(String(error.stderr), /--help/);
      return true;
    },
  );
});

test("dev script and development CSP do not kill processes", async () => {
  const script = await read("scripts/dev.sh");
  const pkg = await read("package.json");
  const layout = await read("_layouts/default.html");
  const buttonPkg = await read("workers/joshternet-button/package.json");
  const checkPkg = await read("workers/declaration-check/package.json");
  const nominatePkg = await read("workers/seed-nominations/package.json");

  assert.match(pkg, /"dev": "bash scripts\/dev\.sh"/);
  assert.match(script, /JEKYLL_HOST="0\.0\.0\.0"/);
  assert.doesNotMatch(script, /pkill|kill -9|lsof|fuser/i);
  assert.match(layout, /http:\/\/127\.0\.0\.1:35729/);
  assert.match(layout, /ws:\/\/127\.0\.0\.1:35729/);
  assert.match(
    buttonPkg,
    /--ip 127\.0\.0\.1 --port 8790 --inspector-port 9230/,
  );
  assert.match(checkPkg, /--ip 127\.0\.0\.1 --port 8789 --inspector-port 9231/);
  assert.match(
    nominatePkg,
    /--ip 127\.0\.0\.1 --port 8787 --inspector-port 9232/,
  );
});
