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
 * Asserts that a source path under the repo root exists.
 * @param {string} relativePath - Path under the repo root.
 * @returns {Promise<void>}
 */
async function assertExists(relativePath) {
  await access(path.join(root, relativePath));
}

const CHAPTER_IDS = [
  "html",
  "seo",
  "slashpages",
  "opml",
  "microformats2",
  "open-graph",
  "schema-org",
  "feeds",
  "sitemaps",
  "robots",
  "links",
  "identity",
  "connections",
  "media",
  "events",
  "uses",
  "explore",
  "validation",
  "reference",
];

const NAV_GROUPS = [
  "foundation",
  "discovery",
  "describing",
  "syndication",
  "relationships",
  "publishing",
  "understanding",
];

/** Syllabus headings that must not appear on Content chapters. */
const FORBIDDEN_SYLLABUS = [
  "## Why it matters",
  "## Walkthrough",
  "## Progressive example",
  "## How it interacts",
  "## Specification essentials",
];

test("content handbook hub lists chapters from content_nav", async () => {
  const hub = await read("implement/content.md");
  const nav = await read("_data/content_nav.yml");
  const implementNav = await read("_data/implement_nav.yml");

  assert.match(hub, /permalink: \/implement\/content\//);
  assert.match(hub, /site\.data\.content_nav/);
  assert.match(hub, /content-discovery-flow/);
  assert.match(hub, /## How content discovery works/);
  assert.match(hub, /## How the specifications work together/);
  assert.match(hub, /## Recommended implementation path/);
  assert.match(hub, /Harbor Notes/);
  assert.doesNotMatch(hub, /JoshBot \(hub crawl\)/);
  assert.doesNotMatch(hub, /content-joshbot-status/);
  assert.doesNotMatch(hub, /This page explains/);
  assert.doesNotMatch(hub, /Optional stuff/);

  assert.match(implementNav, /title: Content handbook/);
  assert.match(implementNav, /path: \/implement\/content\//);
  assert.match(implementNav, /match: prefix/);
  assert.doesNotMatch(implementNav, /title: Slashpages/);
  assert.doesNotMatch(implementNav, /title: Explore notes/);

  assert.match(
    hub,
    /assign groups = "foundation\|discovery\|describing\|syndication\|relationships\|publishing\|understanding"/,
  );
  assert.match(hub, /chapter\.group == group_key/);
  for (const group of NAV_GROUPS) {
    assert.match(nav, new RegExp(`group: ${group}\\b`));
  }

  for (const id of CHAPTER_IDS) {
    assert.match(nav, new RegExp(`id: ${id}\\b`));
    assert.match(nav, new RegExp(`path: /implement/content/${id}/`));
  }
});

test("content handbook chapters keep matrix ids without syllabus scaffolding", async () => {
  for (const id of CHAPTER_IDS) {
    const relativePath = `implement/content/${id}.md`;
    await assertExists(relativePath);
    const page = await read(relativePath);
    assert.match(page, new RegExp(`permalink: /implement/content/${id}/`));
    assert.match(page, new RegExp(`content_id: ${id}\\b`));
    assert.match(page, new RegExp(`matrix_id: ${id}\\b`));
    assert.doesNotMatch(
      page,
      /content-joshbot-status/,
      `${relativePath} must not include JoshBot status banners`,
    );
    assert.match(page, /content-chapter-nav\.html/);
    assert.doesNotMatch(
      page,
      /This page explains/,
      `${relativePath} must not lecture under the title`,
    );
    assert.doesNotMatch(
      page,
      /One fictional origin/,
      `${relativePath} must not use progressive-example theater`,
    );
    for (const heading of FORBIDDEN_SYLLABUS) {
      assert.doesNotMatch(
        page,
        new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `${relativePath} must not use syllabus heading ${heading}`,
      );
    }
  }
});

test("slashpages and explore stubs preserve URLs and point at the handbook", async () => {
  const slashpages = await read("implement/slashpages.md");
  const explore = await read("implement/explore.md");

  assert.match(slashpages, /permalink: \/implement\/slashpages\//);
  assert.match(slashpages, /\/implement\/content\/opml\//);
  assert.match(slashpages, /\/implement\/content\/slashpages\//);

  assert.match(explore, /permalink: \/implement\/explore\//);
  assert.match(explore, /\/implement\/content\/explore\//);
  assert.match(explore, /\/implement\/connections\//);
  assert.doesNotMatch(explore, /topics\.json/);
  assert.doesNotMatch(explore, /activity\.json/);
});

test("implement and joshbot point publishers at the content handbook", async () => {
  const implement = await read("implement.md");
  const joshbot = await read("joshbot.md");
  const connections = await read("implement/connections.md");

  assert.match(implement, /\/implement\/content\//);
  assert.match(joshbot, /\/implement\/content\//);
  assert.match(connections, /\/implement\/content\//);
});

test("handbook chapter TOC floats below motif under the title", async () => {
  const toc = await read("_includes/content-handbook-toc.html");
  const chapterNav = await read("_includes/content-chapter-nav.html");
  const layout = await read("_layouts/default.html");
  const css = await read("assets/css/main.css");
  const nav = await read("_data/content_nav.yml");

  assert.match(toc, /class="handbook-toc"/);
  assert.match(toc, /aria-label="Handbook chapters"/);
  assert.match(toc, /class="handbook-toc__group"/);
  assert.match(toc, /class="handbook-toc__group-summary"/);
  assert.match(toc, /group_has_current/);
  assert.match(toc, /Content handbook/);
  assert.match(toc, /aria-current="page"/);
  assert.doesNotMatch(toc, />(?:\s*)Go(?:\s*)</);
  assert.doesNotMatch(toc, /handbook-toc__details/);
  assert.match(
    toc,
    /assign toc_groups = 'foundation\|discovery\|describing\|syndication\|relationships\|publishing\|understanding'/,
  );
  assert.match(toc, /handbook-toc-group-' \| append: group_key/);
  for (const group of NAV_GROUPS) {
    assert.match(nav, new RegExp(`group: ${group}\\b`));
  }

  assert.match(chapterNav, /include\.aria_label/);
  assert.match(chapterNav, /content-chapter-nav__list/);
  assert.doesNotMatch(chapterNav, />(?:\s*)Go(?:\s*)</);

  assert.match(layout, /site-main--handbook/);
  assert.match(layout, /handbook-shell/);
  assert.match(layout, /handbook-shell__prose/);
  assert.match(layout, /handbook-shell__aside/);
  assert.doesNotMatch(layout, /handbook-shell__nav/);
  assert.doesNotMatch(layout, /handbook-shell__rail/);
  assert.match(layout, /content-handbook-toc\.html/);
  assert.doesNotMatch(
    layout,
    /content-chapter-nav\.html aria_label="Handbook chapter \(top\)"/,
  );
  assert.match(
    layout,
    /handbook-shell__prose[\s\S]*handbook-shell__aside[\s\S]*content-handbook-toc/,
  );
  assert.match(layout, /page\.content_id/);

  assert.match(css, /\.handbook-shell\s*\{/);
  assert.match(css, /\.handbook-shell__aside\s*\{/);
  assert.match(
    css,
    /margin-block-start:\s*calc\(\s*var\(--space-8\)\s*\+\s*14rem\s*\+\s*var\(--space-4\)\s*\)/,
  );
  assert.match(css, /\.handbook-toc__group-summary::before/);
  assert.match(css, /\.handbook-toc__list/);
  assert.doesNotMatch(css, /\.site-main--handbook::before/);
  assert.doesNotMatch(css, /\.handbook-shell__nav/);
  assert.doesNotMatch(css, /\.handbook-shell__rail/);

  for (const id of CHAPTER_IDS) {
    const page = await read(`implement/content/${id}.md`);
    assert.match(
      page,
      /content-chapter-nav\.html aria_label="Handbook chapter \(bottom\)"/,
      `${id} must keep bottom chapter nav with a distinct landmark label`,
    );
  }
});
