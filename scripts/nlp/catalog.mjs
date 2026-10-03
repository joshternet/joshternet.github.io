/**
 * Goal & Constraints:
 * Build a repeatable topic lexicon from the richest publisher catalog
 * (joshuamorris.info when it participates) and match it against other
 * members’ titles and summaries, including sites with no structured metadata.
 * Nightly nlp:sync rebuilds this as membership changes. Does not invent
 * connections.
 */

import {
  buildTopicEvidence,
  dedupeEvidence,
  isNonSubjectSlug,
} from "./evidence.mjs";
import { itemMentionsTopic } from "./match.mjs";

/** Preferred catalog origin while it remains a Network participant. */
export const CATALOG_SEED_ORIGIN = "https://joshuamorris.info";

/**
 * Origin whose declared topics seed the network-wide search list.
 * Falls back to the participant with the most declared subjects.
 * @param {Array<{origin?: string, declared_topics?: unknown}>} originSignals
 * @returns {string}
 */
export function selectCatalogOrigin(originSignals) {
  const list = Array.isArray(originSignals) ? originSignals : [];
  const present = new Set(
    list
      .map((entry) =>
        entry && typeof entry.origin === "string" ? entry.origin : "",
      )
      .filter(Boolean),
  );

  if (present.has(CATALOG_SEED_ORIGIN)) {
    return CATALOG_SEED_ORIGIN;
  }

  let best = "";
  let bestCount = -1;

  for (const entry of list) {
    if (!entry || typeof entry.origin !== "string" || !entry.origin) {
      continue;
    }

    const topics = Array.isArray(entry.declared_topics)
      ? entry.declared_topics
      : [];
    const count = topics.filter(
      (topic) =>
        topic &&
        typeof topic.slug === "string" &&
        !isNonSubjectSlug(topic.slug),
    ).length;

    if (count > bestCount) {
      bestCount = count;
      best = entry.origin;
    }
  }

  return best;
}

/**
 * Deduped catalog of meaningful declared subjects from one origin.
 * @param {Array<Record<string, unknown>>} originSignals
 * @param {string} origin
 * @returns {Array<{slug: string, label: string}>}
 */
export function catalogFromOrigin(originSignals, origin) {
  const entry = (originSignals || []).find(
    (item) => item && item.origin === origin,
  );
  const topics = Array.isArray(entry?.declared_topics)
    ? entry.declared_topics
    : [];
  const bySlug = new Map();

  for (const topic of topics) {
    const slug = typeof topic?.slug === "string" ? topic.slug : "";

    if (!slug || isNonSubjectSlug(slug)) {
      continue;
    }

    if (bySlug.has(slug)) {
      continue;
    }

    bySlug.set(slug, {
      slug,
      label:
        typeof topic.label === "string" && topic.label ? topic.label : slug,
    });
  }

  return [...bySlug.values()].sort((left, right) =>
    left.slug.localeCompare(right.slug),
  );
}

/**
 * Catalog from declared tags on one origin’s content items.
 * @param {Array<Record<string, unknown>>} contentItems
 * @param {string} origin
 * @returns {Array<{slug: string, label: string}>}
 */
export function catalogFromContent(contentItems, origin) {
  const bySlug = new Map();

  for (const item of contentItems || []) {
    if (!item || item.site_origin !== origin) {
      continue;
    }

    for (const topic of item.declared_topics || []) {
      const slug = typeof topic?.slug === "string" ? topic.slug : "";

      if (!slug || isNonSubjectSlug(slug)) {
        continue;
      }

      if (bySlug.has(slug)) {
        continue;
      }

      bySlug.set(slug, {
        slug,
        label:
          typeof topic.label === "string" && topic.label ? topic.label : slug,
      });
    }
  }

  return [...bySlug.values()].sort((left, right) =>
    left.slug.localeCompare(right.slug),
  );
}

/**
 * Merge signal and content catalogs for one origin.
 * @param {Array<Record<string, unknown>>} originSignals
 * @param {Array<Record<string, unknown>>} contentItems
 * @param {string} origin
 * @returns {Array<{slug: string, label: string}>}
 */
export function mergeCatalogs(originSignals, contentItems, origin) {
  const bySlug = new Map();

  for (const topic of [
    ...catalogFromOrigin(originSignals, origin),
    ...catalogFromContent(contentItems, origin),
  ]) {
    bySlug.set(topic.slug, topic);
  }

  return [...bySlug.values()].sort((left, right) =>
    left.slug.localeCompare(right.slug),
  );
}

/**
 * Attach catalog matches as heuristic, community-eligible evidence on origins
 * that mention the subject in indexed writing.
 * @param {Array<Record<string, unknown>>} originSignals
 * @param {Array<Record<string, unknown>>} contentItems
 * @param {Array<{slug: string, label: string}>} catalog
 * @param {{ observedAt?: string }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export function applyCatalogMatches(
  originSignals,
  contentItems,
  catalog,
  options = {},
) {
  const observedAt = options.observedAt || "";
  const items = Array.isArray(contentItems) ? contentItems : [];
  const topics = Array.isArray(catalog) ? catalog : [];

  return (originSignals || []).map((signal) => {
    if (!signal || typeof signal.origin !== "string") {
      return signal;
    }

    const declared = new Set(
      (signal.declared_topics || [])
        .map((topic) =>
          topic && typeof topic.slug === "string" ? topic.slug : "",
        )
        .filter(Boolean),
    );
    const subjectSignals = Array.isArray(signal.subject_signals)
      ? [...signal.subject_signals]
      : [];

    for (const topic of topics) {
      if (!topic?.slug || declared.has(topic.slug)) {
        continue;
      }

      const existing = subjectSignals.find(
        (entry) => entry && entry.slug === topic.slug,
      );

      if (existing?.community_eligible === true) {
        continue;
      }

      const hits = items.filter(
        (item) =>
          item &&
          item.site_origin === signal.origin &&
          itemMentionsTopic(item, topic.slug, topic.label),
      );

      if (hits.length === 0) {
        continue;
      }

      const evidence = hits
        .slice(0, 8)
        .map((item) =>
          buildTopicEvidence({
            rawValue: topic.label,
            source: "catalog-match",
            page: typeof item.url === "string" ? item.url : "",
            evidenceClass: "heuristic",
            communityEligible: true,
            observedAt,
            count: hits.length,
          }),
        )
        .filter(Boolean);

      if (existing) {
        existing.community_eligible = true;
        existing.evidence_class = "heuristic";
        existing.sources = [
          ...new Set([...(existing.sources || []), "catalog-match"]),
        ];
        const merged = dedupeEvidence([
          ...(Array.isArray(existing.evidence) ? existing.evidence : []),
          ...evidence,
        ]);
        existing.evidence = merged;
        existing.evidence_count = merged.length;
        continue;
      }

      subjectSignals.push({
        slug: topic.slug,
        label: topic.label,
        evidence_class: "heuristic",
        community_eligible: true,
        sources: ["catalog-match"],
        evidence_count: evidence.length,
        evidence,
      });
    }

    return {
      ...signal,
      subject_signals: subjectSignals,
    };
  });
}
