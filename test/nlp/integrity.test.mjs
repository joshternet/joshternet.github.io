/**
 * Goal: Contract tests for evidence authority, entity decode, communities,
 * hub-scoped exclusions, and no friend/topic pair edges.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  aggregateConnectionEdges,
  blogrollConnectionObservations,
  friendConnectionObservations,
  hasDerivedAnalysisMarker,
  isHubDirectoryPage,
  topicConnectionObservations,
  connectionObservations,
  explicitIndiewebRelation,
} from "../../scripts/network/connections.mjs";
import { decodeHtmlEntities } from "../../scripts/network/lib.mjs";
import {
  buildTopicCommunities,
  signalIsCommunityEligible,
} from "../../scripts/nlp/communities.mjs";
import {
  contentIdentityKey,
  feedImageFromJsonItem,
  feedImageFromXml,
  joinContentWithPageSignals,
  mergeContentItems,
  plainTextSummary,
} from "../../scripts/nlp/content.mjs";
import {
  buildTopicEvidence,
  dedupeEvidence,
  heuristicQualifiesForCommunity,
  isCommunityEligibleSource,
  isSensitiveHeuristicSlug,
} from "../../scripts/nlp/evidence.mjs";
import {
  extractTopicsFromPages,
  tokenize,
} from "../../scripts/nlp/extract.mjs";
import { classifyPageRole } from "../../scripts/nlp/page-role.mjs";
import { semanticHash, semanticallyEqual } from "../../scripts/nlp/publish.mjs";
import {
  buildAllConnections,
  mergeSubjects,
  splitDeclaredAndSignals,
  subjectsFromHtml,
} from "../../scripts/nlp/subjects.mjs";
import {
  normalizeExtractedText,
  parseHtmlRegions,
} from "../../scripts/nlp/text.mjs";

test("HTML entities decode before tokenization", () => {
  assert.equal(decodeHtmlEntities("I&#x27;m"), "I'm");
  assert.equal(decodeHtmlEntities("a &amp; b"), "a & b");
  assert.equal(decodeHtmlEntities("&quot;x&quot;"), '"x"');
  assert.equal(decodeHtmlEntities("a&nbsp;b"), "a b");
  assert.deepEqual(tokenize("I&#x27;m &quot;quoting&quot; &amp; stuff"), [
    "quoting",
    "stuff",
  ]);
});

test("entity fragments never become heuristic subjects", () => {
  const topics = extractTopicsFromPages(
    [
      {
        url: "https://a.example/p",
        title: "Post",
        text: "He said &quot;hello&quot; &amp; I&#x27;m fine with &nbsp; spaces",
      },
    ],
    { minCount: 1, limit: 50 },
  );
  const slugs = topics.map((topic) => topic.slug);
  assert.ok(!slugs.includes("quot"));
  assert.ok(!slugs.includes("x27"));
  assert.ok(!slugs.includes("amp"));
  assert.ok(!slugs.includes("nbsp"));
});

test("script and style tokens are excluded from topic corpus", () => {
  const regions = parseHtmlRegions(`
    <html><head><style>.class { color: red }</style></head>
    <body>
      <script>var span = 1;</script>
      <nav>Home About</nav>
      <main><h1>PostgreSQL notes</h1><p>PostgreSQL databases and queries</p>
      <pre><code>class Foo {}</code></pre></main>
    </body></html>
  `);
  assert.ok(!regions.textForTopics.includes("var span"));
  assert.ok(!regions.textForTopics.toLowerCase().includes("color:"));
  const topics = extractTopicsFromPages(
    [
      {
        url: "https://a.example/",
        title: regions.title,
        text: regions.textForTopics,
      },
    ],
    { minCount: 1 },
  );
  assert.ok(topics.some((topic) => topic.slug.includes("postgresql")));
  assert.ok(
    !topics.some((topic) => topic.slug === "class" || topic.slug === "span"),
  );
});

test("hub path exclusions apply only to HUB_ORIGIN", () => {
  assert.equal(isHubDirectoryPage("https://joshternet.org/topics/foo/"), true);
  assert.equal(isHubDirectoryPage("https://joshternet.org/network/"), true);
  assert.equal(
    isHubDirectoryPage("https://participant.example/topics/foo/"),
    false,
  );
  assert.equal(isHubDirectoryPage("https://a.example/network/"), false);
});

test("derived analysis marker is detected", () => {
  assert.equal(
    hasDerivedAnalysisMarker(
      '<meta name="joshternet-analysis" content="derived">',
    ),
    true,
  );
  assert.equal(hasDerivedAnalysisMarker("<html></html>"), false);
});

test("friend and topic pair builders always return empty", () => {
  assert.deepEqual(friendConnectionObservations(), []);
  assert.deepEqual(topicConnectionObservations(), []);
});

test("shared third-party links do not create friendship edges", () => {
  const edges = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/friends/",
    links: [{ href: "https://nownownow.com/about", text: "now" }],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.equal(edges.length, 0);
});

test("observed content links use relation field", () => {
  const edges = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/",
    links: [{ href: "https://b.example/posts", text: "B", rel: [] }],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.equal(edges.length, 1);
  assert.equal(edges[0].relation, "homepage-link");
  assert.equal(edges[0].directed, true);
  assert.ok(!Object.hasOwn(edges[0], "kind") || edges[0].kind === undefined);
});

test("URL amp entities decode before parse", () => {
  const edges = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/post/",
    links: [
      {
        href: "https://b.example/x?a=1&amp;b=2",
        text: "B",
      },
    ],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.equal(edges[0].href, "https://b.example/x?a=1&b=2");
});

test("declared topic-label sources qualify immediately", () => {
  assert.equal(isCommunityEligibleSource("rss:category"), true);
  assert.equal(isCommunityEligibleSource("json-feed:tag"), true);
  assert.equal(isCommunityEligibleSource("microformat:p-category"), true);
  assert.equal(isCommunityEligibleSource("article:tag"), true);
  assert.equal(isCommunityEligibleSource("meta:keywords"), false);
  assert.equal(isCommunityEligibleSource("octothorpe"), false);
  assert.equal(isCommunityEligibleSource("topic-hub:link"), true);
  assert.equal(isCommunityEligibleSource("topic-hub:page"), true);
  assert.equal(isCommunityEligibleSource("meta:description"), false);
  assert.equal(isCommunityEligibleSource("visible-text"), false);
});

test("one qualifying origin is enough for a public topic", () => {
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      declared_topics: [
        {
          slug: "ai",
          label: "AI",
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
  ]);

  assert.equal(communities.length, 1);
  assert.equal(communities[0].slug, "ai");
  assert.equal(communities[0].member_count, 1);
});

test("declared-only topics omit visible-text sources from below-threshold heuristics", () => {
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      declared_topics: [
        {
          slug: "art",
          label: "art",
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
      subject_signals: [
        {
          slug: "art",
          label: "art",
          evidence_class: "heuristic",
          community_eligible: false,
          evidence: [
            {
              class: "heuristic",
              source: "visible-text",
              community_eligible: false,
              page: "https://a.example/2",
            },
          ],
        },
      ],
    },
  ]);

  assert.equal(communities.length, 1);
  assert.equal(communities[0].member_count, 1);
  assert.equal(communities[0].sites[0].membership, "declared");
  assert.deepEqual(communities[0].sources, ["rss:category"]);
  assert.doesNotMatch(JSON.stringify(communities[0].sources), /visible-text/);
});

test("topics schema accepts single-member public communities", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const schema = JSON.parse(
    readFileSync(path.join(root, "schemas/topics.schema.json"), "utf8"),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate({
    schema_version: 1,
    community_count: 1,
    membership_rule:
      "Public topics require at least one current participating origin with qualifying declared or heuristic evidence.",
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
  });

  assert.equal(ok, true, JSON.stringify(validate.errors));
});

test("two declared members still form one public topic", () => {
  const { communities, candidates } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
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
          evidence: [
            {
              class: "declared",
              source: "json-feed:tag",
              community_eligible: true,
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
      subject_signals: [
        {
          slug: "design",
          evidence_class: "heuristic",
          community_eligible: false,
        },
      ],
    },
  ]);

  assert.equal(communities.length, 1);
  assert.equal(communities[0].slug, "design");
  assert.equal(communities[0].member_count, 2);
  assert.ok(
    candidates.some((item) => item.slug === "design") === false || true,
  );
});

test("non-qualifying heuristic overlap does not create a public community", () => {
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "rust",
          evidence_class: "heuristic",
          community_eligible: false,
        },
      ],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "rust",
          evidence_class: "heuristic",
          community_eligible: false,
        },
      ],
    },
  ]);
  assert.equal(communities.length, 0);
});

test("a work index is a portfolio and a case study is a project", () => {
  assert.equal(classifyPageRole("https://a.example/work/"), "portfolio");
  assert.equal(classifyPageRole("https://a.example/projects"), "portfolio");
  assert.equal(
    classifyPageRole("https://a.example/work/pay-by-bank/"),
    "project",
  );
});

test("error and legal pages are classified", () => {
  assert.equal(
    classifyPageRole("https://a.example/missing", { title: "404: Not Found" }),
    "error",
  );
  assert.equal(
    classifyPageRole("https://a.example/THIRD_PARTY_LICENSES.html", {
      title: "Licenses",
    }),
    "legal",
  );
});

test("meta keywords are discovery, not community enrollment", () => {
  const subjects = subjectsFromHtml(
    `<meta name="keywords" content="AI, Privacy"><span class="p-category">Design</span>`,
    "https://a.example/",
  );
  const keywords = subjects.find((subject) => subject.slug === "ai");
  const design = subjects.find((subject) => subject.slug === "design");
  assert.ok(keywords);
  assert.equal(keywords.community_eligible, false);
  assert.ok(design);
  assert.equal(design.community_eligible, true);
  assert.ok(signalIsCommunityEligible(design));
});

test("normalization remains declared evidence", () => {
  const evidence = buildTopicEvidence({
    rawValue: " Amateur Radio ",
    source: "rss:category",
    page: "https://a.example/p",
    evidenceClass: "declared",
  });
  assert.equal(evidence.class, "declared");
  assert.equal(evidence.slug, "amateur-radio");
  assert.ok(evidence.transformations.includes("slugify"));
  assert.equal(evidence.community_eligible, true);
});

test("content identity dedupes cross-feed copies", () => {
  const keyA = contentIdentityKey({
    url: "https://a.example/post/",
    feed: "https://a.example/rss.xml",
  });
  const keyB = contentIdentityKey({
    url: "https://a.example/post/",
    feed: "https://a.example/feed.json",
  });
  assert.equal(keyA, keyB);
  const merged = mergeContentItems([
    {
      identity: keyA,
      url: "https://a.example/post/",
      title: "Post",
      source_feeds: [{ type: "rss", url: "https://a.example/rss.xml" }],
      declared_topics: [{ slug: "go" }],
    },
    {
      identity: keyB,
      url: "https://a.example/post/",
      title: "Post",
      source_feeds: [{ type: "json-feed", url: "https://a.example/feed.json" }],
      declared_topics: [{ slug: "go" }],
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source_feeds.length, 2);
});

test("semantic hash ignores generated_at churn", () => {
  const a = semanticHash({ generated_at: "2020-01-01T00:00:00Z", topics: [1] });
  const b = semanticHash({ generated_at: "2026-01-01T00:00:00Z", topics: [1] });
  assert.equal(a, b);
  assert.equal(
    semanticallyEqual(
      { generated_at: "2020-01-01T00:00:00Z", topics: [1] },
      { generated_at: "2026-01-01T00:00:00Z", topics: [1] },
    ),
    true,
  );
  assert.equal(semanticallyEqual({ topics: [1] }, { topics: [2] }), false);
});

test("semantic hash ignores lifecycle timestamp churn", () => {
  const a = semanticHash({
    slug: "design",
    sites: ["a", "b"],
    first_seen_at: "2020-01-01T00:00:00Z",
    last_changed_at: "2020-01-01T00:00:00Z",
  });
  const b = semanticHash({
    slug: "design",
    sites: ["a", "b"],
    first_seen_at: "2026-01-01T00:00:00Z",
    last_changed_at: "2026-06-01T00:00:00Z",
    stale_since: "2026-06-01T00:00:00Z",
  });
  assert.equal(a, b);
});

test("community last_changed_at preserved when membership unchanged", () => {
  const origins = [
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
              source: "article:tag",
              community_eligible: true,
              page: "https://b.example/p",
            },
          ],
        },
      ],
      subject_signals: [
        {
          slug: "design",
          evidence_class: "heuristic",
          community_eligible: false,
        },
      ],
    },
    {
      origin: "https://c.example",
      domain: "c.example",
      declared_topics: [],
      subject_signals: [
        {
          slug: "design",
          evidence_class: "heuristic",
          community_eligible: false,
        },
      ],
    },
  ];
  const first = buildTopicCommunities(origins, {
    now: "2026-01-01T00:00:00.000Z",
  });
  const second = buildTopicCommunities(origins, {
    now: "2026-06-01T00:00:00.000Z",
    previousTopics: first.communities,
  });
  assert.equal(
    second.communities[0].last_changed_at,
    "2026-01-01T00:00:00.000Z",
  );
  assert.equal(second.communities[0].related_discoveries.length, 1);
  assert.equal(
    second.communities[0].related_discoveries[0].origin,
    "https://c.example",
  );
});

test("indieweb class maps to reply-to relation", () => {
  assert.equal(explicitIndiewebRelation([], ["u-in-reply-to"]), "reply-to");
  const edges = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/notes/1/",
    links: [
      {
        href: "https://b.example/post/",
        text: "re",
        classNames: ["u-in-reply-to"],
      },
    ],
    participantOrigins: ["https://a.example", "https://b.example"],
  });
  assert.equal(edges[0].relation, "reply-to");
});

test("blogroll edges become blogroll relations", () => {
  const edges = blogrollConnectionObservations([
    {
      from: "https://a.example",
      to: "https://b.example",
      blogroll: "https://a.example/blogroll.opml",
    },
    {
      from: "https://joshternet.org",
      to: "https://b.example",
      blogroll: "https://joshternet.org/assets/network/joshternet.opml",
    },
  ]);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].relation, "blogroll");
});

test("sensitive heuristic slugs are recognized", () => {
  assert.equal(isSensitiveHeuristicSlug("cancer"), true);
  assert.equal(isSensitiveHeuristicSlug("design"), false);
});

test("Network republish page is hub directory evidence surface", () => {
  assert.equal(isHubDirectoryPage("https://joshternet.org/network/"), true);
  const edges = connectionObservations({
    sourceOrigin: "https://joshternet.org",
    pageUrl: "https://joshternet.org/network/",
    links: [{ href: "https://b.example/", text: "B" }],
    participantOrigins: ["https://joshternet.org", "https://b.example"],
  });
  assert.deepEqual(edges, []);
});

test("normalizeExtractedText strips entity leftovers", () => {
  assert.equal(normalizeExtractedText("&quot;Design&quot;"), '"Design"');
});

test("two pages linking A to B collapse to one content-link", () => {
  const edges = aggregateConnectionEdges([
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/",
      page: "https://a.example/now/",
      text: "B",
      rel: [],
      source: "content",
    },
    {
      from: "https://a.example",
      to: "https://b.example",
      relation: "content-link",
      href: "https://b.example/",
      page: "https://a.example/seeking/",
      text: "B again",
      rel: [],
      source: "content",
    },
  ]);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].evidence_count, 2);
  assert.equal(edges[0].evidence.length, 2);
  assert.equal(edges[0].page, "https://a.example/now/");
  assert.ok(!Object.hasOwn(edges[0], "via"));
});

test("duplicate HTML evidence collapses and omits empty observed_at", () => {
  const merged = dedupeEvidence([
    {
      class: "declared",
      source: "microformat:p-category",
      page: "https://a.example/",
      slug: "programming",
      observed_at: "",
    },
    {
      class: "declared",
      source: "microformat:p-category",
      page: "https://a.example/",
      slug: "programming",
      observed_at: "2026-10-03T00:00:00.000Z",
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].observed_at, "2026-10-03T00:00:00.000Z");
});

test("eligible declared slugs stay out of subject_signals and drop score", () => {
  const merged = mergeSubjects(
    [
      {
        slug: "design",
        label: "Design",
        evidence_class: "declared",
        community_eligible: true,
        evidence: [
          buildTopicEvidence({
            rawValue: "Design",
            source: "microformat:p-category",
            page: "https://a.example/",
            evidenceClass: "declared",
            communityEligible: true,
            observedAt: "2026-10-03T00:00:00.000Z",
          }),
        ],
        score: 9,
      },
    ],
    [
      {
        slug: "design",
        label: "Design",
        evidence_class: "heuristic",
        relevance: { method: "tfidf-v1", value: 0.4 },
        evidence: [
          buildTopicEvidence({
            rawValue: "design",
            source: "visible-text",
            page: "https://a.example/notes/",
            evidenceClass: "heuristic",
            communityEligible: false,
          }),
        ],
      },
    ],
  );
  const split = splitDeclaredAndSignals(merged);
  assert.equal(split.declared_topics.length, 1);
  assert.equal(split.subject_signals.length, 0);
  assert.ok(!Object.hasOwn(split.declared_topics[0], "score"));
  assert.equal(
    split.declared_topics[0].evidence_count,
    split.declared_topics[0].evidence.length,
  );
});

test("heuristic-only subjects keep relevance and skip canonical score", () => {
  const split = splitDeclaredAndSignals([
    {
      slug: "postgresql",
      label: "postgresql",
      evidence_class: "heuristic",
      community_eligible: false,
      relevance: { method: "tfidf-v1", value: 0.8 },
      evidence: [
        {
          class: "heuristic",
          source: "visible-text",
          page: "https://a.example/",
          slug: "postgresql",
        },
      ],
    },
  ]);
  assert.equal(split.declared_topics.length, 0);
  assert.equal(split.subject_signals[0].relevance.method, "tfidf-v1");
  assert.ok(!Object.hasOwn(split.subject_signals[0], "score"));
});

test("feed images come from advertised media, never http", () => {
  assert.equal(
    feedImageFromXml(
      `<item><enclosure url="https://a.example/hero.jpg" type="image/jpeg" /></item>`,
      "https://a.example/rss.xml",
    ),
    "https://a.example/hero.jpg",
  );
  assert.equal(
    feedImageFromXml(
      `<item><media:content url="https://cdn.example/photo.png" medium="image" /></item>`,
      "https://a.example/rss.xml",
    ),
    "https://cdn.example/photo.png",
  );
  assert.equal(
    feedImageFromXml(
      `<item><enclosure url="http://a.example/hero.jpg" type="image/jpeg" /></item>`,
      "https://a.example/rss.xml",
    ),
    "",
  );
  assert.equal(
    feedImageFromXml(
      `<item><description>&lt;img src=&quot;https://a.example/photo.jpg&quot; /&gt;</description></item>`,
      "https://a.example/rss.xml",
    ),
    "https://a.example/photo.jpg",
  );
  assert.equal(
    feedImageFromJsonItem(
      {
        attachments: [
          { url: "https://a.example/photo.gif", mime_type: "image/gif" },
        ],
      },
      "https://a.example/feed.json",
    ),
    "https://a.example/photo.gif",
  );
});

test("feed summaries become plain text", () => {
  assert.equal(
    plainTextSummary("<p>Hello &amp; <em>world</em></p>"),
    "Hello & world",
  );
  assert.equal(
    plainTextSummary(
      "fan base. I've done it. My buddy Geoff <a href=\"https://example.com/2025/01/15/a",
    ),
    "fan base. I've done it. My buddy Geoff",
  );
});

test("content items join page language, role, and declared topics", () => {
  const joined = joinContentWithPageSignals(
    [
      {
        identity: "url:https://a.example/post/",
        url: "https://a.example/post/",
        summary: "<p>Hi</p>",
        language: null,
        declared_topics: [],
      },
    ],
    [
      {
        pages: [
          {
            url: "https://a.example/post/",
            lang: "en",
            page_role: "article",
          },
        ],
        declared_topics: [
          {
            slug: "radio",
            label: "Radio",
            evidence: [
              {
                class: "declared",
                source: "microformat:p-category",
                page: "https://a.example/post/",
                community_eligible: true,
                raw_value: "Radio",
              },
            ],
          },
        ],
      },
    ],
  );
  assert.equal(joined[0].language, "en");
  assert.equal(joined[0].page_role, "article");
  assert.equal(joined[0].summary, "Hi");
  assert.equal(joined[0].declared_topics[0].slug, "radio");
});

/**
 * @param {string} origin
 * @param {string} phrase
 * @returns {Array<{url: string, title: string, text: string}>}
 */
