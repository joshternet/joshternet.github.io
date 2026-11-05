/**
 * Goal: Cover shared SSRF route/body helpers without live network.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PUBLIC_FETCH_REDIRECTS,
  continueIfPublicUrl,
  installPublicUrlRouteGuard,
  readCappedResponseBytes,
} from "../../scripts/network/public-fetch-guard.mjs";

test("MAX_PUBLIC_FETCH_REDIRECTS matches preview hop ceiling", () => {
  assert.equal(MAX_PUBLIC_FETCH_REDIRECTS, 5);
});

test("readCappedResponseBytes truncates streamed bodies", async () => {
  let reads = 0;
  const body = {
    getReader() {
      return {
        async read() {
          reads += 1;
          if (reads === 1) {
            return { done: false, value: Uint8Array.from([1, 2, 3, 4]) };
          }
          return { done: true, value: undefined };
        },
        async cancel() {},
      };
    },
  };

  const buffer = await readCappedResponseBytes(
    { headers: { get: () => null }, body },
    2,
    { overflow: "truncate" },
  );
  assert.deepEqual([...buffer], [1, 2]);
});

test("readCappedResponseBytes ignores cancel failures on overflow", async () => {
  let reads = 0;
  const throwingCancelBody = {
    getReader() {
      return {
        async read() {
          reads += 1;
          return { done: false, value: Uint8Array.from([1, 2, 3, 4]) };
        },
        async cancel() {
          throw new Error("cancel failed");
        },
      };
    },
  };

  await assert.rejects(
    () =>
      readCappedResponseBytes(
        { headers: { get: () => null }, body: throwingCancelBody },
        2,
        { overflow: "throw" },
      ),
    /Response exceeds 2 bytes/,
  );

  reads = 0;
  const truncated = await readCappedResponseBytes(
    {
      headers: { get: () => null },
      body: {
        getReader() {
          return {
            async read() {
              reads += 1;
              return { done: false, value: Uint8Array.from([9, 8, 7, 6]) };
            },
            async cancel() {
              throw new Error("cancel failed");
            },
          };
        },
      },
    },
    2,
    { overflow: "truncate" },
  );
  assert.deepEqual([...truncated], [9, 8]);
});

test("readCappedResponseBytes reports a short body when Content-Length is larger", async () => {
  const detail = {};
  const buffer = await readCappedResponseBytes(
    {
      headers: { get: () => "10" },
      arrayBuffer: async () => Buffer.from("abcd"),
    },
    100,
    { detail },
  );
  assert.equal(buffer.toString(), "abcd");
  assert.equal(detail.bodyComplete, false);
  assert.equal(detail.bytesReceived, 4);
});

test("readCappedResponseBytes throws when Content-Length exceeds the cap", async () => {
  await assert.rejects(
    () =>
      readCappedResponseBytes(
        {
          headers: { get: () => "50" },
          arrayBuffer: async () => Buffer.from("nope"),
        },
        2,
        { overflow: "throw" },
      ),
    /Content-Length/,
  );
});

test("readCappedResponseBytes rejects a response with no body", async () => {
  await assert.rejects(
    () => readCappedResponseBytes({ headers: { get: () => null } }, 10),
    /no readable body/,
  );
});

test("readCappedResponseBytes marks a short stream incomplete", async () => {
  const detail = {};
  const buffer = await readCappedResponseBytes(
    {
      headers: { get: () => "8" },
      body: {
        getReader() {
          return {
            async read() {
              return { done: true, value: undefined };
            },
          };
        },
      },
    },
    10,
    { detail },
  );
  assert.equal(buffer.length, 0);
  assert.equal(detail.bodyComplete, false);
});

test("readCappedResponseBytes skips empty stream chunks", async () => {
  let reads = 0;
  const buffer = await readCappedResponseBytes(
    {
      headers: { get: () => null },
      body: {
        getReader() {
          return {
            async read() {
              reads += 1;
              if (reads === 1) {
                return { done: false, value: new Uint8Array() };
              }
              if (reads === 2) {
                return { done: false, value: undefined };
              }
              return { done: true, value: undefined };
            },
          };
        },
      },
    },
    10,
  );
  assert.equal(buffer.length, 0);
});

test("readCappedResponseBytes drops a chunk that starts past the cap", async () => {
  let reads = 0;
  const buffer = await readCappedResponseBytes(
    {
      headers: { get: () => null },
      body: {
        getReader() {
          return {
            async read() {
              reads += 1;
              if (reads === 1) {
                return { done: false, value: Uint8Array.from([1, 2]) };
              }
              return { done: false, value: Uint8Array.from([3]) };
            },
            async cancel() {},
          };
        },
      },
    },
    2,
    { overflow: "truncate" },
  );
  assert.deepEqual([...buffer], [1, 2]);
});

test("readCappedResponseBytes ignores a non-object detail sink", async () => {
  const buffer = await readCappedResponseBytes(
    {
      arrayBuffer: async () => Buffer.from("ab"),
    },
    10,
    { detail: 1 },
  );
  assert.equal(buffer.toString(), "ab");
});

test("continueIfPublicUrl aborts non-http schemes", async () => {
  /** @type {string[]} */
  const outcomes = [];
  await continueIfPublicUrl(
    {
      request: () => ({ url: () => "javascript:alert(1)" }),
      abort: async (reason) => {
        outcomes.push(`abort:${reason || ""}`);
      },
      continue: async () => {
        outcomes.push("continue");
      },
    },
    {},
  );
  assert.deepEqual(outcomes, ["abort:blockedbyclient"]);
});

test("continueIfPublicUrl aborts private requests", async () => {
  /** @type {string[]} */
  const outcomes = [];
  await continueIfPublicUrl(
    {
      request: () => ({ url: () => "http://127.0.0.1/x" }),
      abort: async (reason) => {
        outcomes.push(`abort:${reason || ""}`);
      },
      continue: async () => {
        outcomes.push("continue");
      },
    },
    { lookup: async () => [{ address: "127.0.0.1", family: 4 }] },
  );
  assert.deepEqual(outcomes, ["abort:blockedbyclient"]);
});

test("installPublicUrlRouteGuard continues public http(s)", async () => {
  /** @type {string[]} */
  const outcomes = [];
  await installPublicUrlRouteGuard(
    {
      async route(_pattern, handler) {
        await handler({
          request: () => ({ url: () => "https://a.example/" }),
          abort: async (reason) => {
            outcomes.push(`abort:${reason || ""}`);
          },
          continue: async () => {
            outcomes.push("continue");
          },
        });
      },
    },
    { lookup: async () => [{ address: "1.1.1.1", family: 4 }] },
  );
  assert.deepEqual(outcomes, ["continue"]);
});
