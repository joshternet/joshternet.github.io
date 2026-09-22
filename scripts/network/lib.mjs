import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

export const REGISTRY_FORMAT_VERSION = 1;

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

export function chooseTitle({
  ogSiteName = "",
  applicationName = "",
  ogTitle = "",
  documentTitle = "",
  domain = "",
} = {}) {
  const candidates = [
    ogSiteName,
    applicationName,
    ogTitle,
    documentTitle,
    domain,
  ];

  for (const candidate of candidates) {
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
} = {}) {
  return normalizeText(description) || normalizeText(ogDescription);
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

function ipv4Parts(address) {
  const parts = address.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => {
      return !Number.isInteger(part) || part < 0 || part > 255;
    })
  ) {
    return null;
  }

  return parts;
}

export function isForbiddenAddress(address) {
  const version = net.isIP(address);

  if (version === 0) {
    return true;
  }

  if (version === 4) {
    const parts = ipv4Parts(address);

    if (!parts) {
      return true;
    }

    const [a, b, c] = parts;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  const normalized = address.toLowerCase();

  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  ) {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    const embedded = normalized.slice("::ffff:".length);

    if (net.isIP(embedded) === 4) {
      return isForbiddenAddress(embedded);
    }
  }

  return false;
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
