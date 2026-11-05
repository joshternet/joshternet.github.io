/**
 * Goal: Lock mechanical JoshBot crawler-identity disclosure facts on /joshbot/
 * and Nominate form wiring—UA, product token, identity URL, retention links,
 * and form data hooks—without freezing visitor marketing prose.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Reads a UTF-8 file relative to the repository root.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<string>} File contents.
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("JoshBot disclosure keeps crawler identity and retention contracts", async () => {
  const page = await read("joshbot.md");

  assert.match(page, /permalink: \/joshbot\//);
  assert.match(page, /^title: JoshBot$/m);
  assert.match(page, /Joshness is declared, never derived\./);
  assert.match(
    page,
    /Joshternet-Joshbot \(\+https:\/\/joshternet\.org\/joshbot\)/,
  );
  assert.match(page, /Joshternet-Joshbot/);
  assert.match(page, /https:\/\/joshternet\.org\/joshbot/);
  assert.match(page, /User-agent: Joshternet-Joshbot\nDisallow: \//);
  assert.match(page, /sanitized requested and final page URLs/);
  assert.match(page, /complete page bodies/);
  assert.match(page, /not a web archive/i);
  assert.match(page, /does not train models/i);
  assert.match(
    page,
    /https:\/\/github\.com\/joshternet\/joshbot\/blob\/main\/docs\/retention\.md/,
  );
  assert.match(
    page,
    /https:\/\/github\.com\/joshternet\/joshbot\/issues\/new\?template=crawler_report\.yml/,
  );
  assert.match(
    page,
    /https:\/\/github\.com\/joshternet\/joshbot\/security\/advisories\/new/,
  );
  assert.doesNotMatch(page, /does not retain:[\s\S]*page depth/i);
  assert.doesNotMatch(page, /internal page history/);
});

test("Nominate page keeps ownership framing and form contracts", async () => {
  const page = await read("nominate.md");
  const script = await read("assets/js/nominate.js");

  assert.match(page, /permalink: \/nominate\//);
  assert.match(page, /^title: Nominate a Site$/m);
  assert.match(page, /\/join\//);
  assert.match(page, /joshua\.example/);
  assert.match(page, /data-seed-nomination-form/);
  assert.match(page, /data-seed-nomination-api/);
  assert.match(page, /owner_attestation/);

  assert.match(script, /data-seed-nomination-status/);
  assert.match(script, /owner_attestation/);
  assert.match(script, /status === "accepted"/);
  assert.match(script, /status === "already_nominated"/);
  assert.match(script, /nominate-submit/);
});
