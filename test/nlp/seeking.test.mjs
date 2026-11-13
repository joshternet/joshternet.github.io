/**
 * Goal: Seeking extraction, reconciliation, freshness, and public-view gates.
 * Fixtures use fictional joshua.example requests only.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { decodeCrawlValue } from "../../scripts/nlp/site-record.mjs";

import {
  SEEKING_COPY,
  SEEKING_FRESHNESS_DAYS,
  buildSeekingDatasets,
  buildSeekingView,
  collectSeeking,
  fetchSeekingHtmlPages,
  formatSeekingCounts,
  isSeekingHubOrigin,
  isSeekingPageUrl,
  isSeekingPublishEnabled,
  pageUpdatedFromHtml,
  reconcileSeekingState,
  seekingCandidateUrls,
  seekingFromHtml,
  writeSeekingViewFromState,
} from "../../scripts/nlp/seeking.mjs";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/seeking",
);

/**
 * @param {string} name
 * @returns {string}
 */
function fixture(name) {
  return fs.readFileSync(path.join(fixturesDir, name), "utf8");
}

test("isSeekingPageUrl accepts /seeking and rejects docs and unrelated paths", () => {
  assert.equal(isSeekingPageUrl("https://joshua.example/seeking/"), true);
  assert.equal(isSeekingPageUrl("https://joshua.example/seeking"), true);
  assert.equal(isSeekingPageUrl("https://joshua.example/seeking.html"), true);
  assert.equal(isSeekingPageUrl("https://joshua.example/seeking/docs/"), false);
  assert.equal(isSeekingPageUrl("https://joshua.example/about/"), false);
  assert.equal(isSeekingPageUrl("https://joshua.example/contact/"), false);
  assert.equal(isSeekingPageUrl("not-a-url"), false);
});

test("seekingCandidateUrls lists same-origin slash variants", () => {
  assert.deepEqual(seekingCandidateUrls("https://joshua.example"), [
    "https://joshua.example/seeking/",
    "https://joshua.example/seeking",
    "https://joshua.example/seeking.html",
  ]);
  assert.deepEqual(seekingCandidateUrls("not-a-url"), []);
});

test("Seeking skips the Joshternet hub so aggregate /seeking does not double up", () => {
  assert.equal(isSeekingHubOrigin("https://joshternet.org"), true);
  assert.equal(isSeekingHubOrigin("https://www.joshternet.org"), true);
  assert.equal(isSeekingHubOrigin("https://joshua.example"), false);
  assert.deepEqual(seekingCandidateUrls("https://joshternet.org"), []);
  assert.deepEqual(seekingCandidateUrls("https://www.joshternet.org/"), []);

  const hubHtml = `<div class="h-listing">
    <p class="p-name">Hub mirror of a member request</p>
    <p class="p-description">Should not become a Seeking observation.</p>
    <a class="u-url" href="mailto:help@joshua.example">email</a>
    <data class="p-category" value="help"></data>
    <data class="p-action" value="wanted"></data>
  </div>`;

  assert.deepEqual(
    collectSeeking(
      [{ url: "https://joshternet.org/seeking/", html: hubHtml }],
      {
        siteOrigin: "https://joshternet.org",
        observedAt: "2026-11-12T00:00:00.000Z",
      },
    ),
    { pages: [], requests: [] },
  );

  const reconciled = reconcileSeekingState(
    {
      origins: [
        {
          origin: "https://joshternet.org",
          title: "Joshternet",
          page_url: "https://joshternet.org/seeking/",
          requests: [
            {
              identity: "seeking:https://joshternet.org:stale",
              description: "stale hub row",
              last_checked: "2026-11-12T00:00:00.000Z",
            },
          ],
        },
      ],
    },
    [
      {
        origin: "https://joshternet.org",
        title: "Joshternet",
        pages: [{ url: "https://joshternet.org/seeking/", html: hubHtml }],
        complete: true,
      },
    ],
    { observedAt: "2026-11-12T00:00:00.000Z" },
  );

  assert.equal(
    reconciled.origins.some((row) => row.origin === "https://joshternet.org"),
    false,
  );
});

