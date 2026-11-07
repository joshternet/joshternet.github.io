/**
 * Goal & Constraints:
 * Append-only local crawl cache for development. Production CI never reads
 * or writes it. Existing bodies and manifest rows stay when a later crawl
 * stores a new hash.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadHtml } from "../nlp/structured-html.mjs";
import { isHubOrigin } from "./constants.mjs";

/** Relative directory. Gitignored. Not the member history and not the content prune cache. */
export const DEV_CACHE_DIR = "data/dev-crawl-cache";

/** Max new non-Joshternet personal sites one local intake run may add. */
export const LOCAL_NONJOSHTERNET_INTAKE_LIMIT = 5;

/** Sidecar listing origins appended by this run's uses.tech fetch. */
export const LOCAL_INTAKE_FILE = "intake-origins.json";

/**
 * Absolute cache directory.
 * @param {string} [repoRoot]
 * @returns {string}
 */
export function devCacheRoot(repoRoot = process.cwd()) {
  return path.join(repoRoot, DEV_CACHE_DIR);
}

/**
 * True on a developer machine. GitHub Actions and CI=1 stay out of the cache.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function devCacheEnabled(env = process.env) {
  const source = env || {};
  if (
    source.CI === "true" ||
    source.CI === "1" ||
    source.GITHUB_ACTIONS === "true"
  ) {
    return false;
  }
  return true;
}

/**
 * @param {string} seed
 * @param {string} value
 * @returns {string}
 */
function seededRank(seed, value) {
  return createHash("sha256").update(`${seed}\n${value}`).digest("hex");
}

/**
 * Hosts that are not one person's site. Crawling the origin would walk the
 * whole platform (github.com) instead of a personal Uses page.
 * github.io stays allowed: that host is a personal site.
 * @param {unknown} hostname
 * @returns {boolean}
 */
export function isSharedPlatformHost(hostname) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
  if (!host) {
    return false;
  }
  return SHARED_PLATFORM_HOSTS.some(
    (platform) => host === platform || host.endsWith(`.${platform}`),
  );
}

/** @type {readonly string[]} */
const SHARED_PLATFORM_HOSTS = [
  "bitbucket.org",
  "codeberg.org",
  "facebook.com",
  "github.com",
  "gitlab.com",
  "instagram.com",
  "linkedin.com",
  "notion.so",
  "npmjs.com",
  "reddit.com",
  "twitter.com",
  "wikipedia.org",
  "x.com",
  "youtube.com",
  "youtu.be",
];

/**
 * Stable order for two Uses URLs. Negative when left sorts first.
 * @param {string} seed
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
export function compareUsesUrls(seed, left, right) {
  const leftRank = seededRank(seed, left);
  const rightRank = seededRank(seed, right);
  if (leftRank < rightRank) {
    return -1;
  }
  return 1;
}

/**
 * Links on the uses.tech directory that point at a Uses page.
 * @param {string} html
 * @returns {string[]}
 */
export function usesTechHrefs(html) {
  const $ = loadHtml(html);
  /** @type {string[]} */
  const hrefs = [];
  $("a[href]").each((_, anchor) => {
    const href = String($(anchor).attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
      return;
    }
    hrefs.push(href);
  });
  return hrefs;
}

/**
 * New Uses page URLs, in a stable seeded order, skipping ones already cached.
 * @param {string[]} hrefs
 * @param {{ seed?: string, limit?: number, already?: Iterable<string> }} [options]
 * @returns {string[]}
 */
export function selectNewUsesLinks(hrefs, options = {}) {
  const already = new Set(
    [...(options.already || [])].map((value) => String(value)),
  );
  /** @type {string[]} */
  const candidates = [];
  for (const href of hrefs || []) {
    let parsed;
    try {
      parsed = new URL(String(href));
    } catch {
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      continue;
    }
    if (isSharedPlatformHost(parsed.hostname)) {
      continue;
    }
    if (!/uses/i.test(parsed.pathname)) {
      continue;
    }
    const normalized = parsed.toString();
    if (already.has(normalized) || candidates.includes(normalized)) {
      continue;
    }
    candidates.push(normalized);
  }
  const seed = options.seed || "uses-tech";
  candidates.sort((left, right) => compareUsesUrls(seed, left, right));
  const limit = Number.isFinite(options.limit)
    ? options.limit
    : LOCAL_NONJOSHTERNET_INTAKE_LIMIT;
  return candidates.slice(0, Math.max(0, limit));
}

