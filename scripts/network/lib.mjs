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

/**
 * Known named character references → plain Unicode (or space for nbsp).
 * Not an HTML sanitizer: unknown `&name;` is left unchanged; callers must
 * still escape on render.
 */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "\u201C",
  rdquo: "\u201D",
  lsquo: "\u2018",
  rsquo: "\u2019",
  sbquo: "\u201A",
  bdquo: "\u201E",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  middot: "\u00B7",
  bull: "\u2022",
  copy: "\u00A9",
  reg: "\u00AE",
  trade: "\u2122",
  euro: "\u20AC",
  pound: "\u00A3",
  yen: "\u00A5",
  cent: "\u00A2",
  sect: "\u00A7",
  para: "\u00B6",
  deg: "\u00B0",
  plusmn: "\u00B1",
  times: "\u00D7",
  divide: "\u00F7",
  laquo: "\u00AB",
  raquo: "\u00BB",
  iexcl: "\u00A1",
  iquest: "\u00BF",
  agrave: "\u00E0",
  aacute: "\u00E1",
  acirc: "\u00E2",
  atilde: "\u00E3",
  auml: "\u00E4",
  aring: "\u00E5",
  aelig: "\u00E6",
  ccedil: "\u00E7",
  egrave: "\u00E8",
  eacute: "\u00E9",
  ecirc: "\u00EA",
  euml: "\u00EB",
  igrave: "\u00EC",
  iacute: "\u00ED",
  icirc: "\u00EE",
  iuml: "\u00EF",
  ntilde: "\u00F1",
  ograve: "\u00F2",
  oacute: "\u00F3",
  ocirc: "\u00F4",
  otilde: "\u00F5",
  ouml: "\u00F6",
  oslash: "\u00F8",
  ugrave: "\u00F9",
  uacute: "\u00FA",
  ucirc: "\u00FB",
  uuml: "\u00FC",
  yacute: "\u00FD",
  yuml: "\u00FF",
  Agrave: "\u00C0",
  Aacute: "\u00C1",
  Acirc: "\u00C2",
  Atilde: "\u00C3",
  Auml: "\u00C4",
  Aring: "\u00C5",
  AElig: "\u00C6",
  Ccedil: "\u00C7",
  Egrave: "\u00C8",
  Eacute: "\u00C9",
  Ecirc: "\u00CA",
  Euml: "\u00CB",
  Igrave: "\u00CC",
  Iacute: "\u00CD",
  Icirc: "\u00CE",
  Iuml: "\u00CF",
  Ntilde: "\u00D1",
  Ograve: "\u00D2",
  Oacute: "\u00D3",
  Ocirc: "\u00D4",
  Otilde: "\u00D5",
  Ouml: "\u00D6",
  Oslash: "\u00D8",
  Ugrave: "\u00D9",
  Uacute: "\u00DA",
  Ucirc: "\u00DB",
  Uuml: "\u00DC",
  Yacute: "\u00DD",
};

/**
 * Decodes HTML character references to plain Unicode for storage/display text.
 * Known named refs and numeric refs become code points; unknown `&name;` is
 * left unchanged. Not an HTML sanitizer — escape on render.
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
      if (Object.hasOwn(NAMED_ENTITIES, name)) {
        return NAMED_ENTITIES[name];
      }

      // XML/HTML often uses lowercase for amp/lt/gt even when mixed case appears.
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

  if (value.endsWith("/") || value.includes("?") || value.includes("#")) {
    throw new Error(`origin is not canonical: ${value}`);
  }

  // Accept Unicode (U-label) or ACE spellings; always return ASCII/ACE origin.
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

/**
 * ASCII-ish forms for domain/name matching. German umlauts may encode as the
 * digraph (Stübner ↔ stuebner) or as the bare vowel (Müller ↔ muller).
 * @param {string} value
 * @returns {Set<string>}
 */
function comparableVariants(value) {
  const base = normalizeText(value)
    .normalize("NFKD")
    .toLocaleLowerCase("en-US");

  if (!base) {
    return new Set();
  }

  const digraph = base
    .replace(/([aou])\u0308/gu, (_, letter) => `${letter}e`)
    .replace(/ß/gu, "ss")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

  const stripped = base
    .replace(/ß/gu, "ss")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

  return new Set([digraph, stripped].filter(Boolean));
}

/**
 * Primary comparable form (umlaut digraph fold) for single-string callers.
 * @param {string} value
 * @returns {string}
 */
function comparableText(value) {
  for (const variant of comparableVariants(value)) {
    return variant;
  }

  return "";
}

/**
 * True when two labels match under either umlaut ASCII encoding.
 * @param {string} left
 * @param {string} right
 * @returns {boolean}
 */
