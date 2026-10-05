/**
 * Goal & Constraints:
 * Evidence authority is declared | observed | heuristic only. Normalization is
 * a transformation, not an authority class. community_eligible means the
 * evidence qualifies for a public topic community (declared tags immediately,
 * heuristics after quality rules)—not a second Joshternet opt-in.
 */

import { slugifyTopic } from "../network/connections.mjs";
import { STOPWORDS } from "./lib.mjs";
import {
  MAX_RAW_TOPIC_CHARS,
  capRemoteString,
  normalizeExtractedText,
} from "./text.mjs";

/** @typedef {'declared' | 'observed' | 'heuristic'} EvidenceClass */

export const EXTRACTOR_VERSION = {
  html: 1,
  topics: 1,
  relationships: 1,
  feeds: 1,
};

/** Publisher topic-label sources that qualify immediately as declared membership. */
export const COMMUNITY_ELIGIBLE_SOURCES = new Set([
  "rss:category",
  "atom:category",
  "json-feed:tag",
  "microformat:p-category",
  "article:tag",
  "schema:keywords",
  "octothorpe",
  "article:section",
  "topic-hub:link",
  "topic-hub:page",
  "portfolio:sector",
]);

/** Descriptive metadata that is not a topic label (discovery, not membership). */
export const DISCOVERY_ONLY_SOURCES = new Set([
  "meta:description",
  "meta:keywords",
  "schema:keywords",
  "og:description",
  "twitter:description",
  "json-ld:about",
  "json-ld:mentions",
  "json-ld:genre",
  "news_keywords",
  "title",
  "heading",
  "og:type",
  "portfolio:index",
]);

const PARSER_ARTIFACT_SLUG =
  /^(quot|x27|nbsp|amp|class|span|div|script|style)$/;
