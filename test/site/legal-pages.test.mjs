/**
 * Goal: Lock permalinks, footer order, and contractual facts on Privacy and
 * Terms without treating visitor prose as an oracle.
 */
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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

/**
 * Whether a path exists under the repository root.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<boolean>} True when the file can be opened.
 */
async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

test("privacy and terms keep permalinks and operated-service facts", async () => {
  const privacy = await read("privacy.md");
  const terms = await read("terms.md");

  assert.match(privacy, /permalink: \/privacy\//);
  assert.match(terms, /permalink: \/terms\//);
  assert.match(privacy, /5 October 2026/);
  assert.match(terms, /5 October 2026/);
  assert.match(privacy, /\{: \.legal-dates\}/);
  assert.match(terms, /\{: \.legal-dates\}/);
  assert.doesNotMatch(privacy, /This page covers/);
  assert.doesNotMatch(privacy, /It does not replace/);
  assert.doesNotMatch(privacy, /No Joshternet accounts/);
  assert.doesNotMatch(privacy, /mailing lists, or newsletters/);
  assert.doesNotMatch(terms, /These terms apply to/);
  assert.doesNotMatch(
    privacy,
    /# Privacy\s*\n\s*Effective/,
    "dates must not lead the Privacy page",
  );
  assert.doesNotMatch(
    terms,
    /# Terms\s*\n\s*Effective/,
    "dates must not lead the Terms page",
  );

  assert.match(privacy, /## Official buttons/);
  assert.doesNotMatch(
    privacy,
    /GET https:\/\/joshternet\.org\/api\/button-state/,
  );
  assert.match(privacy, /does not visit/);
  assert.match(privacy, /site’s server/);
  assert.match(privacy, /not each visitor’s browser/);
  assert.match(privacy, /\/\.well-known\/josh/);
  assert.match(privacy, /Turnstile/);
  assert.match(privacy, /not stored/);
  assert.match(privacy, /\/joshbot\//);
  assert.match(
    privacy,
    /https:\/\/github\.com\/joshternet\/joshbot\/blob\/main\/docs\/retention\.md/,
  );
  assert.match(privacy, /public keys/);
  assert.match(privacy, /do not send a referrer/);
  assert.match(privacy, /this browser tab/);
  assert.match(privacy, /public blogroll/);
  assert.doesNotMatch(privacy, /\/assets\//);
  assert.match(privacy, /webmention\.io\/joshternet\.org\/webmention/);
  assert.match(privacy, /does not use cookies/);
  assert.match(privacy, /account IDs/);
  assert.match(privacy, /utm_source=joshternet\.org/);

  assert.match(privacy, /\]\(\/licensing\/third-party-licenses\/\)/);
  assert.match(terms, /\[Privacy\]\(\/privacy\/\)/);
  assert.match(terms, /\[Security\]\(\/security\/\)/);
  assert.match(terms, /\]\(\/licensing\/third-party-licenses\/\)/);
  assert.match(terms, /\]\(\/licensing\/\)/);
  assert.match(terms, /BSD-3-Clause/);
  assert.match(terms, /CC BY 4\.0/);
  assert.doesNotMatch(terms, /still being decided/);
  assert.doesNotMatch(terms, /\/licensing\/third-party\/(?!licenses)/);
  assert.doesNotMatch(privacy, /\/licensing\/third-party\/(?!licenses)/);
  assert.doesNotMatch(terms, /\]\(\/third-party-licenses\/\)/);
  assert.doesNotMatch(privacy, /\]\(\/third-party-licenses\/\)/);
  assert.doesNotMatch(
    terms,
    /github\.com\/joshternet\/joshternet\.github\.io\/blob\/.*THIRD_PARTY/,
  );
  assert.match(terms, /## Official buttons/);
  assert.doesNotMatch(
    terms,
    /GET https:\/\/joshternet\.org\/api\/button-state/,
  );
  assert.match(terms, /\/implement\/buttons\//);
  assert.match(terms, /joshternet\/index-data/);

  assert.doesNotMatch(privacy, /all rights reserved/i);
  assert.doesNotMatch(terms, /all rights reserved/i);
  assert.doesNotMatch(privacy, /\bGDPR\b/);
  assert.doesNotMatch(terms, /\bGDPR\b/);
  assert.doesNotMatch(privacy, /\bCCPA\b/);
  assert.doesNotMatch(terms, /\bCCPA\b/);
});

test("footer lists Privacy, Terms, Security, then Contact", async () => {
  const layout = await read("_layouts/default.html");
  const aboutNav = await read("_data/about_nav.yml");
  const privacyAt = layout.indexOf("'/privacy/' | relative_url");
  const termsAt = layout.indexOf("'/terms/' | relative_url");
  const securityAt = layout.indexOf("'/security/' | relative_url");
  const contactAt = layout.indexOf("mailto:hello@joshternet.org");

  assert.ok(privacyAt > 0);
  assert.ok(privacyAt < termsAt);
  assert.ok(termsAt < securityAt);
  assert.ok(securityAt < contactAt);
  assert.match(layout, />Terms</);
  assert.doesNotMatch(aboutNav, /path: \/terms\//);
});

test("built sitemap lists privacy, terms, licensing, and third-party licenses when _site exists", async () => {
  if (!(await exists("_site/sitemap.xml"))) {
    return;
  }

  const sitemap = await read("_site/sitemap.xml");

  // Local `jekyll serve` may emit http://0.0.0.0:4000/; production uses
  // https://joshternet.org/. Lock the path locs either way.
  assert.match(sitemap, /<loc>[^<]*\/privacy\/<\/loc>/);
  assert.match(sitemap, /<loc>[^<]*\/terms\/<\/loc>/);
  if (await exists("_site/licensing/third-party-licenses/index.html")) {
    assert.match(
      sitemap,
      /<loc>[^<]*\/licensing\/third-party-licenses\/<\/loc>/,
    );
  }
  if (await exists("_site/licensing/index.html")) {
    assert.match(sitemap, /<loc>[^<]*\/licensing\/<\/loc>/);
  }
});

test("hub licensing split is documented for #58", async () => {
  const license = await read("LICENSE");
  const policy = await read("LICENSING.md");
  const readme = await read("README.md");
  const page = await read("project-licensing.md");
  const layout = await read("_layouts/default.html");
  const aboutNav = await read("_data/about_nav.yml");
  const thirdParty = await read("THIRD_PARTY_LICENSES.md");
  const pkg = await read("package.json");

  assert.match(license, /Redistribution and use in source and binary forms/);
  assert.match(license, /Joshternet contributors/);
  assert.match(policy, /BSD-3-Clause/);
  assert.match(policy, /CC BY 4\.0|creativecommons\.org\/licenses\/by\/4\.0/);
  assert.match(policy, /Brand assets/);
  assert.match(policy, /Participant website screenshots/);
  assert.match(policy, /\]\(\/licensing\/third-party-licenses\/\)/);
  assert.doesNotMatch(policy, /THIRD_PARTY_LICENSES\.md/);
  assert.doesNotMatch(policy, /\/licensing\/third-party\/(?!licenses)/);
  assert.match(policy, /joshternet\/index-data/);
  assert.match(readme, /joshternet\.org\/licensing\//);
  assert.match(readme, /joshternet\.org\/licensing\/third-party-licenses\//);
  assert.doesNotMatch(readme, /THIRD_PARTY_LICENSES\.md/);
  assert.doesNotMatch(readme, /\/licensing\/third-party\/(?!licenses)/);
  assert.match(readme, /BSD-3-Clause/);
  assert.match(page, /permalink: \/licensing\//);
  assert.doesNotMatch(page, /sitemap:\s*false/);
  assert.match(page, /include_relative LICENSING\.md/);
  assert.doesNotMatch(aboutNav, /path: \/licensing\//);
  assert.doesNotMatch(layout, /\/licensing\//);
  assert.match(await read("_config.yml"), /LICENSING\.md/);
  assert.match(pkg, /"license": "BSD-3-Clause"/);
  assert.match(thirdParty, /^# Third-party licenses/m);
  assert.doesNotMatch(thirdParty, /project-owned code is BSD/i);
});

test("third-party licenses is a licensing subpage, not nav", async () => {
  const page = await read("third-party-licenses.md");
  const layout = await read("_layouts/default.html");
  const aboutNav = await read("_data/about_nav.yml");
  const source = await read("THIRD_PARTY_LICENSES.md");

  assert.match(page, /permalink: \/licensing\/third-party-licenses\//);
  assert.doesNotMatch(page, /sitemap:\s*false/);
  assert.match(page, /include_relative THIRD_PARTY_LICENSES\.md/);
  assert.match(source, /Elsewhere network icons/);
  assert.match(
    source,
    /Source: \[https:\/\/github\.com\/mastodon\/mastodon\/blob\/[^\]]+\]\(https:\/\/github\.com\/mastodon\/mastodon\/blob\/[^)]+\)/,
  );
  assert.doesNotMatch(source, /Source: https:\/\//);
  assert.doesNotMatch(source, /<a\s+href=/i);
  assert.doesNotMatch(aboutNav, /third-party-licenses/);
  assert.doesNotMatch(layout, /\/licensing\/third-party-licenses\//);
  assert.match(await read("_config.yml"), /THIRD_PARTY_LICENSES\.md/);
});
