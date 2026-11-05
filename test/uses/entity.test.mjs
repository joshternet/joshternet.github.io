/**
 * Goal & Constraints:
 * Structural Uses names stay whole, equivalent claims share one id, and a
 * coverage or extractor change is not an adoption change.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { adoptionChange } from "../../scripts/uses/aggregate.mjs";
import { usesHtmlRepeatsHomepage } from "../../scripts/uses/discover.mjs";
import { buildEvidenceRecords } from "../../scripts/uses/evidence.mjs";
import { extractUsesFromHtml } from "../../scripts/uses/extract.mjs";
import { reconcileMemberUsage } from "../../scripts/uses/reconcile.mjs";
import { replayState } from "../../scripts/uses/store.mjs";
import { buildUsesSummary } from "../../scripts/uses/view.mjs";

const NO_TREND =
  "History starts with the first recorded observations. There isn’t enough comparable history to show a trend yet, but you can explore the current snapshot and its sources.";

const catalog = { tools: [], aliases: [], useCases: [] };

/**
 * @param {string} name
 * @returns {Promise<string>}
 */
async function fixture(name) {
  return readFile(new URL(`../fixtures/uses/${name}`, import.meta.url), "utf8");
}

test("structure keeps names whole and leaves qualifiers as context", async () => {
  const html = await fixture("entity-structure.html");
  const extracted = extractUsesFromHtml(html);
  const byLabel = new Map(extracted.items.map((item) => [item.label, item]));

  assert.equal(byLabel.get("Netlify").context.includes("go-to"), true);
  assert.equal(byLabel.get("Netlify").label.includes("Still"), false);
  assert.equal(
    byLabel.get("Apple Magic Keyboard").context.includes("Low-profile"),
    true,
  );
  assert.equal(byLabel.has("Sit-stand desk"), true);
  assert.equal(byLabel.get("Sit-stand desk").kind, "equipment");
  assert.equal(byLabel.get("Debian").context.startsWith("on desktop"), true);
  assert.equal(byLabel.has("Debian on desktop and servers"), false);
  assert.equal(
    byLabel.get("NameSilo").context.toLowerCase().includes("for domains"),
    true,
  );
  assert.equal(byLabel.has("NameSilo for Domains"), false);
  assert.deepEqual(
    ["Firefox", "uBlock Origin"].every((label) => byLabel.has(label)),
    true,
  );
  assert.equal(byLabel.has("Firefox with uBlock Origin"), false);
  assert.equal(byLabel.has("Forgejo"), true);
  assert.equal(byLabel.has("Forgejo Runner"), true);
  assert.equal(byLabel.has("iTerm"), true);
  assert.equal(byLabel.has("Fish"), true);
  assert.equal(byLabel.has("Starship.rs"), true);
  assert.equal(byLabel.get("FL Studio").context.includes("recovering"), true);
  assert.equal(byLabel.get("@joshuabaker").kind, "unresolved");
  assert.equal(byLabel.has("Software"), false);
  assert.equal(byLabel.get("Apple Magic Keyboard").kind, "product");
});

test("prose links and reason lists are not extra products", () => {
  const result = extractUsesFromHtml(`
    <ul>
      <li><h3>Mac mini (M4 Pro, 24GB RAM)</h3><p>My main machine.</p></li>
      <li><strong>Choose your own I/O!</strong> Framework laptops let you <a href="https://frame.work/">choose</a> what ports you have.</li>
      <li>My desk was custom made by my good friend <a href="https://other.example/">Abdollah Nafisi</a>.</li>
      <li>Lenovo LOQ laptop (personal), Framework laptop (work).</li>
      <li>More of the infrastructure runs on <a href="https://www.cloudflare.com/">Cloudflare</a>.</li>
      <li>I use the Apple numeric keyboard, English layout — I love the larger return key.</li>
      <li><a href="#software">Software</a></li>
    </ul>
    <ol>
      <li>Gaming</li>
      <li>Creating tutorials that are Windows-only</li>
    </ol>
  `);
  const byLabel = new Map(result.items.map((item) => [item.label, item]));
  assert.equal(byLabel.has("Mac mini (M4 Pro, 24GB RAM)"), true);
  assert.equal(byLabel.has("choose"), false);
  assert.equal(byLabel.get("Choose your own I/O!").kind, "practice");
  assert.equal(byLabel.get("Abdollah Nafisi").kind, "unresolved");
  assert.equal(byLabel.has("Lenovo LOQ laptop (personal)"), true);
  assert.equal(byLabel.has("Framework laptop (work)"), true);
  assert.equal(byLabel.get("Gaming").kind, "practice");
  assert.equal(
    byLabel.get("Creating tutorials that are Windows-only").kind,
    "practice",
  );
  assert.equal(byLabel.get("Cloudflare").kind, "product");
  assert.equal(byLabel.has("Apple numeric keyboard"), true);
  assert.equal(byLabel.has("English layout"), false);
  assert.equal(byLabel.has("Software"), false);
});

