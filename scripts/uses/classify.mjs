/**
 * Goal & Constraints:
 * Assign a slot and a presentation role from catalog evidence. A familiar
 * name is not enough. Components and fragments never become ranked choices.
 */

import {
  comparisonLabel,
  contentFingerprint,
  resolveToolLabel,
  sanitizeLabel,
} from "./normalize.mjs";

/**
 * @typedef {object} Classification
 * @property {'ranked'|'detail'|'unsorted'|'rejected'} role
 * @property {string|null} slot_id
 * @property {string|null} tool_id
 * @property {string} rule
 * @property {boolean} preference
 * @property {string|null} relation
 * @property {string|null} parent_slot
 */

/**
 * @param {object} claim
 * @param {object} catalog
 * @returns {Classification}
 */
export function classifyClaim(claim, catalog) {
  const name = sanitizeLabel(claim?.name || claim?.label || "");
  const context = sanitizeLabel(
    `${claim?.section || ""} ${claim?.section_path || ""} ${claim?.context || ""} ${claim?.excerpt || ""}`,
  );
  const href = String(claim?.href || "");
  const preference = hasExplicitPreference(context);
  const indexed = indexSlots(catalog);

  if (!name || isRejectedFragment(name)) {
    return result({
      role: "rejected",
      rule: "fragment",
      preference,
    });
  }

  if (claim?.kind === "practice" || claim?.kind === "unresolved") {
    return result({
      role: claim.kind === "unresolved" ? "rejected" : "detail",
      rule: "kind",
      preference,
    });
  }

  const component = componentKind(name);
  if (component) {
    return result({
      role: "detail",
      rule: "component",
      relation: "component_of",
      parent_slot: component,
      preference,
    });
  }

  if (isBrowserExtension(name)) {
    return result({
      role: "detail",
      rule: "extension",
      relation: "extension_of",
      parent_slot: "browser",
      preference,
    });
  }

  if (claim?.kind === "equipment") {
    return result({
      role: "detail",
      rule: "generic-gear",
      preference,
    });
  }

  const byUrl = matchApprovedUrl(name, href, indexed);
  if (byUrl) {
    return finishTool(byUrl, context, indexed, "approved-url", preference);
  }

  const resolved = resolveToolLabel(name, {
    section: claim?.section || "",
    excerpt: context,
    catalog,
  });
  if (resolved.match === "unique" && resolved.tool_id) {
    const tool = indexed.tools.get(resolved.tool_id);
    if (tool) {
      return finishTool(tool, context, indexed, "catalog", preference);
    }
  }
  const fromSection = sectionSlotId(
    claim?.section_path || claim?.section || "",
    catalog?.categories,
  );
  if (fromSection) {
    return result({
      role: "ranked",
      slot_id: fromSection,
      tool_id:
        typeof claim?.tool_id === "string" && claim.tool_id
          ? claim.tool_id
          : resolved.tool_id,
      rule: "section",
      preference,
    });
  }
  if (resolved.match === "abstain" || resolved.match === "ambiguous") {
    return result({
      role: "unsorted",
      rule: resolved.match,
      preference,
    });
  }

  return result({
    role: "unsorted",
    rule: "unresolved",
    preference,
  });
}

/**
 * Ranked slot named by one section-path segment. Two different slots abstain.
 * @param {string} sectionPath
 * @param {object[]} [categories]
 * @returns {string|null}
 */
export function sectionSlotId(sectionPath, categories) {
  const segments = String(sectionPath || "")
    .split("/")
    .map((part) => comparisonLabel(part))
    .filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  const ranked = (categories || []).filter(
    (slot) => slot && slot.role === "ranked" && slot.id,
  );
  /** @type {Set<string>} */
  const hits = new Set();
  for (const segment of segments) {
    const matched = ranked.filter((slot) => {
      const name = comparisonLabel(slot.name || "");
      const id = comparisonLabel(slot.id);
      return segment === name || segment === id;
    });
    if (matched.length === 1) {
      hits.add(matched[0].id);
    }
  }
  if (hits.size !== 1) {
    return null;
  }
  return [...hits][0];
}

