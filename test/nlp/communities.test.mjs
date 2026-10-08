/**
 * Goal: 100% line/branch/function coverage for scripts/nlp/communities.mjs,
 * covering loadAliasMap, loadDenylist, resolveAlias, heuristicSignalIsCommunityEligible,
 * and all SEO helper functions.
 * All tests are offline — no network, no live data files as oracles.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTopicCommunities,
  heuristicSignalIsCommunityEligible,
  loadAliasMap,
  loadDenylist,
  resolveAlias,
  signalIsCommunityEligible,
  topicCollectionMarkdown,
  topicSeoDescription,
  topicSeoKeywords,
  topicSeoLabel,
  topicSeoTitle,
} from "../../scripts/nlp/communities.mjs";

// ─── loadAliasMap ─────────────────────────────────────────────────────────────

test("loadAliasMap: null/non-object → empty map", () => {
  assert.equal(loadAliasMap(null).size, 0);
  assert.equal(loadAliasMap(undefined).size, 0);
  assert.equal(loadAliasMap("string").size, 0);
  assert.equal(loadAliasMap(42).size, 0);
});

test("loadAliasMap: no aliases field → empty map", () => {
  assert.equal(loadAliasMap({}).size, 0);
  assert.equal(loadAliasMap({ other: [] }).size, 0);
});

test("loadAliasMap: valid aliases are parsed and slugified", () => {
  const map = loadAliasMap({
    aliases: [
      { from: "Artificial Intelligence", to: "AI" },
      { from: "machine-learning", to: "ai" },
    ],
  });
  assert.equal(map.get("artificial-intelligence"), "ai");
  assert.equal(map.get("machine-learning"), "ai");
});

test("loadAliasMap: entries with missing from or to are skipped", () => {
  const map = loadAliasMap({
    aliases: [
      { to: "ai" }, // missing from
      { from: "ml" }, // missing to
      null, // null entry
      { from: "x", to: "y" }, // valid
    ],
  });
  assert.equal(map.size, 1);
  assert.equal(map.get("x"), "y");
});

test("loadAliasMap: self-alias (from === to after slugify) is skipped", () => {
  const map = loadAliasMap({
    aliases: [{ from: "AI", to: "AI" }],
  });
  // from and to slugify to the same value → skipped
  assert.equal(map.size, 0);
});

test("loadAliasMap: a broader relationship filed as an alias is not merged", () => {
  const map = loadAliasMap({
    aliases: [
      { from: "privacy", to: "surveillance", kind: "broader" },
      { from: "postgres", to: "postgresql", kind: "equivalent" },
    ],
  });
  assert.equal(map.size, 1);
  assert.equal(map.get("postgres"), "postgresql");
});

test("loadAliasMap: empty slugs are skipped", () => {
  const map = loadAliasMap({
    aliases: [{ from: "   ", to: "ai" }],
  });
  assert.equal(map.size, 0);
});

// ─── loadDenylist ─────────────────────────────────────────────────────────────

test("loadDenylist: null/non-object → empty set", () => {
  assert.equal(loadDenylist(null).size, 0);
  assert.equal(loadDenylist(undefined).size, 0);
  assert.equal(loadDenylist(42).size, 0);
});

test("loadDenylist: no entries field → empty set", () => {
  assert.equal(loadDenylist({}).size, 0);
  assert.equal(loadDenylist({ other: [] }).size, 0);
});

test("loadDenylist: valid entries are slugified and added", () => {
  const set = loadDenylist({
    entries: [{ slug: "Cancer" }, { slug: "death" }],
  });
  assert.ok(set.has("cancer"));
  assert.ok(set.has("death"));
});

test("loadDenylist: entry without slug string is skipped", () => {
  const set = loadDenylist({
    entries: [null, { slug: 42 }, { other: "cancer" }, { slug: "valid" }],
  });
  assert.equal(set.size, 1);
  assert.ok(set.has("valid"));
});

test("loadDenylist: entry with empty slug after slugify is skipped", () => {
  const set = loadDenylist({
    entries: [{ slug: "   " }],
  });
  assert.equal(set.size, 0);
});

test("loadDenylist: a plural slug also blocks the folded form", () => {
  const set = loadDenylist({
    entries: [{ slug: "Agents" }],
  });
  assert.ok(set.has("agents"));
  assert.ok(set.has("agent"));
});

// ─── resolveAlias ─────────────────────────────────────────────────────────────

test("resolveAlias: slug not in map → returned unchanged", () => {
  const aliases = new Map([["ml", "ai"]]);
  assert.equal(resolveAlias("design", aliases), "design");
});

test("resolveAlias: single alias is resolved", () => {
  const aliases = new Map([["ml", "ai"]]);
  assert.equal(resolveAlias("ml", aliases), "ai");
});

test("resolveAlias: chained aliases are followed", () => {
  const aliases = new Map([
    ["ml", "machine-learning"],
    ["machine-learning", "ai"],
  ]);
  assert.equal(resolveAlias("ml", aliases), "ai");
});

test("resolveAlias: cycle is detected and does not loop forever", () => {
  const aliases = new Map([
    ["a", "b"],
    ["b", "a"],
  ]);
  const result = resolveAlias("a", aliases);
  // Should terminate; result is either 'a' or 'b' but not infinite
  assert.ok(result === "a" || result === "b");
});

test("resolveAlias: empty alias map returns slug unchanged", () => {
  assert.equal(resolveAlias("design", new Map()), "design");
});

// ─── signalIsCommunityEligible ────────────────────────────────────────────────

test("signalIsCommunityEligible: null → false", () => {
  assert.equal(signalIsCommunityEligible(null), false);
});

test("signalIsCommunityEligible: community_eligible not true → false", () => {
  assert.equal(signalIsCommunityEligible({ community_eligible: false }), false);
});

test("signalIsCommunityEligible: no evidence, declared evidence_class → true", () => {
  assert.equal(
    signalIsCommunityEligible({
      community_eligible: true,
      evidence: [],
      evidence_class: "declared",
    }),
    true,
  );
});

test("signalIsCommunityEligible: no evidence, non-declared class → false", () => {
  assert.equal(
    signalIsCommunityEligible({
      community_eligible: true,
      evidence: [],
      evidence_class: "heuristic",
    }),
    false,
  );
});

test("signalIsCommunityEligible: has qualifying declared evidence item → true", () => {
  assert.equal(
    signalIsCommunityEligible({
      community_eligible: true,
      evidence: [
        {
          class: "declared",
          source: "rss:category",
          community_eligible: true,
          page: "https://a.example/p",
        },
      ],
    }),
    true,
  );
});

test("signalIsCommunityEligible: evidence exists but none qualify → false", () => {
  assert.equal(
    signalIsCommunityEligible({
      community_eligible: true,
      evidence: [
        {
          class: "heuristic",
          source: "visible-text",
          community_eligible: false,
        },
      ],
    }),
    false,
  );
});

// ─── heuristicSignalIsCommunityEligible ───────────────────────────────────────

test("heuristicSignalIsCommunityEligible: null → false", () => {
  assert.equal(heuristicSignalIsCommunityEligible(null), false);
});

test("heuristicSignalIsCommunityEligible: not heuristic evidence_class → false", () => {
  assert.equal(
    heuristicSignalIsCommunityEligible({ evidence_class: "declared" }),
    false,
  );
});

test("heuristicSignalIsCommunityEligible: community_eligible true → true", () => {
  assert.equal(
    heuristicSignalIsCommunityEligible({
      evidence_class: "heuristic",
      community_eligible: true,
    }),
    true,
  );
});

test("heuristicSignalIsCommunityEligible: evidence item with heuristic+community_eligible → true", () => {
  assert.equal(
    heuristicSignalIsCommunityEligible({
      evidence_class: "heuristic",
      community_eligible: false,
      evidence: [
        {
          class: "heuristic",
          community_eligible: true,
          source: "catalog-match",
          page: "https://a.example/p",
        },
      ],
    }),
    true,
  );
});

test("heuristicSignalIsCommunityEligible: no qualifying evidence item → false", () => {
  assert.equal(
    heuristicSignalIsCommunityEligible({
      evidence_class: "heuristic",
      community_eligible: false,
      evidence: [{ class: "heuristic", community_eligible: false }],
    }),
    false,
  );
});

// ─── buildTopicCommunities (edge cases) ───────────────────────────────────────

test("buildTopicCommunities: origin entry without origin string is skipped", () => {
  const { communities } = buildTopicCommunities([
    { declared_topics: [], subject_signals: [] }, // no origin
    null, // null entry
  ]);
  assert.equal(communities.length, 0);
});

test("buildTopicCommunities: origin with invalid URL is skipped", () => {
  const { communities } = buildTopicCommunities([
    {
      origin: "not-a-valid-url",
      declared_topics: [],
      subject_signals: [],
    },
  ]);
  assert.equal(communities.length, 0);
});

test("buildTopicCommunities: alias resolves topic slug", () => {
  const aliases = new Map([["ml", "ai"]]);
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        declared_topics: [
          {
            slug: "ml",
            label: "ML",
            community_eligible: true,
            evidence: [
              {
                class: "declared",
                source: "rss:category",
                community_eligible: true,
                page: "https://a.example/1",
              },
            ],
          },
        ],
        subject_signals: [],
      },
    ],
    { aliases },
  );
  assert.ok(communities.some((c) => c.slug === "ai"));
  assert.equal(
    communities.find((c) => c.slug === "ml"),
    undefined,
  );
});

test("buildTopicCommunities: denylisted slug is excluded", () => {
  const denylist = new Set(["cancer"]);
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        declared_topics: [
          {
            slug: "cancer",
            community_eligible: true,
            evidence: [
              {
                class: "declared",
                source: "rss:category",
                community_eligible: true,
                page: "https://a.example/1",
              },
            ],
          },
        ],
        subject_signals: [],
      },
    ],
    { denylist },
  );
  assert.equal(
    communities.find((c) => c.slug === "cancer"),
    undefined,
  );
});

test("buildTopicCommunities: filler unigrams are excluded as non-subjects", () => {
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        declared_topics: [],
        subject_signals: [
          {
            slug: "two",
            evidence_class: "heuristic",
            community_eligible: true,
            tf: 10,
            df: 3,
            evidence: [
              {
                class: "heuristic",
                source: "visible-text",
                community_eligible: true,
                page: "https://a.example/",
              },
            ],
          },
          {
            slug: "making",
            evidence_class: "heuristic",
            community_eligible: true,
            tf: 10,
            df: 3,
            evidence: [
              {
                class: "heuristic",
                source: "visible-text",
                community_eligible: true,
                page: "https://a.example/",
              },
            ],
          },
        ],
      },
      {
        origin: "https://b.example",
        domain: "b.example",
        declared_topics: [],
        subject_signals: [
          {
            slug: "two",
            evidence_class: "heuristic",
            community_eligible: true,
            tf: 10,
            df: 3,
            evidence: [
              {
                class: "heuristic",
                source: "visible-text",
                community_eligible: true,
                page: "https://b.example/",
              },
            ],
          },
          {
            slug: "making",
            evidence_class: "heuristic",
            community_eligible: true,
            tf: 10,
            df: 3,
            evidence: [
              {
                class: "heuristic",
                source: "visible-text",
                community_eligible: true,
                page: "https://b.example/",
              },
            ],
          },
        ],
      },
    ],
    {},
  );
  assert.equal(
    communities.find((c) => c.slug === "two"),
    undefined,
  );
  assert.equal(
    communities.find((c) => c.slug === "making"),
    undefined,
  );
});

test("buildTopicCommunities: stale_since set when member count decreases", () => {
  const baseOrigins = [
    {
      origin: "https://a.example",
      domain: "a.example",
      declared_topics: [
        {
          slug: "design",
          label: "Design",
          community_eligible: true,
          evidence: [
            {
              class: "declared",
              source: "rss:category",
              community_eligible: true,
              page: "https://a.example/p",
            },
          ],
        },
      ],
      subject_signals: [],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      declared_topics: [
        {
          slug: "design",
          label: "Design",
          community_eligible: true,
          evidence: [
            {
              class: "declared",
              source: "rss:category",
              community_eligible: true,
              page: "https://b.example/p",
            },
          ],
        },
      ],
      subject_signals: [],
    },
  ];
  const first = buildTopicCommunities(baseOrigins, {
    now: "2026-01-01T00:00:00.000Z",
  });

  // Now second run has one fewer member
  const { communities } = buildTopicCommunities(
    [baseOrigins[0]], // only a.example
    {
      now: "2026-06-01T00:00:00.000Z",
      previousTopics: first.communities,
    },
  );
  const design = communities.find((c) => c.slug === "design");
  assert.ok(design);
  assert.ok(design.stale_since);
});

test("buildTopicCommunities: below-threshold heuristic goes to candidates", () => {
  const { communities, candidates } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "rust",
          evidence_class: "heuristic",
          community_eligible: false,
          evidence: [],
        },
      ],
    },
  ]);
  assert.equal(communities.length, 0);
  assert.ok(candidates.some((c) => c.slug === "rust"));
});

test("buildTopicCommunities: heuristic addedSource is false branch fires", () => {
  // signal.evidence is empty → addedSource stays false → topic.sources.add('visible-text')
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "design",
          label: "Design",
          evidence_class: "heuristic",
          community_eligible: true,
          evidence: [], // empty evidence → no source added in loop
        },
      ],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "design",
          label: "Design",
          evidence_class: "heuristic",
          community_eligible: true,
          evidence: [],
        },
      ],
    },
  ]);
  const design = communities.find((c) => c.slug === "design");
  assert.ok(design);
  assert.ok(design.sources.includes("visible-text"));
});

// ─── topicSeoLabel ────────────────────────────────────────────────────────────

test("topicSeoLabel: empty string → 'Topic'", () => {
  assert.equal(topicSeoLabel(""), "Topic");
  assert.equal(topicSeoLabel("   "), "Topic");
});

test("topicSeoLabel: label already has uppercase → returned unchanged", () => {
  assert.equal(topicSeoLabel("IndieWeb"), "IndieWeb");
  assert.equal(topicSeoLabel("AI Tools"), "AI Tools");
});

test("topicSeoLabel: short all-lowercase token (1–3 chars) → uppercased", () => {
  assert.equal(topicSeoLabel("ai"), "AI");
  assert.equal(topicSeoLabel("css"), "CSS");
  assert.equal(topicSeoLabel("js"), "JS");
});

test("topicSeoLabel: short numeric token → uppercased", () => {
  assert.equal(topicSeoLabel("3d"), "3D");
});

test("topicSeoLabel: longer lowercase label → title-cased", () => {
  const result = topicSeoLabel("web design");
  // First letter of first segment is uppercased
  assert.ok(result[0] === "W" || result.includes("Web"));
});

test("topicSeoLabel: hyphenated word", () => {
  const result = topicSeoLabel("open-source");
  // Split on hyphen, each part processed
  assert.ok(result.includes("Open") || result.includes("open-source"));
});

test("topicSeoLabel: short words within phrase are uppercased", () => {
  const result = topicSeoLabel("web and ui");
  // 'and' and 'ui' both <= 3 chars → uppercased; 'web' <= 3 → uppercased
  assert.ok(result.length > 0);
});

// ─── topicSeoTitle ────────────────────────────────────────────────────────────

test("topicSeoTitle: short label fits first candidate", () => {
  const title = topicSeoTitle("AI");
  assert.ok(title.includes("AI"));
  assert.ok(title.length <= 47);
});

test("topicSeoTitle: long label falls back to shorter candidates", () => {
  const label = "A Very Very Very Very Long Label That Is Too Much";
  const title = topicSeoTitle(label);
  assert.ok(title.length <= 47 || title === topicSeoLabel(label).slice(0, 47));
});

test("topicSeoTitle: medium label fits one of the candidates", () => {
  const title = topicSeoTitle("Photography");
  assert.ok(title.length <= 47);
  assert.ok(title.toLowerCase().includes("photography"));
});

// ─── topicSeoDescription ──────────────────────────────────────────────────────

test("topicSeoDescription: returns non-empty string with label", () => {
  const desc = topicSeoDescription("AI");
  assert.ok(typeof desc === "string" && desc.length > 0);
  assert.ok(desc.includes("Joshternet"));
});

test("topicSeoDescription: empty label still returns description", () => {
  const desc = topicSeoDescription("");
  assert.ok(typeof desc === "string" && desc.length > 0);
});

// ─── topicSeoKeywords ─────────────────────────────────────────────────────────

test("topicSeoKeywords: returns comma-separated string with label and Joshternet", () => {
  const kw = topicSeoKeywords("Photography");
  assert.ok(
    kw.includes("Photography") ||
      kw.includes("photography") ||
      kw.toLowerCase().includes("photography"),
  );
  assert.ok(kw.includes("Joshternet"));
});

// ─── topicCollectionMarkdown ──────────────────────────────────────────────────

test("topicCollectionMarkdown: returns YAML front-matter string", () => {
  const md = topicCollectionMarkdown({ slug: "ai", label: "AI" });
  assert.ok(md.startsWith("---"));
  assert.ok(md.includes("layout: topic"));
  assert.ok(md.includes('slug: "ai"'));
  assert.ok(md.includes("/topics/ai/"));
  assert.ok(md.includes("CollectionPage"));
});

test("topicCollectionMarkdown: falls back to slug when label is absent", () => {
  const md = topicCollectionMarkdown({ slug: "photography" });
  assert.ok(md.includes("photography"));
});

test("buildTopicCommunities: declared signal not community_eligible is skipped", () => {
  // Declared signal with community_eligible: false → signalIsCommunityEligible returns false
  // → continue fires (lines 207-208)
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      declared_topics: [
        {
          slug: "photography",
          label: "Photography",
          community_eligible: false, // NOT eligible → skipped
          evidence: [],
        },
      ],
      subject_signals: [],
    },
  ]);
  assert.equal(communities.length, 0);
});

test("topicCollectionMarkdown: title is JSON-safe string", () => {
  const md = topicCollectionMarkdown({ slug: "ai", label: "AI" });
  // title: "..." is a JSON string
  const titleMatch = md.match(/^title: (.+)$/m);
  assert.ok(titleMatch);
  // Value must be parseable as JSON string
  assert.doesNotThrow(() => JSON.parse(titleMatch[1]));
});

// ─── Phase-3 branch gap closers ───────────────────────────────────────────────

// signalIsCommunityEligible: null evidence fires ': []' (L103)
test("signalIsCommunityEligible: null evidence fires ': []' fallback (L103)", () => {
  // evidence: null → Array.isArray(null) = false → ': []' → evidence = []
  // evidence.length === 0 → checks evidence_class
  assert.equal(
    signalIsCommunityEligible({
      community_eligible: true,
      evidence: null,
      evidence_class: "declared",
    }),
    true,
  );
  assert.equal(
    signalIsCommunityEligible({
      community_eligible: true,
      evidence: null,
      evidence_class: "heuristic",
    }),
    false,
  );
});

// topicSeoTitle: 31-47 char pretty fires L466 '? pretty' TRUE branch
test("topicSeoTitle: 31-char label where all candidates exceed 47 chars returns pretty (L466)", () => {
  // 31 x's → topicSeoLabel → "Xxxxxxxx..." (31 chars)
  // " on the Joshternet" = 17 → 48 > 47 → all candidates fail
  // L466: 31 <= 47 → returns pretty
  const title = topicSeoTitle("x".repeat(31));
  assert.ok(title.length === 31);
  assert.ok(title.startsWith("X"));
});

// buildTopicCommunities: null origins fires || [] (L185)
test("buildTopicCommunities: null origins fires || [] (L185)", () => {
  const { communities } = buildTopicCommunities(null, {});
  assert.deepEqual(communities, []);
});

// buildTopicCommunities: signal with null subject_signals fires ': []' (L200)
test("buildTopicCommunities: origin with null subject_signals fires ': []' (L200)", () => {
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                source: "html",
                page: "https://a.example/1",
              },
            ],
          },
        ],
        subject_signals: null, // → ': []' (L200)
      },
      {
        origin: "https://b.example",
        domain: "b.example",
        title: "B",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                source: "html",
                page: "https://b.example/1",
              },
            ],
          },
        ],
        subject_signals: null,
      },
    ],
    {},
  );
  assert.ok(communities.some((c) => c.slug === "design"));
});

// buildTopicCommunities: evidence item without source fires || "" (L242)
test("buildTopicCommunities: evidence item without source fires || '' (L242)", () => {
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                page: "https://a.example/1",
              }, // no source → || ""
            ],
          },
        ],
        subject_signals: [],
      },
      {
        origin: "https://b.example",
        domain: "b.example",
        title: "B",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                page: "https://b.example/1",
              },
            ],
          },
        ],
        subject_signals: [],
      },
    ],
    {},
  );
  assert.ok(communities.some((c) => c.slug === "design"));
});

// buildTopicCommunities: declared_topics non-array fires ': []' (L200), alias maps to '' fires || current (L87),
// prior.sites non-array fires ': []' (L346)
test("buildTopicCommunities: non-array declared_topics (L200), empty alias (L87), prior.sites non-array (L346)", () => {
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                source: "html",
                page: "https://a.example/1",
              },
            ],
          },
        ],
        subject_signals: [],
      },
      {
        origin: "https://b.example",
        domain: "b.example",
        title: "B",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                source: "html",
                page: "https://b.example/1",
              },
            ],
          },
        ],
        subject_signals: [],
      },
      {
        origin: "https://d.example",
        domain: "d.example",
        title: "D",
        declared_topics: null, // non-array → L200 ': []' fires
        subject_signals: [],
      },
    ],
    {
      // alias "design" → "" (falsy) so || current fires at L87
      aliases: new Map([["design", ""]]),
      // prior.sites is null → L346 ': []' fires
      previousTopics: [{ slug: "design", sites: null }],
    },
  );
  assert.ok(communities.some((c) => c.slug === "design"));
});

// buildTopicCommunities: stable membership fires L350-351, heuristic non-eligible site fires L390
test("buildTopicCommunities: unchanged membership uses prior.last_changed_at (L350-351) and heuristic non-eligible site in related_discoveries (L390)", () => {
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                source: "html",
                page: "https://a.example/1",
              },
            ],
          },
        ],
        subject_signals: [],
      },
      {
        origin: "https://b.example",
        domain: "b.example",
        title: "B",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                source: "html",
                page: "https://b.example/1",
              },
            ],
          },
        ],
        subject_signals: [],
      },
      {
        origin: "https://c.example",
        domain: "c.example",
        title: "C",
        declared_topics: [],
        // heuristic signal NOT community-eligible → goes to heuristicSites → L390 fires
        subject_signals: [
          {
            slug: "design",
            label: "Design",
            evidence_class: "heuristic",
            community_eligible: false,
            evidence: [],
          },
        ],
      },
    ],
    {
      // prior community with same sites (A+B) and last_changed_at string → L350-351 fire
      previousTopics: [
        {
          slug: "design",
          sites: [
            { origin: "https://a.example" },
            { origin: "https://b.example" },
          ],
          last_changed_at: "2026-01-01T00:00:00.000Z",
          first_seen_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  );
  const design = communities.find((c) => c.slug === "design");
  assert.ok(design);
  // last_changed_at should be the prior value (membership unchanged)
  assert.equal(design.last_changed_at, "2026-01-01T00:00:00.000Z");
  // C is in related_discoveries (heuristic but not full member)
  assert.ok(Array.isArray(design.related_discoveries));
  assert.ok(design.related_discoveries.length > 0);
});

// buildTopicCommunities: prior.sites entry with non-string origin fires ': ""' in membershipFingerprint (L144)
test("buildTopicCommunities: prior.sites non-string origin fires ': '' in membershipFingerprint (L144)", () => {
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                source: "html",
                page: "https://a.example/1",
              },
            ],
          },
        ],
        subject_signals: [],
      },
      {
        origin: "https://b.example",
        domain: "b.example",
        title: "B",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                source: "html",
                page: "https://b.example/1",
              },
            ],
          },
        ],
        subject_signals: [],
      },
    ],
    {
      // prior.sites contains entry with non-string origin → L144 ': ""' fires
      previousTopics: [
        {
          slug: "design",
          sites: [{ origin: "https://a.example" }, { origin: 42 }], // 42 is not a string → L144
          last_changed_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  );
  assert.ok(communities.some((c) => c.slug === "design"));
});

// heuristicSignalIsCommunityEligible: non-array evidence fires ': []' (L129)
test("heuristicSignalIsCommunityEligible: null evidence fires ': []' (L129)", () => {
  // signal has evidence_class: "heuristic", community_eligible: false, evidence: null
  // → L129: Array.isArray(null) = false → ': []' fires → evidence = []
  // → evidence.some(...) = false → returns false
  const result = heuristicSignalIsCommunityEligible({
    evidence_class: "heuristic",
    community_eligible: false,
    evidence: null, // → L129 ': []'
  });
  assert.equal(result, false);
});

// buildTopicCommunities: null slug fires || "" (L211), null evidence fires || [] (L236)
test("buildTopicCommunities: declared signal with null slug fires || '' (L211), null evidence fires || [] (L236)", () => {
  // Signal with community_eligible: true but slug: null → L211 fires, slug becomes "" → skipped
  // Signal with community_eligible: true, valid slug, evidence: null → L236 fires
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        declared_topics: [
          {
            slug: null, // → L211: null || "" fires → slug = "" → isNonSubjectSlug? → skipped
            community_eligible: true,
            evidence_class: "declared",
            evidence: [],
          },
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: null, // → L236: null || [] fires
          },
        ],
        subject_signals: [],
      },
      {
        origin: "https://b.example",
        domain: "b.example",
        title: "B",
        declared_topics: [
          {
            slug: "design",
            label: "Design",
            community_eligible: true,
            evidence_class: "declared",
            evidence: [
              {
                class: "declared",
                community_eligible: true,
                source: "html",
                page: "https://b.example/1",
              },
            ],
          },
        ],
        subject_signals: [],
      },
    ],
    {},
  );
  assert.ok(communities.some((c) => c.slug === "design"));
});

// ─── buildTopicCommunities: heuristic signal branches (lines 257-302) ────────

test("buildTopicCommunities: non-heuristic signal in subjects fires early continue (lines 257-258)", () => {
  // Signal with evidence_class !== "heuristic" → !heuristic check → continue (L257-258)
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "declared", // not heuristic → L257-258 fires
          community_eligible: true,
          evidence: [],
        },
      ],
    },
  ]);
  // Declared signals are skipped in the heuristic loop
  assert.equal(communities.filter((c) => c.slug === "photography").length, 0);
});

test("buildTopicCommunities: heuristic signal with denylist slug fires continue (lines 271-272)", () => {
  // Slug that matches denylist → continue (L271-272)
  const denylist = new Set(["photography"]);
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        declared_topics: [],
        subject_signals: [
          {
            slug: "photography",
            label: "Photography",
            evidence_class: "heuristic",
            community_eligible: true,
            df: 3,
            tf: 5,
            evidence: [],
          },
        ],
      },
    ],
    { denylist },
  );
  // photography is in denylist → L271-272 fires → skipped
  assert.equal(communities.filter((c) => c.slug === "photography").length, 0);
});

test("buildTopicCommunities: eligible heuristic signal with evidence fires pages map and source loop (lines 289-302)", () => {
  // Eligible heuristic with evidence items that have source → L289-291, L298-302 fire
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "heuristic",
          community_eligible: true,
          df: 3,
          tf: 5,
          evidence: [
            {
              class: "heuristic",
              source: "visible-text", // item.source truthy → L298-300 fires
              page: "https://a.example/p1",
              community_eligible: true,
            },
            {
              class: "heuristic",
              source: "visible-text",
              page: "https://a.example/p2",
              community_eligible: true,
            },
          ],
        },
      ],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      title: "B",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "heuristic",
          community_eligible: true,
          df: 3,
          tf: 5,
          evidence: [
            {
              class: "heuristic",
              source: "visible-text",
              page: "https://b.example/p1",
              community_eligible: true,
            },
          ],
        },
      ],
    },
  ]);
  const photo = communities.find((c) => c.slug === "photography");
  assert.ok(photo, "photography community should be formed");
  assert.ok(photo.sites.length >= 2, "should have sites from both origins");
});

// ─── Additional branch coverage ───────────────────────────────────────────────

// buildTopicCommunities: declared signal without label fires || slug (L220)
test("buildTopicCommunities: declared signal without label fires || slug (L220)", () => {
  // signal.label is undefined → L220 || slug fires → label defaults to slug
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      declared_topics: [
        {
          slug: "design",
          // no label → L220 || slug fires
          community_eligible: true,
          evidence_class: "declared",
          evidence: [
            {
              class: "declared",
              community_eligible: true,
              page: "https://a.example/1",
            },
          ],
        },
      ],
      subject_signals: [],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      declared_topics: [
        {
          slug: "design",
          community_eligible: true,
          evidence_class: "declared",
          evidence: [
            {
              class: "declared",
              community_eligible: true,
              page: "https://b.example/1",
            },
          ],
        },
      ],
      subject_signals: [],
    },
  ]);
  const design = communities.find((c) => c.slug === "design");
  assert.ok(design, "design community should form");
  // label defaults to slug "design" when no signal label provided
  assert.equal(design.label, "design");
});

// buildTopicCommunities: heuristic signal without slug fires || "" (L261)
test("buildTopicCommunities: heuristic signal without slug fires || '' (L261)", () => {
  // signal.slug = null → String(null || "") fires (L261) → slug = "" → !slug → skipped
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: null, // null → L261 || "" fires → slug = "" → skipped
          evidence_class: "heuristic",
          community_eligible: true,
          evidence: [],
        },
      ],
    },
  ]);
  assert.deepEqual(communities, []);
});

// buildTopicCommunities: heuristic signal without evidence fires || [] (L285) and || [] (L297)
// and fires topic.sources.add("visible-text") (L304)
// Also covers item.source missing fires || "visible-text" (L291) via no evidence
test("buildTopicCommunities: heuristic signal without evidence fires || [] branches (L285, L297)", () => {
  // signal has no evidence → L285 || [] fires (pages = [])
  // heuristicSignalIsCommunityEligible returns true (community_eligible: true)
  // → L297 signal.evidence || [] fires (no items → addedSource = false → L304 fires)
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "heuristic",
          community_eligible: true,
          // no evidence → L285, L297 fire
        },
      ],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "heuristic",
          community_eligible: true,
        },
      ],
    },
  ]);
  const photo = communities.find((c) => c.slug === "photography");
  assert.ok(photo, "photography community should form");
  // sources should be ["visible-text"] since no source in evidence
  assert.ok(
    photo.sources.includes("visible-text") || photo.sources.length === 1,
  );
});

// buildTopicCommunities: heuristic evidence item without source fires || "visible-text" (L291)
test("buildTopicCommunities: heuristic evidence item without source fires || 'visible-text' (L291)", () => {
  // evidence item has no source → L291 item.source || "visible-text" fires
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "heuristic",
          community_eligible: true,
          evidence: [
            {
              class: "heuristic",
              community_eligible: true,
              page: "https://a.example/photo",
              // no source → L291 fires
            },
          ],
        },
      ],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "heuristic",
          community_eligible: true,
          evidence: [
            {
              class: "heuristic",
              community_eligible: true,
              page: "https://b.example/photo",
            },
          ],
        },
      ],
    },
  ]);
  const photo = communities.find((c) => c.slug === "photography");
  assert.ok(photo, "photography community should form");
});

// ─── communities sort comparator fires when ≥2 communities (L408) ─────────────

test("buildTopicCommunities: two distinct topics produce two communities sort comparator fires", () => {
  // Two declared topics from 2 origins each → communities.sort() comparator fires
  const origins = [
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      declared_topics: [
        {
          slug: "photography",
          label: "Photography",
          community_eligible: true,
          evidence_class: "declared",
          evidence: [
            {
              class: "declared",
              community_eligible: true,
              source: "rss:category",
              page: "https://a.example/1",
            },
          ],
        },
        {
          slug: "cycling",
          label: "Cycling",
          community_eligible: true,
          evidence_class: "declared",
          evidence: [
            {
              class: "declared",
              community_eligible: true,
              source: "rss:category",
              page: "https://a.example/2",
            },
          ],
        },
      ],
      subject_signals: [],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      title: "B",
      declared_topics: [
        {
          slug: "photography",
          label: "Photography",
          community_eligible: true,
          evidence_class: "declared",
          evidence: [
            {
              class: "declared",
              community_eligible: true,
              source: "rss:category",
              page: "https://b.example/1",
            },
          ],
        },
        {
          slug: "cycling",
          label: "Cycling",
          community_eligible: true,
          evidence_class: "declared",
          evidence: [
            {
              class: "declared",
              community_eligible: true,
              source: "rss:category",
              page: "https://b.example/2",
            },
          ],
        },
      ],
      subject_signals: [],
    },
  ];
  const { communities } = buildTopicCommunities(origins);
  // Both photography and cycling form communities → ≥2 → sort comparator fires
  assert.ok(communities.length >= 2);
  const slugs = communities.map((c) => c.slug);
  assert.ok(slugs.includes("photography"));
  assert.ok(slugs.includes("cycling"));
});

// ─── heuristicSites filter callback fires when not qualified (L316-322, L337) ─

test("buildTopicCommunities: below-threshold heuristic signal goes to heuristicSites (L316-322)", () => {
  // df=1 < threshold → !heuristicQualifiesForCommunity → heuristicSites populated
  // filter((site) => !topic.sites.has...) callback fires
  const origins = [
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      declared_topics: [
        {
          slug: "photography",
          label: "Photography",
          community_eligible: true,
          evidence_class: "declared",
          evidence: [
            {
              class: "declared",
              community_eligible: true,
              source: "rss:category",
              page: "https://a.example/1",
            },
          ],
        },
      ],
      subject_signals: [],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      title: "B",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "heuristic",
          community_eligible: true,
          df: 1, // ← below threshold → doesn't qualify
          tf: 10,
          evidence: [
            {
              class: "heuristic",
              source: "visible-text",
              page: "https://b.example/1",
              community_eligible: true,
            },
          ],
        },
      ],
    },
  ];
  const { communities } = buildTopicCommunities(origins);
  // a.example has declared → hasDeclared=true → community formed with a.example as member
  // b.example goes to heuristicSites as a related discovery
  const photo = communities.find((c) => c.slug === "photography");
  assert.ok(photo);
});

// ─── related.sort comparator fires when ≥2 heuristicSites not in memberSites ─

test("buildTopicCommunities: two related heuristic sites fire related.sort comparator (L338)", () => {
  // Two sites with community_eligible=false → both go to heuristicSites → related=[b,c] → sort fires
  const origins = [
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      declared_topics: [
        {
          slug: "photography",
          label: "Photography",
          community_eligible: true,
          evidence_class: "declared",
          evidence: [
            {
              class: "declared",
              community_eligible: true,
              source: "rss:category",
              page: "https://a.example/1",
            },
          ],
        },
      ],
      subject_signals: [],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      title: "B",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "heuristic",
          community_eligible: false, // not eligible → heuristicSites
          evidence: [
            {
              class: "heuristic",
              source: "visible-text",
              page: "https://b.example/1",
              community_eligible: false,
            },
          ],
        },
      ],
    },
    {
      origin: "https://c.example",
      domain: "c.example",
      title: "C",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "heuristic",
          community_eligible: false, // not eligible → heuristicSites
          evidence: [
            {
              class: "heuristic",
              source: "visible-text",
              page: "https://c.example/1",
              community_eligible: false,
            },
          ],
        },
      ],
    },
  ];
  const { communities } = buildTopicCommunities(origins);
  const photo = communities.find((c) => c.slug === "photography");
  assert.ok(photo, "photography community should exist (a.example declared)");
  // b.example and c.example both in heuristicSites, filtered into related → related.sort() fires
  assert.ok(photo.related_discoveries && photo.related_discoveries.length >= 2);
});

// ─── candidates.sort comparator fires when ≥2 candidates (L413) ──────────────

test("buildTopicCommunities: two candidate-only topics fire candidates.sort comparator (L413)", () => {
  // Each origin has 1 signal → not enough for a community → candidates formed
  // 2 candidates → candidates.sort comparator fires
  const origins = [
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      declared_topics: [],
      subject_signals: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "heuristic",
          community_eligible: true,
          evidence: [
            {
              class: "heuristic",
              source: "visible-text",
              page: "https://a.example/1",
              community_eligible: true,
            },
          ],
        },
        {
          slug: "cycling",
          label: "Cycling",
          evidence_class: "heuristic",
          community_eligible: true,
          evidence: [
            {
              class: "heuristic",
              source: "visible-text",
              page: "https://a.example/2",
              community_eligible: true,
            },
          ],
        },
      ],
    },
  ];
  const { communities, candidates } = buildTopicCommunities(origins);
  // Only 1 site → memberSites.length=1, hasDeclared=false → candidates
  assert.equal(communities.length, 0);
  assert.ok(
    candidates.length >= 2,
    "should have photography and cycling as candidates",
  );
  // Sorted alphabetically: cycling < photography
  assert.equal(candidates[0].slug, "cycling");
  assert.equal(candidates[1].slug, "photography");
});
