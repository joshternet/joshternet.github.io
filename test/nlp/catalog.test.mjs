/**
 * Goal: Catalog lexicon from the richest publisher, matched onto other sites.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCatalogMatches,
  CATALOG_SEED_ORIGIN,
  catalogFromContent,
  catalogFromOrigin,
  mergeCatalogs,
  selectCatalogOrigin,
} from "../../scripts/nlp/catalog.mjs";
import { itemMentionsTopic } from "../../scripts/nlp/match.mjs";

test("catalog origin prefers joshuamorris.info when it participates", () => {
  assert.equal(
    selectCatalogOrigin([
      { origin: "https://joshtronic.com", declared_topics: [{ slug: "php" }] },
      {
        origin: CATALOG_SEED_ORIGIN,
        declared_topics: [{ slug: "ai" }, { slug: "privacy" }],
      },
    ]),
    CATALOG_SEED_ORIGIN,
  );
});

test("catalog origin falls back to the richest remaining member", () => {
  assert.equal(
    selectCatalogOrigin([
      { origin: "https://a.example", declared_topics: [{ slug: "ai" }] },
      {
        origin: "https://b.example",
        declared_topics: [{ slug: "ai" }, { slug: "privacy" }, { slug: "law" }],
      },
    ]),
    "https://b.example",
  );
});

test("catalog matches unstructured articles without Microformats", () => {
  const catalog = catalogFromContent(
    [
      {
        site_origin: CATALOG_SEED_ORIGIN,
        declared_topics: [
          { slug: "ai", label: "AI" },
          { slug: "another", label: "another" },
        ],
      },
    ],
    CATALOG_SEED_ORIGIN,
  );

  assert.deepEqual(
    catalog.map((topic) => topic.slug),
    ["ai"],
  );

  const matched = applyCatalogMatches(
    [
      {
        origin: "https://joshtronic.com",
        declared_topics: [],
        subject_signals: [],
      },
    ],
    [
      {
        site_origin: "https://joshtronic.com",
        url: "https://joshtronic.com/2026/09/20/i-stopped-drinking-the-ai-kool-aid/",
        title: "I Stopped Drinking the AI Kool-Aid",
        summary: "I do not trust the robots.",
      },
    ],
    catalog,
  );

  assert.equal(matched[0].subject_signals.length, 1);
  assert.equal(matched[0].subject_signals[0].slug, "ai");
  assert.equal(matched[0].subject_signals[0].community_eligible, true);
  assert.equal(matched[0].subject_signals[0].sources[0], "catalog-match");
  assert.equal(
    matched[0].subject_signals[0].evidence_count,
    matched[0].subject_signals[0].evidence.length,
  );
});

test("catalog match keeps evidence_count aligned when upgrading a signal", () => {
  const matched = applyCatalogMatches(
    [
      {
        origin: "https://www.joshcanhelp.com",
        declared_topics: [],
        subject_signals: [
          {
            slug: "engineering",
            label: "engineering",
            evidence_class: "heuristic",
            community_eligible: false,
            evidence_count: 2,
            sources: ["visible-text"],
            evidence: [
              {
                class: "heuristic",
                source: "visible-text",
                page: "https://www.joshcanhelp.com/one/",
                slug: "engineering",
                value: "engineering",
              },
              {
                class: "heuristic",
                source: "visible-text",
                page: "https://www.joshcanhelp.com/two/",
                slug: "engineering",
                value: "engineering",
              },
            ],
          },
        ],
      },
    ],
    [
      {
        site_origin: "https://www.joshcanhelp.com",
        url: "https://www.joshcanhelp.com/ai/",
        title: "Engineering notes on AI",
        summary: "engineering",
      },
    ],
    [{ slug: "engineering", label: "engineering" }],
  );

  const signal = matched[0].subject_signals.find(
    (entry) => entry.slug === "engineering",
  );

  assert.ok(signal);
  assert.equal(signal.community_eligible, true);
  assert.equal(signal.evidence_count, signal.evidence.length);
  assert.ok(signal.evidence.length >= 2);
  assert.ok(signal.sources.includes("catalog-match"));
  assert.ok(signal.sources.includes("visible-text"));
});

test("phrase match finds AI in a title without tags", () => {
  assert.equal(
    itemMentionsTopic(
      {
        title: "I Stopped Drinking the AI Kool-Aid",
        summary: "",
        declared_topics: [],
      },
      "ai",
      "AI",
    ),
    true,
  );
});

test("mergeCatalogs unions hub signals and feed tags", () => {
  const merged = mergeCatalogs(
    [
      {
        origin: CATALOG_SEED_ORIGIN,
        declared_topics: [{ slug: "books", label: "books" }],
      },
    ],
    [
      {
        site_origin: CATALOG_SEED_ORIGIN,
        declared_topics: [{ slug: "ai", label: "AI" }],
      },
    ],
    CATALOG_SEED_ORIGIN,
  );

  assert.deepEqual(
    merged.map((topic) => topic.slug),
    ["ai", "books"],
  );
});

// ─── selectCatalogOrigin (branch coverage) ────────────────────────────────────

test("selectCatalogOrigin: null entry in list is skipped (continue branch)", () => {
  // Exercises the null-guard continue on the fallback loop
  const result = selectCatalogOrigin([
    null,
    { declared_topics: [] }, // no origin field
    {
      origin: "https://a.example",
      declared_topics: [{ slug: "ai" }, { slug: "design" }],
    },
  ]);
  assert.equal(result, "https://a.example");
});

test("selectCatalogOrigin: null topic in declared_topics is filtered out (filter callback)", () => {
  // The filter callback `topic && ...` fires with topic=null → false → excluded from count
  const result = selectCatalogOrigin([
    {
      origin: "https://a.example",
      declared_topics: [
        null, // null topic → filter callback returns false
        { slug: "photography", label: "Photography" }, // valid
      ],
    },
  ]);
  assert.equal(result, "https://a.example");
});

test("selectCatalogOrigin: non-string topic slug excluded from count", () => {
  // `typeof topic.slug === "string"` is false for numeric slugs
  const result = selectCatalogOrigin([
    {
      origin: "https://a.example",
      declared_topics: [
        { slug: 42 }, // non-string slug → excluded
        { slug: "photography" }, // valid → counted
      ],
    },
  ]);
  assert.equal(result, "https://a.example");
});

test("selectCatalogOrigin: empty list returns empty string", () => {
  assert.equal(selectCatalogOrigin([]), "");
});

test("selectCatalogOrigin: non-array input treated as empty", () => {
  assert.equal(selectCatalogOrigin(null), "");
  assert.equal(selectCatalogOrigin(undefined), "");
});

// ─── catalogFromOrigin (branch coverage) ─────────────────────────────────────

test("catalogFromOrigin: filters non-subject slugs and duplicate slugs", () => {
  const catalog = catalogFromOrigin(
    [
      {
        origin: CATALOG_SEED_ORIGIN,
        declared_topics: [
          { slug: "ai", label: "AI" },
          { slug: "another" }, // non-subject → skipped
          { slug: "ai", label: "AI duplicate" }, // duplicate → skipped
          { slug: "books", label: "Books" },
        ],
      },
    ],
    CATALOG_SEED_ORIGIN,
  );
  const slugs = catalog.map((t) => t.slug);
  assert.ok(slugs.includes("ai"));
  assert.ok(slugs.includes("books"));
  assert.ok(!slugs.includes("another"));
  // Duplicate "ai" is not added twice
  assert.equal(slugs.filter((s) => s === "ai").length, 1);
});

test("catalogFromOrigin: origin not present returns empty array", () => {
  const catalog = catalogFromOrigin(
    [{ origin: "https://a.example", declared_topics: [{ slug: "ai" }] }],
    "https://not-present.example",
  );
  assert.deepEqual(catalog, []);
});

test("catalogFromOrigin: topic without slug field gets empty slug (skipped)", () => {
  const catalog = catalogFromOrigin(
    [
      {
        origin: CATALOG_SEED_ORIGIN,
        declared_topics: [
          { label: "No slug here" }, // no slug field → "" → skipped
          { slug: "photography", label: "Photography" },
        ],
      },
    ],
    CATALOG_SEED_ORIGIN,
  );
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].slug, "photography");
});

test("catalogFromOrigin: topic with empty label falls back to slug", () => {
  const catalog = catalogFromOrigin(
    [
      {
        origin: CATALOG_SEED_ORIGIN,
        declared_topics: [{ slug: "cycling", label: "" }],
      },
    ],
    CATALOG_SEED_ORIGIN,
  );
  assert.equal(catalog[0].label, "cycling");
});

// ─── catalogFromContent (branch coverage) ─────────────────────────────────────

test("catalogFromContent: items from wrong origin are skipped", () => {
  const catalog = catalogFromContent(
    [
      {
        site_origin: "https://other.example", // wrong origin → skipped
        declared_topics: [{ slug: "ai", label: "AI" }],
      },
      {
        site_origin: CATALOG_SEED_ORIGIN,
        declared_topics: [{ slug: "books", label: "Books" }],
      },
    ],
    CATALOG_SEED_ORIGIN,
  );
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].slug, "books");
});

test("catalogFromContent: null item in array is skipped", () => {
  const catalog = catalogFromContent(
    [
      null,
      { site_origin: CATALOG_SEED_ORIGIN, declared_topics: [{ slug: "ai" }] },
    ],
    CATALOG_SEED_ORIGIN,
  );
  assert.equal(catalog.length, 1);
});

test("catalogFromContent: duplicate slug appears only once", () => {
  const catalog = catalogFromContent(
    [
      {
        site_origin: CATALOG_SEED_ORIGIN,
        declared_topics: [
          { slug: "ai", label: "AI" },
          { slug: "ai", label: "AI again" }, // duplicate
        ],
      },
    ],
    CATALOG_SEED_ORIGIN,
  );
  assert.equal(catalog.filter((t) => t.slug === "ai").length, 1);
});

test("catalogFromOrigin: multiple topics trigger sort comparator", () => {
  // With 2+ topics the sort comparator (left, right) => is invoked
  const catalog = catalogFromOrigin(
    [
      {
        origin: CATALOG_SEED_ORIGIN,
        declared_topics: [
          { slug: "photography", label: "Photography" },
          { slug: "ai", label: "AI" },
        ],
      },
    ],
    CATALOG_SEED_ORIGIN,
  );
  assert.equal(catalog[0].slug, "ai");
  assert.equal(catalog[1].slug, "photography");
});

test("catalogFromContent: multiple topics trigger sort comparator", () => {
  // With 2+ topics the sort comparator (left, right) => is invoked
  const catalog = catalogFromContent(
    [
      {
        site_origin: CATALOG_SEED_ORIGIN,
        declared_topics: [
          { slug: "photography", label: "Photography" },
          { slug: "ai", label: "AI" },
        ],
      },
    ],
    CATALOG_SEED_ORIGIN,
  );
  assert.equal(catalog[0].slug, "ai");
  assert.equal(catalog[1].slug, "photography");
});

test("catalogFromContent: topic with empty label falls back to slug", () => {
  const catalog = catalogFromContent(
    [
      {
        site_origin: CATALOG_SEED_ORIGIN,
        declared_topics: [{ slug: "photography", label: "" }],
      },
    ],
    CATALOG_SEED_ORIGIN,
  );
  assert.equal(catalog[0].label, "photography");
});

// ─── applyCatalogMatches (branch coverage) ────────────────────────────────────

test("applyCatalogMatches: signal without origin is passed through unchanged", () => {
  // Exercises the `!signal || typeof signal.origin !== "string"` guard
  const results = applyCatalogMatches(
    [null, { declared_topics: [], subject_signals: [] }], // null + no origin
    [],
    [{ slug: "ai", label: "AI" }],
  );
  assert.equal(results.length, 2);
});

test("applyCatalogMatches: topic with no slug is skipped", () => {
  // Exercises `!topic?.slug` guard
  const results = applyCatalogMatches(
    [{ origin: "https://a.example", declared_topics: [], subject_signals: [] }],
    [],
    [{ slug: "", label: "" }], // empty slug → skipped
  );
  assert.equal(results[0].subject_signals.length, 0);
});

test("applyCatalogMatches: already-declared topic is skipped", () => {
  // Topic is already in declared_topics → `declared.has(topic.slug)` → skipped
  const results = applyCatalogMatches(
    [
      {
        origin: "https://a.example",
        declared_topics: [{ slug: "ai" }],
        subject_signals: [],
      },
    ],
    [
      {
        site_origin: "https://a.example",
        url: "https://a.example/ai-post",
        title: "AI notes",
        summary: "about AI",
      },
    ],
    [{ slug: "ai", label: "AI" }],
  );
  // "ai" already declared → not added to subject_signals
  assert.equal(results[0].subject_signals.length, 0);
});

test("applyCatalogMatches: existing community-eligible signal is skipped", () => {
  // `existing?.community_eligible === true` → continue
  const results = applyCatalogMatches(
    [
      {
        origin: "https://a.example",
        declared_topics: [],
        subject_signals: [
          {
            slug: "design",
            label: "Design",
            evidence_class: "heuristic",
            community_eligible: true,
            evidence: [],
            sources: ["catalog-match"],
          },
        ],
      },
    ],
    [
      {
        site_origin: "https://a.example",
        url: "https://a.example/design",
        title: "Design notes",
        summary: "about design",
      },
    ],
    [{ slug: "design", label: "Design" }],
  );
  // Signal already community_eligible → no update
  assert.equal(results[0].subject_signals.length, 1);
  assert.equal(results[0].subject_signals[0].community_eligible, true);
});

test("applyCatalogMatches: no content hits → topic skipped", () => {
  // `hits.length === 0` → continue
  const results = applyCatalogMatches(
    [
      {
        origin: "https://a.example",
        declared_topics: [],
        subject_signals: [],
      },
    ],
    [
      {
        site_origin: "https://a.example",
        url: "https://a.example/cooking",
        title: "Cooking tips",
        summary: "about cooking",
      },
    ],
    [{ slug: "programming", label: "Programming" }], // no content about programming
  );
  assert.equal(results[0].subject_signals.length, 0);
});

// ─── Phase-3 branch gap closers ───────────────────────────────────────────────

// selectCatalogOrigin: entry with non-array declared_topics fires ': []' (L50)
test("selectCatalogOrigin: entry with null declared_topics fires ': []' fallback (L50)", () => {
  const result = selectCatalogOrigin([
    { origin: "https://a.example", declared_topics: null },
  ]);
  // null declared_topics → count = 0 > bestCount = -1 → still selected as best
  assert.equal(result, "https://a.example");
});

// catalogFromOrigin: null originSignals fires || [] (L74)
test("catalogFromOrigin: null originSignals fires || [] (L74)", () => {
  const result = catalogFromOrigin(null, "https://a.example");
  assert.deepEqual(result, []);
});

// catalogFromContent: null contentItems fires || [] (L114); item without declared_topics fires || [] (L119)
test("catalogFromContent: null input and item without declared_topics fire fallback branches (L114, L119)", () => {
  assert.deepEqual(catalogFromContent(null, "https://a.example"), []);
  // Item with null declared_topics → inner || [] fires (L119)
  const result = catalogFromContent(
    [{ site_origin: "https://a.example", declared_topics: null }],
    "https://a.example",
  );
  assert.deepEqual(result, []);
});

// catalogFromContent: topic with non-string slug fires ': ""' (L120)
test("catalogFromContent: topic with non-string slug fires ': ''  (L120)", () => {
  const result = catalogFromContent(
    [
      {
        site_origin: "https://a.example",
        declared_topics: [{ slug: 42, label: "Should skip" }],
      },
    ],
    "https://a.example",
  );
  assert.deepEqual(result, []);
});

// applyCatalogMatches: null contentItems fires ': []' (L181); null catalog fires ': []' (L182)
test("applyCatalogMatches: null contentItems and catalog fire ': []' branches (L181-182)", () => {
  const signals = [
    {
      origin: "https://a.example",
      declared_topics: [{ slug: "design", label: "Design" }],
    },
  ];
  // null contentItems → ': []'
  const r1 = applyCatalogMatches(signals, null, null);
  assert.ok(Array.isArray(r1));
  // null catalog → ': []'
  const r2 = applyCatalogMatches(signals, [], null);
  assert.ok(Array.isArray(r2));
});

// applyCatalogMatches: null originSignals fires || [] (L184)
test("applyCatalogMatches: null originSignals fires || [] (L184)", () => {
  const result = applyCatalogMatches(null, [], []);
  assert.deepEqual(result, []);
});

// applyCatalogMatches: declared_topics with non-string slug fires ': ""' (L192)
test("applyCatalogMatches: declared_topics entry with non-string slug fires ': '' (L192)", () => {
  const signals = [
    {
      origin: "https://a.example",
      declared_topics: [{ slug: 42 }], // non-string slug → L192 ': ""' fires
      subject_signals: [],
    },
  ];
  const catalog = [{ slug: "design", label: "Design" }];
  const items = [
    {
      site_origin: "https://a.example",
      url: "https://a.example/post",
      title: "Design patterns",
    },
  ];
  const result = applyCatalogMatches(signals, items, catalog);
  assert.ok(Array.isArray(result));
  // The declared set has "" (from non-string slug); "design" not in declared → catalog match proceeds
});

// applyCatalogMatches: content item with non-string url fires ': ""' in buildTopicEvidence (L230)
test("applyCatalogMatches: content hit with non-string url fires ': '' (L230)", () => {
  const signals = [
    {
      origin: "https://a.example",
      declared_topics: [],
      subject_signals: [],
    },
  ];
  const catalog = [{ slug: "design", label: "Design" }];
  const items = [
    { site_origin: "https://a.example", url: null, title: "Design patterns" }, // null url → L230
  ];
  const result = applyCatalogMatches(signals, items, catalog);
  assert.ok(Array.isArray(result));
});

// applyCatalogMatches: existing match with null sources and null evidence (L243, L246)
test("applyCatalogMatches: existing subject_signal with null sources and evidence triggers || fallbacks (L243, L246)", () => {
  const signals = [
    {
      origin: "https://a.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "design",
          label: "Design",
          community_eligible: false,
          sources: null, // → || [] at L243
          evidence: null, // → ': []' at L246
        },
      ],
    },
  ];
  const catalog = [{ slug: "design", label: "Design" }];
  const items = [
    {
      site_origin: "https://a.example",
      url: "https://a.example/post",
      title: "Design patterns",
    },
  ];
  const result = applyCatalogMatches(signals, items, catalog);
  assert.ok(Array.isArray(result));
});

// applyCatalogMatches: null declared_topics fires || [] (L190)
test("applyCatalogMatches: signal with null declared_topics fires || [] (L190)", () => {
  const signals = [
    {
      origin: "https://a.example",
      declared_topics: null, // → || [] at L190
      subject_signals: [],
    },
  ];
  const catalog = [{ slug: "design", label: "Design" }];
  const items = [
    {
      site_origin: "https://a.example",
      url: "https://a.example/post",
      title: "Design patterns",
    },
  ];
  const result = applyCatalogMatches(signals, items, catalog);
  assert.ok(Array.isArray(result));
  // declared_topics is null → declared set is empty → catalog match fires
  assert.equal(result.length, 1);
});