/**
 * Buckets current claims after a catalog reclassification.
 * Labels are not edited. The report is the record of what the rules did.
 * @param {object[]} members
 * @param {object} catalog
 * @returns {object}
 */
export function buildMigrationReport(members, catalog) {
  /** @type {object[]} */
  const merged = [];
  /** @type {object[]} */
  const slots = [];
  /** @type {object[]} */
  const details = [];
  /** @type {object[]} */
  const rejected = [];
  /** @type {object[]} */
  const unsorted = [];
  /** @type {object[]} */
  const compounds = [];

  for (const member of members || []) {
    for (const tool of member.tools || []) {
      const name = String(tool.name || "");
      if (/\b(and|with)\b/i.test(name)) {
        compounds.push({ origin: member.origin, name });
      }
      const classified = classifyClaim(
        {
          name,
          label: name,
          context: tool.context || "",
          section: tool.section || "",
          section_path: tool.section_path || "",
          href: tool.href || "",
          kind: tool.kind || "product",
          tool_id: tool.tool_id || "",
        },
        catalog,
      );
      const row = {
        origin: member.origin,
        name,
        stored_id: tool.tool_id || "",
        tool_id: classified.tool_id,
        slot_id: classified.slot_id,
        rule: classified.rule,
      };
      if (
        classified.role === "ranked" &&
        String(tool.tool_id || "").startsWith("observed:") &&
        classified.tool_id
      ) {
        merged.push(row);
      }
      if (classified.role === "ranked") {
        slots.push(row);
      } else if (classified.role === "detail") {
        details.push(row);
      } else if (classified.role === "rejected") {
        rejected.push(row);
      } else {
        unsorted.push(row);
      }
    }
  }

  return {
    merged_identities: merged,
    split_compounds: compounds,
    slot_assignments: slots,
    moved_to_detail: details,
    rejected_fragments: rejected,
    unsorted,
  };
}

/**
 * Stable fingerprint of the catalogs that change classification.
 * @param {object} catalog
 * @returns {string}
 */
