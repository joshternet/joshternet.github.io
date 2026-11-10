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
    if (tool.retired) {
      continue;
    }
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
 * True when a phrase reads as a leftover sentence, not a product name.
 * @param {unknown} label
 * @returns {boolean}
 */
export function isSentenceShapedLabel(label) {
  const text = sanitizeLabel(label);
  if (!text) {
    return false;
  }
  if (/^(and|so|but|also|yes|well|oh|anyway|besides)\b/i.test(text)) {
    return true;
  }
  if (/^i\s+(have|use|run|listen|am|was)\b/i.test(text)) {
    return true;
  }
  if (/^my\s+\S+\s+is\b/i.test(text)) {
    return true;
  }
  if (
    /^(i|we|my|you|they)\s+\S+/i.test(text) &&
    /\b(is|are|have|has|use|uses|used|run|runs|listen|it's|its)\b/i.test(text)
  ) {
    return true;
  }
  if (
    text.split(/\s+/).length >= 5 &&
    /\b(it's|occasionally|useful|operating systems?|favorite|probably)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  if (
    /\b(github\s+)?copilot\b/i.test(text) &&
    /\b(and yes|i have|occasionally|useful)\b/i.test(text)
  ) {
    return true;
  }
  if (/\.{2,}|…/.test(text) && text.split(/\s+/).length >= 4) {
    return true;
  }
  if (
    text.split(/\s+/).length >= 5 &&
    /\b(user-replaceable|windows-only|tutorials?|explanations?)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

/**
 * True when a label reads as a blog essay or listicle title, not gear.
 * @param {unknown} label
 * @returns {boolean}
 */
export function isArticleShapedLabel(label) {
  const text = sanitizeLabel(label);
  if (!text) {
    return false;
  }
  if (
    /^(why|how|getting|fixing|lets|let's)\b/i.test(text) &&
    text.split(/\s+/).length >= 3
  ) {
    return true;
  }
  if (/^top\s+\d+\b/i.test(text)) {
    return true;
  }
  if (
    /^\d+\s+(lessons?|books?|tips?|ways?|things?|newsletters?)\b/i.test(text)
  ) {
    return true;
  }
  if (/\blessons?\s+i\s+learned\b/i.test(text)) {
    return true;
  }
  if (/\bvs\.?\b/i.test(text) && text.split(/\s+/).length >= 3) {
    return true;
  }
  if (
    /^the\s+(week|highs|power|moon|lows)\b/i.test(text) ||
    /\b(highs\s*&\s*lows|turned into a)\b/i.test(text)
  ) {
    return true;
  }
  if (
    text.split(/\s+/).length >= 7 &&
    /\b(meetings?|attention|comfortable|stepped|newsletters?)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

/**
 * IDE extensions, language features, frameworks, and page chrome that are
 * never comparable Uses products.
 * @type {ReadonlySet<string>}
 */
const NON_COMPARABLE_PRODUCT_LABELS = new Set([
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
  "vscode-styled-components",
  "vscode styled components",
  "react-bootstrap snippets",
  "react bootstrap snippets",
  "markdown all in one",
  "styled components",
  "storybook",
  "react kindling",
  "bootstrap",
  "bootswatch",
  "react-bootstrap",
  "react bootstrap",
  "mdx",
  "apollo graphql",
  "apollo",
  "firebase",
  "google firebase",
  "eslint",
  "prettier",
  "xcode command line tools",
  "react",
  "gatsby",
  "pwas",
  "pwa",
  "bullet journal",
  "focus",
  "markdown",
  "yaml",
  "npm",
  "aesthetic",
  "what i use",
  "what i use to do my work",
  "some software and tools i use regularly",
  "uses.tech",
  "uses tech",
  "here s a video about it",
  "heres a video about it",
  "item config note",
  "flaticon",
  "coolors",
  "pexels",
  "pixabay",
  "unsplash",
  "lotte gum",
  "clt pickleball",
  "1 on 1",
  "abby",
  "jelle",
  "agile",
  "articles",
  "book reviews",
  "developer basics",
  "engineering leadership",
  "journal",
  "journaling series",
  "lists",
  "meta",
  "monthly digest",
  "newsletter",
  "personal",
  "productivity",
  "retrospective",
  "review",
  "3 books",
  "todo",
  "gtd",
  "choose your own i o",
  "every single component is user-replaceable",
  "creating tutorials explanations that are windows-only",
  "gaming computer",
  "work computer",
  "3d printing",
]);

/**
 * True when the label is an extension, framework, or page-meta leftover.
 * @param {unknown} label
 * @returns {boolean}
 */
export function isNonComparableUseLabel(label) {
  const key = comparisonLabel(label);
  if (!key) {
    return false;
  }
  if (NON_COMPARABLE_PRODUCT_LABELS.has(key)) {
    return true;
  }
  const spaced = key.replace(/-/g, " ");
  if (spaced !== key && NON_COMPARABLE_PRODUCT_LABELS.has(spaced)) {
    return true;
  }
  const text = sanitizeLabel(label);
  if (/^see my homelab\b/i.test(text)) {
    return true;
  }
  if (/^i use material theme\b/i.test(text)) {
    return true;
  }
  if (
    /^(besides|choose|every|creating)\b/i.test(text) &&
    text.split(/\s+/).length >= 4
  ) {
    return true;
  }
  if (/:\s*$/.test(text) && text.split(/\s+/).length <= 4) {
    return true;
  }
  if (
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}$/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/\.\s+it(?:['\u2019]|\s)?s\s+\w+/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * Blog/theme widget headings whose list children are never Uses products.
 * @type {ReadonlySet<string>}
 */
const BLOG_CHROME_SECTION_LABELS = new Set([
  // Theme widgets only. "Productivity" / "Journal" stay valid Uses sections;
  // essay titles under them are filtered as article-shaped / non-comparable.
  "recent posts",
  "featured posts",
  "categories",
  "recent comments",
  "archives",
  "newsletter",
  "monthly digest",
]);

/**
 * True when a section path segment is blog chrome (sidebar widgets, digests).
 * @param {unknown} sectionPath
 * @returns {boolean}
 */
export function isBlogChromeSection(sectionPath) {
  const segments = String(sectionPath || "")
    .split(/\s*\/\s*/)
    .map((part) => comparisonLabel(part))
    .filter(Boolean);
  if (segments.some((segment) => BLOG_CHROME_SECTION_LABELS.has(segment))) {
    return true;
  }
  return segments.some(
    (segment) =>
      /^top\s+\d+\b/.test(segment) ||
      /^how to start\b/.test(segment) ||
      /^let\s*s talk\b/.test(segment),
  );
}

/**
 * Strips leading screen-size prefixes from hardware lines.
 * @param {unknown} raw
 * @returns {{ name: string, context: string }}
 * @example
 * peelHardwareSizePrefix('10.9-inch iPad Air')
 * // → { name: 'iPad Air', context: '' }
 */
export function peelHardwareSizePrefix(raw) {
  const text = sanitizeLabel(raw);
  if (!text) {
    return { name: "", context: "" };
  }
  const match = text.match(
    /^(\d+(?:\.\d+)?[\s-]*(?:inch|in|")|"?\d+(?:\.\d+)?")\s+(.+)$/i,
  );
  if (!match) {
    return { name: text, context: "" };
  }
  // Only peel sizes in front of named Apple lines. "65\" curved 4k TV" stays whole.
  if (
    !/^(ipad|iphone|apple\s+(?:ipad|iphone|watch)|macbook|mac\s+mini)\b/i.test(
      match[2],
    )
  ) {
    return { name: text, context: "" };
  }
  return {
    name: sanitizeLabel(match[2]),
    context: sanitizeLabel(match[1]),
  };
}

/**
 * Longest-first catalog alias/name keys for prefix peels.
 * @param {{ tools?: ToolRecord[] }} catalog
 * @returns {Array<{ key: string, name: string, tool_id: string }>}
 */
export function catalogPeelCandidates(catalog) {
  /** @type {Array<{ key: string, name: string, tool_id: string }>} */
  const candidates = [];
  for (const tool of catalog?.tools || []) {
    if (!tool?.id || tool.retired) {
      continue;
    }
    const labels = [tool.name, ...(tool.aliases || [])].filter(Boolean);
    for (const label of labels) {
      const key = comparisonLabel(label);
      if (!key || key.length < 2) {
        continue;
      }
      candidates.push({
        key,
        name: String(tool.name || label),
        tool_id: tool.id,
      });
    }
  }
  for (const rule of catalog?.aliases || []) {
    if (!rule || typeof rule.alias !== "string" || !rule.tool_id) {
      continue;
    }
    const key = comparisonLabel(rule.alias);
    if (!key || key.length < 2) {
      continue;
    }
    candidates.push({
      key,
      name: String(rule.alias),
      tool_id: String(rule.tool_id),
    });
  }
  candidates.sort(
    (a, b) => b.key.length - a.key.length || a.key.localeCompare(b.key),
  );
  return candidates;
}

/**
 * Peels a leading catalog product when the remainder looks like an aside.
 * @param {unknown} raw
 * @param {{ tools?: ToolRecord[] }} [catalog]
 * @returns {{ name: string, context: string, tool_id: string|null }}
 * @example
 * peelCatalogLead("1password password manager don't trust…", catalog)
 * // → { name: "1Password", context: "password manager don't trust…", tool_id: "1password" }
 */
export function peelCatalogLead(raw, catalog) {
  const sized = peelHardwareSizePrefix(raw);
  let text = sized.name;
  if (!text) {
    return { name: "", context: "", tool_id: null };
  }
  // Drop a leading "Apple " only for iPad/iPhone lines; Watch keeps "Apple".
  text = text.replace(/^apple\s+(?=(?:ipad|iphone)\b)/i, "");
  const comparison = comparisonLabel(text);
  const hasCatalog =
    Boolean(catalog?.tools?.length) || Boolean(catalog?.aliases?.length);
  if (!comparison || !hasCatalog) {
    return {
      name: text,
      context: sized.context,
      tool_id: null,
    };
  }
  const hit = catalogPeelCandidates(catalog).find(
    (candidate) =>
      comparison === candidate.key ||
      comparison.startsWith(`${candidate.key} `),
  );
  if (!hit) {
    return {
      name: text,
      context: sized.context,
      tool_id: null,
    };
  }
  // Exact catalog names keep publisher wording so resolveToolLabel can apply
  // context guards (and ambiguous aliases stay ambiguous).
  if (comparison === hit.key) {
    return {
      name: text,
      context: sized.context,
      tool_id: null,
    };
  }
  const remainder = comparison.slice(hit.key.length).trim();
  if (!remainderLooksLikeAside(remainder)) {
    return {
      name: text,
      context: sized.context,
      tool_id: null,
    };
  }
  const displayRemainder = sanitizeLabel(text).slice(hit.key.length).trim();
  return {
    name: hit.name,
    context: [sized.context, displayRemainder].filter(Boolean).join(". "),
    tool_id: hit.tool_id,
  };
}

/**
 * @param {string} remainder
 * @returns {boolean}
 */
function remainderLooksLikeAside(remainder) {
  // Exact catalog matches return before this runs; remainder is always non-empty.
  // Whitelist only. A broad "lowercase multi-word" rule peels mashups
  // (Mac mini + keyboard + mouse) and sibling SKUs (Things 3) incorrectly.
  if (
    /^(password|secrets?|launcher|browser|ide|ssh|primary|sometimes|mainly|usb(?:-c)?|replaced|blink|sucks|don\s*t|grandfathered|built-in|macos|hosting|dns|workers?|code|public|repos?|lts|always|mostly|using|atom|dark|workouts?|apps?|launches)\b/i.test(
      remainder,
    )
  ) {
    return true;
  }
  // Camera / photo usage tails ("iPhone 17 Pro main camera most of my holiday pics").
  if (
    /^(?:(?:main\s+)?cameras?|most|photos?|pics?|shots?|holiday|travel)\b/i.test(
      remainder,
    )
  ) {
    return true;
  }
  // Chip-only tails (e.g. "Mac mini M4") — not "M3 travel machine" prose.
  if (/^m\d+(?:\s+(?:pro|max|ultra))?$/i.test(remainder)) {
    return true;
  }
  if (/^\d+(\.\d+)?\s+[a-z]/.test(remainder)) {
    return true;
  }
  return false;
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
  if (isSentenceShapedLabel(text)) {
    return false;
  }
  return /[A-Z0-9]/.test(text) || /\.[a-z0-9]{2,}\b/i.test(text);
}

/**
 * Peels first-person declarative lead-ins so the product remains the name.
 * @param {unknown} raw
 * @returns {{ name: string, context: string }}
 * @example
 * peelDeclarativeLeadIn("My font is Fira Code, I use Material Theme")
 * // → { name: "Fira Code", context: "I use Material Theme" }
 */
export function peelDeclarativeLeadIn(raw) {
  let text = sanitizeLabel(raw);
  if (!text) {
    return { name: "", context: "" };
  }

  text = text.replace(/^(?:and\s+yes,?|so,?|also,?|well,?)\s+/i, "");
  const sized = peelHardwareSizePrefix(text);
  text = sized.name;
  const sizeContext = sized.context;

  /**
   * @param {string} name
   * @param {string} context
   * @returns {{ name: string, context: string }}
   */
  const withSize = (name, context) => ({
    name,
    context: [sizeContext, context].filter(Boolean).join(". "),
  });

  let match = text.match(/^my\s+[a-z0-9+#.-]+\s+is\s+(.+)$/i);
  if (match) {
    const rest = sanitizeLabel(match[1]);
    const comma = rest.match(/^(.+?),\s+(.+)$/);
    if (comma && isNamedEntity(comma[1])) {
      return withSize(sanitizeLabel(comma[1]), sanitizeLabel(comma[2]));
    }
    return withSize(rest, "");
  }

  match = text.match(/^i\s+(?:have|use|run|listen\s+to)\s+(?:the\s+)?(.+)$/i);
  if (match) {
    const rest = sanitizeLabel(match[1]);
    const cut = rest.match(/^(.+?)(?:,|\.{2,}|…)\s*(.+)$/);
    if (
      cut &&
      isNamedEntity(cut[1]) &&
      cut[1].split(/\s+/).length <= 6 &&
      !/^\d+\b/.test(cut[1])
    ) {
      return withSize(sanitizeLabel(cut[1]), sanitizeLabel(cut[2]));
    }
    return withSize(rest, "");
  }

  match = text.match(
    /^(?:i\s+(?:use|listen\s+to|run|host|play)|my\s+current\s+[a-z]+\s+is)\s+(?:the\s+)?(.+)$/i,
  );
  if (match) {
    return withSize(sanitizeLabel(match[1]), "");
  }

  return withSize(text, "");
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

  // Product. It’s affordable… → keep the product; marketing clause is context.
  // Run before comma peels so "affordable, rigid…" stays one aside clause.
  const itsAside = name.match(/^(.+?)\.\s+it(?:['\u2019]s|\s+is)\s+(.+)$/i);
  if (
    itsAside &&
    isNamedEntity(itsAside[1]) &&
    itsAside[1].split(/\s+/).length <= 8
  ) {
    const aside = sanitizeLabel(`It's ${itsAside[2]}`);
    context = context ? `${aside}. ${context}` : aside;
    name = sanitizeLabel(itsAside[1]);
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
  if (isSentenceShapedLabel(text)) {
    return [text];
  }
  const clauses = text
    .split(/,\s+/)
    .map((part) => part.replace(/\.+$/, "").trim())
    .filter(Boolean);
  if (
    clauses.length >= 2 &&
    clauses.length <= 6 &&
    clauses.every((part) => parenthesesBalanced(part) && isNamedEntity(part)) &&
    !clauses.slice(1).some((part) => isShortQualifier(part))
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

/** @type {Readonly<Record<string, number>>} */
const WORD_QUANTITIES = Object.freeze({
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
});

/**
 * Reads a stated machine quantity immediately before a product label.
 * Defaults to 1 when prose does not name a count.
 * @param {unknown} text
 * @param {unknown} label
 * @returns {number}
 * @example
 * quantityNearLabel("three FLSUN QQ-S Pro delta printers", "FLSUN QQ-S Pro")
 * // → 3
 */
export function quantityNearLabel(text, label) {
  const hay = sanitizeLabel(text);
  const key = comparisonLabel(label);
  if (!hay || !key) {
    return 1;
  }
  const escaped = key
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const pattern = new RegExp(
    `\\b(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+${escaped}\\b`,
    "i",
  );
  const match = pattern.exec(hay);
  if (!match) {
    return 1;
  }
  const raw = match[1].toLowerCase();
  if (Object.hasOwn(WORD_QUANTITIES, raw)) {
    return WORD_QUANTITIES[raw];
  }
  const asNumber = Number.parseInt(raw, 10);
  if (Number.isFinite(asNumber) && asNumber > 0 && asNumber <= 99) {
    return asNumber;
  }
  return 1;
}

/**
 * True when a label is an umbrella 3D-printer heading, not a named machine.
 * @param {unknown} name
 * @returns {boolean}
 */
export function is3dPrinterUmbrellaLabel(name) {
  return /^3d\s*print(?:ers?|ing)$/i.test(comparisonLabel(name));
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
  const dash = name.match(/^(.+?)\s*[—–·•]\s*(.+)$/);
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
 * Bare page/section titles that are never products (emoji-insensitive).
 * @type {ReadonlySet<string>}
 */
const NON_PRODUCT_SECTION_LABELS = new Set([
  "home",
  "about",
  "contact",
  "skip to",
  "cookie",
  "privacy",
  "terms",
  "menu",
  "search",
  "read more",
  "more",
  "photos",
  "resume",
  "software",
  "hardware",
  "uses",
  "historical",
  "setup",
  "tools",
  "gear",
  "stack",
  "tech",
  "technology",
  "home servers",
  "servers",
  "services",
  "apps",
  "applications",
  "devices",
  "peripherals",
  "content creation",
  "currently",
  "previously",
  "elsewhere",
  // Structure headings that introduce product lists (joshmuller Website 🌐).
  "website",
  "websites",
  "site",
  "sites",
  "blog",
  "blogs",
  "phone",
  "phones",
  "mobile",
  // Inline umbrella labels (`Plugins: GitLens…`), not products.
  "plugins",
  "extensions",
  // Publisher section umbrellas / colon labels.
  "accessories",
  "camera lens",
  "computer",
  "computers",
  "computer disk",
  "monitor",
  "monitors",
  "tablet",
  "tablets",
  "earphone",
  "earphones",
  "keyboard",
  "keyboards",
  "terminal",
  "terminals",
  "browser",
  "browsers",
  "os",
  "operating system",
  "operating systems",
  "hosting",
  "drawing",
  "gaming",
  "podcasting",
  "graphic design",
  "note taking",
  "code editor",
  "desk setup",
  "self hosted services",
  "self-hosted services",
  "server",
  "streaming",
  "extras",
  "main",
  "links",
  "projects",
  "watch",
  "watches",
]);

/**
 * True when a label is only a Uses page section title, not a product.
 * Emoji and punctuation are ignored (`Website 🌐` → website).
 * @param {unknown} label
 * @returns {boolean}
 */
export function isUsesSectionLabel(label) {
  const key = comparisonLabel(label);
  if (!key) {
    return false;
  }
  if (NON_PRODUCT_SECTION_LABELS.has(key)) {
    return true;
  }
  const spaced = key.replace(/-/g, " ");
  return spaced !== key && NON_PRODUCT_SECTION_LABELS.has(spaced);
}

/**
 * Operating-system product headings publishers use as section titles
 * (joshmuller Linux / MacOS / Windows). Still products for the OS slot.
 * @type {ReadonlySet<string>}
 */
const OPERATING_SYSTEM_PRODUCT_LABELS = new Set(["linux", "macos", "windows"]);

/**
 * True when a heading names a ranked operating system (not a bare Software
 * umbrella). Emoji are ignored (`Linux 🐧` → linux).
 * @param {unknown} label
 * @returns {boolean}
 */
export function isOperatingSystemProductLabel(label) {
  const key = comparisonLabel(label);
  return Boolean(key) && OPERATING_SYSTEM_PRODUCT_LABELS.has(key);
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
  if (isUsesSectionLabel(name)) {
    return false;
  }
  if (isSentenceShapedLabel(name)) {
    return false;
  }
  if (isArticleShapedLabel(name)) {
    return false;
  }
  if (isNonComparableUseLabel(name)) {
    return false;
  }
  if (/^\d+\s+operating systems?\b/i.test(name)) {
    return false;
  }
  if (
    /\boperating systems?\b/i.test(name) &&
    !/\b(macos|mac os|linux|windows|ubuntu|fedora|debian|chrome ?os)\b/i.test(
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
    // Sentence leftovers and section umbrellas must not become public labels
    // via the observed: slug (e.g. observed:my-font → "my font").
    if (
      cleaned &&
      (isSentenceShapedLabel(cleaned) || isUsesSectionLabel(cleaned))
    ) {
      return "";
    }
    const fromId = productNameFromLabel(
      id.slice("observed:".length).replace(/-/g, " "),
    );
    return isReportableUseLabel(fromId) ? fromId : "";
  }
  // Prefer a short catalog id over a non-reportable publisher leftover.
  if (id) {
    return id;
  }
  return cleaned && !cleaned.startsWith("observed:") ? cleaned : "";
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
