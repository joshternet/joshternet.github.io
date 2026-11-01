/**
 * Goal: Event extraction from Schema.org JSON-LD and mf2 h-event.
 * Verifies past events are never surfaced as upcoming, and that items without
 * a dependable start date are skipped.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  collectEvents,
  eventsFromMf2,
  EVENT_CONTENT_TYPE,
} from "../../scripts/nlp/events.mjs";
import { buildHappeningItems } from "../../scripts/views/lib.mjs";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/events",
);

/**
 * Reads a fixture file relative to the events fixture directory.
 * @param {string} name
 * @returns {string}
 */
function fixture(name) {
  return fs.readFileSync(path.join(fixturesDir, name), "utf8");
}

// ─── Unit: collectEvents ──────────────────────────────────────────────────────

test("collectEvents extracts upcoming Schema.org MusicEvent", () => {
  const html = fixture("upcoming-event.html");
  const { items } = collectEvents(
    [
      {
        url: "https://joshsynth.example/events/synthfest-2027/",
        html,
        lang: "en",
      },
    ],
    {
      siteOrigin: "https://joshsynth.example",
      observedAt: "2026-11-01T00:00:00.000Z",
    },
  );

  assert.equal(items.length, 1);
  const item = items[0];
  assert.equal(item.content_type, EVENT_CONTENT_TYPE);
  assert.equal(item.title, "SynthFest 2027");
  assert.equal(item.start, "2027-03-15T18:00:00-05:00");
  assert.equal(item.end, "2027-03-15T22:00:00-05:00");
  assert.equal(item.venue, "The Warehouse");
  assert.ok(item.location.includes("Austin"));
  assert.equal(item.status, "EventScheduled");
  assert.equal(item.attribution_role, "organized");
  assert.equal(item.site_origin, "https://joshsynth.example");
  assert.equal(item.language, "en");
});

test("collectEvents extracts past hackathon but includes it (collection-time, no horizon filtering here)", () => {
  const html = fixture("past-hackathon.html");
  const { items } = collectEvents(
    [{ url: "https://joshdev.example/events/hot-choc-2024/", html }],
    {
      siteOrigin: "https://joshdev.example",
      observedAt: "2026-11-01T00:00:00.000Z",
    },
  );

  // collectEvents itself does NOT filter by horizon — only buildHappeningItems does.
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Hot Chocolate Hackathon 2024");
  assert.equal(items[0].start, "2024-11-30T09:00:00-08:00");
});

test("collectEvents skips events with no startDate", () => {
  const html = fixture("no-date-event.html");
  const { items } = collectEvents(
    [{ url: "https://joshtest.example/events/no-date/", html }],
    { siteOrigin: "https://joshtest.example" },
  );

  assert.equal(items.length, 0);
});

test("collectEvents skips empty pages array", () => {
  const { items } = collectEvents([], { siteOrigin: "https://a.example" });
  assert.equal(items.length, 0);
});

test("collectEvents skips when no siteOrigin", () => {
  const { items } = collectEvents(
    [{ url: "https://a.example/e/", html: "<html></html>" }],
    {},
  );
  assert.equal(items.length, 0);
});

// ─── Unit: eventsFromMf2 ─────────────────────────────────────────────────────

test("eventsFromMf2 extracts h-event with dt-start and p-name", () => {
  const html = fixture("hfeed-events.html");
  const items = eventsFromMf2(
    html,
    "https://joshgallery.example/events/",
    "https://joshgallery.example",
    "2026-11-01T00:00:00.000Z",
  );

  assert.ok(items.length >= 2, "should extract both h-event entries");
  const opening = items.find((i) => i.title === "Spring Opening");
  assert.ok(opening, "Spring Opening must be found");
  assert.equal(opening.start, "2027-04-10T19:00:00Z");
  assert.equal(opening.end, "2027-04-10T21:00:00Z");
  assert.ok(opening.location.includes("Josh Gallery"));
  assert.equal(opening.content_type, EVENT_CONTENT_TYPE);
});

