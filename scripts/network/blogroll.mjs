/**
 * Goal: Discover advertised blogroll OPML files and publish participant edges
 * plus a Joshternet-wide OPML of current Network sites.
 */
import dns from "node:dns/promises";

import { assertPublicURL, normalizeText } from "./lib.mjs";

export const MAX_BLOGROLLS_PER_PARTICIPANT = 3;
export const MAX_BLOGROLL_OPML_BYTES = 512 * 1024;

/**
 * @param {string} value
 * @returns {string}
 */
function escapeXmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * @param {string} value
 * @returns {string}
 */
export function originFromHttpUrl(value) {
  const url = new URL(value);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`unsupported URL scheme: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new Error("URL contains credentials");
  }

  return url.origin;
}

/**
 * @param {unknown} rawBlogrolls
 * @param {{
 *   lookup?: typeof dns.lookup,
 *   cache?: Map<string, unknown>,
 * }} [options]
 * @returns {Promise<string[]>}
 */
export async function sanitizeBlogrollUrls(
  rawBlogrolls,
  { lookup = dns.lookup, cache = new Map() } = {},
) {
  if (!Array.isArray(rawBlogrolls)) {
    return [];
  }

  const urls = [];
  const seen = new Set();

  for (const candidate of rawBlogrolls) {
    if (urls.length >= MAX_BLOGROLLS_PER_PARTICIPANT) {
      break;
    }

    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const type =
      typeof candidate.type === "string" ? normalizeText(candidate.type) : "";

    if (type !== "text/xml") {
      continue;
    }

    let href = "";

    if (typeof candidate.href === "string") {
      href = candidate.href;
    } else if (typeof candidate.url === "string") {
      href = candidate.url;
    }

    if (!href) {
      continue;
    }

    try {
      const url = await assertPublicURL(href, {
        lookup,
        cache,
      });
      const normalized = url.href;

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      urls.push(normalized);
    } catch {
      continue;
    }
  }

  return urls;
}

/**
 * @param {string} opmlText
 * @returns {string[]}
 */
export function parseOpmlOutlineUrls(opmlText) {
  if (typeof opmlText !== "string" || !opmlText) {
    return [];
  }

  const urls = [];
  const outlinePattern = /<outline\b([^>]*)\/?>/gi;

  for (const match of opmlText.matchAll(outlinePattern)) {
    const attributes = match[1] || "";

    for (const name of ["htmlUrl", "xmlUrl"]) {
      const attribute = new RegExp(
        `\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`,
        "i",
      ).exec(attributes);

      if (!attribute) {
        continue;
      }

      const value = normalizeText(attribute[2] ?? attribute[3] ?? "");

      if (value) {
        urls.push(value);
      }
    }
  }

  return urls;
}

/**
 * @param {string[]} urls
 * @returns {string[]}
 */
export function originsFromBlogrollUrls(urls) {
  if (!Array.isArray(urls)) {
    return [];
  }

  const origins = [];
  const seen = new Set();

  for (const value of urls) {
    try {
      const origin = originFromHttpUrl(value);

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
 * @param {{
 *   sourceOrigin: string,
 *   blogrollUrl: string,
 *   outlineOrigins: string[],
 *   participantOrigins: Set<string> | string[],
 * }} input
 * @returns {Array<{from: string, to: string, blogroll: string}>}
 */
export function blogrollEdges({
  sourceOrigin,
  blogrollUrl,
  outlineOrigins,
  participantOrigins,
}) {
  const participants = new Set(participantOrigins);
  const edges = [];
  const seen = new Set();

  if (!participants.has(sourceOrigin)) {
    return edges;
  }

  for (const target of outlineOrigins) {
    if (target === sourceOrigin || !participants.has(target)) {
      continue;
    }

    const key = `${sourceOrigin}\0${target}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    edges.push({
      from: sourceOrigin,
      to: target,
      blogroll: blogrollUrl,
    });
  }

  return edges;
}

/**
 * @param {Array<{from: string, to: string, blogroll: string}>} edges
 * @returns {Array<{from: string, to: string, blogroll: string}>}
 */
export function sortBlogrollEdges(edges) {
  return [...edges].sort((left, right) => {
    const from = left.from.localeCompare(right.from);
    if (from !== 0) {
      return from;
    }

    const to = left.to.localeCompare(right.to);
    if (to !== 0) {
      return to;
    }

    return left.blogroll.localeCompare(right.blogroll);
  });
}

/**
 * @param {string} url
 * @param {{
 *   lookup?: typeof dns.lookup,
 *   cache?: Map<string, unknown>,
 *   fetchImpl?: typeof fetch,
 * }} [options]
 * @returns {Promise<string>}
 */
export async function fetchBlogrollOpml(
  url,
  { lookup = dns.lookup, cache = new Map(), fetchImpl = fetch } = {},
) {
  await assertPublicURL(url, {
    lookup,
    cache,
  });

  const response = await fetchImpl(url, {
    headers: {
      Accept: "text/xml, application/xml, text/x-opml, */*;q=0.1",
      "User-Agent": "Joshternet-Network-Sync",
    },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`blogroll request failed with ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.byteLength > MAX_BLOGROLL_OPML_BYTES) {
    throw new Error("blogroll OPML exceeds size limit");
  }

  return buffer.toString("utf8");
}

/**
 * @param {Array<{
 *   origin: string,
 *   domain?: string,
 *   title?: string,
 *   feeds?: Array<{url: string}>,
 *   blogroll?: string,
 * }>} entries
 * @returns {string}
 */
export function buildJoshternetOpml(entries) {
  const sorted = [...(Array.isArray(entries) ? entries : [])].sort(
    (left, right) => {
      const leftDomain = left.domain || new URL(left.origin).host;
      const rightDomain = right.domain || new URL(right.origin).host;

      return leftDomain.localeCompare(rightDomain, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    },
  );

  const outlines = sorted
    .map((entry) => {
      const text = escapeXmlAttribute(
        normalizeText(entry.title) || entry.domain || entry.origin,
      );
      const htmlUrl = escapeXmlAttribute(entry.origin);
      const primaryFeed =
        Array.isArray(entry.feeds) && entry.feeds[0]?.url
          ? entry.feeds[0].url
          : "";
      const xmlUrl = primaryFeed
        ? ` xmlUrl="${escapeXmlAttribute(primaryFeed)}"`
        : "";

      let children = "";

      if (typeof entry.blogroll === "string" && entry.blogroll) {
        children = `\n    <outline text="Blogroll" type="link" url="${escapeXmlAttribute(entry.blogroll)}" />\n  `;
      }

      if (children) {
        return `  <outline text="${text}" title="${text}" htmlUrl="${htmlUrl}"${xmlUrl}>${children}</outline>`;
      }

      return `  <outline text="${text}" title="${text}" htmlUrl="${htmlUrl}"${xmlUrl} />`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Joshternet</title>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;
}

/**
 * @param {Record<string, unknown>} entry
 * @param {unknown} blogrollUrl
 * @returns {Record<string, unknown>}
 */
export function withBlogroll(entry, blogrollUrl) {
  const next = {
    ...entry,
  };

  delete next.blogroll;

  if (typeof blogrollUrl === "string" && blogrollUrl) {
    next.blogroll = blogrollUrl;
  }

  return next;
}
