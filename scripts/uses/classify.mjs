/**
 * Goal & Constraints:
 * Assign a slot and a presentation role from catalog evidence. A familiar
 * name is not enough. Components and fragments never become ranked choices.
 */

import {
  comparisonLabel,
  contentFingerprint,
  isArticleShapedLabel,
  isNonComparableUseLabel,
  isReportableUseLabel,
  isSentenceShapedLabel,
  isUsesSectionLabel,
  peelCatalogLead,
  peelDeclarativeLeadIn,
  resolveToolLabel,
  sanitizeLabel,
  separateNameContext,
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
  if (claim == null) {
    return result({
      role: "rejected",
      rule: "fragment",
      preference: false,
    });
  }
  let safeCatalog = {};
  if (catalog != null) {
    safeCatalog = catalog;
  }
  const rawName = sanitizeLabel(claimName(claim));
  const href = String(fieldString(claim.href));
  const preference = hasExplicitPreference(claimContextText(claim));
  const indexed = indexSlots(safeCatalog);

  if (!rawName) {
    return result({
      role: "rejected",
      rule: "fragment",
      preference,
    });
  }
  if (isRejectedFragment(rawName)) {
    return result({
      role: "rejected",
      rule: "fragment",
      preference,
    });
  }

  // Reject extension/framework/article/sentence chrome on the publisher string
  // before peels turn Copilot asides or "vscode-styled-components" into tools.
  const earlyReject = nonProductClassification(rawName, preference);
  if (earlyReject) {
    return earlyReject;
  }

  const peeledLead = peelDeclarativeLeadIn(rawName);
  const separated = separateNameContext(peeledLead.name);
  const catalogLead = peelCatalogLead(separated.name, safeCatalog);
  // peelCatalogLead always returns a name for non-empty input (canonical or original).
  const name = sanitizeLabel(catalogLead.name);
  const context = sanitizeLabel(
    `${claimContextText(claim)} ${peeledLead.context} ${separated.context} ${catalogLead.context}`,
  );

  if (claim.kind === "practice") {
    return result({
      role: "detail",
      rule: "kind",
      preference,
    });
  }
  if (claim.kind === "unresolved") {
    return result({
      role: "rejected",
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
  if (isIdeExtensionOrFeature(name)) {
    return result({
      role: "detail",
      rule: "extension",
      relation: "extension_of",
      parent_slot: "editor-ide",
      preference,
    });
  }

  if (claim.kind === "equipment") {
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

  if (catalogLead.tool_id) {
    const peeledTool = indexed.tools.get(catalogLead.tool_id);
    if (peeledTool) {
      return finishTool(
        peeledTool,
        context,
        indexed,
        "catalog-peel",
        preference,
      );
    }
  }

  const resolved = resolveToolLabel(name, {
    section: fieldString(claim.section),
    excerpt: context,
    catalog: safeCatalog,
  });
  if (resolved.match === "unique") {
    if (resolved.tool_id) {
      const tool = indexed.tools.get(resolved.tool_id);
      if (tool) {
        return finishTool(tool, context, indexed, "catalog", preference);
      }
    }
  }
  const macbook = matchMacBookFamily(`${name} ${context}`, indexed);
  if (macbook) {
    return finishTool(macbook, context, indexed, "macbook-family", preference);
  }
  const macMini = matchMacMiniFamily(name, indexed);
  if (macMini) {
    return finishTool(macMini, context, indexed, "mac-mini-family", preference);
  }
  const shaped = matchProductShapeTool(name, indexed);
  if (shaped) {
    return finishTool(shaped, context, indexed, "product-shape", preference);
  }
  const shapeSlot = productShapeSlotId(name);
  const fromSection = sectionSlotId(
    claimSectionHint(claim),
    safeCatalog.categories,
  );
  // Product nouns (chair, trackpad, iPad, TV) beat umbrella sections like
  // Workstation/Computers that publishers use for mixed gear lists.
  const slotId = shapeSlot || fromSection;
  if (slotId) {
    let sectionToolId = resolved.tool_id;
    if (typeof claim.tool_id === "string") {
      if (claim.tool_id) {
        sectionToolId = claim.tool_id;
      }
    }
    return result({
      role: "ranked",
      slot_id: slotId,
      tool_id: sectionToolId,
      rule: shapeSlot ? "product-shape" : "section",
      preference,
    });
  }
  if (resolved.match === "abstain") {
    return result({
      role: "unsorted",
      rule: "abstain",
      preference,
    });
  }
  if (resolved.match === "ambiguous") {
    return result({
      role: "unsorted",
      rule: "ambiguous",
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
 * Publisher headings that safely name one ranked slot. Bare Hardware/Software
 * stay out — they hold mixed gear and apps.
 */
const SECTION_SYNONYMS = new Map([
  ["laptop", "computer"],
  ["laptops", "computer"],
  ["computers", "computer"],
  ["workstation", "computer"],
  ["workstations", "computer"],
  ["editors", "editor-ide"],
  ["editor", "editor-ide"],
  ["ides", "editor-ide"],
  ["ide", "editor-ide"],
  ["browsers", "browser"],
  ["browser", "browser"],
  ["phones", "phone"],
  ["phone", "phone"],
  ["keyboards", "keyboard"],
  ["displays", "display"],
  ["monitors", "display"],
  ["monitor", "display"],
  ["tv", "display"],
  ["tvs", "display"],
  ["mice", "mouse"],
  ["mouse", "mouse"],
  ["trackpad", "mouse"],
  ["trackpads", "mouse"],
  ["chairs", "chair"],
  ["chair", "chair"],
  ["tablet", "tablet"],
  ["tablets", "tablet"],
  ["ipad", "tablet"],
  ["ipads", "tablet"],
  ["health", "health-fitness"],
  ["fitness", "health-fitness"],
  ["weight loss", "health-fitness"],
  ["watch", "watch"],
  ["watches", "watch"],
  ["password", "password-manager"],
  ["passwords", "password-manager"],
  ["headphones", "headphones"],
  ["earphones", "headphones"],
  ["earphone", "headphones"],
  ["containers", "containers"],
  ["docker", "containers"],
  ["launcher", "launcher"],
  ["launchers", "launcher"],
  ["creative", "design"],
  ["photo", "design"],
  ["terminal", "terminal-emulator"],
  ["terminals", "terminal-emulator"],
  ["vpn", "vpn"],
  ["vpns", "vpn"],
  ["chat", "chat"],
  ["messaging", "chat"],
  ["api", "api-client"],
  ["apis", "api-client"],
  ["database client", "db-client"],
  ["db client", "db-client"],
  ["mount", "mount"],
  ["mounts", "mount"],
  ["storage", "storage"],
  ["ssd", "storage"],
]);

/**
 * Ranked slot from the deepest unique section-path segment (name, id, or synonym).
 * Bare umbrella headings such as Hardware never map to a product slot.
 * @param {string} sectionPath
 * @param {object[]} [categories]
 * @returns {string|null}
 */
export function sectionSlotId(sectionPath, categories) {
  const pathText = fieldString(sectionPath);
  const segments = pathText
    .split("/")
    .map((part) => comparisonLabel(part))
    .filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  const ranked = asArray(categories).filter((slot) => {
    if (!slot) {
      return false;
    }
    if (slot.role !== "ranked") {
      return false;
    }
    if (!slot.id) {
      return false;
    }
    return true;
  });
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const synonymId = SECTION_SYNONYMS.get(segment);
    if (synonymId) {
      const synonymSlot = ranked.find((slot) => slot.id === synonymId);
      if (synonymSlot) {
        return synonymSlot.id;
      }
    }
    const matched = ranked.filter((slot) => {
      const slotName = comparisonLabel(fieldString(slot.name));
      const id = comparisonLabel(slot.id);
      if (segment === slotName) {
        return true;
      }
      return segment === id;
    });
    if (matched.length === 1) {
      return matched[0].id;
    }
  }
  return null;
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

  for (const member of asArray(members)) {
    for (const tool of asArray(member.tools)) {
      const name = fieldString(tool.name);
      if (/\band\b/i.test(name)) {
        compounds.push({ origin: member.origin, name });
      } else if (/\bwith\b/i.test(name)) {
        compounds.push({ origin: member.origin, name });
      }
      const storedId = fieldString(tool.tool_id);
      const classified = classifyClaim(
        {
          name,
          label: name,
          context: fieldString(tool.context),
          section: fieldString(tool.section),
          section_path: fieldString(tool.section_path),
          href: fieldString(tool.href),
          kind: fieldString(tool.kind) || "product",
          tool_id: storedId,
        },
        catalog,
      );
      const row = {
        origin: member.origin,
        name,
        stored_id: storedId,
        tool_id: classified.tool_id,
        slot_id: classified.slot_id,
        rule: classified.rule,
      };
      if (classified.role === "ranked") {
        if (storedId.startsWith("observed:")) {
          if (classified.tool_id) {
            merged.push(row);
          }
        }
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
  let safeCatalog = {};
  if (catalog != null) {
    safeCatalog = catalog;
  }
  return contentFingerprint(
    JSON.stringify({
      categories: asArray(safeCatalog.categories),
      tools: asArray(safeCatalog.tools),
      aliases: asArray(safeCatalog.aliases),
    }),
  );
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasExplicitPreference(text) {
  const value = String(text).toLowerCase();
  if (value.includes("favourite")) {
    return true;
  }
  if (value.includes("favorite")) {
    return true;
  }
  if (value.includes("preferred")) {
    return true;
  }
  if (value.includes("prefers")) {
    return true;
  }
  return /\bprefer\b/.test(value);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
const REJECTED_FRAGMENT_LABELS = new Set([
  "todo",
  "work computer",
  "gaming computer",
]);

const MONTH_PREFIXES = new Set([
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
]);

function isRejectedFragment(name) {
  const key = comparisonLabel(name);
  if (REJECTED_FRAGMENT_LABELS.has(key)) {
    return true;
  }
  const monthMatch = /^([a-z]+)\s+(\d{4})$/i.exec(key);
  if (monthMatch) {
    if (MONTH_PREFIXES.has(monthMatch[1].toLowerCase())) {
      return true;
    }
  }
  return /^\d{4}$/.test(key);
}

/**
 * A part of a computer or keyboard, not a competing product.
 * A computer whose name merely mentions its memory stays a computer.
 * @param {string} name
 * @returns {string}
 */
function componentKind(name) {
  const text = String(name);
  if (/\bmac\b/i.test(text)) {
    return "";
  }
  if (/\blaptop\b/i.test(text)) {
    return "";
  }
  if (/\bmini pc\b/i.test(text)) {
    return "";
  }
  if (/\bnuc\b/i.test(text)) {
    return "";
  }
  if (/\bcomputer\b/i.test(text)) {
    return "";
  }
  if (/\bddr/i.test(text)) {
    return "computer";
  }
  if (/\bram\b/i.test(text)) {
    return "computer";
  }
  if (/\bmemory\b/i.test(text)) {
    return "computer";
  }
  if (/^amd ryzen\b/i.test(text)) {
    return "computer";
  }
  if (/^intel\b/i.test(text)) {
    return "computer";
  }
  if (/\bgraphics card\b/i.test(text)) {
    return "computer";
  }
  if (/\bradeon\b/i.test(text)) {
    return "computer";
  }
  if (/\bgeforce\b/i.test(text)) {
    return "computer";
  }
  if (/\bgpu\b/i.test(text)) {
    return "computer";
  }
  if (/\bkey switches\b/i.test(text)) {
    return "keyboard";
  }
  if (/\bkailh\b/i.test(text)) {
    return "keyboard";
  }
  return "";
}

/**
 * Clear product nouns that must not inherit an umbrella section slot
 * (Workstation / Computers / Hardware).
 * @param {unknown} name
 * @returns {string|null}
 */
export function productShapeSlotId(name) {
  const text = String(name || "");
  if (!text) {
    return null;
  }
  if (/\btrackpad\b/i.test(text)) {
    return "mouse";
  }
  if (/\b(aeron|chair)\b/i.test(text)) {
    return "chair";
  }
  if (/\bipad\b/i.test(text)) {
    return "tablet";
  }
  if (/\biphone\b/i.test(text)) {
    return "phone";
  }
  if (/\b(tv|monitor)\b/i.test(text)) {
    // Keep short panel names; reject "monitor … second screen off to the side…" prose.
    if (text.trim().split(/\s+/).length <= 6) {
      return "display";
    }
  }
  // Dell / ASUS / LG / Samsung panel SKUs with an inch size (e.g. Dell S3425DW 34").
  if (
    /\b(?:dell|asus|lg|samsung)\s+[a-z]?\d{3,}[a-z0-9-]*\b/i.test(text) &&
    /\d+(?:\.\d+)?\s*(?:inch|in|["”])/i.test(text)
  ) {
    return "display";
  }
  return null;
}

/**
 * Catalog rows for well-known device lines when aliases already cover them.
 * @param {string} name
 * @param {{ tools: Map<string, object> }} indexed
 * @returns {object|null}
 */
function matchProductShapeTool(name, indexed) {
  const text = String(name);
  /** @type {Array<[RegExp, string]>} */
  const patterns = [
    [/\bmagic\s+trackpad\b/i, "apple-magic-trackpad"],
    [/\bherman\s+miller\s+aeron\b/i, "aeron"],
    [/\bipad\s+air\s*4\b/i, "ipad-air-4"],
    [/\biphone\s+13\s*mini\b/i, "iphone-13-mini"],
    [/\biphone\s+17\s*pro\b(?!\s*max)/i, "iphone-17-pro"],
    [/samsung\s+55(?:\s*"|-?inch)?\s*tv\b/i, "samsung-55-tv"],
    [/\bdell\s+s3425dw\b/i, "dell-s3425dw"],
  ];
  for (const [pattern, toolId] of patterns) {
    if (!pattern.test(text)) {
      continue;
    }
    const tool = indexed.tools.get(toolId);
    if (tool) {
      return tool;
    }
  }
  return null;
}

/**
 * Mac mini lines with chip/RAM tails (e.g. "mac mini m4") map to Computers.
 * Rejects mashups that also name other gear (keyboard, display, ASUS, …).
 * @param {string} name
 * @param {{ tools: Map<string, object> }} indexed
 * @returns {object|null}
 */
function matchMacMiniFamily(name, indexed) {
  const text = String(name);
  if (!/\bmac\s*mini\b/i.test(text)) {
    return null;
  }
  if (
    /\b(asus|dell|samsung|keyboard|mouse|trackpad|display|monitor|magic\s+keyboard|mx\s+master|logitech)\b/i.test(
      text,
    )
  ) {
    return null;
  }
  const fromCatalog = indexed.tools.get("mac-mini");
  if (fromCatalog) {
    return fromCatalog;
  }
  return {
    id: "mac-mini",
    name: "Mac mini",
    category_id: "computer",
    kind: "hardware",
  };
}

/**
 * Freeform MacBook lines map into the Computers slot with a stable tool id.
 * @param {string} name
 * @param {{ tools: Map<string, object> }} indexed
 * @returns {object|null}
 */
function matchMacBookFamily(name, indexed) {
  const text = String(name);
  if (/\bmacbook\s+air\b/i.test(text)) {
    return macbookToolRecord("macbook-air", indexed);
  }
  if (!/\bmacbook\s+pro\b/i.test(text)) {
    return null;
  }
  return macbookToolRecord(macbookProSizeToolId(text), indexed);
}

/**
 * @param {string} toolId
 * @param {{ tools: Map<string, object> }} indexed
 * @returns {object}
 */
function macbookToolRecord(toolId, indexed) {
  const fromCatalog = indexed.tools.get(toolId);
  if (fromCatalog) {
    return fromCatalog;
  }
  const fallbackNames = {
    "macbook-air": "MacBook Air",
    "macbook-pro-14": "MacBook Pro 14-inch",
    "macbook-pro-16": "MacBook Pro 16-inch",
    "macbook-pro": "MacBook Pro",
  };
  return {
    id: toolId,
    name: fallbackNames[toolId],
    category_id: "computer",
    kind: "hardware",
  };
}

/**
 * Maps size cues onto a stable MacBook Pro catalog id.
 * @param {string} text
 * @returns {string}
 */
function macbookProSizeToolId(text) {
  if (/\b14-inch\b/i.test(text)) {
    return "macbook-pro-14";
  }
  if (/\b14"/.test(text)) {
    return "macbook-pro-14";
  }
  if (/\bpro\s+14\b/i.test(text)) {
    return "macbook-pro-14";
  }
  if (/\b16-inch\b/i.test(text)) {
    return "macbook-pro-16";
  }
  if (/\b16"/.test(text)) {
    return "macbook-pro-16";
  }
  if (/\bpro\s+16\b/i.test(text)) {
    return "macbook-pro-16";
  }
  return "macbook-pro";
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isBrowserExtension(name) {
  return /\bublock\b/i.test(name);
}

/**
 * VS Code extension / IntelliSense feature names stay detail, not ranked gear.
 * @type {ReadonlySet<string>}
 */
const IDE_EXTENSION_OR_FEATURE_LABELS = new Set([
  "intellisense",
  "intellicode",
  "better comments",
  "color highlight",
  "code spell checker",
  "import cost",
  "path intellisense",
  "npm intellisense",
  "even better toml",
  "presentation assistant",
  "gremlins tracker",
  "markdown all in one",
  "vscode-styled-components",
  "vscode styled components",
  "react-bootstrap snippets",
  "react bootstrap snippets",
]);

/**
 * VS Code extension / IntelliSense feature names stay detail, not ranked gear.
 * @param {string} name
 * @returns {boolean}
 */
function isIdeExtensionOrFeature(name) {
  return IDE_EXTENSION_OR_FEATURE_LABELS.has(comparisonLabel(name));
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
  let isStoreHost = false;
  if (host === "play.google.com") {
    isStoreHost = true;
  } else if (host === "apps.apple.com") {
    isStoreHost = true;
  }
  if (isStoreHost) {
    if (/\bkindle\b/i.test(name)) {
      if (!/paperwhite/i.test(name)) {
        const kindleApp = indexed.tools.get("kindle-app");
        if (kindleApp) {
          return kindleApp;
        }
        return null;
      }
    }
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
    if (!tool.website) {
      continue;
    }
    if (tool.id === "kindle-app") {
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
      if (toolUrl.pathname.length > 1) {
        if (claimUrl.pathname.startsWith(toolUrl.pathname)) {
          matches.push(tool);
        }
      }
      continue;
    }
    matches.push(tool);
  }
  if (matches.length !== 1) {
    return null;
  }
  if (!nameAgrees(name, matches[0])) {
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
  // Claim names that reach URL matching already passed reportable checks, so
  // left is non-empty. Empty tool names refuse the agreement.
  if (!right) {
    return false;
  }
  if (left === right) {
    return true;
  }
  if (left.includes(right)) {
    return true;
  }
  return right.includes(left);
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
  /** @type {object|null|undefined} */
  let slot = null;
  if (slotId) {
    slot = indexed.slots.get(slotId);
  }
  if (!slot) {
    return result({
      role: "unsorted",
      tool_id: tool.id,
      rule: "abstain",
      preference,
    });
  }
  if (slot.role === "retired") {
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
  for (const rule of asArray(tool.slot_rules)) {
    const needles = asArray(rule.require_context);
    if (needles.some((needle) => text.includes(String(needle).toLowerCase()))) {
      return rule.slot_id;
    }
  }
  if (tool.category_id) {
    return tool.category_id;
  }
  return null;
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
  // Callers always pass a concrete object (possibly empty).
  for (const tool of asArray(catalog.tools)) {
    if (!tool) {
      continue;
    }
    if (tool.id) {
      tools.set(tool.id, tool);
    }
  }
  for (const slot of asArray(catalog.categories)) {
    if (!slot) {
      continue;
    }
    if (slot.id) {
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

/**
 * Section path preferred over a bare section heading.
 * @param {object} claim
 * @returns {string}
 */
function claimSectionHint(claim) {
  const fromPath = fieldString(claim.section_path);
  if (fromPath) {
    return fromPath;
  }
  return fieldString(claim.section);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function fieldString(value) {
  if (typeof value === "string") {
    return value;
  }
  return "";
}

/**
 * @param {object} claim
 * @returns {string}
 */
function claimName(claim) {
  const fromName = fieldString(claim.name);
  if (fromName) {
    return fromName;
  }
  return fieldString(claim.label);
}

/**
 * @param {object} claim
 * @returns {string}
 */
function claimContextText(claim) {
  return [
    fieldString(claim.section),
    fieldString(claim.section_path),
    fieldString(claim.context),
    fieldString(claim.excerpt),
  ].join(" ");
}

/**
 * @param {unknown} value
 * @returns {any[]}
 */
function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

/**
 * Shared chrome/section/non-product rejection used before and after peels.
 * @param {string} name
 * @param {boolean} preference
 * @returns {Classification|null}
 */
function nonProductClassification(name, preference) {
  if (isUsesSectionLabel(name)) {
    return result({
      role: "rejected",
      rule: "non-product",
      preference,
    });
  }
  if (isSentenceShapedLabel(name)) {
    return result({
      role: "rejected",
      rule: "non-product",
      preference,
    });
  }
  if (isArticleShapedLabel(name)) {
    return result({
      role: "rejected",
      rule: "non-product",
      preference,
    });
  }
  if (isNonComparableUseLabel(name)) {
    return result({
      role: "rejected",
      rule: "non-product",
      preference,
    });
  }
  if (!isReportableUseLabel(name)) {
    return result({
      role: "rejected",
      rule: "non-product",
      preference,
    });
  }
  return null;
}
