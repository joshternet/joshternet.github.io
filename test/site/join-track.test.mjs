/**
 * Goal: join.js emits join-start once on first intentional action, not on load.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = await readFile(
  fileURLToPath(new URL("../../assets/js/join.js", import.meta.url)),
  "utf8",
);

/**
 * @typedef {{ name: string, data?: Record<string, string> }} TrackCall
 */

/**
 * Minimal element stub with attribute and click listeners.
 */
class FakeEl {
  /**
   * @param {string} tag
   * @param {Record<string, string>} [attrs]
   */
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    /** @type {Map<string, Function[]>} */
    this.listeners = new Map();
    /** @type {FakeEl[]} */
    this.children = [];
    this.textContent = attrs.text || "";
    this.id = attrs.id || "";
  }

  /**
   * @param {string} name
   * @returns {string | null}
   */
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name)
      ? this.attrs[name]
      : null;
  }

  /**
   * @param {string} selector
   * @returns {FakeEl | null}
   */
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  /**
   * @param {string} selector
   * @returns {FakeEl[]}
   */
  querySelectorAll(selector) {
    const out = [];

    /**
     * @param {FakeEl} node
     * @returns {void}
     */
    const visit = (node) => {
      if (matches(node, selector)) {
        out.push(node);
      }

      for (const child of node.children) {
        visit(child);
      }
    };

    visit(this);
    return out;
  }

  /**
   * @param {string} type
   * @param {Function} handler
   * @returns {void}
   */
  addEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }

  /**
   * @param {string} type
   * @returns {Promise<void>}
   */
  async click(type = "click") {
    const list = this.listeners.get(type) || [];

    for (const handler of list) {
      // eslint-disable-next-line no-await-in-loop
      await handler({ type });
    }
  }
}

/**
 * @param {FakeEl} node
 * @param {string} selector
 * @returns {boolean}
 */
function matches(node, selector) {
  if (selector.startsWith(".")) {
    return (node.attrs.class || "").split(/\s+/).includes(selector.slice(1));
  }

  if (selector.startsWith("#")) {
    return node.id === selector.slice(1);
  }

  const attr = selector.match(/^\[([^\]]+)\]$/);

  if (attr) {
    return Object.prototype.hasOwnProperty.call(node.attrs, attr[1]);
  }

  return false;
}

/**
 * @param {{
 *   trackImpl?: (name: string, data?: Record<string, string>) => void,
 *   clipboardFail?: boolean,
 * }} [options]
 * @returns {{
 *   calls: TrackCall[],
 *   copyButton: FakeEl,
 *   platformLink: FakeEl,
 *   checkLink: FakeEl,
 *   nominateLink: FakeEl,
 *   shareLink: FakeEl,
 *   storage: Map<string, string>,
 * }}
 */
