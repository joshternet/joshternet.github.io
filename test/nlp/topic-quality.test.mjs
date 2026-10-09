/**
 * Goal: Regression fixtures for topic extraction, normalization, evidence,
 * publication invariants, and crawl failure records.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { originFailureSignal } from "../../scripts/nlp/crawl.mjs";
import {
  aliasCompatibilityMarkdown,
  buildTopicCommunities,
} from "../../scripts/nlp/communities.mjs";
import { buildTopicEvidence } from "../../scripts/nlp/evidence.mjs";
import {
  extractTopicsFromPages,
  phrasesFromText,
} from "../../scripts/nlp/extract.mjs";
import {
  aliasConfigurationErrors,
  allowsAmbiguousUnigram,
  equivalentAliases,
  foldPluralSlug,
  foldPluralToken,
  heuristicRejectionReason,
  topicRelations,
} from "../../scripts/nlp/normalize.mjs";
import { topicQualityReport, topicDiff } from "../../scripts/nlp/quality.mjs";
import { subjectsFromHtml } from "../../scripts/nlp/subjects.mjs";
import {
  isEnglishLanguage,
  parseHtmlRegions,
} from "../../scripts/nlp/text.mjs";
import { fairTopicArticles } from "../../scripts/views/lib.mjs";
import { semanticallyEqual } from "../../scripts/nlp/publish.mjs";

test("plural tokens fold only when the singular is the same word", () => {
  assert.equal(foldPluralToken(""), "");
  assert.equal(foldPluralToken("agents"), "agent");
  assert.equal(foldPluralToken("books"), "book");
  assert.equal(foldPluralToken("databases"), "database");
  assert.equal(foldPluralToken("browsers"), "browser");
  assert.equal(foldPluralToken("photographs"), "photograph");
  assert.equal(foldPluralToken("computers"), "computer");
  assert.equal(foldPluralToken("policies"), "policy");
  assert.equal(foldPluralToken("boxes"), "box");
  assert.equal(foldPluralToken("news"), "news");
  assert.equal(foldPluralToken("analysis"), "analysis");
  assert.equal(foldPluralToken("business"), "business");
  assert.equal(foldPluralToken("css"), "css");
  assert.equal(foldPluralToken("windows"), "windows");
  assert.equal(foldPluralToken("go"), "go");
  assert.equal(foldPluralToken("famous"), "famous");
  assert.equal(foldPluralToken("status"), "status");
  assert.equal(foldPluralToken("tennis"), "tennis");
  assert.equal(foldPluralToken("texas"), "texas");
  assert.equal(foldPluralToken("photos"), "photos");
  assert.equal(foldPluralSlug(""), "");
  assert.equal(foldPluralSlug("ai-agents"), "ai-agent");
  assert.equal(foldPluralSlug("real-estate-agents"), "real-estate-agent");
  assert.equal(foldPluralSlug("postgres"), "postgres");
  assert.equal(foldPluralSlug("ethics"), "ethics");
  assert.equal(foldPluralSlug("economics"), "economics");
  assert.equal(foldPluralSlug("politics"), "politics");
  assert.equal(foldPluralSlug("united-states"), "united-states");
  assert.equal(foldPluralSlug("databases"), "database");
  assert.equal(foldPluralToken("devops"), "devops");
  assert.equal(foldPluralToken("analytics"), "analytics");
  assert.equal(foldPluralToken("topics"), "topic");
  assert.equal(foldPluralToken("laptops"), "laptop");
  assert.equal(foldPluralToken("shops"), "shop");
  assert.equal(foldPluralToken("desktops"), "desktop");
  assert.equal(foldPluralSlug("web-topics"), "web-topic");
  assert.equal(foldPluralSlug("internet-of-things"), "internet-of-things");
  assert.equal(foldPluralSlug("communications-pr"), "communication-pr");
  assert.notEqual(
    foldPluralSlug("ai-agents"),
    foldPluralSlug("real-estate-agents"),
  );
});

test("ambiguous short words need technical context", () => {
  assert.equal(
    allowsAmbiguousUnigram("I have to go to the store.", "go"),
    false,
  );
  assert.equal(
    allowsAmbiguousUnigram("I implemented the server in Go.", "go"),
    true,
  );
  assert.equal(allowsAmbiguousUnigram("Use Golang today.", "go"), true);
  assert.equal(allowsAmbiguousUnigram("Go programming notes.", "go"), true);
  assert.equal(allowsAmbiguousUnigram("in Rust", "rust"), true);
  assert.equal(allowsAmbiguousUnigram("Rust programming", "rust"), true);
  assert.equal(allowsAmbiguousUnigram("Rust language", "rust"), true);
  assert.equal(allowsAmbiguousUnigram("the rust on the gate", "rust"), false);
  assert.equal(allowsAmbiguousUnigram("in Python", "python"), true);
  assert.equal(allowsAmbiguousUnigram("Python programming", "python"), true);
  assert.equal(
    allowsAmbiguousUnigram("a python in the grass", "python"),
    false,
  );
  assert.equal(allowsAmbiguousUnigram("in Java", "java"), true);
  assert.equal(allowsAmbiguousUnigram("Java programming", "java"), true);
  assert.equal(allowsAmbiguousUnigram("java the island", "java"), false);
  assert.equal(allowsAmbiguousUnigram("Apple computer", "apple"), true);
  assert.equal(allowsAmbiguousUnigram("Apple silicon", "apple"), true);
  assert.equal(allowsAmbiguousUnigram("macOS", "apple"), true);
  assert.equal(allowsAmbiguousUnigram("apple pie", "apple"), false);
  assert.equal(allowsAmbiguousUnigram("Microsoft Windows", "windows"), true);
  assert.equal(allowsAmbiguousUnigram("Windows 11", "windows"), true);
  assert.equal(allowsAmbiguousUnigram("Windows Server", "windows"), true);
  assert.equal(
    allowsAmbiguousUnigram("the windows were open", "windows"),
    false,
  );
  assert.equal(allowsAmbiguousUnigram("hello", "list"), false);
  assert.ok(!phrasesFromText("I have to go to the store.").includes("go"));
  assert.ok(phrasesFromText("I implemented the server in Go.").includes("go"));
});

test("stopwords and sentence boundaries do not manufacture phrases", () => {
  const joined = phrasesFromText(
    "Privacy is the heart of design. Design matters.",
  );

  assert.ok(!joined.includes("privacy heart"));
  assert.ok(!joined.includes("privacy design"));
  assert.ok(
    phrasesFromText("Implementing a linked list in C.").includes("linked list"),
  );
  assert.deepEqual(phrasesFromText(""), []);
});

test("navigation words and repeated templates are not public topics", () => {
  const pages = Array.from({ length: 8 }, (_item, index) => ({
    url: `https://a.example/${index}`,
    title: "Home",
    text: "recent next page list boilerplateword boilerplateword",
  }));
  const topics = extractTopicsFromPages(pages, { minCount: 1 });
  const slugs = topics.map((topic) => topic.slug);

  assert.ok(!slugs.includes("list"));
  assert.ok(!slugs.includes("page"));
  assert.ok(!slugs.includes("recent"));
  assert.ok(!slugs.includes("next"));
  const boilerplate = topics.find((topic) => topic.slug === "boilerplateword");

  assert.equal(boilerplate.community_eligible, false);
  assert.equal(boilerplate.rejection_reason, "site-boilerplate");
  assert.equal(boilerplate.status, "pending");

  const mixed = extractTopicsFromPages(
    Array.from({ length: 8 }, (_item, index) => ({
      url: `https://a.example/mix/${index}`,
      title: index < 2 ? "Gardening notes" : "Hello",
      text:
        index < 2 ? "gardening soil plants seasons" : "weather forecast clouds",
    })),
    { minCount: 1 },
  );
  const gardening = mixed.find((topic) => topic.slug === "gardening");

  assert.ok(gardening);
  assert.equal(gardening.rejection_reason === "site-boilerplate", false);

  const sensitive = extractTopicsFromPages(
    [
      {
        url: "https://a.example/c1",
        title: "Cancer research",
        text: "cancer cancer cancer cancer",
      },
      {
        url: "https://a.example/c2",
        title: "Cancer notes",
        text: "cancer cancer cancer",
      },
    ],
    { minCount: 1 },
  );
  const cancer = sensitive.find((topic) => topic.slug === "cancer");

  assert.equal(cancer.community_eligible, false);
  assert.equal(cancer.rejection_reason, "sensitive-attribute");
  assert.ok(phrasesFromText("ok").includes("ok") === false);
});

test("one declared niche subject stays a community", () => {
  const { communities } = buildTopicCommunities([
    {
      origin: "https://radio.example",
      domain: "radio.example",
      title: "Radio",
      declared_topics: [
        {
          slug: "amateur-radio",
          label: "Amateur Radio",
          evidence_class: "declared",
          community_eligible: true,
          evidence: [],
        },
      ],
      subject_signals: [],
    },
  ]);

  assert.equal(communities[0].slug, "amateur-radio");
  assert.equal(communities[0].sites[0].membership, "declared");
});

test("agent and agents share a slug and unrelated phrases do not", () => {
  const { communities } = buildTopicCommunities([
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      declared_topics: [
        {
          slug: "agents",
          label: "Agents",
          evidence_class: "declared",
          community_eligible: true,
          evidence: [],
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
          slug: "agent",
          label: "Agent",
          evidence_class: "declared",
          community_eligible: true,
          evidence: [],
        },
        {
          slug: "real-estate-agents",
          label: "Real estate agents",
          evidence_class: "declared",
          community_eligible: true,
          evidence: [],
        },
      ],
      subject_signals: [],
    },
  ]);
  const slugs = communities.map((topic) => topic.slug).sort();

  assert.deepEqual(slugs, ["agent", "real-estate-agent"]);
  assert.equal(
    communities.find((topic) => topic.slug === "agent").sites.length,
    2,
  );
});

test("alias and relationship documents stay distinct", () => {
  const doc = {
    aliases: [
      { from: "Postgres", to: "PostgreSQL", kind: "equivalent" },
      { from: "ml", to: "ai", kind: "broader" },
      { from: "js", to: "javascript" },
      { from: "js", to: "ecmascript" },
      { from: "", to: "x" },
      { from: "same", to: "same" },
      null,
      { from: 1, to: "x" },
    ],
    relationships: [
      { from: "privacy", to: "surveillance", kind: "related" },
      { from: "web-development", to: "software-development", kind: "broader" },
      { from: "postgres", to: "postgresql", kind: "equivalent" },
      { from: "", to: "art" },
      null,
    ],
  };
  const errors = aliasConfigurationErrors(doc);

  assert.ok(errors.some((error) => error.code === "alias-not-equivalent"));
  assert.ok(errors.some((error) => error.code === "alias-conflict"));
  assert.ok(errors.some((error) => error.code === "relationship-not-alias"));
  assert.deepEqual(aliasConfigurationErrors(null), []);
  assert.deepEqual(aliasConfigurationErrors({ relationships: "nope" }), []);
  assert.equal(equivalentAliases(null).length, 0);
  assert.equal(equivalentAliases(1).length, 0);
  assert.equal(equivalentAliases({ aliases: "no" }).length, 0);
  assert.equal(topicRelations(null).length, 0);
  assert.equal(topicRelations(1).length, 0);
  assert.equal(
    topicRelations({
      relationships: [{ from: "alpha", to: "beta", kind: "nope" }],
    }).length,
    0,
  );
  assert.equal(topicRelations(doc).length, 2);
  assert.ok(
    equivalentAliases({ aliases: [{ from: "Postgres", to: "PostgreSQL" }] })[0],
  );

  const cycled = aliasConfigurationErrors({
    aliases: [
      { from: "left", to: "right" },
      { from: "right", to: "left" },
    ],
  });

  assert.ok(cycled.some((error) => error.code === "alias-cycle"));
});

test("relationships are navigation and not a merge", () => {
  const { communities } = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        declared_topics: [
          {
            slug: "privacy",
            label: "Privacy",
            evidence_class: "declared",
            community_eligible: true,
            evidence: [],
          },
          {
            slug: "surveillance",
            label: "Surveillance",
            evidence_class: "declared",
            community_eligible: true,
            evidence: [],
          },
        ],
        subject_signals: [],
      },
    ],
    {
      aliasesDoc: {
        relationships: [
          { from: "privacy", to: "surveillance", kind: "related" },
        ],
      },
    },
  );
  const slugs = communities.map((topic) => topic.slug).sort();

  assert.deepEqual(slugs, ["privacy", "surveillance"]);
  assert.deepEqual(
    communities.find((topic) => topic.slug === "privacy").relationships.related,
    ["surveillance"],
  );

  const direct = buildTopicCommunities(
    [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        declared_topics: [
          {
            slug: "privacy",
            label: "Privacy",
            evidence_class: "declared",
            community_eligible: true,
            evidence: [],
          },
        ],
        subject_signals: [],
      },
    ],
    {
      relations: [
        null,
        { from: "privacy", to: "security", kind: "broader" },
        { from: "surveillance", to: "privacy", kind: "related" },
      ],
    },
  );

  assert.deepEqual(direct.communities[0].relationships.broader, ["security"]);
  assert.deepEqual(direct.communities[0].relationships.related, [
    "surveillance",
  ]);
});

test("old slugs get a compatibility page instead of a second hub", () => {
  const page = aliasCompatibilityMarkdown("Postgres", "PostgreSQL");

  assert.match(page, /permalink: \/topics\/postgres\//);
  assert.match(page, /\/topics\/postgresql\//);
  assert.match(page, /joshternet_analysis: derived/);
});

test("rejection reasons and sensitive topics do not assert identity", () => {
  assert.equal(
    heuristicRejectionReason({ boilerplate: true }),
    "site-boilerplate",
  );
  assert.equal(
    heuristicRejectionReason({ sensitive: true }),
    "sensitive-attribute",
  );
  assert.equal(
    heuristicRejectionReason({ contextual: false }),
    "insufficient-context",
  );
  assert.equal(heuristicRejectionReason({ slug: "a" }), "invalid-phrase");
  assert.equal(
    heuristicRejectionReason({ slug: "photography" }),
    "low-subject-relevance",
  );
  assert.equal(heuristicRejectionReason(), "invalid-phrase");
  assert.equal(allowsAmbiguousUnigram(undefined, "go"), false);
  assert.equal(topicRelations({}).length, 0);
  const evidence = buildTopicEvidence({
    rawValue: "Agents",
    source: "rss:category",
    evidenceClass: "declared",
  });

  assert.equal(evidence.slug, "agent");
  assert.ok(evidence.transformations.includes("plural-fold"));
  assert.equal(evidence.raw_value, "Agents");
  assert.equal("identity" in evidence, false);
  assert.equal(
    buildTopicEvidence({
      rawValue: "notes",
      source: "rss:category",
    }),
    null,
  );
});

test("non-English pages keep declarations and skip English heuristic assumptions", () => {
  assert.equal(isEnglishLanguage("fr"), false);
  assert.equal(isEnglishLanguage(""), true);
  const subjects = subjectsFromHtml(
    `<html lang="fr"><body><meta property="article:tag" content="Jardinage"></body></html>`,
    "https://a.example/fr",
  );

  assert.ok(subjects.some((subject) => subject.slug === "jardinage"));
  assert.equal(subjects[0].evidence_class === "heuristic", false);
});

test("malformed text stays bounded", () => {
  const regions = parseHtmlRegions("<html><<<<<<main>" + "x".repeat(50));

  assert.equal(typeof regions.prose, "string");
  assert.deepEqual(
    extractTopicsFromPages([
      { url: "https://a.example/x", title: "", text: "@@@@" },
    ]),
    [],
  );
});

test("a failed origin records the error and keeps an empty signal", () => {
  const recorded = originFailureSignal(
    "https://down.example",
    "2026-01-01T00:00:00.000Z",
    new Error("timeout"),
  );

  assert.equal(recorded.error, "timeout");
  assert.deepEqual(recorded.declared_topics, []);
  assert.equal(
    originFailureSignal(
      "https://down.example",
      "2026-01-01T00:00:00.000Z",
      "invalid xml",
    ).error,
    "invalid xml",
  );
});

test("repeated community builds from the same input match", () => {
  const input = [
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      declared_topics: [
        {
          slug: "photography",
          label: "Photography",
          evidence_class: "declared",
          community_eligible: true,
          evidence: [],
        },
      ],
      subject_signals: [],
    },
  ];
  const options = { now: "2026-01-01T00:00:00.000Z" };

  assert.equal(
    semanticallyEqual(
      buildTopicCommunities(input, options),
      buildTopicCommunities(input, options),
    ),
    true,
  );
});

test("topic quality report rejects broken aliases, artifacts, and phantom links", () => {
  const report = topicQualityReport({
    topics: {
      communities: [
        {
          slug: "page",
          sites: [],
        },
        {
          slug: "1999",
          sites: [
            null,
            { membership: "heuristic", pages: [], origin: "https://a.example" },
            { membership: "heuristic" },
          ],
          identity: true,
        },
        {
          slug: "privacy",
          sites: [
            {
              membership: "heuristic",
              pages: [{ url: "https://a.example/p" }],
              origin: "https://a.example",
            },
            { membership: "declared", pages: [] },
          ],
        },
      ],
    },
    content: {
      items: [
        null,
        { url: "not a url", site_origin: "https://a.example" },
        {
          url: "https://b.example/post",
          site_origin: "https://a.example",
        },
        {
          url: "https://b.example/home",
          site_origin: "https://b.example",
        },
        {
          url: "https://outside.example/post",
          site_origin: "https://a.example",
        },
      ],
    },
    aliasesDoc: {
      aliases: [
        { from: "left", to: "right" },
        { from: "right", to: "left" },
      ],
    },
    searchUrls: ["/topics/missing/", "/notes/privacy/"],
    previousTopics: {
      communities: Array.from({ length: 10 }, (_item, index) => ({
        slug: `old-${index}`,
      })),
    },
  });

  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === "alias-cycle"));
  assert.ok(
    report.errors.some((error) => error.code === "invalid-public-topic"),
  );
  assert.ok(report.errors.some((error) => error.code === "sensitive-identity"));
  assert.ok(
    report.errors.some((error) => error.code === "heuristic-without-evidence"),
  );
  assert.ok(
    report.errors.some((error) => error.code === "cross-origin-content"),
  );
  assert.ok(report.errors.some((error) => error.code === "phantom-topic-link"));
  assert.equal(topicQualityReport({ topics: null, content: null }).ok, true);
  assert.equal(
    topicQualityReport({
      topics: {
        communities: [
          {
            slug: "privacy",
            sites: "nope",
          },
        ],
      },
      content: {
        items: [
          { site_origin: "https://a.example" },
          { url: "https://a.example/own" },
          {
            url: "https://a.example/own-post",
            site_origin: "https://a.example",
          },
        ],
      },
      searchUrls: ["/topics/privacy/"],
    }).ok,
    true,
  );
  assert.ok(
    topicDiff({ communities: [] }, { communities: [] }).added.length === 0,
  );
  assert.deepEqual(
    topicDiff(null, { communities: [{ slug: "ai" }] }).added,
    [],
  );
  const previousList = Array.from({ length: 10 }, (_item, index) => ({
    slug: `t${index}`,
  }));
  assert.match(
    topicDiff(previousList, { communities: [{ slug: "t0" }] }).review[0],
    /fell from 10 to 1/,
  );

  const shrunk = topicDiff(
    {
      communities: Array.from({ length: 10 }, (_item, index) => ({
        slug: `t-${index}`,
      })),
    },
    { communities: [{ slug: "t-0" }] },
  );

  const mergedDiff = topicDiff(
    { communities: [{ slug: "postgres" }, { slug: "agents" }] },
    { communities: [{ slug: "postgresql" }, { slug: "agent" }] },
    {
      aliases: [{ from: "postgres", to: "postgresql", kind: "equivalent" }],
    },
  );
  assert.deepEqual(mergedDiff.merged, [{ from: "postgres", to: "postgresql" }]);
  assert.deepEqual(mergedDiff.renamed, [{ from: "agents", to: "agent" }]);
  assert.deepEqual(mergedDiff.added, []);
  assert.deepEqual(mergedDiff.removed, []);
  const broaderDiff = topicDiff(
    { communities: [{ slug: "agents" }, { slug: "privacy" }] },
    { communities: [{ slug: "agent" }, { slug: "surveillance" }] },
    {
      aliases: [{ from: "privacy", to: "surveillance", kind: "broader" }],
    },
  );
  assert.deepEqual(broaderDiff.renamed, [{ from: "agents", to: "agent" }]);
  assert.deepEqual(broaderDiff.merged, []);
  assert.deepEqual(broaderDiff.added, ["surveillance"]);
  assert.deepEqual(broaderDiff.removed, ["privacy"]);
  assert.deepEqual(
    topicDiff(
      { communities: [{ slug: "postgres" }] },
      { communities: [{ slug: "design" }] },
      {
        aliases: [{ from: "postgres", to: "postgresql", kind: "equivalent" }],
      },
    ).merged,
    [],
  );
  const repeated = topicQualityReport({
    topics: {
      communities: [
        { slug: "page", sites: [] },
        { slug: "page", sites: [] },
      ],
    },
  });
  assert.equal(
    repeated.rejections.find((row) => row.code === "invalid-public-topic")
      ?.count,
    2,
  );
  assert.ok(shrunk.review.length > 0);
  assert.ok(report.diff.review.some((line) => line.includes("fell")));
  const grew = topicDiff(
    {
      communities: Array.from({ length: 10 }, (_item, index) => ({
        slug: `old-${index}`,
      })),
    },
    {
      communities: Array.from({ length: 16 }, (_item, index) => ({
        slug: `new-${index}`,
      })),
    },
  );

  assert.ok(grew.review.some((line) => line.includes("rose")));
});

test("fair article lists rotate publishers", () => {
  const items = [
    { site_origin: "https://b.example", url: "https://b.example/1" },
    { site_origin: "https://b.example", url: "https://b.example/2" },
    { site_origin: "https://a.example", url: "https://a.example/1" },
    null,
    { url: "https://a.example/loose" },
    1,
  ];
  const fair = fairTopicArticles(items, 3);

  assert.equal(fair[0].url, "https://a.example/loose");
  assert.equal(fair[1].site_origin, "https://a.example");
  assert.equal(fair[2].site_origin, "https://b.example");
  assert.deepEqual(fairTopicArticles(null, 3), []);
  assert.equal(fairTopicArticles(items, 0).length, 0);
  assert.ok(fairTopicArticles(items, 10).length >= 4);
});
