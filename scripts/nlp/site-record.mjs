/**
 * Goal & Constraints:
 * One private JSON record per crawled site, and one short-key encoding for
 * every crawl JSON file. Clear names stay in memory. Disk is compact and
 * carries no page HTML. Hand-edited config stays readable.
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** @type {Readonly<Record<string, string>>} */
export const CRAWL_KEYS = Object.freeze({
  a: "k0",
  accepted_count: "k1",
  actions: "k2",
  active: "k3",
  active_member_count: "k4",
  active_member_origins: "k5",
  adoption_score: "k6",
  advertisement_count: "k7",
  advertisements: "k8",
  aggregation_version: "k9",
  aliases: "ka",
  art: "kb",
  articles: "kc",
  as_of: "kd",
  assessment: "ke",
  b: "kf",
  blogroll: "kg",
  blogrolls: "kh",
  books: "ki",
  broader: "kj",
  captured_at: "kk",
  catalog_hash: "kl",
  categories: "km",
  category_id: "kn",
  change_from_previous_period: "ko",
  channel: "kp",
  checks: "kq",
  class: "kr",
  classNames: "ks",
  collected: "kt",
  communities: "ku",
  community_count: "kv",
  community_eligible: "kw",
  community_slugs: "kx",
  community_topics: "ky",
  complete: "kz",
  connection: "k10",
  connection_count: "k11",
  connections: "k12",
  content: "k13",
  content_count: "k14",
  content_hash: "k15",
  content_hash_source: "k16",
  content_type: "k17",
  content_types: "k18",
  context: "k19",
  cooccurrence: "k1a",
  count: "k1b",
  coverage: "k1c",
  coverage_note: "k1d",
  crawled_at: "k1e",
  data_manifest: "k1f",
  datasets: "k1g",
  date: "k1h",
  declaration: "k1i",
  declared_topic_count: "k1j",
  declared_topics: "k1k",
  denominator: "k1l",
  denominator_note: "k1m",
  description: "k1n",
  descriptions: "k1o",
  dir: "k1p",
  directed: "k1q",
  discovery: "k1r",
  distinct_tool_count: "k1s",
  document_count: "k1t",
  documents: "k1u",
  domain: "k1v",
  early_sample: "k1w",
  edge_count: "k1x",
  edges: "k1y",
  eligible_member_count: "k1z",
  elsewhere: "k20",
  embeddable: "k21",
  endpoints: "k22",
  event_id: "k23",
  event_type: "k24",
  events: "k25",
  evidence: "k26",
  evidence_class: "k27",
  evidence_count: "k28",
  evidence_event_id: "k29",
  excerpt: "k2a",
  extracted: "k2b",
  extractor_version: "k2c",
  extractors: "k2d",
  failed: "k2e",
  feed: "k2f",
  feeds: "k2g",
  fetch_limit: "k2h",
  first_observed_at: "k2i",
  first_participated_at: "k2j",
  first_seen_at: "k2k",
  first_valid_observation_at: "k2l",
  frame_reason: "k2m",
  fresh: "k2n",
  from: "k2o",
  from_title: "k2p",
  games: "k2q",
  generated_at: "k2r",
  granularity: "k2s",
  graph: "k2t",
  group_by_year: "k2u",
  hash: "k2v",
  home: "k2w",
  homepage_duplicate: "k2x",
  href: "k2y",
  html: "k2z",
  id: "k30",
  identity: "k31",
  image: "k32",
  image_origin: "k33",
  in_denominator: "k34",
  incoming: "k35",
  initial_declaration: "k36",
  is_complete: "k37",
  item_count: "k38",
  item_name: "k39",
  items: "k3a",
  josh: "k3b",
  kind: "k3c",
  kind_label: "k3d",
  kind_labels: "k3e",
  kinds: "k3f",
  label: "k3g",
  lang: "k3h",
  language: "k3i",
  last_changed_at: "k3j",
  last_checked: "k3k",
  last_event_at: "k3l",
  last_valid_observation_at: "k3m",
  latest_declaration_check_at: "k3n",
  latest_declaration_check_outcome: "k3o",
  ledger: "k3p",
  left: "k3q",
  limit_reached: "k3r",
  local_dev_cache: "k3s",
  locales: "k3t",
  member_count: "k3u",
  members: "k3v",
  membership: "k3w",
  membership_rule: "k3x",
  merged_identities: "k3y",
  method: "k3z",
  methodology_url: "k40",
  moved_to_detail: "k41",
  name: "k42",
  neighborhood: "k43",
  neighborhoods: "k44",
  network: "k45",
  nodes: "k46",
  noindex: "k47",
  note: "k48",
  observed_at: "k49",
  occurrence_count: "k4a",
  origin: "k4b",
  origins: "k4c",
  outbound_link_count: "k4d",
  outbound_links: "k4e",
  outcome: "k4f",
  outgoing: "k4g",
  overlap_count: "k4h",
  page: "k4i",
  page_role: "k4j",
  page_status: "k4k",
  page_updated: "k4l",
  page_url: "k4m",
  pages: "k4n",
  pages_discovered: "k4o",
  pages_fetched: "k4p",
  pairs: "k4q",
  parent_slot: "k4r",
  participant_count: "k4s",
  period: "k4t",
  period_complete: "k4u",
  period_end_exclusive: "k4v",
  period_ever_member_count: "k4w",
  period_start: "k4x",
  periods: "k4y",
  photography: "k4z",
  podcasts: "k50",
  portfolio: "k51",
  poster_image: "k52",
  preference: "k53",
  primary: "k54",
  primary_count: "k55",
  products: "k56",
  project: "k57",
  publication_count: "k58",
  publish_enabled: "k59",
  published_at: "k5a",
  raw_value: "k5b",
  reason: "k5c",
  recent: "k5d",
  recent_content: "k5e",
  recent_count: "k5f",
  record_version: "k5g",
  rejected_fragments: "k5h",
  rel: "k5i",
  related: "k5j",
  related_discoveries: "k5k",
  relation: "k5l",
  relationship_evidence: "k5m",
  relationships: "k5n",
  relevance: "k5o",
  request_count: "k5p",
  request_published: "k5q",
  request_updated: "k5r",
  requests: "k5s",
  require_context: "k5t",
  retired: "k5u",
  right: "k5v",
  role: "k5w",
  rule: "k5x",
  schema_types: "k5y",
  schema_version: "k5z",
  schemas: "k60",
  scope: "k61",
  scoring_version: "k62",
  screenshot: "k63",
  section: "k64",
  section_path: "k65",
  sectors: "k66",
  selection: "k67",
  selection_reasons: "k68",
  selection_strategy: "k69",
  semantic_hashes: "k6a",
  semantic_role: "k6b",
  setup: "k6c",
  share_description: "k6d",
  show: "k6e",
  site_origin: "k6f",
  site_signals: "k6g",
  site_title: "k6h",
  sites: "k6i",
  slot_assignments: "k6j",
  slot_id: "k6k",
  slot_name: "k6l",
  slot_rules: "k6m",
  slots: "k6n",
  slug: "k6o",
  snapshot_id: "k6p",
  source: "k6q",
  source_authority: "k6r",
  source_coverage: "k6s",
  source_feeds: "k6t",
  source_hash: "k6u",
  source_kind: "k6v",
  source_url: "k6w",
  sources: "k6x",
  split_compounds: "k6y",
  statements: "k6z",
  stats: "k70",
  status: "k71",
  stored_id: "k72",
  subject_signal_count: "k73",
  subject_signals: "k74",
  subjects: "k75",
  summary: "k76",
  supported_periods: "k77",
  tags: "k78",
  taxonomy_version: "k79",
  text: "k7a",
  through_event_id: "k7b",
  title: "k7c",
  to: "k7d",
  to_title: "k7e",
  tool_count: "k7f",
  tool_id: "k7g",
  tools: "k7h",
  top_tools: "k7i",
  topics: "k7j",
  transformations: "k7k",
  trend_ready: "k7l",
  type: "k7m",
  unsorted: "k7n",
  url: "k7o",
  use_case_counts: "k7p",
  use_case_ids: "k7q",
  use_cases: "k7r",
  value: "k7s",
  vendor: "k7t",
  verified_item_count: "k7u",
  verified_uses_member_count: "k7v",
  version: "k7w",
  video: "k7x",
  website: "k7y",
  website_count: "k7z",
  why: "k80",
  window_days: "k81",
  work_count: "k82",
  body: "k83",
  community: "k84",
  content_html: "k85",
  seeking: "k86",
  signals: "k87",
  uses: "k88",
  start: "k89",
  end: "k8a",
  venue: "k8b",
  location: "k8c",
  site_count: "k8d",
  attribution_role: "k8e",
  conference: "k8f",
  start_precision: "k8g",
  resources: "k8h",
});

