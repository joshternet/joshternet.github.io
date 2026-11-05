/**
 * Goal & Constraints:
 * Parse eligible HTML with Cheerio. The caller supplies the HTML string.
 * This module does not fetch URLs or run page scripts. Nested text is not
 * counted twice. A footer link stays available to Connections and out of Uses.
 */

import { createHash } from "node:crypto";

import * as cheerio from "cheerio";

/**
 * Stable id for a block. The observation time is not part of the input.
 * @param {string[]} parts
 * @returns {string}
 */
export function blockId(parts) {
  return createHash("sha256")
    .update(parts.join("\u001f"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * @param {unknown} html
 * @returns {cheerio.CheerioAPI}
 */
export function loadHtml(html) {
  return cheerio.load(typeof html === "string" ? html : "", {
    scriptingEnabled: false,
  });
}

/**
 * @param {string} value
 * @returns {string}
 */
function collapse(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Text of this element without nested lists or tables.
 * @param {cheerio.CheerioAPI} $
 * @param {unknown} element
 * @returns {string}
 */
function ownText($, element) {
  const clone = $(element).clone();
  clone.children("ul, ol, dl, table").remove();
  return collapse(clone.text());
}

/**
 * @param {cheerio.CheerioAPI} $
 * @param {unknown} element
 * @returns {boolean}
 */
function inChrome($, element) {
  return $(element).parents("nav, footer, header").length > 0;
}

/**
 * @param {cheerio.CheerioAPI} $
 * @param {unknown} element
 * @returns {string}
 */
function sectionPath($, element) {
  /** @type {string[]} */
  const headings = [];
  $(element)
    .parents()
    .each((_, parent) => {
      $(parent)
        .children("h1, h2, h3, h4, h5, h6")
        .each((__, heading) => {
          const text = collapse($(heading).text());
          if (text) {
            headings.push(text);
          }
        });
    });
  return headings.reverse().join(" / ");
}

/**
 * @param {cheerio.CheerioAPI} $
 * @param {unknown} element
 * @returns {Array<{ href: string, text: string }>}
 */
function linksOf($, element) {
  /** @type {Array<{ href: string, text: string }>} */
  const links = [];
  $(element)
    .find("a[href]")
    .each((_, anchor) => {
      const href = collapse($(anchor).attr("href"));
      if (!href || href.startsWith("javascript:")) {
        return;
      }
      links.push({ href, text: collapse($(anchor).text()) });
    });
  return links;
}

/**
 * @param {cheerio.CheerioAPI} $
 * @returns {string}
 */
function languageOf($) {
  return collapse($("html").attr("lang") || $("body").attr("lang") || "");
}

/**
 * Uses evidence: list, definition, and table rows outside site chrome.
 * @param {unknown} html
 * @returns {object[]}
 */
export function usesBlocks(html) {
  const $ = loadHtml(html);
  const language = languageOf($);
  /** @type {object[]} */
  const blocks = [];
  /** @type {Map<unknown, string>} */
  const ids = new Map();

  $("li, dt, tr").each((_, element) => {
    if (inChrome($, element)) {
      return;
    }
    const tag = element.name.toLowerCase();
    const target = ownText($, element);
    if (!target) {
      return;
    }
    const section = sectionPath($, element);
    const id = blockId([section, tag, target]);
    ids.set(element, id);
    blocks.push({
      block_id: id,
      block_type: tag,
      section_path: section,
      target_text: target,
      context_before: "",
      context_after: "",
      relevant_links: linksOf($, element),
      parent_block_id: "",
      child_block_ids: [],
      language,
    });
  });

  for (const [element, id] of ids) {
    const parent = $(element).parents("li, dt, tr").get(0);
    if (!parent) {
      continue;
    }
    const parentId = ids.get(parent);
    if (!parentId) {
      continue;
    }
    const block = blocks.find((item) => item.block_id === id);
    const parentBlock = blocks.find((item) => item.block_id === parentId);
    block.parent_block_id = parentId;
    parentBlock.child_block_ids.push(id);
  }

  return blocks;
}

/**
 * Topic passages. Each article is its own passage. Without articles, bounded
 * paragraphs outside chrome are used. The first article is not the whole page.
 * @param {unknown} html
 * @returns {object[]}
 */
export function topicPassages(html) {
  const $ = loadHtml(html);
  const language = languageOf($);
  /** @type {object[]} */
  const passages = [];
  const articles = $("article").toArray();
  const sources = articles.length > 0 ? articles : $("p").toArray();

  for (const element of sources) {
    if (inChrome($, element)) {
      continue;
    }
    const text = collapse($(element).text()).slice(0, 800);
    if (!text) {
      continue;
    }
    passages.push({
      block_id: blockId(["topic", text.slice(0, 80)]),
      block_type: articles.length > 0 ? "article" : "paragraph",
      section_path: sectionPath($, element),
      target_text: text,
      language,
    });
  }

  return passages;
}

/**
 * Links for Connections, including footer and blogroll links.
 * @param {unknown} html
 * @returns {object[]}
 */
export function connectionLinks(html) {
  const $ = loadHtml(html);
  /** @type {object[]} */
  const links = [];
  $("a[href]").each((_, anchor) => {
    const href = collapse($(anchor).attr("href"));
    if (!href || href.startsWith("javascript:")) {
      return;
    }
    let location = "body";
    if ($(anchor).parents("footer").length > 0) {
      location = "footer";
    } else if ($(anchor).parents("nav").length > 0) {
      location = "nav";
    } else if ($(anchor).parents("main, article").length > 0) {
      location = "main";
    }
    links.push({
      href,
      text: collapse($(anchor).text()),
      location,
    });
  });
  return links;
}

/**
 * Title and description already present as metadata. Scripts are not read.
 * @param {unknown} html
 * @returns {{ title: string, description: string, language: string }}
 */
export function documentMeta(html) {
  const $ = loadHtml(html);
  return {
    title: collapse($("title").first().text()),
    description: collapse(
      $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        "",
    ),
    language: languageOf($),
  };
}
