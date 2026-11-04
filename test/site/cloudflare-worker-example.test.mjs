import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const snippetPath = path.join(root, "_includes/snippets/cloudflare-worker.js");

/**
 * Loads the documentation Worker module.
 * @returns {Promise<{
 *   default: { fetch: (request: Request, env: object) => Promise<Response> },
 *   resolveDeclaration: (identity: unknown) => object,
 *   declarationHeaders: () => Record<string, string>,
 * }>}
 */
async function loadWorker() {
  return import(`${pathToFileURL(snippetPath).href}?t=${Date.now()}`);
}

test("cloudflare worker snippet resolves identity settings", async () => {
  const { resolveDeclaration } = await loadWorker();

  assert.deepEqual(resolveDeclaration(undefined), {
    ok: true,
    body: { version: 1 },
  });
  assert.deepEqual(resolveDeclaration(""), {
    ok: true,
    body: { version: 1 },
  });
  assert.deepEqual(resolveDeclaration("undeclared"), {
    ok: true,
    body: { version: 1 },
  });
  assert.deepEqual(resolveDeclaration("affirmed"), {
    ok: true,
    body: { version: 1, josh: true },
  });
  assert.deepEqual(resolveDeclaration("declined"), {
    ok: true,
    body: { version: 1, josh: false },
  });
  assert.deepEqual(resolveDeclaration(" AFFIRMED "), {
    ok: true,
    body: { version: 1, josh: true },
  });

  const invalid = resolveDeclaration("maybe");
  assert.equal(invalid.ok, false);
  assert.match(invalid.message, /affirmed, declined, or undeclared/i);
  assert.equal(typeof invalid.body, "undefined");
});

test("cloudflare worker snippet serves declaration and pass-through", async () => {
  const worker = await loadWorker();
  const originBody = "origin-ok";
  const previousFetch = globalThis.fetch;
  // Mock origin pass-through — external boundary for fetch(request).
  globalThis.fetch = async () =>
    new Response(originBody, { status: 200, headers: { "X-Origin": "1" } });

  try {
    const affirmed = await worker.default.fetch(
      new Request("https://joshua.example/.well-known/josh"),
      { JOSH_IDENTITY: "affirmed" },
    );
    assert.equal(affirmed.status, 200);
    assert.match(
      affirmed.headers.get("content-type") || "",
      /application\/json/,
    );
    const affirmedJson = JSON.parse(await affirmed.text());
    assert.equal(affirmedJson.version, 1);
    assert.equal(typeof affirmedJson.version, "number");
    assert.equal(affirmedJson.josh, true);

    const declined = await worker.default.fetch(
      new Request("https://joshua.example/.well-known/josh"),
      { JOSH_IDENTITY: "declined" },
    );
    assert.equal(JSON.parse(await declined.text()).josh, false);

    const undeclared = await worker.default.fetch(
      new Request("https://joshua.example/.well-known/josh"),
      {},
    );
    const undeclaredJson = JSON.parse(await undeclared.text());
    assert.equal(undeclaredJson.version, 1);
    assert.equal("josh" in undeclaredJson, false);

    const head = await worker.default.fetch(
      new Request("https://joshua.example/.well-known/josh", {
        method: "HEAD",
      }),
      { JOSH_IDENTITY: "undeclared" },
    );
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.match(head.headers.get("content-type") || "", /application\/json/);

    const post = await worker.default.fetch(
      new Request("https://joshua.example/.well-known/josh", {
        method: "POST",
      }),
      { JOSH_IDENTITY: "undeclared" },
    );
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("allow"), "GET, HEAD");

    const badConfig = await worker.default.fetch(
      new Request("https://joshua.example/.well-known/josh"),
      { JOSH_IDENTITY: "unknown-value" },
    );
    assert.equal(badConfig.status, 500);
    assert.match(await badConfig.text(), /Invalid JOSH_IDENTITY/);

    const other = await worker.default.fetch(
      new Request("https://joshua.example/about/"),
      { JOSH_IDENTITY: "affirmed" },
    );
    assert.equal(other.status, 200);
    assert.equal(await other.text(), originBody);
    assert.equal(other.headers.get("x-origin"), "1");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("cloudflare worker recipe page embeds the snippet include", async () => {
  const page = await readFile(
    path.join(root, "implement/platforms/cloudflare-worker.md"),
    "utf8",
  );
  const snippet = await readFile(snippetPath, "utf8");

  assert.match(page, /snippets\/cloudflare-worker\.js/);
  assert.match(page, /```js/);
  assert.match(snippet, /resolveDeclaration/);
  assert.match(snippet, /Invalid JOSH_IDENTITY/);
  assert.match(snippet, /return fetch\(request\)/);
});

test("cloudflare worker snippet has no Liquid {{ so Jekyll can include it", async () => {
  const snippet = await readFile(snippetPath, "utf8");
  // Jekyll Liquid-parses {% include %} bodies; JSDoc object types like {{ ok: true }}
  // abort the site build.
  assert.doesNotMatch(snippet, /\{\{/);
});
