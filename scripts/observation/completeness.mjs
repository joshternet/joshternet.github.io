/**
 * Goal & Constraints:
 * Absence is evidence only when coverage is complete for that family's removal
 * policy. Partial feeds, failed fetches, and budget exhaustion never prove
 * deletion.
 */

import {
  coverageMayEstablishRemoval,
  outcomeEstablishesVerifiedAbsence,
} from "./resource-observation.mjs";

/**
 * @typedef {object} FamilyAbsencePolicy
 * @property {string} family_id
 * @property {(observation: object) => boolean} isCompleteObservation
 * @property {(observation: object) => boolean} mayEstablishPresence
 * @property {(observation: object) => boolean} mayEstablishVerifiedAbsence
 * @property {'removal'|'expiration'|'archival'|'none'} disappearanceMeaning
 */

/**
 * Default policy helpers shared across families.
 * @param {string} familyId
 * @param {{ disappearanceMeaning?: 'removal'|'expiration'|'archival'|'none' }} [options]
 * @returns {FamilyAbsencePolicy}
 */
export function createDefaultAbsencePolicy(familyId, options = {}) {
  return {
    family_id: familyId,
    isCompleteObservation(observation) {
      return (
        observation?.coverage === "complete" &&
        (observation?.outcome === "success" ||
          observation?.outcome === "unchanged")
      );
    },
    mayEstablishPresence(observation) {
      return (
        observation?.outcome === "success" ||
        observation?.outcome === "unchanged"
      );
    },
    mayEstablishVerifiedAbsence(observation) {
      return (
        coverageMayEstablishRemoval(observation?.coverage) &&
        observation?.outcome === "success"
      );
    },
    disappearanceMeaning: options.disappearanceMeaning || "none",
  };
}

/**
 * Decides whether a missing item may be treated as verified absence.
 * @param {FamilyAbsencePolicy} policy
 * @param {object[]} observationsForSource
 * @returns {{ may_remove: boolean, reason: string }}
 */
export function evaluateVerifiedAbsence(policy, observationsForSource) {
  const rows = observationsForSource || [];
  if (rows.length === 0) {
    return { may_remove: false, reason: "no-observations" };
  }
  const failed = rows.some((row) =>
    [
      "timeout",
      "http_failure",
      "network_failure",
      "dns_failure",
      "tls_failure",
      "deferred",
      "robots_disallowed",
      "budget_exhausted",
    ].includes(String(row.outcome || "")),
  );
  if (failed) {
    return { may_remove: false, reason: "failed-or-incomplete-fetch" };
  }
  const incomplete = rows.some((row) => !policy.isCompleteObservation(row));
  if (incomplete) {
    return { may_remove: false, reason: "incomplete-coverage" };
  }
  const eligible = rows.filter((row) =>
    policy.mayEstablishVerifiedAbsence(row),
  );
  if (eligible.length === 0) {
    return { may_remove: false, reason: "policy-rejects-absence" };
  }
  if (policy.disappearanceMeaning === "none") {
    return { may_remove: false, reason: "disappearance-means-none" };
  }
  return {
    may_remove: policy.disappearanceMeaning === "removal",
    reason: `disappearance-${policy.disappearanceMeaning}`,
  };
}

/**
 * RSS/Atom windows cannot prove older articles were deleted.
 * @returns {FamilyAbsencePolicy}
 */
export function createArticlesAbsencePolicy() {
  const base = createDefaultAbsencePolicy("articles", {
    disappearanceMeaning: "none",
  });
  return {
    ...base,
    mayEstablishVerifiedAbsence(observation) {
      if (
        /feed|rss|atom|json-feed/i.test(
          String(observation?.discovery_reason || ""),
        )
      ) {
        return false;
      }
      return base.mayEstablishVerifiedAbsence(observation);
    },
  };
}
