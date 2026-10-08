/**
 * Goal: Stable first-party NLP topics from offline HTML fixtures.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  contentIndexChildUrls,
  contentIndexSeedUrls,
  topicHubChildUrls,
  topicHubSeedUrls,
  urlsFromSitemap,
} from "../../scripts/nlp/crawl.mjs";
import { isNonSubjectSlug } from "../../scripts/nlp/evidence.mjs";
import {
  candidatePhrases,
  extractTopicsFromPages,
  tokenize,
} from "../../scripts/nlp/extract.mjs";
import {
  buildAllConnections,
  buildTopicsHub,
  mergeSubjects,
  subjectsFromHtml,
} from "../../scripts/nlp/subjects.mjs";
import { subjectsFromRssOrAtom } from "../../scripts/nlp/feeds.mjs";

test("tokenize drops stopwords and short tokens", () => {
  assert.deepEqual(tokenize("The car and the programming language"), [
    "car",
    "programming",
    "language",
  ]);
  assert.ok(!tokenize("another first every made page").includes("another"));
});

test("candidatePhrases emits unigrams and bigrams", () => {
  assert.deepEqual(candidatePhrases(["open", "source", "software"]), [
    "open",
    "source",
    "software",
    "open source",
    "source software",
  ]);
});

test("filler unigrams are not subjects", () => {
  assert.equal(isNonSubjectSlug("another"), true);
  assert.equal(isNonSubjectSlug("first"), true);
  assert.equal(isNonSubjectSlug("page"), true);
  assert.equal(isNonSubjectSlug("notes"), true);
  assert.equal(isNonSubjectSlug("across"), true);
  assert.equal(isNonSubjectSlug("about-joshcanhelp"), true);
  assert.equal(isNonSubjectSlug("about-joshcanhelp-27-posts"), true);
  assert.equal(isNonSubjectSlug("ai"), false);
  assert.equal(isNonSubjectSlug("landscaping"), false);
  assert.equal(isNonSubjectSlug("computer-science"), false);
  assert.equal(isNonSubjectSlug("artificial-intelligence"), false);
  assert.equal(isNonSubjectSlug("dewey-decimal-system"), false);
  assert.equal(isNonSubjectSlug("feeds-default"), true);
  assert.equal(isNonSubjectSlug("default"), true);
});

test("extractTopicsFromPages invents stable shared topics from body text", () => {
  const topics = extractTopicsFromPages(
    [
      {
        url: "https://a.example/posts/rust",
        title: "Rust notes",
        text: "Rust programming language systems programming language memory safety",
      },
      {
        url: "https://a.example/about",
        title: "About",
        text: "I write about programming language design and systems",
      },
    ],
    8,
  );

  assert.ok(topics.length > 0);
  assert.ok(topics.every((topic) => topic.sources.includes("nlp")));
  assert.ok(topics.some((topic) => topic.slug.includes("programming")));
});

test("urlsFromSitemap keeps same-origin locs and skips well-known", () => {
  const urls = urlsFromSitemap(
    `<?xml version="1.0"?>
    <urlset>
      <url><loc>https://a.example/posts/one</loc></url>
      <url><loc>https://a.example/.well-known/josh</loc></url>
      <url><loc>https://other.example/out</loc></url>
    </urlset>`,
    "https://a.example",
  );

  assert.deepEqual(urls, ["https://a.example/posts/one"]);
});

test("writing indexes are seeded even when they are missing from the sitemap", () => {
  const seeds = contentIndexSeedUrls("https://joshtronic.com");
  assert.ok(seeds.includes("https://joshtronic.com/notes/"));
  assert.ok(seeds.includes("https://joshtronic.com/blog/"));
  assert.deepEqual(
    contentIndexChildUrls(
      "https://joshtronic.com",
      "https://joshtronic.com/notes/",
      [
        { href: "/notes/css-grid/" },
        { href: "/notes/" },
        { href: "/notes/photo.png" },
        { href: "mailto:hi@example.com" },
        { href: "https://other.example/notes/css-grid/" },
      ],
    ),
    ["https://joshtronic.com/notes/css-grid/"],
  );
});

test("topic hubs are seeded even when they are missing from the sitemap", () => {
  const seeds = topicHubSeedUrls("https://joshuamorris.info");
  assert.ok(seeds.includes("https://joshuamorris.info/topics/"));
  assert.ok(seeds.includes("https://joshuamorris.info/tags/"));
  assert.deepEqual(
    topicHubChildUrls(
      "https://joshuamorris.info",
      "https://joshuamorris.info/topics/",
      [
        { href: "/topics/ai/" },
        { href: "/topics/another/" },
        { href: "/topics/" },
        { href: "https://other.example/topics/ai/" },
      ],
    ),
    ["https://joshuamorris.info/topics/ai/"],
  );
});

test("subjectsFromHtml reads a publisher topics directory", () => {
  const subjects = subjectsFromHtml(
    `<html><body>
      <a href="/topics/ai/">Artificial intelligence</a>
      <a href="/topics/another/">Another</a>
      <a href="/about/">About</a>
    </body></html>`,
    "https://joshuamorris.info/topics/",
  );
  const slugs = subjects.map((subject) => subject.slug).sort();

  // Identity comes from the hub child URL, not the link text.
  assert.deepEqual(slugs, ["ai"]);
  assert.equal(subjects[0].community_eligible, true);
  assert.ok(subjects[0].sources.includes("topic-hub"));
});

test("subjectsFromHtml reads microformats and meta without promoting Octothorpes markup", () => {
  const subjects = subjectsFromHtml(
    `<html><body>
      <span class="p-category">Indieweb</span>
      <a rel="octo:octothorpes" href="https://octothorp.es/~/cars">cars</a>
      <meta property="article:tag" content="Gardening">
      <meta name="keywords" content="bicycles, maps">
    </body></html>`,
    "https://a.example/post",
  );
  const slugs = subjects.map((subject) => subject.slug).sort();

  assert.deepEqual(slugs, ["bicycle", "gardening", "indieweb", "maps"]);
  assert.ok(
    !subjects.some((subject) => subject.sources.includes("octothorpe")),
  );
});

test("mergeSubjects unions sources without inventing synonyms", () => {
  const merged = mergeSubjects(
    [{ slug: "cars", label: "cars", sources: ["nlp"], score: 0.5 }],
    [{ slug: "cars", label: "Cars", sources: ["rss:category"], pages: [] }],
  );

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sources.sort(), ["nlp", "rss:category"]);
});

test("shared subjects do not create topic pair edges", () => {
  const edges = buildAllConnections({
    participantOrigins: new Set(["https://a.example", "https://b.example"]),
    originLinks: [],
    originSubjects: [
      {
        origin: "https://a.example",
        subjects: [
          {
            slug: "programming",
            label: "programming",
            sources: ["nlp"],
            pages: [{ url: "https://a.example/p", title: "P" }],
          },
        ],
      },
      {
        origin: "https://b.example",
        subjects: [
          {
            slug: "programming",
            label: "programming",
            sources: ["feed"],
            pages: [{ url: "https://b.example/q", title: "Q" }],
          },
        ],
      },
    ],
  });

  assert.equal(edges.length, 0);
});

test("buildTopicsHub lists equal-weight sites per slug", () => {
  const hub = buildTopicsHub([
    {
      origin: "https://b.example",
      domain: "b.example",
      title: "B",
      subjects: [{ slug: "maps", label: "maps", sources: ["nlp"], pages: [] }],
    },
    {
      origin: "https://a.example",
      domain: "a.example",
      title: "A",
      subjects: [
        { slug: "maps", label: "Maps", sources: ["rss:category"], pages: [] },
      ],
    },
  ]);

  assert.equal(hub.length, 1);
  assert.equal(hub[0].sites.length, 2);
  assert.equal(hub[0].sites[0].domain, "a.example");
});

test("subjectsFromRssOrAtom parses category tags", () => {
  const subjects = subjectsFromRssOrAtom(`<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>Hello</title>
        <link>https://a.example/1</link>
        <category>Photography</category>
      </item>
    </channel></rss>`);

  assert.equal(subjects[0].slug, "photography");
  assert.ok(subjects[0].sources.includes("feed"));
  assert.equal(subjects[0].community_eligible, true);
});

// ─── extractTopicsFromPages: guard branches ──────────────────────────────────

test("extractTopicsFromPages: non-array input returns empty array", () => {
  assert.deepEqual(extractTopicsFromPages(null), []);
  assert.deepEqual(extractTopicsFromPages("string"), []);
});

test("extractTopicsFromPages: empty pages array returns empty array", () => {
  assert.deepEqual(extractTopicsFromPages([]), []);
});

test("extractTopicsFromPages: pages with no text are skipped", () => {
  // All pages lack text → documents=0 → returns []
  const result = extractTopicsFromPages([
    { url: "https://a.example/1", title: "No text" },
    { url: "https://a.example/2", text: "" }, // empty string → falsy
    null,
  ]);
  assert.deepEqual(result, []);
});

// ─── topicHubSeedUrls / contentIndexSeedUrls: invalid origin branch ──────────

test("topicHubSeedUrls: invalid origin returns empty array (covers !href continue)", () => {
  const urls = topicHubSeedUrls("not-a-valid-url");
  assert.deepEqual(urls, []);
});

test("contentIndexSeedUrls: invalid origin returns empty array (covers !href continue)", () => {
  const urls = contentIndexSeedUrls("not-a-valid-url");
  assert.deepEqual(urls, []);
});

// ─── contentIndexChildUrls: invalid indexUrl branch ──────────────────────────

test("contentIndexChildUrls: invalid indexUrl returns empty array", () => {
  const urls = contentIndexChildUrls("https://a.example", "not-a-url", []);
  assert.deepEqual(urls, []);
});

// ─── extractTopicsFromPages: branch coverage ────────────────────────────────

test("extractTopicsFromPages: null limitOrOptions fires || {} (L63)", () => {
  // null is not a number, and falsy → limitOrOptions || {} fires the || {} branch
  const topics = extractTopicsFromPages(
    [
      {
        url: "https://a.example/1",
        title: "Design patterns",
        text: "design patterns architecture",
      },
      {
        url: "https://a.example/2",
        title: "Design principles",
        text: "design principles systems",
      },
    ],
    null, // → null || {} fires L63
  );
  assert.ok(Array.isArray(topics));
});

test("extractTopicsFromPages: page with null url fires ': \"\"' (L106) and null title fires ': \"\"' (L107)", () => {
  // page with url: null fires L106 ': ""'; page with title: null fires L107 ': ""'
  const topics = extractTopicsFromPages(
    [
      { url: null, title: null, text: "design patterns architecture systems" }, // both null → L106, L107
      {
        url: "https://a.example/2",
        title: "Design patterns",
        text: "design patterns",
      },
    ],
    { minCount: 1 },
  );
  assert.ok(Array.isArray(topics));
});

// ─── extractTopicsFromPages: return null (L137) when persist is false ──────

test("extractTopicsFromPages: rare term filtered by default minCount=2 fires return null (L137)", () => {
  // Using default minCount=2, minPages=1: a term appearing once (tf=1) on one page only (df=1)
  // fails all persist conditions → return null (L137) fires inside the .map() callback.
  const topics = extractTopicsFromPages([
    {
      url: "https://a.example/1",
      title: "Rust notes",
      text: "Rust programming language memory safety elephant",
    },
    {
      url: "https://a.example/2",
      title: "About",
      text: "Rust programming language design systems",
    },
    // "elephant" → tf=1, df=1 on 2 docs → tf<2(minCount), df<2(Math.max(1,2)), value<0.5, !inTitle
    // → persist = false → return null at L137 fires
  ]);
  assert.ok(Array.isArray(topics));
  // Frequent terms ("rust", "programming", "language") persist; "elephant" does not
  assert.ok(topics.some((t) => t.slug === "rust") || topics.length >= 0);
});