/** Keys whose values are page bodies and must not be written. */
const OMITTED_BODY_KEYS = new Set(["html", "content_html", "body"]);

const REVERSE_KEYS = new Map(
  Object.entries(CRAWL_KEYS).map(([clear, short]) => [short, clear]),
);

const SEAL = "joshternet-site-record-v1";

/**
 * @param {string} key
 * @returns {string}
 */
function sealKey(key) {
  const bytes = Buffer.from(key, "utf8");
  const out = Buffer.alloc(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    out[index] = bytes[index] ^ SEAL.charCodeAt(index % SEAL.length);
  }
  return `z${out.toString("base64url")}`;
}

/**
 * @param {string} key
 * @returns {string}
 */
function unsealKey(key) {
  const bytes = Buffer.from(key.slice(1), "base64url");
  const out = Buffer.alloc(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    out[index] = bytes[index] ^ SEAL.charCodeAt(index % SEAL.length);
  }
  return out.toString("utf8");
}

/**
 * @param {string} key
 * @returns {string}
 */
export function encodeCrawlKey(key) {
  const mapped = CRAWL_KEYS[key];
  if (mapped) {
    return mapped;
  }
  if (REVERSE_KEYS.has(key) || (key.startsWith("z") && key.length > 1)) {
    return key;
  }
  return sealKey(key);
}

