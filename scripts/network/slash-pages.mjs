/**
 * Goal & Constraints:
 * Shared indieweb slash-page path lists for NLP crawl seeds and network
 * identity-page visits. Keep paths trailing-slash form; consumers normalize.
 * Inputs: none. Outputs: path constants only. Do not add runtime fetches here.
 */

/** Indieweb / about / link-directory pages that often hold member-to-member links. */
export const IDENTITY_SLASH_PATHS = [
  "/about/",
  "/me/",
  "/now/",
  "/uses/",
  "/more/",
  "/site/",
  "/social/",
  "/links/",
  "/people/",
  "/friends/",
  "/blogroll/",
  "/elsewhere/",
  "/following/",
  "/bookmarks/",
  "/colophon/",
  "/webring/",
  "/webrings/",
  "/indieweb/",
  "/hello/",
  "/guestbook/",
  "/neighborhood/",
  "/meta/",
  "/interests/",
  "/health/",
  "/homelab/",
];

/** Publisher writing indexes that often omit themselves from sitemap.xml. */
export const WRITING_INDEX_PATHS = [
  "/notes/",
  "/blog/",
  "/posts/",
  "/post/",
  "/writing/",
  "/articles/",
  "/article/",
  "/work/",
  "/projects/",
  "/archive/",
  "/essays/",
  "/journal/",
  "/log/",
  "/weeknotes/",
];

/**
 * Deduped content-index seeds: writing indexes plus identity slash pages.
 * @returns {string[]}
 */
export function contentIndexPaths() {
  const seen = new Set();
  const paths = [];

  for (const path of [...WRITING_INDEX_PATHS, ...IDENTITY_SLASH_PATHS]) {
    if (seen.has(path)) {
      continue;
    }

    seen.add(path);
    paths.push(path);
  }

  return paths;
}
