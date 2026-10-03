/**
 * Goal & Constraints:
 * Turn a publisher portfolio index into project content and declared topics.
 * Reads a work table (year, client, project, sector, location) and same-origin
 * case-study links. Does not invent participant-to-participant links.
 * Client names stay works, not topics. Sectors and recognizable subjects
 * (banking, government, health, and similar) become declared topics.
 */

import { slugifyTopic } from "../network/connections.mjs";
import { buildTopicEvidence, isNonSubjectSlug } from "./evidence.mjs";
import { decodeHtmlEntities, normalizeExtractedText } from "./text.mjs";

/** Upper bound so one index cannot flood content.json. */
export const MAX_PORTFOLIO_WORKS = 400;

/**
 * Whole-phrase subjects a portfolio may name in a sector or project title.
 * @type {Array<{pattern: RegExp, slug: string, label: string}>}
 */
const SECTOR_SUBJECTS = [
  { pattern: /\bbank/i, slug: "banking", label: "banking" },
  { pattern: /\bfintech\b/i, slug: "fintech", label: "fintech" },
  { pattern: /\bfinance\b/i, slug: "finance", label: "finance" },
  { pattern: /\bgovernment\b/i, slug: "government", label: "government" },
  { pattern: /\bpolic(?:y|ies)\b/i, slug: "policy", label: "policy" },
  { pattern: /\bhealth(?:care)?\b/i, slug: "health", label: "health" },
  { pattern: /\bdesign\b/i, slug: "design", label: "design" },
  {
    pattern: /\btechnolog(?:y|ies)\b/i,
    slug: "technology",
    label: "technology",
  },
  {
    pattern: /\bpropert(?:y|ies)\b|\breal estate\b/i,
    slug: "property",
    label: "property",
  },
  {
    pattern: /\b(?:non-?profit|charit(?:y|ies))\b/i,
    slug: "nonprofit",
    label: "nonprofit",
  },
  { pattern: /\brecruitment\b/i, slug: "recruitment", label: "recruitment" },
  {
    pattern: /\bartificial intelligence\b|\bai\b/i,
    slug: "ai",
    label: "ai",
  },
];

/**
 * @param {string} html
 * @returns {string}
 */
function visibleCell(html) {
  const primary = String(html || "").match(
    /class=["'][^"']*\btext-white\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
  );
  const source = primary ? primary[1] : String(html || "");

  return normalizeExtractedText(
    decodeHtmlEntities(
      source.replace(/<[^>]+>/g, " ").replace(/\u00AD|&shy;/gi, ""),
    ),
  );
}

/**
 * @param {string} headerHtml
 * @returns {string}
 */
function columnName(headerHtml) {
  const sort = String(headerHtml || "").match(
    /data-sort-col=["']([^"']+)["']/i,
  );

  if (sort?.[1]) {
    return sort[1].trim().toLowerCase();
  }

  const text = visibleCell(headerHtml).toLowerCase();

  if (text === "year") {
    return "year";
  }

  if (text === "client" || text === "client / project") {
    return "client";
  }

  if (text === "project") {
    return "project";
  }

  if (text === "sector" || text === "industry" || text === "category") {
    return "sector";
  }

  if (text === "location" || text === "where") {
    return "location";
  }

  return "";
}

/**
 * @param {string} tableHtml
 * @returns {Array<{year: string, client: string, project: string, sector: string, location: string}>}
 */
function worksFromTable(tableHtml) {
  const header =
    tableHtml.match(/<thead\b[\s\S]*?<\/thead>/i)?.[0] ||
    tableHtml.match(/<tr\b[\s\S]*?<\/tr>/i)?.[0] ||
    "";
  const headers = [...header.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/gi)].map(
    (match) => columnName(`${match[1]}> ${match[2]}`),
  );

  if (!headers.includes("sector")) {
    return [];
  }

  if (!headers.includes("client") && !headers.includes("project")) {
    return [];
  }

  const body = tableHtml.match(/<tbody\b[\s\S]*?<\/tbody>/i)?.[0] || tableHtml;
  const works = [];

  for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    if (/<th\b/i.test(row[1])) {
      continue;
    }

    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (match) => visibleCell(match[1]),
    );
    /** @type {Record<string, string>} */
    const record = {
      year: "",
      client: "",
      project: "",
      sector: "",
      location: "",
    };

    headers.forEach((name, index) => {
      if (name && Object.hasOwn(record, name)) {
        record[name] = cells[index] || "";
      }
    });

    if (!record.sector && !record.project && !record.client) {
      continue;
    }

    works.push(record);

    if (works.length >= MAX_PORTFOLIO_WORKS) {
      break;
    }
  }

  return works;
}

