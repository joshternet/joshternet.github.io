/**
 * Goal & Constraints:
 * Versioned slash-page catalog from a reviewed slashpages.net snapshot plus
 * creative publisher paths. Blind probes use probe:true entries only—never
 * invent arbitrary URLs. public_highlight:false keeps sensitive pages out of
 * auto topics/relationship labels. reviewed_at is ISO date of catalog review.
 */

/** @type {number} */
export const SLASH_PAGE_CATALOG_VERSION = 1;

/** @type {string} */
export const SLASH_PAGE_CATALOG_REVIEWED_AT = "2026-10-31";

/**
 * @typedef {{
 *   path: string,
 *   aliases?: string[],
 *   purpose: string,
 *   category: string,
 *   uses: Array<'connections'|'content'|'site-info'>,
 *   probe: boolean,
 *   public_highlight: boolean,
 *   extraction: string,
 * }} SlashPageEntry
 */

/**
 * @param {string} path
 * @param {Partial<SlashPageEntry> & { purpose: string, category: string }} rest
 * @returns {SlashPageEntry}
 */
/**
 * @param {string} path
 * @param {{
 *   purpose: string,
 *   category: string,
 *   aliases?: string[],
 *   uses?: Array<'connections'|'content'|'site-info'>,
 *   probe?: boolean,
 *   public_highlight?: boolean,
 *   extraction?: string,
 * }} rest
 * @returns {SlashPageEntry}
 */
function entry(path, rest) {
  return Object.assign(
    {
      aliases: [],
      uses: /** @type {Array<'connections'|'content'|'site-info'>} */ ([
        "site-info",
      ]),
      probe: true,
      public_highlight: true,
      extraction: "profile",
    },
    rest,
    { path },
  );
}