export function comparableTextsMatch(left, right) {
  const rightVariants = comparableVariants(right);

  for (const variant of comparableVariants(left)) {
    if (rightVariants.has(variant)) {
      return true;
    }
  }

  return false;
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
 * True when a page title is a generic shell ("Joshuas very own page") rather
 * than a person or brand name worth publishing on a Network card.
 * @param {string} title
 * @returns {boolean}
 */
export function isWeakPageTitle(title) {
  const normalized = normalizeText(title);

  if (!normalized) {
    return true;
  }

  // Possessive / "own page" shells only — do not reject brands like
  // "Example Site" or documents that merely mention "blog".
  if (
    /(?:^|\b)(?:my|your|our|his|her|their|\w+(?:'s|s))\s+(?:very\s+own\s+)?(?:home\s*)?(?:page|site|website)\b/iu.test(
      normalized,
    )
  ) {
    return true;
  }

  return /^(?:home|index|untitled|website|homepage|my\s+site|my\s+website|personal\s+(?:home\s*)?page)$/iu.test(
    normalized,
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
 * Given names that may appear in a host-compressed personal domain title
 * (Josh Ghent ↔ joshghent). Blocks brand phrases that only look name-shaped
 * (Forward Bias ↔ forwardbias).
 * @type {ReadonlySet<string>}
 */
const DOMAIN_PERSON_GIVEN_NAMES = new Set([
  "josh",
  "joshua",
  "joseph",
  "josiah",
  "josue",
  "jose",
  "josé",
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
 * True when text compresses to the host label as a multi-word brand
 * (e.g. "Josh Can Help" ↔ joshcanhelp, "Forward Bias" ↔ forwardbias).
 * @param {string} candidate
 * @param {string} domain
 * @returns {boolean}
 */
export function isDomainCompressingSlogan(candidate, domain) {
  const normalized = normalizeText(candidate);
  const domainLabel = primaryDomainLabel(domain);

  if (!normalized || !domainLabel) {
    return false;
  }

  // Single-token host brands ("Joshtronic") are fine; multi-word phrases that
  // only restate the host are not card titles.
  const wordCount = normalized.split(/\s+/u).filter(Boolean).length;

  return wordCount >= 2 && comparableTextsMatch(normalized, domainLabel);
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

  if (!comparableTextsMatch(normalized, domainLabel)) {
    return "";
  }

  // Prefer multi-word person names over a single token that only restates the host.
  // Reject slogan brands that compress to the host (e.g. "Josh Can Help").
  if (!looksLikePersonName(normalized)) {
    return "";
  }

  // looksLikePersonName already requires two or more words.
  const given = normalized.split(/\s+/u)[0].toLocaleLowerCase("en-US");

  // Host-compressed brands can look name-shaped ("Forward Bias"). Require a
  // Josh-shaped given name so personal domains win and brand hosts do not.
  if (!DOMAIN_PERSON_GIVEN_NAMES.has(given)) {
    return "";
  }

  return normalized;
}

/**
 * Person name from an explicit self-intro ("I'm Chris Minnick…") when the
 * name compresses to the host label. Unlike personNameMatchingDomain, this
 * path is not Josh-given-name gated—self-intros are strong for Non-Josh peers.
 * @param {string} text
 * @param {string} domain
 * @returns {string}
 */
export function personNameFromSelfIntro(text, domain) {
  const normalized = normalizeText(text);
  const domainLabel = primaryDomainLabel(domain);

  if (!normalized || !domainLabel) {
    return "";
  }

  // Allow a short lead-in ("Hi. I'm…") but stop before sentence punctuation so
  // "I'm Chris Minnick. I've…" does not swallow the following clause.
  const match = normalized.match(
    /(?:^|[.!?]\s+)(?:I['\u2019]m|I am|My name is)\s+([\p{L}][\p{L}'\u2019-]*(?:\s+[\p{L}][\p{L}'\u2019-]*){1,2})(?=\s*[.,:;!?]|\s|$)/iu,
  );

  if (!match) {
    return "";
  }

  const candidate = normalizeText(match[1]);

  if (!looksLikePersonName(candidate)) {
    return "";
  }

  if (!comparableTextsMatch(candidate, domainLabel)) {
    return "";
  }

  return candidate;
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

  const fromIntro = personNameFromSelfIntro(normalized, domain);

  if (fromIntro) {
    return fromIntro;
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
      // Single-token host brands (Joshtronic) ok; multi-word slogans are not.
      if (!isDomainCompressingSlogan(part, hostname)) {
        return part;
      }

      continue;
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
  mainDescription = "",
  aboutDescription = "",
  identityNameText = "",
  domain = "",
} = {}) {
  // Explicit person signals first (author / Person JSON-LD / GitHub-injected
  // names) so brand titles that compress to the host cannot win.
  for (const candidate of [jsonLdPersonName, authorName]) {
    const normalized = normalizeText(candidate);

    if (normalized && looksLikePersonName(normalized)) {
      return normalized;
    }
  }

  // Person-shaped names that match the host beat blog-brand site names
  // (e.g. og:title "Josh Ghent - Developer Musings").
  const personCandidates = [
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

  // Include main/about/identity prose so self-intros like “I’m Chris Minnick…”
  // win even when meta description is third-person and og:title is Non-Josh.
  for (const text of [
    description,
    ogDescription,
    twitterDescription,
    mainDescription,
    aboutDescription,
    identityNameText,
  ]) {
    const fromText = personNameFromText(text, domain);

    if (fromText) {
      return fromText;
    }
  }

  const siteNameCandidates = [ogSiteName, applicationName, jsonLdSiteName];

  for (const candidate of siteNameCandidates) {
    const normalized = normalizeText(candidate);

    if (
      normalized &&
      !isDomainCompressingSlogan(normalized, domain) &&
      !isWeakPageTitle(normalized)
    ) {
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
    .find(
      (candidate) =>
        candidate &&
        !isGreetingTitle(candidate) &&
        !isWeakPageTitle(candidate) &&
        !isDomainCompressingSlogan(candidate, domain),
    );

  if (humanName && !nonGreetingPageTitle) {
    return humanName;
  }

  for (const candidate of [...pageTitleCandidates, domain]) {
    const normalized = normalizeText(candidate);

    if (!normalized) {
      continue;
    }

    if (isDomainCompressingSlogan(normalized, domain)) {
      continue;
    }

    if (isWeakPageTitle(normalized)) {
      continue;
    }

    // "Josh Can Help - Software" still carries the slogan; prefer the host.
    if (
      titleParts(normalized).some((part) =>
        isDomainCompressingSlogan(part, domain),
      )
    ) {
      continue;
    }

    return normalized;
  }

  const domainFallback = normalizeText(domain);

  return domainFallback || "";
}

/**
 * True when a title is only the host or its primary label.
 * @param {string} title
 * @param {string} domain
 * @returns {boolean}
 */
export function isHostLikeTitle(title, domain) {
  const normalized = normalizeText(title);
  const host = normalizeText(domain);

  if (!normalized || !host) {
    return false;
  }

  if (comparableTextsMatch(normalized, host)) {
    return true;
  }

  const label = primaryDomainLabel(host);

  return Boolean(label) && comparableTextsMatch(normalized, label);
}

/**
 * Reads curated Network card titles keyed by participant origin.
 * @param {unknown} doc
 * @returns {Map<string, string>}
 */
export function displayTitleOverridesFromDocument(doc) {
  /** @type {Map<string, string>} */
  const overrides = new Map();

  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return overrides;
  }

  const titles = /** @type {{ titles?: unknown }} */ (doc).titles;

  if (!titles || typeof titles !== "object" || Array.isArray(titles)) {
    return overrides;
  }

  for (const [origin, title] of Object.entries(titles)) {
    const normalizedOrigin = normalizeText(origin);
    const normalizedTitle = normalizeText(title);

    if (!normalizedOrigin || !normalizedTitle) {
      continue;
    }

    overrides.set(normalizedOrigin, normalizedTitle);
  }

  return overrides;
}

/**
 * Picks the Network card title to publish after sync resolve.
 * Curated overrides win. Person-shaped previous titles are not downgraded to
 * host labels, weak shells, or domain-compressing slogans on rebuild.
 * @param {{
 *   resolved?: string,
 *   previous?: string,
 *   domain?: string,
 *   override?: string,
 * }} [fields]
 * @returns {string}
 */
export function selectPublishedNetworkTitle({
  resolved = "",
  previous = "",
  domain = "",
  override = "",
} = {}) {
  const forced = normalizeText(override);

  if (forced) {
    return forced;
  }

  const next = normalizeText(resolved);
  const kept = normalizeText(previous);

  if (next && looksLikePersonName(next)) {
    return next;
  }

  if (
    kept &&
    looksLikePersonName(kept) &&
    (!next ||
      isWeakPageTitle(next) ||
      isDomainCompressingSlogan(next, domain) ||
      isHostLikeTitle(next, domain))
  ) {
    return kept;
  }

  return next || kept || "";
}

/** @type {number} Blurbs shorter than this are treated as too thin for Network cards. */
export const NETWORK_DESCRIPTION_MIN_CHARS = 48;

/** @type {number} Soft max length for Network card blurbs (sentence-trimmed). */
export const NETWORK_DESCRIPTION_MAX_CHARS = 260;

/**
 * True when a blurb is too thin or boilerplate for a Network card.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isWeakNetworkDescription(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return true;
  }

  const lower = normalized.toLocaleLowerCase("en-US");

  // Exact “Personal Website” / “Website of Name” shells only — role-rich
  // lines like “Personal Website of X — Technologist | …” stay eligible.
  if (
    /^(personal\s+)?(website|homepage|site|web\s*site)(\s+of\s+[\p{L}][\p{L} .'-]*)?$/iu.test(
      lower,
    )
  ) {
    return true;
  }

  if (/\bpersonal homepage\b/iu.test(lower)) {
    return true;
  }

  if (/\bhome on the web\b/iu.test(lower)) {
    return true;
  }

  if (/'s\s+(web\s*)?site$/iu.test(lower)) {
    return true;
  }

  if (normalized.length < NETWORK_DESCRIPTION_MIN_CHARS) {
    return true;
  }

  return false;
}

/**
 * Trims a blurb to the Network card soft max at a sentence boundary when possible.
 * @param {string} value
 * @param {number} [maxChars]
 * @returns {string}
 */
export function trimNetworkDescription(
  value,
  maxChars = NETWORK_DESCRIPTION_MAX_CHARS,
) {
  const normalized = normalizeText(value);
  const limit =
    typeof maxChars === "number" && maxChars > 0
      ? maxChars
      : NETWORK_DESCRIPTION_MAX_CHARS;

  if (!normalized || normalized.length <= limit) {
    return normalized;
  }

  const window = normalized.slice(0, limit + 1);
  const sentenceEnd = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );

  if (sentenceEnd >= Math.floor(limit * 0.45)) {
    return normalizeText(normalized.slice(0, sentenceEnd + 1));
  }

  const space = window.lastIndexOf(" ");

  if (space >= Math.floor(limit * 0.5)) {
    return `${normalizeText(normalized.slice(0, space))}…`;
  }

  return `${normalized.slice(0, limit).trimEnd()}…`;
}

/**
 * Quality rank for Network card blurbs. Higher is better; weak blurbs score 0.
 * @param {string} value
 * @returns {number}
 */
export function networkDescriptionQuality(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return -1;
  }

  if (isWeakNetworkDescription(normalized)) {
    return 0;
  }

  return Math.min(normalized.length, NETWORK_DESCRIPTION_MAX_CHARS);
}

/**
 * Picks the strongest Network card blurb from publisher metadata.
 * Prefers substantive meta/main/about text; skips thin boilerplate; soft-caps length.
 * @param {{
 *   description?: string,
 *   ogDescription?: string,
 *   twitterDescription?: string,
 *   jsonLdDescription?: string,
 *   mainDescription?: string,
 *   aboutDescription?: string,
 * }} [fields]
 * @returns {string}
 */
export function chooseDescription({
  description = "",
  ogDescription = "",
  twitterDescription = "",
  jsonLdDescription = "",
  mainDescription = "",
  aboutDescription = "",
} = {}) {
  const candidates = [
    description,
    ogDescription,
    twitterDescription,
    jsonLdDescription,
    mainDescription,
    aboutDescription,
  ];

  /** @type {string} */
  let best = "";
  let bestScore = -1;
  /** Later copy must beat the current pick by this much to replace authored meta. */
  const meaningfulGain = 40;

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);

    if (!normalized) {
      continue;
    }

    const score = networkDescriptionQuality(normalized);

    if (bestScore <= 0) {
      if (score > bestScore) {
        best = normalized;
        bestScore = score;
      }
      continue;
    }

    // Prefer earlier strong candidates; only upgrade when later text is richer.
    if (score >= bestScore + meaningfulGain) {
      best = normalized;
      bestScore = score;
    }
  }

  if (!best || bestScore <= 0) {
    return "";
  }

  return trimNetworkDescription(best);
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

/** @type {number} Hard budget for SSRF DNS lookups (stuck resolvers must not hang sync). */
export const DNS_LOOKUP_TIMEOUT_MS = 8_000;

/**
 * Resolves a hostname with a hard timeout.
 * @param {string} hostname
 * @param {typeof dns.lookup} lookup
 * @param {number} timeoutMs
 * @returns {Promise<Array<{ address: string, family?: number }>>}
 * @throws {Error} When the lookup fails or exceeds the timeout.
 */
async function lookupAddressesWithTimeout(hostname, lookup, timeoutMs) {
  let timer;

  try {
    return await Promise.race([
      lookup(hostname, {
        all: true,
        verbatim: true,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`DNS lookup timed out for ${hostname}`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function assertPublicURL(
  value,
  {
    lookup = dns.lookup,
    cache = new Map(),
    lookupTimeoutMs = DNS_LOOKUP_TIMEOUT_MS,
  } = {},
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
    const timeoutMs =
      typeof lookupTimeoutMs === "number" && lookupTimeoutMs > 0
        ? lookupTimeoutMs
        : DNS_LOOKUP_TIMEOUT_MS;
    addresses = await lookupAddressesWithTimeout(hostname, lookup, timeoutMs);
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
  // Hugo PaperMod search/index JSON (sniffed at nlp:sync time).
  "application/json",
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
