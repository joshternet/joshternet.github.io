/**
 * Goal & Constraints:
 * Topic publication checks that run before generated data is published.
 * A failed check must not be treated as a successful dataset.
 * Scores here describe topic evidence, not publisher worth.
 * Diagnostics are for CI logs, not public datasets.
 */

import { isNonSubjectSlug, isParserArtifactSlug } from "./evidence.mjs";
import {
  aliasConfigurationErrors,
  equivalentAliases,
  foldPluralSlug,
} from "./normalize.mjs";

/**
 * @param {unknown} topics
 * @returns {Array<Record<string, unknown>>}
 */
function communitiesOf(topics) {
  const list = Array.isArray(topics)
    ? topics
    : topics && typeof topics === "object" && Array.isArray(topics.communities)
      ? topics.communities
      : [];

  return list.filter((topic) => topic && typeof topic.slug === "string");
}

/**
 * Slugs added and removed between two topic documents.
 * Merged and renamed slugs are left out of those lists.
 * A large count change is reported and is not itself a failure.
 * @param {unknown} previous
 * @param {unknown} next
 * @param {unknown} [aliasesDoc]
 * @returns {{
 *   added: string[],
 *   removed: string[],
 *   merged: Array<{from: string, to: string}>,
 *   renamed: Array<{from: string, to: string}>,
 *   review: string[],
 * }}
 */
export function topicDiff(previous, next, aliasesDoc) {
  if (previous == null) {
    return { added: [], removed: [], review: [], merged: [], renamed: [] };
  }

  const before = communitiesOf(previous).map((topic) => topic.slug);
  const after = communitiesOf(next).map((topic) => topic.slug);
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added = after.filter((slug) => !beforeSet.has(slug)).sort();
  const removed = before.filter((slug) => !afterSet.has(slug)).sort();
  /** @type {string[]} */
  const review = [];

  if (before.length >= 10 && after.length > before.length * 1.5) {
    review.push(`topic count rose from ${before.length} to ${after.length}`);
  }

  if (before.length >= 10 && after.length < before.length * 0.5) {
    review.push(`topic count fell from ${before.length} to ${after.length}`);
  }

  const equivalents = new Map(
    equivalentAliases(aliasesDoc)
      .filter((entry) => entry.kind === "equivalent")
      .map((entry) => [entry.from, entry.to]),
  );
  /** @type {Array<{from: string, to: string}>} */
  const merged = [];
  /** @type {Array<{from: string, to: string}>} */
  const renamed = [];

  for (const slug of removed) {
    const alias = equivalents.get(slug);

    if (alias && afterSet.has(alias)) {
      merged.push({ from: slug, to: alias });
      continue;
    }

    const folded = foldPluralSlug(slug);

    if (folded !== slug && afterSet.has(folded)) {
      renamed.push({ from: slug, to: folded });
    }
  }

  const mergedFrom = new Set(merged.map((entry) => entry.from));
  const mergedTo = new Set(merged.map((entry) => entry.to));
  const renamedFrom = new Set(renamed.map((entry) => entry.from));
  const renamedTo = new Set(renamed.map((entry) => entry.to));

  return {
    added: added.filter((slug) => !mergedTo.has(slug) && !renamedTo.has(slug)),
    removed: removed.filter(
      (slug) => !mergedFrom.has(slug) && !renamedFrom.has(slug),
    ),
    review,
    merged,
    renamed,
  };
}

/**
 * @param {string} url
 * @returns {string}
 */
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * Invariants for a generated topic dataset.
 * @param {{
 *   topics?: unknown,
 *   content?: unknown,
 *   aliasesDoc?: unknown,
 *   searchUrls?: string[],
 *   previousTopics?: unknown,
 * }} input
 * @returns {{
 *   ok: boolean,
 *   errors: Array<{code: string, slug: string, detail: string}>,
 *   rejections: Array<{code: string, count: number}>,
 *   diff: {added: string[], removed: string[], merged: Array<{from: string, to: string}>, renamed: Array<{from: string, to: string}>, review: string[]},
 * }}
 */
export function topicQualityReport(input) {
  /** @type {Array<{code: string, slug: string, detail: string}>} */
  const errors = [];
  const topics = input?.topics;
  const communities = communitiesOf(topics);

  for (const problem of aliasConfigurationErrors(input?.aliasesDoc)) {
    errors.push({
      code: problem.code,
      slug: problem.from,
      detail: problem.to,
    });
  }

  const publicSlugs = new Set();

  for (const topic of communities) {
    publicSlugs.add(topic.slug);

    if (isParserArtifactSlug(topic.slug) || isNonSubjectSlug(topic.slug)) {
      errors.push({
        code: "invalid-public-topic",
        slug: topic.slug,
        detail: "parser artifact or filler slug",
      });
    }

    if (
      topic &&
      typeof topic === "object" &&
      ("identity" in topic || "diagnosis" in topic || "political_view" in topic)
    ) {
      errors.push({
        code: "sensitive-identity",
        slug: topic.slug,
        detail: "topic record asserts a personal attribute",
      });
    }

    const sites = Array.isArray(topic.sites) ? topic.sites : [];

    for (const site of sites) {
      if (!site || site.membership !== "heuristic") {
        continue;
      }

      const pages = Array.isArray(site.pages) ? site.pages : [];

      if (pages.length === 0) {
        errors.push({
          code: "heuristic-without-evidence",
          slug: topic.slug,
          detail: typeof site.origin === "string" ? site.origin : "",
        });
      }
    }
  }

  const items = Array.isArray(input?.content?.items) ? input.content.items : [];
  const knownOrigins = new Set(
    items
      .map((item) =>
        item && typeof item.site_origin === "string" ? item.site_origin : "",
      )
      .filter(Boolean),
  );

  for (const item of items) {
    if (
      !item ||
      typeof item.url !== "string" ||
      typeof item.site_origin !== "string"
    ) {
      continue;
    }

    const origin = originOf(item.url);

    if (origin && origin !== item.site_origin && knownOrigins.has(origin)) {
      errors.push({
        code: "cross-origin-content",
        slug: "",
        detail: item.url,
      });
    }
  }

  const searchUrls = Array.isArray(input?.searchUrls) ? input.searchUrls : [];

  for (const url of searchUrls) {
    const match = String(url).match(/^\/topics\/([^/]+)\/$/);

    if (match && !publicSlugs.has(match[1])) {
      errors.push({
        code: "phantom-topic-link",
        slug: match[1],
        detail: String(url),
      });
    }
  }

  /** @type {Map<string, number>} */
  const rejectionCounts = new Map();

  for (const error of errors) {
    rejectionCounts.set(error.code, (rejectionCounts.get(error.code) || 0) + 1);
  }

  const rejections = [...rejectionCounts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([code, count]) => ({ code, count }));

  return {
    ok: errors.length === 0,
    errors,
    rejections,
    diff: topicDiff(input?.previousTopics, topics, input?.aliasesDoc),
  };
}
