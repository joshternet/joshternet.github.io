/**
 * Goal & Constraints:
 * Public topics.json lists subjects with at least one qualifying member.
 * Below-threshold heuristics stay related_discoveries. Aliases/denylist are
 * explicit policy. Lifecycle timestamps bump only when membership semantics
 * change.
 */

import { slugifyTopic } from "../network/connections.mjs";
import { isSensitiveHeuristicSlug, isNonSubjectSlug } from "./evidence.mjs";
import {
  equivalentAliases,
  foldPluralSlug,
  topicRelations,
} from "./normalize.mjs";

/**
 * @param {unknown} aliasesDoc
 * @returns {Map<string, string>}
 */
export function loadAliasMap(aliasesDoc) {
  const map = new Map();

  for (const entry of equivalentAliases(aliasesDoc)) {
    if (entry.kind !== "equivalent") {
      continue;
    }

    map.set(entry.from, entry.to);
  }

  return map;
}

/**
 * @param {unknown} denylistDoc
 * @returns {Set<string>}
 */
export function loadDenylist(denylistDoc) {
  const set = new Set();

  if (!denylistDoc || typeof denylistDoc !== "object") {
    return set;
  }

  const list = Array.isArray(denylistDoc.entries) ? denylistDoc.entries : [];

  for (const entry of list) {
    if (!entry || typeof entry.slug !== "string") {
      continue;
    }

    const raw = slugifyTopic(entry.slug);
    const slug = foldPluralSlug(raw);

    if (raw) {
      set.add(raw);
    }

    if (slug) {
      set.add(slug);
    }
  }

  return set;
}

/**
 * Resolves slug through aliases without cycles.
 * @param {string} slug
 * @param {Map<string, string>} aliases
 * @returns {string}
 */
export function resolveAlias(slug, aliases) {
  let current = slug;
  const seen = new Set();

  while (aliases.has(current) && !seen.has(current)) {
    seen.add(current);
    current = aliases.get(current) || current;
  }

  return current;
}

/**
 * True when origin has qualifying declared evidence for a topic slug.
 * @param {Record<string, unknown>} signal
 * @returns {boolean}
 */
export function signalIsCommunityEligible(signal) {
  if (!signal || signal.community_eligible !== true) {
    return false;
  }

  const evidence = Array.isArray(signal.evidence) ? signal.evidence : [];

  if (evidence.length === 0) {
    return signal.evidence_class === "declared";
  }

  return evidence.some(
    (item) =>
      item && item.class === "declared" && item.community_eligible === true,
  );
}

/**
 * True when a heuristic subject_signal qualifies for community membership.
 * @param {Record<string, unknown>} signal
 * @returns {boolean}
 */
export function heuristicSignalIsCommunityEligible(signal) {
  if (!signal || signal.evidence_class !== "heuristic") {
    return false;
  }

  if (signal.community_eligible === true) {
    return true;
  }

  const evidence = Array.isArray(signal.evidence) ? signal.evidence : [];

  return evidence.some(
    (item) =>
      item && item.class === "heuristic" && item.community_eligible === true,
  );
}

/**
 * Stable fingerprint of declared membership origins for lifecycle compare.
 * @param {Array<{origin?: string}>} sites
 * @returns {string}
 */
function membershipFingerprint(sites) {
  return [...sites]
    .map((site) => (site && typeof site.origin === "string" ? site.origin : ""))
    .filter(Boolean)
    .sort()
    .join("\0");
}

/**
 * Builds public topic communities and optional candidate list.
 * @param {Array<{
 *   origin: string,
 *   title?: string,
 *   domain?: string,
 *   declared_topics?: Array<Record<string, unknown>>,
 *   subject_signals?: Array<Record<string, unknown>>,
 * }>} origins
 * @param {{
 *   aliases?: Map<string, string>,
 *   denylist?: Set<string>,
 *   previousTopics?: Array<Record<string, unknown>>,
 *   now?: string,
 * }} [options]
 * @returns {{ communities: Array<Record<string, unknown>>, candidates: Array<Record<string, unknown>> }}
 */