test("fetchSeekingHtmlPages returns first successful Seeking page", async () => {
  const calls = [];
  const pages = await fetchSeekingHtmlPages("https://joshua.example", {
    fetchText: async (url) => {
      calls.push(url);
      if (url.endsWith("/seeking/")) {
        throw new Error("HTTP 404");
      }
      if (url.endsWith("/seeking")) {
        return {
          url: "https://joshua.example/seeking",
          body: fixture("minimal-wanted.html"),
          contentType: "text/html",
        };
      }
      throw new Error(`unexpected ${url}`);
    },
  });

  assert.deepEqual(calls, [
    "https://joshua.example/seeking/",
    "https://joshua.example/seeking",
  ]);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].url, "https://joshua.example/seeking");
  assert.match(pages[0].html, /h-listing/);
});

test("fetchSeekingHtmlPages returns empty when all candidates fail", async () => {
  const pages = await fetchSeekingHtmlPages("https://joshua.example", {
    fetchText: async () => {
      throw new Error("HTTP 404");
    },
  });

  assert.deepEqual(pages, []);
});

test("short-circuit complete Seeking pages replace empty prior state", () => {
  const html = fixture("minimal-wanted.html");
  const state = reconcileSeekingState(
    { origins: [] },
    [
      {
        origin: "https://joshua.example",
        title: "Harbor Notes",
        complete: true,
        pages: [{ url: "https://joshua.example/seeking/", html }],
      },
    ],
    { observedAt: "2026-11-04T12:00:00.000Z" },
  );

  assert.equal(state.origins.length, 1);
  assert.ok(state.origins[0].requests.length > 0);
});

test("precollected Seeking observations do not need page HTML", () => {
  const html = fixture("minimal-wanted.html");
  const collected = collectSeeking(
    [{ url: "https://joshua.example/seeking/", html }],
    {
      siteOrigin: "https://joshua.example",
      siteTitle: "Harbor Notes",
      observedAt: "2026-11-04T12:00:00.000Z",
    },
  );
  const state = reconcileSeekingState(
    { origins: [] },
    [
      {
        origin: "https://joshua.example",
        title: "Harbor Notes",
        complete: true,
        pages: [],
        collected,
      },
    ],
    { observedAt: "2026-11-04T12:00:00.000Z" },
  );

  assert.equal(state.origins.length, 1);
  assert.ok(state.origins[0].requests.length > 0);
});

test("seekingFromHtml extracts mailto u-url as contact, not source", () => {
  const html = fixture("minimal-wanted.html");
  const { page, requests } = seekingFromHtml(
    html,
    "https://joshua.example/seeking/",
    {
      siteOrigin: "https://joshua.example",
      siteTitle: "Harbor Notes",
      observedAt: "2026-11-04T12:00:00.000Z",
    },
  );

  assert.equal(requests.length, 1);
  assert.equal(page.page_updated, "2026-10-15");
  assert.equal(page.last_checked, "2026-11-04T12:00:00.000Z");
  assert.match(
    requests[0].description,
    /thoughtful feedback on a draft handbook chapter/i,
  );
  assert.equal(
    requests[0].source_url,
    "https://joshua.example/seeking/#want-feedback",
  );
  assert.equal(requests[0].contact_url, "mailto:hello@joshua.example");
  assert.notEqual(requests[0].source_url, requests[0].contact_url);
});

test("seekingFromHtml keeps multiple wanted listings and skips for-sale", () => {
  const html = fixture("multiple-with-categories.html");
  const { requests } = seekingFromHtml(
    html,
    "https://joshua.example/seeking/",
    {
      siteOrigin: "https://joshua.example",
      observedAt: "2026-11-04T12:00:00.000Z",
    },
  );

  assert.equal(requests.length, 2);
  const camera = requests.find(
    (row) => row.title === "Hard-to-find camera part",
  );
  assert.ok(camera);
  assert.deepEqual(camera.categories, ["photography", "hardware"]);
  assert.equal(camera.item_name, "Focus ring (model AE-2)");
  assert.equal(camera.request_published, "2026-10-20");
  assert.equal(
    camera.source_url,
    "https://joshua.example/seeking/#camera-part",
  );
  assert.equal(camera.contact_url, "");

  const collaborator = requests.find((row) =>
    String(row.description).includes("collaborator"),
  );
  assert.ok(collaborator);
  assert.equal(collaborator.contact_url, "https://joshua.example/contact/");
  assert.notEqual(collaborator.source_url, collaborator.contact_url);
  assert.ok(
    !requests.some((row) => /desk lamp/i.test(String(row.description))),
  );
});

