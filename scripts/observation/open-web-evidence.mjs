/**
 * Goal & Constraints:
 * Supported IndieWeb/open-web evidence roles. Feeds and structured formats are
 * provenance inputs—not a parallel authoritative datastore. Webmentions stay
 * outside publisher-derived content facts.
 */

/** @type {ReadonlyArray<{ id: string, role: string, notes: string }>} */
export const OPEN_WEB_EVIDENCE_MECHANISMS = Object.freeze([
  {
    id: "microformats2",
    role: "structured-html-evidence",
    notes:
      "h-entry, h-event, h-card, h-listing, h-product, relevant properties",
  },
  {
    id: "rss",
    role: "machine-readable-discovery",
    notes: "Partial windows; never sole proof of absence",
  },
  {
    id: "atom",
    role: "machine-readable-discovery",
    notes: "Partial windows; never sole proof of absence",
  },
  {
    id: "json-feed",
    role: "machine-readable-discovery",
    notes: "Partial windows; never sole proof of absence",
  },
  {
    id: "opml",
    role: "machine-readable-discovery",
    notes: "Blogrolls and reading lists; dedupe with HTML peers",
  },
  {
    id: "schema.org-jsonld",
    role: "structured-evidence",
    notes: "Article, Event, CreativeWork, Book, Review",
  },
  {
    id: "open-graph",
    role: "enrichment",
    notes: "Descriptive/enrichment; not sole identity authority",
  },
  {
    id: "rel-me",
    role: "identity-relationship",
    notes: "Publisher-declared identity links",
  },
  {
    id: "sitemap",
    role: "discovery",
    notes: "URL discovery input to the fetch broker",
  },
  {
    id: "robots",
    role: "fetch-policy",
    notes: "Broker enforcement; denials are durable observations",
  },
  {
    id: "well-known",
    role: "discovery",
    notes: "Joshternet declarations and slashpages manifests",
  },
  {
    id: "slash-pages",
    role: "discovery",
    notes: "Discoverable conventions; adapters decide normalization",
  },
  {
    id: "webmention",
    role: "relationship-discussion-event",
    notes:
      "Not page-content truth; dedicated adapter with verification if consumed",
  },
]);

/**
 * @param {string} id
 * @returns {{ id: string, role: string, notes: string }|undefined}
 */
export function getOpenWebEvidenceMechanism(id) {
  return OPEN_WEB_EVIDENCE_MECHANISMS.find((row) => row.id === id);
}

/**
 * Webmentions must not mutate publisher-derived content records directly.
 * @param {string} mechanismId
 * @returns {boolean}
 */
export function mayMutatePublisherContentRecords(mechanismId) {
  return mechanismId !== "webmention";
}