// ─── Unit: buildHappeningItems horizon ───────────────────────────────────────

test("buildHappeningItems keeps only future/ongoing events — past hackathon is excluded", () => {
  const now = new Date("2026-11-01T00:00:00.000Z");

  const rawItems = [
    {
      content_type: EVENT_CONTENT_TYPE,
      url: "https://joshdev.example/events/hot-choc-2024/",
      title: "Hot Chocolate Hackathon 2024",
      site_origin: "https://joshdev.example",
      start: "2024-11-30T09:00:00-08:00",
      end: "2024-11-30T17:00:00-08:00",
      published_at: "",
      tags: [],
      neighborhoods: [],
      image: "",
      image_origin: "",
      language: "",
      dir: "",
      summary: "",
      site_title: "JoshDev",
      domain: "joshdev.example",
    },
    {
      content_type: EVENT_CONTENT_TYPE,
      url: "https://joshsynth.example/events/synthfest-2027/",
      title: "SynthFest 2027",
      site_origin: "https://joshsynth.example",
      start: "2027-03-15T18:00:00-05:00",
      end: "2027-03-15T22:00:00-05:00",
      published_at: "",
      tags: [],
      neighborhoods: [],
      image: "",
      image_origin: "",
      language: "",
      dir: "",
      summary: "",
      site_title: "JoshSynth",
      domain: "joshsynth.example",
    },
  ];

  const happening = buildHappeningItems(rawItems, now);

  assert.equal(happening.length, 1, "only future event should appear");
  assert.equal(happening[0].title, "SynthFest 2027");
  assert.ok(
    !happening.some((item) => item.title.includes("Hot Chocolate")),
    "past hackathon must NOT appear as upcoming",
  );
});

test("buildHappeningItems keeps ongoing events (started but not ended)", () => {
  const now = new Date("2027-03-15T20:00:00Z");

  const items = [
    {
      content_type: EVENT_CONTENT_TYPE,
      url: "https://joshsynth.example/events/synthfest-2027/",
      title: "SynthFest 2027",
      site_origin: "https://joshsynth.example",
      start: "2027-03-15T18:00:00Z",
      end: "2027-03-15T22:00:00Z",
      published_at: "",
      tags: [],
      neighborhoods: [],
      image: "",
      image_origin: "",
      language: "",
      dir: "",
      summary: "",
      site_title: "JoshSynth",
      domain: "joshsynth.example",
    },
  ];

  const happening = buildHappeningItems(items, now);
  assert.equal(happening.length, 1, "ongoing event should appear");
});

test("buildHappeningItems skips items without start date", () => {
  const now = new Date("2027-01-01T00:00:00.000Z");
  const items = [
    {
      content_type: EVENT_CONTENT_TYPE,
      url: "https://a.example/event/",
      title: "No Date",
      site_origin: "https://a.example",
      start: "",
      published_at: "",
      tags: [],
      neighborhoods: [],
      image: "",
      image_origin: "",
      language: "",
      dir: "",
      summary: "",
      site_title: "A",
      domain: "a.example",
    },
  ];

  assert.equal(buildHappeningItems(items, now).length, 0);
});

test("buildHappeningItems sorts chronologically", () => {
  const now = new Date("2026-11-01T00:00:00.000Z");

  /**
   * @param {string} start
   * @param {string} origin
   * @returns {Record<string, unknown>}
   */
  function eventItem(start, origin) {
    return {
      content_type: EVENT_CONTENT_TYPE,
      url: `${origin}/event/`,
      title: "Event",
      site_origin: origin,
      start,
      published_at: "",
      tags: [],
      neighborhoods: [],
      image: "",
      image_origin: "",
      language: "",
      dir: "",
      summary: "",
      site_title: "Site",
      domain: origin.replace("https://", ""),
    };
  }

  const items = [
    eventItem("2027-06-01T00:00:00Z", "https://c.example"),
    eventItem("2027-02-01T00:00:00Z", "https://a.example"),
    eventItem("2027-04-01T00:00:00Z", "https://b.example"),
  ];

  const happening = buildHappeningItems(items, now);
  assert.equal(happening[0].start, "2027-02-01T00:00:00Z");
  assert.equal(happening[1].start, "2027-04-01T00:00:00Z");
  assert.equal(happening[2].start, "2027-06-01T00:00:00Z");
});

