/**
 * Goal & Constraints:
 * Shared versions and enums for Uses Intelligence. Taxonomy and extractor
 * bumps are deliberate; silent reassignment of tool IDs is forbidden.
 */

/** @typedef {'current'|'former'|'considering'|'wishlist'|'unspecified'|'removed'} ToolStatus */
/** @typedef {'verified'|'verified_empty'|'uncertain'|'not_found'|'disallowed'|'unreachable'|'parse_error'|'out_of_scope'|'not_checked'} PageOutcome */
/** @typedef {'usage_added'|'usage_changed'|'usage_removed'|'usage_reclassified'|'source_status_changed'|'member_eligibility_changed'|'correction'} EventType */

/** @typedef {'product'|'equipment'|'practice'|'unresolved'} UseKind */

export const USES_SCHEMA_VERSION = 1;
export const EXTRACTOR_VERSION = 3;
export const TAXONOMY_VERSION = 2;
export const SCORING_VERSION = 1;
export const AGGREGATION_VERSION = 2;

/** @typedef {'ranked'|'detail'|'unsorted'|'rejected'} PresentationRole */

/** @type {ReadonlySet<PresentationRole>} */
export const PRESENTATION_ROLES = new Set([
  "ranked",
  "detail",
  "unsorted",
  "rejected",
]);

/** @type {ReadonlySet<UseKind>} */
export const USE_KINDS = new Set([
  "product",
  "equipment",
  "practice",
  "unresolved",
]);

/** Days a verified observation remains fresh for period-end adoption. */
export const FRESHNESS_DAYS = 35;

/** Minimum hours between two successful absences before usage_removed. */
export const REMOVAL_CONFIRMATION_HOURS = 24;

/** Early-sample threshold: minimum verified /uses publishers. */
export const EARLY_SAMPLE_MIN_PUBLISHERS = 5;

/** Early-sample threshold: share of registry origins with valid /uses. */
export const EARLY_SAMPLE_MIN_COVERAGE = 0.3;

/** Max excerpt characters stored with evidence. */
export const MAX_EXCERPT_CHARS = 200;

/** Max raw label characters. */
export const MAX_LABEL_CHARS = 120;

/** Hub origins that must never supply usage evidence for themselves. */
export const HUB_ORIGINS = new Set([
  "https://joshternet.org",
  "https://www.joshternet.org",
]);

/** @type {ReadonlySet<ToolStatus>} */
export const TOOL_STATUSES = new Set([
  "current",
  "former",
  "considering",
  "wishlist",
  "unspecified",
  "removed",
]);

/** @type {ReadonlySet<PageOutcome>} */
export const PAGE_OUTCOMES = new Set([
  "verified",
  "verified_empty",
  "uncertain",
  "not_found",
  "disallowed",
  "unreachable",
  "parse_error",
  "out_of_scope",
  "not_checked",
]);

/** @type {ReadonlySet<EventType>} */
export const EVENT_TYPES = new Set([
  "usage_added",
  "usage_changed",
  "usage_removed",
  "usage_reclassified",
  "source_status_changed",
  "member_eligibility_changed",
  "correction",
]);

/** Navigation link texts that may point at a uses-equivalent page. */
export const USES_NAV_LABELS = new Set([
  "uses",
  "my setup",
  "tools i use",
  "tools",
  "gear",
  "stack",
  "setup",
  "/uses",
  "/uses/",
]);

/**
 * Returns whether an origin is the Joshternet hub (never self-evidence).
 * @param {string} origin - Absolute origin URL.
 * @returns {boolean}
 */
export function isHubOrigin(origin) {
  if (typeof origin !== "string" || !origin) {
    return false;
  }
  try {
    const url = new URL(origin);
    const normalized = `${url.protocol}//${url.host}`.replace(/\/$/, "");
    return HUB_ORIGINS.has(normalized);
  } catch {
    return false;
  }
}
