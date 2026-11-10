/**
 * Goal & Constraints:
 * Multiple representations of one publisher object converge on one semantic
 * identity when evidence is sufficient. Source observations stay distinct.
 * Ambiguous identities remain separate—never aggressive title-only merges.
 */

/**
 * @typedef {object} IdentityCandidate
 * @property {string} [isbn]
 * @property {string} [canonical_url]
 * @property {string} [normalized_title]
 * @property {string} [normalized_author]
 * @property {string} [uid]
 * @property {string} source_observation_id
 */

/**
 * Book identity ladder: ISBN → canonical URL → title+author → unresolved.
 * @param {IdentityCandidate} candidate
 * @returns {{ key: string, strength: 'isbn'|'canonical_url'|'title_author'|'unresolved' }}
 */
export function bookIdentityKey(candidate) {
  const isbn = String(candidate.isbn || "").replace(/[^0-9Xx]/g, "");
  if (isbn.length >= 10) {
    return { key: `isbn:${isbn.toUpperCase()}`, strength: "isbn" };
  }
  const url = String(candidate.canonical_url || "").trim();
  if (url) {
    return {
      key: `url:${normalizeIdentityUrl(url)}`,
      strength: "canonical_url",
    };
  }
  const title = String(candidate.normalized_title || "")
    .trim()
    .toLowerCase();
  const author = String(candidate.normalized_author || "")
    .trim()
    .toLowerCase();
  if (title && author) {
    return { key: `ta:${title}|${author}`, strength: "title_author" };
  }
  if (title) {
    return {
      key: `title-only:${title}|${candidate.source_observation_id}`,
      strength: "unresolved",
    };
  }
  return {
    key: `unresolved:${candidate.source_observation_id}`,
    strength: "unresolved",
  };
}

/**
 * Publication identity prefers canonical URL then uid.
 * @param {IdentityCandidate} candidate
 * @returns {{ key: string, strength: string }}
 */
export function publicationIdentityKey(candidate) {
  const url = String(candidate.canonical_url || "").trim();
  if (url) {
    return {
      key: `pub:${normalizeIdentityUrl(url)}`,
      strength: "canonical_url",
    };
  }
  const uid = String(candidate.uid || "").trim();
  if (uid) {
    return { key: `uid:${uid}`, strength: "uid" };
  }
  return {
    key: `unresolved:${candidate.source_observation_id}`,
    strength: "unresolved",
  };
}

/**
 * Groups candidates that share a deterministic identity key.
 * Unresolved keys never merge across different source observations.
 * @param {IdentityCandidate[]} candidates
 * @param {(c: IdentityCandidate) => { key: string, strength: string }} keyFn
 * @returns {Map<string, IdentityCandidate[]>}
 */
export function groupBySemanticIdentity(candidates, keyFn) {
  /** @type {Map<string, IdentityCandidate[]>} */
  const groups = new Map();
  for (const candidate of candidates || []) {
    const { key } = keyFn(candidate);
    const list = groups.get(key) || [];
    list.push(candidate);
    groups.set(key, list);
  }
  return groups;
}

/**
 * @param {string} url
 * @returns {string}
 */
function normalizeIdentityUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;
    return parsed.href.toLowerCase();
  } catch {
    return String(url || "")
      .trim()
      .toLowerCase();
  }
}

/**
 * True when two book candidates must stay separate (title-only ambiguity).
 * @param {IdentityCandidate} a
 * @param {IdentityCandidate} b
 * @returns {boolean}
 */
export function booksMustRemainSeparate(a, b) {
  const left = bookIdentityKey(a);
  const right = bookIdentityKey(b);
  if (left.strength === "unresolved" || right.strength === "unresolved") {
    return left.key !== right.key;
  }
  return left.key !== right.key;
}