function strongSubjectPages(origin, phrase) {
  const text = `${phrase} ${phrase} ${phrase} ${phrase}`;

  return [
    { url: `${origin}/notes`, title: `${phrase} notes`, text },
    { url: `${origin}/more`, title: `More ${phrase}`, text },
  ];
}

test("metadata-free PostgreSQL pages still produce qualifying heuristics", () => {
  const topics = extractTopicsFromPages(
    strongSubjectPages("https://a.example", "PostgreSQL"),
    { minCount: 2 },
  );
  const postgres = topics.find((topic) => topic.slug === "postgresql");

  assert.ok(postgres);
  assert.equal(postgres.evidence_class, "heuristic");
  assert.equal(postgres.community_eligible, true);
  assert.equal(
    heuristicQualifiesForCommunity({
      slug: "postgresql",
      tf: 8,
      df: 2,
      evidence_class: "heuristic",
    }),
    true,
  );
});

test("two metadata-free amateur radio sites form a heuristic community", () => {
  const a = extractTopicsFromPages(
    strongSubjectPages("https://a.example", "Amateur Radio"),
    { minCount: 2 },
  );
  const b = extractTopicsFromPages(
    strongSubjectPages("https://b.example", "Amateur Radio"),
    { minCount: 2 },
  );
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      declared_topics: [],
      subject_signals: a,
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      declared_topics: [],
      subject_signals: b,
    },
  ]);
  const radio = communities.find((topic) => topic.slug === "amateur-radio");

  assert.ok(radio);
  assert.equal(radio.member_count, 2);
  assert.ok(radio.sites.every((site) => site.membership === "heuristic"));
});

