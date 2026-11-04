/**
 * Goal: Lock mechanical JoshBot crawler-identity disclosure facts on /joshbot/
 * so UA, product token, identity URL, and retained/non-retained contracts cannot
 * drift unnoticed. Also locks light editorial anchors (silly-name line, visitor
 * intro fragments) without freezing full visitor prose.
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
  assert.match(page, /Meet JoshBot/);
  assert.match(page, /little crawler/);
  assert.match(page, /The name is silly\. The HTTP requests are real\./);
  assert.match(page, /Joshness is declared, never derived\./);
  assert.match(page, /Your website, your rules/);
  assert.match(
    page,
    /registry[\s\S]*isn't the network itself|isn't the network itself/i,
  );
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
  assert.match(page, /# Nominate a site for JoshBot/);
  assert.match(page, /website you control/);
  assert.match(page, /discovery seed/);
  assert.match(page, /does not join the Joshternet/i);
  assert.match(page, /\/join\//);
  assert.match(
    page,
    /Enter the public address of a website you control, for example, https:\/\/joshua\.example\./,
  );
  assert.match(page, /Nominate this site/);
  assert.match(page, /This form needs JavaScript to submit a nomination\./);
  assert.match(page, /Being crawled is not the same as participating/);
  assert.match(page, /publish a declaration without nominating/);
  assert.match(page, /data-seed-nomination-form/);
  assert.match(page, /data-seed-nomination-api/);
  assert.match(page, /owner_attestation/);

  assert.match(
    script,
    /Thanks! Your site has been added to JoshBot's nomination queue\. The little robot will consider it under its normal crawling rules\./,
  );
  assert.match(
    script,
    /That website has already been nominated\. There's no need to submit it again\./,
  );
  assert.match(
    script,
    /We couldn't submit your nomination right now\. Please try again\./,
  );
  assert.match(
    script,
    /JoshBot's nomination service couldn't be reached\. Your request hasn't been confirmed, so please try again\./,
  );
});