export function buildTopicCommunities(origins, options = {}) {
  const aliases = options.aliases || new Map();
  const denylist = options.denylist || new Set();
  const relations = Array.isArray(options.relations)
    ? options.relations
    : topicRelations(options.aliasesDoc);
  const now = options.now || new Date().toISOString();
  const previous = new Map(
    (Array.isArray(options.previousTopics) ? options.previousTopics : [])
      .filter((topic) => topic && typeof topic.slug === "string")
      .map((topic) => [topic.slug, topic]),
  );

  /** @type {Map<string, {
   *   label: string,
   *   sources: Set<string>,
   *   sites: Map<string, Record<string, unknown>>,
   *   heuristicSites: Map<string, Record<string, unknown>>,
   * }>} */
  const bySlug = new Map();

  for (const originEntry of origins || []) {
    if (!originEntry || typeof originEntry.origin !== "string") {
      continue;
    }

    let domain = originEntry.domain || "";

    try {
      domain = domain || new URL(originEntry.origin).hostname;
    } catch {
      continue;
    }

    const declared = Array.isArray(originEntry.declared_topics)
      ? originEntry.declared_topics
      : [];
    const subjects = Array.isArray(originEntry.subject_signals)
      ? originEntry.subject_signals
      : [];

    for (const signal of declared) {
      if (!signalIsCommunityEligible(signal)) {
        continue;
      }

      const slug = resolveAlias(
        foldPluralSlug(slugifyTopic(String(signal.slug || ""))),
        aliases,
      );

      if (!slug || denylist.has(slug) || isNonSubjectSlug(slug)) {
        continue;
      }

      const topic = bySlug.get(slug) || {
        label: String(signal.label || slug),
        sources: new Set(),
        sites: new Map(),
        heuristicSites: new Map(),
      };

      if (signal.label) {
        topic.label = String(signal.label);
      }

      for (const item of signal.evidence || []) {
        if (item?.source) {
          topic.sources.add(String(item.source));
        }
      }

      const pages = (signal.evidence || [])
        .filter((item) => typeof item.page === "string" && item.page)
        .slice(0, 8)
        .map((item) => ({
          url: item.page,
          title: "",
          source: String(item.source || ""),
        }));

      topic.sites.set(originEntry.origin, {
        origin: originEntry.origin,
        domain,
        title: originEntry.title || domain,
        membership: "declared",
        pages,
      });
      bySlug.set(slug, topic);
    }

    for (const signal of subjects) {
      if (!signal || signal.evidence_class !== "heuristic") {
        continue;
      }

      const slug = resolveAlias(
        foldPluralSlug(slugifyTopic(String(signal.slug || ""))),
        aliases,
      );

      if (
        !slug ||
        denylist.has(slug) ||
        isSensitiveHeuristicSlug(slug) ||
        isNonSubjectSlug(slug)
      ) {
        continue;
      }

      const topic = bySlug.get(slug) || {
        label: String(signal.label || slug),
        sources: new Set(),
        sites: new Map(),
        heuristicSites: new Map(),
      };

      if (signal.label && !topic.sites.size && !topic.heuristicSites.size) {
        topic.label = String(signal.label);
      }

      const pages = (signal.evidence || [])
        .filter((item) => typeof item.page === "string" && item.page)
        .slice(0, 8)
        .map((item) => ({
          url: item.page,
          title: "",
          source: String(item.source || "visible-text"),
        }));

      if (heuristicSignalIsCommunityEligible(signal)) {
        if (!topic.sites.has(originEntry.origin)) {
          let addedSource = false;
          for (const item of signal.evidence || []) {
            if (item?.source) {
              topic.sources.add(String(item.source));
              addedSource = true;
            }
          }
          if (!addedSource) {
            topic.sources.add("visible-text");
          }

          topic.sites.set(originEntry.origin, {
            origin: originEntry.origin,
            domain,
            title: originEntry.title || domain,
            membership: "heuristic",
            pages,
          });
        }
      } else if (!topic.sites.has(originEntry.origin)) {
        topic.heuristicSites.set(originEntry.origin, {
          origin: originEntry.origin,
          domain,
          title: originEntry.title || domain,
          discovery: "heuristic",
          note: "Below the community quality threshold; not membership.",
        });
      }

      bySlug.set(slug, topic);
    }
  }

  const communities = [];
  const candidates = [];

  for (const [slug, topic] of bySlug) {
    const memberSites = [...topic.sites.values()].sort((left, right) =>
      left.domain.localeCompare(right.domain),
    );
    const related = [...topic.heuristicSites.values()]
      .filter((site) => !topic.sites.has(site.origin))
      .sort((left, right) => left.domain.localeCompare(right.domain));
    const prior = previous.get(slug);
    const firstSeen =
      prior && typeof prior.first_seen_at === "string"
        ? prior.first_seen_at
        : now;
    const nextFingerprint = membershipFingerprint(memberSites);
    const priorFingerprint = prior
      ? membershipFingerprint(Array.isArray(prior.sites) ? prior.sites : [])
      : "";
    const membershipChanged = nextFingerprint !== priorFingerprint;
    const lastChanged =
      !membershipChanged && prior && typeof prior.last_changed_at === "string"
        ? prior.last_changed_at
        : now;
    const staleSince =
      membershipChanged &&
      priorFingerprint &&
      memberSites.length >= 1 &&
      priorFingerprint.split("\0").length > memberSites.length
        ? now
        : undefined;

    const hasDeclared = memberSites.some(
      (site) => site.membership === "declared",
    );

    if (memberSites.length >= 2 || hasDeclared) {
      const hasHeuristicMember = memberSites.some(
        (site) => site.membership === "heuristic",
      );
      const sources = [...topic.sources]
        .filter((source) => {
          if (source === "visible-text" || source === "nlp") {
            return hasHeuristicMember;
          }
          return true;
        })
        .sort();

      /** @type {Record<string, unknown>} */
      const community = {
        slug,
        label: topic.label,
        member_count: memberSites.length,
        sites: memberSites,
        sources,
        first_seen_at: firstSeen,
        last_changed_at: lastChanged,
        active: true,
      };

      if (related.length > 0) {
        community.related_discoveries = related;
      }

      if (staleSince) {
        community.stale_since = staleSince;
      }

      const broader = relations
        .filter((item) => item && item.kind === "broader" && item.from === slug)
        .map((item) => item.to);
      const relatedSlugs = relations
        .filter(
          (item) =>
            item &&
            item.kind === "related" &&
            (item.from === slug || item.to === slug),
        )
        .map((item) => (item.from === slug ? item.to : item.from));

      if (broader.length > 0 || relatedSlugs.length > 0) {
        community.relationships = {
          broader,
          related: relatedSlugs,
        };
      }

      communities.push(community);
    } else {
      candidates.push({
        slug,
        label: topic.label,
        publisher_backed_sites: memberSites.length,
        heuristically_related_sites: topic.heuristicSites.size,
        sources: [...topic.sources].sort(),
      });
    }
  }

  communities.sort((left, right) => left.slug.localeCompare(right.slug));
  candidates.sort((left, right) => left.slug.localeCompare(right.slug));

  return { communities, candidates };
}

