/**
 * Goal & Constraints:
 * Extract explicit usage declarations from HTML semantic sections. Prefer
 * structured lists; abstain on generic mentions, ads, and non-/uses pages.
 */

import {
  headingLabel,
  loadHtml,
  sectionPath,
  usesBlocks,
} from "../nlp/structured-html.mjs";
import { normalizeExtractedText } from "../nlp/text.mjs";

import { MAX_EXCERPT_CHARS, MAX_LABEL_CHARS } from "./constants.mjs";
import {
  classifyUseKind,
  isNamedEntity,
  isReportableUseLabel,
  sanitizeLabel,
  separateNameContext,
  splitCompoundName,
} from "./normalize.mjs";

/**
 * @typedef {object} RawUseItem
 * @property {string} label
 * @property {string} context
 * @property {'product'|'equipment'|'practice'|'unresolved'} kind
 * @property {string} status
 * @property {string} section
 * @property {string} section_path
 * @property {string} href
 * @property {number} list_depth
 * @property {string} excerpt
 * @property {string[]} use_case_hints
 */

/**
 * @typedef {object} ExtractResult
 * @property {'verified'|'verified_empty'|'uncertain'|'parse_error'} outcome
 * @property {RawUseItem[]} items
 * @property {string} content_hash_source
 */

const SKIP_TAG = /<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi;
const NAV_FOOTER = /<(nav|footer|header)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;

const STATUS_PATTERNS = [
  {
    status: "former",
    re: /\b(formerly(?:\s+used)?|used to use|no longer us(?:e|ing)|stopped using|replaced by|previous(?:ly)?|retired)\b/i,
  },
  {
    status: "considering",
    re: /\b(considering|evaluating|thinking about|might (?:try|use)|looking at)\b/i,
  },
  {
    status: "wishlist",
    re: /\b(wishlist|want(?:s|ed)? to (?:try|buy|get)|on my list|someday)\b/i,
  },
];

