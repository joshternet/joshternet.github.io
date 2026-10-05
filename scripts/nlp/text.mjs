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
  const linkPattern =
    /<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;

  while ((match = linkPattern.exec(source))) {
    const before = match[1];
    const after = match[3] || "";
    const attrs = `${before} ${after}`;
    const href = decodeHrefForParse(match[2]);
    const text = capRemoteString(
      match[4].replace(/<[^>]+>/g, " "),
      MAX_ANCHOR_CHARS,
    );
    const relMatch = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i);
    const rel = relMatch?.[1]
      ? relMatch[1]
          .toLowerCase()
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean)
      : [];
    const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']+)["']/i);
    const classNames = classMatch?.[1]
      ? classMatch[1]
          .toLowerCase()
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean)
      : [];

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
