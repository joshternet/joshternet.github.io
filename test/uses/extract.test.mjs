/**
 * Goal: Uses HTML extraction — true positives, negations, empty pages.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  extractUsesFromHtml,
  inferStatus,
  stripNonContentHtml,
} from "../../scripts/uses/extract.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function fixture(relativePath) {
  return readFile(path.join(root, "test/fixtures/uses", relativePath), "utf8");
}

test("extractUsesFromHtml reads list items and skips negation", async () => {
  const html = await fixture("plain-list.html");
  const result = extractUsesFromHtml(html);
  assert.equal(result.outcome, "verified");
  const labels = result.items.map((i) => i.label);
  assert.ok(labels.includes("VS Code"));
  assert.ok(labels.includes("Neovim"));
  assert.ok(labels.includes("Firefox"));
  assert.ok(!labels.some((l) => /emacs/i.test(l)));
});

test("stripNonContentHtml removes script and nav", () => {
  const cleaned = stripNonContentHtml(
    `<nav>Menu</nav><script>evil()</script><main><li>Tool</li></main>`,
  );
  assert.doesNotMatch(cleaned, /evil/);
  assert.doesNotMatch(cleaned, /Menu/);
  assert.match(cleaned, /Tool/);
});

test("inferStatus detects former and wishlist", () => {
  assert.equal(inferStatus("formerly used Sublime"), "former");
  assert.equal(inferStatus("replaced by Neovim"), "former");
  assert.equal(inferStatus("no longer using Vim"), "former");
  assert.equal(inferStatus("on my wishlist"), "wishlist");
  assert.equal(inferStatus("daily driver"), "current");
});

test("false-positive shaped page does not treat prose mentions as uses", async () => {
  const html = await fixture("false-positives.html");
  const result = extractUsesFromHtml(html);
  // List items like skills may still parse; prose/affiliate must not invent VS Code.
  assert.ok(
    !result.items.some((item) => /visual studio code/i.test(item.label)),
  );
  assert.ok(!result.items.some((item) => /buy headphones/i.test(item.label)));
});

test("empty html is parse_error", () => {
  assert.equal(extractUsesFromHtml("").outcome, "parse_error");
});

test("extractUsesFromHtml keeps the product name and drops site paths", () => {
  const result = extractUsesFromHtml(`
    <h2>Workstation</h2>
    <ul>
      <li>
        <h3>16” second monitor</h3>
        <p>A second screen off to the side for docs, reference, and anything I want to keep half an eye on.</p>
      </li>
      <li><a href="/cv">/cv</a> — work history, in one page</li>
      <li><a href="/now">/now</a> — what I’m up to right now</li>
      <li><a href="/links">/links</a> — things I’ve been reading</li>
      <li>Neovim</li>
    </ul>
  `);
  const labels = result.items.map((item) => item.label);
  assert.deepEqual(labels, ["16” second monitor", "Neovim"]);
  const neovim = result.items.find((item) => item.label === "Neovim");
  assert.equal(neovim.section, "Workstation");
  assert.equal(neovim.section_path.includes("16"), false);
});

test("a heading inside a list item does not label the next sibling", async () => {
  const html = await fixture("entity-structure.html");
  const result = extractUsesFromHtml(html);
  const byLabel = new Map(result.items.map((item) => [item.label, item]));
  assert.equal(byLabel.get("Apple Magic Keyboard").section, "Workstation");
  assert.equal(byLabel.get("Cloudflare").section, "Development");
  assert.equal(byLabel.get("Mimestream").section, "Productivity");
  assert.equal(byLabel.get("Netlify").section, "Development");
  assert.equal(
    byLabel.get("Apple Magic Keyboard").section_path.includes("Netlify"),
    false,
  );
});

test("nested lists, definition lists, and tables keep their section", () => {
  const result = extractUsesFromHtml(`
    <h2>Desk</h2>
    <ul>
      <li>Framework
        <ul><li>Kindle</li></ul>
      </li>
    </ul>
    <h3>Audio</h3>
    <dl><dt>Focusrite Scarlett</dt><dd>interface</dd></dl>
    <table><tr><td><strong>UA Volt</strong></td></tr></table>
  `);
  const byLabel = new Map(result.items.map((item) => [item.label, item]));
  assert.equal(byLabel.get("Framework").section_path, "Desk");
  assert.equal(byLabel.get("Kindle").section_path, "Desk");
  assert.equal(byLabel.get("Focusrite Scarlett").section_path, "Desk / Audio");
  assert.equal(byLabel.get("UA Volt").section, "Audio");
});

test("josh cox products keep the heading that contains them", async () => {
  const html = await fixture("members/joshcox.co.uk.html");
  const result = extractUsesFromHtml(html);
  const byLabel = new Map(result.items.map((item) => [item.label, item]));
  assert.equal(byLabel.get("Apple Magic Keyboard").section, "Workstation");
  assert.equal(byLabel.get("Cloudflare").section, "Development");
  assert.equal(byLabel.get("Mimestream").section, "Productivity");
  assert.equal(byLabel.get("Netlify").section, "Development");
  assert.equal(
    byLabel.get("Cloudflare").section_path.includes("Osaurus"),
    false,
  );
});

test("incomplete HTML is not a verified-empty Uses page", () => {
  const result = extractUsesFromHtml("<h2>Software</h2><ul></ul>", {
    bodyComplete: false,
  });
  assert.equal(result.outcome, "uncertain");
});

test("a heading plus a paragraph and a single-heading card are claims", () => {
  const result = extractUsesFromHtml(`
    <h2>Hardware</h2>
    <h3>Framework Laptop</h3>
    <p>The one I carry.</p>
    <h2>Development</h2>
    <ul><li>Neovim</li></ul>
    <article>
      <h3>Ghostty</h3>
      <p>Terminal.</p>
    </article>
    <p>I use many tools across the day.</p>
  `);
  const byLabel = new Map(result.items.map((item) => [item.label, item]));
  assert.equal(byLabel.get("Framework Laptop").section_path, "Hardware");
  assert.equal(byLabel.get("Framework Laptop").context, "The one I carry.");
  assert.equal(byLabel.get("Neovim").section, "Development");
  assert.equal(byLabel.has("Development"), false);
  assert.equal(byLabel.get("Ghostty").section, "Development");
  const skipped = extractUsesFromHtml(`
    <ul><li><article><h3>Inside</h3><p>hidden</p></article></li></ul>
    <article><h3>One</h3><h3>Two</h3></article>
    <article><h3>Listed</h3><ul><li>Child</li></ul></article>
    <h3>Home</h3><p>navigation</p>
    <h3>#</h3><p>blank</p>
    <h3>Emacs</h3><p>I use Neovim and I don't use Emacs</p>
    <h3>Vim</h3><p>I don't use Vim anymore</p>
    <h3><a href="https://joshua.example/zed">Zed</a></h3><blockquote>Editor</blockquote>
    <h3>Alacritty</h3><p><a href="#top">Terminal</a></p>
  `);
  const skippedLabels = skipped.items.map((item) => item.label);
  assert.equal(skippedLabels.includes("Home"), false);
  assert.equal(skippedLabels.includes("Emacs"), false);
  assert.equal(skippedLabels.includes("Vim"), false);
  const zed = skipped.items.find((item) => item.label === "Zed");
  assert.equal(zed.href, "https://joshua.example/zed");
  assert.equal(skippedLabels.includes("One"), false);
  assert.equal(skippedLabels.includes("Two"), false);
  const alacritty = skipped.items.find((item) => item.label === "Alacritty");
  assert.equal(alacritty.href, "");
  assert.ok(skippedLabels.includes("Child"));
  const prose = extractUsesFromHtml(
    "<p>I use many tools across the day without naming one.</p>",
  );
  assert.equal(prose.outcome, "uncertain");
  assert.equal(prose.items.length, 0);
});
