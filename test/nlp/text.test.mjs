/**
 * Goal: Branch coverage for scripts/nlp/text.mjs — isEnglishLanguage and
 * link classNames parsing which weren't covered by existing tests.
 * All tests are offline — no network, no live data files as oracles.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeHrefForParse,
  isEnglishLanguage,
  metaContent,
  normalizeExtractedText,
  parseHtmlRegions,
  posterImageFromHtml,
  shareDescriptionFromHtml,
  unwrapXmlCdata,
} from "../../scripts/nlp/text.mjs";

// ─── isEnglishLanguage ────────────────────────────────────────────────────────

test("isEnglishLanguage: empty string → true (assumed English)", () => {
  assert.equal(isEnglishLanguage(""), true);
  assert.equal(isEnglishLanguage(null), true);
  assert.equal(isEnglishLanguage(undefined), true);
});

test("isEnglishLanguage: 'en' → true", () => {
  assert.equal(isEnglishLanguage("en"), true);
});

test("isEnglishLanguage: 'en-US' → true", () => {
  assert.equal(isEnglishLanguage("en-US"), true);
});

test("isEnglishLanguage: 'en-GB' → true", () => {
  assert.equal(isEnglishLanguage("en-GB"), true);
});

test("isEnglishLanguage: 'fr' → false", () => {
  assert.equal(isEnglishLanguage("fr"), false);
});

test("isEnglishLanguage: 'de' → false", () => {
  assert.equal(isEnglishLanguage("de"), false);
});

test("isEnglishLanguage: 'zh-CN' → false", () => {
  assert.equal(isEnglishLanguage("zh-CN"), false);
});

test("isEnglishLanguage: 'EN' is case-insensitive → true", () => {
  assert.equal(isEnglishLanguage("EN"), true);
});

// ─── parseHtmlRegions: link class parsing ─────────────────────────────────────

test("parseHtmlRegions: link with class attribute is extracted", () => {
  const html = `<html><body>
    <a href="https://a.example/" class="u-in-reply-to">Reply</a>
  </body></html>`;
  const result = parseHtmlRegions(html);
  const link = result.links.find((l) => l.href.includes("a.example"));
  assert.ok(link);
  assert.ok(link.classNames.includes("u-in-reply-to"));
});

test("parseHtmlRegions: link without class has empty classNames", () => {
  const html = `<html><body>
    <a href="https://b.example/">No class</a>
  </body></html>`;
  const result = parseHtmlRegions(html);
  const link = result.links.find((l) => l.href.includes("b.example"));
  assert.ok(link);
  assert.deepEqual(link.classNames, []);
});

test("parseHtmlRegions: link with rel attribute is extracted", () => {
  const html = `<html><body>
    <a href="https://c.example/" rel="noopener noreferrer">External</a>
  </body></html>`;
  const result = parseHtmlRegions(html);
  const link = result.links.find((l) => l.href.includes("c.example"));
  assert.ok(link);
  assert.ok(link.rel.includes("noopener"));
  assert.ok(link.rel.includes("noreferrer"));
});

test("parseHtmlRegions: link without href is excluded", () => {
  const html = `<html><body>
    <a name="anchor">No href</a>
    <a href="https://d.example/">Has href</a>
  </body></html>`;
  const result = parseHtmlRegions(html);
  // Only the one with href should be included
  assert.equal(result.links.length, 1);
  assert.ok(result.links[0].href.includes("d.example"));
});

test("parseHtmlRegions: noindex detected via robots meta", () => {
  const html = `<html><head>
    <meta name="robots" content="noindex, nofollow">
  </head><body></body></html>`;
  const result = parseHtmlRegions(html);
  assert.equal(result.noindex, true);
});

test("parseHtmlRegions: derived marker detected", () => {
  const html = `<html><head>
    <meta name="joshternet-analysis" content="derived">
  </head><body></body></html>`;
  const result = parseHtmlRegions(html);
  assert.equal(result.derived, true);
});

test("parseHtmlRegions: lang attribute extracted from html element", () => {
  const html = `<html lang="fr-CA"><body></body></html>`;
  const result = parseHtmlRegions(html);
  assert.equal(result.lang, "fr-ca");
});

test("parseHtmlRegions: script and style content excluded from textForTopics", () => {
  const html = `<html><body>
    <style>.a { color: red }</style>
    <script>var x = 1;</script>
    <main><p>Photography tips for beginners</p></main>
  </body></html>`;
  const result = parseHtmlRegions(html);
  assert.ok(!result.textForTopics.includes("color: red"));
  assert.ok(!result.textForTopics.includes("var x"));
  assert.ok(result.textForTopics.toLowerCase().includes("photography"));
});

// ─── decodeHrefForParse: non-string/empty fires early return (L59-60) ────────

test("decodeHrefForParse: null fires early return '' (lines 59-60)", () => {
  // typeof null !== "string" → return "" fires at L59
  assert.equal(decodeHrefForParse(null), "");
  assert.equal(decodeHrefForParse(""), "");
  assert.equal(decodeHrefForParse(undefined), "");
  // Non-empty string passes through
  assert.equal(decodeHrefForParse("https://a.example/"), "https://a.example/");
});

// ─── parseHtmlRegions: non-string input fires ': ""' (L86) ───────────────────

test("parseHtmlRegions: null input fires non-string guard (L86)", () => {
  // typeof null !== "string" → source = "" (L86 false branch fires)
  const result = parseHtmlRegions(null);
  assert.equal(result.links.length, 0);
  assert.equal(result.noindex, false);
});

// ─── parseHtmlRegions: headings while-loop body (lines 117-118) ──────────────

test("parseHtmlRegions: h1/h2/h3 headings are extracted into headings field (lines 117-118)", () => {
  // While-loop body (L117) fires when <h1>, <h2>, or <h3> tags are present
  const html = `<html><body>
    <h1>Photography Tips</h1>
    <h2>Camera Settings</h2>
    <h3>Aperture Guide</h3>
    <p>Some prose content</p>
  </body></html>`;
  const result = parseHtmlRegions(html);
  assert.ok(result.headings.toLowerCase().includes("photography tips"));
  assert.ok(result.headings.toLowerCase().includes("camera settings"));
  assert.ok(result.headings.toLowerCase().includes("aperture guide"));
});

// ─── parseHtmlRegions: nav/footer/header chrome extraction (lines 131-132) ───

test("parseHtmlRegions: nav/header/footer content goes to chrome field (lines 131-132)", () => {
  // The replace callback at L131 fires when nav/footer/header/aside/form tags exist
  const html = `<html><body>
    <header><nav>Home | About | Blog</nav></header>
    <main><p>Main content photography</p></main>
    <footer>Copyright 2026</footer>
    <aside>Related links</aside>
    <form>Search</form>
  </body></html>`;
  const result = parseHtmlRegions(html);
  assert.ok(result.chrome.toLowerCase().includes("home"));
  assert.ok(result.chrome.toLowerCase().includes("copyright"));
  // Chrome content is NOT in textForTopics
  assert.ok(!result.textForTopics.toLowerCase().includes("copyright 2026"));
});

// ─── parseHtmlRegions: code/pre extraction (lines 138-139) ──────────────────

test("parseHtmlRegions: pre/code/kbd/samp content goes to code field (lines 138-139)", () => {
  // The replace callback at L138 fires when pre/code/kbd/samp tags exist
  const html = `<html><body>
    <main>
      <p>Photography tips</p>
      <pre><code>const shutter = 1/250;</code></pre>
      <kbd>Ctrl+S</kbd>
      <samp>Error: file not found</samp>
    </main>
  </body></html>`;
  const result = parseHtmlRegions(html);
  assert.ok(result.code.toLowerCase().includes("shutter"));
  assert.ok(result.code.toLowerCase().includes("ctrl"));
});

// ─── parseHtmlRegions: reversed-attribute meta tags fire || right branch ──────

test("parseHtmlRegions: noindex detected via reversed-attribute meta fires || right branch (L91)", () => {
  // <meta content="noindex" name="robots"> (reversed) → first regex fails → second fires (L91 right branch)
  const html = `<html><head>
    <meta content="noindex, nofollow" name="robots">
  </head><body><p>Test</p></body></html>`;
  const result = parseHtmlRegions(html);
  assert.equal(result.noindex, true);
});

test("parseHtmlRegions: derived detected via reversed-attribute meta fires || right branch (L98)", () => {
  // <meta content="derived" name="joshternet-analysis"> (reversed) → first regex fails → second fires (L98 right branch)
  const html = `<html><head>
    <meta content="derived" name="joshternet-analysis">
  </head><body><p>Test</p></body></html>`;
  const result = parseHtmlRegions(html);
  assert.equal(result.derived, true);
});

// ─── normalizeExtractedText: non-string input fires typeof check (L24) ────────

test("normalizeExtractedText: null input fires typeof !== 'string' branch (L24)", () => {
  // typeof null !== "string" → return "" (L24 left branch of ||)
  assert.equal(normalizeExtractedText(null), "");
  assert.equal(normalizeExtractedText(42), "");
  assert.equal(normalizeExtractedText(undefined), "");
});

test("unwrapXmlCdata: strips wrappers and leftover markers", () => {
  assert.equal(unwrapXmlCdata(""), "");
  assert.equal(unwrapXmlCdata(null), "");
  assert.equal(unwrapXmlCdata("Heathcliff"), "Heathcliff");
  assert.equal(unwrapXmlCdata("<![CDATA[Heathcliff]]>"), "Heathcliff");
  assert.equal(
    unwrapXmlCdata("<![CDATA[Heathcliff]]><![CDATA[Marvin]]>"),
    "HeathcliffMarvin",
  );
  assert.equal(unwrapXmlCdata("<![CDATA[open"), "open");
  assert.equal(unwrapXmlCdata("close]]>"), "close");
});

test("normalizeExtractedText: CDATA categories become plain labels", () => {
  assert.equal(normalizeExtractedText("<![CDATA[Heathcliff]]>"), "Heathcliff");
});

// ─── decodeHrefForParse: non-empty string fires the TRUE path (L57-62) ────────

test("decodeHrefForParse: valid href fires through decode path (L62)", () => {
  // typeof href === "string" && href is truthy → falls through to decodeHtmlEntities
  const result = decodeHrefForParse("https://example.com/&amp;foo");
  assert.equal(result, "https://example.com/&foo");
});

// ─── parseHtmlRegions: attribute before href fires match[1] truthy branch (L155) ─

test("parseHtmlRegions: attribute before href fires match[1] truthy || branch (L155)", () => {
  // <a id="..." href="..."> → match[1] = 'id="..." ' (truthy) → LEFT branch of match[1] || ''
  const html = `<html><body>
    <a id="main-link" href="https://example.com/page">Link</a>
  </body></html>`;
  const result = parseHtmlRegions(html);
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0].href, "https://example.com/page");
});

// ─── parseHtmlRegions: attribute after href but no class/rel uses '' fallback ─

test("parseHtmlRegions: bare href with no other attrs fires match[3] || '' right branch (L156)", () => {
  // <a href="..."> (no attrs after href) → match[3] = '' → '' || '' RIGHT fires
  const html = `<html><body><a href="https://bare.example/">Bare</a></body></html>`;
  const result = parseHtmlRegions(html);
  assert.equal(result.links.length, 1);
  assert.deepEqual(result.links[0].rel, []);
  assert.deepEqual(result.links[0].classNames, []);
});

// ─── parseHtmlRegions: title tag fires titleMatch?.[1] truthy path (L108) ────

test("parseHtmlRegions: html with title tag fires titleMatch truthy path (L108)", () => {
  // <title>Content</title> → titleMatch[1] = 'Content' (truthy) → LEFT path of || '' fires
  const html = `<html><head><title>Photography Blog</title></head><body>
    <p>Welcome to photography.</p>
  </body></html>`;
  const result = parseHtmlRegions(html);
  assert.ok(result.title.toLowerCase().includes("photography"));
});

test("posterImageFromHtml prefers og:image and resolves a relative URL", () => {
  const html = `<head>
    <meta name="twitter:image" content="https://cdn.example/twitter.jpg">
    <meta content="https://cdn.example/og.jpg" property="og:image">
  </head>`;
  assert.equal(
    posterImageFromHtml(html, "https://a.example/post/"),
    "https://cdn.example/og.jpg",
  );
  assert.equal(
    posterImageFromHtml(
      `<meta property="og:image" content="/social.jpg">`,
      "https://a.example/post/",
    ),
    "https://a.example/social.jpg",
  );
  assert.equal(posterImageFromHtml(""), "");
  assert.equal(metaContent("", "og:image"), "");
  assert.equal(metaContent("<meta>", ""), "");
  assert.equal(metaContent(null, "og:image"), "");
});

test("posterImageFromHtml rejects an unparseable poster URL", () => {
  assert.equal(
    posterImageFromHtml(
      `<meta property="og:image" content="https://exa mple.com/og.jpg">`,
    ),
    "",
  );
});

test("posterImageFromHtml rejects non-https posters", () => {
  assert.equal(
    posterImageFromHtml(
      `<meta property="og:image" content="http://cdn.example/og.jpg">`,
    ),
    "",
  );
});

test("shareDescriptionFromHtml prefers the Open Graph description", () => {
  const html = `<head>
    <meta name="description" content="Meta blurb">
    <meta property="og:description" content="Social blurb &amp; more">
  </head>`;
  assert.equal(shareDescriptionFromHtml(html), "Social blurb & more");
  assert.equal(
    shareDescriptionFromHtml(`<meta name="description" content="Only meta">`),
    "Only meta",
  );
  assert.equal(shareDescriptionFromHtml(""), "");
});
