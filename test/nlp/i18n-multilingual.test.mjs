/**
 * Goal: Offline multilingual fixtures for language tags, feed language,
 * declared non-Latin topics, and Unicode search — no live registry oracle.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { slugifyTopic } from "../../scripts/network/connections.mjs";
import { canonicalOrigin } from "../../scripts/network/lib.mjs";
import {
  contentItemsFromJsonFeed,
  contentItemsFromRssOrAtom,
} from "../../scripts/nlp/content.mjs";
import { buildTopicEvidence } from "../../scripts/nlp/evidence.mjs";
import { textMentionsSlug } from "../../scripts/nlp/match.mjs";
import {
  isEnglishLanguage,
  normalizeLanguageTag,
  parseHtmlRegions,
} from "../../scripts/nlp/text.mjs";
import {
  buildActivityAtomXml,
  searchTokens,
  scoreSearchDocument,
} from "../../scripts/views/lib.mjs";
import { truncateLabel } from "../../scripts/nlp/unicode-text.mjs";

test("parseHtmlRegions: quoted and unquoted lang normalize to BCP 47", () => {
  assert.equal(
    parseHtmlRegions(`<html lang="fr-CA"><title>x</title></html>`).lang,
    "fr-ca",
  );
  assert.equal(
    parseHtmlRegions(`<!doctype html><html lang=ja><body>x</body></html>`).lang,
    "ja",
  );
  assert.equal(parseHtmlRegions(`<html><body>x</body></html>`).lang, "");
});

test("missing language is not English for heuristics", () => {
  assert.equal(isEnglishLanguage(""), false);
  assert.equal(isEnglishLanguage("ja"), false);
  assert.equal(isEnglishLanguage("en-GB"), true);
});

test("RSS channel language and Atom xml:lang propagate to items", () => {
  const rss = contentItemsFromRssOrAtom(
    `<?xml version="1.0"?>
     <rss version="2.0"><channel>
       <language>de-DE</language>
       <item>
         <title>Hallo</title>
         <link>https://de.example/post/</link>
         <guid>https://de.example/post/</guid>
         <category>Gärten</category>
       </item>
     </channel></rss>`,
    {
      feedUrl: "https://de.example/feed.xml",
      feedKind: "rss",
      siteOrigin: "https://de.example",
      observedAt: "2026-10-31T00:00:00.000Z",
    },
  );

  assert.equal(rss[0].language, "de-de");
  assert.equal(rss[0].title, "Hallo");
  assert.ok(rss[0].declared_topics.some((topic) => topic.label === "Gärten"));

  const atom = contentItemsFromRssOrAtom(
    `<?xml version="1.0"?>
     <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">
       <entry xml:lang="ja">
         <title>記事</title>
         <id>https://ja.example/1</id>
         <link href="https://ja.example/1"/>
         <updated>2026-10-31T00:00:00Z</updated>
         <category term="プログラミング"/>
       </entry>
     </feed>`,
    {
      feedUrl: "https://ja.example/atom.xml",
      feedKind: "atom",
      siteOrigin: "https://ja.example",
      observedAt: "2026-10-31T00:00:00.000Z",
    },
  );

  assert.equal(atom[0].language, "ja");
  assert.equal(atom[0].title, "記事");
  const jp = atom[0].declared_topics.find(
    (topic) => topic.label === "プログラミング",
  );
  assert.ok(jp);
  assert.match(jp.slug, /^u-[a-f0-9]{12}$/);
});

test("JSON Feed item language preferred over feed language", () => {
  const items = contentItemsFromJsonFeed(
    JSON.stringify({
      version: "https://jsonfeed.org/version/1.1",
      language: "en",
      items: [
        {
          id: "1",
          url: "https://mixed.example/a",
          title: "Bonjour",
          language: "fr",
        },
      ],
    }),
    {
      feedUrl: "https://mixed.example/feed.json",
      siteOrigin: "https://mixed.example",
      observedAt: "2026-10-31T00:00:00.000Z",
    },
  );

  assert.equal(items[0].language, "fr");
});

test("CJK declared evidence keeps Unicode label with hashed slug", () => {
  const evidence = buildTopicEvidence({
    rawValue: "人工智能",
    source: "json-ld:knowsAbout",
    page: "https://zh.example/",
    evidenceClass: "declared",
    communityEligible: true,
    observedAt: "2026-10-31T00:00:00.000Z",
  });

  assert.ok(evidence);
  assert.equal(evidence.value, "人工智能");
  const expected = `u-${createHash("sha256").update("人工智能").digest("hex").slice(0, 12)}`;
  assert.equal(evidence.slug, expected);
  assert.equal(slugifyTopic("人工智能"), expected);
});

test("Unicode search tokens score original-language titles", () => {
  assert.deepEqual(searchTokens("日本語"), ["日本語"]);
  assert.deepEqual(searchTokens("café"), ["café"]);

  const score = scoreSearchDocument("日本語", {
    type: "content",
    title: "日本語の記事",
    summary: "概要",
    domain: "ja.example",
    topics: ["プログラミング"],
  });

  assert.ok(score > 0);

  const accent = scoreSearchDocument("café", {
    type: "content",
    title: "Café notes",
    summary: "",
    domain: "fr.example",
    topics: [],
  });

  assert.ok(accent > 0);

  const english = scoreSearchDocument("wander", {
    type: "content",
    title: "Wander the network",
    summary: "",
    domain: "en.example",
    topics: [],
  });

  assert.ok(english > 0);
});

test("textMentionsSlug matches Unicode labels with Unicode boundaries", () => {
  assert.equal(
    textMentionsSlug(
      "今日はプログラミングについて",
      "ignored",
      "プログラミング",
    ),
    true,
  );
  assert.equal(
    textMentionsSlug("Hello gardening world", "gardening", "Gardening"),
    true,
  );
});

test("canonicalOrigin accepts IDN Unicode form and returns ACE", () => {
  const ace = canonicalOrigin("https://xn--bcher-kva.example");
  assert.equal(ace, "https://xn--bcher-kva.example");

  // Node URL parser ACE-encodes U-labels; either spelling must yield one origin.
  const unicodeHost = "bücher.example";
  let unicodeOrigin = "";

  try {
    unicodeOrigin = new URL(`https://${unicodeHost}`).origin;
  } catch {
    unicodeOrigin = "";
  }

  if (unicodeOrigin) {
    assert.equal(canonicalOrigin(unicodeOrigin), unicodeOrigin);
    assert.equal(canonicalOrigin(`https://${unicodeHost}`), unicodeOrigin);
  }
});

test("Atom feed includes xml:lang when language is known", () => {
  const xml = buildActivityAtomXml({
    generated_at: "2026-10-31T12:00:00.000Z",
    primary: [
      {
        url: "https://ja.example/post/",
        title: "記事",
        summary: "要約",
        language: "ja",
        site_title: "JA",
        site_origin: "https://ja.example",
        published_at: "2026-10-30T00:00:00.000Z",
      },
    ],
  });

  assert.match(xml, /<entry xml:lang="ja">/);
  assert.match(xml, /<title xml:lang="ja">記事<\/title>/);
  assert.match(xml, /<summary xml:lang="ja">要約<\/summary>/);
});

test("truncateLabel splits by grapheme not UTF-16 code units", () => {
  assert.equal(truncateLabel("日本語テスト", 3), "日本…");
  assert.equal(truncateLabel("👨‍👩‍👧‍👦x", 1), "…");

  const original = Intl.Segmenter;
  // Cover the code-point fallback when Segmenter is unavailable.
  // eslint-disable-next-line no-global-assign -- test isolation only
  delete Intl.Segmenter;

  try {
    assert.equal(truncateLabel("abcdefgh", 4), "abc…");
  } finally {
    Intl.Segmenter = original;
  }
});

test("normalizeLanguageTag rejects malformed tags", () => {
  assert.equal(normalizeLanguageTag("en_US"), "en-us");
  assert.equal(normalizeLanguageTag("123"), "");
  assert.equal(normalizeLanguageTag("toolonglanguageprimary"), "");
});

test("Atom entry lang= without xml: prefix and category body/label", () => {
  const items = contentItemsFromRssOrAtom(
    `<?xml version="1.0"?>
     <feed xmlns="http://www.w3.org/2005/Atom">
       <entry lang="it">
         <title>Ciao</title>
         <id>https://it.example/1</id>
         <link href="https://it.example/1"/>
         <updated>2026-10-31T00:00:00Z</updated>
         <category label="Giardino"/>
         <category>Viaggio</category>
         <category term="   "/>
         <category></category>
       </entry>
     </feed>`,
    {
      feedUrl: "https://it.example/atom.xml",
      feedKind: "atom",
      siteOrigin: "https://it.example",
      observedAt: "2026-10-31T00:00:00.000Z",
    },
  );

  assert.equal(items[0].language, "it");
  const labels = items[0].declared_topics.map((topic) => topic.label).sort();
  assert.deepEqual(labels, ["Giardino", "Viaggio"]);
});

test("joinContentWithPageSignals drops invalid page lang", async () => {
  const { joinContentWithPageSignals } =
    await import("../../scripts/nlp/content.mjs");
  const joined = joinContentWithPageSignals(
    [
      {
        url: "https://x.example/a",
        language: "!!!",
        declared_topics: [],
        summary: "",
      },
    ],
    [
      {
        origin: "https://x.example",
        pages: [
          {
            url: "https://x.example/a",
            lang: "not a tag",
            page_role: "article",
          },
        ],
        declared_topics: [],
      },
    ],
  );

  assert.equal(joined[0].language, null);
});