test("seekingFromHtml allows page without per-request contact", () => {
  const html = fixture("page-level-contact.html");
  const { requests } = seekingFromHtml(
    html,
    "https://friends.joshua.example/seeking/",
    {
      siteOrigin: "https://friends.joshua.example",
      observedAt: "2026-11-04T12:00:00.000Z",
    },
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].contact_url, "");
  assert.equal(
    requests[0].source_url,
    "https://friends.joshua.example/seeking/",
  );
});

test("seekingFromHtml does not invent requests from unreadable markup", () => {
  const html = fixture("unreadable-markup.html");
  const { requests } = seekingFromHtml(
    html,
    "https://joshua.example/seeking/",
    { siteOrigin: "https://joshua.example" },
  );

  assert.equal(requests.length, 0);
});

test("seekingFromHtml preserves non-English request wording", () => {
  const html = fixture("non-english.html");
  const { page, requests } = seekingFromHtml(
    html,
    "https://joshua.example/seeking/",
    {
      siteOrigin: "https://joshua.example",
      language: "es",
      observedAt: "2026-11-04T12:00:00.000Z",
    },
  );

  assert.equal(requests.length, 1);
  assert.equal(page.language, "es");
  assert.equal(requests[0].title, "Ayuda con traducción");
  assert.match(requests[0].description, /traducción corta al español/);
});

test("collectSeeking ignores non-seeking pages even with h-listing", () => {
  const html = fixture("minimal-wanted.html");
  const { requests } = collectSeeking(
    [
      {
        url: "https://joshua.example/about/",
        html,
      },
      {
        url: "https://joshua.example/seeking/",
        html,
      },
    ],
    {
      siteOrigin: "https://joshua.example",
      observedAt: "2026-11-04T12:00:00.000Z",
    },
  );

  assert.equal(requests.length, 1);
});

test("reconcileSeekingState removes requests after successful empty Seeking page", () => {
  const prior = {
    origins: [
      {
        origin: "https://joshua.example",
        title: "Harbor Notes",
        page_url: "https://joshua.example/seeking/",
        last_checked: "2026-11-01T00:00:00.000Z",
        complete: true,
        requests: [
          {
            identity: "seeking:https://joshua.example:old",
            description: "Old request",
            source_url: "https://joshua.example/seeking/",
            categories: [],
          },
        ],
      },
    ],
  };

  const next = reconcileSeekingState(
    prior,
    [
      {
        origin: "https://joshua.example",
        title: "Harbor Notes",
        complete: true,
        pages: [
          {
            url: "https://joshua.example/seeking/",
            html: fixture("no-listings.html"),
          },
        ],
      },
    ],
    { observedAt: "2026-11-04T12:00:00.000Z" },
  );

  assert.equal(next.origins.length, 1);
  assert.equal(next.origins[0].requests.length, 0);
});

test("reconcileSeekingState keeps prior requests when crawl failed", () => {
  const prior = {
    origins: [
      {
        origin: "https://joshua.example",
        title: "Harbor Notes",
        page_url: "https://joshua.example/seeking/",
        last_checked: "2026-11-03T00:00:00.000Z",
        complete: true,
        requests: [
          {
            identity: "seeking:https://joshua.example:keep",
            description: "Still wanted",
            source_url: "https://joshua.example/seeking/",
            categories: [],
          },
        ],
      },
    ],
  };

  const next = reconcileSeekingState(
    prior,
    [
      {
        origin: "https://joshua.example",
        failed: true,
        pages: [],
      },
    ],
    { observedAt: "2026-11-04T12:00:00.000Z" },
  );

  assert.equal(next.origins.length, 1);
  assert.equal(next.origins[0].requests.length, 1);
  assert.equal(next.origins[0].requests[0].description, "Still wanted");
});