function loadJoin(options = {}) {
  /** @type {TrackCall[]} */
  const calls = [];
  const storage = new Map();

  const copyButton = new FakeEl("button", {
    "data-join-copy": "join-declaration-affirmed",
    "data-join-identity": "affirmed",
    class: "join-copy",
  });
  const codeBlock = new FakeEl("pre", {
    id: "join-declaration-affirmed",
    text: '{\n  "version": 1,\n  "josh": true\n}',
  });
  codeBlock.textContent = '{\n  "version": 1,\n  "josh": true\n}';
  const platformLink = new FakeEl("a", {
    "data-join-platform": "jekyll",
    href: "/implement/platforms/jekyll/",
  });
  const checkLink = new FakeEl("a", {
    "data-join-check-open": "",
    href: "/implement/validate/",
  });
  const nominateLink = new FakeEl("a", {
    "data-join-nominate-open": "",
    href: "/nominate/",
  });
  const shareLink = new FakeEl("a", {
    "data-join-share": "network",
    href: "/network/",
  });
  const status = new FakeEl("p", { "data-join-copy-status": "" });
  const steps = new FakeEl("ol", { class: "join-steps" });
  steps.children.push(
    copyButton,
    codeBlock,
    platformLink,
    checkLink,
    nominateLink,
    shareLink,
    status,
  );

  const body = new FakeEl("body");
  /** @type {FakeEl[]} */
  const appended = [];

  const document = {
    /**
     * @param {string} selector
     * @returns {FakeEl | null}
     */
    querySelector(selector) {
      if (selector === ".join-steps") {
        return steps;
      }

      if (selector === "[data-join-copy-status]") {
        return status;
      }

      return steps.querySelector(selector);
    },
    /**
     * @param {string} selector
     * @returns {FakeEl[]}
     */
    querySelectorAll(selector) {
      return steps.querySelectorAll(selector);
    },
    /**
     * @param {string} id
     * @returns {FakeEl | null}
     */
    getElementById(id) {
      return id === codeBlock.id ? codeBlock : null;
    },
    body: {
      /**
       * @param {FakeEl} node
       * @returns {void}
       */
      append(node) {
        appended.push(node);
      },
    },
    /**
     * @param {string} tag
     * @returns {FakeEl}
     */
    createElement(tag) {
      return new FakeEl(tag);
    },
  };

  const context = {
    document,
    globalThis: /** @type {Record<string, unknown>} */ ({}),
    navigator: {
      clipboard: options.clipboardFail
        ? {
            /**
             * @returns {Promise<void>}
             */
            async writeText() {
              throw new Error("denied");
            },
          }
        : {
            /**
             * @returns {Promise<void>}
             */
            async writeText() {},
          },
    },
    sessionStorage: {
      /**
       * @param {string} key
       * @returns {string | null}
       */
      getItem(key) {
        return storage.has(key) ? storage.get(key) || null : null;
      },
      /**
       * @param {string} key
       * @param {string} value
       * @returns {void}
       */
      setItem(key, value) {
        storage.set(key, value);
      },
    },
  };

  context.globalThis = context;
  context.globalThis.joshternetTrack =
    options.trackImpl ||
    /**
     * @param {string} name
     * @param {Record<string, string>} [data]
     * @returns {void}
     */
    ((name, data) => {
      calls.push(data ? { name, data } : { name });
    });
  context.globalThis.sessionStorage = context.sessionStorage;
  context.globalThis.document = document;
  context.globalThis.navigator = context.navigator;

  runInNewContext(source, context);

  return {
    calls,
    copyButton,
    platformLink,
    checkLink,
    nominateLink,
    shareLink,
    storage,
  };
}

/**
 * deepStrictEqual fails across vm realms for nested data objects.
 * @param {unknown} actual
 * @param {unknown} expected
 * @returns {void}
 */
function assertJsonEqual(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}

test("loading join.js emits no join-start", () => {
  const { calls } = loadJoin();

  assertJsonEqual(calls, []);
});

test("first platform click emits join-start then join-platform once", async () => {
  const { calls, platformLink, checkLink } = loadJoin();

  await platformLink.click();
  assertJsonEqual(calls, [
    { name: "join-start" },
    { name: "join-platform", data: { platform: "jekyll" } },
  ]);

  await checkLink.click();
  assertJsonEqual(calls, [
    { name: "join-start" },
    { name: "join-platform", data: { platform: "jekyll" } },
    { name: "join-check-open" },
  ]);
});

test("successful copy emits join-start then join-declaration-copy", async () => {
  const { calls, copyButton } = loadJoin();

  await copyButton.click();
  assertJsonEqual(calls, [
    { name: "join-start" },
    { name: "join-declaration-copy", data: { identity: "affirmed" } },
  ]);
});

test("failed clipboard does not emit join-declaration-copy", async () => {
  const { calls, copyButton } = loadJoin({ clipboardFail: true });

  await copyButton.click();
  assertJsonEqual(calls, [{ name: "join-start" }]);
});

test("share click does not emit join-start", async () => {
  const { calls, shareLink } = loadJoin();

  await shareLink.click();
  assertJsonEqual(calls, [
    { name: "join-share-open", data: { target: "network" } },
  ]);
});

test("tracking throw does not break join handlers", async () => {
  const { platformLink } = loadJoin({
    trackImpl() {
      throw new Error("umami down");
    },
  });

  await assert.doesNotReject(async () => {
    await platformLink.click();
  });
});
