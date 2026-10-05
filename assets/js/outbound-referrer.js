/**
 * Goal & Constraints:
 * Append Joshternet UTM query params to outbound https URLs so destination
 * analytics can attribute clicks even when Referer is stripped. Does not
 * rewrite mailto, tel, javascript, http, relative, same-origin, credentialed,
 * or rel=me URLs, and does not overwrite an existing utm_source. Images and
 * iframes are out of scope.
 */
(() => {
  const SOURCE = "joshternet.org";
  const MEDIUM = "referral";

  /**
   * First path segment for utm_campaign, or "home".
   * @param {string} pathname
   * @returns {string}
   */
  function campaignFromPath(pathname) {
    const parts = String(pathname || "/")
      .split("/")
      .filter(Boolean);

    return parts[0] || "home";
  }

  /**
   * True when rel includes the me token (IndieWeb identity URLs).
   * @param {string | null} rel
   * @returns {boolean}
   */
  function relIncludesMe(rel) {
    return String(rel || "")
      .split(/\s+/)
      .includes("me");
  }

  /**
   * Appends Joshternet UTM params to an outbound https URL.
   * @param {string} href
   * @param {{ campaign?: string, content?: string }} [options]
   * @returns {string}
   */
  function withJoshternetOutboundParams(href, options = {}) {
    const raw = String(href || "").trim();

    if (!raw) {
      return raw;
    }

    let url;

    try {
      url = new URL(raw);
    } catch {
      return raw;
    }

    if (url.protocol !== "https:") {
      return raw;
    }

    if (url.username || url.password) {
      return raw;
    }

    const here = globalThis.location;

    if (here && here.origin && url.origin === here.origin) {
      return raw;
    }

    if (url.searchParams.has("utm_source")) {
      return url.href;
    }

    const campaign =
      String(options.campaign || campaignFromPath(here?.pathname)).trim() ||
      "home";
    const content = String(options.content || here?.pathname || "/");

    url.searchParams.set("utm_source", SOURCE);
    url.searchParams.set("utm_medium", MEDIUM);
    url.searchParams.set("utm_campaign", campaign);
    url.searchParams.set("utm_content", content);

    return url.href;
  }

  /**
   * Rewrites an href using the current page path as campaign and content.
   * @param {string} href
   * @returns {string}
   */
  function joshternetOutboundHref(href) {
    const pathname = globalThis.location?.pathname || "/";

    return withJoshternetOutboundParams(href, {
      campaign: campaignFromPath(pathname),
      content: pathname,
    });
  }

  /**
   * Rewrites outbound <a href> values under root. Skips rel=me identity links.
   * @param {ParentNode} [root]
   * @returns {void}
   */
  function decorateOutboundLinks(root) {
    const scope = root || globalThis.document;

    if (!scope || typeof scope.querySelectorAll !== "function") {
      return;
    }

    for (const anchor of scope.querySelectorAll("a[href]")) {
      if (relIncludesMe(anchor.getAttribute("rel"))) {
        continue;
      }

      const current = anchor.getAttribute("href") || "";
      const next = joshternetOutboundHref(current);

      if (next !== current) {
        anchor.setAttribute("href", next);
      }
    }
  }

  globalThis.joshternetOutboundHref = joshternetOutboundHref;
  globalThis.joshternetDecorateOutboundLinks = decorateOutboundLinks;

  const documentRef = globalThis.document;

  if (documentRef) {
    if (documentRef.readyState === "loading") {
      documentRef.addEventListener("DOMContentLoaded", () => {
        decorateOutboundLinks(documentRef);
      });
    } else {
      decorateOutboundLinks(documentRef);
    }
  }
})();