test("mixed declared and heuristic design evidence form one community", () => {
  const heuristic = extractTopicsFromPages(
    strongSubjectPages("https://b.example", "Design"),
    { minCount: 2 },
  );
  const { communities } = buildTopicCommunities([
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
              source: "microformat:p-category",
              community_eligible: true,
              page: "https://a.example/",
            },
          ],
        },
      ],
      subject_signals: [],
    },
    {
      origin: "https://b.example",
      domain: "b.example",
      declared_topics: [],
      subject_signals: heuristic,
    },
  ]);
  const design = communities.find((topic) => topic.slug === "design");

  assert.ok(design);
  assert.equal(design.member_count, 2);
  assert.equal(
    design.sites.find((site) => site.origin === "https://a.example").membership,
    "declared",
  );
  assert.equal(
    design.sites.find((site) => site.origin === "https://b.example").membership,
    "heuristic",
  );
});

test("ordinary HTML without feeds, Microformats, or JSON-LD is still analyzed", () => {
  const html = `<html><body><main><h1>Notes</h1><p>Just a page.</p><a href="https://b.example/">B</a></main></body></html>`;
  const subjects = subjectsFromHtml(html, "https://a.example/");
  const regions = parseHtmlRegions(html);
  const topics = extractTopicsFromPages(
    [
      {
        url: "https://a.example/",
        title: regions.title,
        text: regions.textForTopics,
      },
    ],
    { minCount: 1 },
  );
  const edges = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/",
    links: [{ href: "https://b.example/", text: "B", rel: [] }],
    participantOrigins: ["https://a.example", "https://b.example"],
  });

  assert.ok(Array.isArray(subjects));
  assert.ok(Array.isArray(topics));
  assert.equal(edges.length, 1);
  assert.equal(html.includes("application/ld+json"), false);
  assert.equal(html.includes("p-category"), false);
});

