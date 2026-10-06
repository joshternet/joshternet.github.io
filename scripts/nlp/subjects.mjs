/**
 * Goal & Constraints:
 * Extract declared vs heuristic subjects with evidence provenance; build
 * observed connections only (no friend/topic edges).
 */

import {
  connectionObservations,
  sortConnectionEdges,
  slugifyTopic,
} from "../network/connections.mjs";
import { isTopicHubIndexUrl, topicSlugFromHubChild } from "./crawl.mjs";
import {
  buildTopicEvidence,
  dedupeEvidence,
  isNonSubjectSlug,
} from "./evidence.mjs";
import {
  decodeHtmlEntities,
  normalizeExtractedText,
  parseHtmlRegions,
} from "./text.mjs";

/**
 * Extracts publisher subject labels from raw HTML with evidence classes.
 * @param {string} html
 * @param {string} pageUrl
 * @param {{ observedAt?: string, allowCommunity?: boolean }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export function subjectsFromHtml(html, pageUrl, options = {}) {
  const observedAt = options.observedAt || "";
  const allowCommunity = options.allowCommunity !== false;
  const regions = parseHtmlRegions(html);
  /** @type {Array<Record<string, unknown>>} */
  const evidence = [];

  /**
   * @param {string} label
   * @param {string} source
   * @param {boolean} communityEligible
   */
  function add(label, source, communityEligible) {
    const item = buildTopicEvidence({
      rawValue: decodeHtmlEntities(label),
      source,
      page: pageUrl,
      evidenceClass: "declared",
      communityEligible: allowCommunity && communityEligible,
      observedAt,
    });

    if (item) {
      evidence.push(item);
    }
  }

  const categoryClass =
    /class=["'][^"']*\bp-category\b[^"']*["'][^>]*>([^<]+)</gi;
  let match;

  while ((match = categoryClass.exec(html))) {
    add(match[1], "microformat:p-category", true);
  }

  const articleTag =
    /<meta\b[^>]*property=["']article:tag["'][^>]*content=["']([^"']+)["'][^>]*>/gi;

  while ((match = articleTag.exec(html))) {
    add(match[1], "article:tag", true);
  }

  const articleSection =
    /<meta\b[^>]*property=["']article:section["'][^>]*content=["']([^"']+)["'][^>]*>/gi;

  while ((match = articleSection.exec(html))) {
    add(match[1], "article:section", true);
  }

  const keywords =
    /<meta\b[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(
      html,
    );

  if (keywords?.[1]) {
    for (const part of keywords[1].split(",")) {
      add(part, "meta:keywords", false);
    }
  }

  try {
    const page = new URL(pageUrl);

    if (isTopicHubIndexUrl(page.href)) {
      for (const link of regions.links) {
        let child;

        try {
          child = new URL(link.href, page.href);
        } catch {
          continue;
        }

        if (child.origin !== page.origin) {
          continue;
        }

        const slug = topicSlugFromHubChild(child.pathname);

        if (!slug || isNonSubjectSlug(slug)) {
          continue;
        }

        const linkText = String(link.text || "").trim();

        // Skip "(N posts)" hub chrome. Bare trailing counts ("privacy 45") are
        // normalized away because identity always comes from the URL slug.
        if (/\(\s*\d+\s*posts?\s*\)/i.test(linkText)) {
          continue;
        }

        add(slug.replace(/-/g, " "), "topic-hub:link", true);
      }
    } else {
      const slug = topicSlugFromHubChild(page.pathname);

      if (slug && !isNonSubjectSlug(slug)) {
        add(slug.replace(/-/g, " "), "topic-hub:page", true);
      }
    }
  } catch {
    // pageUrl may be missing in older tests.
  }

  // Legacy shape expected by older tests: slug/label/sources/pages
  /** @type {Map<string, {label: string, sources: Set<string>, community_eligible: boolean, evidence: Array<Record<string, unknown>>}>} */
  const bySlug = new Map();

  for (const item of evidence) {
    const entry = bySlug.get(item.slug) || {
      label: item.value,
      sources: new Set(),
      community_eligible: false,
      evidence: [],
    };
    entry.sources.add(legacySourceName(String(item.source)));
    entry.evidence.push(item);
    if (item.community_eligible) {
      entry.community_eligible = true;
    }
    bySlug.set(item.slug, entry);
  }

  return [...bySlug.entries()].map(([slug, entry]) => ({
    slug,
    label: entry.label,
    sources: [...entry.sources],
    pages: pageUrl ? [{ url: pageUrl, title: regions.title || "" }] : [],
    evidence_class: "declared",
    community_eligible: entry.community_eligible,
    evidence: entry.evidence,
  }));
}

/**
 * Maps detailed source ids to short legacy names used by older fixtures.
 * @param {string} source
 * @returns {string}
 */
function legacySourceName(source) {
  if (source.startsWith("microformat")) {
    return "microformat";
  }

  if (source === "article:tag" || source.startsWith("meta:")) {
    return "meta";
  }

  if (source.startsWith("topic-hub")) {
    return "topic-hub";
  }

  return source;
}

/**
 * Merges subject lists by slug (declared + heuristic).
 * @param {Array<Array<Record<string, unknown>>>} groups
 * @returns {Array<Record<string, unknown>>}
 */
export function mergeSubjects(...groups) {
  /** @type {Map<string, Record<string, unknown>>} */
  const bySlug = new Map();

  for (const group of groups) {
    if (!Array.isArray(group)) {
      continue;
    }

    for (const subject of group) {
      if (!subject || typeof subject.slug !== "string") {
        continue;
      }

      const slug = slugifyTopic(subject.slug);

      if (!slug) {
        continue;
      }

      const existing = bySlug.get(slug) || {
        slug,
        label: subject.label || slug,
        evidence_class: subject.evidence_class || "heuristic",
        community_eligible: false,
        evidence: [],
        sources: new Set(),
        pages: new Map(),
        relevance: subject.relevance,
      };

      if (typeof subject.label === "string" && subject.label) {
        existing.label = subject.label;
      }

      if (subject.community_eligible) {
        existing.community_eligible = true;
      }

      if (subject.evidence_class === "declared") {
        existing.evidence_class = "declared";
      }

      if (subject.relevance) {
        existing.relevance = subject.relevance;
      }

      for (const source of subject.sources || []) {
        existing.sources.add(source);
      }

      for (const item of subject.evidence || []) {
        existing.evidence.push(item);
      }

      for (const page of subject.pages || []) {
        if (page && typeof page.url === "string" && page.url) {
          existing.pages.set(page.url, page.title || "");
        }
      }

      bySlug.set(slug, existing);
    }
  }

  return [...bySlug.values()]
    .map((entry) => {
      const evidence = dedupeEvidence(entry.evidence);
      return {
        slug: entry.slug,
        label: entry.label,
        evidence_class: entry.evidence_class,
        community_eligible: Boolean(entry.community_eligible),
        evidence_count: evidence.length,
        evidence,
        ...(entry.relevance ? { relevance: entry.relevance } : {}),
        sources: [...entry.sources].sort(),
        pages: [...entry.pages.entries()]
          .slice(0, 8)
          .map(([url, title]) => ({ url, title })),
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

/**
 * Splits merged subjects into declared_topics vs subject_signals.
 * @param {Array<Record<string, unknown>>} subjects
 * @returns {{ declared_topics: Array<Record<string, unknown>>, subject_signals: Array<Record<string, unknown>> }}
 */
export function splitDeclaredAndSignals(subjects) {
  const declared_topics = [];
  const subject_signals = [];

  for (const subject of subjects || []) {
    const evidence = Array.isArray(subject.evidence) ? subject.evidence : [];
    const eligible = evidence.filter(
      (item) => item?.class === "declared" && item.community_eligible === true,
    );

    if (eligible.length > 0) {
      const declaredEvidence = dedupeEvidence(eligible);
      declared_topics.push({
        slug: subject.slug,
        label: subject.label,
        evidence_class: "declared",
        community_eligible: true,
        evidence_count: declaredEvidence.length,
        evidence: declaredEvidence,
        sources: [
          ...new Set(declaredEvidence.map((item) => String(item.source || ""))),
        ].sort(),
        pages: (Array.isArray(subject.pages) ? subject.pages : []).filter(
          (page) => declaredEvidence.some((item) => item.page === page.url),
        ),
      });
      continue;
    }

    const other = dedupeEvidence(evidence);
    const heuristicEligible =
      subject.evidence_class === "heuristic" &&
      (subject.community_eligible === true ||
        other.some((item) => item.community_eligible === true));
    const signal = {
      slug: subject.slug,
      label: subject.label,
      evidence_class: subject.evidence_class || "heuristic",
      community_eligible: heuristicEligible,
      evidence_count: other.length,
      evidence: other,
      sources: [
        ...new Set(
          other.map((item) =>
            String(item.source || subject.sources?.[0] || ""),
          ),
        ),
      ].sort(),
      pages: subject.pages || [],
    };

    if (signal.evidence_class === "heuristic" && subject.relevance) {
      signal.relevance = subject.relevance;
    }

    subject_signals.push(signal);
  }

  return { declared_topics, subject_signals };
}

/**
 * @deprecated Use buildTopicCommunities from communities.mjs for public topics.
 * Kept for transitional tests that expect inverted subject hubs.
 * @param {Array<{origin: string, title?: string, domain?: string, subjects: Array<Record<string, unknown>>}>} origins
 * @returns {Array<Record<string, unknown>>}
 */
export function buildTopicsHub(origins) {
  /** @type {Map<string, {label: string, sources: Set<string>, sites: Map<string, Record<string, unknown>>}>} */
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

    for (const subject of originEntry.subjects || []) {
      const slug = slugifyTopic(subject.slug);

      if (!slug) {
        continue;
      }

      const topic = bySlug.get(slug) || {
        label: subject.label || slug,
        sources: new Set(),
        sites: new Map(),
      };

      if (subject.label) {
        topic.label = subject.label;
      }

      for (const source of subject.sources || []) {
        topic.sources.add(source);
      }

      const site = topic.sites.get(originEntry.origin) || {
        origin: originEntry.origin,
        domain,
        title: originEntry.title || domain,
        pages: [],
      };

      for (const page of subject.pages || []) {
        if (page?.url) {
          site.pages.push({
            url: page.url,
            title: page.title || "",
            source: (subject.sources && subject.sources[0]) || "nlp",
          });
        }
      }

      topic.sites.set(originEntry.origin, site);
      bySlug.set(slug, topic);
    }
  }

  return [...bySlug.entries()]
    .map(([slug, topic]) => ({
      slug,
      label: topic.label,
      sources: [...topic.sources].sort(),
      sites: [...topic.sites.values()]
        .map((site) => ({
          ...site,
          pages: site.pages.slice(0, 8),
        }))
        .sort((left, right) => left.domain.localeCompare(right.domain)),
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

export { topicCollectionMarkdown } from "./communities.mjs";

/**
 * Merges observed link + blogroll relationships (no friend/topic edges).
 * Connections come from ordinary crawled hyperlinks and approved blogrolls only.
 * @param {{
 *   participantOrigins: Set<string> | string[],
 *   originLinks: Array<{origin: string, links: Array<{href: string, text?: string, page?: string, rel?: string[], classNames?: string[]}>}>,
 *   originSubjects?: unknown,
 *   blogrollEdges?: Array<Record<string, unknown>>,
 * }} input
 * @returns {Array<Record<string, unknown>>}
 */
export function buildAllConnections(input) {
  const linkEdges = [];

  for (const bundle of input.originLinks || []) {
    linkEdges.push(
      ...connectionObservations({
        sourceOrigin: bundle.origin,
        pageUrl: `${bundle.origin}/`,
        links: bundle.links,
        participantOrigins: input.participantOrigins,
      }),
    );
  }

  const blogrollEdges = Array.isArray(input.blogrollEdges)
    ? input.blogrollEdges
    : [];

  return sortConnectionEdges([...linkEdges, ...blogrollEdges]);
}
