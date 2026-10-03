/**
 * Goal & Constraints:
 * Generated list artifacts are documents, not bare arrays. Empty collections
 * are omitted (sparse) so committed JSON never ships `[]` as the whole file.
 */

/**
 * Reads items from a sparse collection document or a legacy root array.
 * @param {unknown} doc
 * @param {string} key
 * @returns {unknown[]}
 */
export function itemsFromCollection(doc, key) {
  if (Array.isArray(doc)) {
    return doc;
  }

  if (doc && typeof doc === "object" && Array.isArray(doc[key])) {
    return doc[key];
  }

  return [];
}

/**
 * Builds a sparse collection document. Omits `key` when there are no items.
 * @param {{
 *   generatedAt: string,
 *   key: string,
 *   items: unknown[],
 *   extra?: Record<string, unknown>,
 * }} input
 * @returns {Record<string, unknown>}
 */
export function sparseCollectionDocument(input) {
  const items = Array.isArray(input.items) ? input.items : [];
  /** @type {Record<string, unknown>} */
  const doc = {
    schema_version: 1,
    generated_at: input.generatedAt,
    ...(input.extra || {}),
  };

  if (items.length > 0) {
    doc[input.key] = items;
  }

  return doc;
}
