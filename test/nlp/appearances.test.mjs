/**
 * Goal: Directories, speaking archives, and tool indexes stay distinct.
 * Dates are publisher-supplied. Repeated talks are one presentation.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isEmptyAppearanceTitle } from "../../scripts/nlp/appearance-title.mjs";
import {
  appearanceListingCandidateUrls,
  appearanceSlug,
  collectAppearances,
  fetchAppearanceListingPages,
  listingMode,
  parseAppearanceDate,
  projectsFromToolIndexes,
} from "../../scripts/nlp/appearances.mjs";
import {
  collectCreativeWorks,
  creativeItemsFromHomepageLinks,
} from "../../scripts/nlp/creative.mjs";
import { collectEvents } from "../../scripts/nlp/events.mjs";
import {
  buildHappeningItems,
  buildPastEventItems,
  isMadeContentItem,
} from "../../scripts/views/lib.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const now = new Date("2026-11-05T18:00:00.000Z");

/**
 * @param {string} relativePath
 * @returns {string}
 */
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("appearanceSlug folds punctuation and accents", () => {
  assert.equal(
    appearanceSlug("Tooling Like It's 2025"),
    "tooling-like-it-s-2025",
  );
  assert.equal(appearanceSlug("Café"), "cafe");
  assert.equal(appearanceSlug(""), "");
});

test("parseAppearanceDate keeps date-only values and rejects impossible days", () => {
  assert.deepEqual(parseAppearanceDate("2026-03-28"), {
    start: "2026-03-28",
    precision: "date",
  });
  assert.deepEqual(parseAppearanceDate("2026-08-01T15:00:00-04:00"), {
    start: "2026-08-01T15:00:00-04:00",
    precision: "datetime",
  });
  assert.deepEqual(parseAppearanceDate("28 March 2026"), {
    start: "2026-03-28",
    precision: "date",
  });
  assert.equal(parseAppearanceDate("March 99, 2026").start, "");
  assert.equal(parseAppearanceDate("2026-02-31").start, "");
  assert.equal(parseAppearanceDate("2026-13-01").start, "");
  assert.equal(parseAppearanceDate("sometime").start, "");
  assert.equal(parseAppearanceDate("2026-02-31T15:00:00Z").start, "");
  assert.equal(parseAppearanceDate("99 March 2026").start, "");
  assert.equal(parseAppearanceDate("Mar 28").start, "");
  assert.equal(parseAppearanceDate("Mar 99", { year: "2026" }).start, "");
  assert.equal(parseAppearanceDate("99 Mar", { year: 2026 }).start, "");
  assert.deepEqual(parseAppearanceDate("Mar 28", { year: "2026" }), {
    start: "2026-03-28",
    precision: "date",
  });
  assert.deepEqual(parseAppearanceDate("28 Mar", { year: 2025 }), {
    start: "2025-03-28",
    precision: "date",
  });
  assert.deepEqual(
    parseAppearanceDate("Boston Code Camp 40Mar 28 - Boston, USA", {
      year: "2026",
    }),
    {
      start: "2026-03-28",
      precision: "date",
    },
  );
  assert.equal(parseAppearanceDate("Mar 28", { year: "not-a-year" }).start, "");
});

test("year-heading speaking archive fills month-day dates from section year", () => {
  const html = read("test/fixtures/events/speaking-archive-year-headings.html");
  const { items } = collectEvents(
    [
      {
        url: "https://member.example/speaking/",
        html,
        lang: "en",
      },
    ],
    {
      siteOrigin: "https://member.example",
      observedAt: "2026-11-05T18:00:00.000Z",
    },
  );
  const presentations = items.filter(
    (item) => item.content_type === "presentation",
  );
  const events = items.filter((item) => item.content_type === "event");

  assert.equal(presentations.length, 4);
  assert.equal(events.length, 5);

  const linter = presentations.find(
    (item) => item.title === "How to Learn to Love the Linter",
  );
  assert.ok(linter);
  assert.equal(linter.start, "2026-03-28");
  assert.equal(linter.start_precision, "date");
  assert.equal(linter.conference, "Boston Code Camp 40");

  const tooling = presentations.find(
    (item) => item.title === "Tooling Like It's 2025",
  );
  assert.ok(tooling);
  assert.equal(tooling.related.length, 2);
  assert.ok(events.some((item) => item.start === "2025-05-29"));
  assert.ok(events.some((item) => item.start === "2025-11-14"));
});

