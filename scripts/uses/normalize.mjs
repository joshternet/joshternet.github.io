/**
 * Goal & Constraints:
 * Normalize member-supplied labels for comparison and resolve curated aliases
 * with contextual guards. Never guess popular tools from ambiguous words.
 */

import { createHash } from "node:crypto";

import {
  EXTRACTOR_VERSION,
  MAX_LABEL_CHARS,
  TAXONOMY_VERSION,
} from "./constants.mjs";

/**
 * @typedef {object} AliasRule
 * @property {string} alias - Surface form (comparison label).
 * @property {string} tool_id - Canonical tool id when matched.
 * @property {string[]} [require_context] - Substrings that must appear nearby.
 * @property {string[]} [forbid_context] - Substrings that veto the match.
 * @property {string[]} [require_section] - Section heading substrings.
 */

/**
 * @typedef {object} ToolRecord
 * @property {string} id
 * @property {string} name
 * @property {string} kind
 * @property {string} category_id
 * @property {string} [vendor]
 * @property {string[]} [aliases]
 * @property {string} [website]
 * @property {boolean} [retired]
 */

/**
 * Sanitizes a raw display label for storage (not HTML-escaped for UI).
 * @param {unknown} input - Member-supplied label.
 * @returns {string} Bounded sanitized label.
 */
export function sanitizeLabel(input) {
  if (typeof input !== "string" || !input) {
    return "";
  }
  const folded = input
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return folded.slice(0, MAX_LABEL_CHARS);
}

/**
 * Builds a case-folded comparison key for alias lookup.
 * @param {unknown} input - Label or alias.
 * @returns {string}
 */