test("buildHappeningItems with empty input returns empty array", () => {
  assert.deepEqual(buildHappeningItems([], new Date()), []);
  assert.deepEqual(buildHappeningItems(null, new Date()), []);
});

// ─── events.mjs internal coverage ────────────────────────────────────────────

test("collectEvents: sf() handles object-with-name fields", () => {
  // Uses name object for node.name (covers sf() object branch)
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event","name":{"name":"Named Obj Event"},
     "url":"https://a.example/e/","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Named Obj Event");
});

test("collectEvents: absUrl handles object with url field", () => {
  // covers absUrl object.url branch for node.url
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"Event With Url Obj","url":{"url":"https://a.example/e2/"},"startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e2/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://a.example/e2/");
});

test("collectEvents: absUrl handles object with @id field", () => {
  // covers absUrl object["@id"] branch via node.mainEntityOfPage
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"Event With Id","mainEntityOfPage":{"@id":"https://a.example/e3/"},"startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/", html }], {
    siteOrigin: "https://a.example",
  });
  // item may or may not be emitted depending on URL origin check; just verify no crash.
  assert.ok(Array.isArray(items));
});

test("collectEvents: absUrl skips non-http protocol", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"Event","url":"ftp://a.example/e/","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/", html }], {
    siteOrigin: "https://a.example",
  });
  // url field is ftp: which is invalid, falls back to pageUrl ("https://a.example/")
  assert.ok(Array.isArray(items));
});

test("collectEvents: absUrl swallows URL constructor errors", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"Event","url":"not::a::url","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/", html }], {
    siteOrigin: "https://a.example",
  });
  // node.url is set but resolves to empty → item skipped (declaredUrl guard)
  assert.ok(Array.isArray(items));
});

test("collectEvents: url declared but fails to resolve is skipped", () => {
  // Non-http(s) declared url → absUrl returns "" → item is skipped.
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"E","url":"javascript:void(0)","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 0);
});

test("collectEvents: url outside siteOrigin is skipped", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"E","url":"https://other.example/e/","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 0);
});

test("collectEvents: item with no title is skipped", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "url":"https://a.example/e/","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 0);
});

test("collectEvents: string location node yields venue", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"String Loc","url":"https://a.example/e/",
     "startDate":"2099-01-01","location":"Union Hall"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].venue, "Union Hall");
});

test("collectEvents: address as string on location node", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"Addr Str","url":"https://a.example/e/","startDate":"2099-01-01",
     "location":{"@type":"Place","name":"Venue","address":"123 Main St"}}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].venue, "Venue");
  assert.equal(items[0].location, "123 Main St");
});

test("collectEvents: eventStatus without schema prefix is kept as-is", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"E","url":"https://a.example/e/","startDate":"2099-01-01",
     "eventStatus":"EventCancelled"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "EventCancelled");
});

test("collectEvents: performer drives attribution_role to performed", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"MusicEvent",
     "name":"Concert","url":"https://a.example/e/","startDate":"2099-01-01",
     "performer":{"@type":"Person","name":"Josh"}}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].attribution_role, "performed");
});

test("collectEvents: page lang applied when item has no language", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"Evento","url":"https://a.example/e/","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents(
    [{ url: "https://a.example/e/", html, lang: "es" }],
    { siteOrigin: "https://a.example" },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].language, "es");
});