test("listingMode distinguishes archives, tools, and hosted indexes", () => {
  assert.equal(listingMode("https://member.example/speaking/"), "presented");
  assert.equal(listingMode("https://member.example/tools"), "tools");
  assert.equal(listingMode("https://member.example/events/"), "hosted");
  assert.equal(listingMode("https://member.example/tools/calendar/"), "");
  assert.equal(listingMode("https://member.example/availability/"), "");
  assert.equal(listingMode("not a url"), "");
});

test("appearanceListingCandidateUrls lists speaking tools and event indexes", () => {
  const urls = appearanceListingCandidateUrls("https://joshua.example");
  assert.ok(urls.includes("https://joshua.example/speaking/"));
  assert.ok(urls.includes("https://joshua.example/tools/"));
  assert.ok(urls.includes("https://joshua.example/events/"));
  assert.deepEqual(appearanceListingCandidateUrls("not-a-url"), []);
});

test("fetchAppearanceListingPages returns listing HTML and skips known modes", async () => {
  const calls = [];
  const pages = await fetchAppearanceListingPages("https://joshua.example", {
    haveModes: ["tools", "hosted"],
    fetchText: async (url) => {
      calls.push(url);
      if (url.endsWith("/speaking/")) {
        return {
          url: "https://joshua.example/speaking/",
          body: read("test/fixtures/events/speaking-archive.html"),
          contentType: "text/html",
        };
      }
      throw new Error(`unexpected ${url}`);
    },
  });

  assert.equal(pages.length, 1);
  assert.equal(pages[0].url, "https://joshua.example/speaking/");
  assert.ok(pages[0].html.includes("Speaking"));
  assert.ok(calls.every((url) => !url.includes("/tools")));
  assert.ok(calls.some((url) => url.includes("/speaking")));
});

test("fetchAppearanceListingPages skips empty bodies, repeats, and fetch errors", async () => {
  let speakingHits = 0;
  const pages = await fetchAppearanceListingPages("https://joshua.example", {
    haveModes: [],
    fetchText: async (url) => {
      if (url.endsWith("/speaking/") || url.endsWith("/speaking")) {
        speakingHits += 1;
        if (speakingHits === 1) {
          return {
            url: "https://joshua.example/speaking/",
            body: "",
            contentType: "text/html",
          };
        }
        if (speakingHits === 2) {
          return {
            body: read("test/fixtures/events/speaking-archive.html"),
            contentType: "text/html",
          };
        }
        return {
          url: "https://joshua.example/speaking/",
          body: read("test/fixtures/events/speaking-archive.html"),
          contentType: "text/html",
        };
      }
      if (url.includes("/tools")) {
        throw new Error("tools offline");
      }
      if (url.includes("/events")) {
        return {
          url: "https://joshua.example/events/",
          body: "<main><h1>Events</h1></main>",
          contentType: "text/html",
        };
      }
      return { url, body: "", contentType: "text/html" };
    },
  });

  assert.ok(pages.some((page) => page.url.includes("/speaking")));
  assert.ok(pages.some((page) => page.url.includes("/events")));

  const skipped = await fetchAppearanceListingPages("https://joshua.example", {
    haveModes: ["presented", "tools", "hosted"],
  });
  assert.deepEqual(skipped, []);

  const noModesOption = await fetchAppearanceListingPages(
    "https://joshua.example",
    {
      fetchText: async () => ({
        url: "https://joshua.example/speaking/",
        body: "",
        contentType: "text/html",
      }),
    },
  );
  assert.deepEqual(noModesOption, []);
});