test("reconcileSeekingState hides origins older than freshness window", () => {
  const prior = {
    origins: [
      {
        origin: "https://joshua.example",
        title: "Harbor Notes",
        last_checked: "2026-09-01T00:00:00.000Z",
        complete: true,
        requests: [
          {
            identity: "seeking:stale",
            description: "Stale request",
            source_url: "https://joshua.example/seeking/",
            categories: [],
          },
        ],
      },
    ],
  };

  const next = reconcileSeekingState(prior, [], {
    observedAt: "2026-11-04T12:00:00.000Z",
    now: new Date("2026-11-04T12:00:00.000Z"),
  });

  assert.equal(SEEKING_FRESHNESS_DAYS, 30);
  assert.equal(next.origins.length, 0);
});

test("buildSeekingView omits contact_url and groups alphabetically by site title", () => {
  const view = buildSeekingView({
    generated_at: "2026-11-04T12:00:00.000Z",
    origins: [
      {
        origin: "https://zebra.joshua.example",
        title: "Zebra Notes",
        page_url: "https://zebra.joshua.example/seeking/",
        page_updated: "2026-10-01",
        last_checked: "2026-11-04T12:00:00.000Z",
        requests: [
          {
            identity: "a",
            description: "Need help with maps",
            title: "",
            categories: ["maps"],
            source_url: "https://zebra.joshua.example/seeking/#a",
            contact_url: "mailto:z@joshua.example",
          },
        ],
      },
      {
        origin: "https://apple.joshua.example",
        title: "Apple Harbor",
        page_url: "https://apple.joshua.example/seeking/",
        page_updated: "2026-10-02",
        last_checked: "2026-11-04T12:00:00.000Z",
        requests: [
          {
            identity: "b",
            description: "Looking for a collaborator",
            title: "Collaborator",
            categories: ["writing"],
            source_url: "https://apple.joshua.example/seeking/#b",
            contact_url: "https://apple.joshua.example/contact/",
          },
        ],
      },
    ],
  });

  assert.equal(view.status, "ok");
  assert.equal(view.request_count, 2);
  assert.equal(view.website_count, 2);
  assert.equal(view.sites[0].site_title, "Apple Harbor");
  assert.equal(view.sites[1].site_title, "Zebra Notes");
  assert.equal(view.sites[0].requests[0].contact_url, undefined);
  assert.deepEqual(view.categories, ["maps", "writing"]);
});

test("buildSeekingView distinguishes empty and unavailable", () => {
  assert.equal(buildSeekingView({ origins: [] }).status, "empty");
  assert.equal(
    buildSeekingView({ origins: [] }, { unavailable: true }).status,
    "unavailable",
  );
});

test("formatSeekingCounts uses singular forms", () => {
  assert.equal(formatSeekingCounts(1, 1), "1 request from 1 website");
  assert.equal(formatSeekingCounts(6, 3), "6 requests from 3 websites");
});

test("SEEKING_COPY exposes required UI string keys", () => {
  const requiredKeys = [
    "empty",
    "filterEmpty",
    "unavailable",
    "loading",
    "readRequest",
    "browseByTopic",
    "clearFilters",
    "aboutLink",
    "resultsHeading",
  ];

  for (const key of requiredKeys) {
    assert.equal(typeof SEEKING_COPY[key], "string");
    assert.ok(SEEKING_COPY[key].trim().length > 0, `${key} must be non-empty`);
  }
});

