/**
 * Goal & Constraints:
 * Deterministic first-party keyphrase / TF-IDF from visible prose regions only.
 * Persist heuristic subject_signals; mark community_eligible only when the
 * quality bar passes. Entity-decoded text required.
 */

import {
  buildTopicEvidence,
  heuristicQualifiesForCommunity,
  isNonSubjectSlug,
  isParserArtifactSlug,
  isSensitiveHeuristicSlug,
} from "./evidence.mjs";
import { STOPWORDS, slugifyTopic } from "./lib.mjs";
import {
  AMBIGUOUS_UNIGRAMS,
  allowsAmbiguousUnigram,
  foldPluralSlug,
  heuristicRejectionReason,
} from "./normalize.mjs";
import { normalizeExtractedText } from "./text.mjs";

/**
 * @typedef {{url: string, title: string, text: string}} PageInput
 */

/**
 * Tokenizes text into lowercase words after entity decode.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  return normalizeExtractedText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

/**
 * Builds unigram and bigram candidates from tokens.
 * @param {string[]} tokens
 * @returns {string[]}
 */
export function candidatePhrases(tokens) {
  const phrases = [];

  for (const token of tokens) {
    phrases.push(token);
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    phrases.push(`${tokens[index]} ${tokens[index + 1]}`);
  }

  return phrases;
}

/**
 * Content tokens in one sentence, keeping original adjacency.
 * Stopwords stay in the raw list so they cannot be jumped over.
 * @param {string} sentence
 * @returns {{raw: string[], content: string[]}}
 */
function sentenceTokens(sentence) {
  const raw = normalizeExtractedText(sentence)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const content = raw.filter((token) => {
    if (STOPWORDS.has(token)) {
      return false;
    }

    if (AMBIGUOUS_UNIGRAMS.has(token)) {
      return allowsAmbiguousUnigram(sentence, token);
    }

    return token.length > 2;
  });

  return { raw, content };
}

/**
 * Unigrams and bigrams that respect sentence boundaries and stopwords.
 * A bigram is emitted only when the two words were neighbors in the sentence.
 * @param {string} text
 * @returns {string[]}
 */
export function phrasesFromText(text) {
  const sentences = String(text || "").split(/[.!?\n]+/);
  /** @type {string[]} */
  const phrases = [];

  for (const sentence of sentences) {
    const { raw, content } = sentenceTokens(sentence);

    for (const token of content) {
      phrases.push(token);
    }

    for (let index = 0; index < raw.length - 1; index += 1) {
      const left = raw[index];
      const right = raw[index + 1];

      if (!content.includes(left) || !content.includes(right)) {
        continue;
      }

      phrases.push(`${left} ${right}`);
    }
  }

  return phrases;
}

/**
 * True when a phrase is a multiword subject or appears in a page title.
 * Frequency in the body is not context.
 * @param {string} label
 * @param {Map<string, string>} pages
 * @returns {boolean}
 */
function phraseHasContext(label, pages) {
  if (label.includes(" ")) {
    return true;
  }

  const slug = foldPluralSlug(slugifyTopic(label));

  return [...pages.values()].some((title) =>
    tokenize(title).some(
      (token) => foldPluralSlug(slugifyTopic(token)) === slug,
    ),
  );
}

/**
 * Extracts heuristic subject signals from pages (persistence thresholds applied).
 * @param {PageInput[]} pages
 * @param {{ minCount?: number, minPages?: number, limit?: number, observedAt?: string }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export function extractTopicsFromPages(pages, limitOrOptions = {}) {
  const options =
    typeof limitOrOptions === "number"
      ? { limit: limitOrOptions, minCount: 1 }
      : limitOrOptions || {};
  const minCount = options.minCount ?? 2;
  const minPages = options.minPages ?? 1;
  const limit = options.limit ?? 200;
  const observedAt = options.observedAt || "";

  if (!Array.isArray(pages) || pages.length === 0) {
    return [];
  }

  /** @type {Map<string, {label: string, tf: number, df: number, pages: Map<string, string>}>} */
  const stats = new Map();
  let documents = 0;

  for (const page of pages) {
    if (!page || typeof page.text !== "string" || !page.text) {
      continue;
    }

    documents += 1;
    const phrases = phrasesFromText(page.text);
    const unique = new Set();

    for (const phrase of phrases) {
      const slug = foldPluralSlug(slugifyTopic(phrase));

      if (
        !slug ||
        slug.length < 3 ||
        isParserArtifactSlug(slug) ||
        isNonSubjectSlug(slug)
      ) {
        continue;
      }

      const entry = stats.get(slug) || {
        label: phrase,
        tf: 0,
        df: 0,
        pages: new Map(),
      };
      entry.tf += 1;
      entry.pages.set(
        typeof page.url === "string" ? page.url : "",
        typeof page.title === "string" ? page.title : "",
      );

      if (!unique.has(slug)) {
        entry.df += 1;
        unique.add(slug);
      }

      stats.set(slug, entry);
    }
  }

  if (documents === 0) {
    return [];
  }

  const scored = [...stats.entries()]
    .map(([slug, entry]) => {
      const idf = Math.log(1 + documents / (1 + entry.df));
      const value = Number(((entry.tf / documents) * idf).toFixed(6));
      const inTitle = [...entry.pages.values()].some((title) =>
        tokenize(title).some(
          (token) => foldPluralSlug(slugifyTopic(token)) === slug,
        ),
      );
      const persist =
        entry.tf >= minCount ||
        entry.df >= Math.max(minPages, 2) ||
        inTitle ||
        value >= 0.5;

      if (!persist) {
        return null;
      }

      const boilerplate = documents >= 8 && entry.df / documents >= 0.8;
      const contextual = phraseHasContext(entry.label, entry.pages);
      const qualifies =
        !boilerplate &&
        heuristicQualifiesForCommunity({
          slug,
          tf: entry.tf,
          df: entry.df,
          evidence_class: "heuristic",
          contextual,
        });

      const evidenceItems = [...entry.pages.entries()]
        .filter(([url]) => url)
        .slice(0, 5)
        .map(([url]) =>
          buildTopicEvidence({
            rawValue: entry.label,
            source: "visible-text",
            page: url,
            evidenceClass: "heuristic",
            communityEligible: qualifies,
            observedAt,
            count: entry.tf,
            relevance: { method: "tfidf-v1", value },
          }),
        )
        .filter(Boolean);

      return {
        slug,
        label: entry.label,
        evidence_class: "heuristic",
        community_eligible: qualifies,
        status: qualifies ? "accepted" : "pending",
        rejection_reason: qualifies
          ? ""
          : heuristicRejectionReason({
              slug,
              contextual,
              boilerplate,
              sensitive: isSensitiveHeuristicSlug(slug),
            }),
        relevance: { method: "tfidf-v1", value },
        evidence_count: evidenceItems.length,
        evidence: evidenceItems,
        sources: ["nlp"],
        pages: [...entry.pages.entries()]
          .filter(([url]) => url)
          .slice(0, 5)
          .map(([url, title]) => ({ url, title })),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftValue = left.relevance.value;
      const rightValue = right.relevance.value;

      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }

      return left.slug.localeCompare(right.slug);
    })
    .slice(0, limit);

  return scored;
}