const TAXONOMY_PATH_SLUG = /^(?:feeds?|keywords?|tags?)-/;

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isCommunityEligibleSource(source) {
  return COMMUNITY_ELIGIBLE_SOURCES.has(String(source || ""));
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isDiscoveryOnlySource(source) {
  return DISCOVERY_ONLY_SOURCES.has(String(source || ""));
}

/**
 * True when a slug is HTML/entity residue rather than a subject.
 * @param {string} slug
 * @returns {boolean}
 */
export function isParserArtifactSlug(slug) {
  const value = String(slug || "");

  return (
    PARSER_ARTIFACT_SLUG.test(value) ||
    TAXONOMY_PATH_SLUG.test(value) ||
    value.startsWith("class-") ||
    /^\d{4}$/.test(value)
  );
}

/**
 * Turns a raw feed/HTML label into a topic phrase. Path-shaped CMS chrome
 * (`feeds/default`, `keywords/Government`) is not a topic.
 * @param {unknown} raw
 * @returns {string}
 */
export function canonicalTopicLabel(raw) {
  const value = normalizeExtractedText(raw);

  if (!value) {
    return "";
  }

  if (/[\\/]/.test(value)) {
    return "";
  }

  const slug = slugifyTopic(value);

  if (
    !slug ||
    slug.length < 2 ||
    isNonSubjectSlug(slug) ||
    isParserArtifactSlug(slug)
  ) {
    return "";
  }

  return value;
}

/**
 * Unigrams that are English filler or site chrome, not a subject like
 * “artificial intelligence” or “landscaping”.
 */
/**
 * Multi-word publishing chrome that is not a subject.
 */
const NON_SUBJECT_PHRASES = new Set([
  "joshua-morris",
  "personal-site",
  "personal-websites",
  "worth-wandering",
]);

/**
 * Function words and publishing chrome that must not become topics.
 */
export const NON_SUBJECT_UNIGRAMS = new Set([
  "actually",
  "advice",
  "another",
  "application",
  "applications",
  "article",
  "articles",
  "across",
  "active",
  "alongside",
  "amazing",
  "among",
  "around",
  "awesome",
  "back",
  "bad",
  "best",
  "better",
  "blog",
  "blogs",
  "bruh",
  "build",
  "built",
  "case",
  "click",
  "code",
  "coder",
  "come",
  "coming",
  "companies",
  "contact",
  "content",
  "cool",
  "creative",
  "date",
  "day",
  "days",
  "default",
  "designed",
  "developer",
  "developed",
  "didn",
  "directory",
  "doesn",
  "don",
  "dude",
  "enable",
  "engineer",
  "even",
  "every",
  "everything",
  "excellent",
  "experience",
  "experiments",
  "fastest",
  "feed",
  "feeds",
  "find",
  "first",
  "founder",
  "freely",
  "fun",
  "funny",
  "get",
  "good",
  "got",
  "great",
  "home",
  "ideas",
  "inclusive",
  "index",
  "info",
  "isn",
  "josh",
  "joshua",
  "joshternet",
  "just",
  "key",
  "keyword",
  "keywords",
  "know",
  "less",
  "like",
  "lists",
  "look",
  "looking",
  "made",
  "make",
  "making",
  "many",
  "may",
  "menu",
  "modern",
  "much",
  "need",
  "needed",
  "newsletter",
  "new",
  "nice",
  "night",
  "nine",
  "nothing",
  "now",
  "notes",
  "official",
  "one",
  "open",
  "page",
  "pages",
  "people",
  "personal",
  "platform",
  "portfolio",
  "post",
  "posts",
  "project",
  "projects",
  "random",
  "read",
  "reading",
  "real",
  "really",
  "recent",
  "resume",
  "rss",
  "see",
  "service",
  "showcase",
  "site",
  "sites",
  "skills",
  "something",
  "still",
  "system",
  "systems",
  "tagline",
  "take",
  "team",
  "template",
  "theme",
  "thing",
  "things",
  "thoughts",
  "time",
  "times",
  "today",
  "top",
  "two",
  "uncategorized",
  "united",
  "used",
  "using",
  "visual",
  "want",
  "way",
  "web",
  "website",
  "websites",
  "well",
  "without",
  "won",
  "work",
  "works",
  "writer",
  "year",
  "years",
]);

/**
 * Leading tokens that make a hyphenated slug a sentence fragment, not a subject.
 */
const LEADING_FILLER_UNIGRAMS = new Set([
  "actually",
  "basically",
  "currently",
  "definitely",
  "freely",
  "probably",
  "really",
  "simply",
  "usually",
]);

/**
 * True when a slug is not a subject (function word, chrome, or filler).
 * @param {string} slug
 * @returns {boolean}
 */
export function isNonSubjectSlug(slug) {
  const value = String(slug || "").toLowerCase();

  if (!value) {
    return true;
  }

  if (NON_SUBJECT_UNIGRAMS.has(value) || NON_SUBJECT_PHRASES.has(value)) {
    return true;
  }

  if (/\d/.test(value) && /post/.test(value)) {
    return true;
  }

  if (/^about-/.test(value)) {
    return true;
  }

  const parts = value.split("-").filter(Boolean);

  if (parts.length >= 2 && LEADING_FILLER_UNIGRAMS.has(parts[0])) {
    return true;
  }

  if (
    parts.length === 0 ||
    parts.every(
      (part) =>
        STOPWORDS.has(part) ||
        NON_SUBJECT_UNIGRAMS.has(part) ||
        /^\d+$/.test(part),
    )
  ) {
    return true;
  }

  return isParserArtifactSlug(value);
}

/**
 * Heuristic slugs that must not be publicly attached to a participant
 * (documents may still be analyzed privately; publishers can declare explicitly).
 */
export const SENSITIVE_HEURISTIC_SLUGS = new Set([
  "cancer",
  "diabetes",
  "hiv",
  "depression",
  "religion",
  "christianity",
  "islam",
  "judaism",
  "lgbtq",
  "gay",
  "lesbian",
  "bisexual",
  "transgender",
  "democrat",
  "republican",
  "bankruptcy",
  "homelessness",
  "criminal",
  "felony",
  "arrest",
]);

/**
 * @param {string} slug
 * @returns {boolean}
 */
export function isSensitiveHeuristicSlug(slug) {
  return SENSITIVE_HEURISTIC_SLUGS.has(String(slug || "").toLowerCase());
}

/**
 * Quality bar for heuristic community membership (stricter than persist).
 * @param {{
 *   slug?: string,
 *   tf?: number,
 *   df?: number,
 *   evidence_class?: string,
 * }} input
 * @returns {boolean}
 */
export function heuristicQualifiesForCommunity(input) {
  const slug = String(input?.slug || "");

  if (!slug || slug.length < 3 || isParserArtifactSlug(slug)) {
    return false;
  }

  if (isNonSubjectSlug(slug)) {
    return false;
  }

  if (isSensitiveHeuristicSlug(slug)) {
    return false;
  }

  if (input?.evidence_class && input.evidence_class !== "heuristic") {
    return false;
  }

  const df = Number(input?.df) || 0;
  const tf = Number(input?.tf) || 0;

  if (df < 2) {
    return false;
  }

  return tf >= 4 || df >= 3;
}

/**
 * Builds a normalized declared/heuristic topic evidence record.
 * @param {{
 *   rawValue: string,
 *   source: string,
 *   page?: string,
 *   evidenceClass?: EvidenceClass,
 *   semanticRole?: string,
 *   communityEligible?: boolean,
 *   observedAt?: string,
 *   count?: number,
 *   relevance?: { method: string, value: number },
 *   feed?: string,
 * }} input
 * @returns {Record<string, unknown> | null}
 */
export function buildTopicEvidence(input) {
  const rawValue = capRemoteString(input.rawValue, MAX_RAW_TOPIC_CHARS);

  if (!rawValue) {
    return null;
  }

  const value = canonicalTopicLabel(rawValue);
  const slug = slugifyTopic(value);

  if (
    !slug ||
    slug.length < 2 ||
    isNonSubjectSlug(slug) ||
    isParserArtifactSlug(slug)
  ) {
    return null;
  }

  const source = String(input.source || "");
  const evidenceClass = input.evidenceClass || "declared";
  const communityEligible =
    typeof input.communityEligible === "boolean"
      ? input.communityEligible
      : evidenceClass === "declared" &&
        !isDiscoveryOnlySource(source) &&
        isCommunityEligibleSource(source);

  /** @type {string[]} */
  const transformations = ["trim", "case-normalize", "slugify"];

  if (rawValue !== value) {
    transformations.unshift("decoded");
  }

  const evidence = {
    class: evidenceClass,
    source,
    page: typeof input.page === "string" ? input.page : "",
    raw_value: rawValue,
    value,
    slug,
    transformations,
    semantic_role: input.semanticRole || "topic",
    community_eligible: communityEligible,
    extractor_version: EXTRACTOR_VERSION.topics,
  };

  if (typeof input.observedAt === "string" && input.observedAt) {
    evidence.observed_at = input.observedAt;
  }

  if (typeof input.count === "number") {
    evidence.count = input.count;
  }

  if (input.relevance && typeof input.relevance.value === "number") {
    evidence.relevance = {
      method: String(input.relevance.method || "tfidf-v1"),
      value: input.relevance.value,
    };
  }

  if (typeof input.feed === "string" && input.feed) {
    evidence.feed = input.feed;
  }

  return evidence;
}

/**
 * Canonical identity for one evidence record.
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
export function evidenceIdentityKey(item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  return [
    item.class || "",
    item.source || "",
    item.page || "",
    item.slug || item.value || "",
  ].join("\0");
}

/**
 * Collapses duplicate evidence. Prefers the later non-empty observed_at.
 * Omits empty observed_at. Bounded to 8 representative records.
 * @param {Array<Record<string, unknown>>} items
 * @returns {Array<Record<string, unknown>>}
 */
export function dedupeEvidence(items) {
  /** @type {Map<string, Record<string, unknown>>} */
  const byKey = new Map();

  for (const item of items || []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    // evidenceIdentityKey only returns "" for non-objects, already skipped above.
    const key = evidenceIdentityKey(item);
    const next = { ...item };

    if (!next.observed_at) {
      delete next.observed_at;
    }

    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, next);
      continue;
    }

    const existingAt =
      typeof existing.observed_at === "string" ? existing.observed_at : "";
    const nextAt = typeof next.observed_at === "string" ? next.observed_at : "";

    if (nextAt && (!existingAt || nextAt >= existingAt)) {
      byKey.set(key, next);
    }
  }

  return [...byKey.values()]
    .sort((left, right) => {
      const source = String(left.source || "").localeCompare(
        String(right.source || ""),
      );

      if (source !== 0) {
        return source;
      }

      return String(left.page || "").localeCompare(String(right.page || ""));
    })
    .slice(0, 8);
}