test("buildSeekingDatasets always writes public excerpts (gitignored preview)", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seeking-"));

  try {
    const result = await buildSeekingDatasets({
      repoRoot: tmp,
      publish: false,
      observed_at: "2026-11-04T12:00:00.000Z",
      origins: [
        {
          origin: "https://joshua.example",
          title: "Harbor Notes",
          complete: true,
          pages: [
            {
              url: "https://joshua.example/seeking/",
              html: fixture("minimal-wanted.html"),
            },
          ],
        },
      ],
    });

    assert.equal(result.publish, false);
    assert.equal(result.view.request_count, 1);
    const publicDoc = decodeCrawlValue(
      JSON.parse(fs.readFileSync(result.publicPath, "utf8")),
    );
    assert.equal(publicDoc.publish_enabled, false);
    assert.equal(publicDoc.request_count, 1);
    assert.match(
      publicDoc.sites[0].requests[0].description,
      /thoughtful feedback/i,
    );

    const stateDoc = decodeCrawlValue(
      JSON.parse(fs.readFileSync(result.statePath, "utf8")),
    );
    assert.equal(stateDoc.origins[0].requests.length, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("buildSeekingDatasets publish on writes request excerpts to public view", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seeking-pub-"));

  try {
    const result = await buildSeekingDatasets({
      repoRoot: tmp,
      publish: true,
      observed_at: "2026-11-04T12:00:00.000Z",
      origins: [
        {
          origin: "https://joshua.example",
          title: "Harbor Notes",
          complete: true,
          pages: [
            {
              url: "https://joshua.example/seeking/",
              html: fixture("minimal-wanted.html"),
            },
          ],
        },
      ],
    });

    const publicDoc = decodeCrawlValue(
      JSON.parse(fs.readFileSync(result.publicPath, "utf8")),
    );
    assert.equal(publicDoc.status, "ok");
    assert.equal(publicDoc.request_count, 1);
    assert.match(
      publicDoc.sites[0].requests[0].description,
      /thoughtful feedback/i,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("pageUpdatedFromHtml reads dt-updated", () => {
  assert.equal(
    pageUpdatedFromHtml(fixture("minimal-wanted.html")),
    "2026-10-15",
  );
});

test("isSeekingPageUrl rejects empty values and invalid URLs", () => {
  assert.equal(isSeekingPageUrl(""), false);
  assert.equal(isSeekingPageUrl("http://[::1"), false);
});

test("seekingFromHtml returns incomplete page without siteOrigin or html", () => {
  const empty = seekingFromHtml("", "https://joshua.example/seeking/", {
    siteOrigin: "https://joshua.example",
  });
  assert.equal(empty.page.complete, false);
  assert.equal(empty.requests.length, 0);

  const noOrigin = seekingFromHtml(
    "<p>x</p>",
    "https://joshua.example/seeking/",
    {
      siteOrigin: "",
    },
  );
  assert.equal(noOrigin.page.complete, false);
});

test("seekingFromHtml skips unclosed listings and rejects non-http contact schemes", () => {
  const html = `
    <article class="h-listing" id="open">
      <span class="p-action">wanted</span>
      <div class="e-description">Unclosed listing should be ignored.
  `;
  const { requests: openRequests } = seekingFromHtml(
    html,
    "https://joshua.example/seeking/",
    { siteOrigin: "https://joshua.example" },
  );
  assert.equal(openRequests.length, 0);

  const withJs = `
    <article class="h-listing" id="js">
      <span class="p-action">wanted</span>
      <div class="e-description">Needs a safe contact URL.</div>
      <a class="u-url" href="javascript:alert(1)">bad</a>
    </article>
  `;
  const { requests } = seekingFromHtml(
    withJs,
    "https://joshua.example/seeking/",
    { siteOrigin: "https://joshua.example" },
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].contact_url, "");
});

test("seekingFromHtml reads dt-modified and category value attributes", () => {
  const html = `
    <section class="h-listing" id="mod">
      <data class="p-action" value="wanted"></data>
      <div class="e-description">Looking for a map legend template.</div>
      <data class="p-category" value="cartography"></data>
      <time class="dt-modified" datetime="2026-10-30">30 Oct</time>
      <div class="p-item"><span class="p-name">Legend kit</span></div>
    </section>
  `;
  const { requests } = seekingFromHtml(
    html,
    "https://joshua.example/seeking/",
    { siteOrigin: "https://joshua.example" },
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].request_updated, "2026-10-30");
  assert.deepEqual(requests[0].categories, ["cartography"]);
  assert.equal(requests[0].item_name, "Legend kit");
});

test("pageUpdatedFromHtml supports Updated label and bare time", () => {
  assert.equal(
    pageUpdatedFromHtml(
      `<p>Updated: <time datetime="2026-08-01">1 Aug</time></p>`,
    ),
    "2026-08-01",
  );
  assert.equal(
    pageUpdatedFromHtml(
      `<time datetime="2026-09-09" class="dt-updated">9 Sep</time>`,
    ),
    "2026-09-09",
  );
  assert.equal(
    pageUpdatedFromHtml(`<time datetime="2026-07-04">4 Jul</time>`),
    "2026-07-04",
  );
  assert.equal(pageUpdatedFromHtml("<p>No dates</p>"), "");
  assert.equal(pageUpdatedFromHtml(""), "");
});

test("collectSeeking skips when siteOrigin missing or pages incomplete", () => {
  assert.equal(
    collectSeeking(
      [{ url: "https://joshua.example/seeking/", html: "<p>" }],
      {},
    ).requests.length,
    0,
  );
  assert.equal(
    collectSeeking([{ url: "https://joshua.example/seeking/", html: "" }], {
      siteOrigin: "https://joshua.example",
    }).requests.length,
    0,
  );
});

test("reconcileSeekingState ignores invalid prior rows and empty origins", () => {
  const next = reconcileSeekingState(
    {
      origins: [
        null,
        { origin: "" },
        {
          origin: "https://joshua.example",
          title: "Harbor",
          last_checked: "2026-11-03T00:00:00.000Z",
          requests: [{ description: "Keep", categories: [], source_url: "" }],
        },
      ],
    },
    [
      { origin: "" },
      { origin: "https://other.example", complete: false, pages: [] },
    ],
    { observedAt: "2026-11-04T12:00:00.000Z" },
  );
  assert.equal(next.origins.length, 1);
  assert.equal(next.origins[0].origin, "https://joshua.example");
});

test("buildSeekingView tolerates invalid origin URLs and empty category labels", () => {
  const view = buildSeekingView({
    origins: [
      {
        origin: "not a url",
        title: "",
        page_url: "https://joshua.example/seeking/",
        last_checked: "2026-11-04T12:00:00.000Z",
        requests: [
          {
            identity: "x",
            description: "Need help",
            categories: ["", " maps "],
            source_url: "",
          },
        ],
      },
      {
        origin: "https://empty.joshua.example",
        title: "Empty",
        requests: [],
      },
      {
        origin: "https://bad-requests.joshua.example",
        title: "Bad",
        requests: "nope",
      },
    ],
  });
  assert.equal(view.website_count, 1);
  assert.equal(view.sites[0].domain, "not a url");
  assert.ok(view.categories.includes("maps"));
});

test("isSeekingPublishEnabled respects env, CI default, and explicit flags", () => {
  const previousPublish = process.env.JOSHTERNET_SEEKING_PUBLISH;
  const previousCi = process.env.CI;
  const previousActions = process.env.GITHUB_ACTIONS;

  try {
    assert.equal(isSeekingPublishEnabled(true), true);
    assert.equal(isSeekingPublishEnabled(false), false);

    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.JOSHTERNET_SEEKING_PUBLISH;
    assert.equal(isSeekingPublishEnabled(), true);

    process.env.CI = "true";
    assert.equal(isSeekingPublishEnabled(), false);

    process.env.JOSHTERNET_SEEKING_PUBLISH = "true";
    assert.equal(isSeekingPublishEnabled(), true);
    process.env.JOSHTERNET_SEEKING_PUBLISH = "0";
    assert.equal(isSeekingPublishEnabled(), false);
  } finally {
    if (previousPublish === undefined) {
      delete process.env.JOSHTERNET_SEEKING_PUBLISH;
    } else {
      process.env.JOSHTERNET_SEEKING_PUBLISH = previousPublish;
    }

    if (previousCi === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = previousCi;
    }

    if (previousActions === undefined) {
      delete process.env.GITHUB_ACTIONS;
    } else {
      process.env.GITHUB_ACTIONS = previousActions;
    }
  }
});

test("buildSeekingDatasets records unavailable collections", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seeking-unavail-"));
  try {
    const result = await buildSeekingDatasets({
      repoRoot: tmp,
      publish: true,
      unavailable: true,
      observed_at: "2026-11-04T12:00:00.000Z",
      origins: [],
    });
    assert.equal(result.view.status, "unavailable");
    assert.equal(result.state.unavailable, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("writeSeekingViewFromState refreshes public excerpts from state", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seeking-view-"));

  try {
    await buildSeekingDatasets({
      repoRoot: tmp,
      publish: true,
      observed_at: "2026-11-04T12:00:00.000Z",
      origins: [
        {
          origin: "https://joshua.example",
          title: "Harbor Notes",
          complete: true,
          pages: [
            {
              url: "https://joshua.example/seeking/",
              html: fixture("minimal-wanted.html"),
            },
          ],
        },
      ],
    });

    const refreshed = await writeSeekingViewFromState(tmp);
    assert.equal(refreshed.request_count, 1);
    const livePublic = decodeCrawlValue(
      JSON.parse(
        fs.readFileSync(path.join(tmp, "_data", "seeking.json"), "utf8"),
      ),
    );
    assert.equal(livePublic.status, "ok");
    assert.match(livePublic.sites[0].requests[0].description, /feedback/i);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("formatSeekingCounts handles zero", () => {
  assert.equal(formatSeekingCounts(0, 0), "0 requests from 0 websites");
});

test("seekingFromHtml handles invalid siteOrigin hostname parsing", () => {
  const { page, requests } = seekingFromHtml(
    fixture("minimal-wanted.html"),
    "https://joshua.example/seeking/",
    { siteOrigin: "http://[::1" },
  );
  assert.equal(page.domain, "");
  assert.equal(requests.length, 1);
});

test("seekingFromHtml keeps source pageUrl when fragment URL construction fails", () => {
  const html = `
    <article class="h-listing" id="want">
      <span class="p-action">wanted</span>
      <div class="e-description">Need a calibration chart.</div>
    </article>
  `;
  const { requests } = seekingFromHtml(html, "not-a-valid-url", {
    siteOrigin: "https://joshua.example",
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].source_url, "not-a-valid-url");
});

test("seekingFromHtml ignores unclosed e-description and unclosed p-item", () => {
  const html = `
    <article class="h-listing">
      <span class="p-action">wanted</span>
      <div class="e-description">Missing close tag
      <div class="p-item"><span class="p-name">Open item
    </article>
    <article class="h-listing" id="ok">
      <span class="p-action">wanted</span>
      <div class="e-description">A complete request statement.</div>
      <div class="p-item">
        <span class="p-name">Closed item</span>
  `;
  // Second listing intentionally omits its closing tags to exercise parsers.
  const { requests } = seekingFromHtml(
    `${html}</div></article>`,
    "https://joshua.example/seeking/",
    { siteOrigin: "https://joshua.example" },
  );
  assert.ok(requests.some((row) => /complete request/i.test(row.description)));
});

test("reconcileSeekingState copies non-array prior requests as empty", () => {
  const next = reconcileSeekingState(
    {
      origins: [
        {
          origin: "https://joshua.example",
          last_checked: "2026-11-03T00:00:00.000Z",
          requests: "bad",
        },
      ],
    },
    [],
    { observedAt: "2026-11-04T12:00:00.000Z" },
  );
  assert.equal(next.origins[0].requests.length, 0);
});

test("findMatchingCloseIndex ignores lookalike open tokens", () => {
  const html = `
    <div class="h-listing">
      <span class="p-action">wanted</span>
      <div class="e-description">Looking past a &lt;divvy decoy.</div>
      <divvy class="not-a-tag">ignore</divvy>
      <div\tclass="nested">
        <span>nested with tab after tag name</span>
      </div>
      <div class="self-close"/>
    </div>
  `;
  const { requests } = seekingFromHtml(
    html,
    "https://joshua.example/seeking/",
    {
      siteOrigin: "https://joshua.example",
    },
  );
  assert.equal(requests.length, 1);
});

test("buildSeekingView uses generatedAt fallbacks and non-array categories", () => {
  const view = buildSeekingView(
    {
      origins: [
        {
          origin: "https://joshua.example",
          title: "Harbor",
          page_url: "https://joshua.example/seeking/",
          requests: [
            {
              identity: "y",
              description: "Need a spare part",
              categories: "not-an-array",
              source_url: "https://joshua.example/seeking/",
            },
          ],
        },
      ],
    },
    { generatedAt: "2026-11-04T15:00:00.000Z" },
  );
  assert.equal(view.generated_at, "2026-11-04T15:00:00.000Z");
  assert.deepEqual(view.sites[0].requests[0].categories, []);
});

test("reconcileSeekingState uses Date observedAt when now is omitted", () => {
  const next = reconcileSeekingState(null, [], {
    observedAt: "2026-11-04T12:00:00.000Z",
  });
  assert.equal(next.generated_at, "2026-11-04T12:00:00.000Z");
  assert.equal(next.origins.length, 0);
});

test("isSeekingPublishEnabled accepts 1", () => {
  const previous = process.env.JOSHTERNET_SEEKING_PUBLISH;
  try {
    process.env.JOSHTERNET_SEEKING_PUBLISH = "1";
    assert.equal(isSeekingPublishEnabled(), true);
  } finally {
    if (previous === undefined) {
      delete process.env.JOSHTERNET_SEEKING_PUBLISH;
    } else {
      process.env.JOSHTERNET_SEEKING_PUBLISH = previous;
    }
  }
});

test("seekingFromHtml rejects empty and invalid contact hrefs", () => {
  const emptyHref = `
    <article class="h-listing">
      <span class="p-action">wanted</span>
      <div class="e-description">Need empty-href coverage.</div>
      <a class="u-url" href="">contact</a>
    </article>
  `;
  const badHref = `
    <article class="h-listing">
      <span class="p-action">wanted</span>
      <div class="e-description">Need invalid-href coverage.</div>
      <a class="u-url" href="http://[">contact</a>
    </article>
  `;
  assert.equal(
    seekingFromHtml(emptyHref, "https://joshua.example/seeking/", {
      siteOrigin: "https://joshua.example",
    }).requests[0].contact_url,
    "",
  );
  assert.equal(
    seekingFromHtml(badHref, "https://joshua.example/seeking/", {
      siteOrigin: "https://joshua.example",
    }).requests[0].contact_url,
    "",
  );
});

test("reconcileSeekingState keeps prior when complete crawl misses Seeking page", () => {
  const prior = {
    origins: [
      {
        origin: "https://joshua.example",
        title: "Harbor Notes",
        last_checked: "2026-11-03T00:00:00.000Z",
        requests: [
          {
            identity: "keep",
            description: "Still wanted",
            categories: [],
            source_url: "https://joshua.example/seeking/",
          },
        ],
      },
    ],
  };
  const next = reconcileSeekingState(
    prior,
    [
      {
        origin: "https://joshua.example",
        title: "Harbor Notes",
        complete: true,
        pages: [
          {
            url: "https://joshua.example/about/",
            html: "<p>No seeking here</p>",
          },
        ],
      },
    ],
    { observedAt: "2026-11-04T12:00:00.000Z" },
  );
  assert.equal(next.origins[0].requests[0].description, "Still wanted");
});

test("reconcileSeekingState drops origins with empty or invalid last_checked", () => {
  const next = reconcileSeekingState(
    {
      origins: [
        {
          origin: "https://a.joshua.example",
          last_checked: "",
          requests: [{ description: "a", categories: [], source_url: "" }],
        },
        {
          origin: "https://b.joshua.example",
          last_checked: "not-a-date",
          requests: [{ description: "b", categories: [], source_url: "" }],
        },
      ],
    },
    [],
    { observedAt: "2026-11-04T12:00:00.000Z" },
  );
  assert.equal(next.origins.length, 0);
});

test("writeSeekingViewFromState works when state file is missing", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seeking-missing-"));

  try {
    const view = await writeSeekingViewFromState(tmp);
    assert.equal(view.status, "empty");
    assert.ok(fs.existsSync(path.join(tmp, "_data", "seeking.json")));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("nestedItemName returns empty when p-item is absent or unclosed", () => {
  const noItem = `
    <article class="h-listing">
      <span class="p-action">wanted</span>
      <div class="e-description">No nested item here.</div>
    </article>
  `;
  assert.equal(
    seekingFromHtml(noItem, "https://joshua.example/seeking/", {
      siteOrigin: "https://joshua.example",
    }).requests[0].item_name,
    "",
  );

  const unclosedItem = `
    <article class="h-listing">
      <span class="p-action">wanted</span>
      <div class="e-description">Unclosed nested item.</div>
      <div class="p-item"><span class="p-name">Orphan
    </article>
  `;
  assert.equal(
    seekingFromHtml(unclosedItem, "https://joshua.example/seeking/", {
      siteOrigin: "https://joshua.example",
    }).requests[0].item_name,
    "",
  );
});
