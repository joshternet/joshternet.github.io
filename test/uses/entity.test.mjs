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
import { buildUsesSummary, coverageReason } from "../../scripts/uses/view.mjs";

const NO_TREND =
  "History starts with the first recorded observations. There isn’t enough comparable history to show a trend yet, but you can explore the current anonymous snapshot.";

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

test("outline section headings are not products", () => {
  const result = extractUsesFromHtml(`
    <h2>Software</h2>
    <p>I write and ship tools for the open web.</p>
    <h2>Hardware</h2>
    <p>Desk gear stays with the setup notes below.</p>
    <h2>Visual Studio Code</h2>
    <p>My daily editor.</p>
  `);
  const labels = result.items.map((item) => item.label);
  assert.equal(labels.includes("Software"), false);
  assert.equal(labels.includes("Hardware"), false);
  assert.equal(labels.includes("Visual Studio Code"), true);
});

test("Website section headings are not phones; paragraph tools stay under Website", () => {
  const result = extractUsesFromHtml(`
    <article>
      <h2>Phone 📱</h2>
      <h3>Hardware</h3>
      <p>Samsung S9+</p>
      <h3>Software</h3>
      <h2>Website 🌐</h2>
      <p><a href="https://gohugo.io/">Hugo</a></p>
    </article>
  `);
  const byLabel = new Map(result.items.map((item) => [item.label, item]));
  assert.equal(byLabel.has("Website 🌐"), false);
  assert.equal(byLabel.has("Phone 📱"), false);
  assert.equal(byLabel.has("Hugo"), true);
  assert.equal(byLabel.get("Hugo").section_path, "Website 🌐");
  assert.equal(byLabel.has("Samsung S9+"), true);
  assert.match(byLabel.get("Samsung S9+").section_path, /Phone/);
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

test("a canonical and observed pair collapses without an adoption event", () => {
  const catalog = {
    tools: [
      { id: "apple-magic-keyboard", name: "Apple Magic Keyboard", aliases: [] },
    ],
    aliases: [],
  };
  const observedAt = "2026-11-05T12:00:00.000Z";
  const keyboard = {
    origin: "https://joshcox.co.uk",
    page_url: "https://joshcox.co.uk/uses/",
    label: "Apple Magic Keyboard",
    name: "Apple Magic Keyboard",
    comparison: "apple magic keyboard",
    tool_id: "apple-magic-keyboard",
    unresolved: false,
    status: "current",
    use_case_ids: [],
    section: "Workstation",
    section_path: "Workstation",
    context: "Low-profile and tidy.",
    kind: "product",
    excerpt: "Low-profile and tidy.",
    source_hash: "sha256:keyboard",
    confidence: 0.95,
  };
  const previous = {
    origin: "https://joshcox.co.uk",
    page_url: "https://joshcox.co.uk/uses/",
    page_status: "verified",
    tools: [
      {
        tool_id: "apple-magic-keyboard",
        name: "Apple Magic Keyboard",
        status: "current",
        use_case_ids: [],
        section: "16” second monitor",
        section_path: "Workstation / 16” second monitor",
        context: "Low-profile and tidy.",
        kind: "product",
      },
      {
        tool_id: "observed:apple-magic-keyboard",
        name: "Apple Magic Keyboard",
        status: "current",
        use_case_ids: [],
        section: "Workstation",
        context: "Low-profile and tidy.",
        kind: "product",
      },
    ],
  };
  const reconciled = reconcileMemberUsage({
    previous,
    origin: previous.origin,
    page_url: previous.page_url,
    page_status: "verified",
    observed_at: observedAt,
    evidence: [keyboard],
    pageComplete: true,
    catalog,
  });
  assert.equal(
    reconciled.events.some((event) => event.event_type === "usage_added"),
    false,
  );
  assert.equal(
    reconciled.events.some((event) => event.event_type === "usage_removed"),
    false,
  );
  const removed = reconciled.events.find(
    (event) => event.tool_id === "observed:apple-magic-keyboard",
  );
  assert.equal(removed.event_type, "correction");
  assert.equal(removed.status, "removed");
  const replayed = replayState([
    {
      ...removed,
      event_type: "usage_added",
      status: "current",
      tool_id: "observed:apple-magic-keyboard",
      observed_at: "2026-11-05T00:00:00.000Z",
    },
    {
      ...removed,
      event_type: "usage_added",
      status: "current",
      tool_id: "apple-magic-keyboard",
      observed_at: "2026-11-05T00:00:00.000Z",
    },
    removed,
  ]);
  assert.deepEqual(
    replayed.members[0].tools.map((tool) => tool.tool_id),
    ["apple-magic-keyboard"],
  );
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

test("homepage copy is out of scope and summary stays anonymous", async () => {
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
  assert.equal(summary.ledger, undefined);
  assert.equal(summary.verified_uses_member_count, 1);
  assert.equal(summary.eligible_member_count, 2);
  assert.equal(summary.trend_ready, false);
  assert.match(coverageReason("out_of_scope"), /homepage/i);
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
