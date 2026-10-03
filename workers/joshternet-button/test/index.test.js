import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BUTTON_STATES,
  buttonStateForOrigin,
  buildRegistryIndex,
  identityFromDeclaration,
  stateFromIdentity,
} from "../src/button-state.js";
import { buildEmbedScript } from "../src/embed-script.js";
import { normalizeButtonOrigin } from "../src/origin.js";
import worker from "../src/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const siteButtons = path.resolve(root, "../../assets/buttons");

/**
 * @param {Buffer} bytes
 * @returns {{ width: number, height: number }}
 */
function pngDimensions(bytes) {
  assert.equal(bytes.subarray(0, 8).toString("binary"), "\x89PNG\r\n\x1a\n");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

const registryFixture = {
  format_version: 1,
  nodes: [
    {
      origin: "https://affirmed.example",
      latest_declaration_check_outcome: "valid",
      declaration: {
        version: 1,
        josh: true,
      },
    },
    {
      origin: "https://declined.example",
      latest_declaration_check_outcome: "valid",
      declaration: {
        version: 1,
        josh: false,
      },
    },
    {
      origin: "https://undeclared.example",
      latest_declaration_check_outcome: "valid",
      declaration: {
        version: 1,
      },
    },
    {
      origin: "https://former.example",
      latest_declaration_check_outcome: "missing",
      declaration: {
        version: 1,
        josh: true,
      },
    },
  ],
};

/**
 * @param {string} pathname
 * @param {string | null} origin
 * @param {RequestInit} [init]
 */
function request(pathname, origin, init = {}) {
  const url = new URL(pathname, "https://joshternet-button.test");

  if (origin) {
    url.searchParams.set("origin", origin);
  }

  return new Request(url, {
    method: "GET",
    ...init,
  });
}

/**
 * @param {unknown} body
 * @param {number} [status]
 */
function registryResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

test("identity mapping covers affirmed, declined, and undeclared", () => {
  assert.equal(identityFromDeclaration({ version: 1, josh: true }), "affirmed");
  assert.equal(
    identityFromDeclaration({ version: 1, josh: false }),
    "declined",
  );
  assert.equal(identityFromDeclaration({ version: 1 }), "undeclared");
  assert.equal(stateFromIdentity("affirmed"), "verified-josh");
  assert.equal(stateFromIdentity("declined"), "verified-non-josh");
  assert.equal(stateFromIdentity("undeclared"), "undeclared");
});

test("registry index maps participating origins and ignores non-participants", () => {
  const index = buildRegistryIndex(registryFixture);

  assert.equal(
    buttonStateForOrigin(index, "https://affirmed.example").state,
    "verified-josh",
  );
  assert.equal(
    buttonStateForOrigin(index, "https://declined.example").state,
    "verified-non-josh",
  );
  assert.equal(
    buttonStateForOrigin(index, "https://undeclared.example").state,
    "undeclared",
  );
  assert.equal(
    buttonStateForOrigin(index, "https://former.example").state,
    "join",
  );
  assert.equal(
    buttonStateForOrigin(index, "https://unknown.example").state,
    "join",
  );
});

test("normalizeButtonOrigin accepts defaults ports and rejects credentials", () => {
  assert.deepEqual(normalizeButtonOrigin("https://Example.COM:443/path"), {
    ok: true,
    origin: "https://example.com",
  });
  assert.deepEqual(normalizeButtonOrigin("http://example.com:80"), {
    ok: true,
    origin: "http://example.com",
  });
  assert.deepEqual(normalizeButtonOrigin("https://example.com:8443"), {
    ok: true,
    origin: "https://example.com:8443",
  });
  assert.equal(
    normalizeButtonOrigin("https://user:pass@example.com").ok,
    false,
  );
  assert.equal(normalizeButtonOrigin("ftp://example.com").ok, false);
  assert.equal(normalizeButtonOrigin("not a url").ok, false);
  assert.equal(normalizeButtonOrigin("").ok, false);
});

test("shipped button PNGs are exactly 88 by 31", async () => {
  for (const file of Object.values(BUTTON_STATES).map((state) => state.file)) {
    const bytes = await readFile(path.join(siteButtons, file));
    const size = pngDimensions(bytes);

    assert.equal(size.width, 88, file);
    assert.equal(size.height, 31, file);
  }
});

test("affirmed registry origin returns verified-josh JSON", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => registryResponse(registryFixture);

  try {
    const response = await worker.fetch(
      request("/api/button-state", "https://affirmed.example"),
      {
        SITE_ORIGIN: "https://joshternet.org",
      },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("content-type"),
      "application/json; charset=utf-8",
    );
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.match(response.headers.get("cache-control") || "", /max-age=300/);
    assert.equal(body.ok, true);
    assert.equal(body.state, "verified-josh");
    assert.equal(body.alt, BUTTON_STATES["verified-josh"].alt);
    assert.equal(
      body.imageURL,
      "https://joshternet.org/assets/buttons/verified-josh.png",
    );
    assert.equal(body.href, "https://joshternet.org/network/");
  } finally {
    globalThis.fetch = previous;
  }
});

