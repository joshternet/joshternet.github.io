/**
 * Goal: Past events stay out of the upcoming calendar. Date-only values
 * do not gain a clock time. Talks are a Showcase kind, directories are not.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEventIcs,
  buildHappeningItems,
  buildPastEventItems,
  buildViewDocuments,
  compactContentItem,
  isMadeContentItem,
  isNamedRootCreativeProduct,
  showcaseKind,
  showcaseKindForItem,
} from "../../scripts/views/lib.mjs";

const now = new Date("2026-11-05T18:00:00.000Z");

test("date-only events split into upcoming, happening today, and past", () => {
  const items = [
    {
      content_type: "event",
      url: "https://a.example/speaking/#future",
      title: "FutureConf",
      start: "2026-12-02",
      start_precision: "date",
      attribution_role: "presented",
    },
    {
      content_type: "event",
      url: "https://a.example/speaking/#today",
      title: "TodayConf",
      start: "2026-11-05",
      attribution_role: "presented",
    },
    {
      content_type: "event",
      url: "https://a.example/speaking/#span",
      title: "SpanConf",
      start: "2026-11-01",
      end: "2026-11-06",
      start_precision: "date",
      attribution_role: "hosted",
    },
    {
      content_type: "event",
      url: "https://a.example/speaking/#past",
      title: "Boston Code Camp 40",
      start: "2026-03-28",
      start_precision: "date",
      attribution_role: "presented",
    },
    {
      content_type: "event",
      url: "https://a.example/speaking/#older",
      title: "OlderConf",
      start: "2025-05-22",
      attribution_role: "presented",
    },
  ];

  const happening = buildHappeningItems(items, now);
  const past = buildPastEventItems(items, now);

  assert.deepEqual(
    happening.map((item) => item.title),
    ["SpanConf", "TodayConf", "FutureConf"],
  );
  assert.deepEqual(
    past.map((item) => item.title),
    ["Boston Code Camp 40", "OlderConf"],
  );
  assert.equal(
    happening.some((item) => item.start === "2026-03-28"),
    false,
  );
});

test("buildPastEventItems rejects invalid clocks, mentions, and ties on url", () => {
  assert.deepEqual(buildPastEventItems([], "not-a-date"), []);
  assert.deepEqual(buildPastEventItems(null, now), []);

  const tied = buildPastEventItems(
    [
      {
        content_type: "event",
        url: "https://a.example/b",
        title: "B",
        start: "2020-01-02T00:00:00Z",
      },
      {
        content_type: "event",
        url: "https://a.example/a",
        title: "A",
        start: "2020-01-02T00:00:00Z",
      },
      {
        content_type: "event",
        url: "https://a.example/mention",
        title: "Mention",
        start: "2020-01-01",
        attribution_role: "mention",
      },
      {
        content_type: "event",
        url: "https://joshternet.org/events/hub",
        title: "Hub",
        start: "2020-01-01",
      },
      {
        content_type: "event",
        url: "https://a.example/chrome",
        title: ", 2026 · 2 min read Enterprise sales teams",
        start: "2020-01-01",
        attribution_role: "presented",
      },
      {
        content_type: "event",
        url: "https://a.example/year-crumb",
        title: ", 2026",
        start: "2020-01-01",
        attribution_role: "presented",
      },
    ],
    now,
  );

  assert.deepEqual(
    tied.map((item) => item.url),
    ["https://a.example/a", "https://a.example/b"],
  );
});

test("buildEventIcs emits VALUE=DATE and keeps timed events timed", () => {
  const ics = buildEventIcs([
    {
      identity: "event:https://a.example:future:2026-12-02",
      url: "https://a.example/speaking/",
      title: "FutureConf",
      start: "2026-12-02",
      end: "2026-12-03",
      start_precision: "date",
      site_title: "Member",
    },
    {
      url: "https://a.example/events/show/",
      title: "Show",
      start: "2026-12-01T20:00:00-05:00",
      site_origin: "https://a.example",
    },
    {
      start: "nope",
      title: "Bad",
    },
    {
      start_precision: "date",
      start: "not-a-date",
      title: "Also bad",
    },
  ]);

  assert.match(ics, /DTSTART;VALUE=DATE:20261202/);
  assert.match(ics, /DTEND;VALUE=DATE:20261203/);
  assert.match(
    ics,
    /UID:event%3Ahttps%3A%2F%2Fa\.example%3Afuture%3A2026-12-02@joshternet\.org/,
  );
  assert.match(ics, /DTSTART:20261202T010000Z/);
  assert.doesNotMatch(ics, /DTSTART:20261202T000000Z/);
  assert.doesNotMatch(ics, /SUMMARY:Bad/);
});

test("compact content keeps presentation links and talk kind", () => {
  const compact = compactContentItem(
    {
      identity: "presentation:https://a.example:linter",
      url: "https://a.example/speaking/",
      title: "How to Learn to Love the Linter",
      summary: "",
      site_origin: "https://a.example",
      content_type: "presentation",
      start: "2026-03-28",
      start_precision: "date",
      conference: "Boston Code Camp 40",
      resources: [{ kind: "slides", url: "https://slides.example/linter" }],
      related: [{ id: "event:1", relation: "presented-at" }],
    },
    new Map(),
    [],
  );

  assert.equal(compact.conference, "Boston Code Camp 40");
  assert.equal(compact.start_precision, "date");
  assert.equal(compact.identity, "presentation:https://a.example:linter");
  assert.equal(compact.resources.length, 1);
  assert.equal(compact.related.length, 1);
  assert.equal(showcaseKind("presentation"), "talks");
  assert.equal(showcaseKindForItem(compact), "talks");
});

test("directory indexes are not showcase products", () => {
  const directories = [
    ["https://joshozuna.com/collections", "collections"],
    ["https://joshozuna.com/html-sitemap", "joshozuna.com links"],
    ["https://joshuastuebner.com/tools/", "Tools"],
    ["https://member.example/speaking/", "Speaking"],
  ];

  for (const [url, title] of directories) {
    assert.equal(
      isMadeContentItem({
        content_type: "project",
        url,
        title,
        summary: "A directory of several works on this site.",
        image: "https://cdn.example/cover.jpg",
        source: { kind: "creative-schema" },
      }),
      false,
      url,
    );
  }

  assert.equal(
    isNamedRootCreativeProduct({
      url: "https://joshuakim.studio/mystery",
      title: "No matching product name here",
      source: { kind: "creative-schema" },
    }),
    false,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://joshtronic.com/games/river-of-doom/",
      title: "River City DOOM!!!",
      summary: "A game.",
      image: "https://cdn.example/doom.jpg",
      published_at: "2026-06-01T00:00:00.000Z",
    }),
    true,
  );
});

test("view documents keep past events beside an empty upcoming list", () => {
  const views = buildViewDocuments({
    network: [
      {
        origin: "https://a.example",
        domain: "a.example",
        title: "A",
        description: "",
      },
    ],
    content: {
      items: [
        {
          identity: "event:https://a.example:one:2024-01-01",
          url: "https://a.example/events/one/",
          title: "One",
          summary: "First",
          site_origin: "https://a.example",
          content_type: "event",
          start: "2024-01-01",
          start_precision: "date",
          attribution_role: "hosted",
        },
        {
          identity: "event:https://a.example:two:2025-06-01",
          url: "https://a.example/events/two/",
          title: "Two",
          summary: "Second",
          site_origin: "https://a.example",
          content_type: "event",
          start: "2025-06-01",
          start_precision: "date",
          attribution_role: "hosted",
        },
      ],
    },
    topics: { communities: [] },
    connections: { edges: [] },
    siteSignals: { origins: [] },
    generatedAt: "2026-11-05T18:00:00.000Z",
    now,
  });

  assert.equal(views.happening.item_count, 0);
  assert.equal(views.past_events.item_count, 2);
  assert.equal(views.past_events.group_by_year, true);
  assert.equal(views.past_events.items[0].title, "Two");
});
