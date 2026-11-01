/**
 * Goal & Constraints: Build-time Joshternet welcome postcards (SVG + PNG) from
 * the current network registry. Celebration keepsakes only—not identity
 * certificates and not a replacement for the official button. Escape all text
 * in SVG. Filenames use stableSiteID. Orphans are removed when a site leaves.
 */
import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { canonicalOrigin, stableSiteID } from "../network/lib.mjs";

/** @type {string} Repo-relative directory for welcome card assets. */
export const WELCOME_CARD_DIRECTORY = "assets/network/welcome";

/** @type {number} Postcard width in CSS pixels (SVG viewBox / PNG). */
export const WELCOME_CARD_WIDTH = 1200;

/** @type {number} Postcard height in CSS pixels. */
export const WELCOME_CARD_HEIGHT = 630;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Truncates by grapheme cluster (or code point) so emoji/CJK are not split.
 * @param {unknown} value
 * @param {number} max
 * @returns {string}
 */
export function truncateLabel(value, max) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return "";
  }

  /** @type {string[]} */
  let units;

  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    units = [...segmenter.segment(text)].map((part) => part.segment);
  } else {
    units = [...text];
  }

  if (units.length <= max) {
    return text;
  }

  return `${units.slice(0, Math.max(0, max - 1)).join("")}…`;
}

/**
 * @param {"affirmed" | "declined" | "undeclared"} identity
 * @returns {string}
 */
