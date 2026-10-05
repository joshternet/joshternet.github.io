/**
 * Goal: outbound-referrer.js appends Joshternet UTM params to https URLs
 * and leaves http, relative, same-origin, credentialed, and tagged URLs alone.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = await readFile(
  fileURLToPath(
    new URL("../../assets/js/outbound-referrer.js", import.meta.url),
  ),
  "utf8",
);

/**
 * Loads the classic helper against a fake window location.
 * @param {string} pathname
 * @param {string} [origin]
 * @returns {{
 *   joshternetOutboundHref: (href: string) => string,
 *   joshternetDecorateOutboundLinks: Function,
 * }}
 */
function loadHelper(pathname, origin = "https://joshternet.org") {
  const context = {
    URL,
    location: {
      pathname,
      origin,
    },
  };

  runInNewContext(source, context);

  return context;
}

test("appends source, medium, campaign, and content to outbound https URLs", () => {
  const { joshternetOutboundHref } = loadHelper("/network/");
  const url = new URL(joshternetOutboundHref("https://safe.example/notes"));

  assert.equal(url.origin, "https://safe.example");
  assert.equal(url.pathname, "/notes");
  assert.equal(url.searchParams.get("utm_source"), "joshternet.org");
  assert.equal(url.searchParams.get("utm_medium"), "referral");
  assert.equal(url.searchParams.get("utm_campaign"), "network");
  assert.equal(url.searchParams.get("utm_content"), "/network/");
});

test("keeps existing query strings and fragments", () => {
  const { joshternetOutboundHref } = loadHelper("/topics/ai/");
  const url = new URL(
    joshternetOutboundHref("https://safe.example/post?foo=1#section"),
  );

  assert.equal(url.searchParams.get("foo"), "1");
  assert.equal(url.searchParams.get("utm_campaign"), "topics");
  assert.equal(url.hash, "#section");
});

test("does not rewrite unsafe, relative, same-origin, or pre-tagged URLs", () => {
  const { joshternetOutboundHref } = loadHelper("/network/");

  assert.equal(joshternetOutboundHref("/wander/"), "/wander/");
  assert.equal(
    joshternetOutboundHref("https://joshternet.org/privacy/"),
    "https://joshternet.org/privacy/",
  );
  assert.equal(
    joshternetOutboundHref("https://safe.example/?utm_source=already"),
    "https://safe.example/?utm_source=already",
  );
  assert.equal(
    joshternetOutboundHref("mailto:hello@joshternet.org"),
    "mailto:hello@joshternet.org",
  );
  assert.equal(
    joshternetOutboundHref("http://insecure.example/"),
    "http://insecure.example/",
  );
  assert.equal(
    joshternetOutboundHref("javascript:alert(1)"),
    "javascript:alert(1)",
  );
  assert.equal(
    joshternetOutboundHref("file:///etc/passwd"),
    "file:///etc/passwd",
  );
  assert.equal(joshternetOutboundHref("//evil.example/"), "//evil.example/");
  assert.equal(
    joshternetOutboundHref("https://user:pass@safe.example/"),
    "https://user:pass@safe.example/",
  );
});

test("decorateOutboundLinks skips rel=me identity links", () => {
  /**
   * @param {string} rel
   * @param {string} href
   */
  function fakeAnchor(rel, href) {
    return {
      rel,
      href,
      /**
       * @param {string} name
       * @returns {string}
       */
      getAttribute(name) {
        if (name === "rel") {
          return this.rel;
        }

        return this.href;
      },
      /**
       * @param {string} name
       * @param {string} value
       * @returns {void}
       */
      setAttribute(name, value) {
        if (name === "href") {
          this.href = value;
        }
      },
    };
  }

  const me = fakeAnchor("me noopener", "https://github.com/joshternet");
  const outbound = fakeAnchor("noopener", "https://safe.example/");
  const { joshternetDecorateOutboundLinks } = loadHelper("/network/");

  joshternetDecorateOutboundLinks({
    querySelectorAll() {
      return [me, outbound];
    },
  });

  assert.equal(me.href, "https://github.com/joshternet");
  assert.match(outbound.href, /utm_source=joshternet\.org/);
});