/**
 * Picks at most `limit` cached personal sites that are not already known.
 * @param {Array<{ origin?: string }>} [candidates]
 * @param {{ already?: Iterable<string>, limit?: number }} [options]
 * @returns {object[]}
 */
export function selectLocalDevCacheIntake(candidates, options = {}) {
  const already = new Set(
    [...(options.already || [])]
      .map((value) => String(value || "").replace(/\/$/, ""))
      .filter(Boolean),
  );
  const rawLimit = Number(options.limit);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(0, Math.floor(rawLimit))
    : LOCAL_NONJOSHTERNET_INTAKE_LIMIT;
  /** @type {object[]} */
  const selected = [];
  for (const site of candidates || []) {
    if (selected.length >= limit) {
      break;
    }
    const origin = siteOrigin(site && site.origin);
    if (!origin || already.has(origin)) {
      continue;
    }
    already.add(origin);
    selected.push(site);
  }
  return selected;
}

/**
 * Writes the origins this uses.tech fetch successfully added.
 * @param {string} root
 * @param {string[]} origins
 * @returns {Promise<void>}
 */
export async function writeLocalIntakeOrigins(root, origins) {
  const unique = [
    ...new Set(
      (Array.isArray(origins) ? origins : [])
        .map((origin) => siteOrigin(origin))
        .filter(Boolean),
    ),
  ];
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, LOCAL_INTAKE_FILE),
    `${JSON.stringify({
      generated_at: new Date().toISOString(),
      origins: unique,
    })}\n`,
    "utf8",
  );
}

/**
 * Origins listed for this local non-Joshternet intake, if any.
 * @param {string} root
 * @returns {Promise<string[]>}
 */
