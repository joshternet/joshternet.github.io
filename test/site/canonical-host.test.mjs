/**
 * Goal: Lock joshternet.org as the only site origin in config, discovery, and
 * built surfaces. GitHub repo URLs may mention joshternet.github.io; site
 * origins must not.
 * Inputs: repository source files and optional `_site` build output.
 * Acceptance: no `https://joshternet.github.io` site-origin advertisements;
 * `_config.yml` url remains `https://joshternet.org`.
 */
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const SITE_ORIGIN = "https://joshternet.org";
const FORBIDDEN_SITE_ORIGIN = "https://joshternet.github.io";

/**
 * Reads a UTF-8 file relative to the repository root.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<string>} File contents.
 */
async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

/**
 * Returns whether a path exists.
 * @param {string} absolutePath - Absolute filesystem path.
 * @returns {Promise<boolean>} True when the path is readable.
 */
async function exists(absolutePath) {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

test("_config.yml publishes the canonical joshternet.org site URL", async () => {
  const config = await read("_config.yml");
  assert.match(config, /^url:\s*https:\/\/joshternet\.org\s*$/m);
  assert.doesNotMatch(config, /url:\s*https:\/\/joshternet\.github\.io/i);
});

test("robots.txt Sitemap advertises joshternet.org only", async () => {
  const robots = await read("robots.txt");
  assert.match(robots, /Sitemap:\s*https:\/\/joshternet\.org\/sitemap\.xml/);
  assert.doesNotMatch(robots, /joshternet\.github\.io/i);
});

test("CNAME and Worker SITE_ORIGIN stay on the canonical host", async () => {
  const cname = (await read("CNAME")).trim();
  assert.equal(cname, "joshternet.org");

  const buttonWrangler = await read("workers/joshternet-button/wrangler.jsonc");
  assert.match(buttonWrangler, /"SITE_ORIGIN":\s*"https:\/\/joshternet\.org"/);
  assert.doesNotMatch(buttonWrangler, /joshternet\.github\.io/);
});

test("source templates do not advertise the GitHub Pages hostname as a site origin", async () => {
  const files = [
    "_layouts/default.html",
    "_config.yml",
    "robots.txt",
    "network-data.json",
    "connections-data.json",
    "joshbot.md",
    "infrastructure.md",
  ];

  for (const relativePath of files) {
    const text = await read(relativePath);
    assert.doesNotMatch(
      text,
      /https:\/\/joshternet\.github\.io/i,
      `${relativePath} must not advertise ${FORBIDDEN_SITE_ORIGIN}`,
    );
  }
});

test("built _site discovery surfaces never advertise the GitHub Pages hostname", async () => {
  const siteRoot = path.join(root, "_site");
  if (!(await exists(siteRoot))) {
    return;
  }

  const checks = [
    "robots.txt",
    "sitemap.xml",
    "index.html",
    path.join(".well-known", "josh"),
    path.join("assets", "network", "joshternet.opml"),
    path.join("assets", "activity", "atom.xml"),
  ];

  for (const relativePath of checks) {
    const absolutePath = path.join(siteRoot, relativePath);
    if (!(await exists(absolutePath))) {
      continue;
    }
    const text = await readFile(absolutePath, "utf8");
    assert.doesNotMatch(
      text,
      /https:\/\/joshternet\.github\.io/i,
      `_site/${relativePath} must not advertise ${FORBIDDEN_SITE_ORIGIN}`,
    );
    // Production builds use site.url; local `jekyll serve` may emit localhost.
    if (
      (relativePath === "robots.txt" || relativePath === "sitemap.xml") &&
      text.includes("https://")
    ) {
      assert.match(text, /joshternet\.org/);
      assert.doesNotMatch(text, new RegExp(FORBIDDEN_SITE_ORIGIN));
    }
  }
});

test("GitHub repository links may name joshternet.github.io as a repo, not a site origin", async () => {
  const star = await read("_includes/github-star.html");
  assert.match(
    star,
    /href="https:\/\/github\.com\/joshternet\/joshternet\.github\.io"/,
  );
  assert.doesNotMatch(star, /href="https:\/\/joshternet\.github\.io"/);
});
