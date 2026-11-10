/**
 * Goal & Constraints:
 * Refresh visible GitHub star counts from the public repos API when JS and
 * CSP allow it. Keep the build-time `_data/github.json` count as the no-JS
 * fallback. Fail silently on network/rate-limit errors. Cache briefly in
 * sessionStorage so ordinary browsing does not burn the unauthenticated
 * 60/hour IP budget.
 *
 * Gold “starred” fill is local only: GitHub will not tell this origin whether
 * the visitor actually starred without OAuth, so we remember a click on the
 * CTA in localStorage and style from that.
 */
(() => {
  const REPOSITORY = "joshternet/joshternet.github.io";
  const API_URL = `https://api.github.com/repos/${REPOSITORY}`;
  const CACHE_KEY = "joshternet-github-stars";
  const STARRED_KEY = "joshternet-github-starred";
  const CACHE_TTL_MS = 15 * 60 * 1000;

  /**
   * @typedef {{ stars: number, fetchedAt: number }} StarCache
   */

  /**
   * Reads a still-fresh star count from sessionStorage.
   * @param {Storage | null | undefined} storage
   * @param {() => number} now
   * @returns {number | null}
   */
  function readCachedStars(storage, now) {
    if (!storage || typeof storage.getItem !== "function") {
      return null;
    }

    try {
      const raw = storage.getItem(CACHE_KEY);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed.stars !== "number" ||
        !Number.isFinite(parsed.stars) ||
        typeof parsed.fetchedAt !== "number" ||
        !Number.isFinite(parsed.fetchedAt)
      ) {
        return null;
      }

      if (now() - parsed.fetchedAt > CACHE_TTL_MS) {
        return null;
      }

      return parsed.stars;
    } catch {
      return null;
    }
  }

  /**
   * Persists a star count in sessionStorage.
   * @param {Storage | null | undefined} storage
   * @param {number} stars
   * @param {() => number} now
   * @returns {void}
   */
  function writeCachedStars(storage, stars, now) {
    if (!storage || typeof storage.setItem !== "function") {
      return;
    }

    /** @type {StarCache} */
    const payload = { stars, fetchedAt: now() };

    try {
      storage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Quota or private mode — ignore.
    }
  }

  /**
   * Whether this browser previously used the star CTA.
   * @param {Storage | null | undefined} storage
   * @returns {boolean}
   */
  function readStarred(storage) {
    if (!storage || typeof storage.getItem !== "function") {
      return false;
    }

    try {
      return storage.getItem(STARRED_KEY) === "1";
    } catch {
      return false;
    }
  }

  /**
   * Remembers that this browser used the star CTA.
   * @param {Storage | null | undefined} storage
   * @returns {void}
   */
  function writeStarred(storage) {
    if (!storage || typeof storage.setItem !== "function") {
      return;
    }

    try {
      storage.setItem(STARRED_KEY, "1");
    } catch {
      // Quota or private mode — ignore.
    }
  }

  /**
   * Toggles the gold starred presentation on every star control.
   * @param {ParentNode | null | undefined} root
   * @param {boolean} starred
   * @returns {void}
   */
  function applyStarredState(root, starred) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }

    const links = root.querySelectorAll(".github-star");

    for (const link of links) {
      if (!starred) {
        if (link.classList && typeof link.classList.remove === "function") {
          link.classList.remove("is-starred");
        }

        continue;
      }

      if (link.classList && typeof link.classList.add === "function") {
        link.classList.add("is-starred");
        continue;
      }

      const current = String(link.className || "");

      if (!/(^|\s)is-starred(\s|$)/.test(current)) {
        link.className = `${current} is-starred`.trim();
      }
    }
  }

  /**
   * Applies a star count to every `.github-star` control on the page.
   * @param {ParentNode | null | undefined} root
   * @param {number} stars
   * @returns {void}
   */
  function applyStarCount(root, stars) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }

    const links = root.querySelectorAll(".github-star");

    for (const link of links) {
      let count = link.querySelector(".github-star__count");

      if (!count) {
        count = globalThis.document?.createElement("span");

        if (!count) {
          continue;
        }

        count.className = "github-star__count";
        count.setAttribute("aria-hidden", "true");
        link.appendChild(count);
      }

      count.textContent = String(stars);
    }
  }

  /**
   * Fetches `stargazers_count` from the public GitHub repository API.
   * @param {{
   *   fetchImpl?: typeof fetch,
   *   apiUrl?: string,
   * }} [options]
   * @returns {Promise<number>}
   */
  async function fetchStargazersCount(options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const apiUrl = options.apiUrl || API_URL;

    if (typeof fetchImpl !== "function") {
      throw new Error("fetch is not available");
    }

    const response = await fetchImpl(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });

    if (!response || !response.ok) {
      throw new Error("GitHub star count request failed");
    }

    const body = await response.json();

    if (
      !body ||
      typeof body !== "object" ||
      typeof body.stargazers_count !== "number" ||
      !Number.isFinite(body.stargazers_count)
    ) {
      throw new Error("GitHub star count response was malformed");
    }

    return body.stargazers_count;
  }

  /**
   * Refreshes on-page star counts from cache or the GitHub API.
   * @param {{
   *   root?: ParentNode | null,
   *   storage?: Storage | null,
   *   fetchImpl?: typeof fetch,
   *   apiUrl?: string,
   *   now?: () => number,
   * }} [options]
   * @returns {Promise<number | null>}
   */
  async function refreshGithubStarCounts(options = {}) {
    const root = options.root ?? globalThis.document;
    const storage = options.storage ?? globalThis.sessionStorage;
    const now = options.now || (() => Date.now());

    if (!root || typeof root.querySelectorAll !== "function") {
      return null;
    }

    if (root.querySelectorAll(".github-star").length === 0) {
      return null;
    }

    const cached = readCachedStars(storage, now);

    if (cached !== null) {
      applyStarCount(root, cached);
      return cached;
    }

    try {
      const stars = await fetchStargazersCount({
        fetchImpl: options.fetchImpl,
        apiUrl: options.apiUrl,
      });
      writeCachedStars(storage, stars, now);
      applyStarCount(root, stars);
      return stars;
    } catch {
      return null;
    }
  }

  /**
   * Applies persisted starred styling from localStorage.
   * @param {{
   *   root?: ParentNode | null,
   *   storage?: Storage | null,
   * }} [options]
   * @returns {boolean}
   */
  function syncGithubStarredState(options = {}) {
    const root = options.root ?? globalThis.document;
    const storage = options.storage ?? globalThis.localStorage;
    const starred = readStarred(storage);
    applyStarredState(root, starred);
    return starred;
  }

  /**
   * Marks the CTA as starred locally and updates visible controls.
   * @param {{
   *   root?: ParentNode | null,
   *   storage?: Storage | null,
   * }} [options]
   * @returns {void}
   */
  function markGithubStarred(options = {}) {
    const root = options.root ?? globalThis.document;
    const storage = options.storage ?? globalThis.localStorage;
    writeStarred(storage);
    applyStarredState(root, true);
  }

  /**
   * Remembers a star CTA click before navigation continues.
   * @param {MouseEvent} event
   * @returns {void}
   */
  function onDocumentClick(event) {
    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }

    const target = event.target;

    if (!target || typeof target.closest !== "function") {
      return;
    }

    const anchor = target.closest("a.github-star");

    if (!anchor) {
      return;
    }

    markGithubStarred();
  }

  /**
   * Boots live count refresh and starred styling after DOM is ready.
   * @returns {void}
   */
  function init() {
    syncGithubStarredState();
    void refreshGithubStarCounts();

    const documentRef = globalThis.document;

    if (documentRef && typeof documentRef.addEventListener === "function") {
      documentRef.addEventListener("click", onDocumentClick, true);
    }
  }

  globalThis.joshternetRefreshGithubStarCounts = refreshGithubStarCounts;
  globalThis.joshternetSyncGithubStarredState = syncGithubStarredState;
  globalThis.joshternetMarkGithubStarred = markGithubStarred;

  const documentRef = globalThis.document;

  if (documentRef) {
    if (documentRef.readyState === "loading") {
      documentRef.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }
})();
