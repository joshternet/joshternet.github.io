import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

export const REGISTRY_FORMAT_VERSION = 1;

const forbiddenIPv4 = new net.BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  forbiddenIPv4.addSubnet(address, prefix, "ipv4");
}

const globalIPv6 = new net.BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");

const forbiddenIPv6 = new net.BlockList();

for (const [address, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
]) {
  forbiddenIPv6.addSubnet(address, prefix, "ipv6");
}

export function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decodes HTML character references (for URLs and text before semantics).
 * @param {string} input
 * @returns {string}
 */
export function decodeHtmlEntities(input) {
  if (typeof input !== "string" || !input) {
    return "";
  }

  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return String.fromCodePoint(code);
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return String.fromCodePoint(code);
    })
    .replace(/&([a-zA-Z]+);/g, (match, name) => {
      const key = name.toLowerCase();
      return Object.hasOwn(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : match;
    });
}

export function canonicalOrigin(value) {
  if (typeof value !== "string" || value.trim() !== value || value === "") {
    throw new Error("origin must be a non-empty canonical URL");
  }

  const url = new URL(value);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`unsupported origin scheme: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new Error("origin must not contain credentials");
  }

  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new Error(
      "registry origin must not contain path, query, or fragment",
    );
  }

  if (url.origin !== value) {
    throw new Error(`origin is not canonical: ${value}`);
  }

  return url.origin;
}

export function identityFromDeclaration(declaration) {
  if (
    !declaration ||
    typeof declaration !== "object" ||
    Array.isArray(declaration) ||
    declaration.version !== 1
  ) {
    throw new Error("invalid Joshternet declaration");
  }

  if (!Object.hasOwn(declaration, "josh")) {
    return "undeclared";
  }

  if (declaration.josh === true) {
    return "affirmed";
  }

  if (declaration.josh === false) {
    return "declined";
  }

  throw new Error("declaration.josh must be true, false, or absent");
}

/**
 * Copies a version 1 declaration object for publication.
 * @param {unknown} declaration
 * @returns {{ version: 1, josh?: boolean }}
 */
export function cloneDeclaration(declaration) {
  identityFromDeclaration(declaration);

  const cloned = {
    version: 1,
  };

  if (Object.hasOwn(declaration, "josh")) {
    cloned.josh = declaration.josh;
  }

  return cloned;
}

/**
 * Requires an RFC 3339 / ISO-8601 timestamp string from the registry.
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function registryTimestamp(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`invalid registry ${field}`);
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid registry ${field}`);
  }

  return value;
}

/**
 * A node participates in Network and Wander only while JoshBot's latest
 * declaration check is valid.
 * @param {unknown} node
 * @returns {boolean}
 */
export function isParticipatingNode(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return false;
  }

  return node.latest_declaration_check_outcome === "valid";
}

/**
 * Registry participation facts carried into Network / Wander publication.
 * Enrichment fields (title, screenshot, framing) stay separate.
 * @param {{
 *   origin: string,
 *   domain: string,
 *   identity: string,
 *   declaration: { version: 1, josh?: boolean },
 *   initial_declaration: { version: 1, josh?: boolean },
 *   first_participated_at: string,
 *   latest_declaration_check_at: string,
 *   latest_declaration_check_outcome: string
 * }} participant
 * @returns {object}
 */
export function registryParticipationFields(participant) {
  return {
    origin: participant.origin,
    domain: participant.domain,
    identity: participant.identity,
    declaration: cloneDeclaration(participant.declaration),
    initial_declaration: cloneDeclaration(participant.initial_declaration),
    first_participated_at: participant.first_participated_at,
    latest_declaration_check_at: participant.latest_declaration_check_at,
    latest_declaration_check_outcome:
      participant.latest_declaration_check_outcome,
  };
}