/**
 * Same-origin case-study links under a portfolio path.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {Array<{url: string, slug: string, text: string}>}
 */
function caseStudyLinks(html, pageUrl) {
  /** @type {Map<string, {url: string, slug: string, text: string}>} */
  const byUrl = new Map();
  let origin = "";

  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }

  for (const match of String(html || "").matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    let absolute;

    try {
      absolute = new URL(match[1], pageUrl);
    } catch {
      continue;
    }

    if (absolute.origin !== origin) {
      continue;
    }

    const path = absolute.pathname.replace(/\/+$/, "") || "/";
    const slug = path.match(/^\/(?:portfolio|work|projects?)\/([^/]+)$/i)?.[1];

    if (!slug) {
      continue;
    }

    absolute.hash = "";
    const text = visibleCell(match[2]);
    byUrl.set(absolute.href, {
      url: absolute.href,
      slug: slug.toLowerCase(),
      text,
    });
  }

  return [...byUrl.values()];
}

/**
 * @param {string} value
 * @returns {string}
 */
function workSlug(value) {
  return slugifyTopic(value);
}

/**
 * Prefer a case-study URL. Otherwise keep a unique query on the index.
 * @param {Array<Record<string, string>>} works
 * @param {Array<{url: string, slug: string, text: string}>} links
 * @param {string} pageUrl
 */
function assignWorkUrls(works, links, pageUrl) {
  const usedLinks = new Set();
  const usedSlugs = new Set();

  for (const work of works) {
    const keys = [
      workSlug(`${work.client} ${work.project}`),
      workSlug(work.project),
      workSlug(work.client),
    ].filter(Boolean);
    const link = links.find(
      (item) => !usedLinks.has(item.url) && keys.includes(item.slug),
    );

    if (link) {
      work.url = link.url;
      usedLinks.add(link.url);
      continue;
    }

    let slug =
      workSlug(`${work.client} ${work.project} ${work.year}`) || "work";

    while (usedSlugs.has(slug)) {
      slug = `${slug}-2`;
    }

    usedSlugs.add(slug);
    const unique = new URL(pageUrl);
    unique.hash = "";
    unique.searchParams.set("work", slug);
    work.url = unique.href;
  }
}

/**
 * @param {Record<string, string>} work
 * @returns {Array<{slug: string, label: string}>}
 */
export function topicsForWork(work) {
  const sector = String(work?.sector || "");
  const haystack = [sector, work?.project || "", work?.client || ""]
    .filter(Boolean)
    .join(" ");
  /** @type {Map<string, string>} */
  const topics = new Map();

  for (const subject of SECTOR_SUBJECTS) {
    if (subject.pattern.test(haystack) && !isNonSubjectSlug(subject.slug)) {
      topics.set(subject.slug, subject.label);
    }
  }

  const sectorLabel = normalizeExtractedText(sector.replace(/\u00AD/g, ""));
  const sectorSlug = slugifyTopic(sectorLabel);

  if (sectorSlug && !isNonSubjectSlug(sectorSlug) && !topics.has(sectorSlug)) {
    topics.set(sectorSlug, sectorLabel.toLowerCase());
  }

  return [...topics.entries()].map(([slug, label]) => ({ slug, label }));
}

/**
 * @param {string} html
 * @param {string} pageUrl
 * @returns {Array<Record<string, string>>}
 */
export function worksFromPortfolioHtml(html, pageUrl) {
  const tables = String(html || "").match(/<table\b[\s\S]*?<\/table>/gi) || [];
  let works = [];

  for (const table of tables) {
    works = worksFromTable(table);

    if (works.length > 0) {
      break;
    }
  }

  const links = caseStudyLinks(html, pageUrl);

  if (works.length === 0) {
    works = links.slice(0, MAX_PORTFOLIO_WORKS).map((link) => ({
      year: "",
      client: "",
      project: link.text || link.slug.replace(/-/g, " "),
      sector: "",
      location: "",
      url: link.url,
    }));
  } else {
    assignWorkUrls(works, links, pageUrl);
  }

  return works;
}

