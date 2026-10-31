/**
 * Goal & Constraints:
 * Decode HTML entities, normalize Unicode/whitespace, extract semantic regions,
 * and cap remote strings before NLP. Parser artifacts (quot, x27, amp, nbsp)
 * must never become heuristic subjects.
 */

import { decodeHtmlEntities, normalizeText } from "../network/lib.mjs";

export { decodeHtmlEntities };

export const MAX_TITLE_CHARS = 256;
export const MAX_DESCRIPTION_CHARS = 512;
export const MAX_ANCHOR_CHARS = 200;
export const MAX_RAW_TOPIC_CHARS = 120;
export const MAX_SUMMARY_CHARS = 400;

/**
 * Unwraps XML CDATA so feed categories become plain labels.
 * Leftover open or close markers are stripped.
 * @param {unknown} input
 * @returns {string}
 */
export function unwrapXmlCdata(input) {
  if (typeof input !== "string" || !input) {
    return "";
  }

  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<!\[CDATA\[/gi, "")
    .replace(/\]\]>/g, "");
}

/**
 * Unicode NFC + whitespace + control-character cleanup after entity decode.
 * @param {string} input
 * @returns {string}
 */
export function normalizeExtractedText(input) {
  if (typeof input !== "string" || !input) {
    return "";
  }

  const decoded = decodeHtmlEntities(unwrapXmlCdata(input));
  const unicode = decoded.normalize("NFC");
  const withoutControls = unicode.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    "",
  );
  return normalizeText(withoutControls);
}

/**
 * Caps a remote string for persistence (not URLs).
 * @param {string} input
 * @param {number} max
 * @returns {string}
 */
export function capRemoteString(input, max) {
  const text = normalizeExtractedText(input);
  if (!text) {
    return "";
  }

  return text.slice(0, max);
}

/**
 * Decodes entities in a URL string before URL() parsing.
 * @param {string} href
 * @returns {string}
 */
export function decodeHrefForParse(href) {
  if (typeof href !== "string" || !href) {
    return "";
  }

  return decodeHtmlEntities(href).trim();
}

/**
 * Reads a quoted or unquoted HTML attribute value (minified sites often omit quotes).
 * @param {string} attrs
 * @param {string} name
 * @returns {string}
 */
