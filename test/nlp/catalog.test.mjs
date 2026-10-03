/**
 * Goal: Catalog lexicon from the richest publisher, matched onto other sites.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCatalogMatches,
  CATALOG_SEED_ORIGIN,
  catalogFromContent,
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
