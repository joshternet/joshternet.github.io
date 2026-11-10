/**
 * Goal: Read-only Showcase attribution audit catches chrome titles and doubles.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { showcaseAttributionReport } from "../../scripts/nlp/showcase-audit.mjs";

test("showcaseAttributionReport is clean for healthy Showcase rows", () => {
  const report = showcaseAttributionReport({
    content: {
      items: [
        {
          identity: "url:https://photos.example/film/ultramax",
          title: "Kodak UltraMax",
          url: "https://photos.example/film/ultramax",
          site_origin: "https://photos.example",
          content_type: "photograph",
        },
      ],
    },
    showcase: {
      items: [
        {
          identity: "url:https://photos.example/film/ultramax",
          title: "Kodak UltraMax",
          url: "https://photos.example/film/ultramax",
          site_origin: "https://photos.example",
          content_type: "photograph",
        },
      ],
    },
    now: new Date("2026-11-05T18:00:00.000Z"),
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
});

test("showcaseAttributionReport fails on chrome titles and url: doubles", () => {
  const report = showcaseAttributionReport({
    content: { items: [] },
    showcase: {
      items: [
        {
          identity: "presentation:https://a.example:2-min-read",
          title: "2 min read",
          url: "https://a.example/speaking/",
          site_origin: "https://a.example",
          content_type: "presentation",
        },
        {
          identity: "url:https://photos.example/film/ultramax",
          title: "Kodak UltraMax",
          url: "https://photos.example/film/ultramax",
          site_origin: "https://photos.example",
          content_type: "photograph",
        },
        {
          identity: "url:https://photos.example/film/ultramax#gallery",
          title: "Shot on Kodak UltraMax",
          url: "https://photos.example/film/ultramax",
          site_origin: "https://photos.example",
          content_type: "photograph",
        },
      ],
    },
    now: new Date("2026-11-05T18:00:00.000Z"),
  });

  assert.equal(report.ok, false);
  assert.ok(report.metrics.bad_titles >= 1);
  assert.ok(report.metrics.hash_url_doubles >= 1);
});
