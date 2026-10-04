/**
 * Goal: Branch coverage for scripts/nlp/subjects.mjs, targeting previously
 * uncovered exports (mergeSubjects, buildTopicsHub, buildAllConnections,
 * normalizeMentionEdge, subjectsFromHtml article:section / topic-hub:page).
 * All tests are offline — no network, no live data files as oracles.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAllConnections,
  buildTopicsHub,
  mergeSubjects,
  splitDeclaredAndSignals,
  subjectsFromHtml,
} from "../../scripts/nlp/subjects.mjs";

// ─── subjectsFromHtml: article:section meta ───────────────────────────────────

test("subjectsFromHtml: article:section meta is a declared source", () => {
  const html = `<html><head>
    <meta property="article:section" content="Technology">
  </head><body></body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/post/");
  const tech = subjects.find((s) => s.slug === "technology");
  assert.ok(tech, "should find a 'technology' subject");
  assert.ok(tech.sources.some((s) => s === "meta" || s === "article:section"));
});

test("subjectsFromHtml: topic child page URL uses topic-hub:page source", () => {
  // Page is a child page under /topics/, so subjectsFromHtml adds 'topic-hub:page'
  const html = `<html><body><h1>AI Articles</h1></body></html>`;
  const subjects = subjectsFromHtml(
    html,
    "https://a.example/topics/artificial-intelligence/",
  );
  const ai = subjects.find((s) => s.slug === "artificial-intelligence");
  assert.ok(ai, "should find 'artificial-intelligence'");
  assert.ok(ai.sources.some((s) => s.includes("topic-hub")));
});

test("subjectsFromHtml: invalid pageUrl is handled gracefully", () => {
  // Invalid URL goes to the catch block — should not throw
  const html = `<html><body><span class="p-category">Photography</span></body></html>`;
  const subjects = subjectsFromHtml(html, "not-a-valid-url");
  assert.ok(Array.isArray(subjects));
  const photo = subjects.find((s) => s.slug === "photography");
  assert.ok(photo);
});

test("subjectsFromHtml: topic-hub link with post count is excluded", () => {
  // Links with "(N posts)" text should be skipped
  const html = `<html><body>
    <a href="/topics/ai/">AI (12 posts)</a>
    <a href="/topics/photography/">Photography</a>
  </body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/topics/");
  // "ai" has post count → skipped; "photography" has none → included
  const ai = subjects.find((s) => s.slug === "ai");
  const photo = subjects.find((s) => s.slug === "photography");
  assert.ok(!ai, "ai with post count should be excluded");
  assert.ok(photo, "photography without post count should be included");
});

test("subjectsFromHtml: topic-hub link with bare trailing count uses URL slug", () => {
  const html = `<html><body>
    <a href="/topics/ai/">AI 78</a>
    <a href="/topics/privacy/">privacy 45</a>
    <a href="/topics/books/">Books</a>
  </body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/topics/");
  assert.ok(
    subjects.find((s) => s.slug === "ai"),
    "AI 78 → ai from URL",
  );
  assert.ok(
    !subjects.find((s) => s.slug === "ai-78"),
    "must not invent ai-78 from link text",
  );
  assert.ok(
    subjects.find((s) => s.slug === "privacy"),
    "privacy 45 → privacy from URL",
  );
  assert.ok(
    !subjects.find((s) => s.slug === "privacy-45"),
    "must not invent privacy-45 from link text",
  );
  assert.ok(subjects.find((s) => s.slug === "books"));
});

test("subjectsFromHtml: topic-hub link with no text uses slug as label", () => {
  // Link text is empty → label falls back to slug.replace(/-/g, " ")
  const html = `<html><body>
    <a href="/topics/web-design/"></a>
  </body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/topics/");
  const design = subjects.find((s) => s.slug === "web-design");
  assert.ok(design);
  assert.equal(design.label, "web design");
});

test("subjectsFromHtml: topic-hub link to different origin is excluded", () => {
  const html = `<html><body>
    <a href="https://other.example/topics/ai/">AI on other site</a>
    <a href="/topics/photography/">Photography</a>
  </body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/topics/");
  const ai = subjects.find((s) => s.slug === "ai");
  const photo = subjects.find((s) => s.slug === "photography");
  assert.ok(!ai, "cross-origin topic link excluded");
  assert.ok(photo);
});

// ─── mergeSubjects (branch coverage) ─────────────────────────────────────────

test("mergeSubjects: non-array group is skipped", () => {
  // First group is not an array → continue branch fires
  const result = mergeSubjects(
    null, // non-array → skipped
    [
      {
        slug: "photography",
        label: "Photography",
        sources: ["nlp"],
        evidence: [],
      },
    ],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].slug, "photography");
});

test("mergeSubjects: null subject in array is skipped", () => {
  const result = mergeSubjects([
    null,
    {
      slug: "photography",
      label: "Photography",
      sources: ["nlp"],
      evidence: [],
    },
  ]);
  assert.equal(result.length, 1);
});

test("mergeSubjects: subject with empty slug after slugify is skipped", () => {
  // An empty or non-slugifiable slug → continue
  const result = mergeSubjects([
    { slug: "", label: "Empty slug", sources: ["nlp"], evidence: [] },
    {
      slug: "photography",
      label: "Photography",
      sources: ["nlp"],
      evidence: [],
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].slug, "photography");
});

test("mergeSubjects: page without url is excluded from pages list", () => {
  const result = mergeSubjects([
    {
      slug: "photography",
      label: "Photography",
      sources: ["nlp"],
      evidence: [],
      pages: [
        null, // null page → skipped
        { title: "No URL page" }, // no url → skipped
        { url: "https://a.example/photo", title: "Photo post" }, // valid
      ],
    },
  ]);
  assert.equal(result[0].pages.length, 1);
  assert.equal(result[0].pages[0].url, "https://a.example/photo");
});

// ─── buildTopicsHub (branch coverage) ────────────────────────────────────────

test("buildTopicsHub: null origin entry is skipped", () => {
  const hub = buildTopicsHub([
    null,
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          sources: ["nlp"],
          pages: [],
        },
      ],
    },
  ]);
  assert.equal(hub.length, 1);
  assert.equal(hub[0].slug, "photography");
});

test("buildTopicsHub: origin entry without origin string is skipped", () => {
  const hub = buildTopicsHub([
    { subjects: [{ slug: "ai" }] }, // no origin field
    {
      origin: "https://a.example",
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          sources: ["nlp"],
          pages: [],
        },
      ],
    },
  ]);
  assert.equal(hub.length, 1);
});

test("buildTopicsHub: invalid origin URL causes entry to be skipped", () => {
  const hub = buildTopicsHub([
    {
      origin: "not-a-valid-url",
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          sources: ["nlp"],
          pages: [],
        },
      ],
    },
    {
      origin: "https://a.example",
      subjects: [
        { slug: "books", label: "Books", sources: ["feed"], pages: [] },
      ],
    },
  ]);
  assert.equal(hub.length, 1);
  assert.equal(hub[0].slug, "books");
});

test("buildTopicsHub: empty slug from subject is skipped", () => {
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      subjects: [
        { slug: "", label: "Empty", sources: ["nlp"], pages: [] }, // empty slug
        {
          slug: "photography",
          label: "Photography",
          sources: ["nlp"],
          pages: [],
        },
      ],
    },
  ]);
  assert.equal(hub.length, 1);
  assert.equal(hub[0].slug, "photography");
});

test("buildTopicsHub: page without url is excluded from site pages", () => {
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      subjects: [
        {
          slug: "maps",
          label: "Maps",
          sources: ["nlp"],
          pages: [
            { url: "https://a.example/maps", title: "Maps post" }, // valid
            { title: "No URL" }, // no url → skipped
            null, // null → skipped by optional chaining
          ],
        },
      ],
    },
  ]);
  assert.equal(hub[0].sites[0].pages.length, 1);
  assert.equal(hub[0].sites[0].pages[0].url, "https://a.example/maps");
});

test("buildTopicsHub: multiple sites trigger sort comparators", () => {
  // Two origins share the same slug → sort comparators are invoked
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          sources: ["nlp"],
          pages: [],
        },
        { slug: "books", label: "Books", sources: ["feed"], pages: [] },
      ],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      title: "B",
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          sources: ["nlp"],
          pages: [],
        },
      ],
    },
  ]);
  const photo = hub.find((t) => t.slug === "photography");
  assert.ok(photo);
  // 2 sites → domain sort comparator fired
  assert.equal(photo.sites.length, 2);
  // Slug-level sort also fired (books before photography)
  assert.equal(hub[0].slug, "books");
});

test("mergeSubjects: 2+ subjects trigger the sort comparator", () => {
  const result = mergeSubjects([
    {
      slug: "photography",
      label: "Photography",
      sources: ["nlp"],
      evidence: [],
      pages: [],
    },
    { slug: "ai", label: "AI", sources: ["feed"], evidence: [], pages: [] },
  ]);
  // Sorted alphabetically: ai before photography
  assert.equal(result[0].slug, "ai");
  assert.equal(result[1].slug, "photography");
});

test("buildTopicsHub: subject label falls back to slug when absent", () => {
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      subjects: [{ slug: "photography", label: "", sources: [], pages: [] }],
    },
  ]);
  assert.equal(hub[0].label, "photography");
});

// ─── buildAllConnections (normalizeMentionEdge) ───────────────────────────────

test("buildAllConnections: mention edge with relation=mention passes through unchanged", () => {
  const edges = buildAllConnections({
    participantOrigins: new Set(["https://a.example", "https://b.example"]),
    originLinks: [],
    mentionEdges: [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "mention",
        directed: true,
        source: "webmention",
        href: "https://a.example/reply",
        text: "Nice post",
        rel: [],
        page: "https://a.example/reply",
        evidence: [],
      },
    ],
  });
  assert.ok(edges.some((e) => e.relation === "mention"));
});

test("buildAllConnections: edge with non-mention relation gets normalized", () => {
  // normalizeMentionEdge converts any other edge to mention shape
  const edges = buildAllConnections({
    participantOrigins: new Set(["https://a.example", "https://b.example"]),
    originLinks: [],
    mentionEdges: [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "webmention", // not 'mention' → normalized
        href: "https://a.example/post",
        source: "webmention",
      },
    ],
  });
  const edge = edges.find((e) => e.from === "https://a.example");
  assert.ok(edge);
  assert.equal(edge.relation, "mention");
  assert.equal(edge.directed, true);
  assert.ok(Array.isArray(edge.evidence));
  assert.equal(edge.evidence[0].class, "observed");
  assert.equal(edge.evidence[0].source, "webmention");
});

test("buildAllConnections: normalizeMentionEdge fills optional fields with defaults", () => {
  const edges = buildAllConnections({
    participantOrigins: new Set(["https://a.example", "https://b.example"]),
    originLinks: [],
    mentionEdges: [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "other",
        href: "https://a.example/post",
        // no via, source, text, rel, page
      },
    ],
  });
  const edge = edges[0];
  assert.equal(edge.via, "");
  assert.equal(edge.source, "webmention");
  assert.equal(edge.text, "");
  assert.deepEqual(edge.rel, []);
});

// ─── splitDeclaredAndSignals ──────────────────────────────────────────────────

test("splitDeclaredAndSignals: empty/null input returns empty lists", () => {
  const { declared_topics, subject_signals } = splitDeclaredAndSignals([]);
  assert.deepEqual(declared_topics, []);
  assert.deepEqual(subject_signals, []);
});

test("splitDeclaredAndSignals: subject with community-eligible declared evidence → declared_topics", () => {
  const subjects = [
    {
      slug: "photography",
      label: "Photography",
      evidence_class: "declared",
      community_eligible: true,
      evidence: [
        {
          class: "declared",
          source: "rss:category",
          community_eligible: true,
          page: "https://a.example/1",
          slug: "photography",
        },
      ],
      pages: [{ url: "https://a.example/1", title: "Post" }],
    },
  ];
  const { declared_topics, subject_signals } =
    splitDeclaredAndSignals(subjects);
  assert.equal(declared_topics.length, 1);
  assert.equal(declared_topics[0].slug, "photography");
  assert.equal(subject_signals.length, 0);
});

test("splitDeclaredAndSignals: heuristic subject → subject_signals", () => {
  const subjects = [
    {
      slug: "photography",
      label: "Photography",
      evidence_class: "heuristic",
      community_eligible: true,
      sources: ["nlp"],
      evidence: [
        {
          class: "heuristic",
          source: "nlp",
          community_eligible: false,
          page: "https://a.example/1",
          slug: "photography",
        },
      ],
      pages: [],
    },
  ];
  const { declared_topics, subject_signals } =
    splitDeclaredAndSignals(subjects);
  assert.equal(declared_topics.length, 0);
  assert.equal(subject_signals.length, 1);
  assert.equal(subject_signals[0].slug, "photography");
});

test("splitDeclaredAndSignals: relevance field propagated for heuristic signals", () => {
  const subjects = [
    {
      slug: "photography",
      label: "Photography",
      evidence_class: "heuristic",
      community_eligible: false,
      relevance: { method: "tfidf-v1", value: 0.5 },
      sources: ["nlp"],
      evidence: [],
      pages: [],
    },
  ];
  const { subject_signals } = splitDeclaredAndSignals(subjects);
  assert.deepEqual(subject_signals[0].relevance, {
    method: "tfidf-v1",
    value: 0.5,
  });
});

test("splitDeclaredAndSignals: null input returns empty lists", () => {
  const { declared_topics, subject_signals } = splitDeclaredAndSignals(null);
  assert.deepEqual(declared_topics, []);
  assert.deepEqual(subject_signals, []);
});

test("buildAllConnections: blogrollEdges are included", () => {
  const edges = buildAllConnections({
    participantOrigins: new Set(["https://a.example", "https://b.example"]),
    originLinks: [],
    blogrollEdges: [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "blogroll",
        directed: true,
        source: "blogroll",
        href: "https://b.example/",
        page: "https://a.example/blogroll.opml",
        evidence: [],
      },
    ],
  });
  assert.ok(edges.some((e) => e.relation === "blogroll"));
});

test("buildAllConnections: linkEdges from originLinks are included", () => {
  const edges = buildAllConnections({
    participantOrigins: new Set(["https://a.example", "https://b.example"]),
    originLinks: [
      {
        origin: "https://a.example",
        links: [{ href: "https://b.example/", text: "B site", rel: [] }],
      },
    ],
  });
  // Should have a link edge from a.example to b.example
  assert.ok(
    edges.some(
      (e) => e.from === "https://a.example" && e.to === "https://b.example",
    ),
  );
});

// ─── subjectsFromHtml: octo:octothorpes rel link (lines 70-74) ───────────────

test("subjectsFromHtml: octo:octothorpes link adds octothorpe subject (lines 70-74)", () => {
  // The octoRel while-loop body (L70-74) fires with this HTML
  const html = `<html><body>
    <a rel="octo:octothorpes" href="/~/photography">Photography</a>
  </body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/post/");
  const photo = subjects.find((s) => s.slug === "photography");
  assert.ok(photo, "should find photography subject from octothorpe link");
  // legacySourceName("octothorpe") → "octothorpe" → fires L190-191
  assert.ok(photo.sources.includes("octothorpe"));
});

// ─── subjectsFromHtml: article:tag meta fires L80-81 and L186-187 ────────────

test("subjectsFromHtml: article:tag meta fires article:tag loop (lines 80-81, 186-187)", () => {
  // The articleTag while-loop body (L80-81) fires; legacySourceName fires L186-187
  const html = `<html><head>
    <meta property="article:tag" content="Photography">
    <meta property="article:tag" content="Travel">
  </head><body></body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/post/");
  const photo = subjects.find((s) => s.slug === "photography");
  assert.ok(photo, "should find photography subject from article:tag");
  // legacySourceName("article:tag") → "meta" → fires L186-187
  assert.ok(photo.sources.includes("meta"));
});

// ─── subjectsFromHtml: keywords meta fires L96-99 ────────────────────────────

test("subjectsFromHtml: keywords meta adds each keyword as a subject (lines 96-99)", () => {
  // keywords?.[1] fires → for..of split fires L96-99
  const html = `<html><head>
    <meta name="keywords" content="photography, travel, design">
  </head><body></body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/post/");
  const photo = subjects.find((s) => s.slug === "photography");
  assert.ok(photo, "should find photography subject from keywords meta");
  assert.ok(subjects.find((s) => s.slug === "travel"));
  assert.ok(subjects.find((s) => s.slug === "design"));
});

// ─── subjectsFromHtml: topic-hub link with invalid href fires L111-112 ────────

test("subjectsFromHtml: topic-hub link with invalid href is skipped (lines 111-112)", () => {
  // On hub page, link with invalid href → new URL throws → catch { continue; } fires (L111-112)
  const html = `<html><body>
    <a href="http://">Bad link</a>
    <a href="/topics/photography/">Photography</a>
  </body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/topics/");
  // Bad link is skipped; photography is still found
  const photo = subjects.find((s) => s.slug === "photography");
  assert.ok(photo, "valid link should still be found");
});

// ─── subjectsFromHtml: topic-hub link with non-subject slug fires L121-122 ───

test("subjectsFromHtml: topic-hub link to non-subject slug is skipped (lines 121-122)", () => {
  // slug fails isNonSubjectSlug check → continue (L121-122)
  const html = `<html><body>
    <a href="/topics/about/">About</a>
    <a href="/topics/photography/">Photography</a>
  </body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/topics/");
  // "about" is a non-subject slug → skipped (fires L121-122)
  const photo = subjects.find((s) => s.slug === "photography");
  assert.ok(photo, "photography should be found");
});

// ─── mergeSubjects: community_eligible, declared, relevance, evidence (L241-258) ─

test("mergeSubjects: merges two groups updating community_eligible/declared/relevance/evidence (lines 241-258)", () => {
  // First call creates entry; second call merges via the else path, hitting L241-258
  const group1 = [
    {
      slug: "photography",
      label: "photography",
      evidence_class: "heuristic",
      community_eligible: false,
      evidence: [],
      sources: [],
      pages: [],
    },
  ];
  const group2 = [
    {
      slug: "photography",
      label: "Photography",
      evidence_class: "declared", // → L245-246: existing.evidence_class = "declared"
      community_eligible: true, // → L241-242: existing.community_eligible = true
      relevance: { value: 0.8 }, // → L249-250: existing.relevance = relevance
      evidence: [
        {
          class: "declared",
          source: "rss:category",
          page: "https://a.example/p",
        },
      ], // → L257-258
      sources: ["rss:category"],
      pages: [{ url: "https://a.example/p", title: "Post" }],
    },
  ];
  const merged = mergeSubjects(group1, group2);
  const photo = merged.find((s) => s.slug === "photography");
  assert.ok(photo);
  assert.equal(photo.community_eligible, true);
  assert.equal(photo.evidence_class, "declared");
  assert.ok(photo.relevance);
  assert.ok(photo.evidence.length > 0);
});

// ─── splitDeclaredAndSignals: non-array evidence/pages fire ternary false branches ─

test("splitDeclaredAndSignals: subject with non-array evidence fires ternary false (L300, L317)", () => {
  // evidence=null → Array.isArray(null)=false → : [] fires (L300)
  // pages=null → Array.isArray(null)=false → : [] fires (L317)
  const subjects = [
    {
      slug: "photography",
      label: "Photography",
      evidence_class: "heuristic",
      community_eligible: false,
      evidence: null, // non-array → L300 false branch
      pages: null, // non-array → L317 false branch
    },
  ];
  const { subject_signals } = splitDeclaredAndSignals(subjects);
  assert.equal(subject_signals.length, 1);
  assert.equal(subject_signals[0].slug, "photography");
});

test("splitDeclaredAndSignals: subject without evidence_class fires || 'heuristic' (L332)", () => {
  // evidence_class absent → || "heuristic" fires (L332)
  const subjects = [
    {
      slug: "photography",
      label: "Photography",
      // no evidence_class → || "heuristic" fires
      community_eligible: false,
      evidence: [],
      pages: [],
    },
  ];
  const { subject_signals } = splitDeclaredAndSignals(subjects);
  assert.equal(subject_signals[0].evidence_class, "heuristic");
});

test("splitDeclaredAndSignals: evidence item without source fires source || sources?.[0] || '' (L339)", () => {
  // item.source is absent → item.source || subject.sources?.[0] || "" fires L339
  const subjects = [
    {
      slug: "photography",
      label: "Photography",
      evidence_class: "heuristic",
      community_eligible: false,
      sources: ["visible-text"],
      evidence: [
        {
          class: "heuristic",
          // no source field → fires L339: undefined || "visible-text" || ""
          page: "https://a.example/1",
          slug: "photography",
        },
      ],
      pages: [],
    },
  ];
  const { subject_signals } = splitDeclaredAndSignals(subjects);
  assert.equal(subject_signals.length, 1);
  assert.ok(subject_signals[0].sources.includes("visible-text"));
});

test("splitDeclaredAndSignals: subject with null pages fires pages || [] (L343)", () => {
  // subject.pages=undefined → pages || [] fires (L343)
  const subjects = [
    {
      slug: "photography",
      label: "Photography",
      evidence_class: "heuristic",
      community_eligible: false,
      evidence: [],
      // no pages field → undefined || [] fires at L343
    },
  ];
  const { subject_signals } = splitDeclaredAndSignals(subjects);
  assert.equal(subject_signals.length, 1);
  assert.deepEqual(subject_signals[0].pages, []);
});

// ─── buildTopicsHub: domain fallback, label fallback, sources/pages fallbacks ─

test("buildTopicsHub: origin without domain derives domain from URL (L374)", () => {
  // originEntry.domain absent → domain="" → || new URL(origin).hostname fires (L374)
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      // no domain field → "" || hostname fires
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          sources: ["nlp"],
          pages: [],
        },
      ],
    },
  ]);
  const photo = hub.find((t) => t.slug === "photography");
  assert.ok(photo);
  assert.ok(photo.sites[0].domain === "a.example");
});

test("buildTopicsHub: subject without sources fires || [] (L396)", () => {
  // subject.sources absent → || [] fires (L396)
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          // no sources field → || [] fires at L396
          pages: [],
        },
      ],
    },
  ]);
  const photo = hub.find((t) => t.slug === "photography");
  assert.ok(photo);
  assert.deepEqual(photo.sources, []);
});

test("buildTopicsHub: origin entry without title uses domain as title (L403)", () => {
  // originEntry.title absent → || domain fires (L403)
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      // no title → || domain fires at L403
      subjects: [
        { slug: "photography", label: "Photography", sources: [], pages: [] },
      ],
    },
  ]);
  const photo = hub.find((t) => t.slug === "photography");
  assert.ok(photo);
  assert.equal(photo.sites[0].title, "a.example");
});

test("buildTopicsHub: subject without label falls back to slug (L387)", () => {
  // subject.label absent → || slug fires (L387)
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      subjects: [
        {
          slug: "photography",
          // no label → || slug fires at L387
          sources: [],
          pages: [],
        },
      ],
    },
  ]);
  const photo = hub.find((t) => t.slug === "photography");
  assert.ok(photo);
  assert.equal(photo.label, "photography");
});

test("buildTopicsHub: page without url is skipped (L408), page without title uses '' (L411)", () => {
  // page.url absent → !page?.url → not pushed; page with url but no title → || "" fires (L411)
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          sources: ["nlp"],
          pages: [
            { url: "https://a.example/p", title: "Photography Post" }, // valid
            { title: "No URL" }, // no url → skipped (L408)
            { url: "https://a.example/p2" }, // no title → || "" fires (L411)
          ],
        },
      ],
    },
  ]);
  const photo = hub.find((t) => t.slug === "photography");
  assert.ok(photo);
  assert.ok(photo.sites[0].pages.length === 2); // skipped the no-url page
  assert.equal(photo.sites[0].pages[1].title, "");
});

test("buildTopicsHub: page with no subject.sources fires (sources && sources[0]) || 'nlp' (L412)", () => {
  // subject.sources is empty/absent → (subject.sources && subject.sources[0]) is falsy → || "nlp" fires
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          sources: [], // empty array → sources[0] = undefined → || "nlp" fires
          pages: [{ url: "https://a.example/p", title: "Post" }],
        },
      ],
    },
  ]);
  const photo = hub.find((t) => t.slug === "photography");
  assert.ok(photo);
  assert.equal(photo.sites[0].pages[0].source, "nlp");
});

// ─── Additional branch coverage ───────────────────────────────────────────────

// subjectsFromHtml: octothorpe href without /~/ fires || text (L72)
test("subjectsFromHtml: octothorpe anchor href without /~/ fires || text (L72)", () => {
  // href = "/tags/design" → /\/~\/([^/?#]+)/ doesn't match → undefined || text fires (L72)
  const html = `<html><body>
    <a rel="octo:octothorpes" href="/tags/design">Design</a>
  </body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/post/");
  // "Design" decoded from text → slug = "design"
  const design = subjects.find((s) => s.slug === "design");
  assert.ok(design, "expected design subject from text fallback");
});

// subjectsFromHtml: empty pageUrl fires ': []' (L168)
test("subjectsFromHtml: empty pageUrl fires ': []' (L168)", () => {
  // pageUrl = "" → falsy → L168 ternary false branch (': []') fires
  const html = `<html><head>
    <meta property="article:tag" content="Design">
  </head><body></body></html>`;
  const subjects = subjectsFromHtml(html, "");
  const design = subjects.find((s) => s.slug === "design");
  assert.ok(design);
  assert.deepEqual(design.pages, []); // L168 ': []' → empty pages
});

// mergeSubjects: subject without label fires || slug (L227)
test("mergeSubjects: subject without label fires || slug (L227)", () => {
  // subject.label is undefined → L227 || slug fires → label defaults to slug
  const result = mergeSubjects([
    { slug: "photography" }, // no label → L227 || slug fires
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].label, "photography"); // label = slug
});

// mergeSubjects: subject without evidence_class fires || "heuristic" (L228)
test("mergeSubjects: subject without evidence_class fires || 'heuristic' (L228)", () => {
  // subject.evidence_class is undefined → L228 || "heuristic" fires
  const result = mergeSubjects([
    { slug: "photography", label: "Photography" }, // no evidence_class
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].evidence_class, "heuristic"); // default
});

// mergeSubjects: subject without sources fires || [] (L252)
test("mergeSubjects: subject without sources fires || [] (L252)", () => {
  // subject.sources is undefined → L252 || [] fires
  const result = mergeSubjects([
    { slug: "photography", label: "Photography" }, // no sources
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].sources, []);
});

// mergeSubjects: subject without evidence fires || [] (L256)
test("mergeSubjects: subject without evidence fires || [] (L256)", () => {
  // subject.evidence is undefined → L256 || [] fires
  const result = mergeSubjects([
    { slug: "photography", label: "Photography" }, // no evidence
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].evidence_count, 0);
});

// mergeSubjects: two subjects with same slug fires evidence push (L256 push branch)
test("mergeSubjects: two subjects with same slug fires evidence push (L256 push)", () => {
  const ev = {
    class: "declared",
    source: "html",
    page: "https://a.example",
    slug: "design",
    value: "design",
  };
  const result = mergeSubjects([
    { slug: "design", label: "Design", sources: ["html"], evidence: [ev] },
    { slug: "design", label: "Design", sources: ["html"], evidence: [ev] },
  ]);
  assert.equal(result.length, 1);
});

// mergeSubjects: page without title fires || "" (L262)
test("mergeSubjects: page without title fires || '' (L262)", () => {
  // page.title is missing → L262 || "" fires
  const result = mergeSubjects([
    {
      slug: "photography",
      label: "Photography",
      sources: ["nlp"],
      evidence: [],
      pages: [{ url: "https://a.example/photo" }], // no title → L262 || "" fires
    },
  ]);
  assert.equal(result[0].pages[0].url, "https://a.example/photo");
  assert.equal(result[0].pages[0].title, ""); // || "" = ""
});

// mergeSubjects: subject with relevance fires ? { relevance } (L280 true branch)
test("mergeSubjects: subject with relevance fires ? { relevance } (L280 true branch)", () => {
  // entry.relevance is truthy → L280 ? { relevance: entry.relevance } fires
  const result = mergeSubjects([
    {
      slug: "photography",
      label: "Photography",
      sources: ["nlp"],
      evidence: [],
      relevance: { method: "tfidf-v1", value: 0.8 },
    },
  ]);
  assert.equal(result.length, 1);
  assert.ok(result[0].relevance); // ? branch fires
  assert.equal(result[0].relevance.value, 0.8);
});

// mergeSubjects: subject without relevance fires : {} (L280 false branch)
test("mergeSubjects: subject without relevance fires : {} (L280 false branch)", () => {
  // entry.relevance is undefined → L280 : {} fires
  const result = mergeSubjects([
    {
      slug: "photography",
      label: "Photography",
      sources: ["nlp"],
      evidence: [],
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].relevance, undefined); // : {} → no relevance field
});

// splitDeclaredAndSignals: subject without evidence array fires ': []' (L300)
test("splitDeclaredAndSignals: subject without evidence fires ': []' (L300)", () => {
  // subject.evidence is undefined → Array.isArray(undefined) = false → ': []' fires (L300)
  const { declared_topics } = splitDeclaredAndSignals([
    {
      slug: "design",
      label: "Design",
      evidence: undefined,
      community_eligible: true,
      evidence_class: "declared",
    },
  ]);
  // No eligible evidence → not in declared_topics
  assert.deepEqual(declared_topics, []);
});

// buildTopicsHub: subjects without sources fires || [] (L396)
test("buildTopicsHub: subject without sources fires || [] (L396)", () => {
  // subject.sources is undefined → L396 || [] fires
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      subjects: [{ slug: "photography", label: "Photography" }], // no sources
    },
  ]);
  assert.equal(hub.length, 1);
  assert.equal(hub[0].sites[0].pages.length, 0);
});

// buildTopicsHub: subjects without pages fires || [] (L407)
test("buildTopicsHub: subject without pages fires || [] (L407)", () => {
  // subject.pages is undefined → L407 || [] fires → no pages added
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      subjects: [
        { slug: "photography", label: "Photography", sources: ["nlp"] },
      ], // no pages
    },
  ]);
  assert.equal(hub.length, 1);
  assert.equal(hub[0].sites[0].pages.length, 0);
});

// buildTopicsHub: page without title fires || "" (L411)
test("buildTopicsHub: page without title fires || '' (L411)", () => {
  // page.title is missing → L411 || "" fires
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          sources: ["nlp"],
          pages: [{ url: "https://a.example/photo" }], // no title → L411 fires
        },
      ],
    },
  ]);
  assert.equal(hub[0].sites[0].pages[0].title, ""); // || "" = ""
});

// buildTopicsHub: page source falls back to || "nlp" (L412)
test("buildTopicsHub: page source falls back || 'nlp' (L412)", () => {
  // subject.sources is empty array → sources[0] = undefined → || "nlp" fires (L412)
  const hub = buildTopicsHub([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      subjects: [
        {
          slug: "photography",
          label: "Photography",
          sources: [], // empty sources array → sources[0] = undefined → || "nlp" fires
          pages: [{ url: "https://a.example/photo", title: "Photo" }],
        },
      ],
    },
  ]);
  assert.equal(hub[0].sites[0].pages[0].source, "nlp"); // || "nlp" fires
});

// buildTopicsHub: null origins fires || [] (L366)
test("buildTopicsHub: null origins fires || [] (L366)", () => {
  // origins = null → null || [] fires (L366)
  const hub = buildTopicsHub(null);
  assert.deepEqual(hub, []);
});

// buildTopicsHub: null subjects fires || [] (L379)
test("buildTopicsHub: null subjects fires || [] (L379)", () => {
  // originEntry.subjects = null → null || [] fires (L379)
  const hub = buildTopicsHub([
    { origin: "https://a.example", domain: "a.example", subjects: null },
  ]);
  assert.deepEqual(hub, []);
});

// ─── splitDeclaredAndSignals: declared path L315/L317 coverage ───────────────

// L315: item without source → String(undefined || '') fires
// L317: subject.pages not array → ': []' fires
test("splitDeclaredAndSignals: declared evidence without source fires L315 || ''; null pages fires L317 : []", () => {
  const subjects = [
    {
      slug: "photography",
      label: "Photography",
      evidence_class: "declared",
      community_eligible: true,
      pages: null, // non-array → L317 : [] fires
      evidence: [
        {
          class: "declared",
          community_eligible: true,
          page: "https://a.example/1",
          slug: "photography",
          // no source → L315 || '' fires
        },
      ],
    },
  ];
  const { declared_topics } = splitDeclaredAndSignals(subjects);
  assert.equal(declared_topics.length, 1);
  assert.deepEqual(declared_topics[0].sources, [""]);
  assert.deepEqual(declared_topics[0].pages, []);
});

// ─── splitDeclaredAndSignals: L339 || '' fires when both item.source and subject.sources?.[0] are absent ───

test("splitDeclaredAndSignals: heuristic signal without source and no subject.sources fires L339 || ''", () => {
  // item.source absent AND subject has no sources array → || '' fires (L339)
  const subjects = [
    {
      slug: "photography",
      label: "Photography",
      evidence_class: "heuristic",
      community_eligible: false,
      // no sources field → subject.sources?.[0] = undefined
      evidence: [
        {
          class: "heuristic",
          // no source → item.source = undefined → fires L339: undefined || undefined || ''
          page: "https://a.example/1",
          slug: "photography",
        },
      ],
      pages: [],
    },
  ];
  const { subject_signals } = splitDeclaredAndSignals(subjects);
  assert.equal(subject_signals.length, 1);
  assert.deepEqual(subject_signals[0].sources, [""]);
});

// ─── buildAllConnections: L453 || [] fires with no originLinks ───────────────

test("buildAllConnections: no originLinks fires || [] (L453)", () => {
  // input.originLinks is undefined → undefined || [] fires (L453)
  const result = buildAllConnections({});
  assert.deepEqual(result, []);
});