const NEGATION =
  /\b(i (?:do not|don't|dont) use|not using|never use|avoid(?:s|ing)?)\b/i;

const USE_CASE_HINTS = [
  { id: "programming", re: /\b(develop|code|program|ide|editor|terminal)\b/i },
  { id: "writing", re: /\b(writ(?:e|ing)|blog|notes?|markdown)\b/i },
  { id: "publishing", re: /\b(publish|host(?:ing)?|deploy|cms)\b/i },
  { id: "design", re: /\b(design|illustrat|figma|sketch)\b/i },
  { id: "photography", re: /\b(photo|camera|lens)\b/i },
  { id: "music-making", re: /\b(music|audio|synth|daw)\b/i },
  { id: "gaming", re: /\b(game|gaming|console)\b/i },
  { id: "self-hosting", re: /\b(self[- ]?host|homelab|nas)\b/i },
  { id: "privacy-security", re: /\b(privacy|security|vpn|password)\b/i },
  { id: "collaboration", re: /\b(chat|slack|discord|email|meet)\b/i },
  { id: "everyday-carry", re: /\b(edc|everyday carry|bag|wallet)\b/i },
];

/**
 * Strips non-content regions before extraction.
 * @param {string} html
 * @returns {string}
 */
export function stripNonContentHtml(html) {
  if (typeof html !== "string" || !html) {
    return "";
  }
  return html
    .replace(COMMENT, "")
    .replace(SKIP_TAG, "")
    .replace(NAV_FOOTER, " ");
}

/**
 * Infers tool status from surrounding text.
 * @param {string} text
 * @returns {string}
 */
export function inferStatus(text) {
  const value = String(text || "");
  if (NEGATION.test(value)) {
    return "unspecified";
  }
  for (const rule of STATUS_PATTERNS) {
    if (rule.re.test(value)) {
      return rule.status;
    }
  }
  return "current";
}

/**
 * Collects use-case hint ids from section/excerpt text.
 * @param {string} text
 * @returns {string[]}
 */
export function inferUseCaseHints(text) {
  const value = String(text || "");
  /** @type {string[]} */
  const ids = [];
  for (const hint of USE_CASE_HINTS) {
    if (hint.re.test(value) && !ids.includes(hint.id)) {
      ids.push(hint.id);
    }
  }
  return ids;
}

/**
 * Extracts list-item and definition-list labels under headings.
 * @param {string} html - Page HTML.
 * @param {{ bodyComplete?: boolean }} [options] - Incomplete fetches cannot be verified-empty.
 * @returns {ExtractResult}
 */
export function extractUsesFromHtml(html, options = {}) {
  if (typeof html !== "string" || !html.trim()) {
    return {
      outcome: "parse_error",
      items: [],
      blocks: usesBlocks(html),
      content_hash_source: "",
    };
  }

  const cleaned = stripNonContentHtml(html);
  if (!cleaned.trim()) {
    return {
      outcome: "parse_error",
      items: [],
      content_hash_source: "",
    };
  }

  /** @type {RawUseItem[]} */
  const items = [];
  const $ = loadHtml(cleaned);
  /** @type {Set<string>} */
  const headings = new Set();
  $("h1, h2, h3, h4, h5, h6").each((_, heading) => {
    if ($(heading).parents("li, dt, tr, td, nav, footer, header").length > 0) {
      return;
    }
    const text = headingLabel($(heading).text());
    if (text) {
      headings.add(text.toLowerCase());
    }
  });

  $("li, dt, tr").each((_, element) => {
    const clone = $(element).clone();
    clone.children("ul, ol, dl, table").remove();
    const token = $.html(clone);
    const rawText = textFromHtml(token);
    if (!rawText || rawText.length < 2) {
      return;
    }
    if (NEGATION.test(rawText) && !hasPositiveUseVerb(rawText)) {
      return;
    }

    const reasons = $(element).parents("ol").length > 0;
    const parsed = parseItem(token, rawText, { reasons });
    if (parsed.length === 0) {
      return;
    }

    const sectionPathText = sectionPath($, element);
    const sectionParts = sectionPathText.split(" / ").filter(Boolean);
    const section = sectionParts.at(-1) || "";
    const status = inferStatus(`${sectionPathText} ${rawText}`);
    if (status === "unspecified" && NEGATION.test(rawText)) {
      return;
    }

    for (const part of parsed) {
      if (!part.label || isNoiseLabel(part.label)) {
        continue;
      }
      const echoed =
        part.label.toLowerCase() === section.toLowerCase() ||
        headings.has(part.label.toLowerCase());
      if (echoed && !part.context) {
        continue;
      }
      const excerpt = [part.label, part.context].filter(Boolean).join(". ");
      items.push({
        label: part.label,
        context: part.context,
        kind: part.kind,
        status: status === "unspecified" ? "current" : status,
        section,
        section_path: sectionPathText,
        href: claimHref(token),
        list_depth: $(element).parents("ul, ol").length,
        excerpt: excerpt.slice(0, MAX_EXCERPT_CHARS),
        use_case_hints: inferUseCaseHints(`${section} ${part.context}`),
      });
    }
  });

  appendOutlineClaims($, items);

  // Deduplicate by comparison-ish label within the page.
  const deduped = dedupeItems(items);
  const blocks = usesBlocks(html);

  if (deduped.length === 0) {
    // Page had structure but no list-like declarations.
    const hasList = /<(ul|ol|dl|table)\b/i.test(cleaned);
    let outcome = "uncertain";
    if (options.bodyComplete !== false && hasList) {
      outcome = "verified_empty";
    }
    return {
      outcome,
      items: [],
      blocks,
      content_hash_source: cleaned,
    };
  }

  return {
    outcome: "verified",
    items: deduped,
    blocks,
    content_hash_source: cleaned,
  };
}

/**
 * Next element sibling, skipping text and comments.
 * @param {unknown} node
 * @returns {unknown}
 */
function elementSibling(node) {
  let sibling = node && node.next;
  while (sibling && sibling.type !== "tag") {
    sibling = sibling.next;
  }
  return sibling || null;
}

/**
 * Adds a heading-led claim when the label is a product name.
 * @param {RawUseItem[]} items
 * @param {string} label
 * @param {string} context
 * @param {string} sectionPathText
 * @param {string} href
 * @returns {void}
 */
function pushOutlineClaim(items, label, context, sectionPathText, href) {
  const name = sanitizeLabel(label);
  if (!name || !isReportableUseLabel(name)) {
    return;
  }
  const prose = sanitizeLabel(context);
  if (NEGATION.test(prose) && !hasPositiveUseVerb(prose)) {
    return;
  }
  const sectionParts = sectionPathText.split(" / ").filter(Boolean);
  const section = sectionParts.at(-1) || "";
  const status = inferStatus(`${sectionPathText} ${prose}`);
  if (status === "unspecified" && NEGATION.test(prose)) {
    return;
  }
  const destination = href && !href.startsWith("#") ? href : "";
  const excerpt = [name, prose].filter(Boolean).join(". ");
  items.push({
    label: name.slice(0, MAX_LABEL_CHARS),
    context: prose.slice(0, MAX_EXCERPT_CHARS),
    kind: classifyUseKind(name),
    status,
    section,
    section_path: sectionPathText,
    href: destination,
    list_depth: 0,
    excerpt: excerpt.slice(0, MAX_EXCERPT_CHARS),
    use_case_hints: inferUseCaseHints(`${section} ${prose}`),
  });
}

/**
 * Heading-plus-paragraph and single-heading cards. A heading that introduces
 * a list stays a section. Headings inside a list item stay with that item.
 * @param {cheerio.CheerioAPI} $
 * @param {RawUseItem[]} items
 * @returns {void}
 */
function appendOutlineClaims($, items) {
  /** @type {Set<unknown>} */
  const claimedHeadings = new Set();
  $("article, section").each((_, element) => {
    if ($(element).parents("li, dt, tr, td, nav, footer, header").length > 0) {
      return;
    }
    if ($(element).find("li, dt, tr").length > 0) {
      return;
    }
    const heads = $(element).find("h1, h2, h3, h4, h5, h6").toArray();
    if (heads.length !== 1) {
      return;
    }
    const heading = heads[0];
    const clone = $(element).clone();
    clone.find("h1, h2, h3, h4, h5, h6").remove();
    const before = items.length;
    pushOutlineClaim(
      items,
      headingLabel($(heading).text()),
      textFromHtml($.html(clone)),
      sectionPath($, element),
      $(element).find("a[href]").attr("href") || "",
    );
    if (items.length > before) {
      claimedHeadings.add(heading);
    }
  });

  $("h1, h2, h3, h4, h5, h6").each((_, heading) => {
    if (claimedHeadings.has(heading)) {
      return;
    }
    if ($(heading).parents("li, dt, tr, td, nav, footer, header").length > 0) {
      return;
    }
    const next = elementSibling(heading);
    if (!next) {
      return;
    }
    const name = next.name.toLowerCase();
    if (name === "ul" || name === "ol" || name === "dl" || name === "table") {
      return;
    }
    if (name !== "p" && name !== "blockquote") {
      return;
    }
    pushOutlineClaim(
      items,
      headingLabel($(heading).text()),
      textFromHtml($.html(next)),
      sectionPath($, heading),
      $(next).find("a[href]").attr("href") ||
        $(heading).find("a[href]").attr("href") ||
        "",
    );
  });
}

/**
 * First real link on a claim. In-page fragments are not destinations.
 * @param {string} token
 * @returns {string}
 */
function claimHref(token) {
  for (const match of token.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi,
  )) {
    const href = match[1];
    if (href && !href.startsWith("#")) {
      return href;
    }
  }
  return "";
}

/**
 * @param {string} html
 * @returns {string}
 */
function textFromHtml(html) {
  return normalizeExtractedText(
    html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "),
  );
}

/**
 * Reads a name from a list item's heading, then keeps the rest as context.
 * @param {string} token
 * @param {string} fallbackText
 * @param {{ reasons?: boolean }} [options]
 * @returns {Array<{ label: string, context: string, kind: 'product'|'equipment'|'practice'|'unresolved' }>}
 */
function parseItem(token, fallbackText, options = {}) {
  const heading = token.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
  const links = [...token.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map(
    (match) => textFromHtml(match[1]),
  );
  const strong = token.match(/<(strong|b|em)\b[^>]*>([\s\S]*?)<\/\1>/i);
  const strongText = strong ? textFromHtml(strong[2]) : "";
  const claimLinks = links.filter((linkText) => {
    if (!linkText || isPersonCredit(token, linkText, fallbackText)) {
      return false;
    }
    if (isFragmentLink(token, linkText)) {
      return false;
    }
    if (isNamedEntity(linkText)) {
      return true;
    }
    if (strongText && startsWithName(fallbackText, strongText)) {
      return false;
    }
    return linkIsClaim(fallbackText, linkText);
  });
  let nameSource = "";
  let trailing = "";
  let attribution = false;
  /** @type {string[]} */
  const credits = [];
  /** @type {string[]} */
  const extraNames = [];
  let forcePractice = false;

  const handle = fallbackText.match(
    /\b([A-Z][A-Za-z0-9.+#-]{1,40})\s+\(@([A-Za-z0-9_]+)\)/,
  );
  if (heading) {
    nameSource = textFromHtml(heading[1]);
    trailing = textFromHtml(token.replace(heading[0], " "));
  } else if (handle && !claimLinks.includes(handle[1])) {
    nameSource = handle[1];
    credits.push(`@${handle[2]}`);
    trailing = fallbackText;
  } else if (claimLinks.length > 0) {
    nameSource = claimLinks[0];
    extraNames.push(...claimLinks.slice(1));
    trailing = fallbackText;
  } else if (strongText && startsWithName(fallbackText, strongText)) {
    nameSource = strongText;
    trailing = textAfter(fallbackText, strongText);
    forcePractice = strongText.split(/\s+/).length > 4;
  } else if (
    links.some((linkText) => isPersonCredit(token, linkText, fallbackText))
  ) {
    attribution = true;
    nameSource = links.find((linkText) =>
      isPersonCredit(token, linkText, fallbackText),
    );
  } else if (options.reasons && links.length === 0) {
    nameSource = fallbackText;
    forcePractice = true;
  } else if (links.length === 0 && !strong) {
    nameSource = fallbackText.replace(
      /^(?:I\s+(?:use|listen to|run|host|play)|My\s+current\s+[A-Za-z]+\s+is)\s+(?:the\s+)?/i,
      "",
    );
  } else if (links.every((linkText) => isFragmentLink(token, linkText))) {
    return [];
  } else {
    return [];
  }

  const separated = separateNameContext(nameSource);
  const context = [separated.context, trailing]
    .map((part) => sanitizeLabel(part))
    .filter(Boolean)
    .join(" ");
  const names = [...splitCompoundName(separated.name), ...extraNames].map(
    (label) => label.replace(/\.+$/, ""),
  );
  const items = names.map((label) => ({
    label: label.slice(0, MAX_LABEL_CHARS),
    context: context.slice(0, MAX_EXCERPT_CHARS),
    kind:
      forcePractice || /\bmethodology\b/i.test(context)
        ? "practice"
        : classifyUseKind(label, {
            attribution: attribution || isAttribution(token, label),
          }),
  }));
  for (const credit of credits) {
    items.push({
      label: credit.slice(0, MAX_LABEL_CHARS),
      context: context.slice(0, MAX_EXCERPT_CHARS),
      kind: "unresolved",
    });
  }
  return items;
}

/**
 * @param {string} full
 * @param {string} name
 * @returns {string}
 */
/**
 * @param {string} full
 * @param {string} name
 * @returns {boolean}
 */
/**
 * In-page heading links are navigation, not tools.
 * @param {string} token
 * @param {string} linkText
 * @returns {boolean}
 */
function isFragmentLink(token, linkText) {
  const expected = sanitizeLabel(linkText).toLowerCase();
  for (const match of token.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (sanitizeLabel(textFromHtml(match[2])).toLowerCase() !== expected) {
      continue;
    }
    const href =
      (match[1].match(/href\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
    if (href.startsWith("#")) {
      return true;
    }
  }
  return false;
}

/**
 * @param {string} full
 * @param {string} name
 * @returns {boolean}
 */
function startsWithName(full, name) {
  const source = sanitizeLabel(full).toLowerCase();
  const lead = sanitizeLabel(name).toLowerCase();
  return Boolean(lead) && source.startsWith(lead);
}

/**
 * A link names the tool when the item starts with it, or a use verb introduces it.
 * @param {string} full
 * @param {string} linkText
 * @returns {boolean}
 */
export function linkIsClaim(full, linkText) {
  const source = sanitizeLabel(full);
  const link = sanitizeLabel(linkText);
  if (!link) {
    return false;
  }
  if (source.toLowerCase().startsWith(link.toLowerCase())) {
    return true;
  }
  const index = source.toLowerCase().indexOf(link.toLowerCase());
  if (index < 0) {
    return false;
  }
  return /\b(?:use|using|used|run|running|host|hosting|listen to|play)\s+(?:the\s+)?$/i.test(
    source.slice(0, index),
  );
}

/**
 * @param {string} token
 * @param {string} linkText
 * @param {string} full
 * @returns {boolean}
 */
function isPersonCredit(token, linkText, full) {
  if (isAttribution(token, sanitizeLabel(linkText))) {
    return true;
  }
  const source = sanitizeLabel(full);
  const link = sanitizeLabel(linkText);
  const index = source.toLowerCase().indexOf(link.toLowerCase());
  const before = index > 0 ? source.slice(0, index) : "";
  return /\b(?:friend|made by|photo by|theme by)\s+$/i.test(before);
}

/**
 * @param {string} full
 * @param {string} name
 * @returns {string}
 */
export function textAfter(full, name) {
  const source = sanitizeLabel(full);
  const lead = sanitizeLabel(name);
  if (!lead || !source.toLowerCase().startsWith(lead.toLowerCase())) {
    return "";
  }
  return source.slice(lead.length).trim();
}

/**
 * @param {string} token
 * @param {string} label
 * @returns {boolean}
 */
function isAttribution(token, label) {
  if (/^@/.test(label)) {
    return true;
  }
  return /\brel\s*=\s*["'][^"']*\b(?:author|me)\b/i.test(token);
}

/**
 * @param {string} label
 * @returns {boolean}
 */
function isNoiseLabel(label) {
  if (/^https?:\/\//i.test(label)) {
    return true;
  }
  return !isReportableUseLabel(label);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasPositiveUseVerb(text) {
  return /\b(i use|using|my (?:editor|browser|phone|laptop|setup))\b/i.test(
    text,
  );
}

/**
 * @param {RawUseItem[]} items
 * @returns {RawUseItem[]}
 */
function dedupeItems(items) {
  /** @type {Map<string, RawUseItem>} */
  const map = new Map();
  for (const item of items) {
    const key = `${item.label.toLowerCase()}|${item.status}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    // Prefer richer excerpt / more hints.
    if (
      item.excerpt.length > existing.excerpt.length ||
      item.use_case_hints.length > existing.use_case_hints.length
    ) {
      map.set(key, {
        ...item,
        use_case_hints: uniqueStrings([
          ...existing.use_case_hints,
          ...item.use_case_hints,
        ]),
      });
    }
  }
  return [...map.values()];
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function uniqueStrings(values) {
  /** @type {string[]} */
  const out = [];
  for (const value of values) {
    if (!out.includes(value)) {
      out.push(value);
    }
  }
  return out;
}
