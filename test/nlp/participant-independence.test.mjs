/**
 * Goal & Constraints:
 * Participant use of Webmention.io or Octothorpes must not affect Joshternet
 * eligibility or ordinary HTML/link processing. Joshternet-owned scripts/config
 * must not call or advertise those services after removal.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { connectionObservations } from "../../scripts/network/connections.mjs";
import { isCommunityEligibleSource } from "../../scripts/nlp/evidence.mjs";
import {
  buildAllConnections,
  subjectsFromHtml,
} from "../../scripts/nlp/subjects.mjs";
import { parseHtmlRegions } from "../../scripts/nlp/text.mjs";

const ROOT = process.cwd();

/**
 * @param {string} relativePath
 * @returns {string}
 */
function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("participant HTML with Webmention.io endpoint is processed normally", () => {
  const html = `<html><head>
    <link rel="webmention" href="https://webmention.io/example.com/webmention">
    <meta property="article:tag" content="Gardening">
  </head><body>
    <a href="https://b.example/">Friend</a>
  </body></html>`;
  const regions = parseHtmlRegions(html);
  assert.ok(regions.links.some((link) => link.href.includes("b.example")));
  const subjects = subjectsFromHtml(html, "https://a.example/post/");
  assert.ok(subjects.some((subject) => subject.slug === "gardening"));
});

test("participant link to webmention.io is not rejected for that destination alone", () => {
  const edges = connectionObservations({
    sourceOrigin: "https://a.example",
    pageUrl: "https://a.example/",
    links: [
      {
        href: "https://webmention.io/example.com/webmention",
        text: "Webmentions",
        rel: ["webmention"],
      },
      {
        href: "https://b.example/",
        text: "Friend",
        rel: [],
      },
    ],
    participantOrigins: new Set(["https://a.example", "https://b.example"]),
  });

  assert.ok(
    edges.some(
      (edge) =>
        edge.from === "https://a.example" && edge.to === "https://b.example",
    ),
  );
  // Destination alone is not a ban; non-participant endpoints simply do not
  // become participant↔participant edges.
  assert.ok(
    !edges.some((edge) => String(edge.href || "").includes("webmention.io")),
  );
});

test("participant Octothorpes markup remains ordinary valid HTML", () => {
  const html = `<html><body>
    <a rel="octo:octothorpes" href="https://octothorp.es/~/photography">Photography</a>
    <a href="https://b.example/">Friend</a>
    <span class="p-category">Indieweb</span>
  </body></html>`;
  const regions = parseHtmlRegions(html);
  assert.ok(
    regions.links.some((link) =>
      String(link.rel || []).includes("octo:octothorpes"),
    ),
  );
  assert.ok(regions.links.some((link) => link.href.includes("b.example")));
  const subjects = subjectsFromHtml(html, "https://a.example/post/");
  assert.ok(subjects.some((subject) => subject.slug === "indieweb"));
  assert.ok(
    !subjects.some((subject) => subject.sources.includes("octothorpe")),
  );
  assert.equal(isCommunityEligibleSource("octothorpe"), false);
});

test("provider choice does not invent Joshternet mention edges", () => {
  const edges = buildAllConnections({
    participantOrigins: new Set(["https://a.example", "https://b.example"]),
    originLinks: [
      {
        origin: "https://a.example",
        links: [
          {
            href: "https://webmention.io/a.example/webmention",
            text: "Endpoint",
            rel: ["webmention"],
          },
          {
            href: "https://octothorp.es/~/cars",
            text: "cars",
            rel: ["octo:octothorpes"],
          },
          { href: "https://b.example/", text: "B", rel: [] },
        ],
      },
    ],
  });

  assert.ok(edges.every((edge) => edge.relation !== "mention"));
  assert.ok(
    edges.some(
      (edge) =>
        edge.from === "https://a.example" && edge.to === "https://b.example",
    ),
  );
});

test("Joshternet-owned scripts do not call octothorp.es or webmention.io APIs", () => {
  const ownedPaths = [
    "scripts/nlp/sync.mjs",
    "scripts/nlp/subjects.mjs",
    "scripts/nlp/evidence.mjs",
    "scripts/nlp/publish.mjs",
    "scripts/nlp/validate-generated.mjs",
    "scripts/nlp/scale-probe.mjs",
    "scripts/indexnow.mjs",
    "scripts/views/lib.mjs",
    "scripts/network/connections.mjs",
    "_config.yml",
    "_layouts/default.html",
    ".github/workflows/network-sync.yml",
    "infrastructure.md",
    "privacy.md",
  ];

  for (const relativePath of ownedPaths) {
    const body = read(relativePath);
    assert.doesNotMatch(
      body,
      /https?:\/\/(?:www\.)?octothorp\.es/i,
      `${relativePath} must not call octothorp.es`,
    );
    assert.doesNotMatch(
      body,
      /https?:\/\/(?:www\.)?webmention\.io/i,
      `${relativePath} must not call or advertise webmention.io`,
    );
    assert.doesNotMatch(
      body,
      /subjectsFromOctothorpes|fetchMentionsForTargets|mentionConnections/,
      `${relativePath} must not retain deleted enrichment helpers`,
    );
  }

  assert.equal(
    fs.existsSync(path.join(ROOT, "scripts/nlp/octothorpes.mjs")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(ROOT, "scripts/nlp/webmentions.mjs")),
    false,
  );
  assert.equal(fs.existsSync(path.join(ROOT, "_data/mentions.json")), false);
  assert.equal(
    fs.existsSync(path.join(ROOT, "schemas/mentions.schema.json")),
    false,
  );
});

test("direct-observation topic evidence still works without Octothorpes", () => {
  const subjects = subjectsFromHtml(
    `<html><body>
      <span class="p-category">Photography</span>
      <meta property="article:tag" content="Travel">
      <meta property="article:section" content="Essays">
    </body></html>`,
    "https://a.example/post/",
  );
  const slugs = subjects.map((subject) => subject.slug).sort();
  assert.deepEqual(slugs, ["essays", "photography", "travel"]);
});