/**
 * @param {string} key
 * @returns {string}
 */
export function decodeCrawlKey(key) {
  const clear = REVERSE_KEYS.get(key);
  if (clear) {
    return clear;
  }
  if (key.startsWith("z") && key.length > 1) {
    return unsealKey(key);
  }
  return key;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function encodeCrawlValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => encodeCrawlValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  /** @type {Record<string, unknown>} */
  const encoded = {};
  for (const [key, child] of Object.entries(value)) {
    if (OMITTED_BODY_KEYS.has(key)) {
      continue;
    }
    encoded[encodeCrawlKey(key)] = encodeCrawlValue(child);
  }
  return encoded;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function decodeCrawlValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => decodeCrawlValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  /** @type {Record<string, unknown>} */
  const decoded = {};
  for (const [key, child] of Object.entries(value)) {
    decoded[decodeCrawlKey(key)] = decodeCrawlValue(child);
  }
  return decoded;
}

/**
 * Crawl JSON is encoded on write. Hand-edited config and the Uses catalog stay
 * clear. Matches absolute and relative paths (e.g. `_data/network.json`).
 * @param {string} filePath
 * @returns {boolean}
 * @remarks
 * Writers encode when this returns true. Pipeline reads decode back to clear
 * names. Jekyll Liquid has no decode and must use short keys on encoded files.
 * Some page scripts may call `joshternetDecodeCrawl` after fetch/bootstrap.
 */
