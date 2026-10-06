/**
 * Goal & Constraints:
 * Observed participant relationships only (homepage-link, content-link,
 * blogroll, reply-to, repost-of, syndication). No inferred friendship,
 * no dual topic edges, no popularity. /.well-known/josh never creates a link.
 */

import { originFromHttpUrl } from "./blogroll.mjs";
import { decodeHtmlEntities, normalizeText } from "./lib.mjs";

/**
 * @typedef {'homepage-link' | 'content-link' | 'blogroll' | 'reply-to' | 'repost-of' | 'syndication'} ConnectionRelation
 */

/**
 * @typedef {{
 *   href: string,
 *   text?: string,
 *   rel?: string[],
 *   classNames?: string[],
 *   page?: string,
 * }} ConnectionLinkInput
 */

/**
 * @typedef {{
 *   from: string,
 *   to: string,
 *   relation: ConnectionRelation,
 *   directed: boolean,
 *   via?: string,
 *   source: string,
 *   href: string,
 *   text: string,
 *   rel: string[],
 *   page: string,
 *   observed_at?: string,
 *   evidence_count?: number,
 *   evidence?: Array<Record<string, unknown>>,
 * }} ConnectionObservation
 */

/**
 * @typedef {{
 *   slug: string,
 *   label?: string,
 *   sources?: string[],
 *   pages?: Array<{url?: string, title?: string}>,
 * }} SubjectSignal
 */

/** Origin of the Joshternet site that lists Network participants. */
export const HUB_ORIGIN = "https://joshternet.org";

/**
 * True when the URL path is the Josh participation declaration.
 * @param {string} href
 * @returns {boolean}
 */
export function isParticipationDeclarationPath(href) {
  if (typeof href !== "string" || !href) {
    return false;
  }

  try {
    const url = new URL(href);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return path === "/.well-known/josh";
  } catch {
    return false;
  }
}

/**
 * True when the page is a Joshternet directory surface that republishes
 * participant sites, feeds, or elsewhere profiles. Those listings are not
 * connection evidence.
 * @param {string} href
 * @param {string} [hubOrigin]
 * @returns {boolean}
 */
export function isHubDirectoryPage(href, hubOrigin = HUB_ORIGIN) {
  if (typeof href !== "string" || !href || typeof hubOrigin !== "string") {
    return false;
  }

  try {
    const url = new URL(href);

    if (originFromHttpUrl(url.href) !== hubOrigin) {
      return false;
    }

    const path = url.pathname.replace(/\/+$/, "") || "/";

    return (
      path === "/network" ||
      path === "/wander" ||
      path === "/connections" ||
      path === "/activity" ||
      path === "/topics" ||
      path.startsWith("/topics/") ||
      path === "/assets/network/joshternet.opml" ||
      path.endsWith("/joshternet.opml")
    );
  } catch {
    return false;
  }
}

/**
 * True when HTML marks the page as derived Joshternet analysis output.
 * @param {string} html
 * @returns {boolean}
 */
export function hasDerivedAnalysisMarker(html) {
  if (typeof html !== "string" || !html) {
    return false;
  }

  return (
    /<meta\b[^>]*name=["']joshternet-analysis["'][^>]*content=["']derived["']/i.test(
      html,
    ) ||
    /<meta\b[^>]*content=["']derived["'][^>]*name=["']joshternet-analysis["']/i.test(
      html,
    )
  );
}

/**
 * Homepage vs deeper content page for relation typing.
 * @param {string} pageUrl
 * @param {string} sourceOrigin
 * @returns {'homepage-link' | 'content-link'}
 */
export function relationForPage(pageUrl, sourceOrigin) {
  try {
    const url = new URL(pageUrl);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (originFromHttpUrl(url.href) !== sourceOrigin) {
      return "content-link";
    }

    if (path === "/" || path === "/index.html" || path === "/index.htm") {
      return "homepage-link";
    }
  } catch {
    return "content-link";
  }

  return "content-link";
}

/**
 * Explicit IndieWeb / microformat relation when present on the anchor.
 * @param {string[]} rel
 * @param {string[]} classNames
 * @returns {ConnectionRelation | null}
 */
export function explicitIndiewebRelation(rel = [], classNames = []) {
  const tokens = new Set([
    ...normalizeRelTokens(rel),
    ...normalizeRelTokens(classNames),
  ]);

  if (tokens.has("u-in-reply-to") || tokens.has("in-reply-to")) {
    return "reply-to";
  }

  if (tokens.has("u-repost-of") || tokens.has("repost-of")) {
    return "repost-of";
  }

  if (tokens.has("u-syndication") || tokens.has("syndication")) {
    return "syndication";
  }

  return null;
}

