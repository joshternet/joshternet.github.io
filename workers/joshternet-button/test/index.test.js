import assert from "node:assert/strict";
import test from "node:test";

import {
  BUTTON_ARTWORK_HEIGHT,
  BUTTON_ARTWORK_WIDTH,
  svgMarkupForState,
} from "../src/button-artwork.js";
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

test("each official state has 88 by 31 crisp SVG with a title and no raster", () => {
  for (const meta of Object.values(BUTTON_STATES)) {
    const markup = svgMarkupForState(meta.state, meta.alt);

    assert.match(
      markup,
      new RegExp(
        `viewBox="0 0 ${BUTTON_ARTWORK_WIDTH} ${BUTTON_ARTWORK_HEIGHT}"`,
      ),
    );
    assert.match(markup, /width="88"/);
    assert.match(markup, /height="31"/);
    assert.match(markup, /shape-rendering="crispEdges"/);
    assert.match(markup, new RegExp(`<title>${meta.alt}</title>`));
    assert.doesNotMatch(markup, /<image\b/i);
    assert.doesNotMatch(markup, /data:image/i);
    assert.doesNotMatch(markup, /\.png/i);
  }

  assert.equal(svgMarkupForState("unavailable", "x"), "");
});

test("affirmed registry origin returns verified-josh JSON without imageURL", async () => {
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
    assert.equal(body.linkLabel, BUTTON_STATES["verified-josh"].linkLabel);
    assert.equal(body.href, "https://joshternet.org/network/");
    assert.equal(Object.hasOwn(body, "imageURL"), false);
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
    assert.equal(unknown.linkLabel, BUTTON_STATES.join.linkLabel);
    assert.equal(Object.hasOwn(unknown, "imageURL"), false);
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

test("retired image routes fail closed", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => registryResponse(registryFixture);

  try {
    const button = await worker.fetch(
      request("/button", "https://affirmed.example"),
      {
        SITE_ORIGIN: "https://joshternet.org",
      },
    );
    const asset = await worker.fetch(
      request("/buttons/verified-josh.png", null),
      {
        SITE_ORIGIN: "https://joshternet.org",
      },
    );
    const buttonBody = await button.json();
    const assetBody = await asset.json();

    assert.equal(button.status, 404);
    assert.equal(asset.status, 404);
    assert.equal(buttonBody.code, "not_found");
    assert.equal(assetBody.code, "not_found");
  } finally {
    globalThis.fetch = previous;
  }
});

test("embed script inserts inline SVG after button-state and never loads an image file", () => {
  const source = buildEmbedScript({
    version: "test",
    siteOrigin: "https://joshternet.org",
  });

  assert.match(source, /window\.location\.origin/);
  assert.match(source, /\/api\/button-state\?origin=/);
  assert.match(source, /state === "unavailable"/);
  assert.match(source, /innerHTML = artwork\[payload\.state\]/);
  assert.doesNotMatch(source, /\/button\?origin=/);
  assert.doesNotMatch(source, /img\.src/);
  assert.doesNotMatch(source, /imageURL/);
  assert.match(source, /viewBox=\\"0 0 88 31\\"/);
  assert.match(source, /<title>Verified Josh, Joshternet site<\/title>/);
  assert.doesNotMatch(source, /<image\b/i);
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
  assert.match(body, /innerHTML = artwork\[payload\.state\]/);
});