export function identityCaption(identity) {
  switch (identity) {
    case "affirmed":
      return "Josh identity: Affirmed.";
    case "declined":
      return "Josh identity: Declined.";
    case "undeclared":
      return "Josh identity: Undeclared.";
    default: {
      const _exhaustive = /** @type {never} */ (identity);
      void _exhaustive;
      return "Josh identity: Undeclared.";
    }
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatParticipationDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

/**
 * Public asset paths for one origin, or null when the origin is invalid.
 * @param {unknown} origin
 * @returns {{ id: string, svg: string, png: string } | null}
 */
export function welcomeCardPaths(origin) {
  let canonical;

  try {
    canonical = canonicalOrigin(origin);
  } catch {
    return null;
  }

  const id = stableSiteID(canonical);

  return {
    id,
    svg: `/${WELCOME_CARD_DIRECTORY}/${id}.svg`,
    png: `/${WELCOME_CARD_DIRECTORY}/${id}.png`,
  };
}

/**
 * Fingerprint of fields that affect card artwork.
 * @param {{
 *   origin?: unknown,
 *   domain?: unknown,
 *   title?: unknown,
 *   identity?: unknown,
 *   first_participated_at?: unknown,
 * }} participant
 * @returns {string}
 */
export function welcomeCardFingerprint(participant) {
  return [
    String(participant.origin || ""),
    String(participant.domain || ""),
    String(participant.title || ""),
    String(participant.identity || ""),
    String(participant.first_participated_at || ""),
  ].join("\n");
}

/**
 * Builds a self-contained SVG postcard (no remote fonts/images).
 * @param {{
 *   origin: string,
 *   domain: string,
 *   title?: string,
 *   identity?: string,
 *   first_participated_at?: string,
 * }} participant
 * @returns {string}
 */
export function buildWelcomeCardSvg(participant) {
  const paths = welcomeCardPaths(participant.origin);

  if (!paths) {
    throw new Error("welcome card requires a canonical https origin");
  }

  const domain = truncateLabel(participant.domain || paths.id, 48);
  const title = truncateLabel(
    participant.title || participant.domain || domain,
    42,
  );
  const participated = formatParticipationDate(
    participant.first_participated_at,
  );
  /** @type {"affirmed" | "declined" | "undeclared"} */
  const identity =
    participant.identity === "affirmed" || participant.identity === "declined"
      ? participant.identity
      : "undeclared";
  const identityLine = identityCaption(identity);
  const sinceLine = participated
    ? `First participated ${participated}`
    : "Participating in the Joshternet";

  const siteFont =
    "Georgia, 'Times New Roman', 'PingFang SC', 'Hiragino Sans', 'Noto Sans CJK JP', 'Noto Naskh Arabic', 'Apple SD Gothic Neo', serif";
  const uiFont =
    "ui-sans-serif, system-ui, 'PingFang SC', 'Hiragino Sans', 'Noto Sans CJK JP', 'Noto Naskh Arabic', sans-serif";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WELCOME_CARD_WIDTH}" height="${WELCOME_CARD_HEIGHT}" viewBox="0 0 ${WELCOME_CARD_WIDTH} ${WELCOME_CARD_HEIGHT}" role="img" aria-label="Welcome to the Joshternet postcard for ${escapeXml(domain)}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e8f1fa"/>
      <stop offset="55%" stop-color="#d5e9fb"/>
      <stop offset="100%" stop-color="#f4f7fb"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#sky)"/>
  <rect x="36" y="36" width="${WELCOME_CARD_WIDTH - 72}" height="${WELCOME_CARD_HEIGHT - 72}" fill="#ffffff" stroke="#8ca2b8" stroke-width="2"/>
  <circle cx="96" cy="110" r="18" fill="#0b5f9f"/>
  <text x="130" y="118" font-family="${siteFont}" font-size="28" fill="#071b31">Joshternet</text>
  <text x="72" y="200" font-family="${siteFont}" font-size="48" font-weight="700" fill="#071b31">Welcome to the Joshternet</text>
  <text x="72" y="270" font-family="${siteFont}" font-size="36" fill="#0a4d80" direction="ltr" unicode-bidi="plaintext">${escapeXml(title)}</text>
  <text x="72" y="318" font-family="${uiFont}" font-size="24" fill="#3b4f65" direction="ltr" unicode-bidi="plaintext">${escapeXml(domain)}</text>
  <text x="72" y="380" font-family="${uiFont}" font-size="22" fill="#071b31">An independent website participating in the Joshternet.</text>
  <text x="72" y="420" font-family="${uiFont}" font-size="22" fill="#3b4f65">${escapeXml(sinceLine)}</text>
  <text x="72" y="470" font-family="${uiFont}" font-size="20" fill="#0b5f9f">${escapeXml(identityLine)}</text>
  <text x="72" y="520" font-family="${siteFont}" font-size="22" font-style="italic" fill="#071b31">Joshness is declared, never derived.</text>
  <text x="72" y="568" font-family="${uiFont}" font-size="20" fill="#48627b">joshternet.org</text>
</svg>
`;
}

/**
 * Renders a welcome card SVG buffer to PNG via Sharp.
 * @param {string} svg
 * @returns {Promise<Buffer>}
 */
export async function renderWelcomeCardPng(svg) {
  return sharp(Buffer.from(svg, "utf8"), { density: 144 })
    .resize(WELCOME_CARD_WIDTH, WELCOME_CARD_HEIGHT, {
      fit: "fill",
    })
    .png()
    .toBuffer();
}

/**
 * Validates a participant row for card generation.
 * @param {unknown} value
 * @returns {{
 *   origin: string,
 *   domain: string,
 *   title: string,
 *   identity: string,
 *   first_participated_at: string,
 * } | null}
 */
export function normalizeWelcomeParticipant(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = /** @type {Record<string, unknown>} */ (value);
  let origin;

  try {
    origin = canonicalOrigin(row.origin);
  } catch {
    return null;
  }

  const host = new URL(origin).host;
  const domain =
    typeof row.domain === "string" && row.domain.trim()
      ? row.domain.trim()
      : host;
  /** @type {"affirmed" | "declined" | "undeclared"} */
  const identity =
    row.identity === "affirmed" || row.identity === "declined"
      ? row.identity
      : "undeclared";

  return {
    origin,
    domain,
    title:
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim()
        : domain,
    identity,
    first_participated_at:
      typeof row.first_participated_at === "string"
        ? row.first_participated_at
        : "",
  };
}

/**
 * Generates welcome cards for current participants and removes orphans.
 * @param {unknown} network
 * @param {string} root
 * @returns {Promise<{
 *   generated_at: string,
 *   cards: Array<{
 *     origin: string,
 *     domain: string,
 *     identity: string,
 *     fingerprint: string,
 *     svg: string,
 *     png: string,
 *     network_path: string,
 *   }>
 * }>}
 */
export async function materializeWelcomeCards(network, root) {
  const participants = Array.isArray(network)
    ? network.map((row) => normalizeWelcomeParticipant(row)).filter(Boolean)
    : [];
  const directory = path.join(root, WELCOME_CARD_DIRECTORY);
  await fs.mkdir(directory, { recursive: true });

  /** @type {Map<string, string>} */
  const previousFingerprints = new Map();
  const manifestPath = path.join(root, "_data/welcome_cards.json");

  try {
    const previous = JSON.parse(await fs.readFile(manifestPath, "utf8"));

    if (previous && Array.isArray(previous.cards)) {
      for (const card of previous.cards) {
        if (
          card &&
          typeof card.origin === "string" &&
          typeof card.fingerprint === "string"
        ) {
          previousFingerprints.set(card.origin, card.fingerprint);
        }
      }
    }
  } catch {
    // First run or unreadable manifest — regenerate everything.
  }

  const keepNames = new Set();
  /** @type {Array<{
   *   origin: string,
   *   domain: string,
   *   identity: string,
   *   fingerprint: string,
   *   svg: string,
   *   png: string,
   *   network_path: string,
   * }>} */
  const cards = [];

  for (const participant of participants) {
    // Participants are normalized to canonical origins, so paths is always set.
    const paths = /** @type {{ id: string, svg: string, png: string }} */ (
      welcomeCardPaths(participant.origin)
    );
    const fingerprint = welcomeCardFingerprint(participant);
    const svgName = `${paths.id}.svg`;
    const pngName = `${paths.id}.png`;
    keepNames.add(svgName);
    keepNames.add(pngName);

    const svgPath = path.join(directory, svgName);
    const pngPath = path.join(directory, pngName);
    const unchanged =
      previousFingerprints.get(participant.origin) === fingerprint;

    if (!unchanged) {
      const svg = buildWelcomeCardSvg(participant);
      const png = await renderWelcomeCardPng(svg);
      await fs.writeFile(svgPath, svg, "utf8");
      await fs.writeFile(pngPath, png);
    } else {
      try {
        await fs.access(svgPath);
        await fs.access(pngPath);
      } catch {
        const svg = buildWelcomeCardSvg(participant);
        const png = await renderWelcomeCardPng(svg);
        await fs.writeFile(svgPath, svg, "utf8");
        await fs.writeFile(pngPath, png);
      }
    }

    cards.push({
      origin: participant.origin,
      domain: participant.domain,
      identity: participant.identity,
      fingerprint,
      svg: paths.svg,
      png: paths.png,
      network_path: `/network/?site=${encodeURIComponent(participant.domain.toLowerCase())}`,
    });
  }

  cards.sort((left, right) => left.origin.localeCompare(right.origin));

  // Directory was created above; list current card files for orphan cleanup.
  const existing = await fs.readdir(directory);

  for (const file of existing) {
    if (
      !keepNames.has(file) &&
      (file.endsWith(".svg") || file.endsWith(".png"))
    ) {
      await fs.unlink(path.join(directory, file));
    }
  }

  return {
    generated_at: new Date().toISOString(),
    cards,
  };
}
