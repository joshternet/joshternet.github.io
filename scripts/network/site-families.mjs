/**
 * Goal & Constraints: Curated Network site families (primary + destinations).
 * Re-projected on every network:sync from `_data/network_site_families.json`.
 * Secondaries stay crawl participants with `promoted: false`; primaries carry
 * `destinations` for card UI. Invalid family config fails the sync.
 */

import { normalizeText } from "./lib.mjs";

/**
 * @typedef {{ origin: string, domain: string, title: string }} SiteDestination
 * @typedef {{ primary: string, destinations: string[] }} SiteFamily
 */

/**
 * True when a Network entry should appear in visitor-facing site lists.
 * Missing `promoted` means promoted (ungrouped sites).
 * @param {Record<string, unknown> | null | undefined} entry
 * @returns {boolean}
 */
export function isNetworkEntryPromoted(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  return entry.promoted !== false;
}

/**
 * Reads curated site families from a clear JSON document.
 * @param {unknown} doc
 * @returns {SiteFamily[]}
 */
export function siteFamiliesFromDocument(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return [];
  }

  const families = /** @type {{ families?: unknown }} */ (doc).families;

  if (!Array.isArray(families)) {
    return [];
  }

  /** @type {SiteFamily[]} */
  const parsed = [];

  for (const row of families) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }

    const primary = normalizeText(
      /** @type {{ primary?: unknown }} */ (row).primary,
    );
    const rawDestinations = /** @type {{ destinations?: unknown }} */ (row)
      .destinations;

    if (!primary || !Array.isArray(rawDestinations)) {
      continue;
    }

    const destinations = [
      ...new Set(
        rawDestinations
          .map((value) => normalizeText(value))
          .filter((value) => value && value !== primary),
      ),
    ];

    if (destinations.length === 0) {
      continue;
    }

    parsed.push({ primary, destinations });
  }

  return parsed;
}

/**
 * Builds secondary origin → primary origin map from families.
 * @param {SiteFamily[]} families
 * @returns {Map<string, string>}
 */
export function secondaryToPrimaryMap(families) {
  /** @type {Map<string, string>} */
  const map = new Map();

  for (const family of families) {
    for (const destination of family.destinations) {
      map.set(destination, family.primary);
    }
  }

  return map;
}

/**
 * Reads destination origins from a projected Network entry.
 * @param {Record<string, unknown> | null | undefined} entry
 * @returns {string[]}
 */
export function destinationOriginsFromEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return [];
  }

  if (!Array.isArray(entry.destinations)) {
    return [];
  }

  /** @type {string[]} */
  const origins = [];

  for (const destination of entry.destinations) {
    if (!destination || typeof destination !== "object") {
      continue;
    }

    const origin = normalizeText(
      /** @type {{ origin?: unknown }} */ (destination).origin,
    );

    if (origin) {
      origins.push(origin);
    }
  }

  return origins;
}

/**
 * Builds secondary → primary map from already-projected Network entries.
 * @param {Array<Record<string, unknown>>} network
 * @returns {Map<string, string>}
 */
export function secondaryToPrimaryFromNetwork(network) {
  /** @type {Map<string, string>} */
  const map = new Map();

  for (const entry of Array.isArray(network) ? network : []) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const primary = normalizeText(entry.origin);

    if (!primary) {
      continue;
    }

    for (const origin of destinationOriginsFromEntry(entry)) {
      map.set(origin, primary);
    }
  }

  return map;
}

/**
 * Resolves a participant origin to its promoted primary when grouped.
 * @param {string} origin
 * @param {Map<string, string>} secondaryToPrimary
 * @returns {string}
 */
export function promoteNetworkOrigin(origin, secondaryToPrimary) {
  const normalized = normalizeText(origin);

  if (!normalized) {
    return "";
  }

  return secondaryToPrimary.get(normalized) || normalized;
}

/**
 * Validates families against the current participant set.
 * @param {SiteFamily[]} families
 * @param {Iterable<string>} participantOrigins
 * @returns {void}
 * @throws {Error} When a family references unknown or overlapping origins.
 */
export function assertValidSiteFamilies(families, participantOrigins) {
  const known = new Set(
    [...participantOrigins]
      .map((origin) => normalizeText(origin))
      .filter(Boolean),
  );
  /** @type {Map<string, string>} */
  const claimed = new Map();

  for (const family of families) {
    if (!known.has(family.primary)) {
      throw new Error(
        `network_site_families: primary ${family.primary} is not a current participant`,
      );
    }

    if (claimed.has(family.primary)) {
      throw new Error(
        `network_site_families: origin ${family.primary} appears in more than one family`,
      );
    }

    claimed.set(family.primary, family.primary);

    for (const destination of family.destinations) {
      if (!known.has(destination)) {
        throw new Error(
          `network_site_families: destination ${destination} is not a current participant`,
        );
      }

      if (destination === family.primary) {
        throw new Error(
          `network_site_families: destination ${destination} cannot equal its primary`,
        );
      }

      if (claimed.has(destination)) {
        throw new Error(
          `network_site_families: origin ${destination} appears in more than one family`,
        );
      }

      claimed.set(destination, family.primary);
    }
  }
}

/**
 * Strips prior family projection fields, then attaches destinations on
 * primaries and `promoted: false` on secondaries. Idempotent across sync runs.
 * @param {Array<Record<string, unknown>>} entries
 * @param {unknown} familiesDoc
 * @returns {Array<Record<string, unknown>>}
 * @throws {Error} When family config is invalid for the entry set.
 */
export function applySiteFamilies(entries, familiesDoc) {
  const list = Array.isArray(entries) ? entries : [];
  const families = siteFamiliesFromDocument(familiesDoc);

  for (const entry of list) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    delete entry.destinations;
    delete entry.promoted;
  }

  if (families.length === 0) {
    return list;
  }

  const byOrigin = new Map();

  for (const entry of list) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const origin = normalizeText(entry.origin);

    if (!origin) {
      continue;
    }

    byOrigin.set(origin, entry);
  }

  assertValidSiteFamilies(families, byOrigin.keys());

  for (const family of families) {
    // assertValidSiteFamilies guarantees primary and destinations are present.
    const primary = /** @type {Record<string, unknown>} */ (
      byOrigin.get(family.primary)
    );

    /** @type {SiteDestination[]} */
    const destinations = [];

    for (const destinationOrigin of family.destinations) {
      const secondary = /** @type {Record<string, unknown>} */ (
        byOrigin.get(destinationOrigin)
      );

      secondary.promoted = false;

      const domain =
        normalizeText(secondary.domain) ||
        (() => {
          try {
            return new URL(destinationOrigin).host;
          } catch {
            return destinationOrigin;
          }
        })();
      const title = normalizeText(secondary.title) || domain;

      destinations.push({
        origin: destinationOrigin,
        domain,
        title,
      });
    }

    if (destinations.length > 0) {
      primary.destinations = destinations;
    }
  }

  return list;
}