test("speaking archive becomes presentations and presented events", () => {
  const html = read("test/fixtures/events/speaking-archive.html");
  const pages = [
    {
      url: "https://member.example/speaking/",
      html,
      lang: "en",
    },
  ];
  const { items } = collectEvents(pages, {
    siteOrigin: "https://member.example",
    observedAt: "2026-11-05T18:00:00.000Z",
  });
  const presentations = items.filter(
    (item) => item.content_type === "presentation",
  );
  const events = items.filter((item) => item.content_type === "event");

  assert.equal(
    items.some((item) => item.content_type === "project"),
    false,
  );
  assert.equal(
    presentations.filter((item) => item.title === "Tooling Like It's 2025")
      .length,
    1,
  );

  const tooling = presentations.find(
    (item) => item.title === "Tooling Like It's 2025",
  );
  assert.ok(tooling);
  assert.equal(tooling.related.length, 2);
  assert.equal(tooling.conference, "HalfStack London");
  assert.equal(tooling.start, "2025-11-14");
  assert.equal(tooling.start_precision, "date");
  assert.ok(tooling.resources.some((resource) => resource.kind === "code"));
  assert.ok(
    tooling.resources.some((resource) => resource.kind === "recording"),
  );

  const linter = presentations.find(
    (item) => item.title === "How to Learn to Love the Linter",
  );
  assert.ok(linter);
  assert.equal(linter.conference, "Boston Code Camp 40");
  assert.equal(linter.start, "2026-03-28");
  // Prefer slides as the card target when the talk has no same-origin permalink.
  assert.equal(linter.url, "https://speakerdeck.com/example/linter");
  assert.equal(linter.action_url, "https://speakerdeck.com/example/linter");
  assert.deepEqual(
    linter.declared_topics.map((topic) => topic.slug),
    ["static-analysis"],
  );
  assert.equal(
    linter.declared_topics.some((topic) => topic.slug === "typescript-eslint"),
    false,
  );

  const aspire = presentations.find(
    (item) => item.title === "TypeScript and Aspire",
  );
  assert.ok(aspire);
  assert.equal(aspire.conference, "AspireConf 2026");
  assert.ok(aspire.resources.some((resource) => resource.kind === "slides"));
  assert.ok(
    aspire.declared_topics.some((topic) => topic.slug === "typescript"),
  );

  const future = events.find((item) => item.title === "FutureConf");
  assert.ok(future);
  assert.equal(future.attribution_role, "presented");
  assert.equal(future.start_precision, "date");
  assert.equal(future.url, "https://member.example/talks/dates-you-can-trust");

  assert.equal(
    events.some((item) => String(item.title).includes("Nowhere")),
    false,
  );
  assert.equal(
    events.some((item) => String(item.summary) === "Nested talk"),
    false,
  );
  assert.equal(
    events.some((item) => String(item.summary) === "About"),
    false,
  );

  const happening = buildHappeningItems(items, now);
  const past = buildPastEventItems(items, now);
  assert.ok(happening.some((item) => item.title === "FutureConf"));
  assert.equal(
    happening.some((item) => item.start === "2026-03-28"),
    false,
  );
  assert.ok(past.some((item) => item.title === "Boston Code Camp 40"));
  assert.equal(
    past.some((item) => item.title === "FutureConf"),
    false,
  );
  assert.ok(past[0].start >= past[past.length - 1].start);
});

test("the same archive twice does not duplicate canonical identities", () => {
  const html = read("test/fixtures/events/speaking-archive.html");
  const page = {
    url: "https://member.example/speaking/",
    html,
    lang: "en",
  };
  const once = collectEvents([page], {
    siteOrigin: "https://member.example",
    observedAt: "2026-11-05T18:00:00.000Z",
  });
  const twice = collectEvents([page, page], {
    siteOrigin: "https://member.example",
    observedAt: "2026-11-05T18:00:00.000Z",
  });

  assert.equal(twice.items.length, once.items.length);
});

test("availability, courses, books, and mentions are not events", () => {
  const cases = [
    [
      "test/fixtures/events/availability.html",
      "https://member.example/availability/",
    ],
    [
      "test/fixtures/events/course-catalog.html",
      "https://member.example/courses/",
    ],
    [
      "test/fixtures/events/mention.html",
      "https://member.example/blog/their-conference/",
    ],
  ];

  for (const [file, url] of cases) {
    const { items } = collectEvents([{ url, html: read(file) }], {
      siteOrigin: "https://member.example",
      observedAt: "2026-11-05T18:00:00.000Z",
    });
    assert.equal(items.length, 0, url);
  }

  const book = collectEvents(
    [
      {
        url: "https://member.example/books/guide/",
        html: '<article><h1>Guide</h1><time datetime="2027-01-01">January 1, 2027</time></article>',
      },
    ],
    { siteOrigin: "https://member.example" },
  );
  assert.equal(book.items.length, 0);
});