/**
 * Maps blogroll.json publisher edges into connection observations.
 * @param {Array<{from?: string, to?: string, blogroll?: string}>} edges
 * @returns {ConnectionObservation[]}
 */
export function blogrollConnectionObservations(edges) {
  /** @type {ConnectionObservation[]} */
  const observations = [];
  const seen = new Set();

  if (!Array.isArray(edges)) {
    return observations;
  }

  for (const edge of edges) {
    if (
      !edge ||
      typeof edge.from !== "string" ||
      typeof edge.to !== "string" ||
      typeof edge.blogroll !== "string" ||
      !edge.blogroll
    ) {
      continue;
    }

    if (String(edge.blogroll).includes("/assets/network/joshternet.opml")) {
      continue;
    }

    const key = `blogroll\0${edge.from}\0${edge.to}\0${edge.blogroll}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    observations.push({
      from: edge.from,
      to: edge.to,
      relation: "blogroll",
      directed: true,
      via: "",
      source: "blogroll",
      href: edge.blogroll,
      text: "",
      rel: ["blogroll"],
      page: edge.blogroll,
      evidence: [
        {
          class: "observed",
          source: "blogroll",
          page: edge.blogroll,
          href: edge.blogroll,
        },
      ],
    });
  }

  return observations;
}

/**
 * Normalizes link hrefs (strings or link records) to unique http(s) origins.
 * @param {unknown} urls
 * @returns {string[]}
 */
export function originsFromLinkUrls(urls) {
  if (!Array.isArray(urls)) {
    return [];
  }

  const origins = [];
  const seen = new Set();

  for (const value of urls) {
    let href = "";

    if (typeof value === "string") {
      href = value;
    } else if (
      value &&
      typeof value === "object" &&
      typeof value.href === "string"
    ) {
      href = value.href;
    }

    if (!href || isParticipationDeclarationPath(href)) {
      continue;
    }

    try {
      const origin = originFromHttpUrl(href);

      if (seen.has(origin)) {
        continue;
      }

      seen.add(origin);
      origins.push(origin);
    } catch {
      continue;
    }
  }

  return origins;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeRelTokens(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const tokens = [];
  const seen = new Set();

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const token = normalizeText(entry).toLowerCase();

    if (!token || seen.has(token)) {
      continue;
    }

    seen.add(token);
    tokens.push(token);
  }

  tokens.sort((left, right) => left.localeCompare(right));
  return tokens;
}

/**
 * @param {string} value
 * @returns {string}
 */
export function slugifyTopic(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Builds directed content-link observations between participants.
 * Drops same-origin, non-participants, and /.well-known/josh.
 * @param {{
 *   sourceOrigin: string,
 *   pageUrl: string,
 *   links: Array<ConnectionLinkInput | string>,
 *   participantOrigins: Set<string> | string[],
 * }} input
 * @returns {ConnectionObservation[]}
 */
export function connectionObservations({
  sourceOrigin,
  pageUrl,
  links,
  participantOrigins,
}) {
  const participants = new Set(participantOrigins);
  const observations = [];
  const seen = new Set();

  if (typeof sourceOrigin !== "string" || !participants.has(sourceOrigin)) {
    return observations;
  }

  if (typeof pageUrl !== "string" || !pageUrl) {
    return observations;
  }

  if (!Array.isArray(links)) {
    return observations;
  }

  let pageCanonical = "";

  try {
    pageCanonical = new URL(pageUrl).href;
  } catch {
    return observations;
  }

  for (const candidate of links) {
    let href = "";
    let text = "";
    let rel = [];
    let classNames = [];
    let observationPage = pageCanonical;

    if (typeof candidate === "string") {
      href = decodeHtmlEntities(candidate);
    } else if (candidate && typeof candidate === "object") {
      if (typeof candidate.href === "string") {
        href = decodeHtmlEntities(candidate.href);
      }

      if (typeof candidate.text === "string") {
        text = normalizeText(decodeHtmlEntities(candidate.text)).slice(0, 200);
      }

      rel = normalizeRelTokens(candidate.rel);
      classNames = normalizeRelTokens(candidate.classNames);

      if (typeof candidate.page === "string" && candidate.page) {
        try {
          observationPage = new URL(candidate.page).href;
        } catch {
          continue;
        }
      }
    } else {
      continue;
    }

    if (isHubDirectoryPage(observationPage)) {
      continue;
    }

    if (!href || isParticipationDeclarationPath(href)) {
      continue;
    }

    let to = "";

    try {
      const url = new URL(href);
      to = originFromHttpUrl(url.href);
      href = url.href;
    } catch {
      continue;
    }

    if (to === sourceOrigin || !participants.has(to)) {
      continue;
    }

    const key = `link\0${sourceOrigin}\0${to}\0${href}\0${observationPage}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const relation =
      explicitIndiewebRelation(rel, classNames) ||
      relationForPage(observationPage, sourceOrigin);
    observations.push({
      from: sourceOrigin,
      to,
      relation,
      directed: true,
      source:
        relation === "homepage-link" || relation === "content-link"
          ? "content"
          : relation,
      href,
      text,
      rel,
      page: observationPage,
      evidence: [
        {
          class: "observed",
          page: observationPage,
          href,
          text,
          rel,
        },
      ],
    });
  }

  return observations;
}

