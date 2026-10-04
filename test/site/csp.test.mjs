/**
 * Goal: Assert production CSP shape. Skip when `_site` is missing or was built
 * with local/dev hosts (localhost / 127.0.0.1) so `npm run dev` previews do not
 * flake CI-oriented checks. Wander frame-src is derived from `_data/network.json`.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

/**
 * @param {string} html
 * @returns {string}
 */
function extractCSP(html) {
  const meta = html.match(
    /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i,
  );

  assert.ok(meta, "page must contain a Content-Security-Policy meta tag");

  const content = meta[0].match(/\bcontent="([^"]*)"/i);

  assert.ok(content, "Content-Security-Policy meta tag must contain content");

  return content[1].trim();
}

/**
 * @param {string} value
 * @returns {Map<string, string[]>}
 */
function parseCSP(value) {
  const directives = new Map();

  for (const part of value.split(";")) {
    const fields = part.trim().split(/\s+/).filter(Boolean);

    if (fields.length === 0) {
      continue;
    }

    const [name, ...sources] = fields;

    assert.equal(
      directives.has(name),
      false,
      `duplicate CSP directive: ${name}`,
    );

    directives.set(name, sources);
  }

  return directives;
}

/**
 * @param {string} source
 * @param {string} key
 * @returns {string}
 */
function configValue(source, key) {
  const expression = new RegExp(
    `^\\s*${key}:\\s*["']?([^"'\\s]+)["']?\\s*$`,
    "m",
  );

  const match = source.match(expression);

  assert.ok(match, `missing ${key} in _config.yml`);

  return match[1];
}

/**
 * @param {string} origin
 * @returns {void}
 */
function assertCanonicalHTTPSOrigin(origin) {
  assert.equal(typeof origin, "string");

  const url = new URL(origin);

  assert.equal(url.protocol, "https:");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.pathname, "/");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.equal(url.origin, origin);
}

/**
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function collectHTMLFiles(directory) {
  const results = [];
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await collectHTMLFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      results.push(entryPath);
    }
  }

  return results;
}

/**
 * @param {Map<string, string[]>} directives
 * @returns {boolean}
 */
function cspHasLocalhost(directives) {
  for (const sources of directives.values()) {
    for (const source of sources) {
      if (/localhost|127\.0\.0\.1/i.test(source)) {
        return true;
      }
    }
  }

  return false;
}

let siteReady = false;
/** @type {Map<string, string[]> | null} */
let homepageCSP = null;
/** @type {Map<string, string[]> | null} */
let wanderCSP = null;
/** @type {Map<string, string[]> | null} */
let nominateCSP = null;
/** @type {unknown} */
let network = null;
let siteOrigin = "";
let nominationAPIOrigin = "";
let skipReason = "_site production build not available";

try {
  const [config, networkSource, homepageHTML, wanderHTML, nominateHTML] =
    await Promise.all([
      read("_config.yml"),
      read("_data/network.json"),
      read("_site/index.html"),
      read("_site/wander/index.html"),
      read("_site/nominate/index.html"),
    ]);

  network = JSON.parse(networkSource);
  siteOrigin = configValue(config, "url");
  nominationAPIOrigin = configValue(config, "api_origin");
  homepageCSP = parseCSP(extractCSP(homepageHTML));
  wanderCSP = parseCSP(extractCSP(wanderHTML));
  nominateCSP = parseCSP(extractCSP(nominateHTML));

  if (
    cspHasLocalhost(homepageCSP) ||
    cspHasLocalhost(wanderCSP) ||
    cspHasLocalhost(nominateCSP)
  ) {
    skipReason =
      "_site CSP includes localhost/127.0.0.1; rebuild with npm run build";
  } else {
    siteReady = true;
  }
} catch (error) {
  skipReason = `production _site unavailable: ${error.message}`;
}

