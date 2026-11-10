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
  is3dPrinterUmbrellaLabel,
  isBlogChromeSection,
  isNamedEntity,
  isOperatingSystemProductLabel,
  isReportableUseLabel,
  isUsesSectionLabel,
  quantityNearLabel,
  sanitizeLabel,
  peelDeclarativeLeadIn,
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
 * @property {number} [quantity]
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
    if (isBlogChromeSection(sectionPathText)) {
      return;
    }
    const sectionParts = sectionPathText.split(" / ").filter(Boolean);
    const section = sectionParts.at(-1) || "";
    const status = inferStatus(`${sectionPathText} ${rawText}`);
    if (status === "unspecified" && NEGATION.test(rawText)) {
      return;
    }

    for (const part of parsed) {
      if (!part.label || isNoiseLabel(part.label, part.kind)) {
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
  appendOperatingSystemHeadingClaims($, items);

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
  const heading = sanitizeLabel(label);
  const prose = sanitizeLabel(context);
  if (!heading) {
    return;
  }

  // Section titles (Website 🌐, Phone 📱, 3D Printing) are not products.
  // When the next paragraph names a real tool (Hugo, Ender 3 v2), claim that
  // tool under this section.
  let name = heading;
  let detail = prose;
  let pathText = sectionPathText;
  if (!isReportableUseLabel(name)) {
    const sectionLike =
      isUsesSectionLabel(heading) || is3dPrinterUmbrellaLabel(heading);
    if (
      !sectionLike ||
      !isReportableUseLabel(prose) ||
      !(isNamedEntity(prose) || (href && !href.startsWith("#")))
    ) {
      return;
    }
    name = prose;
    detail = "";
    const parts = sectionPathText.split(" / ").filter(Boolean);
    parts.push(heading);
    pathText = parts.join(" / ");
  }

  if (NEGATION.test(detail) && !hasPositiveUseVerb(detail)) {
    return;
  }
  const sectionParts = pathText.split(" / ").filter(Boolean);
  const section = sectionParts.at(-1) || "";
  const status = inferStatus(`${pathText} ${detail}`);
  if (status === "unspecified" && NEGATION.test(detail)) {
    return;
  }
  // Umbrella “3D printers” headings keep the machines named in the prose
  // (and skip the heading itself when those machines are present).
  if (is3dPrinterUmbrellaLabel(name) && detail) {
    const machines = productNamesFromPrinterProse(detail);
    if (machines.length > 0) {
      for (const machine of machines) {
        const excerpt = [machine.name, detail].filter(Boolean).join(". ");
        items.push({
          label: machine.name.slice(0, MAX_LABEL_CHARS),
          context: detail.slice(0, MAX_EXCERPT_CHARS),
          kind: "product",
          status,
          section,
          section_path: pathText,
          href: machine.href || "",
          list_depth: 0,
          excerpt: excerpt.slice(0, MAX_EXCERPT_CHARS),
          use_case_hints: inferUseCaseHints(`${section} ${detail}`),
          quantity: machine.quantity,
        });
      }
      return;
    }
  }
  const destination = href && !href.startsWith("#") ? href : "";
  const excerpt = [name, detail].filter(Boolean).join(". ");
  items.push({
    label: name.slice(0, MAX_LABEL_CHARS),
    context: detail.slice(0, MAX_EXCERPT_CHARS),
    kind: classifyUseKind(name),
    status,
    section,
    section_path: pathText,
    href: destination,
    list_depth: 0,
    excerpt: excerpt.slice(0, MAX_EXCERPT_CHARS),
    use_case_hints: inferUseCaseHints(`${section} ${detail}`),
  });
}

/**
 * Pulls named 3D printers from section prose when microformats were flattened.
 * @param {string} prose
 * @returns {Array<{ name: string, href: string, quantity: number }>}
 */
function productNamesFromPrinterProse(prose) {
  // Caller already sanitizes outline prose; keep a sanitize here for safety.
  const text = sanitizeLabel(prose);
  /** @type {Array<{ name: string, href: string, quantity: number }>} */
  // Shorter "Ender 3 v2" alias first so the Creality-titled form can dedupe it.
  const known = [
    "Creality K1 Max",
    "Creality CR-10 Mini",
    "Creality CR-10S",
    "FLSUN QQ-S Pro",
    "Ender 3 v2",
    "Creality Ender 3 V2",
  ];
  /** @type {Array<{ name: string, href: string, quantity: number }>} */
  const hits = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const label of known) {
    const key = label.toLowerCase();
    if (!text.toLowerCase().includes(key)) {
      continue;
    }
    const canonical = label === "Ender 3 v2" ? "creality ender 3 v2" : key;
    if (seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    hits.push({
      name: label === "Ender 3 v2" ? "Creality Ender 3 V2" : label,
      href: "",
      quantity: quantityNearLabel(text, label),
    });
  }
  return hits;
}

/**
 * OS section titles (Linux / MacOS / Windows) are products even when they
 * introduce a list of apps. Children keep the heading as their section.
 * @param {cheerio.CheerioAPI} $
 * @param {RawUseItem[]} items
 * @returns {void}
 */
function appendOperatingSystemHeadingClaims($, items) {
  $("h1, h2, h3, h4, h5, h6").each((_, heading) => {
    if ($(heading).parents("li, dt, tr, td, nav, footer, header").length > 0) {
      return;
    }
    const label = headingLabel($(heading).text());
    if (!isOperatingSystemProductLabel(label)) {
      return;
    }
    const pathText = sectionPath($, heading);
    const parts = pathText.split(" / ").filter(Boolean);
    const alreadyInPath =
      parts.length > 0 &&
      isOperatingSystemProductLabel(parts[parts.length - 1]);
    const claimPath = alreadyInPath
      ? pathText
      : [...parts, sanitizeLabel(label)].filter(Boolean).join(" / ");
    const name = sanitizeLabel(label);
    const sectionParts = claimPath.split(" / ").filter(Boolean);
    const section = sectionParts.at(-1);
    items.push({
      label: name.slice(0, MAX_LABEL_CHARS),
      context: "",
      kind: "product",
      status: "current",
      section,
      section_path: claimPath,
      href: "",
      list_depth: 0,
      excerpt: name.slice(0, MAX_EXCERPT_CHARS),
      use_case_hints: inferUseCaseHints(section),
    });
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
    const headingText = headingLabel($(heading).text());
    const pathText = sectionPath($, element);
    if (
      pushHProductClaims(
        items,
        $,
        clone,
        headingText,
        pathText,
        textFromHtml($.html(clone)),
      )
    ) {
      claimedHeadings.add(heading);
    } else {
      pushOutlineClaim(
        items,
        headingText,
        textFromHtml($.html(clone)),
        pathText,
        $(element).find("a[href]").attr("href") || "",
      );
      if (items.length > before) {
        claimedHeadings.add(heading);
      }
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
    const headingText = headingLabel($(heading).text());
    const pathText = sectionPath($, heading);
    const prose = textFromHtml($.html(next));
    if (!pushHProductClaims(items, $, $(next), headingText, pathText, prose)) {
      pushOutlineClaim(
        items,
        headingText,
        prose,
        pathText,
        $(next).find("a[href]").attr("href") ||
          $(heading).find("a[href]").attr("href") ||
          "",
      );
    }
  });
}

/**
 * Emits one claim per `.h-product` under a section heading.
 * @param {RawUseItem[]} items
 * @param {cheerio.CheerioAPI} $
 * @param {cheerio.Cheerio} root
 * @param {string} headingText
 * @param {string} pathText
 * @param {string} prose
 * @returns {boolean}
 */
function pushHProductClaims(items, $, root, headingText, pathText, prose) {
  // Expand microformats under 3D-printer section headings.
  if (!is3dPrinterUmbrellaLabel(headingText)) {
    return false;
  }
  const nodes = root.find(".h-product").toArray();
  if (nodes.length === 0) {
    return false;
  }
  const sectionParts = pathText.split(" / ").filter(Boolean);
  const section = sectionParts.at(-1) || headingText;
  const status = inferStatus(`${pathText} ${prose}`);
  let added = 0;
  for (const node of nodes) {
    const el = $(node);
    const brand = sanitizeLabel(el.find(".p-brand").first().text());
    const named = sanitizeLabel(el.find(".p-name").first().text());
    const linkText = sanitizeLabel(el.find("a").first().text());
    const whole = sanitizeLabel(el.text());
    let label = named || linkText || whole;
    // Prefer p-name / link text; fall back to the whole node (brand-only rows).
    if (
      brand &&
      label &&
      !label.toLowerCase().startsWith(brand.toLowerCase())
    ) {
      label = `${brand} ${label}`;
    }
    label = sanitizeLabel(label.replace(/\s+/g, " "));
    if (!isReportableUseLabel(label) || !isNamedEntity(label)) {
      continue;
    }
    const href = el.find("a[href]").first().attr("href") || "";
    items.push({
      label: label.slice(0, MAX_LABEL_CHARS),
      context: prose.slice(0, MAX_EXCERPT_CHARS),
      kind: "product",
      status,
      section,
      section_path: pathText,
      href: href.startsWith("#") ? "" : href,
      list_depth: 0,
      excerpt: [label, prose]
        .filter(Boolean)
        .join(". ")
        .slice(0, MAX_EXCERPT_CHARS),
      use_case_hints: inferUseCaseHints(`${section} ${prose}`),
      quantity: quantityNearLabel(prose, label),
    });
    added += 1;
  }
  return added > 0;
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
    nameSource = fallbackText;
  } else if (links.every((linkText) => isFragmentLink(token, linkText))) {
    return [];
  } else {
    return [];
  }

  const peeled = peelDeclarativeLeadIn(nameSource);
  const separated = separateNameContext(peeled.name);
  const context = [peeled.context, separated.context, trailing]
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
 * @param {'product'|'equipment'|'practice'|'unresolved'} [kind]
 * @returns {boolean}
 */
function isNoiseLabel(label, kind = "product") {
  if (/^https?:\/\//i.test(label)) {
    return true;
  }
  // Reason-list practices may reuse section words (Gaming) without ranking them.
  if (kind === "practice" || kind === "unresolved") {
    const text = sanitizeLabel(label);
    return !text || text.length < 2;
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
