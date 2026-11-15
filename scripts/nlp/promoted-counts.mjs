/**
 * Goal & Constraints:
 * Fail-closed checks that visitor-facing explore / site_views tallies match
 * promoted Network primaries after site-family projection. Called from
 * nlp:validate on every sync so counts stay correct when the site updates.
 */

import {
  isNetworkEntryPromoted,
  secondaryToPrimaryFromNetwork,
} from "../network/site-families.mjs";
import { promotedFamilyMemberCount, sitesByOrigin } from "../views/lib.mjs";

/**
 * Counts Network entries that visitor surfaces treat as participants.
 * @param {unknown} network
 * @returns {number}
 */
export function promotedParticipantCount(network) {
  if (!Array.isArray(network)) {
    return 0;
  }

  return network.filter(isNetworkEntryPromoted).length;
}

/**
 * Returns human-readable invariant failures for explore / site_views counts.
 * Empty array means the projections match promoted primaries.
 * @param {{
 *   network: unknown,
 *   explore: unknown,
 *   siteViews?: unknown,
 *   topics?: unknown,
 * }} input
 * @returns {string[]}
 */
export function promotedCountInvariantErrors(input) {
  const errors = [];
  const network = Array.isArray(input.network) ? input.network : [];
  const explore =
    input.explore &&
    typeof input.explore === "object" &&
    !Array.isArray(input.explore)
      ? /** @type {Record<string, unknown>} */ (input.explore)
      : null;
  const siteViews =
    input.siteViews &&
    typeof input.siteViews === "object" &&
    !Array.isArray(input.siteViews)
      ? /** @type {Record<string, unknown>} */ (input.siteViews)
      : null;

  if (!explore) {
    errors.push("explore.json must be an object with participant_count");
    return errors;
  }

  const expected = promotedParticipantCount(network);
  const actual = explore.participant_count;

  if (actual !== expected) {
    errors.push(
      `explore.participant_count (${String(actual)}) must equal promoted Network primaries (${expected})`,
    );
  }

  if (siteViews) {
    const sites = Array.isArray(siteViews.sites) ? siteViews.sites : null;

    if (!sites) {
      errors.push(
        "site_views.sites must be an array when site_views.json exists",
      );
    } else if (sites.length !== expected) {
      errors.push(
        `site_views.sites.length (${sites.length}) must equal promoted Network primaries (${expected})`,
      );
    }
  }

  const neighborhood = explore.neighborhood;

  if (
    neighborhood &&
    typeof neighborhood === "object" &&
    !Array.isArray(neighborhood)
  ) {
    const slug = typeof neighborhood.slug === "string" ? neighborhood.slug : "";
    const topics =
      input.topics &&
      typeof input.topics === "object" &&
      !Array.isArray(input.topics)
        ? /** @type {Record<string, unknown>} */ (input.topics)
        : {};
    const communities = Array.isArray(topics.communities)
      ? topics.communities
      : [];
    const community = communities.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        /** @type {Record<string, unknown>} */ (entry).slug === slug,
    );
    const communitySites =
      community &&
      typeof community === "object" &&
      Array.isArray(/** @type {Record<string, unknown>} */ (community).sites)
        ? /** @type {Record<string, unknown>} */ (community).sites
        : [];
    const expectedMembers = promotedFamilyMemberCount(
      communitySites,
      sitesByOrigin(network),
      secondaryToPrimaryFromNetwork(network),
    );
    const actualMembers = neighborhood.member_count;

    if (actualMembers !== expectedMembers) {
      errors.push(
        `explore.neighborhood.member_count (${String(actualMembers)}) for ${slug || "(missing slug)"} must equal promoted remapped members (${expectedMembers})`,
      );
    }
  }

  return errors;
}
