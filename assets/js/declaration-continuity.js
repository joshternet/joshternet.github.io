/**
 * Goal & Constraints:
 * Pure helpers for post-validation next steps and public-registry listing
 * state on /implement/validate/. Uses a build-time origin list only—no live
 * registry fetch, no analytics payloads with entered URLs.
 */

/**
 * @typedef {'listed' | 'not-listed' | 'unavailable'} RegistryListingState
 */

/**
 * Parses the build-time registry origin JSON embedded on the validate page.
 * @param {string | null | undefined} raw
 * @returns {ReadonlySet<string> | null} Origin set, or null when unavailable.
 */
export function parseRegistryOrigins(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return null;
    }

    const origins = new Set();

    for (const item of parsed) {
      if (typeof item === "string" && item.startsWith("https://")) {
        origins.add(item.replace(/\/+$/, "") || item);
      }
    }

    return origins;
  } catch {
    return null;
  }
}

/**
 * Compares a checked origin against the embedded public registry projection.
 * @param {string | null | undefined} origin
 * @param {ReadonlySet<string> | null | undefined} listedOrigins
 * @returns {RegistryListingState}
 */
export function registryListingState(origin, listedOrigins) {
  if (!(listedOrigins instanceof Set)) {
    return "unavailable";
  }

  if (typeof origin !== "string" || !origin.startsWith("https://")) {
    return "unavailable";
  }

  const normalized = origin.replace(/\/+$/, "") || origin;

  return listedOrigins.has(normalized) ? "listed" : "not-listed";
}

/**
 * Builds privacy-safe next-step copy after a valid declaration check.
 * @param {{
 *   hasOrigin: boolean,
 *   registryState?: RegistryListingState,
 * }} input
 * @returns {{
 *   heading: string,
 *   declarationFact: string,
 *   registryFact: string | null,
 *   body: string,
 *   links: { href: string, label: string }[],
 * }}
 */
export function buildNextSteps(input) {
  const hasOrigin = Boolean(input?.hasOrigin);
  const registryState = input?.registryState ?? "unavailable";

  const links = [
    { href: "/network/", label: "Browse the Network" },
    { href: "/nominate/", label: "Optionally nominate for JoshBot" },
    { href: "/join/", label: "Open the join guide" },
  ];

  if (!hasOrigin) {
    return {
      heading: "What this means",
      declarationFact: "Declaration: valid.",
      registryFact: null,
      body: "This pasted file is a valid version 1 declaration. Publish it at /.well-known/josh on an origin you control, then check that live origin. Public registry discovery is separate from a valid file.",
      links,
    };
  }

  let registryFact =
    "Public registry: unavailable to determine from this page.";
  let body =
    "The declaration is valid. Participation is declared on that origin. Whether JoshBot has listed the site in the public Network is a separate fact.";

  switch (registryState) {
    case "listed":
      registryFact = "Public registry: currently listed.";
      body =
        "The declaration is valid and this origin appears in the current public Network snapshot built into this page. You can open the Network directory, or keep reading the join guide.";
      break;
    case "not-listed":
      registryFact = "Public registry: not currently listed.";
      body =
        "The declaration is valid. Participation is declared, but this origin is not in the current public Network snapshot. JoshBot discovery is separate—you can wait for a crawl or optionally nominate the site.";
      break;
    case "unavailable":
      break;
    default: {
      const _exhaustive = registryState;
      void _exhaustive;
      break;
    }
  }

  return {
    heading: "What this means",
    declarationFact: "Declaration: valid.",
    registryFact,
    body,
    links,
  };
}