test("hosted event index keeps clock times and date-only rows", () => {
  const { items } = collectEvents(
    [
      {
        url: "https://member.example/events/",
        html: read("test/fixtures/events/event-index.html"),
      },
    ],
    {
      siteOrigin: "https://member.example",
      observedAt: "2026-11-05T18:00:00.000Z",
    },
  );

  assert.equal(items.length, 2);
  const future = items.find((item) => item.title === "FutureConf");
  assert.ok(future);
  assert.equal(future.attribution_role, "hosted");
  assert.equal(future.start_precision, "datetime");
  assert.equal(future.content_type, "event");
  assert.equal(
    items.some((item) => item.content_type === "presentation"),
    false,
  );
});

test("tools index yields software entries and not the directory", () => {
  const pages = [
    {
      url: "https://member.example/tools/",
      html: read("test/fixtures/creative/tools-index.html"),
      lang: "en",
    },
  ];
  const tools = projectsFromToolIndexes(pages, {
    siteOrigin: "https://member.example",
    observedAt: "2026-11-05T18:00:00.000Z",
  });

  assert.deepEqual(
    tools.map((item) => item.url),
    [
      "https://member.example/tools/calendar",
      "https://member.example/tools/type-scale",
    ],
  );
  assert.equal(tools[0].content_type, "project");
  assert.deepEqual(tools[0].categories, ["software"]);
  assert.equal(tools[0].summary, "Build a printable calendar.");
  assert.equal(tools[0].language, "en");

  const creative = collectCreativeWorks(pages, {
    siteOrigin: "https://member.example",
    observedAt: "2026-11-05T18:00:00.000Z",
  });
  assert.equal(
    creative.items.some((item) => item.url === "https://member.example/tools/"),
    false,
  );
});

test("homepage directory links and sitemap schema are not projects", () => {
  const home = creativeItemsFromHomepageLinks(
    `<a href="/speaking/">Speaking</a>
     <a href="/collections">collections</a>
     <a href="/tools/">Tools</a>
     <a href="/html-sitemap">Links</a>
     <a href="/somaspace">SomaSpace</a>`,
    "https://member.example/",
    "https://member.example",
    "2026-11-05T18:00:00.000Z",
  );

  assert.deepEqual(
    home.map((item) => item.url),
    ["https://member.example/somaspace"],
  );

  const sitemap = collectCreativeWorks(
    [
      {
        url: "https://member.example/html-sitemap",
        html: read("test/fixtures/creative/sitemap-page.html"),
      },
    ],
    {
      siteOrigin: "https://member.example",
      observedAt: "2026-11-05T18:00:00.000Z",
    },
  );
  assert.equal(
    sitemap.items.some((item) => item.url.includes("html-sitemap")),
    false,
  );
});