export async function readLocalIntakeOrigins(root) {
  try {
    const parsed = JSON.parse(
      await readFile(path.join(root, LOCAL_INTAKE_FILE), "utf8"),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }
    const origins = Array.isArray(parsed.origins) ? parsed.origins : [];
    return [
      ...new Set(origins.map((origin) => siteOrigin(origin)).filter(Boolean)),
    ];
  } catch (error) {
    if (error && /** @type {{ code?: string }} */ (error).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Clears the intake sidecar after network and NLP have consumed it.
 * @param {string} root
 * @returns {Promise<void>}
 */
export async function clearLocalIntakeOrigins(root) {
  try {
    await writeFile(
      path.join(root, LOCAL_INTAKE_FILE),
      `${JSON.stringify({ generated_at: new Date().toISOString(), origins: [] })}\n`,
      "utf8",
    );
  } catch (error) {
    if (error && /** @type {{ code?: string }} */ (error).code === "ENOENT") {
      return;
    }
    throw error;
  }
}

/**
 * @param {string} root
 * @returns {Promise<object[]>}
 */
async function readManifest(root) {
  try {
    const parsed = JSON.parse(
      await readFile(path.join(root, "manifest.json"), "utf8"),
    );
    if (!Array.isArray(parsed)) {
      throw new Error("dev crawl cache manifest is not a list");
    }
    return parsed;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * @param {string} root
 * @param {string} body
 * @param {string} extension
 * @returns {Promise<string>}
 */
async function storeBody(root, body, extension) {
  const hash = createHash("sha256").update(body).digest("hex");
  const file = path.join(root, "bodies", `${hash}.${extension}`);
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await writeFile(file, body, { flag: "wx" });
  } catch (error) {
    const code = /** @type {{ code?: string }} */ (error).code;
    if (code === "EEXIST") {
      return hash;
    }
    throw error;
  }
  return hash;
}

/**
 * Appends one record. Never removes an older body or manifest row.
 * @param {string} root
 * @param {object} record
 * @param {string} body
 * @param {string} extension
 * @returns {Promise<number>}
 */
async function appendRecord(root, record, body, extension) {
  const hash = await storeBody(root, body, extension);
  const manifest = await readManifest(root);
  manifest.push({
    ...record,
    hash,
    stored_at: new Date().toISOString(),
  });
  await writeFile(
    path.join(root, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return 1;
}

/**
 * Copies a member crawl into the dev cache when the cache is enabled.
 * @param {object} input
 * @param {boolean} input.enabled
 * @param {string} input.root
 * @param {string} input.origin
 * @param {Array<{ url?: string, html?: string }>} [input.pages]
 * @param {Array<{ url?: string, html?: string }>} [input.usesPages]
 * @param {Array<{ url?: string, html?: string }>} [input.seekingPages]
 * @param {object[]} [input.subjects]
 * @returns {Promise<{ appended: number }>}
 */
export async function rememberMemberCrawl(input) {
  if (!input || input.enabled !== true) {
    return { appended: 0 };
  }
  const root = input.root;
  const origin = String(input.origin || "");
  let appended = 0;
  const groups = [
    ["page", input.pages],
    ["uses", input.usesPages],
    ["seeking", input.seekingPages],
  ];
  for (const [kind, pages] of groups) {
    for (const page of pages || []) {
      if (!page || typeof page.html !== "string" || !page.html || !page.url) {
        continue;
      }
      appended += await appendRecord(
        root,
        { origin, url: page.url, kind },
        page.html,
        "html",
      );
    }
  }
  if (Array.isArray(input.subjects) && input.subjects.length > 0) {
    appended += await appendRecord(
      root,
      { origin, url: origin, kind: "subjects" },
      JSON.stringify(input.subjects),
      "json",
    );
  }
  return { appended };
}

/**
 * True for a gone Uses page. Other failures stay retryable on the next run.
 * @param {unknown} message
 * @returns {boolean}
 */
export function isPermanentUsesMiss(message) {
  return /^HTTP (404|410)( |$)/.test(String(message || ""));
}

/**
 * Remembers a Uses URL that will not be fetched again.
 * @param {{ root?: string, url?: string, reason?: string }} input
 * @returns {Promise<void>}
 */
export async function rememberUnavailableUsesPage(input) {
  const root = input?.root || "";
  const url = String(input?.url || "");
  if (!root || !url) {
    return;
  }
  const manifest = await readManifest(root);
  if (
    manifest.some(
      (row) => row && row.kind === "uses-unavailable" && row.url === url,
    )
  ) {
    return;
  }
  let origin = "";
  try {
    origin = new URL(url).origin;
  } catch {
    origin = "";
  }
  manifest.push({
    origin,
    url,
    kind: "uses-unavailable",
    reason: String(input.reason || ""),
    stored_at: new Date().toISOString(),
  });
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

/**
 * Uses URLs already recorded as gone, so a later batch can pick new pages.
 * @param {string} root
 * @returns {Promise<string[]>}
 */
export async function unavailableUsesUrls(root) {
  let manifest = [];
  try {
    manifest = await readManifest(root);
  } catch {
    return [];
  }
  return manifest
    .filter((row) => row && row.kind === "uses-unavailable" && row.url)
    .map((row) => String(row.url));
}

/**
 * Latest cached Uses HTML per URL, grouped by origin.
 * @param {string} root
 * @returns {Promise<Array<{ origin: string, pages: Array<{ url: string, html: string }> }>>}
 */
export async function latestUsesOrigins(root) {
  let manifest = [];
  try {
    manifest = await readManifest(root);
  } catch {
    return [];
  }
  /** @type {Map<string, { origin: string, url: string, hash: string }>} */
  const byUrl = new Map();
  for (const row of manifest) {
    if (!row || !row.url || !row.hash) {
      continue;
    }
    const kind = String(row.kind || "");
    if (kind === "uses-unavailable") {
      continue;
    }
    const usesUrl = /\/uses(?:\/|\.html?)?(?:$|\?)/i.test(String(row.url));
    if (kind !== "uses" && kind !== "uses-tech" && !usesUrl) {
      continue;
    }
    byUrl.set(String(row.url), {
      origin: String(row.origin || ""),
      url: String(row.url),
      hash: String(row.hash),
    });
  }
  /** @type {Map<string, Array<{ url: string, html: string }>>} */
  const pagesByOrigin = new Map();
  for (const row of byUrl.values()) {
    let html = "";
    try {
      html = await readFile(
        path.join(root, "bodies", `${row.hash}.html`),
        "utf8",
      );
    } catch {
      continue;
    }
    let origin = row.origin;
    if (!origin) {
      try {
        origin = new URL(row.url).origin;
      } catch {
        continue;
      }
    }
    const pages = pagesByOrigin.get(origin) || [];
    pages.push({ url: row.url, html });
    pagesByOrigin.set(origin, pages);
  }
  return [...pagesByOrigin.entries()].map(([origin, pages]) => ({
    origin,
    pages,
  }));
}

/**
 * Canonical http(s) origin, or an empty string when the value is not one.
 * @param {unknown} value
 * @returns {string}
 */
function siteOrigin(value) {
  if (typeof value !== "string" || !value) {
    return "";
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    if (url.username || url.password) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

/**
 * Participant records for personal sites known only from the local cache.
 * They stay undeclared. The normal crawl still applies the public-URL and
 * robots checks; this does not mark a declaration check as valid.
 * @param {Array<{ origin?: string }>} [origins]
 * @param {string} [observedAt]
 * @returns {object[]}
 */
export function participantsFromCachedOrigins(
  origins,
  observedAt = "2026-01-01T00:00:00.000Z",
) {
  /** @type {object[]} */
  const participants = [];
  const seen = new Set();
  for (const row of origins || []) {
    const origin = siteOrigin(row && row.origin);
    if (!origin || seen.has(origin) || isHubOrigin(origin)) {
      continue;
    }
    if (isSharedPlatformHost(new URL(origin).hostname)) {
      continue;
    }
    seen.add(origin);
    const declaration = { version: 1 };
    participants.push({
      origin,
      domain: new URL(origin).host,
      identity: "undeclared",
      declaration,
      initial_declaration: { version: 1 },
      first_participated_at: observedAt,
      latest_declaration_check_at: observedAt,
      latest_declaration_check_outcome: "local",
    });
  }
  return participants;
}

/**
 * Personal sites from the local cache. Disabled runs do not read the cache.
 * @param {string} root
 * @param {boolean} enabled
 * @returns {Promise<object[]>}
 */
export async function localDevCacheParticipants(root, enabled) {
  if (enabled !== true) {
    return [];
  }
  return participantsFromCachedOrigins(await latestUsesOrigins(root));
}

/**
 * Drops local-only sites unless this process is allowed to show them.
 * Registry participants stay either way.
 * @param {object[]} [participants]
 * @param {boolean} enabled
 * @returns {object[]}
 */
export function participantsForThisRun(participants, enabled) {
  const list = Array.isArray(participants) ? participants : [];
  return list.filter((entry) => {
    if (!entry || typeof entry.origin !== "string" || !entry.origin) {
      return false;
    }
    if (entry.local_dev_cache === true) {
      return enabled === true;
    }
    return true;
  });
}

/**
 * Splits a crawl into the durable member ledger and the local-only preview.
 * Cached origins already present in either list are not repeated.
 * @param {object[]} [inputs]
 * @param {object[]} [cached]
 * @returns {{ ledger: object[], preview: object[] }}
 */
export function splitUsesPreviewInputs(inputs, cached) {
  const list = Array.isArray(inputs) ? inputs : [];
  const ledger = list.filter(
    (entry) => entry && entry.local_dev_cache !== true,
  );
  const local = list.filter((entry) => entry && entry.local_dev_cache === true);
  const seen = new Set(
    [...ledger, ...local].map((entry) =>
      entry && typeof entry.origin === "string" ? entry.origin : "",
    ),
  );
  /** @type {object[]} */
  const fromCache = [];
  for (const entry of cached || []) {
    const origin =
      entry && typeof entry.origin === "string" ? entry.origin : "";
    if (!origin || seen.has(origin)) {
      continue;
    }
    seen.add(origin);
    fromCache.push(entry);
  }
  return { ledger, preview: [...local, ...fromCache] };
}