/**
 * @deprecated Shared third-party links are not friendship. Always returns [].
 * @returns {ConnectionObservation[]}
 */
export function friendConnectionObservations() {
  return [];
}

/**
 * @deprecated Shared topics are memberships, not directed edges. Always [].
 * @returns {ConnectionObservation[]}
 */
export function topicConnectionObservations() {
  return [];
}

/**
 * @deprecated Use connectionObservations.
 * @param {{
 *   sourceOrigin: string,
 *   linkOrigins: string[],
 *   participantOrigins: Set<string> | string[],
 * }} input
 * @returns {Array<{from: string, to: string}>}
 */
export function connectionEdges(input) {
  const unique = new Map();

  for (const origin of input.linkOrigins || []) {
    if (typeof origin !== "string") {
      continue;
    }

    unique.set(origin, origin);
  }

  return connectionObservations({
    sourceOrigin: input.sourceOrigin,
    pageUrl: `${input.sourceOrigin}/`,
    links: [...unique.keys()].map((origin) => ({
      href: `${origin}/`,
      text: "",
      rel: [],
    })),
    participantOrigins: input.participantOrigins,
  }).map((edge) => ({
    from: edge.from,
    to: edge.to,
  }));
}

/**
 * Stable sort for published connection observations.
 * @param {ConnectionObservation[]} edges
 * @returns {ConnectionObservation[]}
 */
export function sortConnectionEdges(edges) {
  return [...edges].sort((left, right) => {
    const from = left.from.localeCompare(right.from);

    if (from !== 0) {
      return from;
    }

    const to = left.to.localeCompare(right.to);

    if (to !== 0) {
      return to;
    }

    const relation = String(left.relation || left.kind || "").localeCompare(
      String(right.relation || right.kind || ""),
    );

    if (relation !== 0) {
      return relation;
    }

    const via = (left.via || "").localeCompare(right.via || "");

    if (via !== 0) {
      return via;
    }

    const href = left.href.localeCompare(right.href);

    if (href !== 0) {
      return href;
    }

    return String(left.page || "").localeCompare(String(right.page || ""));
  });
}

/**
 * Collapses observation-level edges to one semantic edge per
 * (from, to, relation). Additional observations become evidence[].
 * @param {Array<Record<string, unknown>>} edges
 * @returns {ConnectionObservation[]}
 */
export function aggregateConnectionEdges(edges) {
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const groups = new Map();

  for (const edge of edges || []) {
    if (
      !edge ||
      typeof edge.from !== "string" ||
      typeof edge.to !== "string" ||
      typeof edge.relation !== "string"
    ) {
      continue;
    }

    const key = `${edge.from}\0${edge.to}\0${edge.relation}`;
    const list = groups.get(key) || [];
    list.push(edge);
    groups.set(key, list);
  }

  /** @type {ConnectionObservation[]} */
  const aggregated = [];

  for (const observations of groups.values()) {
    observations.sort((left, right) => {
      const page = String(left.page || "").localeCompare(
        String(right.page || ""),
      );

      if (page !== 0) {
        return page;
      }

      return String(left.href || "").localeCompare(String(right.href || ""));
    });

    const first = observations[0];
    const evidence = [];
    const seenEvidence = new Set();

    for (const observation of observations) {
      const items =
        Array.isArray(observation.evidence) && observation.evidence.length > 0
          ? observation.evidence
          : [
              {
                class: "observed",
                page: observation.page,
                href: observation.href,
                text: observation.text || "",
                rel: observation.rel || [],
                ...(typeof observation.source === "string" && observation.source
                  ? { source: observation.source }
                  : {}),
                ...(typeof observation.via === "string" && observation.via
                  ? { via: observation.via }
                  : {}),
              },
            ];

      for (const item of items) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const evidenceKey = [
          item.class || "observed",
          item.source || "",
          item.page || "",
          item.href || "",
          item.via || "",
        ].join("\0");

        if (seenEvidence.has(evidenceKey)) {
          continue;
        }

        seenEvidence.add(evidenceKey);
        evidence.push(item);
      }
    }

    /** @type {ConnectionObservation} */
    const next = {
      from: first.from,
      to: first.to,
      relation: first.relation,
      directed: true,
      source: typeof first.source === "string" ? first.source : "content",
      href: first.href,
      text: typeof first.text === "string" ? first.text : "",
      rel: Array.isArray(first.rel) ? first.rel : [],
      page: first.page,
      evidence_count: evidence.length,
      evidence,
    };

    if (typeof first.via === "string" && first.via) {
      next.via = first.via;
    }

    aggregated.push(next);
  }

  return sortConnectionEdges(aggregated);
}