test("collectAppearances ignores pages that are not listings", () => {
  assert.deepEqual(
    collectAppearances([], { siteOrigin: "https://member.example" }).items,
    [],
  );
  assert.deepEqual(collectAppearances([], {}).items, []);
  assert.deepEqual(
    collectAppearances("nope", { siteOrigin: "https://member.example" }).items,
    [],
  );
  assert.deepEqual(
    collectAppearances(
      [
        null,
        { url: "https://member.example/speaking/", html: "" },
        { url: "https://member.example/about/", html: "<p>Hi</p>" },
        {
          url: "https://member.example/speaking/",
          html: `<main><ul>
            <li class="h-event">
              <time datetime="2026-03-28">Mar 28</time>
              <a href="https://conf.example/">Conf</a>
              <div>Schema Talk</div>
            </li>
            <li>
              <a href="https://conf.example/">Conf</a>
              <p>Mar 29 - Online</p>
              <div>Cheerio Talk</div>
            </li>
          </ul></main>`,
        },
      ],
      { siteOrigin: "https://member.example" },
    ).items.some((item) => item.title === "Schema Talk"),
    false,
  );
  assert.ok(
    collectAppearances(
      [
        {
          url: "https://member.example/speaking/",
          html: `<main>
            <h2>2026</h2>
            <ul>
            <li>
              <a href="https://conf.example/">Conf</a>
              <p>Mar 29 - Online</p>
              <div>Cheerio Talk</div>
            </li>
            <li>
              <time datetime="2026-06-01">2026-06-01</time>
              <a href="https://conf.example/two">Two Conf</a>
              <a href="https://joshua.example/talks/two-links">Two Link Talk</a>
            </li>
            </ul>
          </main>`,
        },
        {
          url: "https://member.example/speaking/",
          html: `<body><ul>
            <li>
              <time datetime="2026-07-01">2026-07-01</time>
              <div>Body Only Talk</div>
            </li>
          </ul></body>`,
        },
      ],
      { siteOrigin: "https://member.example" },
    ).items.some((item) => item.title === "Cheerio Talk"),
  );
  assert.ok(
    collectAppearances(
      [
        {
          url: "https://member.example/speaking/",
          html: `<body><ul>
            <li>
              <time datetime="2026-07-01">2026-07-01</time>
              <div>Body Only Talk</div>
            </li>
          </ul></body>`,
        },
      ],
      { siteOrigin: "https://member.example" },
    ).items.some((item) => item.title === "Body Only Talk"),
  );
  assert.ok(
    collectAppearances(
      [
        {
          url: "https://member.example/speaking/",
          html: `<main><ul>
            <li>
              <time datetime="2026-06-01">2026-06-01</time>
              <a href="https://conf.example/two">Two Conf</a>
              <a href="https://joshua.example/talks/two-links">Two Link Talk</a>
            </li>
          </ul></main>`,
        },
      ],
      { siteOrigin: "https://member.example" },
    ).items.some((item) => item.title === "Two Link Talk"),
  );
  assert.deepEqual(
    projectsFromToolIndexes(
      [{ url: "https://member.example/about/", html: "<p>Hi</p>" }],
      { siteOrigin: "https://member.example" },
    ),
    [],
  );
  assert.deepEqual(projectsFromToolIndexes([], {}).length, 0);
});

test("a presentation on a speaking URL can still be a showcase talk", () => {
  assert.equal(
    isMadeContentItem({
      content_type: "presentation",
      url: "https://member.example/speaking/",
      title: "How to Learn to Love the Linter",
      summary: "Boston Code Camp 40",
      site_origin: "https://member.example",
      conference: "Boston Code Camp 40",
      start: "2026-03-28",
      start_precision: "date",
    }),
    true,
  );
  assert.equal(
    isMadeContentItem({
      content_type: "project",
      url: "https://member.example/speaking/",
      title: "Speaking",
      summary: "Talks and workshops.",
      source_kind: "creative-homepage",
    }),
    false,
  );
});

