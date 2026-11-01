/**
 * Goal: Blind probes for unlisted catalog paths; soft-404 skips; uncapped retain.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  crawlOrigin,
  isIdentitySlashPath,
  isSoft404Duplicate,
  probeSlashSeedUrls,
} from "../../scripts/nlp/crawl.mjs";
import { dnsCache, install, restore } from "../helpers/mock-fetch.mjs";

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/creative",
);

test("isIdentitySlashPath covers creative probe paths", () => {
  assert.equal(isIdentitySlashPath("/gallery"), true);
  assert.equal(isIdentitySlashPath("/now"), true);
  assert.equal(isIdentitySlashPath("/"), false);
});

test("probeSlashSeedUrls always includes catalog gallery/now", () => {
  const urls = probeSlashSeedUrls("https://a.example");
  assert.ok(urls.includes("https://a.example/gallery/"));
  assert.ok(urls.includes("https://a.example/now/"));
});

test("crawlOrigin blind-probes /now/ and /gallery/ with no menu links", async () => {
  const home = `<!DOCTYPE html><html><head><title>Home</title></head><body><p>No menu</p></body></html>`;
  const now = `<!DOCTYPE html><html><head><title>Now</title><link rel="canonical" href="https://blind.example/now/"></head><body><p>What I’m doing</p></body></html>`;
  const gallery = `<!DOCTYPE html><html><head><title>Gallery</title><link rel="canonical" href="https://blind.example/gallery/"></head><body><h1>Photos</h1></body></html>`;
  const cache = dnsCache(["blind.example"]);
  install();

  try {
    globalThis.fetch = async (input) => {
      const url = String(input);

      if (url === "https://blind.example/" || url === "https://blind.example") {
        return {
          ok: true,
          status: 200,
          url: "https://blind.example/",
          headers: new Headers({ "content-type": "text/html" }),
          arrayBuffer: async () => Buffer.from(home),
        };
      }

      if (url.includes("/now")) {
        return {
          ok: true,
          status: 200,
          url: "https://blind.example/now/",
          headers: new Headers({ "content-type": "text/html" }),
          arrayBuffer: async () => Buffer.from(now),
        };
      }

      if (url.includes("/gallery")) {
        return {
          ok: true,
          status: 200,
          url: "https://blind.example/gallery/",
          headers: new Headers({ "content-type": "text/html" }),
          arrayBuffer: async () => Buffer.from(gallery),
        };
      }

      return {
        ok: false,
        status: 404,
        url,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: async () => Buffer.from("missing"),
      };
    };

    const result = await crawlOrigin("https://blind.example", { cache });
    const urls = result.pages.map((page) => page.url);
    assert.ok(urls.includes("https://blind.example/now/"));
    assert.ok(urls.includes("https://blind.example/gallery/"));
    assert.equal(
      result.selection_reasons["https://blind.example/now/"],
      "blind-probe",
    );
    assert.equal(
      result.selection_reasons["https://blind.example/gallery/"],
      "blind-probe",
    );
  } finally {
    restore();
  }
});

test("soft-404 probe pages are not retained", async () => {
  const home = fs.readFileSync(
    path.join(fixtures, "soft404-home.html"),
    "utf8",
  );
  const cache = dnsCache(["soft404.example"]);
  install();

  try {
    globalThis.fetch = async (input) => {
      const url = String(input);

      if (url.includes("sitemap")) {
        return {
          ok: false,
          status: 404,
          url,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () => Buffer.from(""),
        };
      }

      // Soft-404: every slash path returns the homepage body + title.
      return {
        ok: true,
        status: 200,
        url: url.endsWith("/") ? url : `${url}/`,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: async () => Buffer.from(home),
      };
    };

    const result = await crawlOrigin("https://soft404.example", { cache });
    assert.ok(
      result.pages.some((page) => page.url === "https://soft404.example/"),
    );
    assert.ok(
      result.pages.every(
        (page) =>
          page.url === "https://soft404.example/" ||
          page.url === "https://soft404.example",
      ),
    );
  } finally {
    restore();
  }
});

test("isSoft404Duplicate still requires identity/probe path for fingerprint match", () => {
  assert.equal(
    isSoft404Duplicate({
      pageUrl: "https://a.example/random-page/",
      homeUrl: "https://a.example/",
      title: "Same",
      homeTitle: "Same",
      bodyFingerprint: "abc",
      homeBodyFingerprint: "abc",
    }),
    false,
  );
  assert.equal(
    isSoft404Duplicate({
      pageUrl: "https://a.example/gallery/",
      homeUrl: "https://a.example/",
      title: "Same",
      homeTitle: "Same",
      bodyFingerprint: "abc",
      homeBodyFingerprint: "abc",
    }),
    true,
  );
});

test("crawlOrigin seeds aboutUrl and aboutUrls", async () => {
  const pages = {
    "https://aboutseed.example/": `<!DOCTYPE html><html><head><title>Home</title></head><body>Home</body></html>`,
    "https://aboutseed.example/about/": `<!DOCTYPE html><html><head><title>About</title><link rel="canonical" href="https://aboutseed.example/about/"></head><body>About</body></html>`,
    "https://aboutseed.example/more/": `<!DOCTYPE html><html><head><title>More</title><link rel="canonical" href="https://aboutseed.example/more/"></head><body>More</body></html>`,
  };
  const cache = dnsCache(["aboutseed.example"]);
  install();

  try {
    globalThis.fetch = async (input) => {
      const requested = String(input);
      const url = requested.endsWith("/") ? requested : `${requested}/`;
      const body = pages[url] || pages[requested];

      if (body) {
        return {
          ok: true,
          status: 200,
          url,
          headers: new Headers({ "content-type": "text/html" }),
          arrayBuffer: async () => Buffer.from(body),
        };
      }

      return {
        ok: false,
        status: 404,
        url: requested,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: async () => Buffer.from(""),
      };
    };

    const result = await crawlOrigin("https://aboutseed.example", {
      cache,
      aboutUrl: "/about/",
      aboutUrls: ["/more/", ""],
    });
    assert.equal(
      result.selection_reasons["https://aboutseed.example/about/"],
      "about",
    );
    assert.equal(
      result.selection_reasons["https://aboutseed.example/more/"],
      "about",
    );
  } finally {
    restore();
  }
});

test("crawlOrigin retains more than 80 pages when the queue is large", async () => {
  const homeLinks = Array.from(
    { length: 100 },
    (_item, index) => `<a href="/p/${index}/">Post ${index}</a>`,
  ).join("\n");
  const home = `<!DOCTYPE html><html><head><title>Home</title></head><body>${homeLinks}</body></html>`;
  const cache = dnsCache(["big.example"]);
  install();

  try {
    globalThis.fetch = async (input) => {
      const url = String(input);

      if (url.includes("sitemap")) {
        return {
          ok: false,
          status: 404,
          url,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () => Buffer.from(""),
        };
      }

      if (url.includes("/p/")) {
        const match = url.match(/\/p\/(\d+)/);
        const n = match ? match[1] : "0";
        const body = `<!DOCTYPE html><html><head><title>Post ${n}</title><link rel="canonical" href="https://big.example/p/${n}/"></head><body>Post ${n}</body></html>`;
        return {
          ok: true,
          status: 200,
          url: `https://big.example/p/${n}/`,
          headers: new Headers({ "content-type": "text/html" }),
          arrayBuffer: async () => Buffer.from(body),
        };
      }

      // Blind probes and other seeds 404 so the queue is dominated by home children.
      if (!url.endsWith("big.example/") && !url.endsWith("big.example")) {
        return {
          ok: false,
          status: 404,
          url,
          headers: new Headers({ "content-type": "text/plain" }),
          arrayBuffer: async () => Buffer.from("missing"),
        };
      }

      return {
        ok: true,
        status: 200,
        url: "https://big.example/",
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: async () => Buffer.from(home),
      };
    };

    const result = await crawlOrigin("https://big.example", { cache });
    assert.ok(
      result.pages.length > 80,
      `expected >80 pages, got ${result.pages.length}`,
    );
  } finally {
    restore();
  }
});