test("unknown origin returns join and declined maps to verified-non-josh", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => registryResponse(registryFixture);

  try {
    const unknown = await (
      await worker.fetch(request("/api/button-state", "https://new.example"), {
        SITE_ORIGIN: "https://joshternet.org",
      })
    ).json();
    const declined = await (
      await worker.fetch(
        request("/api/button-state", "https://declined.example"),
        {
          SITE_ORIGIN: "https://joshternet.org",
        },
      )
    ).json();

    assert.equal(unknown.state, "join");
    assert.equal(unknown.href, "https://joshternet.org/implement/");
    assert.equal(declined.state, "verified-non-josh");
  } finally {
    globalThis.fetch = previous;
  }
});

test("registry failure does not falsely return join", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => registryResponse({ error: true }, 503);

  try {
    const response = await worker.fetch(
      request("/api/button-state", "https://affirmed.example"),
      {
        SITE_ORIGIN: "https://joshternet.org",
      },
    );
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.state, "unavailable");
    assert.notEqual(body.state, "join");
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    globalThis.fetch = previous;
  }
});

test("registry redirect fails closed instead of following", async () => {
  const previous = globalThis.fetch;
  /** @type {RequestInit | undefined} */
  let seenInit;
  globalThis.fetch = async (_input, init) => {
    seenInit = init;
    return new Response(null, {
      status: 302,
      headers: {
        Location: "https://evil.example/registry.json",
      },
    });
  };

  try {
    const response = await worker.fetch(
      request("/api/button-state", "https://affirmed.example"),
      {
        SITE_ORIGIN: "https://joshternet.org",
      },
    );
    const body = await response.json();

    assert.equal(seenInit?.redirect, "manual");
    assert.equal(response.status, 503);
    assert.equal(body.state, "unavailable");
  } finally {
    globalThis.fetch = previous;
  }
});

test("button image returns 204 when the registry is unavailable", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => registryResponse({ error: true }, 500);

  try {
    const response = await worker.fetch(
      request("/button", "https://affirmed.example"),
      {
        SITE_ORIGIN: "https://joshternet.org",
      },
    );

    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
  } finally {
    globalThis.fetch = previous;
  }
});

test("embed script detects location.origin and requests button-state", () => {
  const source = buildEmbedScript({
    version: "test",
    siteOrigin: "https://joshternet.org",
  });

  assert.match(source, /window\.location\.origin/);
  assert.match(source, /\/api\/button-state\?origin=/);
  assert.match(source, /\/button\?origin=/);
  assert.match(source, /img\.width = 88/);
  assert.match(source, /img\.height = 31/);
  assert.match(source, /state === "unavailable"/);
});

test("embed route returns javascript with nosniff", async () => {
  const response = await worker.fetch(
    request("/embed/joshternet-button.js", null),
    {
      SITE_ORIGIN: "https://joshternet.org",
      EMBED_VERSION: "test",
    },
  );
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "application/javascript; charset=utf-8",
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(body, /Joshternet button embed test/);
});
