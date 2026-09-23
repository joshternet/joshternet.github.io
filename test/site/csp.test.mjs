import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

function extractCSP(html) {
  const meta = html.match(
    /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i,
  );

  assert.ok(meta, "page must contain a Content-Security-Policy meta tag");

  const content = meta[0].match(/\bcontent="([^"]*)"/i);

  assert.ok(content, "Content-Security-Policy meta tag must contain content");

  return content[1].trim();
}

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

function configValue(source, key) {
  const expression = new RegExp(
    `^\\s*${key}:\\s*["']?([^"'\\s]+)["']?\\s*$`,
    "m",
  );

  const match = source.match(expression);

  assert.ok(match, `missing ${key} in _config.yml`);

  return match[1];
}

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

const [config, networkSource, homepageHTML, wanderHTML, nominateHTML] =
  await Promise.all([
    read("_config.yml"),
    read("_data/network.json"),
    read("_site/index.html"),
    read("_site/wander/index.html"),
    read("_site/nominate/index.html"),
  ]);

const network = JSON.parse(networkSource);
const siteOrigin = configValue(config, "url");
const nominationAPIOrigin = configValue(config, "api_origin");

const homepageCSP = parseCSP(extractCSP(homepageHTML));
const wanderCSP = parseCSP(extractCSP(wanderHTML));
const nominateCSP = parseCSP(extractCSP(nominateHTML));

test("generated pages retain the restrictive baseline CSP", () => {
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
  }
});

test("ordinary pages expose only Umami script and connection origins", () => {
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

test("Wander frame-src contains only exact external embeddable participants", () => {
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

test("Nominate grants only its required Turnstile and Worker permissions", () => {
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

test("generated HTML contains no retired Cloudflare Web Analytics origins", async () => {
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