export function projectRegistry(registry) {
  if (
    !registry ||
    typeof registry !== "object" ||
    Array.isArray(registry) ||
    registry.format_version !== REGISTRY_FORMAT_VERSION ||
    !Array.isArray(registry.nodes)
  ) {
    throw new Error("invalid JoshBot registry");
  }

  const seen = new Set();

  const projected = [];

  for (const node of registry.nodes) {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      throw new Error("invalid registry node");
    }

    const origin = canonicalOrigin(node.origin);

    if (seen.has(origin)) {
      throw new Error(`duplicate registry origin: ${origin}`);
    }

    seen.add(origin);

    if (!isParticipatingNode(node)) {
      continue;
    }

    const declaration = cloneDeclaration(node.declaration);
    const initialDeclaration = cloneDeclaration(node.initial_declaration);
    const url = new URL(origin);

    projected.push({
      origin,
      domain: url.host,
      identity: identityFromDeclaration(declaration),
      declaration,
      initial_declaration: initialDeclaration,
      first_participated_at: registryTimestamp(
        node.first_participated_at,
        "first_participated_at",
      ),
      latest_declaration_check_at: registryTimestamp(
        node.latest_declaration_check_at,
        "latest_declaration_check_at",
      ),
      latest_declaration_check_outcome: "valid",
    });
  }

  projected.sort((left, right) => {
    return left.origin.localeCompare(right.origin);
  });

  return projected;
}

export function stableSiteID(origin) {
  return crypto
    .createHash("sha256")
    .update(canonicalOrigin(origin))
    .digest("hex");
}

export function screenshotPath(origin) {
  return `/assets/network/sites/${stableSiteID(origin)}.webp`;
}

function comparableText(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Labels that are not personal given-name / family-name host parts. */
const NON_PERSONAL_DOMAIN_LABELS = new Set([
  "www",
  "www2",
  "blog",
  "mail",
  "shop",
  "store",
  "app",
  "api",
  "dev",
  "staging",
  "cdn",
  "static",
  "docs",
  "wiki",
  "news",
  "forum",
  "forums",
  "status",
  "support",
]);

/**
 * True when a page title is only a greeting (common homepage H1/OG mistake).
 * @param {string} title
 * @returns {boolean}
 */
function isGreetingTitle(title) {
  return /^(hello|hi|hey|welcome|hola)(?:\s*[!?.…*]*)?$/iu.test(
    normalizeText(title),
  );
}

/**
 * firstname.lastname.tld → "Firstname Lastname" for personal sites.
 * @param {string} domain
 * @returns {string}
 */
export function humanNameFromDomain(domain) {
  const hostname = normalizeText(domain)
    .toLocaleLowerCase("en-US")
    .replace(/\.$/, "");
  const labels = hostname.split(".").filter(Boolean);

  if (labels.length !== 3) {
    return "";
  }

  const [first, last, tld] = labels;

  if (
    NON_PERSONAL_DOMAIN_LABELS.has(first) ||
    NON_PERSONAL_DOMAIN_LABELS.has(last)
  ) {
    return "";
  }

  if (!/^[a-z]{2,24}$/u.test(first) || !/^[a-z]{2,24}$/u.test(last)) {
    return "";
  }

  if (!/^[a-z]{2,24}$/u.test(tld)) {
    return "";
  }

  const titleCase = (label) =>
    `${label.charAt(0).toLocaleUpperCase("en-US")}${label.slice(1)}`;

  return `${titleCase(first)} ${titleCase(last)}`;
}

/**
 * Domain's primary label (www.example.com → example).
 * @param {string} domain
 * @returns {string}
 */
function primaryDomainLabel(domain) {
  const hostname = normalizeText(domain)
    .toLocaleLowerCase("en-US")
    .replace(/\.$/, "");
  const labels = hostname.split(".").filter(Boolean);

  if (labels.length < 2) {
    return "";
  }

  return labels[0] === "www" ? labels[1] : labels[0];
}

/** Words that mark a slogan/brand phrase rather than a personal name. */
const PERSON_NAME_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "blog",
  "by",
  "can",
  "for",
  "from",
  "help",
  "home",
  "in",
  "my",
  "of",
  "official",
  "on",
  "or",
  "our",
  "page",
  "site",
  "the",
  "to",
  "website",
  "with",
  "your",
]);