test("generated pages retain the restrictive baseline CSP", (t) => {
  if (!siteReady) {
    t.skip(skipReason);
    return;
  }

  for (const [name, directives] of [
    ["homepage", homepageCSP],
    ["wander", wanderCSP],
    ["nominate", nominateCSP],
  ]) {
    assert.deepEqual(
      directives.get("default-src"),
      ["'self'"],
      `${name} default-src`,
    );

    assert.deepEqual(
      directives.get("style-src"),
      ["'self'"],
      `${name} style-src`,
    );

    assert.deepEqual(
      directives.get("img-src"),
      ["'self'", "data:"],
      `${name} img-src`,
    );

    assert.deepEqual(
      directives.get("font-src"),
      ["'self'"],
      `${name} font-src`,
    );

    assert.deepEqual(
      directives.get("object-src"),
      ["'none'"],
      `${name} object-src`,
    );

    assert.deepEqual(
      directives.get("base-uri"),
      ["'none'"],
      `${name} base-uri`,
    );

    assert.deepEqual(
      directives.get("form-action"),
      ["'none'"],
      `${name} form-action`,
    );

    assert.deepEqual(
      directives.get("media-src"),
      ["'none'"],
      `${name} media-src`,
    );

    assert.deepEqual(
      directives.get("manifest-src"),
      ["'self'"],
      `${name} manifest-src`,
    );

    assert.deepEqual(
      directives.get("worker-src"),
      ["'none'"],
      `${name} worker-src`,
    );

    assert.equal(
      cspHasLocalhost(directives),
      false,
      `${name} CSP must not allow localhost`,
    );
  }
});

test("ordinary pages expose only Umami script and connection origins", (t) => {
  if (!siteReady) {
    t.skip(skipReason);
    return;
  }

  for (const [name, directives] of [
    ["homepage", homepageCSP],
    ["wander", wanderCSP],
  ]) {
    assert.deepEqual(
      directives.get("script-src"),
      ["'self'", "https://cloud.umami.is"],
      `${name} script-src`,
    );

    assert.deepEqual(
      directives.get("connect-src"),
      ["'self'", "https://gateway.umami.is"],
      `${name} connect-src`,
    );
  }

  assert.deepEqual(homepageCSP.get("frame-src"), ["'none'"]);
});

test("Wander frame-src contains only exact external embeddable participants", (t) => {
  if (!siteReady) {
    t.skip(skipReason);
    return;
  }

  assert.ok(Array.isArray(network));

  const expected = [];
  const seen = new Set();

  for (const entry of network) {
    if (entry?.embeddable !== true || entry?.frame_reason !== "allowed") {
      continue;
    }

    assertCanonicalHTTPSOrigin(entry.origin);

    if (entry.origin === siteOrigin) {
      continue;
    }

    assert.equal(
      seen.has(entry.origin),
      false,
      `duplicate embeddable origin: ${entry.origin}`,
    );

    seen.add(entry.origin);
    expected.push(entry.origin);
  }

  assert.deepEqual(
    wanderCSP.get("frame-src"),
    expected.length > 0 ? expected : ["'none'"],
  );

  assert.equal(
    wanderCSP.get("frame-src").includes("https:"),
    false,
    "Wander must not allow the blanket https: frame source",
  );

  assert.equal(
    wanderCSP.get("frame-src").includes(siteOrigin),
    false,
    "Wander must not permit Joshternet to frame itself",
  );
});

test("Nominate grants only its required Turnstile and Worker permissions", (t) => {
  if (!siteReady) {
    t.skip(skipReason);
    return;
  }

  assert.deepEqual(nominateCSP.get("script-src"), [
    "'self'",
    "https://cloud.umami.is",
    "https://challenges.cloudflare.com",
  ]);

  assert.deepEqual(nominateCSP.get("connect-src"), [
    "'self'",
    "https://gateway.umami.is",
    "https://challenges.cloudflare.com",
    nominationAPIOrigin,
  ]);

  assert.deepEqual(nominateCSP.get("frame-src"), [
    "https://challenges.cloudflare.com",
  ]);
});

test("generated HTML contains no retired Cloudflare Web Analytics origins", async (t) => {
  if (!siteReady) {
    t.skip(skipReason);
    return;
  }

  const siteDirectory = path.join(root, "_site");
  const files = await collectHTMLFiles(siteDirectory);

  assert.ok(files.length > 0, "production build must contain HTML files");

  for (const filename of files) {
    const html = await fs.readFile(filename, "utf8");

    assert.equal(
      html.includes("static.cloudflareinsights.com"),
      false,
      `${path.relative(root, filename)} contains static.cloudflareinsights.com`,
    );

    assert.equal(
      html.includes("cloudflareinsights.com"),
      false,
      `${path.relative(root, filename)} contains cloudflareinsights.com`,
    );
  }
});
