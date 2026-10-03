/**
 * Goal: Presentation projections never invent communities or popularity.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildViewDocuments,
  capSameOriginResults,
  connectionTopicOverlaps,
  oneLatestPerOrigin,
  pickFeaturedCommunity,
  pickFeaturedConnection,
  publicCommunities,
  publishedWithinDays,
  randomLinkTrail,
  relationLabel,
  scoreSearchDocument,
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
    topics: { communities: [] },
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
    topics: { communities: [] },
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