/**
 * Declared subjects: the site is an online portfolio, plus each work's sectors.
 * @param {Array<Record<string, string>>} works
 * @param {string} pageUrl
 * @param {string} [observedAt]
 * @returns {Array<Record<string, unknown>>}
 */
export function subjectsFromPortfolio(works, pageUrl, observedAt = "") {
  if (!Array.isArray(works) || works.length === 0) {
    return [];
  }

  /** @type {Map<string, {label: string, source: string, pages: Array<{url: string, title: string}>}>} */
  const bySlug = new Map();

  bySlug.set("portfolio", {
    label: "portfolio",
    source: "portfolio:index",
    pages: [{ url: pageUrl, title: "portfolio" }],
  });

  for (const work of works) {
    const title = work.project || work.client || "Work";

    for (const topic of topicsForWork(work)) {
      const existing = bySlug.get(topic.slug) || {
        label: topic.label,
        source: "portfolio:sector",
        pages: [],
      };

      if (existing.pages.length < 8) {
        existing.pages.push({
          url: work.url || pageUrl,
          title,
        });
      }

      bySlug.set(topic.slug, existing);
    }
  }

  return [...bySlug.entries()].map(([slug, entry]) => {
    const evidence = entry.pages
      .map((page) =>
        buildTopicEvidence({
          rawValue: entry.label,
          source: entry.source,
          page: page.url,
          evidenceClass: "declared",
          communityEligible: true,
          observedAt,
        }),
      )
      .filter(Boolean);

    return {
      slug,
      label: entry.label,
      sources: [entry.source],
      pages: entry.pages,
      evidence_class: "declared",
      community_eligible: evidence.length > 0,
      evidence,
    };
  });
}

/**
 * One content item per portfolio work.
 * @param {Array<Record<string, string>>} works
 * @param {{ siteOrigin: string, pageUrl: string, observedAt?: string }} meta
 * @returns {Array<Record<string, unknown>>}
 */
export function contentItemsFromPortfolio(works, meta) {
  const items = [];

  for (const work of works || []) {
    if (!work?.url || !meta?.siteOrigin) {
      continue;
    }

    const title = work.project || work.client || "Work";
    const summary = [
      work.year,
      work.client,
      work.project,
      work.sector,
      work.location,
    ]
      .map((part) => String(part || "").trim())
      .filter((part, index, list) => part && list.indexOf(part) === index)
      .join(" · ");
    const declared_topics = topicsForWork(work).map((topic) => ({
      slug: topic.slug,
      label: topic.label,
      raw_value: topic.label,
      source: "portfolio:sector",
      community_eligible: true,
    }));

    items.push({
      identity: `url:${work.url}`,
      url: work.url,
      site_origin: meta.siteOrigin,
      title,
      summary: summary || null,
      content_type: "project",
      page_role: "project",
      language: "en",
      declared_topics,
      source: { kind: "portfolio", page: meta.pageUrl },
      source_feeds: [{ type: "portfolio", url: meta.pageUrl }],
      observed_at: meta.observedAt || "",
    });
  }

  return items;
}

/**
 * Portfolio facts, declared subjects, and project items from crawled indexes.
 * @param {Array<{url?: string, html?: string}>} pages
 * @param {{ siteOrigin: string, observedAt?: string }} meta
 * @returns {{
 *   profile: {url: string, work_count: number, sectors: string[]} | null,
 *   subjects: Array<Record<string, unknown>>,
 *   items: Array<Record<string, unknown>>,
 * }}
 */
export function collectPortfolio(pages, meta) {
  const empty = { profile: null, subjects: [], items: [] };

  if (!meta?.siteOrigin) {
    return empty;
  }

  for (const page of pages || []) {
    if (
      !page ||
      typeof page.url !== "string" ||
      typeof page.html !== "string"
    ) {
      continue;
    }

    const works = worksFromPortfolioHtml(page.html, page.url);

    if (works.length === 0) {
      continue;
    }

    const sectors = [
      ...new Set(
        works.map((work) => String(work.sector || "").trim()).filter(Boolean),
      ),
    ].sort((left, right) => left.localeCompare(right));

    return {
      profile: {
        url: page.url,
        work_count: works.length,
        sectors,
      },
      subjects: subjectsFromPortfolio(works, page.url, meta.observedAt || ""),
      items: contentItemsFromPortfolio(works, {
        siteOrigin: meta.siteOrigin,
        pageUrl: page.url,
        observedAt: meta.observedAt || "",
      }),
    };
  }

  return empty;
}
