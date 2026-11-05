/**
 * Goal: Post-validation next steps and build-time registry listing helpers.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildNextSteps,
  parseRegistryOrigins,
  registryListingState,
} from "../../assets/js/declaration-continuity.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("parseRegistryOrigins keeps https origins and rejects junk", () => {
  const set = parseRegistryOrigins(
    '["https://a.example/","https://b.example","ftp://no","",12]',
  );

  assert.ok(set instanceof Set);
  assert.equal(set.has("https://a.example"), true);
  assert.equal(set.has("https://b.example"), true);
  assert.equal(set.size, 2);
  assert.equal(parseRegistryOrigins(""), null);
  assert.equal(parseRegistryOrigins("{"), null);
  assert.equal(parseRegistryOrigins('"nope"'), null);
});

test("registryListingState distinguishes listed not-listed and unavailable", () => {
  const listed = new Set(["https://listed.example"]);

  assert.equal(
    registryListingState("https://listed.example/", listed),
    "listed",
  );
  assert.equal(
    registryListingState("https://other.example", listed),
    "not-listed",
  );
  assert.equal(
    registryListingState("https://listed.example", null),
    "unavailable",
  );
  assert.equal(registryListingState("not-a-url", listed), "unavailable");
});

test("buildNextSteps keeps declaration and registry as independent facts", () => {
  const paste = buildNextSteps({ hasOrigin: false });

  assert.match(paste.declarationFact, /valid/i);
  assert.equal(paste.registryFact, null);
  assert.match(paste.body, /\/\.well-known\/josh/);
  assert.ok(typeof paste.body === "string" && paste.body.trim().length > 0);

  const listed = buildNextSteps({
    hasOrigin: true,
    registryState: "listed",
  });

  assert.match(listed.registryFact, /currently listed/i);
  assert.doesNotMatch(listed.registryFact, /not currently listed/i);
  assert.ok(typeof listed.body === "string" && listed.body.trim().length > 0);

  const waiting = buildNextSteps({
    hasOrigin: true,
    registryState: "not-listed",
  });

  assert.match(waiting.registryFact, /not currently listed/i);
  assert.ok(typeof waiting.body === "string" && waiting.body.trim().length > 0);

  const unknown = buildNextSteps({
    hasOrigin: true,
    registryState: "unavailable",
  });

  assert.match(unknown.registryFact, /unavailable/i);

  for (const steps of [paste, listed, waiting, unknown]) {
    assert.ok(steps.links.some((link) => link.href === "/network/"));
    assert.ok(steps.links.some((link) => link.href === "/nominate/"));
    assert.ok(steps.links.some((link) => link.href === "/join/"));
    assert.doesNotMatch(JSON.stringify(steps), /https:\/\/user-entered/);
  }
});

test("validate page embeds registry origins and no-JS continuity copy", async () => {
  const page = await read("implement/validate.md");
  const check = await read("assets/js/declaration-check.js");
  const continuity = await read("assets/js/declaration-continuity.js");

  assert.match(page, /^title: Check a Declaration$/m);
  assert.match(page, /data-declaration-registry-origins/);
  assert.match(page, /site\.data\.network/);
  assert.match(page, /\/nominate\//);
  assert.match(page, /\/network\//);
  assert.match(page, /joshua\.example/);
  assert.match(check, /buildNextSteps/);
  assert.match(check, /registryListingState/);
  assert.match(check, /data-declaration-next-steps/);
  assert.doesNotMatch(check, /joshternetTrack/);
  assert.doesNotMatch(continuity, /joshternetTrack/);
});