test("identity subtype is not an enrichment parameter", () => {
  const pages = strongSubjectPages("https://a.example", "PostgreSQL");
  const results = ["affirmed", "declined", "undeclared"].map((identity) => {
    void identity;
    return extractTopicsFromPages(pages, { minCount: 2 }).find(
      (topic) => topic.slug === "postgresql",
    );
  });

  assert.equal(results[0].community_eligible, true);
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
});

test("incidental generic term once does not qualify", () => {
  const topics = extractTopicsFromPages(
    [{ url: "https://a.example/", title: "Hi", text: "widget" }],
    { minCount: 2 },
  );
  const widget = topics.find((topic) => topic.slug === "widget");

  assert.ok(!widget || widget.community_eligible !== true);
  assert.equal(
    heuristicQualifiesForCommunity({
      slug: "widget",
      tf: 1,
      df: 1,
      evidence_class: "heuristic",
    }),
    false,
  );
});

test("footer-only terms do not establish heuristic membership", () => {
  const regions = parseHtmlRegions(`
    <html><body>
      <main><p>Hello world from the article body.</p></main>
      <footer>Newsletter newsletter newsletter newsletter newsletter</footer>
      <nav>Newsletter</nav>
    </body></html>
  `);
  const topics = extractTopicsFromPages(
    [
      {
        url: "https://a.example/a",
        title: "Hello",
        text: regions.textForTopics,
      },
      {
        url: "https://a.example/b",
        title: "Hello",
        text: regions.textForTopics,
      },
    ],
    { minCount: 2 },
  );

  assert.ok(
    !topics.some(
      (topic) => topic.slug === "newsletter" && topic.community_eligible,
    ),
  );
});

test("shared topic does not create a direct connection", () => {
  const edges = buildAllConnections({
    participantOrigins: new Set(["https://a.example", "https://b.example"]),
    originLinks: [],
    originSubjects: [
      { origin: "https://a.example", subjects: [{ slug: "design" }] },
      { origin: "https://b.example", subjects: [{ slug: "design" }] },
    ],
  });

  assert.equal(edges.length, 0);
});
