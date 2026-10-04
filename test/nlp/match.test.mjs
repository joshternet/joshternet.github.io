/**
 * Goal: 100% line/branch/function coverage for scripts/nlp/match.mjs.
 * All tests are offline — no network, no live data files as oracles.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  itemMentionsTopic,
  textMentionsSlug,
} from "../../scripts/nlp/match.mjs";

// ─── textMentionsSlug ─────────────────────────────────────────────────────────

test("textMentionsSlug: empty haystack → false", () => {
  assert.equal(textMentionsSlug("", "ai", "AI"), false);
  assert.equal(textMentionsSlug(null, "ai"), false);
});

test("textMentionsSlug: non-subject slug → false", () => {
  // 'another' is a known non-subject slug
  assert.equal(textMentionsSlug("another article here", "another"), false);
});

test("textMentionsSlug: 1-char label phrase is skipped but multi-char slug is tested", () => {
  // slug="photography" (valid, non-subject) → slugText = "photography" (len 11) → tested
  // label="A" → labelText = "a" (len 1 < 2) → skipped via `continue`
  // "photography" is not in "text", so no match → false
  assert.equal(textMentionsSlug("some random text", "photography", "A"), false);
});

test("textMentionsSlug: slug matches in haystack → true", () => {
  assert.equal(textMentionsSlug("I love photography", "photography"), true);
});

test("textMentionsSlug: hyphenated slug → matched as space-separated in text", () => {
  assert.equal(
    textMentionsSlug("machine learning is fun", "machine-learning"),
    true,
  );
});

test("textMentionsSlug: label match overrides slug", () => {
  assert.equal(
    textMentionsSlug("I use AI tools daily", "artificial-intelligence", "AI"),
    true,
  );
});

test("textMentionsSlug: no match → false", () => {
  assert.equal(textMentionsSlug("cooking recipes", "programming"), false);
});

test("textMentionsSlug: slug with regex special chars is safely escaped", () => {
  // Slug contains no special chars normally, but test edge case
  assert.equal(textMentionsSlug("web design tips", "web-design"), true);
});

test("textMentionsSlug: match requires word boundary (not partial word)", () => {
  // 'ai' must not match 'mail' or 'again' as a whole word
  assert.equal(textMentionsSlug("sending mail again", "ai"), false);
});

// ─── itemMentionsTopic ────────────────────────────────────────────────────────

test("itemMentionsTopic: null item → false", () => {
  assert.equal(itemMentionsTopic(null, "ai"), false);
});

test("itemMentionsTopic: empty slug → false", () => {
  assert.equal(
    itemMentionsTopic({ title: "AI post", declared_topics: [] }, ""),
    false,
  );
});

test("itemMentionsTopic: slug in declared_topics → true", () => {
  assert.equal(
    itemMentionsTopic(
      {
        title: "No mention in title",
        summary: "",
        declared_topics: [{ slug: "photography" }],
      },
      "photography",
    ),
    true,
  );
});

test("itemMentionsTopic: slug in tags → true", () => {
  assert.equal(
    itemMentionsTopic(
      {
        title: "No mention in title",
        summary: "",
        declared_topics: [],
        tags: [{ slug: "design" }],
      },
      "design",
    ),
    true,
  );
});

test("itemMentionsTopic: slug in neighborhoods → true", () => {
  assert.equal(
    itemMentionsTopic(
      {
        title: "No direct mention",
        summary: "",
        declared_topics: [],
        tags: [],
        neighborhoods: [{ slug: "maps" }],
      },
      "maps",
    ),
    true,
  );
});

test("itemMentionsTopic: slug found by text match → true", () => {
  assert.equal(
    itemMentionsTopic(
      {
        title: "Adventures in photography",
        summary: "A post about photography",
        declared_topics: [],
      },
      "photography",
    ),
    true,
  );
});

test("itemMentionsTopic: no match in any source → false", () => {
  assert.equal(
    itemMentionsTopic(
      {
        title: "Cooking recipes",
        summary: "How to cook better food",
        declared_topics: [],
        tags: [],
        neighborhoods: [],
      },
      "programming",
    ),
    false,
  );
});

test("itemMentionsTopic: null item in declared_topics is handled", () => {
  assert.equal(
    itemMentionsTopic(
      {
        title: "About AI",
        summary: "",
        declared_topics: [null, { slug: "ai" }],
      },
      "ai",
    ),
    true,
  );
});

test("itemMentionsTopic: non-array declared_topics treated as empty", () => {
  // Falls through to text match
  assert.equal(
    itemMentionsTopic(
      {
        title: "photography tips",
        summary: "",
        declared_topics: "not-an-array",
      },
      "photography",
    ),
    true,
  );
});

test("itemMentionsTopic: non-array tags treated as empty → falls through to text", () => {
  assert.equal(
    itemMentionsTopic(
      { title: "AI notes", summary: "", declared_topics: [], tags: null },
      "ai",
      "AI",
    ),
    true,
  );
});

test("itemMentionsTopic: non-array neighborhoods treated as empty", () => {
  assert.equal(
    itemMentionsTopic(
      {
        title: "About maps",
        summary: "",
        declared_topics: [],
        tags: [],
        neighborhoods: "not-array",
      },
      "maps",
    ),
    true,
  );
});

// ─── Phase-3 branch: single-char phrase fires L43 continue ─────────────────
test("textMentionsSlug: single-character label phrase fires phrase.length < 2 continue (L43)", () => {
  // slug = "design" (valid multi-char slug, not isNonSubjectSlug) but label = "x" (1 char)
  // → phrases = {"design", "x"}, "design" misses, then "x".length < 2 → continue fires L43
  assert.equal(textMentionsSlug("hello world", "design", "x"), false);
});

// ─── itemMentionsTopic: null title fires || "" (range 16) ────────────────────
test("itemMentionsTopic: null title fires || '' in text construction", () => {
  // item.title is null → || "" fires; summary contains "design" → returns true
  assert.equal(
    itemMentionsTopic(
      {
        title: null, // → item.title || "" fires the || "" branch
        summary: "all about design patterns and architecture",
        declared_topics: [],
        tags: [],
        neighborhoods: [],
      },
      "design",
    ),
    true,
  );
});

// ─── textMentionsSlug: L25 || "" fires when slug is falsy ───────────────────

// L25: String(slug || "") fires when slug is undefined/null/falsy
test("textMentionsSlug: undefined slug fires || '' (L25)", () => {
  // undefined slug → isNonSubjectSlug(undefined)=false → reaches L25
  // String(undefined || "") = "" → || "" fires; slugText="" → no phrase → returns false
  assert.equal(textMentionsSlug("some haystack text", undefined), false);
  assert.equal(textMentionsSlug("some text", null), false);
});
