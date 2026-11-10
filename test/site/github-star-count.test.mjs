/**
 * Goal: Live GitHub star count JS updates visible counts, uses session cache,
 * and fails closed without changing the build-time fallback.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = await readFile(
  fileURLToPath(
    new URL("../../assets/js/github-star-count.js", import.meta.url),
  ),
  "utf8",
);

/**
 * Minimal element stub for querySelector-based updates.
 */
class FakeEl {
  /**
   * @param {string} tag
   * @param {Record<string, string>} [attrs]
   */
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = { ...attrs };
    this.className = attrs.class || "";
    /** @type {FakeEl[]} */
    this.children = [];
    this.textContent = "";
    const element = this;
    this.classList = {
      /**
       * @param {string} token
       * @returns {void}
       */
      add(token) {
        const parts = element.className.split(/\s+/).filter(Boolean);

        if (!parts.includes(token)) {
          parts.push(token);
          element.className = parts.join(" ");
        }
      },
      /**
       * @param {string} token
       * @returns {void}
       */
      remove(token) {
        element.className = element.className
          .split(/\s+/)
          .filter((part) => part && part !== token)
          .join(" ");
      },
      /**
       * @param {string} token
       * @returns {boolean}
       */
      contains(token) {
        return element.className.split(/\s+/).includes(token);
      },
    };
  }

  /**
   * @param {string} name
   * @param {string} value
   * @returns {void}
   */
  setAttribute(name, value) {
    this.attrs[name] = value;
  }

  /**
   * @param {FakeEl} child
   * @returns {FakeEl}
   */
  appendChild(child) {
    this.children.push(child);
    return child;
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
    /** @type {FakeEl[]} */
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
}

/**
 * @param {FakeEl} node
 * @param {string} selector
 * @returns {boolean}
 */
function matches(node, selector) {
  if (selector.startsWith(".")) {
    return node.className.split(/\s+/).includes(selector.slice(1));
  }

  return false;
}

/**
 * @returns {{
 *   getItem: Function,
 *   setItem: Function,
 *   store: Map<string, string>,
 * }}
 */
function createStorage() {
  /** @type {Map<string, string>} */
  const store = new Map();

  return {
    /**
     * @param {string} key
     * @returns {string | null}
     */
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    /**
     * @param {string} key
     * @param {string} value
     * @returns {void}
     */
    setItem(key, value) {
      store.set(key, value);
    },
    store,
  };
}

/**
 * @returns {{
 *   root: FakeEl,
 *   link: FakeEl,
 *   counts: () => string[],
 *   refresh: Function,
 *   mark: Function,
 *   sync: Function,
 *   storage: ReturnType<typeof createStorage>,
 *   localStorage: ReturnType<typeof createStorage>,
 * }}
 */
function loadHelper() {
  const root = new FakeEl("div");
  const link = new FakeEl("a", { class: "github-star" });
  const count = new FakeEl("span", { class: "github-star__count" });
  count.textContent = "0";
  link.appendChild(count);
  root.appendChild(link);

  const storage = createStorage();
  const localStorage = createStorage();

  const document = {
    readyState: "loading",
    /**
     * @param {string} tag
     * @returns {FakeEl}
     */
    createElement(tag) {
      return new FakeEl(tag);
    },
    /**
     * @returns {void}
     */
    addEventListener() {},
    querySelectorAll: root.querySelectorAll.bind(root),
    querySelector: root.querySelector.bind(root),
  };

  const context = {
    document,
    sessionStorage: storage,
    localStorage,
    fetch: undefined,
  };

  runInNewContext(source, context);

  return {
    root,
    link,
    counts: () =>
      root
        .querySelectorAll(".github-star__count")
        .map((node) => node.textContent),
    refresh: context.joshternetRefreshGithubStarCounts,
    mark: context.joshternetMarkGithubStarred,
    sync: context.joshternetSyncGithubStarredState,
    storage,
    localStorage,
  };
}

/**
 * External boundary: GitHub REST API.
 * @param {unknown} body
 * @param {{ ok?: boolean }} [options]
 * @returns {typeof fetch}
 */
function mockFetch(body, options = {}) {
  return async () => ({
    ok: options.ok !== false,
    async json() {
      return body;
    },
  });
}

test("refreshGithubStarCounts updates visible counts from the API", async () => {
  const { root, counts, refresh, storage } = loadHelper();

  const stars = await refresh({
    root,
    storage,
    // External boundary: GitHub REST API.
    fetchImpl: mockFetch({ stargazers_count: 5 }),
    now: () => 1_000,
  });

  assert.equal(stars, 5);
  assert.deepEqual(counts(), ["5"]);
  assert.match(storage.store.get("joshternet-github-stars") || "", /"stars":5/);
});

test("refreshGithubStarCounts reuses a fresh session cache", async () => {
  const { root, counts, refresh, storage } = loadHelper();
  let fetches = 0;

  storage.setItem(
    "joshternet-github-stars",
    JSON.stringify({ stars: 9, fetchedAt: 1_000 }),
  );

  const stars = await refresh({
    root,
    storage,
    // External boundary: GitHub REST API.
    fetchImpl: async () => {
      fetches += 1;
      return {
        ok: true,
        async json() {
          return { stargazers_count: 1 };
        },
      };
    },
    now: () => 1_000 + 60_000,
  });

  assert.equal(stars, 9);
  assert.equal(fetches, 0);
  assert.deepEqual(counts(), ["9"]);
});

test("refreshGithubStarCounts leaves the fallback alone on failure", async () => {
  const { root, counts, refresh, storage } = loadHelper();

  const stars = await refresh({
    root,
    storage,
    // External boundary: GitHub REST API.
    fetchImpl: mockFetch({}, { ok: false }),
    now: () => 1_000,
  });

  assert.equal(stars, null);
  assert.deepEqual(counts(), ["0"]);
  assert.equal(storage.store.size, 0);
});

test("markGithubStarred persists local starred state and fills the control", () => {
  const { root, link, mark, sync, localStorage } = loadHelper();

  mark({ root, storage: localStorage });

  assert.equal(localStorage.getItem("joshternet-github-starred"), "1");
  assert.equal(link.classList.contains("is-starred"), true);

  link.classList.remove("is-starred");
  assert.equal(sync({ root, storage: localStorage }), true);
  assert.equal(link.classList.contains("is-starred"), true);
});