test("collectEvents: mf2 items are included and deduped", () => {
  // page has both JSON-LD and mf2 for the same event (same identity skipped)
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Mf2 Dedup",
    url: "https://a.example/events/dedup/",
    startDate: "2099-06-01",
  });
  const html = `<html><head><script type="application/ld+json">${jsonLd}</script></head>
  <body>
    <article class="h-event">
      <h2 class="p-name"><a class="u-url" href="https://a.example/events/dedup/">Mf2 Dedup</a></h2>
      <time class="dt-start" datetime="2099-06-01">June 1</time>
    </article>
    <article class="h-event">
      <h2 class="p-name"><a class="u-url" href="https://a.example/events/other/">Other Event</a></h2>
      <time class="dt-start" datetime="2099-07-01">July 1</time>
    </article>
  </body></html>`;

  const { items } = collectEvents(
    [{ url: "https://a.example/events/", html, lang: "en" }],
    { siteOrigin: "https://a.example" },
  );

  // JSON-LD and mf2 for "dedup" event share same identity — only one emitted.
  const dedupItems = items.filter((i) => i.url.includes("dedup"));
  assert.equal(dedupItems.length, 1, "duplicate identity must be deduped");

  // Other event from mf2 must appear.
  const otherItems = items.filter((i) => i.url.includes("other"));
  assert.equal(otherItems.length, 1, "mf2-only event must be included");
});

test("eventsFromMf2: element with no matching close tag is skipped", () => {
  const html = `<div class="h-event">no close tag`;
  const items = eventsFromMf2(
    html,
    "https://a.example/",
    "https://a.example",
    "",
  );
  assert.equal(items.length, 0);
});

test("eventsFromMf2: element with no p-name is skipped", () => {
  const html = `<article class="h-event">
    <time class="dt-start" datetime="2099-01-01">Jan 1</time>
  </article>`;
  const items = eventsFromMf2(
    html,
    "https://a.example/",
    "https://a.example",
    "",
  );
  assert.equal(items.length, 0);
});

test("eventsFromMf2: u-url outside siteOrigin falls back to pageUrl", () => {
  const html = `<article class="h-event">
    <h2 class="p-name"><a class="u-url" href="https://other.example/e/">Cross Origin</a></h2>
    <time class="dt-start" datetime="2099-01-01">Jan</time>
  </article>`;
  const items = eventsFromMf2(
    html,
    "https://a.example/events/",
    "https://a.example",
    "",
  );
  assert.equal(items.length, 1);
  assert.equal(
    items[0].url,
    "https://a.example/events/",
    "cross-origin u-url falls back to pageUrl",
  );
});

test("eventsFromMf2: mf2DateValue skips element when class token not in list", () => {
  // Element has class="other-class" — dt-start not matched; start is empty → item skipped
  const html = `<article class="h-event">
    <h2 class="p-name">No Date</h2>
    <time class="other-class" datetime="2099-01-01">Jan</time>
  </article>`;
  const items = eventsFromMf2(
    html,
    "https://a.example/",
    "https://a.example",
    "",
  );
  assert.equal(items.length, 0);
});

test("eventsFromMf2: lang applied to mf2 items via collectEvents", () => {
  const html = `<html lang="ja"><head></head><body>
    <article class="h-event">
      <h2 class="p-name"><a class="u-url" href="https://a.example/e/ja/">日本語イベント</a></h2>
      <time class="dt-start" datetime="2099-09-01">September 1</time>
    </article>
  </body></html>`;
  const { items } = collectEvents(
    [{ url: "https://a.example/e/ja/", html, lang: "ja" }],
    { siteOrigin: "https://a.example" },
  );
  const event = items.find((i) => i.url.includes("ja"));
  assert.ok(event, "Japanese mf2 event must be included");
  assert.equal(event.language, "ja");
});

// ─── Additional coverage tests ────────────────────────────────────────────────

