/**
 * Goal: 100% line/branch/function coverage for scripts/nlp/octothorpes.mjs.
 * All tests are offline — mock fetch only, never live network.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { subjectsFromOctothorpes } from "../../scripts/nlp/octothorpes.mjs";
import { dnsCache, install, restore } from "../helpers/mock-fetch.mjs";

const ORIGIN = "https://a.example";

/**
 * Installs a mock fetch that serves octothorp.es API responses.
 * External HTTP boundary — real fetch replaced by mock stub.
 *
 * @param {{
 *   thorpes?: object,
 *   pages?: object,
 *   thorpeError?: boolean,
 *   pagesError?: boolean,
 * }} options
 */
function setupMock(options = {}) {
  const {
    thorpes = { results: [] },
    pages = { results: [] },
    thorpeError = false,
    pagesError = false,
  } = options;

  install();
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes("/get/thorpes/posted")) {
      if (thorpeError) throw new Error("simulated thorpes error");
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        arrayBuffer: async () => Buffer.from(JSON.stringify(thorpes)),
      };
    }
    if (urlStr.includes("/get/pages/thorped")) {
      if (pagesError) throw new Error("simulated pages error");
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        arrayBuffer: async () => Buffer.from(JSON.stringify(pages)),
      };
    }
    throw new Error(`mock-fetch: no handler for ${urlStr}`);
  };
}

test("subjectsFromOctothorpes: returns empty when thorpes API fails", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({ thorpeError: true });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.deepEqual(subjects, []);
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: returns empty when no results", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({ thorpes: { results: [] } });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.deepEqual(subjects, []);
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: parses term from entry object", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({
    thorpes: { results: [{ term: "Photography" }, { term: "Design" }] },
    pages: { results: [] },
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    const slugs = subjects.map((s) => s.slug);
    assert.ok(slugs.includes("photography"));
    assert.ok(slugs.includes("design"));
    assert.ok(subjects[0].sources.includes("octothorpe"));
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: parses term from plain string entry", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({
    thorpes: { results: ["IndieWeb"] },
    pages: { results: [] },
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.ok(subjects.some((s) => s.slug === "indieweb"));
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: entry with no term is skipped", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({
    thorpes: {
      results: [
        { other: "field" }, // no term
        { term: "Photography" },
      ],
    },
    pages: { results: [] },
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].slug, "photography");
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: empty/whitespace term is skipped", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({
    thorpes: { results: [{ term: "   " }, { term: "Cycling" }] },
    pages: { results: [] },
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].slug, "cycling");
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: pages from same origin are attached", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({
    thorpes: { results: [{ term: "Photography" }] },
    pages: {
      results: [
        { uri: `${ORIGIN}/photography-post/`, title: "My photos" },
        { uri: "https://other.example/post/", title: "Other" }, // different origin → skipped
      ],
    },
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].pages.length, 1);
    assert.equal(subjects[0].pages[0].url, `${ORIGIN}/photography-post/`);
    assert.equal(subjects[0].pages[0].title, "My photos");
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: page with @id instead of uri is used", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({
    thorpes: { results: [{ term: "Maps" }] },
    pages: {
      results: [{ "@id": `${ORIGIN}/maps-post/`, title: "A map" }],
    },
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.equal(subjects[0].pages.length, 1);
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: page without uri or @id is skipped", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({
    thorpes: { results: [{ term: "Books" }] },
    pages: {
      results: [
        { title: "No uri here" }, // no uri or @id
      ],
    },
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.equal(subjects[0].pages.length, 0);
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: page with invalid URI is skipped", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({
    thorpes: { results: [{ term: "Hiking" }] },
    pages: {
      results: [{ uri: "not-a-valid-url" }],
    },
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.equal(subjects[0].pages.length, 0);
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: pages fetch error → pages stay empty and continues", async () => {
  const cache = dnsCache(["octothorp.es"]);
  setupMock({
    thorpes: { results: [{ term: "Photography" }] },
    pagesError: true,
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].pages.length, 0);
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: pages are capped at 5", async () => {
  const cache = dnsCache(["octothorp.es"]);
  const manyPages = Array.from({ length: 10 }, (_, i) => ({
    uri: `${ORIGIN}/post-${i}/`,
  }));
  setupMock({
    thorpes: { results: [{ term: "Photography" }] },
    pages: { results: manyPages },
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.ok(subjects[0].pages.length <= 5);
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: only first 20 subjects get page lookup", async () => {
  const cache = dnsCache(["octothorp.es"]);
  const manyTerms = Array.from({ length: 25 }, (_, i) => ({
    term: `term${i}`,
  }));
  let pagesFetchCount = 0;
  install();
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes("/get/thorpes/posted")) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        arrayBuffer: async () =>
          Buffer.from(JSON.stringify({ results: manyTerms })),
      };
    }
    if (urlStr.includes("/get/pages/thorped")) {
      pagesFetchCount++;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        arrayBuffer: async () => Buffer.from(JSON.stringify({ results: [] })),
      };
    }
    throw new Error("unexpected");
  };
  try {
    await subjectsFromOctothorpes(ORIGIN, cache);
    assert.equal(pagesFetchCount, 20);
  } finally {
    restore();
  }
});

// ─── Phase-3 branch gap closers ───────────────────────────────────────────────

test("subjectsFromOctothorpes: non-array thorpes results falls back to [] (L25)", async () => {
  const cache = dnsCache(["octothorp.es"]);
  // results is null → Array.isArray(null) = false → ': []' branch fires (L25)
  setupMock({ thorpes: { results: null } });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.deepEqual(subjects, []);
  } finally {
    restore();
  }
});

test("subjectsFromOctothorpes: non-array pages results falls back to [] (L59)", async () => {
  const cache = dnsCache(["octothorp.es"]);
  // Thorpes returns 1 valid subject; pages returns wrong key → ': []' fires at L59
  setupMock({
    thorpes: { results: [{ term: "design" }] },
    pages: { data: [] }, // not { results: [...] }
  });
  try {
    const subjects = await subjectsFromOctothorpes(ORIGIN, cache);
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].pages.length, 0);
  } finally {
    restore();
  }
});
