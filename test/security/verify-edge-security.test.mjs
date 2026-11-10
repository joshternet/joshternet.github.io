/**
 * Goal: Lock the edge verification script contract without requiring live
 * network access in every CI run, and without encoding edge product config.
 * Inputs: `scripts/security/verify-edge-security.sh` source.
 * Acceptance: script checks public machine endpoints and JoshBot UA; optional
 * probe path stays env-gated; no secrets.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Reads the edge verification shell script.
 * @returns {Promise<string>} Script source.
 */
async function readScript() {
  return readFile(
    path.join(root, "scripts/security/verify-edge-security.sh"),
    "utf8",
  );
}

test("verify-edge-security.sh covers required machine endpoints and JoshBot UA", async () => {
  const script = await readScript();

  assert.match(
    script,
    /Joshternet-Joshbot \(\+https:\/\/joshternet\.org\/joshbot\)/,
  );
  for (const needle of [
    "/robots.txt",
    "/sitemap.xml",
    "/.well-known/josh",
    "/assets/activity/atom.xml",
    "/assets/network/joshternet.opml",
    "/network/data.json",
    "/.well-known/http-message-signatures-directory",
    "/api/button-state",
  ]) {
    assert.match(
      script,
      new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.match(script, /EDGE_SECURITY_PROBE_PATH/);
  assert.doesNotMatch(script, /wp-login\.php|wp-admin|xmlrpc|phpmyadmin/);
});

test("verify-edge-security.sh warns on non-canonical host without encoding secrets", async () => {
  const script = await readScript();
  assert.match(script, /joshternet\.github\.io/);
  assert.match(script, /non-canonical host/);
  assert.match(script, /looks_like_challenge/);
  assert.doesNotMatch(
    script,
    /CLOUDFLARE_API_TOKEN|TURNSTILE_SECRET|BEGIN (RSA |OPENSSH )?PRIVATE KEY/,
  );
});

test("package.json exposes security:verify-edge", async () => {
  const pkg = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  assert.equal(
    pkg.scripts["security:verify-edge"],
    "bash scripts/security/verify-edge-security.sh",
  );
});