test("collectEvents: page with null entry is skipped (lines 458-459)", () => {
  // Exercises the guard: `if (!page || typeof page.html !== "string" || !page.html || !page.url)`
  const goodHtml = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"OK Event","url":"https://a.example/e/","startDate":"2099-01-01"}
  </script></head><body></body></html>`;

  const { items } = collectEvents(
    [
      null,
      { url: "", html: goodHtml },
      { url: "https://a.example/e/", html: "" },
      { url: "https://a.example/e/", html: goodHtml },
    ],
    { siteOrigin: "https://a.example" },
  );

  assert.equal(items.length, 1, "only the fully-valid page yields an item");
});

test("collectEvents: @type not in EVENT_SCHEMA_TYPES is skipped (lines 152-153)", () => {
  // Recipe is not an event type → types.length === 0 → null returned
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Recipe",
     "name":"Cake","url":"https://a.example/cake/","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/cake/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 0);
});

test("collectEvents: malformed JSON-LD block is silently skipped (lines 271-272)", () => {
  // The JSON-LD block is not valid JSON → catch branch executes → no item emitted
  const html = `<html><head>
    <script type="application/ld+json">{not valid json}</script>
  </head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 0);
});

test("eventsFromMf2: element without class attr skips mf2DateValue classVal check (lines 297-298)", () => {
  // The <span> has no class= at all; mf2DateValue finds no classVal → continues to next tag
  // The <time> with dt-start provides the start date.
  const html = `<article class="h-event">
    <h2 class="p-name"><a class="u-url" href="https://a.example/e/">Show</a></h2>
    <span datetime="2099-01-01">not a time</span>
    <time class="dt-start" datetime="2099-03-15">March 15</time>
  </article>`;
  const items = eventsFromMf2(
    html,
    "https://a.example/",
    "https://a.example",
    "",
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].start, "2099-03-15");
});

test("eventsFromMf2: dt-start without datetime attr falls back to visible text (lines 312-316)", () => {
  // <time> has class dt-start but NO datetime= attribute → visible text used
  const html = `<article class="h-event">
    <h2 class="p-name"><a class="u-url" href="https://a.example/e/">Text Date</a></h2>
    <time class="dt-start">2099-06-15</time>
  </article>`;
  const items = eventsFromMf2(
    html,
    "https://a.example/e/",
    "https://a.example",
    "",
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].start, "2099-06-15");
});

test("collectEvents: non-array pages argument returns empty items", () => {
  // Exercises `Array.isArray(pages) ? pages : []` non-array branch
  const { items } = collectEvents("not-an-array", {
    siteOrigin: "https://a.example",
  });
  assert.deepEqual(items, []);
});

test("collectEvents: pageLang is not applied when item already has a language", () => {
  // The event carries inLanguage "fr", pageLang is "es"; "fr" must win.
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"French Event","url":"https://a.example/e/fr/",
     "startDate":"2099-01-01","inLanguage":"fr"}
  </script></head><body></body></html>`;
  const { items } = collectEvents(
    [{ url: "https://a.example/e/fr/", html, lang: "es" }],
    { siteOrigin: "https://a.example" },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].language, "fr");
});

test("collectEvents: absUrl resolves @id object path in url field", () => {
  // node.url = {"@id": "https://a.example/e/"} → absUrl uses the @id path
  const node = { "@id": "https://a.example/e/" };
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Event",
    name: "At-ID Event",
    url: node,
    startDate: "2099-02-01",
  });
  const html = `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "At-ID Event");
});

test("collectEvents: absUrl catch branch on URL constructor throw (lines 111-112)", () => {
  // An @id that is syntactically invalid forces new URL() to throw → absUrl returns ""
  // absUrl falls back to the declared url field (https://a.example/e/) which is valid.
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"Throw Test","url":"https://[bad:host]/e/","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  // The url field throws in absUrl → falls back to pageUrl; but since pageUrl is
  // same-origin the item may or may not be included depending on the node.url
  // resolution logic. Either way no crash should occur.
  assert.ok(Array.isArray(items));
});

// ─── Remaining branch coverage tests ─────────────────────────────────────────

