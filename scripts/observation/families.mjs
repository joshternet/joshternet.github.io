/**
 * Goal & Constraints:
 * Register known and planned crawl-derived content families under the shared
 * contract. Domain modules keep distinct freshness/removal semantics.
 */

import {
  registerContentFamily,
  clearContentFamilyRegistry,
  listContentFamilies,
} from "./family-contract.mjs";
import {
  createArticlesAbsencePolicy,
  createDefaultAbsencePolicy,
} from "./completeness.mjs";

/**
 * Registers the initial Joshternet content families.
 * @param {{ replace?: boolean }} [options]
 * @returns {import('./family-contract.mjs').ContentFamilyContract[]}
 */
export function registerDefaultContentFamilies(options = {}) {
  if (options.replace) {
    clearContentFamilyRegistry();
  } else if (listContentFamilies().length > 0) {
    return listContentFamilies();
  }

  registerContentFamily(
    {
      id: "articles",
      description: "Writing, notes, and feed-derived publication objects",
      acceptedSourceTypes: [
        "html",
        "rss",
        "atom",
        "json-feed",
        "h-entry",
        "schema.org/Article",
        "schema.org/BlogPosting",
      ],
      normalizedEvidenceSchema: "joshternet.articles.evidence.v1",
      identityStrategy: "canonical-url",
      freshnessPolicy: "publication-object",
      coverageCompletenessPolicy:
        "complete-page-or-archive; feeds are partial windows",
      presenceEvidencePolicy: "success-or-unchanged-resource-observation",
      absenceRemovalEvidencePolicy: "never-from-feed-window-alone",
      verifiedRemovalSemantics: "none-from-partial-sources",
      provenanceRequirements:
        "resource_observation_id+source_hash when body retained",
      schemaVersion: "1",
      publicOutputs: ["_data/content.json", "_data/activity.json"],
      discover: () => [],
      extract: () => [],
      reconcile: () => ({}),
      project: () => ({}),
    },
    options,
  );

  registerContentFamily(
    {
      id: "showcase",
      description: "Durable creative works for Showcase",
      acceptedSourceTypes: [
        "html",
        "schema.org/CreativeWork",
        "open-graph",
        "feed",
        "portfolio-index",
      ],
      normalizedEvidenceSchema: "joshternet.showcase.evidence.v1",
      identityStrategy: "canonical-work-url",
      freshnessPolicy: "durable-work",
      coverageCompletenessPolicy: "complete-work-page-or-declared-index",
      presenceEvidencePolicy: "observable-publisher-evidence-only",
      absenceRemovalEvidencePolicy: "verified-complete-index-or-work-absence",
      verifiedRemovalSemantics: "removal-with-complete-coverage",
      provenanceRequirements:
        "resource_observation_id; no manual category placement",
      schemaVersion: "1",
      publicOutputs: ["_data/showcase.json", "_data/made.json"],
    },
    options,
  );

  registerContentFamily(
    {
      id: "events",
      description: "Lifecycle event objects for Happening",
      acceptedSourceTypes: [
        "html",
        "schema.org/Event",
        "h-event",
        "event-feed",
      ],
      normalizedEvidenceSchema: "joshternet.events.evidence.v1",
      identityStrategy: "event-url-or-stable-uid",
      freshnessPolicy: "lifecycle-object",
      coverageCompletenessPolicy: "complete-event-page-or-declared-index",
      presenceEvidencePolicy: "structured-event-evidence",
      absenceRemovalEvidencePolicy: "end-date-changes-projection-not-history",
      verifiedRemovalSemantics: "lifecycle-change-not-deletion",
      provenanceRequirements: "resource_observation_id+event identity",
      schemaVersion: "1",
      publicOutputs: ["_data/happening.json", "_data/past_events.json"],
    },
    options,
  );

  registerContentFamily(
    {
      id: "uses",
      description: "Declared current configuration from /uses pages",
      acceptedSourceTypes: ["html", "h-product", "uses-page"],
      normalizedEvidenceSchema: "joshternet.uses.evidence.v1",
      identityStrategy: "tool-id-or-observed-label",
      freshnessPolicy: "current-configuration",
      coverageCompletenessPolicy: "verified-complete-uses-page",
      presenceEvidencePolicy: "extractable-use-claim",
      absenceRemovalEvidencePolicy: "verified-complete-uses-page-may-remove",
      verifiedRemovalSemantics: "removal-on-complete-verified-page",
      provenanceRequirements: "resource_observation_id+label+section",
      schemaVersion: "1",
      publicOutputs: ["_data/uses_summary.json", "assets/data/uses/**"],
    },
    options,
  );

  registerContentFamily(
    {
      id: "seeking",
      description: "Expiring current intent from /seeking pages",
      acceptedSourceTypes: ["html", "h-listing"],
      normalizedEvidenceSchema: "joshternet.seeking.evidence.v1",
      identityStrategy: "listing-url-or-stable-id",
      freshnessPolicy: "timestamp-and-successful-verification",
      coverageCompletenessPolicy: "verified-complete-seeking-page",
      presenceEvidencePolicy: "wanted-listing-evidence",
      absenceRemovalEvidencePolicy:
        "complete-page-withdrawal-not-fetch-failure",
      verifiedRemovalSemantics: "domain-specific-withdrawal",
      provenanceRequirements:
        "resource_observation_id; failed fetch preserves prior",
      schemaVersion: "1",
      publicOutputs: ["_data/seeking.json"],
    },
    options,
  );

  registerContentFamily(
    {
      id: "now",
      description: "Evolving Now slash-page state with successive observations",
      acceptedSourceTypes: ["html", "now-page"],
      normalizedEvidenceSchema: "joshternet.now.evidence.v1",
      identityStrategy: "member-origin-now-page",
      freshnessPolicy: "evolving-state-latest-verified",
      coverageCompletenessPolicy: "verified-now-page-fetch",
      presenceEvidencePolicy: "successful-now-page-observation",
      absenceRemovalEvidencePolicy: "failed-fetch-preserves-previous-state",
      verifiedRemovalSemantics: "none-on-fetch-failure",
      provenanceRequirements: "successive observations; not activity articles",
      schemaVersion: "1",
      publicOutputs: [],
    },
    options,
  );

  registerContentFamily(
    {
      id: "reading",
      description:
        "Books and member/book relationships from reading/library/bookshelf",
      acceptedSourceTypes: [
        "html",
        "opml",
        "h-cite",
        "schema.org/Book",
        "schema.org/Review",
        "feed",
      ],
      normalizedEvidenceSchema: "joshternet.reading.evidence.v1",
      identityStrategy:
        "isbn-or-canonical-book-url-then-title-author-else-unresolved",
      freshnessPolicy: "member-book-relationship-state",
      coverageCompletenessPolicy: "complete-reading-page-or-opml-plus-page",
      presenceEvidencePolicy: "structured-or-semantic-book-evidence",
      absenceRemovalEvidencePolicy: "opml-alone-cannot-remove-if-page-present",
      verifiedRemovalSemantics: "complete-reading-surface-required",
      provenanceRequirements:
        "book identity ladder; never invent rating/status",
      schemaVersion: "1",
      publicOutputs: [],
    },
    options,
  );

  registerContentFamily(
    {
      id: "connections",
      description: "Blogrolls, rel=me, and publisher-declared relationships",
      acceptedSourceTypes: [
        "html",
        "opml",
        "rel-me",
        "h-card",
        "blogroll",
        "joshternet-declaration",
      ],
      normalizedEvidenceSchema: "joshternet.connections.evidence.v1",
      identityStrategy: "edge-endpoints",
      freshnessPolicy: "observable-relationship",
      coverageCompletenessPolicy: "complete-identity-or-blogroll-resource",
      presenceEvidencePolicy: "explicit-publisher-relationship-only",
      absenceRemovalEvidencePolicy: "never-infer-from-shared-topics",
      verifiedRemovalSemantics: "verified-absence-on-complete-identity-surface",
      provenanceRequirements: "no inferred social edges",
      schemaVersion: "1",
      publicOutputs: ["_data/connections.json", "_data/blogrolls.json"],
    },
    options,
  );

  return listContentFamilies();
}

/**
 * Absence policies keyed by family id.
 * @returns {Record<string, import('./completeness.mjs').FamilyAbsencePolicy>}
 */
export function defaultFamilyAbsencePolicies() {
  return {
    articles: createArticlesAbsencePolicy(),
    showcase: createDefaultAbsencePolicy("showcase", {
      disappearanceMeaning: "removal",
    }),
    events: createDefaultAbsencePolicy("events", {
      disappearanceMeaning: "archival",
    }),
    uses: createDefaultAbsencePolicy("uses", {
      disappearanceMeaning: "removal",
    }),
    seeking: createDefaultAbsencePolicy("seeking", {
      disappearanceMeaning: "expiration",
    }),
    now: createDefaultAbsencePolicy("now", { disappearanceMeaning: "none" }),
    reading: createDefaultAbsencePolicy("reading", {
      disappearanceMeaning: "removal",
    }),
    connections: createDefaultAbsencePolicy("connections", {
      disappearanceMeaning: "removal",
    }),
  };
}

export { createArticlesAbsencePolicy, createDefaultAbsencePolicy };
