/**
 * Goal & Constraints:
 * Enhance /connections/ with selection and a map-like directed graph. HTML
 * lists already work without JS. Treat bootstrap JSON as untrusted. No
 * popularity ranking, no third-party graph libraries, no CSP looseness. Equal
 * visual weight for every participant node. The hub stays centered; the
 * viewport pans and zooms as the network grows.
 */
(() => {
  const shell = document.querySelector("[data-connections-shell]");
  const graphRoot = document.querySelector("[data-connections-graph]");
  const graphStage = document.querySelector("[data-connections-graph-stage]");
  const bootstrap = document.getElementById("connections-bootstrap");
  const siteSections = Array.from(
    document.querySelectorAll("[data-connection-origin]"),
  );

  if (!shell || !graphRoot || !graphStage || !bootstrap) {
    return;
  }

  /**
   * Escapes text for HTML text nodes.
   * @param {string} value
   * @returns {string}
   */
  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  /**
   * Escapes text for HTML attribute values.
   * @param {string} value
   * @returns {string}
   */
  function escapeAttribute(value) {
    return escapeHTML(value);
  }

  /**
   * Appends Joshternet UTM params when the shared helper is loaded.
   * @param {string} href
   * @returns {string}
   */
  function outboundHref(href) {
    const decorate = globalThis.joshternetOutboundHref;

    return typeof decorate === "function" ? decorate(href) : href;
  }

  /**
   * @param {unknown} value
   * @returns {URL | null}
   */
  function canonicalOrigin(value) {
    if (typeof value !== "string" || value === "" || value.trim() !== value) {
      return null;
    }

    try {
      const url = new URL(value);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return null;
      }

      if (url.username || url.password) {
        return null;
      }

      if (url.pathname !== "/" || url.search || url.hash) {
        return null;
      }

      if (url.origin !== value) {
        return null;
      }

      return url;
    } catch {
      return null;
    }
  }

  /**
   * @param {unknown} value
   * @param {number} maximumLength
   * @returns {string}
   */
  function textValue(value, maximumLength) {
    if (typeof value !== "string") {
      return "";
    }

    return value.slice(0, maximumLength);
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function screenshotPath(value) {
    if (value === "") {
      return "";
    }

    if (typeof value !== "string" || !value.startsWith("/assets/")) {
      return "";
    }

    if (value.includes("\\") || value.includes("%") || value.includes("//")) {
      return "";
    }

    try {
      const url = new URL(value, window.location.origin);

      if (
        url.origin !== window.location.origin ||
        url.search ||
        url.hash ||
        url.pathname !== value ||
        !url.pathname.startsWith("/assets/")
      ) {
        return "";
      }

      return url.pathname;
    } catch {
      return "";
    }
  }

  /**
   * Accepts any credential-free http(s) URL (friend bridges may point outside).
   * @param {unknown} value
   * @returns {string}
   */
  function safeHttpHref(value) {
    if (typeof value !== "string") {
      return "";
    }

    try {
      const url = new URL(value);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "";
      }

      if (url.username || url.password) {
        return "";
      }

      if (url.pathname.replace(/\/+$/, "") === "/.well-known/josh") {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  /**
   * @param {unknown} value
   * @returns {"link" | "friend" | "topic" | "mention"}
   */
  function connectionRelation(value) {
    if (
      value === "homepage-link" ||
      value === "content-link" ||
      value === "blogroll" ||
      value === "mention" ||
      value === "reply-to" ||
      value === "repost-of" ||
      value === "syndication"
    ) {
      return value;
    }

    if (value === "link") {
      return "content-link";
    }

    // Drop inferred friend/topic edges if they appear in bootstrap JSON.
    if (value === "friend" || value === "topic") {
      return "";
    }

    return "content-link";
  }

  /**
   * @param {unknown} value
   * @returns {{origin: string, domain: string, title: string, description: string, screenshot: string} | null}
   */
  function validateParticipant(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const origin = canonicalOrigin(value.origin);

    if (!origin) {
      return null;
    }

    if (typeof value.domain !== "string" || value.domain !== origin.host) {
      return null;
    }

    return {
      origin: origin.origin,
      domain: origin.host,
      title: textValue(value.title, 256) || origin.host,
      description: textValue(value.description, 2_000),
      screenshot: screenshotPath(value.screenshot),
    };
  }

  /**
   * @param {unknown} value
   * @param {Set<string>} allowedOrigins
   * @returns {{
   *   from: string,
   *   to: string,
   *   relation: string,
   *   via: string,
   *   source: string,
   *   href: string,
   *   text: string,
   *   rel: string[],
   *   page: string,
   * } | null}
   */
  function validateConnection(value, allowedOrigins) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    if (
      typeof value.from !== "string" ||
      typeof value.to !== "string" ||
      !allowedOrigins.has(value.from) ||
      !allowedOrigins.has(value.to) ||
      value.from === value.to
    ) {
      return null;
    }

    const href = safeHttpHref(value.href);

    if (!href) {
      return null;
    }

    let page = "";

    if (typeof value.page === "string" && value.page) {
      page = safeHttpHref(value.page);
    }

    const rel = [];
    const seenRel = new Set();

    if (Array.isArray(value.rel)) {
      for (const token of value.rel) {
        if (typeof token !== "string") {
          continue;
        }

        const normalized = token.trim().toLowerCase().slice(0, 64);

        if (!normalized || seenRel.has(normalized)) {
          continue;
        }

        seenRel.add(normalized);
        rel.push(normalized);
      }
    }

    const relation = connectionRelation(value.relation || value.kind);

    if (!relation) {
      return null;
    }

    let via = textValue(value.via, 500);

    if (relation === "mention" || relation === "blogroll") {
      via = safeHttpHref(via) || textValue(value.via, 500);
    }

    const evidence = [];

    if (Array.isArray(value.evidence)) {
      for (const item of value.evidence.slice(0, 8)) {
        if (!item || typeof item !== "object") {
          continue;
        }

        evidence.push({
          page:
            typeof item.page === "string" ? safeHttpHref(item.page) || "" : "",
          href:
            typeof item.href === "string" ? safeHttpHref(item.href) || "" : "",
          text: textValue(item.text, 200),
        });
      }
    }

    return {
      from: value.from,
      to: value.to,
      relation,
      kind: relation,
      via,
      source: textValue(value.source, 64) || "content",
      href,
      text: textValue(value.text, 200),
      rel,
      page,
      evidence,
    };
  }

  /**
   * Shared-topic pair from neighborhood overlap. Not a directed link.
   * @param {unknown} value
   * @param {Set<string>} allowedOrigins
   * @returns {{a: string, b: string, topics: Array<{slug: string, label: string}>} | null}
   */
  function validateTopicOverlap(value, allowedOrigins) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const left = canonicalOrigin(value.a);
    const right = canonicalOrigin(value.b);

    if (!left || !right || left.origin === right.origin) {
      return null;
    }

    if (!allowedOrigins.has(left.origin) || !allowedOrigins.has(right.origin)) {
      return null;
    }

    const [a, b] =
      left.origin < right.origin
        ? [left.origin, right.origin]
        : [right.origin, left.origin];
    const topics = [];
    const seenSlugs = new Set();

    if (Array.isArray(value.topics)) {
      for (const topic of value.topics.slice(0, 24)) {
        if (!topic || typeof topic !== "object") {
          continue;
        }

        if (typeof topic.slug !== "string" || topic.slug === "") {
          continue;
        }

        const slug = topic.slug.trim().slice(0, 80);

        if (!slug || seenSlugs.has(slug)) {
          continue;
        }

        seenSlugs.add(slug);
        topics.push({
          slug,
          label: textValue(topic.label || slug, 80) || slug,
        });
      }
    }

    if (topics.length === 0) {
      return null;
    }

    return { a, b, topics };
  }

  /**
   * @param {unknown} value
   * @returns {{url: string, title: string} | null}
   */
  function validateTopicArticle(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const url = safeHttpHref(value.url);

    if (!url) {
      return null;
    }

    return {
      url,
      title: textValue(value.title, 200) || url,
    };
  }

  /**
   * @param {unknown} value
   * @param {Set<string>} allowedOrigins
   * @returns {{
   *   origin: string,
   *   topics: Array<{
   *     slug: string,
   *     label: string,
   *     articles: Array<{url: string, title: string}>,
   *     sites: Array<{
   *       origin: string,
   *       title: string,
   *       articles: Array<{url: string, title: string}>,
   *     }>,
   *   }>,
   * } | null}
   */
  function validateTopicGroup(value, allowedOrigins) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const origin = canonicalOrigin(value.origin);

    if (!origin || !allowedOrigins.has(origin.origin)) {
      return null;
    }

    const topics = [];

    if (Array.isArray(value.topics)) {
      for (const topic of value.topics.slice(0, 24)) {
        if (!topic || typeof topic.slug !== "string" || topic.slug === "") {
          continue;
        }

        const articles = [];

        if (Array.isArray(topic.articles)) {
          for (const item of topic.articles.slice(0, 8)) {
            const article = validateTopicArticle(item);

            if (article) {
              articles.push(article);
            }
          }
        }

        const sites = [];
        const seenPeers = new Set();

        if (Array.isArray(topic.sites)) {
          for (const peer of topic.sites.slice(0, 12)) {
            const peerOrigin = canonicalOrigin(peer?.origin);

            if (
              !peerOrigin ||
              peerOrigin.origin === origin.origin ||
              !allowedOrigins.has(peerOrigin.origin) ||
              seenPeers.has(peerOrigin.origin)
            ) {
              continue;
            }

            seenPeers.add(peerOrigin.origin);
            const peerArticles = [];

            if (Array.isArray(peer.articles)) {
              for (const item of peer.articles.slice(0, 8)) {
                const article = validateTopicArticle(item);

                if (article) {
                  peerArticles.push(article);
                }
              }
            }

            sites.push({
              origin: peerOrigin.origin,
              title: textValue(peer.title, 80) || peerOrigin.host,
              articles: peerArticles,
            });
          }
        }

        topics.push({
          slug: topic.slug.trim().slice(0, 80),
          label: textValue(topic.label || topic.slug, 80) || topic.slug,
          articles,
          sites,
        });
      }
    }

    return { origin: origin.origin, topics };
  }

  /**
   * @param {unknown} payload
   * @returns {{
   *   participants: Array<NonNullable<ReturnType<typeof validateParticipant>>>,
   *   connections: Array<NonNullable<ReturnType<typeof validateConnection>>>,
   *   topicOverlaps: Array<NonNullable<ReturnType<typeof validateTopicOverlap>>>,
   * }}
   */
  function validatePayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return {
        participants: [],
        connections: [],
        topicOverlaps: [],
        topicGroups: [],
      };
    }

    const participants = [];
    const seen = new Set();

    if (Array.isArray(payload.participants)) {
      for (const entry of payload.participants) {
        const participant = validateParticipant(entry);

        if (!participant || seen.has(participant.origin)) {
          continue;
        }

        seen.add(participant.origin);
        participants.push(participant);
      }
    }

    const allowedOrigins = new Set(
      participants.map((participant) => participant.origin),
    );
    const connections = [];
    const seenEdges = new Set();

    if (Array.isArray(payload.connections)) {
      for (const entry of payload.connections) {
        const connection = validateConnection(entry, allowedOrigins);

        if (!connection) {
          continue;
        }

        const key = [connection.relation, connection.from, connection.to].join(
          "\0",
        );

        if (seenEdges.has(key)) {
          continue;
        }

        seenEdges.add(key);
        connections.push(connection);
      }
    }

    const topicOverlaps = [];
    const seenOverlaps = new Set();

    if (Array.isArray(payload.topic_overlaps)) {
      for (const entry of payload.topic_overlaps) {
        const overlap = validateTopicOverlap(entry, allowedOrigins);

        if (!overlap) {
          continue;
        }

        const key = `${overlap.a}\0${overlap.b}`;

        if (seenOverlaps.has(key)) {
          continue;
        }

        seenOverlaps.add(key);
        topicOverlaps.push(overlap);
      }
    }

    const topicGroups = [];

    if (Array.isArray(payload.topic_groups)) {
      for (const entry of payload.topic_groups) {
        const group = validateTopicGroup(entry, allowedOrigins);

        if (!group) {
          continue;
        }

        topicGroups.push(group);
      }
    }

    return { participants, connections, topicOverlaps, topicGroups };
  }

  let parsed;

  try {
    parsed = validatePayload(JSON.parse(bootstrap.textContent || "{}"));
  } catch {
    parsed = {
      participants: [],
      connections: [],
      topicOverlaps: [],
      topicGroups: [],
    };
  }

  const { participants, connections, topicOverlaps, topicGroups } = parsed;
  const connectedOrigins = new Set();

  for (const edge of connections) {
    connectedOrigins.add(edge.from);
    connectedOrigins.add(edge.to);
  }

  for (const overlap of topicOverlaps) {
    connectedOrigins.add(overlap.a);
    connectedOrigins.add(overlap.b);
  }

  const graphParticipants = participants.filter((participant) =>
    connectedOrigins.has(participant.origin),
  );
  const byOrigin = new Map(
    participants.map((participant) => [participant.origin, participant]),
  );

  if (participants.length === 0) {
    return;
  }

  graphRoot.hidden = false;

  const bubble = document.createElement("div");
  bubble.className = "connections-bubble";
  bubble.setAttribute("data-connections-detail", "");
  bubble.hidden = true;
  bubble.setAttribute("role", "dialog");
  bubble.setAttribute("aria-label", "Connection");
  const bubbleClose = document.createElement("button");
  bubbleClose.type = "button";
  bubbleClose.className = "connections-bubble__close";
  bubbleClose.setAttribute("aria-label", "Close");
  bubbleClose.textContent = "×";
  const bubbleBody = document.createElement("div");
  bubbleBody.className = "connections-bubble__body";
  bubble.append(bubbleClose, bubbleBody);
  graphRoot.append(bubble);
  bubble.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  /** @type {string | null} */
  let selectedOrigin = null;
  /** @type {string | null} */
  let selectedEdgeKey = null;
  const enabledRelations = new Set(
    connections.map((edge) => edge.relation || edge.kind),
  );

  if (topicOverlaps.length > 0) {
    enabledRelations.add("shared-topic");
  }

  /**
   * @param {string} relation
   * @returns {string}
   */
  function dashFor(relation) {
    switch (relation) {
      case "blogroll":
        return "8 6";
      case "mention":
        return "2 6";
      case "reply-to":
      case "repost-of":
      case "syndication":
        return "10 4 2 4";
      case "shared-topic":
        return "1.5 6";
      default:
        return "";
    }
  }

  /**
   * One visual edge per canonical (from, to, relation).
   * @returns {Array<{from: string, to: string, relation: string, dash: string, key: string}>}
   */
  function visualEdges() {
    const directed = connections
      .filter((edge) => enabledRelations.has(edge.relation || edge.kind))
      .map((edge) => ({
        from: edge.from,
        to: edge.to,
        relation: edge.relation || edge.kind,
        dash: dashFor(edge.relation || edge.kind),
        key: `${edge.from}::${edge.to}::${edge.relation || edge.kind}`,
        undirected: false,
      }));

    if (!enabledRelations.has("shared-topic")) {
      return directed;
    }

    const overlaps = topicOverlaps.map((pair) => ({
      from: pair.a,
      to: pair.b,
      relation: "shared-topic",
      dash: dashFor("shared-topic"),
      key: `shared-topic::${pair.a}::${pair.b}`,
      undirected: true,
    }));

    return [...directed, ...overlaps];
  }

  /**
   * @param {string} origin
   * @returns {{outgoing: typeof connections, incoming: typeof connections}}
   */
  function edgesFor(origin) {
    return {
      outgoing: connections.filter((edge) => edge.from === origin),
      incoming: connections.filter((edge) => edge.to === origin),
    };
  }

  /**
   * @param {string} origin
   * @returns {Array<{
   *   slug: string,
   *   label: string,
   *   articles: Array<{url: string, title: string}>,
   *   sites: Array<{origin: string, title: string, articles: Array<{url: string, title: string}>}>,
   * }>}
   */
  function topicsFor(origin) {
    const group = topicGroups.find((entry) => entry.origin === origin);
    return group ? group.topics : [];
  }

  /**
   * @param {typeof connections[number]} edge
   * @returns {string}
   */
  function kindLabel(edge) {
    const relation = edge.relation || edge.kind;

    switch (relation) {
      case "homepage-link":
        return "links to from the homepage";
      case "content-link":
        return "linked to";
      case "blogroll":
        return "includes in a blogroll";
      case "mention":
        return "mentioned";
      case "reply-to":
        return "replied to";
      case "repost-of":
        return "reposted";
      case "syndication":
        return "syndicated to";
      case "shared-topic":
        return "shared topic";
      default:
        return "content link";
    }
  }

  /**
   * @param {string} relation
   * @returns {HTMLSpanElement}
   */
  function relationSwatch(relation) {
    const swatch = document.createElement("span");
    swatch.className = "connections-swatch";
    swatch.setAttribute("data-connection-kind", relation);
    swatch.setAttribute("aria-hidden", "true");
    return swatch;
  }

  /**
   * @param {string} origin
   * @returns {string[]}
   */
  function relationKindsFor(origin) {
    const kinds = new Set();

    for (const edge of connections) {
      if (edge.from === origin || edge.to === origin) {
        kinds.add(edge.relation || edge.kind);
      }
    }

    for (const pair of topicOverlaps) {
      if (pair.a === origin || pair.b === origin) {
        kinds.add("shared-topic");
      }
    }

    return [...kinds];
  }

  /**
   * Puts relation stroke samples in the top-right of each site card.
   */
  function decorateRelationKeys() {
    for (const section of siteSections) {
      const origin = section.getAttribute("data-connection-origin");
      const keys = section.querySelector("[data-connection-keys]");

      if (!origin || !keys) {
        continue;
      }

      keys.replaceChildren(
        ...relationKindsFor(origin).map((kind) => relationSwatch(kind)),
      );
    }
  }

  /**
   * Unique relation phrases for a set of edges.
   * @param {typeof connections} edges
   * @returns {string}
   */
  function pairKindLabel(edges) {
    const labels = [];

    for (const edge of edges) {
      const label = bubbleRelation(edge);

      if (!labels.includes(label)) {
        labels.push(label);
      }
    }

    return labels.join(", ");
  }

  /**
   * Names, arrow, and relation for a pair of sites.
   * One-way links read source → target. Reciprocal links or topic-only pairs use ↔.
   * @param {string} leftOrigin
   * @param {string} rightOrigin
   * @param {string} fallbackKind
   * @returns {string}
   */
  function bubblePairHeading(leftOrigin, rightOrigin, fallbackKind) {
    /**
     * @param {string} origin
     * @returns {string}
     */
    function titleOf(origin) {
      const site = byOrigin.get(origin);

      return site ? site.title : origin;
    }

    const forward = connections.filter(
      (edge) => edge.from === leftOrigin && edge.to === rightOrigin,
    );
    const back = connections.filter(
      (edge) => edge.from === rightOrigin && edge.to === leftOrigin,
    );

    let source = leftOrigin;
    let target = rightOrigin;
    let mark = "↔";
    let kind = fallbackKind;

    if (forward.length > 0 && back.length === 0) {
      mark = "→";
      kind = pairKindLabel(forward) || fallbackKind;
    } else if (back.length > 0 && forward.length === 0) {
      source = rightOrigin;
      target = leftOrigin;
      mark = "→";
      kind = pairKindLabel(back) || fallbackKind;
    } else if (forward.length > 0 && back.length > 0) {
      mark = "↔";
      kind = pairKindLabel([...forward, ...back]) || fallbackKind;
    }

    const leftTitle = titleOf(source);
    const rightTitle = titleOf(target);
    const spoken =
      mark === "→"
        ? `${leftTitle} ${kind} ${rightTitle}`
        : `${leftTitle} and ${rightTitle}, ${kind}`;

    return `<h2 class="connections-bubble__title connections-bubble__title--pair" aria-label="${escapeAttribute(spoken)}"><span>${escapeHTML(leftTitle)}</span><span class="connections-bubble__join"><span class="connections-bubble__dir" aria-hidden="true">${escapeHTML(mark)}</span><span class="connections-bubble__kind">${escapeHTML(kind)}</span></span><span>${escapeHTML(rightTitle)}</span></h2>`;
  }

  /**
   * Chart bubble heading. Pair titles stack so the join mark lines up.
   * @param {string} left
   * @param {string} [right]
   * @param {string} [join]
   * @returns {string}
   */
  function bubbleHeading(left, right = "", join = "") {
    if (!right) {
      return `<h2 class="connections-bubble__title">${escapeHTML(left)}</h2>`;
    }

    return `<h2 class="connections-bubble__title connections-bubble__title--pair"><span>${escapeHTML(left)}</span><span class="connections-bubble__join" aria-hidden="true">${escapeHTML(join)}</span><span>${escapeHTML(right)}</span></h2>`;
  }

  /**
   * Short relation phrase for the chart bubble.
   * @param {typeof connections[number]} edge
   * @returns {string}
   */
  function bubbleRelation(edge) {
    const label = kindLabel(edge);

    return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  }

  /**
   * One connection line: relation and the other site. No domain or page URL.
   * @param {typeof connections[number]} edge
   * @param {"to" | "from"} side
   * @returns {string}
   */
  function bubbleEdgeItem(edge, side) {
    const peerOrigin = side === "to" ? edge.to : edge.from;
    const peer = byOrigin.get(peerOrigin);
    const peerTitle = peer ? peer.title : peerOrigin;
    const arrow = side === "to" ? "→" : "←";

    return `<li class="connections-bubble__row connections-bubble__row--directed"><span class="connections-bubble__dir" aria-hidden="true">${arrow}</span><span class="connections-bubble__row-text">${escapeHTML(bubbleRelation(edge))} <a href="${escapeAttribute(outboundHref(edge.href))}" target="_blank" rel="noopener">${escapeHTML(peerTitle)}</a></span></li>`;
  }

  /**
   * @param {string} heading
   * @param {string} items
   * @param {string} [listClass]
   * @returns {string}
   */
  function bubbleSection(heading, items, listClass = "") {
    if (!items) {
      return "";
    }

    const classes = ["connections-bubble__list", listClass]
      .filter(Boolean)
      .join(" ");

    const headingMarkup = heading ? `<h3>${escapeHTML(heading)}</h3>` : "";

    return `<section class="connections-bubble__section">${headingMarkup}<ul class="${classes}">${items}</ul></section>`;
  }

  /**
   * @param {string | null} [origin]
   */
  function renderDetail(origin = selectedOrigin) {
    if (selectedEdgeKey && selectedEdgeKey.startsWith("shared-topic::")) {
      const overlap = topicOverlaps.find(
        (pair) => `shared-topic::${pair.a}::${pair.b}` === selectedEdgeKey,
      );

      if (overlap) {
        const directed = connections.some(
          (edge) =>
            (edge.from === overlap.a && edge.to === overlap.b) ||
            (edge.from === overlap.b && edge.to === overlap.a),
        );
        const rows = overlap.topics
          .map(
            (topic) =>
              `<li><a href="/topics/${escapeAttribute(topic.slug)}/">${escapeHTML(topic.label)}</a></li>`,
          )
          .join("");

        showBubble(`
          ${bubblePairHeading(overlap.a, overlap.b, "Shared topics")}
          ${bubbleSection(
            directed ? "Shared topics" : "",
            rows,
            "connections-bubble__list--flow",
          )}
        `);
        return;
      }
    }

    if (selectedEdgeKey) {
      const edge = connections.find(
        (item) =>
          `${item.from}::${item.to}::${item.relation || item.kind}` ===
          selectedEdgeKey,
      );

      if (edge) {
        const from = byOrigin.get(edge.from);
        const to = byOrigin.get(edge.to);
        const observations =
          Array.isArray(edge.evidence) && edge.evidence.length > 0
            ? edge.evidence
            : [{ page: edge.page, href: edge.href, text: edge.text }];
        const seen = new Set();
        const rows = observations
          .map((item) => {
            const label = typeof item.text === "string" ? item.text.trim() : "";

            if (!label || label.length > 48 || seen.has(label)) {
              return "";
            }

            seen.add(label);
            const href = safeHttpHref(item.href || edge.href);
            const decorated = href ? outboundHref(href) : "";

            return decorated
              ? `<li class="connections-bubble__row"><a href="${escapeAttribute(decorated)}" target="_blank" rel="noopener">${escapeHTML(label)}</a></li>`
              : `<li class="connections-bubble__row">${escapeHTML(label)}</li>`;
          })
          .join("");

        showBubble(`
          ${bubbleHeading(
            from ? from.title : edge.from,
            to ? to.title : edge.to,
            "→",
          )}
          ${
            rows
              ? bubbleSection(bubbleRelation(edge), rows)
              : `<p class="connections-bubble__relation">${escapeHTML(bubbleRelation(edge))}</p>`
          }
        `);
        return;
      }
    }

    if (!origin) {
      hideBubble();
      return;
    }

    const site = byOrigin.get(origin);

    if (!site) {
      hideBubble();
      return;
    }

    const { outgoing, incoming } = edgesFor(origin);
    const topics = topicsFor(origin);
    const topicRows = topics
      .map(
        (topic) =>
          `<li><a href="/topics/${escapeAttribute(topic.slug)}/">${escapeHTML(topic.label)}</a></li>`,
      )
      .join("");

    showBubble(`
      ${bubbleHeading(site.title)}
      ${bubbleSection(
        "Connects to",
        outgoing.map((edge) => bubbleEdgeItem(edge, "to")).join(""),
      )}
      ${bubbleSection(
        "Connected from",
        incoming.map((edge) => bubbleEdgeItem(edge, "from")).join(""),
      )}
      ${bubbleSection(
        "Shared topics",
        topicRows,
        "connections-bubble__list--flow",
      )}
    `);
  }

  /**
   * Shows explanation HTML in the chart bubble.
   * @param {string} html
   */
  function showBubble(html) {
    bubbleBody.innerHTML = html;
    bubble.hidden = false;
  }

  /**
   * Hides the chart bubble.
   */
  function hideBubble() {
    bubble.hidden = true;
    bubbleBody.replaceChildren();
  }

  /**
   * Pins the bubble beside the selected circle or the middle of the selected line.
   */
  function placeBubble() {
    if (bubble.hidden) {
      return;
    }

    const svg = graphStage.querySelector("svg");

    if (!svg) {
      return;
    }

    const point = bubbleAnchor();
    const svgBox = svg.getBoundingClientRect();
    const host = graphRoot.getBoundingClientRect();
    const view = currentViewBox();
    const px =
      svgBox.left -
      host.left +
      ((point.x - view.x) / view.width) * svgBox.width;
    const bubbleWidth = bubble.offsetWidth || 280;
    const bubbleHeight = bubble.offsetHeight || 120;
    const onLeft = px < host.width / 2;
    let left = onLeft ? host.width - bubbleWidth - 10 : 10;
    let top = 8;

    if (bubbleHeight + 16 < host.height) {
      top = svgBox.top - host.top + 8;

      if (top + bubbleHeight > host.height - 8) {
        top = Math.max(8, host.height - bubbleHeight - 8);
      }
    }

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  /**
   * ViewBox point for the open bubble.
   * @returns {{x: number, y: number}}
   */
  function bubbleAnchor() {
    if (selectedEdgeKey) {
      const link = visualEdges().find((item) => item.key === selectedEdgeKey);
      const source = link
        ? nodes.find((node) => node.origin === link.from)
        : null;
      const target = link
        ? nodes.find((node) => node.origin === link.to)
        : null;

      if (source && target) {
        return {
          x: (source.x + target.x) / 2,
          y: (source.y + target.y) / 2,
        };
      }
    }

    const node = nodes.find((item) => item.origin === selectedOrigin);

    if (node) {
      return { x: node.x, y: node.y };
    }

    return { x: camera.x, y: camera.y };
  }

  /**
   * @param {string | null} origin
   */
  function selectOrigin(origin) {
    selectedOrigin = origin && byOrigin.has(origin) ? origin : null;
    selectedEdgeKey = null;

    for (const section of siteSections) {
      const isSelected =
        section.getAttribute("data-connection-origin") === selectedOrigin;
      section.classList.toggle("is-selected", isSelected);
    }

    for (const button of document.querySelectorAll(
      "[data-connection-select]",
    )) {
      const isSelected = button.getAttribute("data-origin") === selectedOrigin;
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    }

    renderDetail();
    drawGraph();
    placeBubble();
  }

  /**
   * @param {string | null} key
   */
  function selectEdge(key) {
    selectedEdgeKey = key;
    selectedOrigin = null;

    for (const section of siteSections) {
      section.classList.remove("is-selected");
    }

    for (const button of document.querySelectorAll(
      "[data-connection-select]",
    )) {
      button.setAttribute("aria-pressed", "false");
    }

    renderDetail();
    drawGraph();
    placeBubble();
  }

  bubbleClose.addEventListener("click", () => {
    selectOrigin(null);
  });

  const HUB_HOST = "joshternet.org";
  const VIEW_WIDTH = 640;
  const VIEW_HEIGHT = 420;
  const MIN_SCALE = 0.35;
  const MAX_SCALE = 2.75;
  const RING_GAP = 320;
  const NODE_GAP = 240;
  const SEPARATION = 200;
  const LINK_REST = 300;
  const camera = { x: 0, y: 0, scale: 1 };
  const PAN_THRESHOLD = 8;
  let mapDragged = false;

  /**
   * Opens the bubble for a chart circle or line under the pointer.
   * @param {Element | null} target
   */
  function selectFromPointerTarget(target) {
    if (!target) {
      return;
    }

    const edge = target.closest("[data-edge-key]");

    if (edge) {
      selectEdge(edge.getAttribute("data-edge-key"));
      return;
    }

    const node = target.closest("[data-origin]");

    if (node) {
      selectOrigin(node.getAttribute("data-origin"));
    }
  }

  /**
   * @param {string} origin
   * @returns {boolean}
   */
  function originIsHub(origin) {
    const url = canonicalOrigin(origin);

    if (!url) {
      return false;
    }

    return url.hostname.replace(/^www\./, "") === HUB_HOST;
  }

  const nodes = graphParticipants.map((participant) => ({
    origin: participant.origin,
    domain: participant.domain,
    title: participant.title,
    hub: originIsHub(participant.origin),
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  }));

  const links = visualEdges();

  /**
   * Places the hub at the world origin and other sites on expanding rings.
   */
  function placeNodes() {
    const hub = nodes.find((node) => node.hub) || null;
    const others = nodes.filter((node) => node !== hub);

    if (hub) {
      hub.x = 0;
      hub.y = 0;
    }

    let index = 0;
    let ring = 0;

    while (index < others.length) {
      const radius = RING_GAP * (ring + 1);
      const capacity = Math.max(
        6,
        Math.floor((Math.PI * 2 * radius) / NODE_GAP),
      );
      const count = Math.min(capacity, others.length - index);

      for (let step = 0; step < count; step += 1) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * step) / count;
        const node = others[index + step];
        node.x = Math.cos(angle) * radius;
        node.y = Math.sin(angle) * radius;
      }

      index += count;
      ring += 1;
    }
  }

  /**
   * Tiny force iteration. Equal radius for every node—no degree sizing.
   * The hub stays pinned so the map has a stable center as the network grows.
   * @param {number} iterations
   */
  function tickLayout(iterations) {
    if (prefersReducedMotion || graphParticipants.length <= 1) {
      return;
    }

    for (let step = 0; step < iterations; step += 1) {
      for (let index = 0; index < nodes.length; index += 1) {
        const left = nodes[index];

        for (let other = index + 1; other < nodes.length; other += 1) {
          const right = nodes[other];
          let dx = right.x - left.x;
          let dy = right.y - left.y;
          let distance = Math.hypot(dx, dy) || 0.01;

          if (distance < SEPARATION) {
            const force = ((SEPARATION - distance) / distance) * 0.05;
            dx *= force;
            dy *= force;

            if (!left.hub) {
              left.vx -= dx;
              left.vy -= dy;
            }

            if (!right.hub) {
              right.vx += dx;
              right.vy += dy;
            }
          }
        }
      }

      for (const link of links) {
        const source = nodes.find((node) => node.origin === link.from);
        const target = nodes.find((node) => node.origin === link.to);

        if (!source || !target || link.undirected) {
          continue;
        }

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.hypot(dx, dy) || 0.01;
        const force = ((distance - LINK_REST) / distance) * 0.01;

        if (!source.hub) {
          source.vx += dx * force;
          source.vy += dy * force;
        }

        if (!target.hub) {
          target.vx -= dx * force;
          target.vy -= dy * force;
        }
      }

      for (const node of nodes) {
        if (node.hub) {
          node.x = 0;
          node.y = 0;
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        node.vx *= 0.85;
        node.vy *= 0.85;
        node.x += node.vx;
        node.y += node.vy;
      }
    }
  }

  /**
   * @param {number} value
   * @returns {number}
   */
  function clampScale(value) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  }

  /**
   * Camera rectangle in world units.
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  function currentViewBox() {
    const width = VIEW_WIDTH / camera.scale;
    const height = VIEW_HEIGHT / camera.scale;

    return {
      x: camera.x - width / 2,
      y: camera.y - height / 2,
      width,
      height,
    };
  }

  /**
   * Writes the camera into the SVG viewBox without rebuilding marks.
   */
  function applyCamera() {
    const svg = graphStage.querySelector("svg");

    if (!svg) {
      return;
    }

    const view = currentViewBox();
    svg.setAttribute(
      "viewBox",
      `${view.x} ${view.y} ${view.width} ${view.height}`,
    );
    placeBubble();
  }

  /**
   * Centers Joshternet (or the graph centroid) and fits neighbors in the frame
   * until they would shrink below a readable scale.
   */
  function centerHub() {
    const hub = nodes.find((node) => node.hub);
    camera.x = hub ? hub.x : 0;
    camera.y = hub ? hub.y : 0;

    if (nodes.length === 0) {
      camera.scale = 1;
      applyCamera();
      return;
    }

    let maxReach = RING_GAP;

    for (const node of nodes) {
      maxReach = Math.max(
        maxReach,
        Math.hypot(node.x - camera.x, node.y - camera.y) + 64,
      );
    }

    const fitted = Math.min(
      VIEW_WIDTH / (maxReach * 2),
      VIEW_HEIGHT / (maxReach * 2),
      1.15,
    );
    camera.scale = clampScale(fitted);
    applyCamera();
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{x: number, y: number} | null}
   */
  function worldFromClient(clientX, clientY) {
    const svg = graphStage.querySelector("svg");

    if (!svg) {
      return null;
    }

    const box = svg.getBoundingClientRect();
    const view = currentViewBox();

    if (box.width === 0 || box.height === 0) {
      return { x: camera.x, y: camera.y };
    }

    return {
      x: view.x + ((clientX - box.left) / box.width) * view.width,
      y: view.y + ((clientY - box.top) / box.height) * view.height,
    };
  }

  /**
   * Zooms the map while keeping a world point under the pointer.
   * @param {number} nextScale
   * @param {{x: number, y: number} | null} [origin]
   */
  function zoomTo(nextScale, origin) {
    const previous = camera.scale;
    const focus = origin || { x: camera.x, y: camera.y };
    camera.scale = clampScale(nextScale);
    const ratio = previous / camera.scale;
    camera.x = focus.x - (focus.x - camera.x) * ratio;
    camera.y = focus.y - (focus.y - camera.y) * ratio;
    applyCamera();
  }

  placeNodes();
  tickLayout(prefersReducedMotion ? 0 : 80);
  centerHub();

  /**
   * Quadratic bow so stacked links leave the node and separate in the middle.
   * @param {{x: number, y: number}} source
   * @param {{x: number, y: number}} target
   * @param {number} bow
   * @returns {string}
   */
  function edgeCurve(source, target, bow) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const shorten = 22;
    const unitX = dx / distance;
    const unitY = dy / distance;
    const x1 = source.x + unitX * shorten;
    const y1 = source.y + unitY * shorten;
    const x2 = target.x - unitX * shorten;
    const y2 = target.y - unitY * shorten;
    const controlX = (x1 + x2) / 2 + -unitY * bow;
    const controlY = (y1 + y2) / 2 + unitX * bow;

    return `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
  }

  /**
   * Draws or redraws the SVG graph with equal nodes and directed marks.
   */
  function drawGraph() {
    const drawn = visualEdges();
    const lanes = new Map();

    for (const link of drawn) {
      const pair = [link.from, link.to].sort().join("::");
      const lane = lanes.get(pair) || [];
      lane.push(link.key);
      lanes.set(pair, lane);
    }

    const marks = drawn
      .map((link) => {
        const source = nodes.find((node) => node.origin === link.from);
        const target = nodes.find((node) => node.origin === link.to);

        if (!source || !target) {
          return "";
        }

        const pair = [link.from, link.to].sort().join("::");
        const lane = lanes.get(pair) || [link.key];
        const bow =
          lane.length < 2
            ? 0
            : (lane.indexOf(link.key) - (lane.length - 1) / 2) * 48;

        const active =
          selectedEdgeKey === link.key ||
          (selectedOrigin &&
            (link.from === selectedOrigin || link.to === selectedOrigin));
        const marker = link.undirected
          ? ""
          : ` marker-end="url(#connections-arrow)"`;
        const dash = link.dash
          ? ` stroke-dasharray="${escapeAttribute(link.dash)}"`
          : "";
        const kind = ` data-connection-kind="${escapeAttribute(link.relation)}"`;
        const fromTitle = byOrigin.get(link.from);
        const toTitle = byOrigin.get(link.to);
        const label =
          link.relation === "shared-topic"
            ? `Shared topics between ${fromTitle ? fromTitle.title : link.from} and ${toTitle ? toTitle.title : link.to}`
            : `${fromTitle ? fromTitle.title : link.from} ${link.relation} ${toTitle ? toTitle.title : link.to}`;
        const curve = edgeCurve(source, target, bow);

        return `<g
          class="connections-graph__link${active ? " is-active" : ""}"
          data-edge-key="${escapeAttribute(link.key)}"
          tabindex="0"
          role="button"
          aria-label="${escapeAttribute(label)}"
        >
          <path class="connections-graph__hit" d="${escapeAttribute(curve)}"></path>
          <path class="connections-graph__edge${active ? " is-active" : ""}"${kind} d="${escapeAttribute(curve)}"${marker}${dash}></path>
        </g>`;
      })
      .join("");

    const nodeMarks = nodes
      .map((node) => {
        const selected = node.origin === selectedOrigin;
        const label =
          graphParticipants.length <= 12 || selected ? node.domain : "";

        return `<g class="connections-graph__node${selected ? " is-selected" : ""}" data-origin="${escapeAttribute(node.origin)}" tabindex="0" role="button" aria-pressed="${selected ? "true" : "false"}" aria-label="${escapeAttribute(node.title)}">
          <circle cx="${node.x}" cy="${node.y}" r="14"></circle>
          ${
            label
              ? `<text x="${node.x}" y="${node.y + 28}" text-anchor="middle">${escapeHTML(label)}</text>`
              : ""
          }
        </g>`;
      })
      .join("");

    graphStage.innerHTML = `
      <svg class="connections-graph__svg" viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Directed links between participating sites. Drag to pan. Scroll to zoom.">
        <defs>
          <marker id="connections-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"></path>
          </marker>
        </defs>
        <rect class="connections-graph__map" x="-20000" y="-20000" width="40000" height="40000"></rect>
        ${marks}
        ${nodeMarks}
      </svg>
    `;
    applyCamera();

    for (const edge of graphStage.querySelectorAll("[data-edge-key]")) {
      const key = edge.getAttribute("data-edge-key");

      edge.addEventListener("click", (event) => {
        event.stopPropagation();

        if (mapDragged) {
          return;
        }

        selectEdge(key);
      });

      edge.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        selectEdge(key);
      });
    }

    for (const node of graphStage.querySelectorAll("[data-origin]")) {
      const origin = node.getAttribute("data-origin");

      node.addEventListener("click", () => {
        if (mapDragged) {
          return;
        }

        selectOrigin(origin);
      });

      node.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        selectOrigin(origin);
      });
    }
  }

  /**
   * Wraps the SVG stage in a clipping viewport and adds map controls.
   */
  function ensureMapChrome() {
    let viewport = graphRoot.querySelector("[data-connections-viewport]");

    if (!viewport) {
      viewport = document.createElement("div");
      viewport.className = "connections-graph__viewport";
      viewport.setAttribute("data-connections-viewport", "");
      graphStage.replaceWith(viewport);
      viewport.append(graphStage);
    }

    viewport.setAttribute("tabindex", "0");
    viewport.setAttribute(
      "aria-label",
      "Joshternet connections map. Drag to pan. Scroll to zoom.",
    );

    let tools = graphRoot.querySelector("[data-connections-map-tools]");

    if (!tools) {
      tools = document.createElement("div");
      tools.className = "connections-graph__map-tools";
      tools.setAttribute("data-connections-map-tools", "");
      tools.innerHTML = `
        <button type="button" data-connections-zoom-in aria-label="Zoom in">+</button>
        <button type="button" data-connections-zoom-out aria-label="Zoom out">−</button>
        <button type="button" data-connections-map-reset aria-label="Center Joshternet">Center</button>
      `;
      viewport.append(tools);
    }

    return viewport;
  }

  const viewport = ensureMapChrome();
  const zoomIn = graphRoot.querySelector("[data-connections-zoom-in]");
  const zoomOut = graphRoot.querySelector("[data-connections-zoom-out]");
  const mapReset = graphRoot.querySelector("[data-connections-map-reset]");

  /**
   * @type {{
   *   pointerId: number,
   *   startX: number,
   *   startY: number,
   *   cameraX: number,
   *   cameraY: number,
   *   moved: boolean,
   *   captured: boolean,
   *   target: Element | null
   * } | null}
   */
  let pan = null;

  graphStage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    if (
      !(event.target instanceof Element) ||
      event.target.closest("[data-connections-map-tools]")
    ) {
      return;
    }

    pan = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
      moved: false,
      captured: false,
      target: event.target instanceof Element ? event.target : null,
    };
    mapDragged = false;
  });

  graphStage.addEventListener("pointermove", (event) => {
    if (!pan || event.pointerId !== pan.pointerId) {
      return;
    }

    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;

    if (!pan.moved && Math.hypot(dx, dy) < PAN_THRESHOLD) {
      return;
    }

    pan.moved = true;
    mapDragged = true;
    viewport.classList.add("is-panning");

    if (!pan.captured) {
      pan.captured = true;

      try {
        graphStage.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointer events in tests have no hardware capture.
      }
    }

    const svg = graphStage.querySelector("svg");
    const box = svg
      ? svg.getBoundingClientRect()
      : { width: VIEW_WIDTH, height: VIEW_HEIGHT };
    const view = currentViewBox();
    const scaleX = box.width === 0 ? 1 : view.width / box.width;
    const scaleY = box.height === 0 ? 1 : view.height / box.height;
    camera.x = pan.cameraX - dx * scaleX;
    camera.y = pan.cameraY - dy * scaleY;
    applyCamera();
  });

  /**
   * @param {PointerEvent} event
   */
  function endPan(event) {
    if (!pan || event.pointerId !== pan.pointerId) {
      return;
    }

    const finished = pan;
    pan = null;
    viewport.classList.remove("is-panning");

    if (finished.moved) {
      mapDragged = true;
      window.setTimeout(() => {
        mapDragged = false;
      }, 0);
      return;
    }

    mapDragged = true;
    window.setTimeout(() => {
      mapDragged = false;
    }, 0);
    selectFromPointerTarget(finished.target);
  }

  graphStage.addEventListener("pointerup", endPan);
  graphStage.addEventListener("pointercancel", endPan);

  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const world = worldFromClient(event.clientX, event.clientY);
      const direction = event.deltaY > 0 ? 1 / 1.12 : 1.12;
      zoomTo(camera.scale * direction, world);
    },
    { passive: false },
  );

  if (zoomIn) {
    zoomIn.addEventListener("click", () => {
      zoomTo(camera.scale * 1.2, { x: camera.x, y: camera.y });
    });
  }

  if (zoomOut) {
    zoomOut.addEventListener("click", () => {
      zoomTo(camera.scale / 1.2, { x: camera.x, y: camera.y });
    });
  }

  if (mapReset) {
    mapReset.addEventListener("click", () => {
      centerHub();
    });
  }

  viewport.addEventListener("keydown", (event) => {
    if (event.target !== viewport) {
      return;
    }

    const step = 48 / camera.scale;

    switch (event.key) {
      case "ArrowLeft":
        camera.x -= step;
        break;
      case "ArrowRight":
        camera.x += step;
        break;
      case "ArrowUp":
        camera.y -= step;
        break;
      case "ArrowDown":
        camera.y += step;
        break;
      case "+":
      case "=":
        zoomTo(camera.scale * 1.2);
        event.preventDefault();
        return;
      case "-":
      case "_":
        zoomTo(camera.scale / 1.2);
        event.preventDefault();
        return;
      case "Home":
        centerHub();
        event.preventDefault();
        return;
      default:
        return;
    }

    event.preventDefault();
    applyCamera();
  });

  const filterRoot = document.querySelector("[data-relation-filters]");

  if (filterRoot) {
    const filterList =
      filterRoot.querySelector("[data-relation-filter-list]") || filterRoot;
    const types = [
      ...new Set([
        ...connections.map((edge) => edge.relation || edge.kind),
        ...(topicOverlaps.length > 0 ? ["shared-topic"] : []),
      ]),
    ];

    for (const relation of types) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          enabledRelations.add(relation);
        } else {
          enabledRelations.delete(relation);
        }

        drawGraph();
      });

      const name = kindLabel({ relation });
      const checkboxLabel = `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
      const label = document.createElement("label");
      label.className = "connections-filter";
      label.append(checkbox, document.createTextNode(checkboxLabel));
      filterList.append(label);
    }
  }

  decorateRelationKeys();

  for (const button of document.querySelectorAll("[data-connection-select]")) {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      selectOrigin(button.getAttribute("data-origin"));
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    selectOrigin(null);
  });

  const params = new URLSearchParams(window.location.search);
  const requestedSite = (params.get("site") || "").trim().toLowerCase();
  const requested = requestedSite
    ? participants.find((participant) => participant.domain === requestedSite)
    : null;

  selectOrigin(requested ? requested.origin : null);
})();
