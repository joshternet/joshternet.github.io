/**
 * Goal & Constraints:
 * Canonical topic identity for equivalent wording. Regular plurals fold.
 * Irregular and ambiguous forms do not. Equivalent aliases stay separate
 * from broader and related relationships. No publisher ranking.
 * Inputs: raw labels, slugs, alias documents, and sentence text.
 * Outputs: folded slugs, alias errors, and relationship lists.
 * Acceptance: news, analysis, business, CSS, Windows, and Go stay intact.
 */

import { slugifyTopic } from "../network/connections.mjs";

/**
 * Surface forms that must not be stemmed.
 * @type {Set<string>}
 */
export const PLURAL_EXCEPTIONS = new Set([
  "acoustics",
  "alias",
  "analysis",
  "athletics",
  "atlas",
  "business",
  "canvas",
  "chaos",
  "classics",
  "css",
  "economics",
  "ethics",
  "gas",
  "go",
  "graphics",
  "lens",
  "linguistics",
  "mathematics",
  "mechanics",
  "news",
  "physics",
  "plus",
  "politics",
  "postgres",
  "robotics",
  "series",
  "species",
  "statistics",
  "this",
  "windows",
]);

/**
 * Full slugs that must not be folded token by token.
 * @type {Set<string>}
 */
const SLUG_EXCEPTIONS = new Set(["united-states"]);

/**
 * Short subjects whose lowercase form is not enough to publish a topic.
 * @type {Set<string>}
 */
export const AMBIGUOUS_UNIGRAMS = new Set([
  "apple",
  "go",
  "java",
  "python",
  "rust",
  "windows",
]);

/**
 * Folds one regular English plural token.
 * @param {string} token - Lowercase token.
 * @returns {string} Singular form, or the token when folding would be unsafe.
 */
export function foldPluralToken(token) {
  const value = String(token || "");

  if (!value || PLURAL_EXCEPTIONS.has(value) || value.length < 5) {
    return value;
  }

  if (value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }

  if (/(xes|zes|ches|shes|sses)$/.test(value)) {
    return value.slice(0, -2);
  }

  if (
    value.endsWith("s") &&
    !value.endsWith("ss") &&
    !value.endsWith("sis") &&
    !value.endsWith("ous") &&
    !value.endsWith("us") &&
    !value.endsWith("is") &&
    !value.endsWith("as") &&
    !value.endsWith("os")
  ) {
    return value.slice(0, -1);
  }

  return value;
}

/**
 * Folds the last-and-each token of a slug. Does not merge different phrases.
 * @param {string} slug - Already slugified topic id.
 * @returns {string} Folded slug.
 */
export function foldPluralSlug(slug) {
  const value = String(slug || "");

  if (SLUG_EXCEPTIONS.has(value)) {
    return value;
  }

  const parts = value.split("-").filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return parts.map((part) => foldPluralToken(part)).join("-");
}

/**
 * True when a short ambiguous word has technical context in this sentence.
 * @param {string} sentence - Original sentence, original case.
 * @param {string} token - Lowercase token.
 * @returns {boolean}
 */
export function allowsAmbiguousUnigram(sentence, token) {
  const text = String(sentence || "");

  if (token === "go") {
    return (
      /\bin Go\b/.test(text) ||
      /\bGolang\b/.test(text) ||
      /\bGo programming\b/.test(text)
    );
  }

  if (token === "rust") {
    return (
      /\bin Rust\b/.test(text) ||
      /\bRust programming\b/.test(text) ||
      /\bRust language\b/.test(text)
    );
  }

  if (token === "python") {
    return /\bin Python\b/.test(text) || /\bPython programming\b/.test(text);
  }

  if (token === "java") {
    return /\bin Java\b/.test(text) || /\bJava programming\b/.test(text);
  }

  if (token === "apple") {
    return /\bApple (computer|silicon)\b/.test(text) || /\bmacOS\b/.test(text);
  }

  if (token === "windows") {
    return (
      /\bMicrosoft Windows\b/.test(text) ||
      /\bWindows (10|11|Server)\b/.test(text)
    );
  }

  return false;
}

/**
 * @param {unknown} aliasesDoc
 * @returns {Array<{from: string, to: string, kind: string}>}
 */