/**
 * Keeps prior connection observations for one publisher when a sync fails.
 * Drops well-known declaration edges.
 * @param {unknown} previousEdges
 * @param {string} fromOrigin
 * @returns {ConnectionObservation[]}
 */
export function carryForwardConnectionEdges(previousEdges, fromOrigin) {
  if (!Array.isArray(previousEdges) || typeof fromOrigin !== "string") {
    return [];
  }

  const edges = [];

  for (const edge of previousEdges) {
    if (
      !edge ||
      typeof edge !== "object" ||
      edge.from !== fromOrigin ||
      typeof edge.to !== "string"
    ) {
      continue;
    }

    const href =
      typeof edge.href === "string" && edge.href ? edge.href : `${edge.to}/`;
    const page =
      typeof edge.page === "string" && edge.page ? edge.page : `${edge.from}/`;

    if (isParticipationDeclarationPath(href)) {
      continue;
    }

    let normalizedHref = "";
    let normalizedPage = "";

    try {
      normalizedHref = new URL(href).href;
      normalizedPage = new URL(page).href;
    } catch {
      continue;
    }

    if (isHubDirectoryPage(normalizedPage)) {
      continue;
    }

    const relationRaw = edge.relation || edge.kind || "content-link";

    if (
      relationRaw === "friend" ||
      relationRaw === "topic" ||
      relationRaw === "link"
    ) {
      // Drop inferred friend/topic; map legacy link → content-link.
      if (relationRaw === "friend" || relationRaw === "topic") {
        continue;
      }
    }

    const relation =
      relationRaw === "homepage-link" ||
      relationRaw === "content-link" ||
      relationRaw === "blogroll" ||
      relationRaw === "reply-to" ||
      relationRaw === "repost-of" ||
      relationRaw === "syndication"
        ? relationRaw
        : relationRaw === "link"
          ? relationForPage(normalizedPage, edge.from)
          : "content-link";

    edges.push({
      from: edge.from,
      to: edge.to,
      relation,
      directed: true,
      via: typeof edge.via === "string" ? edge.via : "",
      source: typeof edge.source === "string" ? edge.source : "content",
      href: normalizedHref,
      text: typeof edge.text === "string" ? edge.text : "",
      rel: normalizeRelTokens(edge.rel),
      page: normalizedPage,
    });
  }

  return edges;
}

/**
 * Indexes participants with outgoing and incoming observation lists.
 * @param {ConnectionObservation[]} observations
 * @param {Array<{origin: string, title?: string, domain?: string, description?: string, screenshot?: string}>} participants
 * @returns {Array<{
 *   origin: string,
 *   title: string,
 *   domain: string,
 *   description: string,
 *   screenshot: string,
 *   linksTo: ConnectionObservation[],
 *   linkedFrom: ConnectionObservation[],
 * }>}
 */
export function indexConnectionsByParticipant(observations, participants) {
  const byOrigin = new Map();

  for (const participant of participants) {
    if (!participant || typeof participant.origin !== "string") {
      continue;
    }

    byOrigin.set(participant.origin, {
      origin: participant.origin,
      title:
        typeof participant.title === "string" && participant.title
          ? participant.title
          : participant.domain || participant.origin,
      domain:
        typeof participant.domain === "string" && participant.domain
          ? participant.domain
          : new URL(participant.origin).hostname,
      description:
        typeof participant.description === "string"
          ? participant.description
          : "",
      screenshot:
        typeof participant.screenshot === "string"
          ? participant.screenshot
          : "",
      linksTo: [],
      linkedFrom: [],
    });
  }

  for (const edge of Array.isArray(observations) ? observations : []) {
    if (!edge || typeof edge !== "object") {
      continue;
    }

    const from = byOrigin.get(edge.from);
    const to = byOrigin.get(edge.to);

    if (from) {
      from.linksTo.push(edge);
    }

    if (to) {
      to.linkedFrom.push(edge);
    }
  }

  return [...byOrigin.values()].sort((left, right) =>
    left.domain.localeCompare(right.domain, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}
