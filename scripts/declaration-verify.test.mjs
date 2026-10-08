import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { verifyOrigin } from "./declaration-verify.mjs";

/**
 * Starts a one-shot local HTTP server for declaration fixtures.
 * @param {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void} handler
 * @returns {Promise<{ origin: string, close: () => Promise<void> }>}
 */
function listen(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("expected TCP address"));
        return;
      }
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    });
  });
}

test("verifyOrigin accepts a valid affirmed declaration", async () => {
  const body = '{"version":1,"josh":true}';
  const { origin, close } = await listen((req, res) => {
    if (req.url === "/.well-known/josh") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  try {
    const report = await verifyOrigin(origin);
    assert.equal(report.status, 200);
    assert.equal(report.sameOrigin, true);
    assert.equal(report.classification.kind, "declaration");
    assert.equal(report.json?.ok, true);
    assert.equal(report.json?.identity, "affirmed");
    assert.match(report.contentType, /application\/json/);
  } finally {
    await close();
  }
});

test("verifyOrigin rejects string version without coercion", async () => {
  const { origin, close } = await listen((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"version":"1"}');
  });

  try {
    const report = await verifyOrigin(origin);
    assert.equal(report.json?.ok, false);
    assert.equal(report.classification.kind, "declaration");
  } finally {
    await close();
  }
});

test("verifyOrigin treats cross-origin redirects as unread", async () => {
  const { origin, close } = await listen((_req, res) => {
    res.writeHead(302, { Location: "https://other.invalid/.well-known/josh" });
    res.end();
  });

  try {
    const report = await verifyOrigin(origin);
    assert.equal(report.sameOrigin, false);
    assert.equal(report.classification.kind, "unread");
  } finally {
    await close();
  }
});

test("verifyOrigin maps 404 to unpublished", async () => {
  const { origin, close } = await listen((_req, res) => {
    res.writeHead(404);
    res.end("missing");
  });

  try {
    const report = await verifyOrigin(origin);
    assert.equal(report.classification.kind, "unpublished");
  } finally {
    await close();
  }
});