/**
 * Human-readable topic label for SEO titles and descriptions.
 * Short all-lowercase tokens become uppercase (ai → AI); longer labels are
 * title-cased unless they already contain an uppercase letter.
 * @param {string} label
 * @returns {string}
 */
export function topicSeoLabel(label) {
  const trimmed = String(label || "").trim();
  if (!trimmed) {
    return "Topic";
  }
  if (/[A-Z]/.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-z0-9]{1,3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return trimmed
    .split(/(\s+|&|\/|-)/)
    .map((part) => {
      if (!part || /^[\s&/-]+$/.test(part)) {
        return part;
      }
      if (part.length <= 3) {
        return part.toUpperCase();
      }
      return `${part[0].toUpperCase()}${part.slice(1)}`;
    })
    .join("");
}

/**
 * Document title for a topic page (before optional site-title suffix).
 * Targets ~35–47 characters so `Title | Joshternet` lands near 50–60.
 * @param {string} label
 * @returns {string}
 */
export function topicSeoTitle(label) {
  const pretty = topicSeoLabel(label);
  const candidates = [
    `${pretty} articles from Joshternet websites`,
    `${pretty} writing on the Joshternet`,
    `${pretty} on the Joshternet`,
  ];
  for (const candidate of candidates) {
    if (candidate.length <= 47) {
      return candidate;
    }
  }
  return pretty.length <= 47 ? pretty : pretty.slice(0, 47);
}

/**
 * Meta description for a topic page (~120–160 characters when possible).
 * @param {string} label
 * @returns {string}
 */
export function topicSeoDescription(label) {
  const pretty = topicSeoLabel(label);
  return `Explore ${pretty} articles, notes, and projects published by independent websites in the Joshternet—an open, decentralized network for Joshes.`;
}

/**
 * Comma-separated keywords for a topic page (sparse, not stuffed).
 * @param {string} label
 * @returns {string}
 */
export function topicSeoKeywords(label) {
  const pretty = topicSeoLabel(label);
  return `${pretty}, Joshternet, independent websites, Josh network, topic neighborhood`;
}

/**
 * Front-matter stub for a community topic page, including CollectionPage SEO.
 * @param {{slug: string, label?: string}} topic
 * @returns {string}
 */
export function topicCollectionMarkdown(topic) {
  const label =
    typeof topic.label === "string" && topic.label ? topic.label : topic.slug;
  const title = topicSeoTitle(label);
  const description = topicSeoDescription(label);
  const keywords = topicSeoKeywords(label);
  const name = topicSeoLabel(label);

  return `---
layout: topic
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
keywords: ${JSON.stringify(keywords)}
slug: ${JSON.stringify(topic.slug)}
permalink: /topics/${topic.slug}/
seo:
  type: CollectionPage
  name: ${JSON.stringify(name)}
---
`;
}

/**
 * Compatibility page for an old slug. GitHub Pages is not assumed to redirect.
 * The page points at the canonical topic and is not a second community.
 * @param {string} fromSlug
 * @param {string} toSlug
 * @returns {string}
 */
export function aliasCompatibilityMarkdown(fromSlug, toSlug) {
  const from = slugifyTopic(fromSlug);
  const to = slugifyTopic(toSlug);

  return `---
layout: default
title: ${JSON.stringify(from)}
permalink: /topics/${from}/
joshternet_analysis: derived
---

This name is filed under [${to}](/topics/${to}/).
`;
}
