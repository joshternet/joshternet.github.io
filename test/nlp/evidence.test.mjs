/**
 * Goal: Coverage for mergeEvidenceBySlug, legacySubjectsFromSignals,
 * isNonSubjectSlug, heuristicQualifiesForCommunity, buildTopicEvidence,
 * and evidenceIdentityKey — previously uncovered branches.
 * All tests are offline — no network, no live data files as oracles.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTopicEvidence,
  dedupeEvidence,
  evidenceIdentityKey,
  heuristicQualifiesForCommunity,
  isCommunityEligibleSource,
  isDiscoveryOnlySource,
  isNonSubjectSlug,
  isParserArtifactSlug,
  isSensitiveHeuristicSlug,
  legacySubjectsFromSignals,
  mergeEvidenceBySlug,
  canonicalTopicLabel,
} from "../../scripts/nlp/evidence.mjs";
import { MAX_RAW_TOPIC_CHARS } from "../../scripts/nlp/text.mjs";

// ─── mergeEvidenceBySlug ──────────────────────────────────────────────────────

test("mergeEvidenceBySlug: empty array returns empty", () => {
  assert.deepEqual(mergeEvidenceBySlug([]), []);
});

test("mergeEvidenceBySlug: single null element in array is skipped (no slug)", () => {
  // null items are guarded by `!item` inside the for loop
  assert.deepEqual(mergeEvidenceBySlug([null]), []);
});

test("mergeEvidenceBySlug: item without slug string is skipped", () => {
  const result = mergeEvidenceBySlug([
    { slug: 42, value: "oops" }, // non-string slug
    null,
    {
      slug: "photography",
      value: "Photography",
      class: "declared",
      community_eligible: true,
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].slug, "photography");
});

test("mergeEvidenceBySlug: groups evidence items by slug", () => {
  const items = [
    {
      slug: "ai",
      value: "AI",
      class: "declared",
      source: "rss:category",
      page: "https://a.example/1",
      community_eligible: true,
    },
    {
      slug: "ai",
      value: "AI",
      class: "declared",
      source: "json-feed:tag",
      page: "https://a.example/2",
      community_eligible: true,
    },
    {
      slug: "design",
      value: "Design",
      class: "declared",
      source: "microformat:p-category",
      page: "https://a.example/3",
      community_eligible: true,
    },
  ];
  const result = mergeEvidenceBySlug(items);
  assert.equal(result.length, 2);
  const ai = result.find((r) => r.slug === "ai");
  assert.ok(ai);
  assert.equal(ai.evidence_count, 2);
  assert.equal(ai.evidence_class, "declared");
  assert.equal(ai.community_eligible, true);
});

test("mergeEvidenceBySlug: heuristic evidence_class when no declared items", () => {
  const items = [
    {
      slug: "programming",
      value: "programming",
      class: "heuristic",
      source: "visible-text",
      page: "https://a.example/1",
      community_eligible: true,
      relevance: { method: "tfidf-v1", value: 0.8 },
    },
  ];
  const result = mergeEvidenceBySlug(items);
  assert.equal(result[0].evidence_class, "heuristic");
  assert.equal(result[0].relevance.method, "tfidf-v1");
});

test("mergeEvidenceBySlug: observed evidence_class when no declared or heuristic", () => {
  const items = [
    {
      slug: "gardening",
      value: "gardening",
      class: "observed",
      source: "some-source",
      page: "https://a.example/1",
      community_eligible: false,
    },
  ];
  const result = mergeEvidenceBySlug(items);
  assert.equal(result[0].evidence_class, "observed");
});

test("mergeEvidenceBySlug: declared overrides heuristic for evidence_class", () => {
  const items = [
    {
      slug: "books",
      value: "books",
      class: "heuristic",
      source: "visible-text",
      page: "https://a.example/1",
      community_eligible: false,
    },
    {
      slug: "books",
      value: "Books",
      class: "declared",
      source: "rss:category",
      page: "https://a.example/2",
      community_eligible: true,
    },
  ];
  const result = mergeEvidenceBySlug(items);
  assert.equal(result[0].evidence_class, "declared");
});

test("mergeEvidenceBySlug: community_eligible becomes true if any item has it true", () => {
  const items = [
    {
      slug: "maps",
      value: "Maps",
      class: "heuristic",
      source: "visible-text",
      community_eligible: false,
    },
    {
      slug: "maps",
      value: "Maps",
      class: "declared",
      source: "rss:category",
      community_eligible: true,
    },
  ];
  const result = mergeEvidenceBySlug(items);
  assert.equal(result[0].community_eligible, true);
});

test("mergeEvidenceBySlug: label updated from later item with non-empty value", () => {
  const items = [
    {
      slug: "photography",
      value: "photo",
      class: "heuristic",
      community_eligible: false,
    },
    {
      slug: "photography",
      value: "Photography",
      class: "declared",
      community_eligible: true,
    },
  ];
  const result = mergeEvidenceBySlug(items);
  assert.equal(result[0].label, "Photography");
});

test("mergeEvidenceBySlug: item value not a string uses slug as label fallback", () => {
  const items = [
    {
      slug: "cycling",
      value: null,
      class: "declared",
      community_eligible: true,
    },
  ];
  const result = mergeEvidenceBySlug(items);
  assert.equal(result[0].label, "cycling");
});

test("mergeEvidenceBySlug: results are sorted by slug", () => {
  const items = [
    {
      slug: "zoos",
      value: "Zoos",
      class: "declared",
      community_eligible: true,
    },
    { slug: "ai", value: "AI", class: "declared", community_eligible: true },
    {
      slug: "maps",
      value: "Maps",
      class: "declared",
      community_eligible: true,
    },
  ];
  const result = mergeEvidenceBySlug(items);
  assert.equal(result[0].slug, "ai");
  assert.equal(result[1].slug, "maps");
  assert.equal(result[2].slug, "zoos");
});

test("mergeEvidenceBySlug: heuristic without relevance does not add relevance field", () => {
  const items = [
    {
      slug: "cycling",
      value: "cycling",
      class: "heuristic",
      community_eligible: false,
    },
  ];
  const result = mergeEvidenceBySlug(items);
  assert.ok(!Object.hasOwn(result[0], "relevance"));
});

// ─── legacySubjectsFromSignals ────────────────────────────────────────────────

test("legacySubjectsFromSignals: empty array returns empty", () => {
  assert.deepEqual(legacySubjectsFromSignals([]), []);
});

test("legacySubjectsFromSignals: non-array input returns empty", () => {
  assert.deepEqual(legacySubjectsFromSignals(null), []);
  assert.deepEqual(legacySubjectsFromSignals("string"), []);
});

test("legacySubjectsFromSignals: basic signal projection", () => {
  const signals = [
    {
      slug: "photography",
      label: "Photography",
      evidence_class: "declared",
      community_eligible: true,
      evidence: [
        {
          source: "rss:category",
          page: "https://a.example/1",
          class: "declared",
          community_eligible: true,
        },
        {
          source: "json-feed:tag",
          page: "https://a.example/2",
          class: "declared",
          community_eligible: true,
        },
      ],
    },
  ];
  const result = legacySubjectsFromSignals(signals);
  assert.equal(result.length, 1);
  assert.equal(result[0].slug, "photography");
  assert.equal(result[0].label, "Photography");
  assert.equal(result[0].evidence_class, "declared");
  assert.equal(result[0].community_eligible, true);
  assert.ok(result[0].sources.includes("json-feed:tag"));
  assert.ok(result[0].sources.includes("rss:category"));
  assert.equal(result[0].pages.length, 2);
});

test("legacySubjectsFromSignals: deduplicates pages", () => {
  const signals = [
    {
      slug: "ai",
      label: "AI",
      evidence_class: "declared",
      community_eligible: true,
      evidence: [
        { source: "rss:category", page: "https://a.example/1" },
        { source: "rss:category", page: "https://a.example/1" }, // duplicate page
        { source: "json-feed:tag", page: "https://a.example/2" },
      ],
    },
  ];
  const result = legacySubjectsFromSignals(signals);
  assert.equal(result[0].pages.length, 2);
});

test("legacySubjectsFromSignals: pages capped at 8", () => {
  const evidence = Array.from({ length: 12 }, (_, i) => ({
    source: "rss:category",
    page: `https://a.example/${i}`,
  }));
  const signals = [
    {
      slug: "books",
      label: "Books",
      evidence_class: "declared",
      community_eligible: true,
      evidence,
    },
  ];
  const result = legacySubjectsFromSignals(signals);
  assert.ok(result[0].pages.length <= 8);
});

test("legacySubjectsFromSignals: sources sorted alphabetically", () => {
  const signals = [
    {
      slug: "design",
      label: "Design",
      evidence_class: "declared",
      community_eligible: true,
      evidence: [
        { source: "rss:category", page: "https://a.example/1" },
        { source: "json-feed:tag", page: "https://a.example/2" },
        { source: "atom:category", page: "https://a.example/3" },
      ],
    },
  ];
  const result = legacySubjectsFromSignals(signals);
  const sources = result[0].sources;
  const sorted = [...sources].sort();
  assert.deepEqual(sources, sorted);
});

test("legacySubjectsFromSignals: evidence item with no page is excluded from pages", () => {
  const signals = [
    {
      slug: "maps",
      label: "Maps",
      evidence_class: "heuristic",
      community_eligible: false,
      evidence: [
        { source: "visible-text" }, // no page field
        { source: "visible-text", page: "https://a.example/1" },
      ],
    },
  ];
  const result = legacySubjectsFromSignals(signals);
  assert.equal(result[0].pages.length, 1);
});

test("legacySubjectsFromSignals: evidence source fallback to 'unknown'", () => {
  const signals = [
    {
      slug: "cycling",
      label: "Cycling",
      evidence_class: "heuristic",
      community_eligible: true,
      evidence: [
        { page: "https://a.example/1" }, // no source field
      ],
    },
  ];
  const result = legacySubjectsFromSignals(signals);
  assert.ok(result[0].sources.includes("unknown"));
});

test("legacySubjectsFromSignals: relevance field included when present", () => {
  const signals = [
    {
      slug: "postgresql",
      label: "postgresql",
      evidence_class: "heuristic",
      community_eligible: false,
      relevance: { method: "tfidf-v1", value: 0.85 },
      evidence: [],
    },
  ];
  const result = legacySubjectsFromSignals(signals);
  assert.deepEqual(result[0].relevance, { method: "tfidf-v1", value: 0.85 });
});

test("legacySubjectsFromSignals: no relevance field when absent", () => {
  const signals = [
    {
      slug: "books",
      label: "Books",
      evidence_class: "declared",
      community_eligible: true,
      evidence: [],
    },
  ];
  const result = legacySubjectsFromSignals(signals);
  assert.ok(!Object.hasOwn(result[0], "relevance"));
});

// ─── isNonSubjectSlug: empty value branch ─────────────────────────────────────

test("isNonSubjectSlug: empty string → true", () => {
  assert.equal(isNonSubjectSlug(""), true);
});

test("isNonSubjectSlug: filler unigrams from live Topics hub are non-subjects", () => {
  for (const slug of [
    "two",
    "less",
    "find",
    "real",
    "built",
    "making",
    "good",
    "personal",
    "portfolio",
    "joshua",
    "don",
    "team",
  ]) {
    assert.equal(isNonSubjectSlug(slug), true, slug);
  }
  assert.equal(isNonSubjectSlug("joshua-morris"), true);
  assert.equal(isNonSubjectSlug("notes-2"), true);
});

test("isNonSubjectSlug: null/undefined coerced to empty → true", () => {
  assert.equal(isNonSubjectSlug(null), true);
  assert.equal(isNonSubjectSlug(undefined), true);
});

// ─── heuristicQualifiesForCommunity: branch coverage ──────────────────────────

test("heuristicQualifiesForCommunity: empty slug → false", () => {
  assert.equal(heuristicQualifiesForCommunity({ slug: "" }), false);
});

test("heuristicQualifiesForCommunity: slug too short (< 3 chars) → false", () => {
  assert.equal(
    heuristicQualifiesForCommunity({ slug: "ai", df: 5, tf: 10 }),
    false,
  );
});

test("heuristicQualifiesForCommunity: non-subject slug → false", () => {
  // 'notes' is in NON_SUBJECT_UNIGRAMS
  assert.equal(
    heuristicQualifiesForCommunity({ slug: "notes", df: 5, tf: 10 }),
    false,
  );
});

test("heuristicQualifiesForCommunity: sensitive slug → false", () => {
  assert.equal(
    heuristicQualifiesForCommunity({ slug: "cancer", df: 5, tf: 10 }),
    false,
  );
});

test("heuristicQualifiesForCommunity: non-heuristic evidence_class → false", () => {
  assert.equal(
    heuristicQualifiesForCommunity({
      slug: "photography",
      df: 5,
      tf: 10,
      evidence_class: "declared",
    }),
    false,
  );
});

test("heuristicQualifiesForCommunity: missing evidence_class is treated as heuristic", () => {
  // evidence_class is absent/falsy → condition short-circuits
  assert.equal(
    heuristicQualifiesForCommunity({ slug: "photography", df: 3, tf: 4 }),
    true,
  );
});

// ─── buildTopicEvidence: null/short rawValue branch ──────────────────────────

test("buildTopicEvidence: empty rawValue → null (line 337-339)", () => {
  assert.equal(
    buildTopicEvidence({
      rawValue: "",
      source: "rss:category",
      page: "https://a.example/1",
    }),
    null,
  );
});

test("buildTopicEvidence: single-char rawValue → short slug → null (line 345-346)", () => {
  // 'A' → normalised to 'a' → slugifyTopic('a') = 'a' (length 1 < 2) → null
  assert.equal(
    buildTopicEvidence({
      rawValue: "A",
      source: "rss:category",
      page: "https://a.example/1",
    }),
    null,
  );
});

test("buildTopicEvidence: rawValue that slugifies to short slug → null", () => {
  // Whitespace-only becomes empty slug → null
  assert.equal(
    buildTopicEvidence({
      rawValue: "   ",
      source: "rss:category",
      page: "https://a.example/1",
    }),
    null,
  );
});

test("buildTopicEvidence: normal rawValue → transformations has baseline entries", () => {
  // capRemoteString normalises before comparison so 'decoded' is not added for
  // typical inputs; baseline transformations are ['trim', 'case-normalize', 'slugify']
  const evidence = buildTopicEvidence({
    rawValue: "Photography",
    source: "rss:category",
    page: "https://a.example/1",
    evidenceClass: "declared",
    communityEligible: true,
  });
  assert.ok(evidence);
  assert.ok(evidence.transformations.includes("trim"));
  assert.ok(evidence.transformations.includes("slugify"));
});

test("buildTopicEvidence: count field is included when provided", () => {
  const evidence = buildTopicEvidence({
    rawValue: "Photography",
    source: "visible-text",
    page: "https://a.example/1",
    evidenceClass: "heuristic",
    count: 7,
  });
  assert.ok(evidence);
  assert.equal(evidence.count, 7);
});

test("buildTopicEvidence: relevance field is included when provided", () => {
  const evidence = buildTopicEvidence({
    rawValue: "Photography",
    source: "visible-text",
    page: "https://a.example/1",
    evidenceClass: "heuristic",
    relevance: { method: "tfidf-v1", value: 0.75 },
  });
  assert.ok(evidence);
  assert.deepEqual(evidence.relevance, { method: "tfidf-v1", value: 0.75 });
});

test("buildTopicEvidence: feed field is included when provided", () => {
  const evidence = buildTopicEvidence({
    rawValue: "Books",
    source: "rss:category",
    page: "https://a.example/1",
    evidenceClass: "declared",
    feed: "https://a.example/feed.xml",
  });
  assert.ok(evidence);
  assert.equal(evidence.feed, "https://a.example/feed.xml");
});

test("buildTopicEvidence: rawValue ending with space after capRemoteString adds decoded transformation", () => {
  // "x ".repeat(61) normalizes to 121 chars (61 x's + 60 spaces between them).
  // capRemoteString slices at MAX_RAW_TOPIC_CHARS (120): the character at
  // index 119 is a space (odd indices are spaces in "x x x ...").
  // normalizeExtractedText trims that trailing space, so rawValue !== value
  // and "decoded" is prepended to transformations.
  const rawInput = "x ".repeat(MAX_RAW_TOPIC_CHARS / 2 + 1); // 122 chars raw → 121 normalized
  const evidence = buildTopicEvidence({
    rawValue: rawInput,
    source: "rss:category",
    page: "https://a.example/1",
    evidenceClass: "declared",
  });
  assert.ok(evidence);
  assert.ok(evidence.transformations.includes("decoded"));
});

// ─── evidenceIdentityKey ─────────────────────────────────────────────────────

// ─── dedupeEvidence ──────────────────────────────────────────────────────────

test("dedupeEvidence: null item in array is skipped (lines 429-430)", () => {
  const result = dedupeEvidence([
    null,
    {
      class: "declared",
      source: "rss:category",
      page: "https://a.example/1",
      slug: "photography",
    },
  ]);
  assert.equal(result.length, 1);
});

test("dedupeEvidence: item with all-empty fields produces a non-empty key and is retained", () => {
  // evidenceIdentityKey({}) → '\0\0\0' (truthy); item is included not skipped
  const result = dedupeEvidence([
    {},
    {
      class: "declared",
      source: "rss:category",
      page: "https://a.example/1",
      slug: "photography",
    },
  ]);
  // Both items produce distinct keys and are retained
  assert.equal(result.length, 2);
});

test("evidenceIdentityKey: null input → empty string", () => {
  assert.equal(evidenceIdentityKey(null), "");
});

test("evidenceIdentityKey: non-object input → empty string", () => {
  assert.equal(evidenceIdentityKey("string"), "");
  assert.equal(evidenceIdentityKey(42), "");
});

test("evidenceIdentityKey: valid item → key with class, source, page, slug", () => {
  const key = evidenceIdentityKey({
    class: "declared",
    source: "rss:category",
    page: "https://a.example/1",
    slug: "photography",
  });
  assert.ok(key.includes("declared"));
  assert.ok(key.includes("rss:category"));
  assert.ok(key.includes("photography"));
});

// ─── Phase-3 branch gap closers ───────────────────────────────────────────────

// isParserArtifactSlug: null input fires || "" (L82)
test("isParserArtifactSlug: null slug fires || '' fallback (L82)", () => {
  // null → String(null || "") = "" → tested by PARSER_ARTIFACT_SLUG.test("") = false
  assert.equal(isParserArtifactSlug(null), false);
  assert.equal(isParserArtifactSlug(undefined), false);
  assert.equal(isParserArtifactSlug("feeds-default"), true);
  assert.equal(isParserArtifactSlug("keywords-speech"), true);
});

test("canonicalTopicLabel: strips CMS feed/keyword paths and drops leftovers", () => {
  assert.equal(canonicalTopicLabel(""), "");
  assert.equal(canonicalTopicLabel(null), "");
  assert.equal(canonicalTopicLabel("Photography"), "Photography");
  assert.equal(canonicalTopicLabel("feeds/default"), "");
  assert.equal(canonicalTopicLabel("feeds/Partnerships"), "");
  assert.equal(canonicalTopicLabel("feeds/"), "");
  assert.equal(canonicalTopicLabel("keywords/Government"), "");
  assert.equal(canonicalTopicLabel("keywords/Artificial Intelligence"), "");
  assert.equal(canonicalTopicLabel("feeds/lti/extra"), "");
  assert.equal(canonicalTopicLabel("foo/bar"), "");
  assert.equal(canonicalTopicLabel("foo\\bar"), "");
  assert.equal(canonicalTopicLabel("A"), "");
  assert.equal(canonicalTopicLabel("class"), "");
  assert.equal(canonicalTopicLabel("default"), "");
  assert.equal(canonicalTopicLabel("good"), "");
});

test("buildTopicEvidence: CMS path categories are not topics", () => {
  assert.equal(
    buildTopicEvidence({
      rawValue: "feeds/Partnerships",
      source: "rss:category",
      page: "https://www.cs.cmu.edu/news",
    }),
    null,
  );
  assert.equal(
    buildTopicEvidence({
      rawValue: "keywords/Government",
      source: "rss:category",
      page: "https://www.cs.cmu.edu/news",
    }),
    null,
  );
  assert.equal(
    buildTopicEvidence({
      rawValue: "keywords/Artificial Intelligence",
      source: "rss:category",
      page: "https://www.cs.cmu.edu/news",
    }),
    null,
  );
});

// dedupeEvidence: null input fires || [] (L427)
test("dedupeEvidence: null input fires || [] (L427)", () => {
  assert.deepEqual(dedupeEvidence(null), []);
});

// dedupeEvidence: duplicate item with no observed_at fires ': ""' (L453)
test("dedupeEvidence: duplicate with no observed_at fires ': ''  for nextAt (L453)", () => {
  const key = {
    class: "declared",
    source: "html",
    page: "https://a.example/p",
    slug: "design",
  };
  const item1 = { ...key, observed_at: "2026-01-01" };
  const item2 = { ...key }; // no observed_at → nextAt = "" (L453)
  const result = dedupeEvidence([item1, item2]);
  assert.equal(result.length, 1);
  // item1 stays since nextAt="" is falsy and condition fails
  assert.equal(result[0].observed_at, "2026-01-01");
});

// dedupeEvidence: existing without observed_at fires ': ""' false branch (L452)
test("dedupeEvidence: existing with non-string observed_at fires L452 false branch", () => {
  // First item has no observed_at → stored without it (delete at L440-442 fires)
  // Second item (same key) has observed_at → existing.observed_at is undefined (not string) → L452 false fires
  const key = {
    class: "declared",
    source: "html",
    page: "https://a.example/p",
    slug: "design",
  };
  const first = { ...key }; // no observed_at
  const second = { ...key, observed_at: "2026-06-01T00:00:00.000Z" };
  const result = dedupeEvidence([first, second]);
  // second wins: nextAt is truthy, existingAt is "" → !existingAt true → fires L456
  assert.equal(result.length, 1);
  assert.equal(result[0].observed_at, "2026-06-01T00:00:00.000Z");
});

// dedupeEvidence sort: items without page fire || "" (L470)
test("dedupeEvidence: items missing page field fire || '' in sort comparator (L470)", () => {
  // Two items with same class/source/slug but different slugs (unique keys)
  const result = dedupeEvidence([
    { class: "declared", source: "html", slug: "design" }, // no page
    { class: "declared", source: "html", slug: "ux" }, // no page
  ]);
  assert.equal(result.length, 2);
});

// dedupeEvidence: right.page falsy fires || "" in sort comparator (L470)
test("dedupeEvidence: item with null page triggers right.page || '' in sort (L470)", () => {
  // Two items with same source but different pages → same sort level → page comparison fires
  // right.page = null triggers the || "" branch
  const result = dedupeEvidence([
    {
      class: "declared",
      source: "html",
      page: "https://a.example",
      slug: "design",
    },
    { class: "declared", source: "html", page: null, slug: "design" }, // null page → || "" fires
  ]);
  assert.equal(result.length, 2);
});

// legacySubjectsFromSignals: signal with null evidence fires || [] (L551, L557)
test("legacySubjectsFromSignals: signal with null evidence fires || [] (L551, L557)", () => {
  const result = legacySubjectsFromSignals([
    {
      slug: "design",
      label: "Design",
      evidence: null, // → || [] at L551 and L557
    },
  ]);
  assert.equal(result.length, 1);
  // With null evidence, sources = [] (no items to produce "unknown")
  assert.deepEqual(result[0].sources, []);
  assert.deepEqual(result[0].pages, []);
});

// isNonSubjectSlug: all-non-subject parts fires L234-235
test("isNonSubjectSlug: hyphenated slug with all non-subject parts fires L234-235", () => {
  // "article" and "post" are both in NON_SUBJECT_UNIGRAMS → parts.every() is true → L234-235 fires
  assert.equal(isNonSubjectSlug("article-post"), true);
  assert.equal(isNonSubjectSlug("page-post"), true);
  assert.equal(isNonSubjectSlug("actually-hair"), true);
  assert.equal(isNonSubjectSlug("basically-ok"), true);
});

// buildTopicEvidence: observedAt field is included when non-empty string (L378-379)
test("buildTopicEvidence: observedAt non-empty string fires L378-379", () => {
  const evidence = buildTopicEvidence({
    rawValue: "Photography",
    source: "rss:category",
    page: "https://a.example/1",
    evidenceClass: "declared",
    observedAt: "2026-10-01T00:00:00.000Z", // → L378-379 fires
  });
  assert.ok(evidence);
  assert.equal(evidence.observed_at, "2026-10-01T00:00:00.000Z");
});

// ─── isNonSubjectSlug: digit+post fires L216-217 ─────────────────────────────

test("isNonSubjectSlug: slug with digit and 'post' fires L216-217", () => {
  // /\d/.test("2-posts") && /post/.test("2-posts") → return true (L216-217)
  assert.equal(isNonSubjectSlug("2-posts"), true);
  assert.equal(isNonSubjectSlug("10-blog-posts"), true);
  assert.equal(isNonSubjectSlug("post-2"), true);
});

// ─── isNonSubjectSlug: about- prefix fires L220-221 ──────────────────────────

test("isNonSubjectSlug: slug starting with 'about-' fires L220-221", () => {
  // /^about-/.test("about-us") → return true (L220-221)
  assert.equal(isNonSubjectSlug("about-us"), true);
  assert.equal(isNonSubjectSlug("about-page"), true);
});

// ─── isNonSubjectSlug: hyphenated non-all-stopword calls isParserArtifactSlug (L238-239) ───

test("isNonSubjectSlug: hyphenated valid slug reaches isParserArtifactSlug call (L238-239)", () => {
  // "food-health" → not in stopwords, no digit+post, no about-, parts aren't all stopwords
  // → value.includes("-") is true → isParserArtifactSlug("food-health") called (L238-239)
  assert.equal(isNonSubjectSlug("---"), true);
  assert.equal(isNonSubjectSlug("food-health"), false);
  assert.equal(isNonSubjectSlug("machine-learning"), false);
});

// ─── heuristicQualifiesForCommunity: df < 2 fires L312-313 ──────────────────

test("heuristicQualifiesForCommunity: df < 2 returns false (lines 312-313)", () => {
  // df=1 < 2 → return false (L312-313)
  const result = heuristicQualifiesForCommunity({
    slug: "photography",
    evidence_class: "heuristic",
    df: 1,
    tf: 10,
  });
  assert.equal(result, false);
});

// ─── dedupeEvidence: duplicate with newer observed_at replaces older (L456-457) ─

test("dedupeEvidence: duplicate item with newer observed_at replaces existing (lines 456-457)", () => {
  // Two items with same key: first has old observed_at, second has newer → L456-457 fires
  const older = {
    class: "declared",
    source: "rss:category",
    page: "https://a.example/p",
    slug: "photography",
    observed_at: "2026-01-01T00:00:00.000Z",
  };
  const newer = {
    class: "declared",
    source: "rss:category",
    page: "https://a.example/p",
    slug: "photography",
    observed_at: "2026-06-01T00:00:00.000Z",
  };
  const result = dedupeEvidence([older, newer]);
  // Newer observed_at wins → replaces older entry (L456-457)
  assert.equal(result.length, 1);
  assert.equal(result[0].observed_at, "2026-06-01T00:00:00.000Z");
});

// ─── Additional branch coverage ───────────────────────────────────────────────

// isCommunityEligibleSource: null fires || "" (L65)
test("isCommunityEligibleSource: null source fires || '' (L65)", () => {
  // String(null || "") = "" → fires (L65 false branch); "" not in set → false
  assert.equal(isCommunityEligibleSource(null), false);
  assert.equal(isCommunityEligibleSource(undefined), false);
});

// isDiscoveryOnlySource: null fires || "" (L73)
test("isDiscoveryOnlySource: null source fires || '' (L73)", () => {
  // String(null || "") = "" → fires (L73 false branch)
  assert.equal(isDiscoveryOnlySource(null), false);
  assert.equal(isDiscoveryOnlySource("meta:keywords"), true);
  assert.equal(isDiscoveryOnlySource("portfolio:index"), true);
});

// isSensitiveHeuristicSlug: null fires || "" (L276)
test("isSensitiveHeuristicSlug: null slug fires || '' (L276)", () => {
  // String(null || "") = "" → fires (L276 false branch)
  assert.equal(isSensitiveHeuristicSlug(null), false);
});

// heuristicQualifiesForCommunity: df=0 fires || 0 (L308, L309); df>=3 tf<4 fires || df>=3 (L315)
test("heuristicQualifiesForCommunity: df=0 fires || 0 (L308-309)", () => {
  // Must pass a valid slug to reach L308; Number(0)=0 is falsy → 0||0 fires
  assert.equal(
    heuristicQualifiesForCommunity({ slug: "photography", df: 0, tf: 0 }),
    false,
  );
  // df=1 still < 2 but reaches L308/309 with valid values
  assert.equal(
    heuristicQualifiesForCommunity({ slug: "photography", df: 1, tf: 0 }),
    false,
  );
  // df>=3 but tf<4: "tf>=4" is false → short-circuits to "|| df>=3" (L315)
  assert.equal(
    heuristicQualifiesForCommunity({ slug: "photography", df: 3, tf: 0 }),
    true,
  );
});

// buildTopicEvidence: null source fires || "" (L348)
test("buildTopicEvidence: null source fires || '' (L348)", () => {
  // input.source is undefined → undefined || "" fires (L348)
  const evidence = buildTopicEvidence({
    rawValue: "design",
    // no source → L348 fires
    evidenceClass: "declared",
    page: "https://a.example/post",
    communityEligible: true,
    observedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(evidence !== null);
  assert.equal(evidence.source, "");
});

// buildTopicEvidence: null evidenceClass fires || "declared" (L349)
test("buildTopicEvidence: null evidenceClass fires || 'declared' (L349)", () => {
  // input.evidenceClass is undefined → undefined || "declared" fires (L349)
  const evidence = buildTopicEvidence({
    rawValue: "design",
    source: "html:class",
    // no evidenceClass → L349 fires → "declared"
    page: "https://a.example/post",
    communityEligible: true,
    observedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(evidence !== null);
  assert.equal(evidence.class, "declared");
});

// buildTopicEvidence: non-string page fires ': ""' (L367)
test("buildTopicEvidence: non-string page fires ': \"\"' (L367)", () => {
  // input.page is a number → typeof 42 !== "string" → ternary false branch (': ""') fires (L367)
  const evidence = buildTopicEvidence({
    rawValue: "design",
    source: "html:class",
    evidenceClass: "declared",
    page: 42, // non-string → L367 ': ""' fires
    communityEligible: true,
    observedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(evidence !== null);
  assert.equal(evidence.page, "");
});

// buildTopicEvidence: relevance without method fires || "tfidf-v1" (L387)
test("buildTopicEvidence: relevance without method fires || 'tfidf-v1' (L387)", () => {
  // input.relevance.method is undefined → undefined || "tfidf-v1" fires (L387)
  const evidence = buildTopicEvidence({
    rawValue: "design",
    source: "html:class",
    evidenceClass: "declared",
    page: "https://a.example/post",
    communityEligible: true,
    observedAt: "2026-01-01T00:00:00.000Z",
    relevance: { value: 0.8 }, // no method → L387 fires
  });
  assert.ok(evidence !== null);
  assert.equal(evidence.relevance.method, "tfidf-v1");
});

test("dedupeEvidence: null item is skipped by the object guard", () => {
  const result = dedupeEvidence([
    null,
    {
      class: "declared",
      source: "html",
      page: "https://a.example",
      slug: "design",
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].slug, "design");
});

// dedupeEvidence: newer item has observed_at that beats existing fires L452 (? existing.observed_at)
test("dedupeEvidence: existing with observed_at fires L452 ? existing.observed_at", () => {
  // Two items with same key: first has observed_at (existingAt), second has later date
  const result = dedupeEvidence([
    {
      class: "declared",
      source: "html",
      page: "https://a.example",
      slug: "design",
      observed_at: "2026-01-01T00:00:00.000Z",
    },
    {
      class: "declared",
      source: "html",
      page: "https://a.example",
      slug: "design",
      observed_at: "2026-06-01T00:00:00.000Z",
    }, // newer → replaces
  ]);
  assert.equal(result.length, 1);
  // The newer item wins
  assert.equal(result[0].observed_at, "2026-06-01T00:00:00.000Z");
});

// dedupeEvidence: older item loses to existing, fires || nextAt >= existingAt (L455)
test("dedupeEvidence: older item does NOT replace existing fires L455 || nextAt >= existingAt", () => {
  // nextAt < existingAt → (nextAt && (!existingAt || nextAt >= existingAt)) = false → existing stays
  const result = dedupeEvidence([
    {
      class: "declared",
      source: "html",
      page: "https://a.example",
      slug: "design",
      observed_at: "2026-06-01T00:00:00.000Z",
    }, // first: newer
    {
      class: "declared",
      source: "html",
      page: "https://a.example",
      slug: "design",
      observed_at: "2026-01-01T00:00:00.000Z",
    }, // second: older → does NOT replace
  ]);
  assert.equal(result.length, 1);
  // First (newer) stays
  assert.equal(result[0].observed_at, "2026-06-01T00:00:00.000Z");
});

// dedupeEvidence: sort with null page fires || "" (L470)
test("dedupeEvidence: two items sort with null page fires || '' (L470)", () => {
  // Items from different keys sorted; one has null page → null || "" fires in sort
  const result = dedupeEvidence([
    { class: "declared", source: "html", page: null, slug: "design" },
    {
      class: "declared",
      source: "html",
      page: "https://a.example",
      slug: "coding",
    },
  ]);
  assert.equal(result.length, 2);
});
