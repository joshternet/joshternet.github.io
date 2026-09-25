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

  const domainLabel = labels[0] === "www" ? labels[1] : labels[0];
  const comparableDomain = comparableText(domainLabel);

  if (!comparableDomain) {
    return "";
  }

  const titleParts = normalizedTitle
    .split(/\s+(?:[-|·–—])\s+/u)
    .map((part) => normalizeText(part))
    .filter(Boolean);

  if (titleParts.length < 2) {
    return "";
  }

  for (const part of titleParts) {
    if (comparableText(part) === comparableDomain) {
      return part;
    }
  }

  return "";
}

export function chooseTitle({
  ogSiteName = "",
  applicationName = "",
  jsonLdSiteName = "",
  ogTitle = "",
  twitterTitle = "",
  documentTitle = "",
  domain = "",
} = {}) {
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

  const pageTitleCandidates = [ogTitle, twitterTitle, documentTitle, domain];

  for (const candidate of pageTitleCandidates) {
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

  const projected = registry.nodes.map((node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      throw new Error("invalid registry node");
    }

    const origin = canonicalOrigin(node.origin);

    if (seen.has(origin)) {
      throw new Error(`duplicate registry origin: ${origin}`);
    }

    seen.add(origin);

    const url = new URL(origin);

    return {
      origin,
      domain: url.host,
      identity: identityFromDeclaration(node.declaration),
    };
  });

  projected.sort((left, right) => {
    return left.origin.localeCompare(right.origin);
  });

  return projected;
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
