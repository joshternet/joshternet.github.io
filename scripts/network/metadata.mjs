export function extractPageMetadata(hostCatalog) {
  function normalizeText(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value.replace(/\s+/g, " ").trim();
  }

  function meta(selector) {
    return document.querySelector(selector)?.getAttribute("content") || "";
  }

  function jsonLdObjects(value) {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => jsonLdObjects(entry));
    }

    if (!value || typeof value !== "object") {
      return [];
    }

    const objects = [value];

    if (Array.isArray(value["@graph"])) {
      objects.push(...value["@graph"].flatMap((entry) => jsonLdObjects(entry)));
    }

    return objects;
  }

  function hasType(value, expectedType) {
    const type = value?.["@type"];

    if (typeof type === "string") {
      return type === expectedType;
    }

    if (Array.isArray(type)) {
      return type.includes(expectedType);
    }

    return false;
  }

  function extractJsonLdWebsite() {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );

    for (const script of scripts) {
      const source = script.textContent || "";

      if (!source.trim()) {
        continue;
      }

      let parsed;

      try {
        parsed = JSON.parse(source);
      } catch {
        continue;
      }

      const objects = jsonLdObjects(parsed);

      for (const object of objects) {
        if (!hasType(object, "WebSite")) {
          continue;
        }

        return {
          name: normalizeText(object.name),
          description: normalizeText(object.description),
        };
      }
    }

    return {
      name: "",
      description: "",
    };
  }

  /**
   * Person.name from JSON-LD when the publisher declares a person entity.
   * @returns {string}
   */
  function extractJsonLdPersonName() {
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );

    for (const script of scripts) {
      const source = script.textContent || "";

      if (!source.trim()) {
        continue;
      }

      let parsed;

      try {
        parsed = JSON.parse(source);
      } catch {
        continue;
      }

      const objects = jsonLdObjects(parsed);

      for (const object of objects) {
        if (!hasType(object, "Person")) {
          continue;
        }

        const name = normalizeText(object.name);

        if (name) {
          return name;
        }
      }
    }

    return "";
  }

  function usableParagraph(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (
      element.closest(
        [
          "nav",
          "header",
          "footer",
          "aside",
          "dialog",
          "script",
          "style",
          "noscript",
          "template",
          '[aria-hidden="true"]',
        ].join(","),
      )
    ) {
      return false;
    }

    const text = normalizeText(element.textContent || "");

    if (text.length < 80) {
      return false;
    }

    return true;
  }

  function extractMainDescription() {
    const containers = [
      ...document.querySelectorAll("main"),
      ...document.querySelectorAll('[role="main"]'),
      ...document.querySelectorAll("article"),
    ];

    const seen = new Set();

    for (const container of containers) {
      if (!(container instanceof HTMLElement) || seen.has(container)) {
        continue;
      }

      seen.add(container);

      for (const paragraph of container.querySelectorAll("p")) {
        if (!usableParagraph(paragraph)) {
          continue;
        }

        return normalizeText(paragraph.textContent || "");
      }
    }

    return "";
  }

  function extractFeeds() {
    const allowedTypes = new Set([
      "application/rss+xml",
      "application/atom+xml",
      "application/feed+json",
    ]);
    const feeds = [];

    for (const link of document.querySelectorAll("link[href]")) {
      if (!(link instanceof HTMLLinkElement)) {
        continue;
      }

      if (!link.relList.contains("alternate")) {
        continue;
      }

      const type = normalizeText(link.getAttribute("type") || "");

      if (!allowedTypes.has(type)) {
        continue;
      }

      const hrefAttribute = normalizeText(link.getAttribute("href") || "");

      if (!hrefAttribute) {
        continue;
      }

      let href;

      try {
        href = new URL(hrefAttribute, document.baseURI).href;
      } catch {
        continue;
      }

      const title = normalizeText(
        link.title || link.getAttribute("title") || "",
      );
      const feed = {
        href,
        type,
      };

      if (title) {
        feed.title = title;
      }

      feeds.push(feed);
    }

    return feeds;
  }

  function extractBlogrolls() {
    const blogrolls = [];

    for (const link of document.querySelectorAll("link[href]")) {
      if (!(link instanceof HTMLLinkElement)) {
        continue;
      }

      if (!link.relList.contains("blogroll")) {
        continue;
      }

      const type = normalizeText(link.getAttribute("type") || "");

      if (type !== "text/xml") {
        continue;
      }

      const hrefAttribute = normalizeText(link.getAttribute("href") || "");

      if (!hrefAttribute) {
        continue;
      }

      let href;

      try {
        href = new URL(hrefAttribute, document.baseURI).href;
      } catch {
        continue;
      }

      blogrolls.push({
        href,
        type,
      });
    }

    return blogrolls;
  }

  /**
   * Collects ordinary outbound `<a href>` links already resolved by the browser.
   * Keeps http(s) only. Includes nofollow. Drops mailto/tel/javascript/data and
   * fragment-only hrefs. Relative and protocol-relative hrefs are normalized.
   * Returns the publisher's own bridge evidence: href, anchor text, and rel.
   * @returns {Array<{href: string, text: string, rel: string[]}>}
   */
  function extractOutboundLinks() {
    const links = [];
    const seen = new Set();

    for (const element of document.querySelectorAll("a[href]")) {
      if (!(element instanceof HTMLAnchorElement)) {
        continue;
      }

      // Hub Meet / activity widgets are republish UI, not connection evidence.
      if (
        element.closest("[data-home-meet-grid]") ||
        element.closest(".activity-card")
      ) {
        continue;
      }

      const hrefAttribute = normalizeText(element.getAttribute("href") || "");

      if (!hrefAttribute || hrefAttribute.startsWith("#")) {
        continue;
      }

      let url;

      try {
        url = new URL(hrefAttribute, document.baseURI);
      } catch {
        continue;
      }

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        continue;
      }

      if (url.username || url.password) {
        continue;
      }

      const href = url.href;

      if (seen.has(href)) {
        continue;
      }

      seen.add(href);

      const rel = [];
      const seenRel = new Set();

      for (const token of element.relList || []) {
        const normalized = normalizeText(token).toLowerCase();

        if (!normalized || seenRel.has(normalized)) {
          continue;
        }

        seenRel.add(normalized);
        rel.push(normalized);
      }

      rel.sort((left, right) => left.localeCompare(right));

      const classNames = [];
      const seenClass = new Set();

      for (const token of element.classList || []) {
        const normalized = normalizeText(token).toLowerCase();

        if (!normalized || seenClass.has(normalized)) {
          continue;
        }

        seenClass.add(normalized);
        classNames.push(normalized);
      }

      classNames.sort((left, right) => left.localeCompare(right));

      links.push({
        href,
        text: normalizeText(element.textContent || "").slice(0, 200),
        rel,
        classNames,
      });
    }

    return links;
  }

  /**
   * Same-origin indieweb slash / about / link-directory pages linked here.
   * Prefer classic about paths, then /more/ and /site/ (joshbeard-style TOC),
   * then other identity slash pages by label.
   * @returns {string[]}
   */
  function extractIdentityPageHrefs() {
    let pageOrigin = "";

    try {
      pageOrigin = new URL(document.baseURI).origin;
    } catch {
      return [];
    }

    const identityPaths = new Set([
      "/about",
      "/about-me",
      "/aboutme",
      "/bio",
      "/me",
      "/more",
      "/site",
      "/social",
      "/links",
      "/people",
      "/friends",
      "/blogroll",
      "/now",
      "/uses",
      "/elsewhere",
      "/following",
      "/bookmarks",
      "/colophon",
      "/webring",
      "/webrings",
      "/indieweb",
      "/hello",
      "/guestbook",
      "/neighborhood",
      "/meta",
      "/interests",
      "/health",
      "/homelab",
    ]);
    const identityLabels = new Set([
      "about",
      "about me",
      "about.",
      "more",
      "now",
      "uses",
      "social",
      "links",
      "people",
      "friends",
      "site",
      "about this site",
      "blogroll",
      "elsewhere",
      "following",
      "me",
      "colophon",
      "webring",
      "indieweb",
    ]);
    const pathRank = [
      "/about",
      "/me",
      "/bio",
      "/about-me",
      "/aboutme",
      "/more",
      "/site",
      "/now",
      "/uses",
      "/social",
      "/links",
      "/people",
      "/friends",
      "/blogroll",
    ];

    /** @type {Map<string, string>} */
    const byNormalized = new Map();

    for (const element of document.querySelectorAll("a[href]")) {
      if (!(element instanceof HTMLAnchorElement)) {
        continue;
      }

      const hrefAttribute = normalizeText(element.getAttribute("href") || "");

      if (!hrefAttribute || hrefAttribute.startsWith("#")) {
        continue;
      }

      let url;

      try {
        url = new URL(hrefAttribute, document.baseURI);
      } catch {
        continue;
      }

      if (url.origin !== pageOrigin) {
        continue;
      }

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        continue;
      }

      const path = url.pathname.replace(/\/+$/, "") || "/";
      const label = normalizeText(element.textContent || "").toLowerCase();
      const pathMatch = identityPaths.has(path);
      const labelMatch = identityLabels.has(label) && path !== "/";

      if (!pathMatch && !labelMatch) {
        continue;
      }

      if (!byNormalized.has(path)) {
        byNormalized.set(path, url.href);
      }
    }

    const ranked = [];

    for (const preferred of pathRank) {
      const href = byNormalized.get(preferred);

      if (href) {
        ranked.push(href);
        byNormalized.delete(preferred);
      }
    }

    for (const href of byNormalized.values()) {
      ranked.push(href);
    }

    return ranked;
  }

  /**
   * Primary same-origin about page linked from the current document.
   * @returns {string}
   */
  function extractAboutPageHref() {
    const ranked = extractIdentityPageHrefs();
    return ranked[0] || "";
  }

  /**
   * Collects homepage elsewhere links: `rel="me"` ads, plus catalog social
   * profile links that omit rel.
   * @param {{
   *   hosts?: Record<string, string>,
   *   suffixes?: Array<{suffix: string, network: string}>,
   * }} [hostCatalog]
   * @returns {Array<{href: string, text?: string, me?: boolean}>}
   */
  function extractElsewhere(hostCatalog = {}) {
    const elsewhere = [];
    const seen = new Set();
    const hosts =
      hostCatalog && typeof hostCatalog.hosts === "object" && hostCatalog.hosts
        ? hostCatalog.hosts
        : {};
    const suffixes = Array.isArray(hostCatalog?.suffixes)
      ? hostCatalog.suffixes
      : [];

    /**
     * @param {string} hostname
     * @returns {boolean}
     */
    function isKnownSocialHost(hostname) {
      const host = String(hostname || "")
        .trim()
        .toLowerCase();

      if (!host) {
        return false;
      }

      if (Object.prototype.hasOwnProperty.call(hosts, host)) {
        return true;
      }

      for (const entry of suffixes) {
        if (
          entry &&
          typeof entry.suffix === "string" &&
          host.endsWith(entry.suffix)
        ) {
          return true;
        }
      }

      return false;
    }

    /**
     * @param {Element} element
     * @param {boolean} me
     */
    function pushLink(element, me) {
      if (
        !(element instanceof HTMLAnchorElement) &&
        !(element instanceof HTMLLinkElement)
      ) {
        return;
      }

      const hrefAttribute = normalizeText(element.getAttribute("href") || "");

      if (!hrefAttribute) {
        return;
      }

      let href;

      try {
        href = new URL(hrefAttribute, document.baseURI).href;
      } catch {
        return;
      }

      const key = href;

      if (seen.has(key)) {
        return;
      }

      seen.add(key);

      const entry = {
        href,
        me,
      };

      if (element instanceof HTMLAnchorElement) {
        const text = normalizeText(element.textContent || "");

        if (text) {
          entry.text = text;
        }
      }

      elsewhere.push(entry);
    }

    for (const element of document.querySelectorAll("a[href], link[href]")) {
      if (
        !(element instanceof HTMLAnchorElement) &&
        !(element instanceof HTMLLinkElement)
      ) {
        continue;
      }

      if (element.relList.contains("me")) {
        pushLink(element, true);
      }
    }

    for (const element of document.querySelectorAll("a[href], link[href]")) {
      if (
        !(element instanceof HTMLAnchorElement) &&
        !(element instanceof HTMLLinkElement)
      ) {
        continue;
      }

      if (element.relList.contains("me")) {
        continue;
      }

      const hrefAttribute = normalizeText(element.getAttribute("href") || "");

      if (!hrefAttribute) {
        continue;
      }

      let url;

      try {
        url = new URL(hrefAttribute, document.baseURI);
      } catch {
        continue;
      }

      if (!isKnownSocialHost(url.hostname)) {
        continue;
      }

      pushLink(element, false);
    }

    return elsewhere;
  }

  const jsonLdWebsite = extractJsonLdWebsite();
  const catalog =
    hostCatalog && typeof hostCatalog === "object" ? hostCatalog : {};

  return {
    ogSiteName: meta('meta[property="og:site_name"]'),
    applicationName: meta('meta[name="application-name"]'),
    jsonLdSiteName: jsonLdWebsite.name,
    jsonLdPersonName: extractJsonLdPersonName(),
    authorName: meta('meta[name="author"]'),
    ogTitle: meta('meta[property="og:title"]'),
    twitterTitle: meta('meta[name="twitter:title"]'),
    documentTitle: document.title || "",
    description: meta('meta[name="description"]'),
    ogDescription: meta('meta[property="og:description"]'),
    twitterDescription: meta('meta[name="twitter:description"]'),
    jsonLdDescription: jsonLdWebsite.description,
    mainDescription: extractMainDescription(),
    feeds: extractFeeds(),
    blogrolls: extractBlogrolls(),
    links: extractOutboundLinks(),
    elsewhere: extractElsewhere(catalog),
    aboutPageHref: extractAboutPageHref(),
    aboutPageHrefs: extractIdentityPageHrefs(),
  };
}
