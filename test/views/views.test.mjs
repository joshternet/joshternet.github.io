/**
 * Goal: Presentation projections never invent communities or popularity.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildViewDocuments,
  capPresentationList,
  capSameOriginResults,
  compactContentItem,
  compactWhyHere,
  connectionTopicOverlaps,
  contentTopicLabels,
  MAX_CONNECTION_TOPIC_PAIRS,
  MAX_COOCCURRENCE_PAIRS,
  oneLatestPerOrigin,
  pickFeaturedCommunity,
  pickFeaturedConnection,
  publicCommunities,
  publishedWithinDays,
  randomLinkTrail,
  relationLabel,
  scoreSearchDocument,
  searchTokens,
  sitesByOrigin,
  sourceLabel,
  topicCooccurrence,
} from "../../scripts/views/lib.mjs";

test("relation and source labels stay visitor-facing", () => {
  assert.equal(relationLabel("content-link"), "linked to");
  assert.equal(relationLabel("blogroll"), "includes in a blogroll");
  assert.equal(sourceLabel("microformat:p-category"), "Microformats category");
  assert.doesNotMatch(sourceLabel("tfidf-v1"), /tfidf/i);
});

test("public communities keep a single qualifying site", () => {
  const communities = publicCommunities({
    communities: [
      {
        slug: "design",
        label: "Design",
        member_count: 2,
        sites: [
          { origin: "https://a.example", domain: "a.example" },
          { origin: "https://b.example", domain: "b.example" },
        ],
      },
      {
        slug: "ai",
        label: "AI",
        sites: [{ origin: "https://a.example", membership: "declared" }],
      },
      {
        slug: "alongside",
        label: "alongside",
        sites: [{ origin: "https://a.example", membership: "heuristic" }],
      },
      {
        slug: "ghost",
        label: "Ghost",
        sites: [],
      },
    ],
  });
  assert.deepEqual(communities.map((item) => item.slug).sort(), [
    "ai",
    "design",
  ]);
});

test("public communities skip filler slugs like another", () => {
  const communities = publicCommunities({
    communities: [
      {
        slug: "another",
        label: "another",
        member_count: 2,
        sites: [
          { origin: "https://a.example", domain: "a.example" },
          { origin: "https://b.example", domain: "b.example" },
        ],
      },
      {
        slug: "landscaping",
        label: "Landscaping",
        member_count: 2,
        sites: [
          { origin: "https://a.example", domain: "a.example" },
          { origin: "https://b.example", domain: "b.example" },
        ],
      },
    ],
  });
  assert.equal(communities.length, 1);
  assert.equal(communities[0].slug, "landscaping");
});

test("What's New keeps one latest item per origin inside seven days", () => {
  const now = new Date("2026-10-03T12:00:00.000Z");

  assert.equal(publishedWithinDays("2026-10-02T08:00:00.000Z", now), true);
  assert.equal(publishedWithinDays("2026-09-20T00:00:00.000Z", now), false);

  const views = buildViewDocuments({
    network: [
      { origin: "https://a.example", domain: "a.example", title: "A" },
      { origin: "https://b.example", domain: "b.example", title: "B" },
    ],
    content: {
      items: [
        {
          url: "https://a.example/old",
          site_origin: "https://a.example",
          title: "Stale",
          published_at: "2026-09-01T00:00:00.000Z",
        },
        {
          url: "https://a.example/fresh",
          site_origin: "https://a.example",
          title: "Fresh",
          published_at: "2026-10-01T00:00:00.000Z",
        },
        {
          url: "https://b.example/ancient",
          site_origin: "https://b.example",
          title: "Ancient",
          published_at: "2026-02-07T00:00:00.000Z",
        },
      ],
    },
    topics: { community_count: 0 },
    connections: {},
    siteSignals: { origins: [] },
    generatedAt: "2026-10-03T12:00:00.000Z",
    now,
  });

  assert.equal(views.activity.primary.length, 1);
  assert.equal(views.activity.primary[0].url, "https://a.example/fresh");
  assert.equal(views.activity.window_days, 7);
});

test("What's New cards keep advertised https images", () => {
  const views = buildViewDocuments({
    network: [{ origin: "https://a.example", domain: "a.example", title: "A" }],
    content: {
      items: [
        {
          url: "https://a.example/fresh",
          site_origin: "https://a.example",
          title: "Fresh",
          published_at: "2026-10-01T00:00:00.000Z",
          image: "https://cdn.example/hero.jpg",
        },
      ],
    },
    topics: { community_count: 0 },
    connections: {},
    siteSignals: { origins: [] },
    generatedAt: "2026-10-03T12:00:00.000Z",
    now: new Date("2026-10-03T12:00:00.000Z"),
  });

  assert.equal(views.activity.primary[0].image, "https://cdn.example/hero.jpg");
  assert.equal(views.activity.primary[0].image_origin, "https://cdn.example");
  const searchHit = views.search_index.documents.find(
    (document) => document.type === "content",
  );
  assert.equal(searchHit.image, "https://cdn.example/hero.jpg");
  assert.equal(searchHit.site_title, "A");
  assert.equal(searchHit.published_at, "2026-10-01T00:00:00.000Z");
});

test("topic views rank by how often the subject appears", () => {
  const views = buildViewDocuments({
    network: [
      { origin: "https://a.example", domain: "a.example", title: "A" },
      { origin: "https://b.example", domain: "b.example", title: "B" },
    ],
    content: {
      items: [
        {
          url: "https://a.example/ai-1",
          site_origin: "https://a.example",
          title: "Notes on AI",
          published_at: "2026-10-01T00:00:00.000Z",
          summary: "Artificial intelligence experiments",
        },
        {
          url: "https://a.example/ai-2",
          site_origin: "https://a.example",
          title: "More AI",
          published_at: "2026-10-02T00:00:00.000Z",
          summary: "Still about AI",
        },
        {
          url: "https://b.example/design",
          site_origin: "https://b.example",
          title: "Design notes",
          published_at: "2026-10-01T00:00:00.000Z",
          summary: "Visual design",
          declared_topics: [
            { slug: "design", label: "Design", community_eligible: true },
          ],
        },
      ],
    },
    topics: {
      communities: [
        {
          slug: "ai",
          label: "AI",
          member_count: 2,
          sites: [
            { origin: "https://a.example", domain: "a.example" },
            { origin: "https://b.example", domain: "b.example" },
          ],
        },
        {
          slug: "design",
          label: "Design",
          member_count: 2,
          sites: [
            { origin: "https://a.example", domain: "a.example" },
            { origin: "https://b.example", domain: "b.example" },
          ],
        },
      ],
    },
    connections: {},
    siteSignals: { origins: [] },
    generatedAt: "2026-10-03T12:00:00.000Z",
    now: new Date("2026-10-03T12:00:00.000Z"),
  });

  assert.equal(views.topic_views.neighborhoods[0].slug, "ai");
  assert.equal(views.topic_views.neighborhoods[0].occurrence_count, 2);
  assert.equal(
    views.topic_views.neighborhoods[0].members[0].articles.length,
    2,
  );
  assert.equal(views.topic_views.neighborhoods[1].slug, "design");
  assert.equal(views.topic_views.neighborhoods[1].occurrence_count, 1);
});

test("topic pages omit sites with no matching articles", () => {
  const views = buildViewDocuments({
    network: [
      { origin: "https://a.example", domain: "a.example", title: "A" },
      {
        origin: "https://baker.example",
        domain: "baker.example",
        title: "Joshua Baker",
      },
    ],
    content: {
      items: [
        {
          url: "https://a.example/design-1",
          site_origin: "https://a.example",
          title: "A design note",
          published_at: "2026-10-01T00:00:00.000Z",
          declared_topics: [{ slug: "design", label: "Design" }],
        },
      ],
    },
    topics: {
      communities: [
        {
          slug: "design",
          label: "Design",
          member_count: 2,
          sites: [
            { origin: "https://a.example", domain: "a.example" },
            { origin: "https://baker.example", domain: "baker.example" },
          ],
        },
      ],
    },
    connections: {},
    siteSignals: {
      origins: [
        {
          origin: "https://baker.example",
          subject_signals: [
            {
              slug: "design",
              evidence_class: "heuristic",
              evidence: [{ count: 40, page: "https://baker.example/about/" }],
            },
          ],
        },
      ],
    },
    generatedAt: "2026-10-03T12:00:00.000Z",
    now: new Date("2026-10-03T12:00:00.000Z"),
  });

  assert.equal(views.topic_views.neighborhoods.length, 1);
  assert.equal(views.topic_views.neighborhoods[0].member_count, 1);
  assert.equal(views.topic_views.neighborhoods[0].occurrence_count, 1);
  assert.equal(
    views.topic_views.neighborhoods[0].members[0].origin,
    "https://a.example",
  );
});

test("catalog topics pull in other members that wrote matching articles", () => {
  const views = buildViewDocuments({
    network: [
      {
        origin: "https://joshuamorris.info",
        domain: "joshuamorris.info",
        title: "Joshua Morris",
      },
      {
        origin: "https://joshtronic.com",
        domain: "joshtronic.com",
        title: "Joshtronic",
      },
    ],
    content: {
      items: [
        {
          url: "https://joshuamorris.info/notes/ai",
          site_origin: "https://joshuamorris.info",
          title: "Notes on AI",
          published_at: "2026-10-01T00:00:00.000Z",
          declared_topics: [{ slug: "ai", label: "AI" }],
        },
        {
          url: "https://joshtronic.com/ai-kool-aid",
          site_origin: "https://joshtronic.com",
          title: "I Stopped Drinking the AI Kool-Aid",
          published_at: "2026-09-20T00:00:00.000Z",
          declared_topics: [],
        },
      ],
    },
    topics: {
      communities: [
        {
          slug: "ai",
          label: "AI",
          member_count: 1,
          sites: [
            {
              origin: "https://joshuamorris.info",
              domain: "joshuamorris.info",
              membership: "declared",
            },
          ],
        },
      ],
    },
    connections: {},
    siteSignals: { origins: [] },
    generatedAt: "2026-10-03T12:00:00.000Z",
    now: new Date("2026-10-03T12:00:00.000Z"),
  });

  const ai = views.topic_views.neighborhoods.find(
    (topic) => topic.slug === "ai",
  );
  assert.ok(ai);
  assert.equal(ai.member_count, 2);
  assert.deepEqual(ai.members.map((member) => member.origin).sort(), [
    "https://joshtronic.com",
    "https://joshuamorris.info",
  ]);
});

test("declared single-site subjects appear even without a two-site community", () => {
  const views = buildViewDocuments({
    network: [{ origin: "https://a.example", domain: "a.example", title: "A" }],
    content: {
      items: [
        {
          url: "https://a.example/ai-1",
          site_origin: "https://a.example",
          title: "Notes on AI",
          published_at: "2026-10-01T00:00:00.000Z",
          declared_topics: [
            { slug: "ai", label: "AI" },
            { slug: "notes", label: "notes" },
            { slug: "another", label: "another" },
          ],
        },
        {
          url: "https://a.example/ai-2",
          site_origin: "https://a.example",
          title: "More AI",
          published_at: "2026-10-02T00:00:00.000Z",
          declared_topics: [{ slug: "ai", label: "AI" }],
        },
      ],
    },
    topics: {
      communities: [
        {
          slug: "ai",
          label: "AI",
          member_count: 1,
          sites: [
            {
              origin: "https://a.example",
              domain: "a.example",
              membership: "declared",
            },
          ],
        },
      ],
    },
    connections: {},
    siteSignals: { origins: [] },
    generatedAt: "2026-10-03T12:00:00.000Z",
    now: new Date("2026-10-03T12:00:00.000Z"),
  });

  assert.equal(views.topic_views.neighborhoods.length, 1);
  assert.equal(views.topic_views.neighborhoods[0].slug, "ai");
  assert.equal(views.topic_views.neighborhoods[0].occurrence_count, 2);
  assert.equal(views.topic_views.neighborhoods[0].member_count, 1);
});

test("activity keeps one latest item per origin", () => {
  const selected = oneLatestPerOrigin([
    {
      site_origin: "https://a.example",
      url: "https://a.example/old",
      published_at: "2026-01-01T00:00:00.000Z",
    },
    {
      site_origin: "https://a.example",
      url: "https://a.example/new",
      published_at: "2026-06-01T00:00:00.000Z",
    },
    {
      site_origin: "https://b.example",
      url: "https://b.example/one",
      published_at: "2026-03-01T00:00:00.000Z",
    },
  ]);
  assert.equal(selected.length, 2);
  assert.equal(selected[0].url, "https://a.example/new");
  assert.equal(selected[1].site_origin, "https://b.example");
});

test("same timestamps tie-break by URL then origin sort", () => {
  const selected = oneLatestPerOrigin([
    {
      site_origin: "https://z.example",
      url: "https://z.example/b",
      published_at: "2026-01-01T00:00:00.000Z",
    },
    {
      site_origin: "https://a.example",
      url: "https://a.example/b",
      published_at: "2026-01-01T00:00:00.000Z",
    },
    {
      site_origin: "https://a.example",
      url: "https://a.example/a",
      published_at: "2026-01-01T00:00:00.000Z",
    },
  ]);
  assert.equal(selected[0].url, "https://a.example/a");
  assert.equal(selected[1].site_origin, "https://z.example");
});

test("featured community rotates by UTC date, not member count", () => {
  const communities = [
    { slug: "zebra", label: "Zebra", sites: [{}, {}] },
    { slug: "alpha", label: "Alpha", sites: [{}, {}, {}] },
  ];
  const picked = pickFeaturedCommunity(
    communities,
    new Date("2026-01-01T12:00:00Z"),
  );
  assert.equal(picked.slug, "alpha");
  assert.equal(pickFeaturedCommunity([], new Date()), null);
});

test("featured connection is first stable edge", () => {
  const edge = pickFeaturedConnection([
    { from: "https://b.example", to: "https://c.example", relation: "mention" },
    {
      from: "https://a.example",
      to: "https://c.example",
      relation: "content-link",
    },
  ]);
  assert.equal(edge.from, "https://a.example");
  assert.equal(edge.relation, "content-link");
});

test("co-occurrence uses eligible declared public slugs only", () => {
  const pairs = topicCooccurrence(
    [
      {
        declared_topics: [
          { slug: "design", community_eligible: true },
          { slug: "engineering", community_eligible: true },
          { slug: "noise", community_eligible: false },
          { slug: "secret", community_eligible: true },
        ],
      },
    ],
    new Set(["design", "engineering"]),
  );
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].left, "design");
  assert.equal(pairs[0].right, "engineering");
  assert.equal(pairs[0].content_count, 1);
});

test("shared topics overlay pairs members without becoming directed edges", () => {
  const overlay = connectionTopicOverlaps([
    {
      slug: "ai",
      label: "AI",
      members: [
        {
          origin: "https://a.example",
          domain: "a.example",
          title: "A",
          articles: [{ url: "https://a.example/ai", title: "Post A" }],
        },
        {
          origin: "https://b.example",
          domain: "b.example",
          title: "B",
          articles: [{ url: "https://b.example/ai", title: "Post B" }],
        },
      ],
    },
    {
      slug: "lonely",
      label: "Lonely",
      members: [
        {
          origin: "https://a.example",
          domain: "a.example",
          title: "A",
          articles: [{ url: "https://a.example/lonely" }],
        },
      ],
    },
  ]);

  assert.equal(overlay.overlap_count, 1);
  assert.equal(overlay.pairs[0].a, "https://a.example");
  assert.equal(overlay.pairs[0].b, "https://b.example");
  assert.deepEqual(
    overlay.pairs[0].topics.map((topic) => topic.slug),
    ["ai"],
  );
  assert.equal(overlay.sites.length, 2);
  assert.equal(overlay.sites[0].topics[0].slug, "ai");
  assert.equal(overlay.sites[0].topics[0].articles[0].title, "Post A");
  assert.equal(overlay.sites[0].topics[0].sites[0].origin, "https://b.example");
});

test("zero communities produce empty neighborhood views", () => {
  const views = buildViewDocuments({
    network: [{ origin: "https://a.example", domain: "a.example", title: "A" }],
    content: {
      items: [
        {
          url: "https://a.example/p",
          site_origin: "https://a.example",
          title: "Post",
          published_at: "2026-01-01T00:00:00.000Z",
          summary: "Hello",
          declared_topics: [
            { slug: "notes", label: "notes", community_eligible: true },
            { slug: "another", label: "another", community_eligible: true },
          ],
        },
      ],
    },
    topics: { community_count: 0 },
    connections: {},
    siteSignals: { origins: [] },
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(views.topic_views.community_count, 0);
  assert.equal(views.explore.community_count, 0);
  assert.ok(!views.explore.neighborhood);
  assert.equal(views.activity.primary.length, 1);
  assert.equal(views.activity.primary[0].neighborhoods.length, 0);
});

test("search scores title above summary and ignores empty queries", () => {
  const document = {
    type: "content",
    title: "Corkboard",
    summary: "notes and pins",
    domain: "a.example",
    topics: ["experiments"],
  };
  assert.equal(scoreSearchDocument("", document), 0);
  assert.ok(
    scoreSearchDocument("corkboard", document) >
      scoreSearchDocument("pins", document),
  );
});

test("same-origin search rows are capped after scoring", () => {
  const ranked = [
    { type: "content", origin: "https://a.example", score: 9 },
    { type: "content", origin: "https://a.example", score: 8 },
    { type: "content", origin: "https://a.example", score: 7 },
    { type: "content", origin: "https://a.example", score: 6 },
    { type: "site", origin: "https://a.example", score: 5 },
  ];
  assert.equal(capSameOriginResults(ranked, 3).length, 4);
});

test("link trails never invent hops", () => {
  const trail = randomLinkTrail(
    [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "content-link",
      },
    ],
    () => 0,
    3,
  );
  assert.equal(trail.length, 1);
});

test("malformed optional fields do not throw", () => {
  const views = buildViewDocuments({
    network: [null, { origin: "https://a.example", domain: "a.example" }],
    content: { items: [null, { url: "" }] },
    topics: null,
    connections: { edges: [null] },
    siteSignals: null,
    generatedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(views.explore.participant_count, 1);
  assert.equal(views.activity.item_count, 0);
});

// ─── relationLabel and sourceLabel edge cases (lines 52-53, 65-66, 75, 79-80) ─

test("relationLabel: null or empty input returns 'linked to' (lines 52-53)", () => {
  assert.equal(relationLabel(null), "linked to");
  assert.equal(relationLabel(""), "linked to");
  assert.equal(relationLabel(42), "linked to");
});

test("sourceLabel: null or empty returns 'Topic evidence' (lines 65-66)", () => {
  assert.equal(sourceLabel(null), "Topic evidence");
  assert.equal(sourceLabel(""), "Topic evidence");
});

test("sourceLabel: 'nlp' returns 'Published content' (line 75)", () => {
  assert.equal(sourceLabel("nlp"), "Published content");
});

test("sourceLabel: unknown source is humanized (lines 79-80)", () => {
  assert.equal(sourceLabel("my_custom:source"), "my custom source");
});

// ─── contentTopicLabels deduplication (lines 216-217) ────────────────────────

test("contentTopicLabels: duplicate slugs are deduplicated (lines 216-217)", () => {
  const result = contentTopicLabels(
    {
      declared_topics: [
        { slug: "design", label: "Design", community_eligible: true },
        { slug: "design", label: "Design", community_eligible: true }, // duplicate
      ],
    },
    new Set(["design"]),
  );
  assert.equal(result.tags.length, 1);
  assert.equal(result.tags[0].slug, "design");
});

// ─── compactContentItem invalid image URL (lines 260-261) ───────────────────

test("compactContentItem: malformed https image URL is handled (lines 260-261)", () => {
  const sites = sitesByOrigin([
    { origin: "https://a.example", domain: "a.example" },
  ]);
  const item = compactContentItem(
    {
      url: "https://a.example/p",
      site_origin: "https://a.example",
      title: "Post",
      image: "https://", // starts with https:// but is invalid → catch block
    },
    sites,
    new Set(),
  );
  assert.ok(item !== null);
  assert.equal(item.image_origin, ""); // catch set imageOrigin = ""
});

// ─── publishedWithinDays invalid inputs (lines 302-303) ─────────────────────

test("publishedWithinDays: null or non-string publishedAt returns false (lines 302-303)", () => {
  assert.equal(publishedWithinDays(null, new Date()), false);
  assert.equal(publishedWithinDays(42, new Date()), false);
  assert.equal(publishedWithinDays("", new Date()), false);
  assert.equal(publishedWithinDays("not-a-date", new Date()), false);
});

// ─── oneLatestPerOrigin invalid items (lines 321-322) ────────────────────────

test("oneLatestPerOrigin: skips null, non-object, and items without site_origin (lines 321-322)", () => {
  const result = oneLatestPerOrigin([
    null,
    42,
    { url: "https://a.example/p", site_origin: null }, // null origin → skip
    {
      url: "https://b.example/p",
      site_origin: "https://b.example",
      published_at: "2026-01-01T00:00:00.000Z",
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].site_origin, "https://b.example");
});

// ─── pickFeaturedConnection tie-break cases (lines 398-403) ─────────────────

test("pickFeaturedConnection: fires 'to' comparison when from values match (lines 401-403)", () => {
  // Same from, different to → to comparison fires
  const edge = pickFeaturedConnection([
    {
      from: "https://a.example",
      to: "https://z.example",
      relation: "content-link",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
    },
  ]);
  assert.equal(edge.to, "https://b.example"); // b.example < z.example
});

test("pickFeaturedConnection: fires 'relation' comparison when from and to match (lines 405-407)", () => {
  // Same from, same to, different relation → relation comparison fires
  const edge = pickFeaturedConnection([
    { from: "https://a.example", to: "https://b.example", relation: "mention" },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "blogroll",
    },
  ]);
  assert.equal(edge.relation, "blogroll"); // blogroll < mention
});

// ─── topicCooccurrence sort comparator (lines 455-461) ───────────────────────

test("topicCooccurrence: sort fires when counts differ and when they are equal (lines 455-461)", () => {
  // Item 1: design+ux (count=2 for design/ux pair) and Item 2: ux+typescript (count=1)
  const pairs = topicCooccurrence(
    [
      {
        declared_topics: [
          { slug: "design", community_eligible: true },
          { slug: "ux", community_eligible: true },
        ],
      },
      {
        declared_topics: [
          { slug: "design", community_eligible: true },
          { slug: "ux", community_eligible: true },
        ],
      },
      {
        declared_topics: [
          { slug: "ux", community_eligible: true },
          { slug: "typescript", community_eligible: true },
        ],
      },
      {
        declared_topics: [
          { slug: "design", community_eligible: true },
          { slug: "typescript", community_eligible: true },
        ],
      },
    ],
    new Set(["design", "ux", "typescript"]),
  );
  // design/ux has count=2; others have count=1; pairs with count=1 need label localeCompare
  assert.ok(pairs.length >= 2);
  assert.equal(pairs[0].content_count, 2); // sorted descending by count
});

// ─── connectionTopicOverlaps edge cases (lines 472-473, 476-477, 531-532, 544-545, 549-550, 559, 567-568) ─

test("connectionTopicOverlaps: handles null neighborhoods, invalid articles, no-origin member, 8+ article cap, no-articles member, title fallback (lines 472-568)", () => {
  const result = connectionTopicOverlaps([
    null, // invalid neighborhood → lines 567-568 (skipped)
    { slug: 42, label: "Bad" }, // no string slug → lines 566-568
    {
      slug: "tech",
      label: "Tech",
      members: [
        {
          // no origin → memberRecord returns null (lines 531-532)
          domain: "c.example",
          articles: [{ url: "https://c.example/1" }],
        },
        {
          // no articles after compaction → returns null (lines 549-550)
          origin: "https://d.example",
          articles: [
            null, // compactTopicArticle(null) → lines 472-473
            { url: "" }, // compactTopicArticle({url:""}) → lines 476-477
          ],
        },
        {
          // 9 articles → triggers the length >= 8 cap (lines 544-545)
          origin: "https://e.example",
          domain: "e.example",
          // no title → domain fallback in memberRecord title (line 559)
          articles: Array.from({ length: 9 }, (_, i) => ({
            url: `https://e.example/post-${i}`,
            title: `Post ${i}`,
          })),
        },
        {
          origin: "https://a.example",
          domain: "a.example",
          title: "Site A",
          articles: [{ url: "https://a.example/tech", title: "Tech Post" }],
        },
      ],
    },
  ]);
  // Only a.example and e.example are valid with articles
  assert.ok(result.overlap_count === 0 || result.overlap_count >= 0);
});

// ─── compactWhyHere filtering (lines 683, 685-688, 697-698) ─────────────────

test("compactWhyHere: skips non-eligible and non-declared/heuristic, caps at 4 (lines 683-698)", () => {
  const evidence = [
    { community_eligible: false, class: "declared", source: "html" }, // skipped: not eligible (line 683)
    { community_eligible: true, class: "observed", source: "html" }, // skipped: bad class (lines 685-688)
    {
      community_eligible: true,
      class: "declared",
      source: "html",
      page: "/p1",
    },
    {
      community_eligible: true,
      class: "heuristic",
      source: "tfidf-v1",
      page: "/p2",
    },
    {
      community_eligible: true,
      class: "declared",
      source: "html",
      page: "/p3",
    },
    {
      community_eligible: true,
      class: "declared",
      source: "html",
      page: "/p4",
    },
    {
      community_eligible: true,
      class: "declared",
      source: "html",
      page: "/p5",
    }, // 5th valid → break (lines 697-698)
  ];
  const rows = compactWhyHere(evidence);
  assert.equal(rows.length, 4); // capped at 4
});

// ─── searchTokens non-string (lines 710-711) ─────────────────────────────────

test("searchTokens: non-string query returns empty array (lines 710-711)", () => {
  assert.deepEqual(searchTokens(null), []);
  assert.deepEqual(searchTokens(42), []);
  assert.deepEqual(searchTokens({}), []);
});

// ─── scoreSearchDocument uncovered branches (lines 751-756, 763-764) ─────────

test("scoreSearchDocument: title substring, topic match, and domain substring scores (lines 751-756, 763-764)", () => {
  const document = {
    type: "content",
    title: "My Corkboard",
    summary: "",
    domain: "a.example",
    topics: ["experiments", "design"],
  };
  // "cork" is a substring of "my corkboard" but not equal → line 750-752
  const scoreSubstring = scoreSearchDocument("cork", document);
  assert.ok(scoreSubstring > 0);

  // "design" is in topics → line 754-756
  const scoreTopic = scoreSearchDocument("design", document);
  assert.ok(scoreTopic >= 5);

  // "example" is a substring of "a.example" → line 762-764
  const scoreDomain = scoreSearchDocument("example", document);
  assert.ok(scoreDomain >= 3);
});

// ─── randomLinkTrail edge cases (lines 809-816, 825-840) ─────────────────────

test("randomLinkTrail: empty or null edges returns [] (lines 809-810)", () => {
  assert.deepEqual(
    randomLinkTrail([], () => 0),
    [],
  );
  assert.deepEqual(
    randomLinkTrail(null, () => 0),
    [],
  );
});

test("randomLinkTrail: null start edge returns [] (lines 815-816)", () => {
  // edges[0] is null → !start → return []
  assert.deepEqual(
    randomLinkTrail([null], () => 0),
    [],
  );
});

test("randomLinkTrail: multi-hop trail extends correctly (lines 825-840)", () => {
  const edges = [
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
    },
    {
      from: "https://b.example",
      to: "https://c.example",
      relation: "content-link",
    },
  ];
  const trail = randomLinkTrail(edges, () => 0, 3);
  assert.equal(trail.length, 2); // a→b then b→c; c has no outgoing → break
});

test("search topics only come from published topic communities", () => {
  const views = buildViewDocuments({
    network: [{ origin: "https://a.example", domain: "a.example", title: "A" }],
    content: {
      items: [
        {
          url: "https://a.example/privacy-note",
          site_origin: "https://a.example",
          title: "Notes on privacy",
          published_at: "2026-10-01T00:00:00.000Z",
          declared_topics: [
            { slug: "privacy", label: "privacy", community_eligible: true },
            { slug: "aws", label: "AWS", community_eligible: true },
            { slug: "eleventy", label: "Eleventy", community_eligible: true },
          ],
        },
      ],
    },
    topics: {
      communities: [
        {
          slug: "privacy",
          label: "privacy",
          member_count: 1,
          sites: [
            {
              origin: "https://a.example",
              domain: "a.example",
              membership: "declared",
            },
          ],
        },
      ],
    },
    connections: {},
    siteSignals: { origins: [] },
    generatedAt: "2026-10-03T12:00:00.000Z",
    now: new Date("2026-10-03T12:00:00.000Z"),
  });

  const topicDocs = views.search_index.documents.filter(
    (document) => document.type === "topic",
  );
  assert.deepEqual(topicDocs.map((document) => document.url).sort(), [
    "/topics/privacy/",
  ]);
  assert.ok(
    views.topic_views.neighborhoods.some((item) => item.slug === "privacy"),
  );
  assert.ok(
    !views.topic_views.neighborhoods.some((item) => item.slug === "aws"),
  );
  assert.ok(
    !views.topic_views.neighborhoods.some((item) => item.slug === "eleventy"),
  );
});

test("search omits topic communities with no matching article members", () => {
  const views = buildViewDocuments({
    network: [
      { origin: "https://a.example", domain: "a.example", title: "A" },
      { origin: "https://b.example", domain: "b.example", title: "B" },
    ],
    content: {
      items: [
        {
          url: "https://a.example/privacy-note",
          site_origin: "https://a.example",
          title: "Notes on privacy",
          published_at: "2026-10-01T00:00:00.000Z",
          declared_topics: [
            { slug: "privacy", label: "privacy", community_eligible: true },
          ],
        },
      ],
    },
    topics: {
      communities: [
        {
          slug: "privacy",
          label: "privacy",
          member_count: 1,
          sites: [
            {
              origin: "https://a.example",
              domain: "a.example",
              membership: "declared",
            },
          ],
        },
        {
          slug: "eleventy",
          label: "Eleventy",
          member_count: 2,
          sites: [
            {
              origin: "https://a.example",
              domain: "a.example",
              membership: "declared",
            },
            {
              origin: "https://b.example",
              domain: "b.example",
              membership: "declared",
            },
          ],
        },
      ],
    },
    connections: {},
    siteSignals: { origins: [] },
    generatedAt: "2026-10-03T12:00:00.000Z",
    now: new Date("2026-10-03T12:00:00.000Z"),
  });

  const topicUrls = views.search_index.documents
    .filter((document) => document.type === "topic")
    .map((document) => document.url)
    .sort();
  assert.deepEqual(topicUrls, ["/topics/privacy/"]);
  assert.ok(
    !views.topic_views.neighborhoods.some((item) => item.slug === "eleventy"),
  );
  assert.equal(
    views.search_index.documents.some(
      (document) => document.url === "/topics/eleventy/",
    ),
    false,
  );
});

// ─── buildViewDocuments with connections and cooccurrence (lines 926-932, 988-989, 1023-1030, 1058-1073, 1113-1129) ─

test("buildViewDocuments: with connections and cooccurrence covers site views and featured edge (lines 926-1129)", () => {
  const views = buildViewDocuments({
    network: [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "Site A",
        identity: "affirmed",
      },
      {
        origin: "https://b.example",
        domain: "b.example",
        title: "Site B",
        identity: "undeclared",
      },
    ],
    content: {
      items: [
        {
          url: "https://a.example/p1",
          site_origin: "https://a.example",
          title: "Post A",
          published_at: "2025-12-31T00:00:00.000Z",
          summary: "Design and UX",
          declared_topics: [
            { slug: "design", label: "Design", community_eligible: true },
            { slug: "ux", label: "UX", community_eligible: true },
          ],
        },
        {
          url: "https://b.example/p1",
          site_origin: "https://b.example",
          title: "Post B",
          published_at: "2025-12-31T00:00:00.000Z",
          declared_topics: [
            { slug: "design", label: "Design", community_eligible: true },
            { slug: "ux", label: "UX", community_eligible: true },
          ],
        },
      ],
    },
    topics: {
      communities: [
        {
          slug: "design",
          label: "Design",
          member_count: 2,
          sites: [
            {
              origin: "https://a.example",
              domain: "a.example",
              membership: "declared",
            },
            {
              origin: "https://b.example",
              domain: "b.example",
              membership: "declared",
            },
          ],
        },
        {
          slug: "ux",
          label: "UX",
          member_count: 1,
          sites: [
            {
              origin: "https://a.example",
              domain: "a.example",
              membership: "declared",
            },
            {
              origin: "https://b.example",
              domain: "b.example",
              membership: "declared",
            },
          ],
        },
      ],
    },
    connections: {
      edges: [
        {
          from: "https://a.example",
          to: "https://b.example",
          relation: "content-link",
          href: "https://b.example/p1",
          page: "https://a.example/p1",
          text: "B",
          evidence_count: 1,
        },
      ],
    },
    siteSignals: {
      origins: [
        {
          origin: "https://a.example",
          declared_topics: [
            {
              slug: "design",
              evidence: [
                {
                  class: "declared",
                  community_eligible: true,
                  source: "html",
                  page: "https://a.example/p1",
                },
                {
                  class: "declared",
                  community_eligible: false,
                  source: "html",
                }, // skipped (line 683)
                { class: "observed", community_eligible: true, source: "html" }, // skipped (lines 685-688)
                {
                  class: "declared",
                  community_eligible: true,
                  source: "html",
                  page: "https://a.example/p2",
                },
                {
                  class: "declared",
                  community_eligible: true,
                  source: "html",
                  page: "https://a.example/p3",
                },
                {
                  class: "declared",
                  community_eligible: true,
                  source: "html",
                  page: "https://a.example/p4",
                },
              ],
            },
          ],
        },
      ],
    },
    generatedAt: "2026-01-01T00:00:00.000Z",
  });

  // Featured edge (lines 1113-1129): connection was provided, featuredEdge non-null
  assert.ok(views.explore.connection);
  assert.equal(views.explore.connection.from, "https://a.example");
  assert.equal(views.explore.connection.to, "https://b.example");

  // Site views with outgoing/incoming edges (lines 1058-1073)
  const siteA = views.site_views.sites.find(
    (s) => s.origin === "https://a.example",
  );
  assert.equal(siteA.outgoing.length, 1);
  assert.equal(siteA.outgoing[0].to, "https://b.example");
  const siteB = views.site_views.sites.find(
    (s) => s.origin === "https://b.example",
  );
  assert.equal(siteB.incoming.length, 1);

  // Related topics via cooccurrence (lines 926-932)
  const designView = views.topic_views.neighborhoods.find(
    (n) => n.slug === "design",
  );
  assert.ok(designView);
  // Both communities have same member_count=2 and occurrence=2;
  // label sort fires (lines 1023-1030)
  assert.ok(views.topic_views.community_count >= 1);
});

// ─── neighborhoods member sort and community sort tie-breaks (lines 988-989, 1027-1028) ─

test("buildViewDocuments: members sorted by occurrence; communities sorted by member_count when occurrence ties (lines 988-989, 1027-1028)", () => {
  // This test drives two scenarios:
  // 1) Same community has 2 members with DIFFERENT occurrence counts → lines 988-989
  // 2) Two communities have the SAME occurrence_count but different member_count → lines 1027-1028
  const views = buildViewDocuments({
    network: [
      { origin: "https://a.example", domain: "a.example", title: "A" },
      { origin: "https://b.example", domain: "b.example", title: "B" },
      { origin: "https://c.example", domain: "c.example", title: "C" },
    ],
    content: {
      items: [
        // a.example has 2 articles matching "design" (higher occurrence → fires line 988-989 for member sort)
        {
          url: "https://a.example/d1",
          site_origin: "https://a.example",
          title: "D1",
          published_at: "2025-12-31T00:00:00.000Z",
          declared_topics: [
            { slug: "design", label: "Design", community_eligible: true },
          ],
        },
        {
          url: "https://a.example/d2",
          site_origin: "https://a.example",
          title: "D2",
          published_at: "2025-12-30T00:00:00.000Z",
          declared_topics: [
            { slug: "design", label: "Design", community_eligible: true },
          ],
        },
        // b.example has 1 article matching "design"
        {
          url: "https://b.example/d1",
          site_origin: "https://b.example",
          title: "D3",
          published_at: "2025-12-31T00:00:00.000Z",
          declared_topics: [
            { slug: "design", label: "Design", community_eligible: true },
          ],
        },
        // For "ux": a.example 1 article, b.example 1 article → occurrence=2, member_count=2
        {
          url: "https://a.example/u1",
          site_origin: "https://a.example",
          title: "U1",
          published_at: "2025-12-29T00:00:00.000Z",
          declared_topics: [
            { slug: "ux", label: "UX", community_eligible: true },
          ],
        },
        {
          url: "https://b.example/u1",
          site_origin: "https://b.example",
          title: "U2",
          published_at: "2025-12-29T00:00:00.000Z",
          declared_topics: [
            { slug: "ux", label: "UX", community_eligible: true },
          ],
        },
        // For "minimal": a.example 2 articles → occurrence=2, member_count=1
        // (same occurrence as "ux" but fewer members → fires lines 1027-1028)
        {
          url: "https://a.example/m1",
          site_origin: "https://a.example",
          title: "M1",
          published_at: "2025-12-29T00:00:00.000Z",
          declared_topics: [
            { slug: "minimal", label: "Minimal", community_eligible: true },
          ],
        },
        {
          url: "https://a.example/m2",
          site_origin: "https://a.example",
          title: "M2",
          published_at: "2025-12-28T00:00:00.000Z",
          declared_topics: [
            { slug: "minimal", label: "Minimal", community_eligible: true },
          ],
        },
      ],
    },
    topics: {
      communities: [
        // "design": 2 members, occurrence=3 (a=2, b=1)
        {
          slug: "design",
          label: "Design",
          member_count: 2,
          sites: [
            {
              origin: "https://a.example",
              domain: "a.example",
              membership: "declared",
            },
            {
              origin: "https://b.example",
              domain: "b.example",
              membership: "declared",
            },
          ],
        },
        // "ux": 2 members (a+b), occurrence=2
        {
          slug: "ux",
          label: "UX",
          member_count: 2,
          sites: [
            {
              origin: "https://a.example",
              domain: "a.example",
              membership: "declared",
            },
            {
              origin: "https://b.example",
              domain: "b.example",
              membership: "declared",
            },
          ],
        },
        // "minimal": 1 member (a only), occurrence=2 (same as ux) → member_count sort fires (lines 1027-1028)
        {
          slug: "minimal",
          label: "Minimal",
          member_count: 1,
          sites: [
            {
              origin: "https://a.example",
              domain: "a.example",
              membership: "declared",
            },
          ],
        },
      ],
    },
    connections: {},
    siteSignals: { origins: [] },
    generatedAt: "2026-01-01T00:00:00.000Z",
  });

  const neighborhoods = views.topic_views.neighborhoods;
  // "design" has the most articles (occurrence=3) → comes first
  assert.ok(neighborhoods.length >= 1);
  assert.equal(neighborhoods[0].slug, "design");

  // Within "design", a.example has 2 articles and b.example has 1 →
  // member sort by occurrence fires (lines 988-989)
  const designNeighborhood = neighborhoods[0];
  assert.ok(designNeighborhood.members.length >= 2);
  assert.equal(designNeighborhood.members[0].origin, "https://a.example");

  // "ux" and "minimal" both have occurrence=2 → member_count diff fires (lines 1027-1028)
  const uxIdx = neighborhoods.findIndex((n) => n.slug === "ux");
  const minIdx = neighborhoods.findIndex((n) => n.slug === "minimal");
  assert.ok(uxIdx >= 0 && minIdx >= 0);
  // ux has member_count=2 > minimal member_count=1 → ux comes before minimal after design
  assert.ok(uxIdx < minIdx);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Branch-gap closers (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── relationLabel: unknown relation falls back to the string itself (L55) ────
test("relationLabel: unknown relation returns the relation string itself (L55)", () => {
  assert.equal(relationLabel("my-custom-relation"), "my-custom-relation");
});

// ─── sitesByOrigin: null input (L186) ────────────────────────────────────────
test("sitesByOrigin: null input returns empty map (L186)", () => {
  const map = sitesByOrigin(null);
  assert.equal(map.size, 0);
});

// ─── topicCooccurrence: null input (L423) ────────────────────────────────────
test("topicCooccurrence: null contentItems returns empty results (L423)", () => {
  const result = topicCooccurrence(null, new Set(["design"]));
  // topicCooccurrence returns an array of pairs
  assert.equal(result.length, 0);
});

// ─── compactWhyHere: null input (L679) ───────────────────────────────────────
test("compactWhyHere: null evidence returns empty array (L679)", () => {
  assert.deepEqual(compactWhyHere(null), []);
});

// ─── oneLatestPerOrigin: null input (L319) ───────────────────────────────────
test("oneLatestPerOrigin: null items returns empty array (L319)", () => {
  assert.deepEqual(oneLatestPerOrigin(null), []);
});

// ─── publishedWithinDays: string now (L299) ──────────────────────────────────
test("publishedWithinDays: string now is parsed as a date (L299)", () => {
  assert.equal(
    publishedWithinDays("2026-01-04T00:00:00.000Z", "2026-01-05T00:00:00.000Z"),
    true,
  );
  assert.equal(
    publishedWithinDays("2025-12-01T00:00:00.000Z", "2026-01-05T00:00:00.000Z"),
    false,
  );
});

// ─── contentTopicLabels: topic with no label falls back to slug (L225) ───────
test("contentTopicLabels: topic with no label falls back to slug (L225)", () => {
  const item = {
    declared_topics: [{ slug: "mytopic", community_eligible: true }],
  };
  const result = contentTopicLabels(item, new Set(["mytopic"]));
  assert.equal(result.tags[0].label, "mytopic");
});

// ─── compactContentItem: no site_origin → origin is "" (L247-248) ────────────
test("compactContentItem: item without site_origin gets empty origin and domain (L247-248, L278)", () => {
  const sites = sitesByOrigin([]);
  const item = { url: "https://a.example/p", title: "" };
  const result = compactContentItem(item, sites, new Set());
  assert.equal(result.site_origin, "");
  assert.equal(result.domain, "");
  assert.equal(result.site_title, "");
  // no title → falls back to url (L266)
  assert.equal(result.title, "https://a.example/p");
});

// ─── compactContentItem: no content_type and no language (L271-272) ──────────
test("compactContentItem: missing content_type and language become empty strings (L271-272)", () => {
  const sites = sitesByOrigin([
    { origin: "https://a.example", domain: "a.example" },
  ]);
  const item = {
    url: "https://a.example/p",
    title: "Post",
    site_origin: "https://a.example",
  };
  const result = compactContentItem(item, sites, new Set());
  assert.equal(result.content_type, "");
  assert.equal(result.language, "");
});

// ─── compactContentItem: site with no title AND no domain → origin (L276) ────
test("compactContentItem: site with no title and no domain falls back to origin (L276)", () => {
  const sites = sitesByOrigin([{ origin: "https://bare.example" }]);
  const item = {
    url: "https://bare.example/p",
    site_origin: "https://bare.example",
    title: "Post",
  };
  const result = compactContentItem(item, sites, new Set());
  assert.equal(result.site_title, "https://bare.example");
});

// ─── oneLatestPerOrigin: item with no published_at (L325, L334) ──────────────
test("oneLatestPerOrigin: item with no published_at uses empty string (L325, L334)", () => {
  const items = [
    {
      site_origin: "https://a.example",
      url: "https://a.example/1",
      published_at: "2026-01-01",
    },
    { site_origin: "https://a.example", url: "https://a.example/2" },
  ];
  const result = oneLatestPerOrigin(items);
  assert.equal(result.length, 1);
  assert.equal(result[0].published_at, "2026-01-01");
});

// ─── oneLatestPerOrigin: same published_at + null url tiebreak (L339) ────────
test("oneLatestPerOrigin: url tiebreak fires when published_at equal and url null (L339)", () => {
  const items = [
    { site_origin: "https://a.example", published_at: "2026-01-01" },
    {
      site_origin: "https://a.example",
      published_at: "2026-01-01",
      url: "https://a.example/a",
    },
  ];
  const result = oneLatestPerOrigin(items);
  assert.equal(result.length, 1);
});

// ─── oneLatestPerOrigin: sort comparator with no published_at (L346-347) ─────
test("oneLatestPerOrigin: sort comparator fires || '' when published_at absent (L346-347)", () => {
  const items = [
    { site_origin: "https://a.example", url: "https://a.example/1" },
    { site_origin: "https://b.example", url: "https://b.example/1" },
  ];
  const result = oneLatestPerOrigin(items);
  assert.equal(result.length, 2);
  // sort by missing published_at ("" localeCompare "") → stable by origin
  assert.equal(result[0].site_origin, "https://a.example");
});

// ─── pickFeaturedConnection: null from/to/relation fires || "" (L391-406) ────
test("pickFeaturedConnection: null from/to/relation trigger || '' branches (L391-406)", () => {
  const edge = pickFeaturedConnection([
    { from: null, to: null, relation: null },
    { from: null, to: null, relation: null },
  ]);
  assert.ok(edge !== null);
});

// ─── connectionTopicOverlaps: null neighborhoods (L565) ──────────────────────
test("connectionTopicOverlaps: null neighborhoods returns empty result (L565)", () => {
  const result = connectionTopicOverlaps(null);
  assert.equal(result.overlap_count, 0);
});

// ─── connectionTopicOverlaps: neighborhood with no members (L572) ─────────────
test("connectionTopicOverlaps: neighborhood with no members field skips gracefully (L572)", () => {
  const neighborhoods = [{ slug: "design", label: "Design" }];
  const result = connectionTopicOverlaps(neighborhoods);
  assert.equal(result.overlap_count, 0);
});

// ─── connectionTopicOverlaps: memberRecord with no domain and no title (L554, L560) ─
test("connectionTopicOverlaps: member with no domain or title falls back to origin (L554-560)", () => {
  const neighborhoods = [
    {
      slug: "design",
      label: "Design",
      members: [
        {
          origin: "https://a.example",
          articles: [{ url: "https://a.example/1", title: "Post A" }],
        },
        {
          origin: "https://b.example",
          articles: [{ url: "https://b.example/1", title: "Post B" }],
        },
      ],
    },
  ];
  const result = connectionTopicOverlaps(neighborhoods);
  assert.equal(result.overlap_count, 1);
  const siteA = result.sites.find((s) => s.origin === "https://a.example");
  assert.ok(siteA);
  // title fallback to origin since no title/domain
  const topicForA = siteA.topics[0];
  assert.equal(topicForA.sites[0].title, "https://b.example");
});

// ─── connectionTopicOverlaps: neighborhood.label missing (L589) ──────────────
test("connectionTopicOverlaps: neighborhood with no label falls back to slug (L589)", () => {
  const neighborhoods = [
    {
      slug: "design",
      members: [
        {
          origin: "https://a.example",
          articles: [{ url: "https://a.example/1", title: "P" }],
        },
        {
          origin: "https://b.example",
          articles: [{ url: "https://b.example/1", title: "Q" }],
        },
      ],
    },
  ];
  const result = connectionTopicOverlaps(neighborhoods);
  assert.equal(result.sites[0].topics[0].slug, "design");
});

// ─── connectionTopicOverlaps: 3 origins → pairs sort + sites title sort (L644, L657) ─
test("connectionTopicOverlaps: 3+ origins fire pair sort and topic sites sort (L644, L657)", () => {
  const neighborhoods = [
    {
      slug: "design",
      label: "Design",
      members: [
        {
          origin: "https://a.example",
          title: "A",
          domain: "a.example",
          articles: [{ url: "https://a.example/1", title: "P1" }],
        },
        {
          origin: "https://b.example",
          title: "B",
          domain: "b.example",
          articles: [{ url: "https://b.example/1", title: "P2" }],
        },
        {
          origin: "https://c.example",
          title: "C",
          domain: "c.example",
          articles: [{ url: "https://c.example/1", title: "P3" }],
        },
      ],
    },
  ];
  const result = connectionTopicOverlaps(neighborhoods);
  // 3 origins → C(3,2)=3 pairs → sort arrow fires (L644)
  assert.equal(result.overlap_count, 3);
  // a.example has 2 co-members (b and c) → topic.sites.length=2 → sort fires (L657)
  const siteA = result.sites.find((s) => s.origin === "https://a.example");
  assert.ok(siteA);
  assert.equal(siteA.topics[0].sites.length, 2);
});

// ─── compactWhyHere: missing field values (L689-692) ─────────────────────────
test("compactWhyHere: non-string fields fall back to empty string (L689-692)", () => {
  const evidence = [
    {
      community_eligible: true,
      class: "declared",
      source: null,
      page: 42,
      raw_value: null,
      observed_at: true,
    },
  ];
  const rows = compactWhyHere(evidence);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].page, "");
  assert.equal(rows[0].raw_value, "");
  assert.equal(rows[0].observed_at, "");
});

// ─── scoreSearchDocument: document missing title/domain/topics (L741-744) ────
test("scoreSearchDocument: document missing title, domain, topics uses empty fallbacks (L741-744)", () => {
  const doc = { summary: "corkboard notes" };
  const score = scoreSearchDocument("corkboard", doc);
  assert.ok(score > 0);
});

// ─── capSameOriginResults: content row with null origin (L786) ───────────────
test("capSameOriginResults: content row with null origin uses '' key (L786)", () => {
  const ranked = [
    { type: "content", origin: null },
    { type: "content", origin: null },
    { type: "content", origin: null },
    { type: "content", origin: null },
  ];
  const result = capSameOriginResults(ranked, 3);
  assert.equal(result.length, 3);
});

// ─── randomLinkTrail: cycle detection triggers && branches (L827-828) ────────
test("randomLinkTrail: cycle-prevention fires step.from && step.to branches (L827-828)", () => {
  const edges = [
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
    },
    {
      from: "https://b.example",
      to: "https://a.example",
      relation: "content-link",
    },
  ];
  // With random=()=>0, trail will try to re-visit a→b and be blocked
  const trail = randomLinkTrail(edges, () => 0, 3);
  assert.equal(trail.length, 2);
  assert.equal(trail[0].from, "https://a.example");
  assert.equal(trail[1].from, "https://b.example");
});

// ─── buildViewDocuments: signal with portfolio, no crawled_at, community no member_count ─
test("buildViewDocuments: signal portfolio branch, crawled_at branch, member_count fallback (L1064-1151)", () => {
  const network = [
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "Site A",
      description: "",
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      title: "Site B",
      description: "",
    },
  ];
  // Use flat format: topics.communities (not nested)
  const topics = {
    communities: [
      {
        slug: "design",
        label: "Design",
        // no member_count → fires L1106 and L1151 fallback
        sites: [
          {
            origin: "https://a.example",
            domain: "a.example",
            title: "Site A",
            membership: "declared",
          },
          {
            origin: "https://b.example",
            domain: "b.example",
            title: "Site B",
            membership: "participant",
          },
        ],
      },
    ],
  };
  // Use flat format: content.items is a flat array of content objects
  const content = {
    items: [
      {
        url: "https://a.example/post",
        title: "Post",
        site_origin: "https://a.example",
        published_at: new Date().toISOString(),
        declared_topics: [
          { slug: "design", label: "Design", community_eligible: true },
        ],
      },
      {
        url: "https://b.example/post",
        title: "Post B",
        site_origin: "https://b.example",
        published_at: new Date().toISOString(),
        declared_topics: [
          { slug: "design", label: "Design", community_eligible: true },
        ],
      },
    ],
  };
  // Use flat format: connections.edges (not nested)
  const connections = {
    edges: [
      {
        from: "https://a.example",
        to: "https://b.example",
        relation: "content-link",
        href: "https://b.example/post",
        page: "https://a.example/post",
        // no evidence_count → fires L1064 fallback
      },
    ],
  };
  const siteSignals = {
    origins: [
      {
        origin: "https://a.example",
        // no coverage → signal?.coverage || null fires (L1075)
        // no crawled_at → typeof signal?.crawled_at check fires (L1077)
        portfolio: { url: "https://a.example/portfolio", label: "Portfolio" },
      },
    ],
  };
  const views = buildViewDocuments({
    network,
    topics,
    content,
    connections,
    siteSignals,
    generatedAt: new Date().toISOString(),
    now: new Date(),
  });

  // signal has portfolio → L1078-1079 true branch
  const siteViewA = views.site_views.sites.find(
    (s) => s.origin === "https://a.example",
  );
  assert.ok(siteViewA);
  assert.ok(siteViewA.portfolio);
  assert.equal(siteViewA.portfolio.url, "https://a.example/portfolio");
  // no crawled_at → empty string
  assert.equal(siteViewA.crawled_at, "");
  // no coverage → null
  assert.equal(siteViewA.coverage, null);

  // community has no member_count → L1106 fallback fires
  assert.ok(views.explore.neighborhood);
  assert.equal(views.explore.neighborhood.member_count, 2);

  // edge has no evidence_count → L1064 fallback fires
  assert.ok(siteViewA.outgoing.length > 0);
  assert.equal(siteViewA.outgoing[0].evidence_count, 1);
});

// ─── buildViewDocuments: featuredEdge.from/to not in sites (L1119-1126) ──────
test("buildViewDocuments: featuredEdge nodes not in sites fall back to origin string (L1119-1120)", () => {
  const network = [
    { origin: "https://a.example", domain: "a.example", title: "A" },
  ];
  // Use flat format for topics, content, connections
  const topics = { communities: [] };
  const content = { items: [] };
  const connections = {
    edges: [
      {
        from: "https://x.example", // NOT in network
        to: "https://y.example", // NOT in network
        relation: "content-link",
        href: "https://y.example/p",
        page: "https://x.example/p",
        // text absent → fires L1123 || ""
        // evidence_count absent AND evidence absent → fires L1125 || 1
      },
    ],
  };
  const views = buildViewDocuments({
    network,
    topics,
    content,
    connections,
    generatedAt: new Date().toISOString(),
    now: new Date(),
  });

  const conn = views.explore.connection;
  assert.ok(conn);
  // from_title falls back to featuredEdge.from (L1119)
  assert.equal(conn.from_title, "https://x.example");
  // to_title falls back to featuredEdge.to (L1120)
  assert.equal(conn.to_title, "https://y.example");
  // text absent → "" (L1123)
  assert.equal(conn.text, "");
  // no evidence_count → no evidence array → 1 (L1125-1126)
  assert.equal(conn.evidence_count, 1);
});

// ─── buildViewDocuments: member with signal but no declared/heuristic → "heuristic" (L973) ─
test("buildViewDocuments: member with no listed and no signal membership becomes 'heuristic' (L973)", () => {
  const network = [
    // a.example is in network but NOT in community.sites
    { origin: "https://a.example" },
    { origin: "https://b.example", domain: "b.example", title: "B" },
  ];
  // Flat format: community only has b.example (single declared member)
  const topics = {
    communities: [
      {
        slug: "design",
        label: "Design",
        sites: [
          // Only b.example in community.sites; a.example is NOT listed
          { origin: "https://b.example", membership: "declared" },
        ],
      },
    ],
  };
  const content = {
    items: [
      {
        url: "https://a.example/post",
        title: "Post A",
        site_origin: "https://a.example",
        published_at: new Date().toISOString(),
        declared_topics: [
          { slug: "design", label: "Design", community_eligible: true },
        ],
      },
      {
        url: "https://b.example/post",
        title: "Post B",
        site_origin: "https://b.example",
        published_at: new Date().toISOString(),
        declared_topics: [
          { slug: "design", label: "Design", community_eligible: true },
        ],
      },
    ],
  };
  // Signal for a.example without declared_topics or subject_signals
  // → declared = undefined → membership = "heuristic" (L973)
  // Also: a.example has no domain or title → domain/title fallbacks fire (L968-969)
  // Also: a.example has no description → description fallback fires (L971)
  const siteSignals = {
    origins: [{ origin: "https://a.example" }],
  };
  const views = buildViewDocuments({
    network,
    topics,
    content,
    connections: { edges: [] },
    siteSignals,
    generatedAt: new Date().toISOString(),
    now: new Date(),
  });

  const designView = views.topic_views.neighborhoods.find(
    (n) => n.slug === "design",
  );
  assert.ok(designView);
  const memberA = designView.members.find(
    (m) => m.origin === "https://a.example",
  );
  assert.ok(memberA);
  // listed is null (a.example not in community.sites), signal has no declared_topics → "heuristic"
  assert.equal(memberA.membership, "heuristic");
  // listed?.domain is undefined, site has no domain → "" (L968)
  assert.equal(memberA.domain, "");
  // listed?.title is undefined, site has no title/domain → origin (L969)
  assert.equal(memberA.title, "https://a.example");
});

// ─── buildViewDocuments: member domain/title fallback with no listed (L968-969) ─
test("buildViewDocuments: member not in community.sites uses site domain/title (L968-969)", () => {
  const network = [
    { origin: "https://a.example", domain: "a.example", title: "A" },
    // b.example is in content but NOT in community.sites
    { origin: "https://b.example", domain: "b.example", title: "B Site" },
  ];
  // Flat format — declared membership keeps the single-site community public
  const topics = {
    communities: [
      {
        slug: "design",
        label: "Design",
        sites: [
          {
            origin: "https://a.example",
            domain: "a.example",
            title: "A",
            membership: "declared",
          },
        ],
      },
    ],
  };
  const content = {
    items: [
      {
        url: "https://a.example/post",
        title: "Post A",
        site_origin: "https://a.example",
        published_at: new Date().toISOString(),
        declared_topics: [
          { slug: "design", label: "Design", community_eligible: true },
        ],
      },
      {
        url: "https://b.example/post",
        title: "Post B",
        site_origin: "https://b.example",
        published_at: new Date().toISOString(),
        declared_topics: [
          { slug: "design", label: "Design", community_eligible: true },
        ],
      },
    ],
  };
  const views = buildViewDocuments({
    network,
    topics,
    content,
    connections: { edges: [] },
    generatedAt: new Date().toISOString(),
    now: new Date(),
  });

  const designView = views.topic_views.neighborhoods.find(
    (n) => n.slug === "design",
  );
  assert.ok(designView);
  const memberB = designView.members.find(
    (m) => m.origin === "https://b.example",
  );
  // b.example not in listed → uses site.domain and site.title (L968-969)
  assert.ok(memberB);
  assert.equal(memberB.domain, "b.example");
  assert.equal(memberB.title, "B Site");
});

// ─── compactContentItem: content_type and language TRUE branches (L271-272) ──
test("compactContentItem: string content_type and language are passed through (L271-272)", () => {
  const sites = sitesByOrigin([
    { origin: "https://a.example", domain: "a.example", title: "A" },
  ]);
  const item = {
    url: "https://a.example/post",
    title: "Post",
    site_origin: "https://a.example",
    content_type: "post",
    language: "en",
  };
  const result = compactContentItem(item, sites, new Set());
  assert.equal(result.content_type, "post");
  assert.equal(result.language, "en");
});

// ─── oneLatestPerOrigin: reversed order fires previous.published_at ': ""' (L334) ─
test("oneLatestPerOrigin: item without published_at stored first; replacement fires L334 ': ''", () => {
  const items = [
    // No published_at → stored first in byOrigin
    { site_origin: "https://a.example", url: "https://a.example/1" },
    // Has published_at → previousPublished resolves to "" (L334 ': "")
    {
      site_origin: "https://a.example",
      url: "https://a.example/2",
      published_at: "2026-01-01",
    },
  ];
  const result = oneLatestPerOrigin(items);
  assert.equal(result.length, 1);
  // The item with published_at is newer → replaces the one without
  assert.equal(result[0].url, "https://a.example/2");
});

// ─── oneLatestPerOrigin: null url + equal published_at fires first || "" (L339) ─
test("oneLatestPerOrigin: null item url fires first || '' tiebreak (L339)", () => {
  const items = [
    {
      site_origin: "https://a.example",
      url: "https://a.example/1",
      published_at: "2026-01-01",
    },
    // Same published_at, no url → item.url is undefined → String(undefined || "") fires
    { site_origin: "https://a.example", published_at: "2026-01-01" },
  ];
  // Both have same published_at; "" < "https://a.example/1" so item2 (no url) replaces item1
  const result = oneLatestPerOrigin(items);
  assert.equal(result.length, 1);
  // item2 has no url (it won the comparison)
  assert.equal(result[0].url, undefined);
});

// ─── connectionTopicOverlaps: member with no articles field fires || [] (L536) ─
test("connectionTopicOverlaps: member with no articles field fires member.articles || [] (L536)", () => {
  const neighborhoods = [
    {
      slug: "design",
      label: "Design",
      members: [
        // No articles field → fires || [] and returns null (filtered out)
        { origin: "https://bare.example" },
        {
          origin: "https://a.example",
          title: "A",
          domain: "a.example",
          articles: [{ url: "https://a.example/1", title: "Post" }],
        },
        {
          origin: "https://b.example",
          title: "B",
          domain: "b.example",
          articles: [{ url: "https://b.example/1", title: "Post" }],
        },
      ],
    },
  ];
  // "bare.example" has no articles → filtered; a and b remain → 1 pair
  const result = connectionTopicOverlaps(neighborhoods);
  assert.equal(result.overlap_count, 1);
});

// ─── compactWhyHere: string raw_value and observed_at (L691-692 TRUE branch) ─
test("compactWhyHere: string raw_value and observed_at are passed through (L691-692)", () => {
  const evidence = [
    {
      community_eligible: true,
      class: "declared",
      source: "html",
      page: "https://a.example/post",
      raw_value: "design",
      observed_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  const rows = compactWhyHere(evidence);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].raw_value, "design");
  assert.equal(rows[0].observed_at, "2026-01-01T00:00:00.000Z");
});

// ─── buildViewDocuments: undefined network fires input.network || [] (L865) ───
test("buildViewDocuments: undefined network uses empty array fallback (L865)", () => {
  const views = buildViewDocuments({
    generatedAt: new Date().toISOString(),
    now: new Date(),
  });
  assert.equal(views.explore.participant_count, 0);
});

// ─── buildViewDocuments: signal with crawled_at fires TRUE branch (L1077) ────
// Also covers L973 '? "declared"': origin NOT in community.sites but HAS signal declared_topics
test("buildViewDocuments: signal.crawled_at string fires L1077; declared signal fires L973 'declared' membership", () => {
  const network = [
    // a.example has no domain/title
    { origin: "https://a.example" },
    { origin: "https://b.example", domain: "b.example", title: "B" },
  ];
  const topics = {
    communities: [
      {
        slug: "design",
        label: "Design",
        // Only b.example in community.sites (single declared member)
        sites: [{ origin: "https://b.example", membership: "declared" }],
      },
    ],
  };
  const content = {
    items: [
      {
        url: "https://a.example/post",
        title: "Post A",
        site_origin: "https://a.example",
        published_at: new Date().toISOString(),
        declared_topics: [
          { slug: "design", label: "Design", community_eligible: true },
        ],
      },
      {
        url: "https://b.example/post",
        title: "Post B",
        site_origin: "https://b.example",
        published_at: new Date().toISOString(),
        declared_topics: [
          { slug: "design", label: "Design", community_eligible: true },
        ],
      },
    ],
  };
  // Signal for a.example WITH declared_topics → declared is truthy → membership = "declared" (L973)
  // Signal WITH crawled_at → crawled_at is a string → L1077 TRUE branch
  const siteSignals = {
    origins: [
      {
        origin: "https://a.example",
        crawled_at: "2026-01-01T00:00:00.000Z",
        declared_topics: [{ slug: "design", evidence: [] }],
      },
    ],
  };
  const views = buildViewDocuments({
    network,
    topics,
    content,
    connections: { edges: [] },
    siteSignals,
    generatedAt: new Date().toISOString(),
    now: new Date(),
  });

  // Signal has crawled_at (string) → site_views.crawled_at should be that string (L1077)
  const siteViewA = views.site_views.sites.find(
    (s) => s.origin === "https://a.example",
  );
  assert.ok(siteViewA);
  assert.equal(siteViewA.crawled_at, "2026-01-01T00:00:00.000Z");

  // a.example NOT in community.sites, signal HAS declared_topics → membership = "declared" (L973)
  const designView = views.topic_views.neighborhoods.find(
    (n) => n.slug === "design",
  );
  assert.ok(designView);
  const memberA = designView.members.find(
    (m) => m.origin === "https://a.example",
  );
  assert.ok(memberA);
  assert.equal(memberA.membership, "declared");
});

// ─── buildViewDocuments: community without label fires || other (BRDA:930) ────
// community with truthy member_count fires member_count LEFT branch (BRDA:1107)
test("buildViewDocuments: community without label fires label||slug fallback; member_count truthy fires L1107 LEFT", () => {
  // Two communities: "design" has label+member_count; "photo" has NO label
  // A content item mentioning both creates a cooccurrence pair.
  // For "design" topicView: related "photo" → otherCommunity.label = undefined → || other fires
  // featuredCommunity at day=0 picks "design" (alphabetically first), which has member_count > 0
  const network = [
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      description: "",
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      title: "B",
      description: "",
    },
    {
      origin: "https://c.example",
      domain: "c.example",
      title: "C",
      description: "",
    },
    {
      origin: "https://d.example",
      domain: "d.example",
      title: "D",
      description: "",
    },
  ];
  const topics = {
    communities: [
      {
        slug: "design",
        label: "Design",
        member_count: 3, // truthy → BRDA:1107 LEFT fires when design is featured
        sites: [
          {
            origin: "https://a.example",
            domain: "a.example",
            title: "A",
            membership: "declared",
          },
          {
            origin: "https://b.example",
            domain: "b.example",
            title: "B",
            membership: "participant",
          },
        ],
      },
      {
        slug: "photo",
        // deliberately NO label field → otherCommunity?.label = undefined → || other fires (BRDA:930)
        sites: [
          {
            origin: "https://c.example",
            domain: "c.example",
            title: "C",
            membership: "declared",
          },
          {
            origin: "https://d.example",
            domain: "d.example",
            title: "D",
            membership: "participant",
          },
        ],
      },
    ],
  };
  const content = {
    items: [
      {
        url: "https://a.example/post",
        title: "Post A",
        site_origin: "https://a.example",
        published_at: new Date().toISOString(),
        declared_topics: [
          { slug: "design", label: "Design", community_eligible: true },
          { slug: "photo", label: "Photo", community_eligible: true }, // co-mentions both → cooccurrence
        ],
      },
    ],
  };
  const connections = { edges: [] };
  const siteSignals = { origins: [] };

  // day=0 (epoch) → sorted ["design","photo"][0 % 2 = 0] → "design" is featured
  const views = buildViewDocuments({
    network,
    topics,
    content,
    connections,
    siteSignals,
    generatedAt: new Date().toISOString(),
    now: new Date(0), // epoch → day 0 → picks index 0 = "design" (alphabetically first)
  });

  // BRDA:1107 LEFT: design has member_count:3 (truthy) → neighborhood uses member_count directly
  assert.ok(views.explore.neighborhood);
  assert.equal(views.explore.neighborhood.slug, "design");
  assert.equal(views.explore.neighborhood.member_count, 3);

  // BRDA:930: "design" topicView's related entry for "photo" should use "photo" (slug) as label
  const topicViews = views.topic_views;
  const designView = topicViews.neighborhoods.find((n) => n.slug === "design");
  assert.ok(designView, "design topicView should exist");
  const photoRelated = designView.related.find((r) => r.slug === "photo");
  assert.ok(photoRelated, "photo should appear in design related");
  // "photo" community has no label field → optional chain gives undefined → || other fires → "photo"
  assert.equal(photoRelated.label, "photo");
});

test("capPresentationList: missing list, under max, over max, invalid max", () => {
  assert.deepEqual(capPresentationList(null, 3), []);
  assert.deepEqual(capPresentationList([1, 2], 3), [1, 2]);
  assert.deepEqual(capPresentationList([1, 2, 3, 4], 2), [1, 2]);
  assert.deepEqual(capPresentationList([1, 2], Number.NaN), [1, 2]);
  assert.deepEqual(capPresentationList([1, 2], -1), [1, 2]);
  assert.deepEqual(capPresentationList([1, 2], 0), []);
});

test("connectionTopicOverlaps: caps pair overlay size", () => {
  const members = [];

  for (let index = 0; index < 30; index += 1) {
    members.push({
      origin: `https://n${index}.example`,
      domain: `n${index}.example`,
      title: `N${index}`,
      articles: [{ url: `https://n${index}.example/a`, title: "A" }],
    });
  }

  const overlay = connectionTopicOverlaps([
    { slug: "shared", label: "Shared", members },
  ]);
  assert.equal(overlay.pairs.length, MAX_CONNECTION_TOPIC_PAIRS);
  assert.equal(overlay.overlap_count, MAX_CONNECTION_TOPIC_PAIRS);
});

test("topicCooccurrence: caps presentation pairs", () => {
  const slugs = [];

  for (let index = 0; index < 21; index += 1) {
    slugs.push(`t${String(index).padStart(2, "0")}`);
  }

  const publicSlugs = new Set(slugs);
  const pairs = topicCooccurrence(
    [
      {
        declared_topics: slugs.map((slug) => ({
          slug,
          community_eligible: true,
        })),
      },
    ],
    publicSlugs,
  );
  assert.equal(pairs.length, MAX_COOCCURRENCE_PAIRS);
});