test("equivalent Cloudflare statements share one entity id", () => {
  const first = extractUsesFromHtml(`
    <ul><li><h3>Cloudflare</h3><p>Where a lot of my sites live now.</p></li></ul>
  `);
  const second = extractUsesFromHtml(`
    <ul><li><h3>Cloudflare</h3><p>More of the infrastructure runs here.</p></li></ul>
  `);
  const left = buildEvidenceRecords({
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    content_hash_source: "left",
    items: first.items,
    catalog,
  });
  const right = buildEvidenceRecords({
    origin: "https://other.example",
    page_url: "https://other.example/uses/",
    content_hash_source: "right",
    items: second.items,
    catalog,
  });
  assert.equal(left[0].tool_id, right[0].tool_id);
  assert.equal(left[0].name, "Cloudflare");
  assert.equal(right[0].name, "Cloudflare");
  assert.notEqual(left[0].context, right[0].context);
});

test("correction replaces a clipped id without an adoption event", () => {
  const observedAt = "2026-11-04T20:00:00.000Z";
  const clipped = {
    origin: "https://joshua.example",
    page_url: "https://joshua.example/uses/",
    label: "Netlify Still my go",
    name: "Netlify Still my go",
    comparison: "netlify still my go",
    tool_id: "observed:netlify-still-my-go",
    unresolved: false,
    status: "current",
    use_case_ids: [],
    section: "Development",
    context: "",
    kind: "product",
    excerpt: "Netlify Still my go-to",
    source_hash: "sha256:old",
    extractor_version: 1,
    taxonomy_version: 1,
    confidence: 0.95,
  };
  const named = {
    ...clipped,
    label: "Netlify",
    name: "Netlify",
    comparison: "netlify",
    tool_id: "observed:netlify",
    context: "Still my go-to for quick static sites.",
    excerpt: "Still my go-to for quick static sites.",
    extractor_version: 2,
  };
  const first = reconcileMemberUsage({
    previous: null,
    origin: clipped.origin,
    page_url: clipped.page_url,
    page_status: "verified",
    observed_at: "2026-11-04T12:00:00.000Z",
    evidence: [clipped],
    pageComplete: true,
  });
  const second = reconcileMemberUsage({
    previous: first.next,
    origin: named.origin,
    page_url: named.page_url,
    page_status: "verified",
    observed_at: observedAt,
    evidence: [named],
    pageComplete: true,
    mode: "correction",
  });
  assert.equal(
    second.events.some((event) => event.event_type === "usage_added"),
    false,
  );
  assert.equal(
    second.events.some((event) => event.event_type === "usage_removed"),
    false,
  );
  assert.equal(
    second.events.some((event) => event.event_type === "correction"),
    true,
  );
  const replayed = replayState([...first.events, ...second.events]);
  const tools = replayed.members[0].tools.map((tool) => tool.tool_id);
  assert.deepEqual(tools, ["observed:netlify"]);
});

test("a smaller denominator is not an adoption change", () => {
  const previous = {
    extractor_version: 2,
    verified_uses_member_count: 9,
    tools: [{ tool_id: "neovim", active_member_count: 2 }],
  };
  const current = {
    extractor_version: 2,
    verified_uses_member_count: 7,
    tools: [{ tool_id: "neovim", active_member_count: 2 }],
  };
  assert.deepEqual(adoptionChange(previous, current), {
    adoption_change: false,
    reason: "coverage",
  });
  assert.deepEqual(
    adoptionChange({ ...previous, extractor_version: 1 }, current),
    { adoption_change: false, reason: "processing" },
  );
});

test("ledger keeps an empty assessed page and drops a homepage copy", async () => {
  const copy = await fixture("homepage-copy.html");
  assert.equal(usesHtmlRepeatsHomepage(copy, copy), true);
  const summary = buildUsesSummary({
    rollup: {
      tools: [],
      verified_uses_member_count: 1,
      eligible_member_count: 2,
      period: "2026-11",
      is_complete: false,
      extractor_version: 2,
    },
    as_of: "2026-11-04T20:00:00.000Z",
    eligible_member_count: 2,
    verified_uses_member_count: 1,
    trend_ready: false,
    members: [
      {
        origin: "https://joshua.example",
        page_url: "https://joshua.example/uses/",
        page_status: "verified_empty",
        accepted_count: 0,
      },
      {
        origin: "https://other.example",
        page_url: "https://other.example/uses/",
        page_status: "out_of_scope",
        accepted_count: 0,
      },
    ],
  });
  const empty = summary.ledger.find(
    (row) => row.origin === "https://joshua.example",
  );
  const home = summary.ledger.find(
    (row) => row.origin === "https://other.example",
  );
  assert.equal(empty.in_denominator, true);
  assert.equal(empty.outcome, "verified_empty");
  assert.equal(home.in_denominator, false);
  assert.match(home.reason, /homepage/i);
  assert.equal(summary.trend_ready, false);
});

test("history copy states that a trend is not ready", async () => {
  const page = await readFile(
    new URL("../../uses.md", import.meta.url),
    "utf8",
  );
  const script = await readFile(
    new URL("../../assets/js/uses.js", import.meta.url),
    "utf8",
  );
  assert.equal(page.includes(NO_TREND), true);
  assert.equal(script.includes(NO_TREND), true);
});