/** @type {SlashPageEntry[]} */
export const SLASH_PAGE_CATALOG = [
  entry("/about/", {
    aliases: ["/about-me/", "/aboutme/", "/bio/", "/me/"],
    purpose: "About the site owner",
    category: "identity",
    uses: ["connections", "site-info"],
  }),
  // Overlaps `/me/` so identityLikeSlashPaths exercises alias dedupe.
  entry("/profile/", {
    aliases: ["/me/"],
    purpose: "Profile alias of /me/",
    category: "identity",
    uses: ["connections", "site-info"],
  }),
  entry("/ai/", {
    purpose: "How the author uses or avoids AI",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/blank/", {
    purpose: "Intentionally blank page",
    category: "meta",
    uses: ["site-info"],
    public_highlight: false,
    probe: false,
  }),
  entry("/blogroll/", {
    purpose: "Recommended blogs",
    category: "publishing",
    uses: ["connections", "content"],
    extraction: "links",
  }),
  entry("/calendar/", {
    purpose: "Observed cultural dates",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/canon/", {
    purpose: "Influences and annotated bibliography",
    category: "identity",
    uses: ["site-info", "content"],
  }),
  entry("/carry/", {
    purpose: "Everyday carry items",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/caw/", {
    purpose: "Crows",
    category: "identity",
    public_highlight: false,
  }),
  entry("/celebrities/", {
    purpose: "Celebrities spotted or met",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/changelog/", {
    aliases: ["/log/"],
    purpose: "Site change log",
    category: "publishing",
    uses: ["content", "site-info"],
    extraction: "index",
  }),
  entry("/chipotle/", {
    purpose: "Chipotle order preferences",
    category: "identity",
    uses: ["site-info"],
    public_highlight: false,
  }),
  entry("/colophon/", {
    purpose: "How the site is made",
    category: "meta",
    uses: ["site-info"],
  }),
  entry("/community/", {
    purpose: "Community values",
    category: "community",
    uses: ["connections", "site-info"],
  }),
  entry("/concerts/", {
    purpose: "Concerts attended",
    category: "creative",
    uses: ["content", "site-info"],
    extraction: "creative",
  }),
  entry("/contact/", {
    purpose: "Contact methods",
    category: "community",
    uses: ["site-info"],
  }),
  entry("/daylists/", {
    purpose: "Spotify daylists",
    category: "creative",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/death/", {
    purpose: "Instructions after death",
    category: "sensitive",
    uses: ["site-info"],
    public_highlight: false,
    probe: true,
  }),
  entry("/defaults/", {
    purpose: "Default apps",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/disability/", {
    purpose: "Disability information",
    category: "sensitive",
    uses: ["site-info"],
    public_highlight: false,
  }),
  entry("/elsewhere/", {
    aliases: ["/appearances/"],
    purpose: "Output on other sites",
    category: "publishing",
    uses: ["connections", "content"],
    extraction: "links",
  }),
  entry("/follow/", {
    aliases: ["/subscribe/", "/feeds/"],
    purpose: "Feed and subscription links",
    category: "publishing",
    uses: ["content", "site-info"],
    extraction: "feeds",
  }),
  entry("/for/", {
    aliases: ["/dedication/"],
    purpose: "Dedication or thanks",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/glossary/", {
    aliases: ["/lexicon/", "/phrased/"],
    purpose: "Personal glossary",
    category: "identity",
    uses: ["site-info", "content"],
  }),
  entry("/green/", {
    purpose: "Environmental contribution",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/hats/", {
    purpose: "Hats",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/hello/", {
    purpose: "Preferred ways to keep in touch",
    category: "community",
    uses: ["connections", "site-info"],
  }),
  entry("/hills/", {
    aliases: ["/hill/"],
    purpose: "Hills willing to die on",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/ideas/", {
    purpose: "Ideas and concepts",
    category: "creative",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/interests/", {
    purpose: "Passions and interests",
    category: "identity",
    uses: ["content", "site-info"],
  }),
  entry("/junk/", {
    aliases: ["/sale/", "/buy/"],
    purpose: "Indie yard sale",
    category: "community",
    uses: ["site-info"],
  }),
  entry("/languages/", {
    purpose: "Languages spoken or learning",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/links/", {
    aliases: ["/bookmarks/"],
    purpose: "Bookmarks or link directory",
    category: "publishing",
    uses: ["connections", "content"],
    extraction: "links",
  }),
  entry("/next/", {
    purpose: "What is next",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/nope/", {
    purpose: "Things not liked or not done",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/now/", {
    purpose: "Current focus",
    category: "identity",
    uses: ["site-info", "content"],
  }),
  entry("/pfp/", {
    purpose: "Profile picture timeline",
    category: "creative",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/photo/", {
    aliases: ["/pic/"],
    purpose: "Rotating single photo",
    category: "creative",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/podroll/", {
    purpose: "Recommended podcasts",
    category: "publishing",
    uses: ["connections", "content"],
    extraction: "links",
  }),
  entry("/posse/", {
    purpose: "POSSE / cross-posting strategy",
    category: "publishing",
    uses: ["site-info"],
  }),
  entry("/postroll/", {
    purpose: "Impactful posts read",
    category: "publishing",
    uses: ["connections", "content"],
    extraction: "links",
  }),
  entry("/predictions/", {
    purpose: "Forecasts and long-term views",
    category: "identity",
    uses: ["content"],
  }),
  entry("/pricing/", {
    purpose: "Product or service pricing",
    category: "community",
    uses: ["site-info"],
  }),
  entry("/questions/", {
    purpose: "Questions being asked",
    category: "identity",
    uses: ["content"],
  }),
  entry("/saudade/", {
    purpose: "Honoring what is missed",
    category: "sensitive",
    uses: ["site-info"],
    public_highlight: false,
  }),
  entry("/save/", {
    aliases: ["/referrals/"],
    purpose: "Referral links and codes",
    category: "community",
    uses: ["site-info"],
  }),
  entry("/self-hosting/", {
    aliases: ["/self-hosted/", "/hosted/", "/homelab/"],
    purpose: "Self-hosted services",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/shoebox/", {
    purpose: "Odds and ends",
    category: "meta",
    uses: ["site-info"],
  }),
  entry("/since/", {
    purpose: "Habit tracker since dates",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/sitemap/", {
    purpose: "HTML sitemap page",
    category: "meta",
    uses: ["content", "site-info"],
    extraction: "index",
  }),
  entry("/slashes/", {
    purpose: "Index of slash pages on this site",
    category: "meta",
    uses: ["content", "site-info"],
    extraction: "slashes-index",
  }),
  entry("/someday/", {
    purpose: "Someday goals",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/style/", {
    purpose: "Personal or design style guide",
    category: "creative",
    uses: ["content", "site-info"],
  }),
  entry("/til/", {
    aliases: ["/ways/"],
    purpose: "Things learned",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  entry("/tip/", {
    aliases: ["/pay/", "/coffee/"],
    purpose: "Tips and support",
    category: "community",
    uses: ["site-info"],
  }),
  entry("/top4/", {
    aliases: ["/topfour/"],
    purpose: "Top favorites list",
    category: "creative",
    uses: ["content"],
  }),
  entry("/uses/", {
    purpose: "Tools used daily",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/verify/", {
    purpose: "Prove online identities",
    category: "identity",
    uses: ["connections", "site-info"],
    extraction: "links",
  }),
  entry("/where/", {
    purpose: "Current location",
    category: "sensitive",
    uses: ["site-info"],
    public_highlight: false,
  }),
  entry("/why/", {
    purpose: "Purpose of the site or work",
    category: "identity",
    uses: ["site-info", "content"],
  }),
  entry("/wish/", {
    purpose: "Wishlist",
    category: "identity",
    uses: ["site-info"],
  }),
  entry("/yep/", {
    purpose: "Things agreed with or will do",
    category: "identity",
    uses: ["site-info"],
  }),
  // Existing hub identity extras not always on slashpages.net
  entry("/more/", {
    purpose: "More about the site",
    category: "identity",
    uses: ["connections", "site-info"],
  }),
  entry("/site/", {
    purpose: "About this website",
    category: "identity",
    uses: ["connections", "site-info"],
  }),
  entry("/social/", {
    purpose: "Social profiles",
    category: "identity",
    uses: ["connections", "site-info"],
    extraction: "links",
  }),
  entry("/people/", {
    aliases: ["/friends/"],
    purpose: "People directory",
    category: "community",
    uses: ["connections"],
    extraction: "links",
  }),
  entry("/following/", {
    purpose: "Following list",
    category: "publishing",
    uses: ["connections"],
    extraction: "links",
  }),
  entry("/webring/", {
    aliases: ["/webrings/", "/indieweb/", "/neighborhood/"],
    purpose: "Webring or indieweb neighborhood",
    category: "community",
    uses: ["connections"],
    extraction: "links",
  }),
  entry("/guestbook/", {
    purpose: "Guestbook",
    category: "community",
    uses: ["site-info"],
  }),
  entry("/meta/", {
    purpose: "Site meta",
    category: "meta",
    uses: ["site-info"],
  }),
  entry("/health/", {
    purpose: "Health notes",
    category: "sensitive",
    uses: ["site-info"],
    public_highlight: false,
  }),
  // Writing indexes
  entry("/notes/", {
    purpose: "Notes index",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  entry("/blog/", {
    aliases: ["/weblog/"],
    purpose: "Blog index",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  // Overlaps `/weblog/` so writingIndexSlashPaths exercises alias dedupe.
  entry("/writings/", {
    aliases: ["/weblog/"],
    purpose: "Writings index",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  entry("/posts/", {
    aliases: ["/post/"],
    purpose: "Posts index",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  entry("/writing/", {
    purpose: "Writing index",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  entry("/articles/", {
    aliases: ["/article/"],
    purpose: "Articles index",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  entry("/essays/", {
    purpose: "Essays index",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  entry("/journal/", {
    purpose: "Journal index",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  entry("/weeknotes/", {
    purpose: "Weeknotes index",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  entry("/archive/", {
    purpose: "Archive index",
    category: "writing",
    uses: ["content"],
    extraction: "index",
  }),
  entry("/work/", {
    aliases: ["/projects/", "/portfolio/"],
    purpose: "Work or portfolio index",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  // extraction:index on a creative-index is skipped by writingIndexSlashPaths.
  entry("/studio-index/", {
    purpose: "Studio index (creative, not writing)",
    category: "creative-index",
    uses: ["content"],
    extraction: "index",
    probe: false,
  }),
  // Creative publisher paths beyond slashpages.net
  entry("/gallery/", {
    aliases: ["/galleries/", "/albums/"],
    purpose: "Photo or art gallery index",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/photography/", {
    aliases: ["/photos/"],
    purpose: "Photography index",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/art/", {
    aliases: ["/illustration/", "/artwork/"],
    purpose: "Art or illustration index",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/music/", {
    aliases: ["/discography/", "/albums/", "/tracks/"],
    purpose: "Music releases index",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/videos/", {
    aliases: ["/film/", "/animation/"],
    purpose: "Video or animation index",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/games/", {
    aliases: ["/game/", "/interactive/"],
    purpose: "Games or interactive projects",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/exhibitions/", {
    purpose: "Exhibitions",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/design/", {
    purpose: "Design portfolio index",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/apps/", {
    aliases: ["/software/", "/tools/"],
    purpose: "Apps or software projects",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/books/", {
    aliases: ["/guides/", "/resources/"],
    purpose: "Books, guides, or resource indexes",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/experiments/", {
    aliases: ["/sounds/", "/hustles/"],
    purpose: "Experiments, sounds, or side projects",
    category: "creative-index",
    uses: ["content"],
    extraction: "creative",
  }),
  entry("/events/", {
    aliases: ["/shows/", "/gigs/", "/tour/", "/live/"],
    purpose: "Public events, shows, or tour dates",
    category: "events",
    uses: ["content"],
    extraction: "events",
  }),
  entry("/performances/", {
    aliases: ["/readings/", "/workshops/"],
    purpose: "Performances, readings, or workshops",
    category: "events",
    uses: ["content"],
    extraction: "events",
  }),
];

/**
 * Trailing-slash canonical path plus aliases.
 * @param {SlashPageEntry} item
 * @returns {string[]}
 */
export function pathsForEntry(item) {
  const out = [];
  const seen = new Set();

  const aliases = Array.isArray(item.aliases) ? item.aliases : [];

  for (const raw of [item.path, ...aliases]) {
    const normalized = normalizeSlashPath(raw);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeSlashPath(value) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();

  if (text === "" || text === "/") {
    return "";
  }

  const bare = text.replace(/^\/+/, "").replace(/\/+$/, "");

  if (!bare) {
    return "";
  }

  return `/${bare}/`;
}

/**
 * All unique probe paths (canonical + aliases) for blind probing.
 * @returns {string[]}
 */
export function probeSlashPaths() {
  const out = [];
  const seen = new Set();

  for (const item of SLASH_PAGE_CATALOG) {
    if (!item.probe) {
      continue;
    }

    for (const path of pathsForEntry(item)) {
      if (seen.has(path)) {
        continue;
      }

      seen.add(path);
      out.push(path);
    }
  }

  return out;
}

/**
 * Paths treated as identity/slash soft-404 candidates.
 * @returns {string[]}
 */
export function identityLikeSlashPaths() {
  const categories = new Set([
    "identity",
    "community",
    "publishing",
    "meta",
    "sensitive",
  ]);
  const out = [];
  const seen = new Set();

  for (const item of SLASH_PAGE_CATALOG) {
    if (!categories.has(item.category)) {
      continue;
    }

    for (const path of pathsForEntry(item)) {
      if (seen.has(path)) {
        continue;
      }

      seen.add(path);
      out.push(path);
    }
  }

  return out;
}

/**
 * Writing and content index paths.
 * @returns {string[]}
 */
export function writingIndexSlashPaths() {
  const out = [];
  const seen = new Set();

  for (const item of SLASH_PAGE_CATALOG) {
    if (item.category !== "writing" && item.extraction !== "index") {
      continue;
    }

    // Creative indexes use creativeIndexSlashPaths even if extraction is index.
    if (item.category === "creative-index") {
      continue;
    }

    for (const path of pathsForEntry(item)) {
      if (seen.has(path)) {
        continue;
      }

      seen.add(path);
      out.push(path);
    }
  }

  return out;
}

/**
 * Creative index paths (galleries, music, games, portfolio).
 * @returns {string[]}
 */
export function creativeIndexSlashPaths() {
  const out = [];
  const seen = new Set();

  for (const item of SLASH_PAGE_CATALOG) {
    if (item.category !== "creative-index" && item.extraction !== "creative") {
      continue;
    }

    for (const path of pathsForEntry(item)) {
      if (seen.has(path)) {
        continue;
      }

      seen.add(path);
      out.push(path);
    }
  }

  return out;
}

/**
 * True when a slash path must not auto-become a public topic/relationship label.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isNonHighlightSlashPath(pathname) {
  const normalized = normalizeSlashPath(pathname);

  if (!normalized) {
    return false;
  }

  for (const item of SLASH_PAGE_CATALOG) {
    if (item.public_highlight) {
      continue;
    }

    if (pathsForEntry(item).includes(normalized)) {
      return true;
    }
  }

  return false;
}
