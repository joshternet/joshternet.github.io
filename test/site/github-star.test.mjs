/**
 * Goal: Lock the shared GitHub star CTA markup, header/menu wiring, github.json
 * shape (repo + numeric stars field + ISO timestamp), and CSS visibility
 * contract without client GitHub API usage. Do not freeze the live star count.
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

test("github-star include links to the site repo with accessible star copy", async () => {
  const include = await read("_includes/github-star.html");

  assert.match(
    include,
    /href="https:\/\/github\.com\/joshternet\/joshternet\.github\.io"/,
  );
  assert.doesNotMatch(include, /target="_blank"/);
  assert.match(include, /rel="noopener"/);
  assert.match(include, /aria-label="Star Joshternet on GitHub"/);
  assert.match(
    include,
    /title="Support Joshternet by starring the project on GitHub\."/,
  );
  assert.match(include, /data-joshternet-skip-link-track/);
  assert.match(include, /data-joshternet-track="github_star_cta_clicked"/);
  assert.match(include, /data-joshternet-track-location="/);
  assert.match(include, /github-star__icon/);
  assert.match(include, /github-star__count/);
  assert.match(include, /site\.data\.github\.stars/);
  assert.match(include, /github_stars != null/);
  assert.doesNotMatch(include, /github-star__label/);
  assert.doesNotMatch(include, /Star on GitHub</);
  assert.doesNotMatch(include, /api\.github\.com/);
  assert.doesNotMatch(include, /iframe/i);
});

test("default layout and compact nav wire header and menu star variants", async () => {
  const layout = await read("_layouts/default.html");
  const links = await read("_includes/site-nav-links.html");

  assert.match(layout, /include github-star\.html variant="header"/);
  assert.match(links, /variant == 'compact'/);
  assert.match(links, /site-nav__item--github-star/);
  assert.match(links, /include github-star\.html variant="menu"/);
  assert.match(layout, /github-star-count\.js/);
  assert.match(layout, /connect-src[^"]*https:\/\/api\.github\.com/);
});

test("github.json keeps repo metadata shape without freezing star count", async () => {
  const data = JSON.parse(await read("_data/github.json"));

  assert.equal(data.repository, "joshternet/joshternet.github.io");
  assert.equal(typeof data.stars, "number");
  assert.ok(Number.isFinite(data.stars));
  assert.match(
    data.updated_at,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/,
  );
});

test("main.css keeps the star CTA secondary and responsive", async () => {
  const css = await read("assets/css/main.css");

  assert.match(css, /\.github-star\s*\{/);
  assert.match(css, /\.github-star__icon/);
  assert.match(css, /\.github-star--header/);
  assert.match(css, /\.site-nav__item--github-star/);
  assert.match(css, /grid-template-columns:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.github-star/);
  assert.doesNotMatch(css, /\.github-star__label/);
  assert.match(css, /\.github-star__count/);
  assert.match(css, /\.github-star\.is-starred/);
  assert.match(css, /--color-star/);
  assert.match(css, /\.github-star\s*\{[^}]*border:\s*0;/);
});
