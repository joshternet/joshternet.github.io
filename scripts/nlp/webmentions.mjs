/**
 * Goal & Constraints:
 * Fetch public webmention.io mentions for hub/topic targets. No tokens in repo.
 */

import { fetchPublicText, normalizeText } from "./lib.mjs";
import { originFromHttpUrl } from "../network/blogroll.mjs";
import { isParticipationDeclarationPath } from "../network/connections.mjs";

/**
 * @param {unknown} entry
 * @returns {Record<string, unknown> | null}
 */
function sanitizeMention(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const url = typeof entry.url === "string" ? entry.url : "";

  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    if (parsed.username || parsed.password) {
      return null;
    }

    if (isParticipationDeclarationPath(parsed.href)) {
      return null;
    }
  } catch {
    return null;
  }

  const author =
    entry.author && typeof entry.author === "object"
      ? {
          name: normalizeText(entry.author.name || "").slice(0, 200),
          url: typeof entry.author.url === "string" ? entry.author.url : "",
        }
      : null;

  return {
    type: "entry",
    url,
    published:
      typeof entry.published === "string" ? entry.published.slice(0, 64) : "",
    "wm-property":
      typeof entry["wm-property"] === "string"
        ? entry["wm-property"].slice(0, 64)
        : "",
    author,
    content: {
      text: normalizeText(entry.content?.text || "").slice(0, 500),
    },
  };
}

/**
 * @param {string[]} targets
 * @param {Map<string, unknown>} [cache]
 * @returns {Promise<Record<string, Array<Record<string, unknown>>>>}
 */
export async function fetchMentionsForTargets(targets, cache = new Map()) {
  /** @type {Record<string, Array<Record<string, unknown>>>} */
  const byTarget = {};

  for (const target of targets.slice(0, 40)) {
    if (typeof target !== "string" || !target) {
      continue;
    }

    try {
      const fetched = await fetchPublicText(
        `https://webmention.io/api/mentions.jf2?target=${encodeURIComponent(target)}&per-page=20`,
        { cache, accept: "application/json" },
      );
      const parsed = JSON.parse(fetched.body);
      const children = Array.isArray(parsed?.children) ? parsed.children : [];
      byTarget[target] = children
        .map((entry) => sanitizeMention(entry))
        .filter(Boolean);
    } catch {
      byTarget[target] = [];
    }
  }

  return byTarget;
}

/**
 * Builds mention connection observations between current participants.
 * @param {Record<string, Array<Record<string, unknown>>>} mentionsByTarget
 * @param {Set<string>} participantOrigins
 * @returns {Array<Record<string, unknown>>}
 */
export function mentionConnections(mentionsByTarget, participantOrigins) {
  const observations = [];
  const seen = new Set();

  for (const [target, mentions] of Object.entries(mentionsByTarget || {})) {
    let to = "";

    try {
      to = originFromHttpUrl(target);
    } catch {
      continue;
    }

    if (!participantOrigins.has(to)) {
      continue;
    }

    for (const mention of mentions) {
      const sourceUrl = typeof mention.url === "string" ? mention.url : "";

      if (!sourceUrl) {
        continue;
      }

      let from = "";

      try {
        from = originFromHttpUrl(sourceUrl);
      } catch {
        continue;
      }

      if (!participantOrigins.has(from) || from === to) {
        continue;
      }

      const key = `${from}\0${to}\0${sourceUrl}\0${target}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      observations.push({
        from,
        to,
        relation: "mention",
        directed: true,
        via: target,
        source: "webmention",
        href: sourceUrl,
        text:
          typeof mention.content?.text === "string"
            ? mention.content.text.slice(0, 200)
            : "",
        rel: [],
        page: sourceUrl,
        evidence: [
          {
            class: "observed",
            source: "webmention",
            page: sourceUrl,
            href: sourceUrl,
          },
        ],
      });
    }
  }

  return observations;
}
