/**
 * Goal & Constraints:
 * Query octothorp.es for publisher terms scoped to current participants.
 */

import { fetchPublicText, slugifyTopic, normalizeText } from "./lib.mjs";
import { originFromHttpUrl } from "../network/blogroll.mjs";

const OP_BASE = "https://octothorp.es";

/**
 * @param {string} origin
 * @param {Map<string, unknown>} [cache]
 * @returns {Promise<Array<{slug: string, label: string, sources: string[], pages: Array<{url: string, title: string}>}>>}
 */
export async function subjectsFromOctothorpes(origin, cache = new Map()) {
  const subjects = [];

  try {
    const thorpes = await fetchPublicText(
      `${OP_BASE}/get/thorpes/posted?s=${encodeURIComponent(origin)}&limit=50`,
      { cache, accept: "application/json" },
    );
    const parsed = JSON.parse(thorpes.body);
    const results = Array.isArray(parsed?.results) ? parsed.results : [];

    for (const entry of results) {
      const term =
        typeof entry?.term === "string"
          ? entry.term
          : typeof entry === "string"
            ? entry
            : "";
      const label = normalizeText(term);
      const slug = slugifyTopic(label);

      if (!slug) {
        continue;
      }

      subjects.push({
        slug,
        label,
        sources: ["octothorpe"],
        pages: [],
      });
    }
  } catch {
    return subjects;
  }

  for (const subject of subjects.slice(0, 20)) {
    try {
      const pages = await fetchPublicText(
        `${OP_BASE}/get/pages/thorped?o=${encodeURIComponent(subject.label)}&limit=30`,
        { cache, accept: "application/json" },
      );
      const parsed = JSON.parse(pages.body);
      const results = Array.isArray(parsed?.results) ? parsed.results : [];

      for (const page of results) {
        const uri = typeof page?.uri === "string" ? page.uri : page?.["@id"];

        if (typeof uri !== "string") {
          continue;
        }

        try {
          if (originFromHttpUrl(uri) !== origin) {
            continue;
          }
        } catch {
          continue;
        }

        subject.pages.push({
          url: uri,
          title: typeof page?.title === "string" ? page.title : "",
        });
      }

      subject.pages = subject.pages.slice(0, 5);
    } catch {
      continue;
    }
  }

  return subjects;
}
