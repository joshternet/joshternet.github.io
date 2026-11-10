/**
 * Goal & Constraints:
 * Canonical registry reads fail closed. Empty/out-of-bounds/malformed registry
 * must not publish over the last valid generation. Member removal preserves
 * historical observations; re-add resumes identity.
 */

/**
 * @typedef {object} RegistryMember
 * @property {string} origin
 * @property {string} [id]
 */

/**
 * @typedef {object} RegistryValidationResult
 * @property {boolean} ok
 * @property {string} [reason]
 * @property {RegistryMember[]} members
 */

/**
 * Validates a registry snapshot before replacing member-derived datasets.
 * @param {unknown} registry
 * @param {{
 *   previousMemberCount?: number,
 *   minMembers?: number,
 *   maxShrinkRatio?: number,
 * }} [bounds]
 * @returns {RegistryValidationResult}
 */
export function validateCanonicalRegistry(registry, bounds = {}) {
  if (!registry || typeof registry !== "object") {
    return { ok: false, reason: "registry-unavailable", members: [] };
  }
  const membersRaw = Array.isArray(registry)
    ? registry
    : Array.isArray(registry.members)
      ? registry.members
      : null;
  if (!membersRaw) {
    return { ok: false, reason: "registry-unparseable", members: [] };
  }
  /** @type {RegistryMember[]} */
  const members = [];
  for (const row of membersRaw) {
    const origin = String(row?.origin || row?.url || "").trim();
    if (!origin) {
      return { ok: false, reason: "registry-missing-origin", members: [] };
    }
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, reason: "registry-bad-origin", members: [] };
      }
    } catch {
      return { ok: false, reason: "registry-bad-origin", members: [] };
    }
    members.push({
      origin: new URL(origin).origin,
      id: row.id ? String(row.id) : undefined,
    });
  }
  const minMembers = Number.isFinite(bounds.minMembers) ? bounds.minMembers : 1;
  if (members.length < minMembers) {
    return { ok: false, reason: "registry-below-minimum", members };
  }
  const previous = Number(bounds.previousMemberCount);
  const maxShrink =
    Number.isFinite(bounds.maxShrinkRatio) && bounds.maxShrinkRatio > 0
      ? bounds.maxShrinkRatio
      : 0.5;
  if (
    Number.isFinite(previous) &&
    previous > 0 &&
    members.length / previous < maxShrink
  ) {
    return { ok: false, reason: "registry-unexpected-shrink", members };
  }
  return { ok: true, members };
}

/**
 * Computes membership transitions without deleting history.
 * @param {string[]} previousOrigins
 * @param {string[]} nextOrigins
 * @returns {{ added: string[], removed: string[], retained: string[] }}
 */
export function membershipTransitions(previousOrigins, nextOrigins) {
  const prev = new Set((previousOrigins || []).map((value) => String(value)));
  const next = new Set((nextOrigins || []).map((value) => String(value)));
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];
  /** @type {string[]} */
  const retained = [];
  for (const origin of next) {
    if (prev.has(origin)) {
      retained.push(origin);
    } else {
      added.push(origin);
    }
  }
  for (const origin of prev) {
    if (!next.has(origin)) {
      removed.push(origin);
    }
  }
  return { added, removed, retained };
}

/**
 * Stable member identity key for re-add continuity.
 * @param {string} origin
 * @returns {string}
 */
export function memberIdentityKey(origin) {
  return new URL(String(origin)).origin;
}
