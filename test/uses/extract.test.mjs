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
});

test("incomplete HTML is not a verified-empty Uses page", () => {
  const result = extractUsesFromHtml("<h2>Software</h2><ul></ul>", {
    bodyComplete: false,
  });
  assert.equal(result.outcome, "uncertain");
});