/**
 * True when a string looks like a 2–3 word personal name.
 * @param {string} candidate
 * @returns {boolean}
 */
export function looksLikePersonName(candidate) {
  const normalized = normalizeText(candidate);

  if (!normalized) {
    return false;
  }

  const words = normalized.split(/\s+/u).filter(Boolean);

  if (words.length < 2 || words.length > 3) {
    return false;
  }

  return words.every((word) => {
    if (word.length < 2 || !/^[\p{L}][\p{L}'’.-]*$/u.test(word)) {
      return false;
    }

    return !PERSON_NAME_STOPWORDS.has(word.toLocaleLowerCase("en-US"));
  });
}

/**
 * When a candidate is the person's name compacted into the domain label
 * (Josh Ghent ↔ joshghent), return the display name.
 * @param {string} candidate
 * @param {string} domain
 * @returns {string}
 */
export function personNameMatchingDomain(candidate, domain) {
  const normalized = normalizeText(candidate);
  const domainLabel = primaryDomainLabel(domain);

  if (!normalized || !domainLabel) {
    return "";
  }

  if (comparableText(normalized) !== comparableText(domainLabel)) {
    return "";
  }

  // Prefer multi-word person names over a single token that only restates the host.
  // Reject slogan brands that compress to the host (e.g. "Josh Can Help").
  if (!looksLikePersonName(normalized)) {
    return "";
  }

  return normalized;
}

/**
 * Finds a 2–3 word person name in free text that matches the domain label.
 * @param {string} text
 * @param {string} domain
 * @returns {string}
 */
export function personNameFromText(text, domain) {
  const normalized = normalizeText(text);

  if (!normalized || !primaryDomainLabel(domain)) {
    return "";
  }

  const words = normalized.split(/\s+/u).filter(Boolean);

  for (let index = 0; index < words.length - 1; index += 1) {
    for (
      let length = 2;
      length <= 3 && index + length <= words.length;
      length += 1
    ) {
      const span = words
        .slice(index, index + length)
        .join(" ")
        .replace(/[.,;:!?]+$/u, "");
      const match = personNameMatchingDomain(span, domain);

      if (match) {
        return match;
      }
    }
  }

  return "";
}

/**
 * Title fragments split on common brand separators.
 * @param {string} title
 * @returns {string[]}
 */
function titleParts(title) {
  const normalizedTitle = normalizeText(title);

  if (!normalizedTitle) {
    return [];
  }

  return normalizedTitle
    .split(/\s+(?:[-|·–—])\s+/u)
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

function titleBrandFromDomain(title, domain) {
  const normalizedTitle = normalizeText(title);
  const normalizedDomain = normalizeText(domain).toLocaleLowerCase("en-US");

  if (!normalizedTitle || !normalizedDomain) {
    return "";
  }

  const hostname = normalizedDomain.replace(/\.$/, "");
  const labels = hostname.split(".").filter(Boolean);

  if (labels.length < 2) {
    return "";
  }

  const domainLabel = primaryDomainLabel(hostname);
  const comparableDomain = comparableText(domainLabel);
  const comparableHost = comparableText(hostname);
  const humanName = humanNameFromDomain(hostname);

  if (!comparableDomain) {
    return "";
  }

  // normalizedTitle is non-empty, so titleParts always yields at least one part.
  for (const part of titleParts(normalizedTitle)) {
    const person = personNameMatchingDomain(part, hostname);

    if (person) {
      return person;
    }

    const comparablePart = comparableText(part);

    if (comparablePart === comparableDomain) {
      return part;
    }

    // "Hello! - joshua.seigler.net" → prefer "Joshua Seigler"
    if (comparableHost && comparablePart === comparableHost && humanName) {
      return humanName;
    }
  }

  return "";
}

export function chooseTitle({
  ogSiteName = "",
  applicationName = "",
  jsonLdSiteName = "",
  jsonLdPersonName = "",
  authorName = "",
  ogTitle = "",
  twitterTitle = "",
  documentTitle = "",
  description = "",
  ogDescription = "",
  twitterDescription = "",
  domain = "",
} = {}) {
  // Person-shaped names that match the host beat blog-brand site names
  // (e.g. og:site_name "Developer Musings" vs "Josh Ghent").
  const personCandidates = [
    jsonLdPersonName,
    authorName,
    ogTitle,
    twitterTitle,
    ...titleParts(documentTitle),
    documentTitle,
  ];

  for (const candidate of personCandidates) {
    const person = personNameMatchingDomain(candidate, domain);

    if (person) {
      return person;
    }
  }

  for (const text of [description, ogDescription, twitterDescription]) {
    const fromText = personNameFromText(text, domain);

    if (fromText) {
      return fromText;
    }
  }

  // Prefer a real person author over a host-label brand (e.g. Joshtronic)
  // when the author does not compress to the domain label.
  for (const candidate of [jsonLdPersonName, authorName]) {
    const normalized = normalizeText(candidate);

    if (normalized && looksLikePersonName(normalized)) {
      return normalized;
    }
  }

  const siteNameCandidates = [ogSiteName, applicationName, jsonLdSiteName];

  for (const candidate of siteNameCandidates) {
    const normalized = normalizeText(candidate);

    if (normalized) {
      return normalized;
    }
  }

  for (const candidate of [ogTitle, twitterTitle, documentTitle]) {
    const brand = titleBrandFromDomain(candidate, domain);

    if (brand) {
      return brand;
    }
  }

  const humanName = humanNameFromDomain(domain);
  const pageTitleCandidates = [ogTitle, twitterTitle, documentTitle];
  const nonGreetingPageTitle = pageTitleCandidates
    .map((candidate) => normalizeText(candidate))
    .find((candidate) => candidate && !isGreetingTitle(candidate));

  if (humanName && !nonGreetingPageTitle) {
    return humanName;
  }

  for (const candidate of [...pageTitleCandidates, domain]) {
    const normalized = normalizeText(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export function chooseDescription({
  description = "",
  ogDescription = "",
  twitterDescription = "",
  jsonLdDescription = "",
  mainDescription = "",
} = {}) {
  const candidates = [
    description,
    ogDescription,
    twitterDescription,
    jsonLdDescription,
    mainDescription,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export function framePolicy({
  origin,
  headers = {},
  parentOrigin = "https://joshternet.org",
} = {}) {
  const target = new URL(canonicalOrigin(origin));

  if (target.protocol !== "https:") {
    return {
      embeddable: false,
      reason: "http",
    };
  }

  const normalizedHeaders = new Map();

  for (const [name, value] of Object.entries(headers)) {
    normalizedHeaders.set(name.toLowerCase(), String(value));
  }

  const xFrameOptions = normalizeText(
    normalizedHeaders.get("x-frame-options") || "",
  ).toLowerCase();

  if (xFrameOptions) {
    const directives = xFrameOptions.split(",").map((value) => value.trim());

    if (directives.includes("deny") || directives.includes("sameorigin")) {
      return {
        embeddable: false,
        reason: "blocked-by-site",
      };
    }
  }

  const csp = normalizedHeaders.get("content-security-policy") || "";

  if (csp) {
    const frameAncestors = csp
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => {
        return directive.toLowerCase().startsWith("frame-ancestors");
      });

    if (frameAncestors) {
      const sources = frameAncestors
        .split(/\s+/)
        .slice(1)
        .map((source) => source.toLowerCase());

      const parent = parentOrigin.toLowerCase();

      if (sources.includes("'none'")) {
        return {
          embeddable: false,
          reason: "blocked-by-site",
        };
      }

      if (
        sources.includes("'self'") &&
        !sources.includes("*") &&
        !sources.includes(parent)
      ) {
        return {
          embeddable: false,
          reason: "blocked-by-site",
        };
      }

      if (
        !sources.includes("*") &&
        !sources.includes(parent) &&
        !sources.includes("'self'")
      ) {
        return {
          embeddable: false,
          reason: "blocked-by-site",
        };
      }
    }
  }

  return {
    embeddable: true,
    reason: "allowed",
  };
}

export function canFrame(options = {}) {
  return framePolicy(options).embeddable;
}

export function isForbiddenAddress(address) {
  const version = net.isIP(address);

  if (version === 4) {
    return forbiddenIPv4.check(address, "ipv4");
  }

  if (version === 6) {
    if (!globalIPv6.check(address, "ipv6")) {
      return true;
    }

    return forbiddenIPv6.check(address, "ipv6");
  }

  return true;
}

export async function assertPublicURL(
  value,
  { lookup = dns.lookup, cache = new Map() } = {},
) {
  const url = new URL(value);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`unsupported URL scheme: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new Error("URL contains credentials");
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error(`blocked hostname: ${hostname}`);
  }

  let addresses = cache.get(hostname);

  if (!addresses) {
    addresses = await lookup(hostname, {
      all: true,
      verbatim: true,
    });

    cache.set(hostname, addresses);
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error(`hostname did not resolve: ${hostname}`);
  }

  for (const result of addresses) {
    if (!result || isForbiddenAddress(result.address)) {
      throw new Error(`hostname resolves to prohibited address: ${hostname}`);
    }
  }

  return url;
}

export async function partitionPublicParticipants(
  participants,
  { lookup = dns.lookup, cache = new Map() } = {},
) {
  if (!Array.isArray(participants)) {
    throw new Error("participants must be an array");
  }

  const accepted = [];
  const rejected = [];

  for (const participant of participants) {
    try {
      const origin = canonicalOrigin(participant?.origin);

      await assertPublicURL(origin, {
        lookup,
        cache,
      });

      accepted.push(participant);
    } catch (error) {
      rejected.push({
        participant,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  return {
    accepted,
    rejected,
  };
}

export const MAX_FEEDS_PER_PARTICIPANT = 5;

const FEED_MIME_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/feed+json",
]);

/**
 * Validates and normalizes advertised feed declarations for publication.
 * Bad items are skipped; they do not reject the participant.
 * @param {unknown} rawFeeds
 * @param {{
 *   lookup?: typeof dns.lookup,
 *   cache?: Map<string, unknown>,
 * }} [options]
 * @returns {Promise<Array<{url: string, type: string, title?: string}>>}
 */
export async function sanitizeFeeds(
  rawFeeds,
  { lookup = dns.lookup, cache = new Map() } = {},
) {
  if (!Array.isArray(rawFeeds)) {
    return [];
  }

  const feeds = [];
  const seen = new Set();

  for (const candidate of rawFeeds) {
    if (feeds.length >= MAX_FEEDS_PER_PARTICIPANT) {
      break;
    }

    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const type =
      typeof candidate.type === "string" ? normalizeText(candidate.type) : "";

    if (!FEED_MIME_TYPES.has(type)) {
      continue;
    }

    let href = "";

    if (typeof candidate.href === "string") {
      href = candidate.href;
    } else if (typeof candidate.url === "string") {
      href = candidate.url;
    }

    if (!href) {
      continue;
    }

    try {
      const url = await assertPublicURL(href, {
        lookup,
        cache,
      });
      const normalized = url.href;

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);

      const feed = {
        url: normalized,
        type,
      };
      const title = normalizeText(candidate.title);

      if (title) {
        feed.title = title;
      }

      feeds.push(feed);
    } catch {
      continue;
    }
  }

  return feeds;
}