test("speaking rows keep a later copy, one shared event, and publisher dates", () => {
  const html = `<main><ul>
    <li>
      <time datetime="2026-02-31T15:00:00Z">March 3, 2021</time>
      <a href="https://joshua.example/talks/label-date">Label Date</a>
      <a href="#local">Local</a>
      <a href="">Blank</a>
      <a href="mailto:a@joshua.example">Mail</a>
      <a href="http://[">Broken</a>
      <a href="https://other.example/empty"></a>
      <meta name="keywords" content="kubernetes">
      LabelConf
    </li>
    <li>
      <time datetime="2022-02-02">February 2, 2022</time>
      <a href="https://speakerdeck.com/example/only">Slides</a>
    </li>
    <li>
      <time>March 4, 2020</time>
      <a href="https://joshua.example/talks/plain">Plain Talk</a>
    </li>
    <li>
      <time datetime="2020-05-05"></time>
      <a href="https://joshua.example/talks/clock">Clock Talk</a>
      DatedConf
    </li>
    <li>
      <a href="https://joshua.example/talks/repeat">Repeat Talk</a>
      <time datetime="2024-01-02">January 2, 2024</time>
      EarlyConf
    </li>
    <li>
      <a href="https://joshua.example/talks/repeat">Repeat Talk</a>
      <time datetime="2025-08-02">August 2, 2025</time>
      LaterConf
      <a href="https://speakerdeck.com/example/repeat">Slides</a>
      <span class="p-category">compilers</span>
    </li>
    <li>
      <a href="https://joshua.example/talks/repeat">Repeat Talk</a>
      <time datetime="2026-09-01">September 1, 2026</time>
    </li>
    <li>
      <a href="https://joshua.example/talks/dup-a">Dup A</a>
      <time datetime="2023-04-04">April 4, 2023</time>
      SharedConf
    </li>
    <li>
      <a href="https://joshua.example/talks/dup-b">Dup B</a>
      <time datetime="2023-04-04">April 4, 2023</time>
      SharedConf
    </li>
  </ul></main>`;
  const { items } = collectAppearances(
    [
      {
        url: "https://joshua.example/speaking/",
        html,
        lang: "en",
      },
    ],
    {
      siteOrigin: "https://joshua.example",
      observedAt: "2026-11-05T18:00:00.000Z",
    },
  );
  const labeled = items.find((item) => item.summary === "Label Date");
  assert.ok(labeled);
  assert.equal(labeled.start, "2021-03-03");
  assert.equal(
    items.some((item) =>
      (item.declared_topics || []).some((topic) => topic.slug === "kubernetes"),
    ),
    false,
  );
  const plain = items.find(
    (item) =>
      item.content_type === "presentation" && item.title === "Plain Talk",
  );
  assert.ok(plain);
  assert.equal(plain.conference, undefined);
  assert.equal(plain.start, "2020-03-04");
  const clock = items.find((item) => item.summary === "Clock Talk");
  assert.ok(clock);
  assert.equal(clock.start, "2020-05-05");
  assert.equal(
    items.some((item) => item.title === "Slides"),
    false,
  );

  const repeat = items.find(
    (item) =>
      item.content_type === "presentation" && item.title === "Repeat Talk",
  );
  assert.ok(repeat);
  assert.equal(repeat.start, "2026-09-01");
  assert.equal(repeat.summary, "LaterConf");
  assert.equal(repeat.action_url, "https://speakerdeck.com/example/repeat");
  assert.deepEqual(
    repeat.declared_topics.map((topic) => topic.slug),
    ["compiler"],
  );
  assert.equal(items.filter((item) => item.title === "SharedConf").length, 1);
  assert.equal(
    projectsFromToolIndexes(
      [
        null,
        { html: "<main></main>" },
        {
          url: "https://joshua.example/tools",
          html: `<main><ul><li><a href="https://joshua.example/tools/widget">Widget</a></li><li>No link</li></ul></main>`,
        },
      ],
      { siteOrigin: "https://joshua.example" },
    ).some((item) => item.title === "Widget"),
    true,
  );
  assert.equal(
    projectsFromToolIndexes(null, { siteOrigin: "https://joshua.example" })
      .length,
    0,
  );
});

test("year-crumb conference falls back to the talk title", () => {
  const html = read("test/fixtures/events/speaking-year-crumb.html");
  const { items } = collectAppearances(
    [{ url: "https://member.example/speaking/", html }],
    {
      siteOrigin: "https://member.example",
      observedAt: "2026-11-05T18:00:00.000Z",
    },
  );

  assert.equal(
    items.some((item) => String(item.title).includes(", 2026")),
    false,
  );
  assert.ok(
    items.some(
      (item) =>
        item.content_type === "presentation" &&
        item.title === "Front End Study Hall #061",
    ),
  );
  const presentation = items.find(
    (item) =>
      item.content_type === "presentation" &&
      item.title === "Front End Study Hall #061",
  );
  assert.equal(presentation.url, "https://speakerdeck.com/example/061");
  const event = items.find(
    (item) =>
      item.content_type === "event" &&
      item.title === "Front End Study Hall #061",
  );
  assert.ok(event);
  assert.equal(isEmptyAppearanceTitle(event.title), false);
});

test("min-read chrome titles are not speaking appearances", () => {
  const html = read("test/fixtures/events/speaking-min-read-chrome.html");
  const { items } = collectAppearances(
    [{ url: "https://member.example/speaking/", html }],
    {
      siteOrigin: "https://member.example",
      observedAt: "2026-11-05T18:00:00.000Z",
    },
  );

  assert.equal(items.length, 0);
});