export function catalogFingerprint(catalog) {
  return contentFingerprint(
    JSON.stringify({
      categories: catalog?.categories || [],
      tools: catalog?.tools || [],
      aliases: catalog?.aliases || [],
    }),
  );
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasExplicitPreference(text) {
  return /\b(favou?rites?|preferred|prefers|prefer)\b/i.test(
    String(text || ""),
  );
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isRejectedFragment(name) {
  if (/^(todo|work computer)$/i.test(name)) {
    return true;
  }
  if (
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}$/i.test(name)
  ) {
    return true;
  }
  return /^\d{4}$/.test(name);
}

/**
 * A part of a computer or keyboard, not a competing product.
 * A computer whose name merely mentions its memory stays a computer.
 * @param {string} name
 * @returns {string}
 */
function componentKind(name) {
  if (/\b(mac|laptop|mini pc|nuc|computer)\b/i.test(name)) {
    return "";
  }
  if (/\b(ddr\d?|\bram\b)\b/i.test(name)) {
    return "computer";
  }
  if (/^(amd ryzen|intel)\b/i.test(name)) {
    return "computer";
  }
  if (/\b(graphics card|radeon|geforce|\bgpu\b)\b/i.test(name)) {
    return "computer";
  }
  if (/\b(key switches|kailh)\b/i.test(name)) {
    return "keyboard";
  }
  return "";
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isBrowserExtension(name) {
  return /\bublock\b/i.test(name);
}

/**
 * @param {string} name
 * @param {string} href
 * @param {{ tools: Map<string, object> }} indexed
 * @returns {object|null}
 */
function matchApprovedUrl(name, href, indexed) {
  if (!href) {
    return null;
  }
  let claimUrl;
  try {
    claimUrl = new URL(href);
  } catch {
    return null;
  }
  const host = claimUrl.hostname.replace(/^www\./, "");
  if (
    (host === "play.google.com" || host === "apps.apple.com") &&
    /\bkindle\b/i.test(name) &&
    !/paperwhite/i.test(name)
  ) {
    return indexed.tools.get("kindle-app") || null;
  }
  const sharedHosts = new Set([
    "github.com",
    "play.google.com",
    "apps.apple.com",
    "apple.com",
  ]);
  /** @type {object[]} */
  const matches = [];
  for (const tool of indexed.tools.values()) {
    if (!tool.website || tool.id === "kindle-app") {
      continue;
    }
    let toolUrl;
    try {
      toolUrl = new URL(tool.website);
    } catch {
      continue;
    }
    const toolHost = toolUrl.hostname.replace(/^www\./, "");
    if (toolHost !== host) {
      continue;
    }
    if (sharedHosts.has(host)) {
      if (
        toolUrl.pathname.length > 1 &&
        claimUrl.pathname.startsWith(toolUrl.pathname)
      ) {
        matches.push(tool);
      }
      continue;
    }
    matches.push(tool);
  }
  if (matches.length !== 1 || !nameAgrees(name, matches[0])) {
    return null;
  }
  return matches[0];
}

/**
 * @param {string} name
 * @param {object} tool
 * @returns {boolean}
 */
function nameAgrees(name, tool) {
  const left = comparisonLabel(name);
  const right = comparisonLabel(tool.name);
  if (!left || !right) {
    return false;
  }
  return left === right || left.includes(right) || right.includes(left);
}

/**
 * @param {object} tool
 * @param {string} context
 * @param {{ slots: Map<string, object> }} indexed
 * @param {string} rule
 * @param {boolean} preference
 * @returns {Classification}
 */
function finishTool(tool, context, indexed, rule, preference) {
  const slotId = pickSlot(tool, context);
  const slot = slotId ? indexed.slots.get(slotId) : null;
  if (!slot || slot.role === "retired") {
    return result({
      role: "unsorted",
      tool_id: tool.id,
      rule: "abstain",
      preference,
    });
  }
  if (slot.role === "detail") {
    return result({
      role: "detail",
      slot_id: slot.id,
      tool_id: tool.id,
      rule,
      preference,
    });
  }
  if (slot.role === "excluded") {
    return result({
      role: "rejected",
      slot_id: slot.id,
      tool_id: tool.id,
      rule: "entertainment",
      preference,
    });
  }
  return result({
    role: "ranked",
    slot_id: slot.id,
    tool_id: tool.id,
    rule,
    preference,
  });
}

/**
 * @param {object} tool
 * @param {string} context
 * @returns {string|null}
 */
function pickSlot(tool, context) {
  const text = context.toLowerCase();
  for (const rule of tool.slot_rules || []) {
    const needles = rule.require_context || [];
    if (needles.some((needle) => text.includes(String(needle).toLowerCase()))) {
      return rule.slot_id;
    }
  }
  return tool.category_id || null;
}

/**
 * @param {object} catalog
 * @returns {{ tools: Map<string, object>, slots: Map<string, object> }}
 */
function indexSlots(catalog) {
  /** @type {Map<string, object>} */
  const tools = new Map();
  /** @type {Map<string, object>} */
  const slots = new Map();
  for (const tool of catalog?.tools || []) {
    if (tool?.id) {
      tools.set(tool.id, tool);
    }
  }
  for (const slot of catalog?.categories || []) {
    if (slot?.id) {
      slots.set(slot.id, slot);
    }
  }
  return { tools, slots };
}

/**
 * @param {Partial<Classification>} fields
 * @returns {Classification}
 */
function result(fields) {
  return {
    role: fields.role,
    slot_id: fields.slot_id || null,
    tool_id: fields.tool_id || null,
    rule: fields.rule,
    preference: Boolean(fields.preference),
    relation: fields.relation || null,
    parent_slot: fields.parent_slot || null,
  };
}
