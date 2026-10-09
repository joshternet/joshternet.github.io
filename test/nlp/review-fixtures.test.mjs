import assert from "node:assert/strict";
import test from "node:test";

import {
  extractTopicsFromPages,
  phrasesFromText,
} from "../../scripts/nlp/extract.mjs";
import {
  subjectsFromJsonFeed,
  subjectsFromRssOrAtom,
} from "../../scripts/nlp/feeds.mjs";
import { itemMentionsTopic } from "../../scripts/nlp/match.mjs";
import { parseHtmlRegions } from "../../scripts/nlp/text.mjs";

/**
 * @param {string} kind
 * @param {string} body
 * @returns {string}
 */
function page(kind, body) {
  return `<!doctype html><html lang="en"><head><title>${kind} example</title></head><body><nav>Recent Next List Page</nav>${body}</body></html>`;
}

test("site-type fixtures keep article text and drop navigation chrome", () => {
  const samples = [
    page(
      "personal",
      "<article><h1>Morning walk</h1><p>The harbor was quiet.</p></article>",
    ),
    page(
      "software",
      "<main><h1>Build pipeline</h1><p>The release script checks the schema.</p></main>",
    ),
    page(
      "photography",
      "<article><h1>Darkroom notes</h1><p>The silver print dried overnight.</p></article>",
    ),
    page(
      "hobby",
      "<article><h1>Keelboat</h1><p>The dinghy needs a new tiller.</p></article>",
    ),
    page(
      "writing",
      "<article><h1>Second draft</h1><p>The chapter ends on the platform.</p></article>",
    ),
    page(
      "portfolio",
      "<main><h1>Selected work</h1><p>Three posters for the reading room.</p></main>",
    ),
    page("minimal", "<p>A short note about sourdough.</p>"),
    page(
      "wordpress",
      '<article class="h-entry"><h1>Plugin update</h1><p>The block editor saved the draft.</p></article>',
    ),
    page(
      "hugo",
      "<main><h1>Static build</h1><p>Hugo wrote the public directory.</p></main>",
    ),
    page(
      "untagged",
      "<article><h1>No categories</h1><p>The essay never names a tag.</p></article>",
    ),
    page(
      "microformats",
      '<article class="h-entry"><h1 class="p-name">Bus route</h1><p class="e-content">The tram stops at the market.</p></article>',
    ),
    page(
      "schema",
      '<article><h1>Office hours</h1><script type="application/ld+json">{"@type":"Person","name":"notatopicword"}</script><p>The clinic posted its hours.</p></article>',
    ),
    page(
      "long",
      `<article><h1>Field notes</h1><p>${"The meadow keeps the same fence. ".repeat(40)}</p></article>`,
    ),
    page("short", "<article><h1>Rain</h1><p>It rained.</p></article>"),
  ];

  for (const html of samples) {
    const regions = parseHtmlRegions(html);

    assert.equal(regions.chrome.includes("Recent"), true);
    assert.equal(
      regions.textForTopics.includes("Recent Next List Page"),
      false,
    );
    assert.equal(regions.title.length > 0, true);
    assert.equal(regions.textForTopics.includes("notatopicword"), false);
  }
});

test("feeds and an untagged essay expose declared labels without invented tags", () => {
  const rss = subjectsFromRssOrAtom(
    `<?xml version="1.0"?><rss><channel><item><title>Antenna</title><category>amateur radio</category></item></channel></rss>`,
  );
  const atom = subjectsFromRssOrAtom(
    `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Antenna</title><category term="amateur radio"/></entry></feed>`,
  );
  const json = subjectsFromJsonFeed(
    JSON.stringify({
      items: [{ title: "Antenna", tags: ["amateur radio"] }],
    }),
  );
  const essay = parseHtmlRegions(
    page(
      "untagged",
      "<article><h1>Keelboat tiller</h1><p>The dinghy needs a new tiller.</p></article>",
    ),
  );

  assert.equal(
    rss.some((subject) => subject.slug === "amateur-radio"),
    true,
  );
  assert.equal(
    atom.some((subject) => subject.slug === "amateur-radio"),
    true,
  );
  assert.equal(
    json.some((subject) => subject.slug === "amateur-radio"),
    true,
  );
  assert.equal(essay.derived, false);
  assert.ok(phrasesFromText(essay.textForTopics).includes("keelboat"));
});

test("repeated template text is not a public topic and a travel article stays travel", () => {
  const pages = Array.from({ length: 80 }, (_item, index) => ({
    url: `https://publisher.example/${index}`,
    title: "",
    text: "The footer repeats sidebarlink on every page.",
  }));

  pages.push({
    url: "https://publisher.example/keelboat",
    title: "Keelboat",
    text: "The keelboat needs a new tiller.",
  });

  const signals = extractTopicsFromPages(pages);
  const template = signals.find((signal) => signal.slug === "sidebarlink");
  const niche = signals.find((signal) => signal.slug === "keelboat");

  assert.equal(template.community_eligible, false);
  assert.equal(template.rejection_reason, "site-boilerplate");
  assert.notEqual(niche.rejection_reason, "site-boilerplate");
  assert.equal(niche.status === "accepted" || niche.status === "pending", true);

  const travel = {
    url: "https://publisher.example/lisbon",
    title: "A week in Lisbon",
    summary: "The tram stops at the market.",
    declared_topics: [{ slug: "travel" }],
    tags: [],
  };

  assert.equal(itemMentionsTopic(travel, "travel"), true);
  assert.equal(itemMentionsTopic(travel, "programming"), false);
});