/**
 * Merges evidence arrays by slug into subject signal records.
 * @param {Array<Record<string, unknown>>} evidenceItems
 * @returns {Array<Record<string, unknown>>}
 */
export function mergeEvidenceBySlug(evidenceItems) {
  /** @type {Map<string, {slug: string, label: string, evidence: Array<Record<string, unknown>>, community_eligible: boolean}>} */
  const bySlug = new Map();

  for (const item of evidenceItems) {
    if (!item || typeof item.slug !== "string") {
      continue;
    }

    const slug = item.slug;
    const entry = bySlug.get(slug) || {
      slug,
      label: typeof item.value === "string" ? item.value : slug,
      evidence: [],
      community_eligible: false,
    };

    if (typeof item.value === "string" && item.value) {
      entry.label = item.value;
    }

    if (item.community_eligible === true) {
      entry.community_eligible = true;
    }

    entry.evidence.push(item);
    bySlug.set(slug, entry);
  }

  return [...bySlug.values()]
    .map((entry) => {
      const declared = entry.evidence.filter(
        (item) => item.class === "declared",
      );
      const heuristic = entry.evidence.filter(
        (item) => item.class === "heuristic",
      );
      const evidenceClass = declared.length
        ? "declared"
        : heuristic.length
          ? "heuristic"
          : "observed";

      const evidence = dedupeEvidence(entry.evidence);
      const record = {
        slug: entry.slug,
        label: entry.label,
        evidence_class: evidenceClass,
        community_eligible: entry.community_eligible,
        evidence_count: evidence.length,
        evidence,
      };

      if (evidenceClass === "heuristic" && heuristic[0]?.relevance) {
        record.relevance = heuristic[0].relevance;
      }

      return record;
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

/**
 * Legacy subjects[] projection for temporary backward compatibility.
 * @param {Array<Record<string, unknown>>} signals
 * @returns {Array<Record<string, unknown>>}
 */
export function legacySubjectsFromSignals(signals) {
  return (Array.isArray(signals) ? signals : []).map((signal) => {
    const sources = [
      ...new Set(
        (signal.evidence || []).map((item) => String(item.source || "unknown")),
      ),
    ].sort();
    const pages = [];
    const seen = new Set();

    for (const item of signal.evidence || []) {
      if (typeof item.page === "string" && item.page && !seen.has(item.page)) {
        seen.add(item.page);
        pages.push({ url: item.page, title: "" });
      }
    }

    return {
      slug: signal.slug,
      label: signal.label,
      sources,
      pages: pages.slice(0, 8),
      evidence_class: signal.evidence_class,
      community_eligible: Boolean(signal.community_eligible),
      ...(signal.relevance ? { relevance: signal.relevance } : {}),
    };
  });
}