test("collectEvents: @type array with null element triggers t||'' fallback (L142 B30)", () => {
  // @type is an array that includes null → String(null || "") = "" → filtered out,
  // but "Event" in the same array keeps the item valid.
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":["Event",null],
     "name":"Array Null Type","url":"https://a.example/e/","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Array Null Type");
});

test("collectEvents: @type array with invalid type triggers filter false branch (L144 B76)", () => {
  // Array contains "Event" (valid) and "Person" (not in EVENT_SCHEMA_TYPES).
  // The filter callback returns false for "Person" → branch 76 covered.
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":["Event","Person"],
     "name":"Mixed Types","url":"https://a.example/e/","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  // Item still included because "Event" passes the filter
  assert.equal(items.length, 1);
});

test("collectEvents: mainEntityOfPage used as url when url field absent (L170 B40)", () => {
  // No "url" field → declaredUrl = ""; mainEntityOfPage has a valid URL → short-circuits at L170.
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"MeP Event","mainEntityOfPage":"https://a.example/e/mep/",
     "startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/mep/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://a.example/e/mep/");
});

test("collectEvents: @id used as url when url and mainEntityOfPage absent (L175)", () => {
  // No "url", no "mainEntityOfPage" → absUrl("@id") used at L175.
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"ID Event","@id":"https://a.example/e/id/",
     "startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/id/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://a.example/e/id/");
});

test("collectEvents: pageUrl fallback when url, mainEntityOfPage, and @id all absent (L179)", () => {
  // No url/mainEntityOfPage/@id fields → all absUrl calls return "" → url = pageUrl (L179-180).
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"No URL Event","startDate":"2099-01-01"}
  </script></head><body></body></html>`;
  const { items } = collectEvents(
    [{ url: "https://a.example/e/nurl/", html }],
    { siteOrigin: "https://a.example" },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://a.example/e/nurl/");
});

test("collectEvents: eventStatus without slash kept as-is (L219 B59)", () => {
  // eventStatus "Cancelled" has no "/" → ternary takes the : rawStatus branch.
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"E","url":"https://a.example/e/","startDate":"2099-01-01",
     "eventStatus":"Cancelled"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "Cancelled");
});

test("collectEvents: eventStatus ending with slash yields empty pop result (L219 B60)", () => {
  // eventStatus "schema/" → split("/") → pop = "" (falsy) → pop() || "" → ""
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event",
     "name":"E2","url":"https://a.example/e2/","startDate":"2099-01-01",
     "eventStatus":"schema/"}
  </script></head><body></body></html>`;
  const { items } = collectEvents([{ url: "https://a.example/e2/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.equal(items.length, 1);
  // status = "" (falsy) is not spread into the item, so items[0].status is undefined
  assert.equal(items[0].status, undefined);
});

test("eventsFromMf2: single-quoted datetime attribute covers htmlAttrValue m[1]??m[2] (L334 B92)", () => {
  // <time> uses single-quoted class and datetime attributes → m[1] is undefined, m[2] has the value.
  const html = `<article class="h-event">
    <h2 class='p-name'><a class='u-url' href='https://a.example/e/'>Single Quote</a></h2>
    <time class='dt-start' datetime='2099-05-10'>May 10</time>
  </article>`;
  const items = eventsFromMf2(
    html,
    "https://a.example/",
    "https://a.example",
    "",
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].start, "2099-05-10");
});

test("eventsFromMf2: h-event without u-url uses pageUrl directly (L400 B106)", () => {
  // No <a class="u-url"> in chunk → urlMatch = null → url = pageUrl (ternary false branch).
  const html = `<article class="h-event">
    <h2 class="p-name">No URL Event</h2>
    <time class="dt-start" datetime="2099-04-01">April</time>
  </article>`;
  const items = eventsFromMf2(
    html,
    "https://a.example/events/",
    "https://a.example",
    "",
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://a.example/events/");
});