export function htmlAttributeValue(attrs, name) {
  if (
    typeof attrs !== "string" ||
    !attrs ||
    typeof name !== "string" ||
    !name
  ) {
    return "";
  }

  const pattern = new RegExp(
    `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = attrs.match(pattern);

  if (!match) {
    return "";
  }

  return match[1] ?? match[2] ?? match[3];
}

/**
 * Splits a space-separated HTML attribute value into lowercase tokens.
 * @param {string} value
 * @returns {string[]}
 */
function attributeTokens(value) {
  if (typeof value !== "string" || !value) {
    return [];
  }

  return value
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * @typedef {{
 *   title: string,
 *   headings: string,
 *   prose: string,
 *   code: string,
 *   chrome: string,
 *   textForTopics: string,
 *   links: Array<{href: string, text: string, rel: string[], classNames: string[]}>,
 *   noindex: boolean,
 *   derived: boolean,
 *   lang: string,
 * }} ParsedRegions
 */

/**
 * Parses HTML into semantic regions for topic NLP vs link extraction.
 * @param {string} html
 * @returns {ParsedRegions}
 */
export function parseHtmlRegions(html) {
  const source = typeof html === "string" ? html : "";
  const noindex =
    /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b/i.test(
      source,
    ) ||
    /<meta\b[^>]*content=["'][^"']*\bnoindex\b[^"']*["'][^>]*name=["']robots["']/i.test(
      source,
    );
  const derived =
    /<meta\b[^>]*name=["']joshternet-analysis["'][^>]*content=["']derived["']/i.test(
      source,
    ) ||
    /<meta\b[^>]*content=["']derived["'][^>]*name=["']joshternet-analysis["']/i.test(
      source,
    );
  const langMatch = source.match(/<html\b[^>]*\blang=["']([^"']+)["']/i);
  const lang = langMatch?.[1]
    ? String(langMatch[1]).toLowerCase().slice(0, 16)
    : "";

  const titleMatch = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = capRemoteString(
    (titleMatch?.[1] || "").replace(/<[^>]+>/g, " "),
    MAX_TITLE_CHARS,
  );

  const headingBits = [];
  const headingPattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match;

  while ((match = headingPattern.exec(source))) {
    headingBits.push(normalizeExtractedText(match[1].replace(/<[^>]+>/g, " ")));
  }

  const headings = headingBits.filter(Boolean).join(" ").slice(0, 20_000);

  let working = source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const chromeBits = [];
  working = working.replace(
    /<(nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi,
    (chunk) => {
      chromeBits.push(normalizeExtractedText(chunk.replace(/<[^>]+>/g, " ")));
      return " ";
    },
  );

  const codeBits = [];
  working = working.replace(/<(pre|code|kbd|samp)[\s\S]*?<\/\1>/gi, (chunk) => {
    codeBits.push(normalizeExtractedText(chunk.replace(/<[^>]+>/g, " ")));
    return " ";
  });

  const mainMatch =
    working.match(/<main[\s\S]*?<\/main>/i) ||
    working.match(/<article[\s\S]*?<\/article>/i);
  const proseSource = mainMatch ? mainMatch[0] : working;
  const prose = normalizeExtractedText(
    proseSource.replace(/<[^>]+>/g, " "),
  ).slice(0, 100_000);

  const links = [];
  // Quoted or unquoted href (joshbeard.com and other minified static sites).
  const linkPattern =
    /<a\b([^>]*)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>([\s\S]*?)<\/a>/gi;

  while ((match = linkPattern.exec(source))) {
    const before = match[1];
    const after = match[5] || "";
    const attrs = `${before} ${after}`;
    const href = decodeHrefForParse(match[2] ?? match[3] ?? match[4]);
    const text = capRemoteString(
      match[6].replace(/<[^>]+>/g, " "),
      MAX_ANCHOR_CHARS,
    );
    const rel = attributeTokens(htmlAttributeValue(attrs, "rel"));
    const classNames = attributeTokens(htmlAttributeValue(attrs, "class"));

    if (href) {
      links.push({ href, text, rel, classNames });
    }
  }

  const textForTopics = [title, headings, prose].filter(Boolean).join("\n");

  return {
    title,
    headings,
    prose,
    code: codeBits.join(" ").slice(0, 20_000),
    chrome: chromeBits.join(" ").slice(0, 20_000),
    textForTopics,
    links,
    noindex,
    derived,
    lang,
  };
}

/**
 * All content values for meta tags whose name or property matches `key`.
 * Accepts quoted or unquoted attributes (minified participant HTML).
 * @param {string} html
 * @param {string} key
 * @returns {string[]}
 */
export function metaContents(html, key) {
  const source = typeof html === "string" ? html : "";
  const wanted = String(key || "")
    .trim()
    .toLocaleLowerCase("en-US");

  if (!wanted) {
    return [];
  }

  /** @type {string[]} */
  const values = [];
  const tagPattern = /<meta\b([^>]*)>/gi;
  let match;

  while ((match = tagPattern.exec(source))) {
    const attrs = match[1] || "";
    const property = htmlAttributeValue(attrs, "property")
      .trim()
      .toLocaleLowerCase("en-US");
    const name = htmlAttributeValue(attrs, "name")
      .trim()
      .toLocaleLowerCase("en-US");

    if (property !== wanted && name !== wanted) {
      continue;
    }

    const raw = htmlAttributeValue(attrs, "content");

    if (!raw) {
      continue;
    }

    const value = decodeHtmlEntities(unwrapXmlCdata(raw)).trim();

    if (value) {
      values.push(value);
    }
  }

  return values;
}

/**
 * Content of a meta tag matched by property or name, attribute order aside.
 * @param {string} html
 * @param {string} key
 * @returns {string}
 */
export function metaContent(html, key) {
  return metaContents(html, key)[0] || "";
}

/**
 * https URL with no credentials, resolved against a page when relative.
 * @param {string} value
 * @param {string} [base]
 * @returns {string}
 */
function httpsResourceHref(value, base) {
  if (!value) {
    return "";
  }

  try {
    const parsed = base ? new URL(value, base) : new URL(value);

    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return "";
    }

    return parsed.href;
  } catch {
    return "";
  }
}

/**
 * Social poster declared on a page (Open Graph, then Twitter).
 * @param {string} html
 * @param {string} [pageUrl]
 * @returns {string}
 */
export function posterImageFromHtml(html, pageUrl = "") {
  const raw =
    metaContent(html, "og:image") ||
    metaContent(html, "twitter:image") ||
    metaContent(html, "twitter:image:src");

  return httpsResourceHref(raw, pageUrl);
}

/**
 * Share blurb declared on a page (Open Graph, then meta description).
 * @param {string} html
 * @returns {string}
 */
export function shareDescriptionFromHtml(html) {
  const raw =
    metaContent(html, "og:description") ||
    metaContent(html, "description") ||
    metaContent(html, "twitter:description");

  return capRemoteString(normalizeExtractedText(raw), MAX_SUMMARY_CHARS);
}

/**
 * True when language looks English enough for English stopword NLP.
 * @param {string} lang
 * @returns {boolean}
 */
export function isEnglishLanguage(lang) {
  if (!lang) {
    return true;
  }

  const base = lang.toLowerCase().split(/[-_]/)[0];
  return base === "en";
}

/**
 * Flattens JSON-LD node trees (@graph / arrays) into plain objects.
 * @param {unknown} value
 * @returns {Array<Record<string, unknown>>}
 */
export function jsonLdObjects(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => jsonLdObjects(entry));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = /** @type {Record<string, unknown>} */ (value);
  /** @type {Array<Record<string, unknown>>} */
  const objects = [record];

  if (Array.isArray(record["@graph"])) {
    objects.push(...record["@graph"].flatMap((entry) => jsonLdObjects(entry)));
  }

  return objects;
}

/**
 * Collects @type tokens from one JSON-LD node (string, URL, or array).
 * @param {unknown} typeValue
 * @returns {string[]}
 */
function schemaTypeTokens(typeValue) {
  if (typeof typeValue === "string" && typeValue) {
    const bare = typeValue.includes("/")
      ? typeValue.slice(typeValue.lastIndexOf("/") + 1)
      : typeValue;
    return bare ? [bare] : [];
  }

  if (Array.isArray(typeValue)) {
    return typeValue.flatMap((entry) => schemaTypeTokens(entry));
  }

  return [];
}

/**
 * Schema.org / Open Graph type hints for page-role classification.
 * Includes BlogPosting/Article from JSON-LD and Article when og:type=article.
 * @param {string} html
 * @returns {string[]}
 */
export function schemaTypesFromHtml(html) {
  const source = typeof html === "string" ? html : "";
  /** @type {Set<string>} */
  const types = new Set();
  const scriptPattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(source))) {
    const raw = String(match[1] || "").trim();

    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);

      for (const object of jsonLdObjects(parsed)) {
        for (const token of schemaTypeTokens(object["@type"])) {
          types.add(token);
        }
      }
    } catch {
      // Invalid JSON-LD is ignored.
    }
  }

  const ogType = metaContent(source, "og:type").trim().toLowerCase();

  if (ogType === "article") {
    types.add("Article");
  }

  return [...types];
}

/**
 * Absolute canonical URL from a page, when declared.
 * @param {string} html
 * @param {string} [pageUrl]
 * @returns {string}
 */
export function canonicalHrefFromHtml(html, pageUrl = "") {
  const source = typeof html === "string" ? html : "";
  const linkPattern =
    /<link\b([^>]*)rel\s*=\s*(?:"[^"]*\bcanonical\b[^"]*"|'[^']*\bcanonical\b[^']*'|[^\s>]*\bcanonical\b[^\s>]*)([^>]*)>/gi;
  let match;

  while ((match = linkPattern.exec(source))) {
    const attrs = `${match[1] || ""} ${match[2] || ""}`;
    const href = decodeHrefForParse(htmlAttributeValue(attrs, "href"));

    if (!href) {
      continue;
    }

    try {
      return new URL(href, pageUrl || undefined).href;
    } catch {
      continue;
    }
  }

  return "";
}

/**
 * Stable fingerprint of visible topic text for soft-404 duplicate detection.
 * @param {string} html
 * @returns {string}
 */
export function htmlBodyFingerprint(html) {
  const regions = parseHtmlRegions(html);
  const text = normalizeExtractedText(regions.textForTopics).slice(0, 8_000);

  if (!text) {
    return "";
  }

  // FNV-1a 32-bit — deterministic, no crypto dependency on the static path.
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Publisher expertise labels from Person/Organization knowsAbout.
 * @param {string} html
 * @returns {string[]}
 */
export function knowsAboutFromHtml(html) {
  const source = typeof html === "string" ? html : "";
  /** @type {string[]} */
  const labels = [];
  const scriptPattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(source))) {
    const raw = String(match[1] || "").trim();

    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);

      for (const object of jsonLdObjects(parsed)) {
        const typeTokens = schemaTypeTokens(object["@type"]).map((token) =>
          token.toLowerCase(),
        );

        if (
          !typeTokens.some(
            (token) => token === "person" || token === "organization",
          )
        ) {
          continue;
        }

        const knows = object.knowsAbout;

        if (typeof knows === "string" && knows.trim()) {
          labels.push(knows.trim());
          continue;
        }

        if (!Array.isArray(knows)) {
          continue;
        }

        for (const entry of knows) {
          if (typeof entry === "string" && entry.trim()) {
            labels.push(entry.trim());
            continue;
          }

          if (entry && typeof entry === "object") {
            const record = /** @type {Record<string, unknown>} */ (entry);
            const name =
              typeof record.name === "string"
                ? record.name
                : typeof record["@id"] === "string"
                  ? record["@id"]
                  : "";

            if (name.trim()) {
              labels.push(name.trim());
            }
          }
        }
      }
    } catch {
      // Invalid JSON-LD is ignored.
    }
  }

  return labels;
}