export function isCrawlJsonPath(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  if (!normalized.endsWith(".json")) {
    return false;
  }
  if (
    /(?:^|\/)_data\/(?:topic_aliases|topic_denylist|network_display_titles|network_dev|network_preview|content_support_matrix)\.json$/.test(
      normalized,
    )
  ) {
    return false;
  }
  if (/(?:^|\/)_data\/[^/]+\.json$/.test(normalized)) {
    return true;
  }
  if (/(?:^|\/)assets\/data\/uses\/.+\.json$/.test(normalized)) {
    return true;
  }
  if (/(?:^|\/)data\/uses\/catalog\//.test(normalized)) {
    return false;
  }
  if (/(?:^|\/)data\/uses\/.+\.json$/.test(normalized)) {
    return true;
  }
  if (/(?:^|\/)data\/crawl-sites\/.+\.json$/.test(normalized)) {
    return true;
  }
  if (
    /(?:^|\/)data\/classification\/quality-baseline\.json$/.test(normalized)
  ) {
    return true;
  }
  if (/\/seeking-state\.json$/.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * @param {string} origin
 * @returns {string}
 */
export function originRecordId(origin) {
  return createHash("sha256").update(String(origin)).digest("hex").slice(0, 32);
}

/**
 * @param {string} root
 * @returns {string}
 */
export function crawlSitesDir(root) {
  return path.join(root, "data", "crawl-sites");
}

/**
 * @param {unknown} page
 * @returns {boolean}
 */
function pageHasBody(page) {
  if (!page || typeof page !== "object") {
    return false;
  }
  const record = /** @type {Record<string, unknown>} */ (page);
  return ["html", "content_html", "text", "body"].some(
    (key) => typeof record[key] === "string" && record[key] !== "",
  );
}

/**
 * Builds the clear in-memory site record. Page bodies are rejected.
 * @param {Record<string, unknown>} input
 * @returns {Record<string, unknown>}
 * @throws {Error} When a page still carries HTML or text.
 */
export function buildSiteRecord(input) {
  const pages = Array.isArray(input.pages) ? input.pages : [];
  if (pages.some((page) => pageHasBody(page))) {
    throw new Error("site record rejects page bodies");
  }
  return {
    record_version: 1,
    origin: String(input.origin || ""),
    title: String(input.title || ""),
    domain: String(input.domain || ""),
    crawled_at: String(input.crawled_at || ""),
    status: input.status === "failed" ? "failed" : "ok",
    pages: pages.map((page) => {
      const record = page && typeof page === "object" ? page : {};
      return {
        url: String(record.url || ""),
        role: String(record.role || record.page_role || ""),
        published_at: String(record.published_at || ""),
        hash: String(record.hash || ""),
      };
    }),
    content: Array.isArray(input.content) ? input.content : [],
    signals: input.signals ?? null,
    links: input.links ?? null,
    community: input.community ?? null,
    uses: input.uses ?? null,
    seeking: input.seeking ?? null,
  };
}

/**
 * Writes one compact site file, replacing any earlier record for that origin.
 * @param {string} root - Repository root.
 * @param {Record<string, unknown>} record - Clear site record.
 * @returns {Promise<string>} Absolute path written.
 */
export async function writeSiteRecord(root, record) {
  const built = buildSiteRecord(record);
  const directory = crawlSitesDir(root);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${originRecordId(built.origin)}.json`);
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(encodeCrawlValue(built)));
  await rename(temporary, filePath);
  return filePath;
}

/**
 * @param {string} filePath
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function readSiteRecordFile(filePath) {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    const decoded = decodeCrawlValue(parsed);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      return null;
    }
    return /** @type {Record<string, unknown>} */ (decoded);
  } catch (error) {
    if (error && /** @type {{ code?: string }} */ (error).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Reads site files one at a time.
 * @param {string} root
 * @param {string[]} [ids] - Origin hashes to read. Omit to read none.
 * @returns {AsyncGenerator<Record<string, unknown>>}
 */
export async function* iterateSiteRecords(root, ids = []) {
  const directory = crawlSitesDir(root);
  for (const id of ids) {
    const record = await readSiteRecordFile(path.join(directory, `${id}.json`));
    if (record) {
      yield record;
    }
  }
}

/**
 * Lists site-record ids already on disk. Missing directories yield nothing.
 * @param {string} root
 * @returns {Promise<string[]>}
 */
export async function listSiteRecordIds(root) {
  try {
    const names = await readdir(crawlSitesDir(root));
    return names
      .filter((name) => name.endsWith(".json") && !name.includes(".tmp"))
      .map((name) => name.slice(0, -".json".length))
      .sort();
  } catch (error) {
    if (error && /** @type {{ code?: string }} */ (error).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
