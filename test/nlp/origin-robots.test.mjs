/**
 * Goal: Cached origin robots gate for member crawls.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  createOriginRobotsGate,
  originFromHref,
} from "../../scripts/nlp/origin-robots.mjs";
import { USER_AGENT } from "../../scripts/nlp/lib.mjs";
import { dnsCache, install, restore } from "../helpers/mock-fetch.mjs";

test("originFromHref reads http(s) origins only", () => {
  assert.equal(originFromHref("https://a.example/path"), "https://a.example");
  assert.equal(originFromHref("http://a.example/"), "http://a.example");
  assert.equal(originFromHref("mailto:a@example"), "");
  assert.equal(originFromHref(""), "");
  assert.equal(originFromHref("not-a-url"), "");
});

test("USER_AGENT matches documented JoshBot crawler identity", () => {
  assert.equal(
    USER_AGENT,
    "Joshternet-Joshbot (+https://joshternet.org/joshbot)",
  );
});

test("createOriginRobotsGate defaults to Joshternet-Joshbot product token", async () => {
  const gate = createOriginRobotsGate({
    fetchPublicText: async () => ({
      url: "https://a.example/robots.txt",
      contentType: "text/plain",
      body: "User-agent: Joshternet-Joshbot\nDisallow: /blocked/\n",
    }),
  });
  assert.equal(await gate.allows("https://a.example/blocked/x"), false);
  assert.equal(await gate.allows("https://a.example/ok"), true);
});

test("createOriginRobotsGate caches robots.txt and honors Disallow", async () => {
  /** @type {string[]} */
  const requested = [];
  const gate = createOriginRobotsGate({
    userAgent: USER_AGENT,
    fetchPublicText: async (href) => {
      requested.push(href);

      if (href.endsWith("/robots.txt")) {
        return {
          url: href,
          contentType: "text/plain",
          body: "User-agent: *\nDisallow: /private/\nAllow: /\n",
        };
      }

      throw new Error(`unexpected ${href}`);
    },
  });

  assert.equal(await gate.allows("https://a.example/public/"), true);
  assert.equal(await gate.allows("https://a.example/private/secret"), false);
  assert.equal(await gate.allows("https://a.example/private/secret"), false);
  assert.equal(
    requested.filter((href) => href.endsWith("/robots.txt")).length,
    1,
  );
  assert.equal(await gate.allows("mailto:x@example"), false);
  assert.equal(await gate.allows("ftp://a.example/file"), false);
});

test("createOriginRobotsGate defers when robots.txt cannot be fetched", async () => {
  const gate = createOriginRobotsGate({
    fetchPublicText: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(await gate.allows("https://a.example/anything"), false);
  assert.equal(await gate.allows("https://a.example"), false);
  assert.equal(await gate.bodyForOrigin(""), "");
  const missing = await gate.outcomeForOrigin("");
  assert.equal(missing.decision, "defer");
});

test("createOriginRobotsGate allows when robots.txt is 404", async () => {
  const gate = createOriginRobotsGate({
    fetchPublicText: async () => ({
      url: "https://a.example/robots.txt",
      status: 404,
      body: "",
      body_complete: true,
    }),
  });
  assert.equal(await gate.allows("https://a.example/anything"), true);
  const outcome = await gate.outcomeForOrigin("https://a.example");
  assert.equal(outcome.decision, "absent");
});

test("createOriginRobotsGate uses the caller-supplied User-Agent product token", async () => {
  const gate = createOriginRobotsGate({
    userAgent: "OtherBot/1.0",
    fetchPublicText: async () => ({
      url: "https://a.example/robots.txt",
      contentType: "text/plain",
      body: "User-agent: OtherBot\nDisallow: /blocked/\n",
    }),
  });
  assert.equal(await gate.allows("https://a.example/blocked/x"), false);
  assert.equal(await gate.allows("https://a.example/ok"), true);
});

test("createOriginRobotsGate defers when the robots body is unusable", async () => {
  const gate = createOriginRobotsGate({
    fetchPublicText: async () => ({
      url: "https://a.example/robots.txt",
      status: 200,
      contentType: "text/plain",
      body: 12,
      body_complete: false,
    }),
  });
  assert.equal(await gate.allows("https://a.example/anywhere"), false);
});

test("createOriginRobotsGate reuses a cached policy when the refresh fails", async () => {
  const policyCache = new Map([
    [
      "https://a.example",
      {
        body: "User-agent: *\nDisallow: /private/\n",
        bodyComplete: true,
      },
    ],
  ]);
  const gate = createOriginRobotsGate({
    policyCache,
    fetchPublicText: async () => {
      throw new Error("timeout");
    },
  });
  assert.equal(await gate.allows("https://a.example/private/x"), false);
  assert.equal(await gate.allows("https://a.example/ok"), true);
});

test("createOriginRobotsGate default fetchPublicText uses lib helper", async () => {
  const cache = dnsCache(["defaultfetch.example"]);
  install();
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      arrayBuffer: async () => Buffer.from("User-agent: *\nDisallow: /nope/\n"),
    });
    const gate = createOriginRobotsGate({ cache });
    assert.equal(
      await gate.allows("https://defaultfetch.example/nope/x"),
      false,
    );
    assert.equal(await gate.allows("https://defaultfetch.example/yes"), true);
  } finally {
    restore();
  }
});