export function equivalentAliases(aliasesDoc) {
  if (!aliasesDoc || typeof aliasesDoc !== "object") {
    return [];
  }

  const list = Array.isArray(aliasesDoc.aliases) ? aliasesDoc.aliases : [];
  /** @type {Array<{from: string, to: string, kind: string}>} */
  const aliases = [];

  for (const entry of list) {
    if (
      !entry ||
      typeof entry.from !== "string" ||
      typeof entry.to !== "string"
    ) {
      continue;
    }

    const from = foldPluralSlug(slugifyTopic(entry.from));
    const to = foldPluralSlug(slugifyTopic(entry.to));

    if (!from || !to || from === to) {
      continue;
    }

    aliases.push({
      from,
      to,
      kind: typeof entry.kind === "string" ? entry.kind : "equivalent",
    });
  }

  return aliases;
}

/**
 * Broader and related links. These are not aliases and must not be merged.
 * @param {unknown} aliasesDoc
 * @returns {Array<{from: string, to: string, kind: string}>}
 */
export function topicRelations(aliasesDoc) {
  if (!aliasesDoc || typeof aliasesDoc !== "object") {
    return [];
  }

  const list = Array.isArray(aliasesDoc.relationships)
    ? aliasesDoc.relationships
    : [];
  /** @type {Array<{from: string, to: string, kind: string}>} */
  const relations = [];

  for (const entry of list) {
    if (
      !entry ||
      typeof entry.from !== "string" ||
      typeof entry.to !== "string"
    ) {
      continue;
    }

    const from = foldPluralSlug(slugifyTopic(entry.from));
    const to = foldPluralSlug(slugifyTopic(entry.to));
    const kind = entry.kind;

    if (
      !from ||
      !to ||
      from === to ||
      (kind !== "broader" && kind !== "related")
    ) {
      continue;
    }

    relations.push({ from, to, kind });
  }

  return relations;
}

/**
 * Detects alias cycles, conflicting targets, and relationships filed as aliases.
 * @param {unknown} aliasesDoc
 * @returns {Array<{code: string, from: string, to: string}>}
 */
export function aliasConfigurationErrors(aliasesDoc) {
  /** @type {Array<{code: string, from: string, to: string}>} */
  const errors = [];
  const aliases = equivalentAliases(aliasesDoc);
  /** @type {Map<string, string>} */
  const map = new Map();

  for (const entry of aliases) {
    if (entry.kind !== "equivalent") {
      errors.push({
        code: "alias-not-equivalent",
        from: entry.from,
        to: entry.to,
      });
      continue;
    }

    if (map.has(entry.from) && map.get(entry.from) !== entry.to) {
      errors.push({
        code: "alias-conflict",
        from: entry.from,
        to: entry.to,
      });
      continue;
    }

    map.set(entry.from, entry.to);
  }

  const rawRelations = Array.isArray(aliasesDoc?.relationships)
    ? aliasesDoc.relationships
    : [];

  for (const entry of rawRelations) {
    if (
      !entry ||
      typeof entry.from !== "string" ||
      typeof entry.to !== "string"
    ) {
      continue;
    }

    if (entry.kind === "equivalent") {
      errors.push({
        code: "relationship-not-alias",
        from: slugifyTopic(entry.from),
        to: slugifyTopic(entry.to),
      });
    }
  }

  for (const start of map.keys()) {
    const seen = [];
    let current = start;

    while (map.has(current) && !seen.includes(current)) {
      seen.push(current);
      current = map.get(current);
    }

    if (map.has(current) && seen.includes(current)) {
      errors.push({
        code: "alias-cycle",
        from: start,
        to: current,
      });
    }
  }

  return errors;
}

/**
 * Machine-readable reason a heuristic candidate is not public.
 * @param {{
 *   slug?: string,
 *   contextual?: boolean,
 *   boilerplate?: boolean,
 *   sensitive?: boolean,
 * }} input
 * @returns {string}
 */
export function heuristicRejectionReason(input) {
  if (input?.boilerplate) {
    return "site-boilerplate";
  }

  if (input?.sensitive) {
    return "sensitive-attribute";
  }

  if (input?.contextual === false) {
    return "insufficient-context";
  }

  const slug = String(input?.slug || "");

  if (!slug || slug.length < 3) {
    return "invalid-phrase";
  }

  return "low-subject-relevance";
}