export function comparisonLabel(input) {
  const sanitized = sanitizeLabel(input).replace(/^(?:observed:\s*)+/i, "");
  const label = sanitizeLabel(sanitized);
  if (!label) {
    return "";
  }
  return label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Indexes tools and alias rules for resolution.
 * @param {{ tools?: ToolRecord[], aliases?: AliasRule[] }} catalog
 * @returns {{ byId: Map<string, ToolRecord>, aliasRules: AliasRule[] }}
 */
export function indexCatalog(catalog) {
  /** @type {Map<string, ToolRecord>} */
  const byId = new Map();
  /** @type {AliasRule[]} */
  const aliasRules = [];

  for (const tool of catalog?.tools || []) {
    if (!tool || typeof tool.id !== "string" || !tool.id) {
      continue;
    }
    byId.set(tool.id, tool);
    for (const alias of tool.aliases || []) {
      const key = comparisonLabel(alias);
      if (key) {
        aliasRules.push({ alias: key, tool_id: tool.id });
      }
    }
    const nameKey = comparisonLabel(tool.name);
    if (nameKey) {
      aliasRules.push({ alias: nameKey, tool_id: tool.id });
    }
  }

  for (const rule of catalog?.aliases || []) {
    if (!rule || typeof rule.alias !== "string" || !rule.tool_id) {
      continue;
    }
    aliasRules.push({
      ...rule,
      alias: comparisonLabel(rule.alias),
    });
  }

  return { byId, aliasRules };
}

/**
 * Resolves a label to a tool id using curated aliases and context.
 * Ambiguous matches abstain (return null) rather than guess.
 * @param {string} label - Display label.
 * @param {{ section?: string, excerpt?: string, catalog: { tools?: ToolRecord[], aliases?: AliasRule[] } }} options
 * @returns {{ tool_id: string|null, comparison: string, unresolved: boolean }}
 */
export function resolveToolLabel(label, options) {
  const comparison = comparisonLabel(label);
  if (!comparison) {
    return { tool_id: null, comparison: "", unresolved: true, match: "none" };
  }

  const { aliasRules } = indexCatalog(options.catalog || {});
  const section = comparisonLabel(options.section || "");
  const excerpt = comparisonLabel(options.excerpt || "");
  const context = `${section} ${excerpt}`.trim();

  const candidates = aliasRules.filter(
    (rule) => rule.alias && rule.alias === comparison,
  );

  if (candidates.length === 0) {
    return { tool_id: null, comparison, unresolved: true, match: "none" };
  }

  const scoped = candidates.filter(
    (rule) =>
      (Array.isArray(rule.require_context) &&
        rule.require_context.length > 0) ||
      (Array.isArray(rule.forbid_context) && rule.forbid_context.length > 0) ||
      (Array.isArray(rule.require_section) && rule.require_section.length > 0),
  );
  const rulesToApply = scoped.length > 0 ? scoped : candidates;

  /** @type {string[]} */
  const matches = [];

  for (const rule of rulesToApply) {
    if (
      Array.isArray(rule.require_context) &&
      rule.require_context.length > 0
    ) {
      const ok = rule.require_context.some((needle) =>
        context.includes(comparisonLabel(needle)),
      );
      if (!ok) {
        continue;
      }
    }
    if (
      Array.isArray(rule.forbid_context) &&
      rule.forbid_context.some((needle) =>
        context.includes(comparisonLabel(needle)),
      )
    ) {
      continue;
    }
    if (
      Array.isArray(rule.require_section) &&
      rule.require_section.length > 0
    ) {
      const ok = rule.require_section.some((needle) =>
        section.includes(comparisonLabel(needle)),
      );
      if (!ok) {
        continue;
      }
    }
    if (!matches.includes(rule.tool_id)) {
      matches.push(rule.tool_id);
    }
  }

  if (matches.length === 1) {
    return {
      tool_id: matches[0],
      comparison,
      unresolved: false,
      match: "unique",
    };
  }

  if (matches.length > 1) {
    return { tool_id: null, comparison, unresolved: true, match: "ambiguous" };
  }

  // A catalog alias exists, but context guards rejected it. Do not invent a
  // second tool id for that surface form.
  return { tool_id: null, comparison, unresolved: true, match: "abstain" };
}

/**
 * Observed ids that repeat a catalog id already current for the same member.
 * A similar name that does not resolve is left alone.
 * @param {Array<{ tool_id?: string, name?: string, status?: string, section?: string, context?: string }>} tools
 * @param {{ tools?: ToolRecord[], aliases?: AliasRule[] }} catalog
 * @param {Iterable<string>} [alsoPresent] - Canonical ids in the new evidence.
 * @returns {Array<{ observed_id: string, canonical_id: string, name: string }>}
 */
export function supersededObservedIds(tools, catalog, alsoPresent) {
  const current = (tools || []).filter(
    (tool) => tool && (!tool.status || tool.status === "current"),
  );
  /** @type {Set<string>} */
  const ids = new Set(current.map((tool) => String(tool.tool_id || "")));
  for (const id of alsoPresent || []) {
    if (id) {
      ids.add(String(id));
    }
  }
  /** @type {Array<{ observed_id: string, canonical_id: string, name: string }>} */
  const pairs = [];
  for (const tool of current) {
    const observedId = String(tool.tool_id || "");
    if (!observedId.startsWith("observed:")) {
      continue;
    }
    const name = tool.name || "";
    const resolved = resolveToolLabel(name, {
      section: tool.section || "",
      excerpt: tool.context || "",
      catalog,
    });
    if (resolved.match !== "unique") {
      continue;
    }
    if (!ids.has(resolved.tool_id)) {
      continue;
    }
    pairs.push({
      observed_id: observedId,
      canonical_id: resolved.tool_id,
      name,
    });
  }
  return pairs;
}

const GENERIC_GEAR =
  /\b(monitor|desk|chair|keyboard|mouse|computer|laptop|stand|screen|tv|light)\b/i;
const GEAR_DESCRIPTORS = new Set([
  "sit",
  "stand",
  "second",
  "external",
  "main",
  "mesh",
  "low",
  "the",
  "and",
  "for",
  "with",
]);

/**
 * Returns the label unchanged apart from sanitizing whitespace.
 * Descriptions are stored beside the name, not cut out of it.
 * @param {unknown} label
 * @returns {string}
 */
export function productNameFromLabel(label) {
  return sanitizeLabel(label);
}

/**
 * True when a phrase is a product or project name rather than a context tail.
 * @param {string} part
 * @returns {boolean}
 */
export function isNamedEntity(part) {
  const text = String(part || "").trim();
  if (text.length < 2) {
    return false;
  }
  if (!/[A-Za-z]/.test(text)) {
    return false;
  }
  return /[A-Z0-9]/.test(text) || /\.[a-z0-9]{2,}\b/i.test(text);
}

/**
 * Pulls a qualifier (`on …`, `for …`, or a clause after a comma or dash)
 * off a structural name. Hyphens inside a name stay put.
 * @param {unknown} raw
 * @returns {{ name: string, context: string }}
 */
export function separateNameContext(raw) {
  let name = sanitizeLabel(raw);
  let context = "";
  if (!name) {
    return { name: "", context: "" };
  }

  const dashed = splitDashOrColon(name);
  if (dashed) {
    name = dashed.name;
    context = dashed.context;
  }
  const comma = splitCommaTail(name);
  if (comma) {
    name = comma.name;
    context = [comma.context, context].filter(Boolean).join(". ");
  }

  const qualified = name.match(/^(.+?)\s+(on|for)\s+(.+)$/i);
  if (
    qualified &&
    isNamedEntity(qualified[1]) &&
    qualified[1].split(/\s+/).length <= 4 &&
    !/\b(with|and)\b/i.test(qualified[1])
  ) {
    const qualifier = sanitizeLabel(`${qualified[2]} ${qualified[3]}`);
    context = context ? `${qualifier}. ${context}` : qualifier;
    name = sanitizeLabel(qualified[1]);
  }

  return { name, context };
}

/**
 * Splits a heading into named entities joined by "with" or "and".
 * Leaves the name whole when any side is not itself a name.
 * @param {string} name
 * @returns {string[]}
 */
export function splitCompoundName(name) {
  const text = sanitizeLabel(name);
  if (!text) {
    return [];
  }
  const clauses = text
    .split(/,\s+/)
    .map((part) => part.replace(/\.+$/, "").trim())
    .filter(Boolean);
  if (
    clauses.length === 2 &&
    parenthesesBalanced(clauses[0]) &&
    clauses.every((part) => isNamedEntity(part)) &&
    !isShortQualifier(clauses[1])
  ) {
    return clauses;
  }

  const parts = text
    .split(/\s+(?:with|and)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2 || !parts.every((part) => isNamedEntity(part))) {
    return [text];
  }
  return parts;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function parenthesesBalanced(value) {
  const open = (value.match(/\(/g) || []).length;
  const close = (value.match(/\)/g) || []).length;
  return open === close;
}

/**
 * @param {string} name
 * @returns {{ name: string, context: string }|null}
 */
function splitDashOrColon(name) {
  const dash = name.match(/^(.+?)\s*[—–]\s*(.+)$/);
  if (dash && parenthesesBalanced(dash[1])) {
    return {
      name: sanitizeLabel(dash[1]),
      context: sanitizeLabel(dash[2]),
    };
  }
  const colon = name.match(/^(.+?):\s+(.+)$/);
  if (colon && parenthesesBalanced(colon[1])) {
    return {
      name: sanitizeLabel(colon[1]),
      context: sanitizeLabel(colon[2]),
    };
  }
  return null;
}

/**
 * Peels a comma tail when it is a sentence or a short qualifier.
 * A comma inside parentheses stays in the name.
 * @param {string} name
 * @returns {{ name: string, context: string }|null}
 */
function splitCommaTail(name) {
  const comma = name.match(/^(.+?),\s+(.+)$/);
  if (!comma || !parenthesesBalanced(comma[1])) {
    return null;
  }
  if (isShortQualifier(comma[2]) || /^[a-z]/.test(comma[2])) {
    return {
      name: sanitizeLabel(comma[1]),
      context: sanitizeLabel(comma[2]),
    };
  }
  return null;
}

/**
 * @param {string} part
 * @returns {boolean}
 */
function isShortQualifier(part) {
  return (
    /\b(layout|edition|version|colour|color)\b/i.test(part) &&
    part.split(/\s+/).length <= 4
  );
}

/**
 * Classifies a structural name. Section echoes and credits are not products.
 * @param {string} name
 * @param {{ attribution?: boolean }} [options]
 * @returns {'product'|'equipment'|'practice'|'unresolved'}
 */
export function classifyUseKind(name, options = {}) {
  if (options.attribution) {
    return "unresolved";
  }
  const text = sanitizeLabel(name);
  if (!text) {
    return "unresolved";
  }
  if (/^(using|creating|building|choose)\b/i.test(text)) {
    return "practice";
  }
  if (GENERIC_GEAR.test(text)) {
    const brands = text.match(/\b[A-Z][A-Za-z0-9]{2,}\b/g) || [];
    const specific = brands.filter(
      (word) => !GEAR_DESCRIPTORS.has(word.toLowerCase()),
    );
    if (specific.length === 0) {
      return "equipment";
    }
  }
  return "product";
}

/**
 * True when the label is a site path such as `/cv` or `/now/`.
 * @param {unknown} label
 * @returns {boolean}
 */
export function isSitePathLabel(label) {
  return /^\/\S*$/.test(String(label || "").trim());
}

/**
 * True when a label is a tool or piece of gear a publisher says they use.
 * Site paths, nav words, and leftover sentences are not declarations.
 * @param {unknown} label
 * @returns {boolean}
 */
export function isReportableUseLabel(label) {
  const name = productNameFromLabel(label);
  if (!name || name.length < 2) {
    return false;
  }
  if (
    isSitePathLabel(name) ||
    name.startsWith("#") ||
    name.startsWith("observed:")
  ) {
    return false;
  }
  if (/^\(?\d{4}\b/.test(name) && name.split(" ").length <= 2) {
    return false;
  }
  if (
    /^(home|about|contact|skip to|cookie|privacy|terms|menu|search|read more)$/i.test(
      name,
    )
  ) {
    return false;
  }
  if (name.split(/\s+/).length > 12 || name.length > 80) {
    return false;
  }
  return true;
}

/**
 * Visitor-facing tool name. Never includes the internal `observed:` prefix.
 * @param {unknown} name - Stored display name.
 * @param {unknown} toolId - Stable tool id.
 * @returns {string}
 */
export function publicToolName(name, toolId) {
  const cleaned = productNameFromLabel(name);
  if (cleaned && isReportableUseLabel(cleaned)) {
    return cleaned;
  }
  const id = String(toolId || "");
  if (id.startsWith("observed:")) {
    const fromId = productNameFromLabel(
      id.slice("observed:".length).replace(/-/g, " "),
    );
    if (isReportableUseLabel(fromId)) {
      return fromId;
    }
  }
  return cleaned && !cleaned.startsWith("observed:")
    ? cleaned
    : id.replace(/^observed:/, "");
}

/**
 * Stable id for a publisher-listed tool that is not in the curated catalog.
 * @param {string} comparison - Comparison label from {@link comparisonLabel}.
 * @returns {string} `observed:` id, or empty when the label cannot be slugged.
 */
export function observedToolId(comparison) {
  const slug = String(comparison || "")
    .trim()
    .replace(/[\s.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) {
    return "";
  }

  return `observed:${slug}`;
}

/**
 * Stable content fingerprint for evidence/check records.
 * @param {string} input - Normalized page body or evidence payload.
 * @returns {string} `sha256:<hex>` digest.
 */
export function contentFingerprint(input) {
  const body = typeof input === "string" ? input : "";
  const digest = createHash("sha256").update(body, "utf8").digest("hex");
  return `sha256:${digest}`;
}

/**
 * Deterministic event id from semantic payload (not timestamps alone).
 * @param {Record<string, unknown>} payload - Normalized semantic fields.
 * @returns {string}
 */
export function deterministicEventId(payload) {
  const stable = stableStringify(payload);
  return contentFingerprint(
    `uses-event:v${EXTRACTOR_VERSION}:t${TAXONOMY_VERSION}:${stable}`,
  );
}

/**
 * Lexicographically stable JSON stringify for hashing.
 * @param {unknown} value
 * @returns {string}
 */
export function stableStringify(value) {
  return JSON.stringify(sortKeys(value));
}

/**
 * Recursively sorts object keys.
 * @param {unknown} value
 * @returns {unknown}
 */
function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(/** @type {Record<string, unknown>} */ (value)[key]);
    }
    return out;
  }
  return value;
}
