/**
 * Goal & Constraints:
 * Map JoshBot registry participation to the four public button states.
 * Only participating nodes (latest_declaration_check_outcome === "valid")
 * count as members. Registry read failures are unavailable, never Join.
 */

export const BUTTON_STATES = {
  "verified-josh": {
    state: "verified-josh",
    alt: "Verified Josh, Joshternet site",
    linkLabel: "Verified Josh on the Joshternet",
    member: true,
  },
  "verified-non-josh": {
    state: "verified-non-josh",
    alt: "Verified Non-Josh, Joshternet site",
    linkLabel: "Verified Non-Josh on the Joshternet",
    member: true,
  },
  undeclared: {
    state: "undeclared",
    alt: "Undeclared, Joshternet site",
    linkLabel: "Undeclared Joshternet site",
    member: true,
  },
  join: {
    state: "join",
    alt: "Join the Joshternet",
    linkLabel: "Join the Joshternet",
    member: false,
  },
};

/**
 * @param {unknown} declaration
 * @returns {"affirmed" | "declined" | "undeclared" | null}
 */
export function identityFromDeclaration(declaration) {
  if (
    !declaration ||
    typeof declaration !== "object" ||
    Array.isArray(declaration) ||
    declaration.version !== 1
  ) {
    return null;
  }

  if (!Object.hasOwn(declaration, "josh")) {
    return "undeclared";
  }

  if (declaration.josh === true) {
    return "affirmed";
  }

  if (declaration.josh === false) {
    return "declined";
  }

  return null;
}

/**
 * @param {unknown} node
 * @returns {boolean}
 */
export function isParticipatingNode(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return false;
  }

  return node.latest_declaration_check_outcome === "valid";
}

/**
 * @param {"affirmed" | "declined" | "undeclared"} identity
 * @returns {keyof typeof BUTTON_STATES}
 */
export function stateFromIdentity(identity) {
  switch (identity) {
    case "affirmed":
      return "verified-josh";
    case "declined":
      return "verified-non-josh";
    case "undeclared":
      return "undeclared";
    default: {
      const _exhaustive = identity;
      void _exhaustive;
      return "undeclared";
    }
  }
}

/**
 * @param {unknown} registry
 * @returns {Map<string, "affirmed" | "declined" | "undeclared">}
 */
export function buildRegistryIndex(registry) {
  const index = new Map();

  if (
    !registry ||
    typeof registry !== "object" ||
    Array.isArray(registry) ||
    registry.format_version !== 1 ||
    !Array.isArray(registry.nodes)
  ) {
    throw new Error("invalid JoshBot registry");
  }

  for (const node of registry.nodes) {
    if (!isParticipatingNode(node)) {
      continue;
    }

    if (typeof node.origin !== "string") {
      continue;
    }

    let origin;

    try {
      origin = new URL(node.origin).origin;
    } catch {
      continue;
    }

    if (origin !== node.origin) {
      continue;
    }

    const identity = identityFromDeclaration(node.declaration);

    if (!identity) {
      continue;
    }

    index.set(origin, identity);
  }

  return index;
}

/**
 * @param {Map<string, "affirmed" | "declined" | "undeclared">} index
 * @param {string} origin
 * @returns {typeof BUTTON_STATES[keyof typeof BUTTON_STATES]}
 */
export function buttonStateForOrigin(index, origin) {
  const identity = index.get(origin);

  if (!identity) {
    return BUTTON_STATES.join;
  }

  return BUTTON_STATES[stateFromIdentity(identity)];
}
