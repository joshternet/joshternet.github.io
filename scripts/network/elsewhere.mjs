/**
 * Goal: Discover participant-published profile links (`rel="me"` and catalog
 * social hosts), classify them, and publish safe presentation data.
 * Inputs: raw elsewhere ads from homepage metadata. Outputs: `{url, network, label}[]`.
 * Errors: unsafe or non-http(s) URLs are skipped; they never drop the participant.
 * Acceptance: email ignored; rel=me kept (including web); host discovery limited to
 * catalog profile URLs; one icon per network.
 */
import dns from "node:dns/promises";

import { assertPublicURL, normalizeText } from "./lib.mjs";

export const MAX_ELSEWHERE_PER_PARTICIPANT = 12;

/**
 * Stable English labels for known network ids.
 * @type {Record<string, string>}
 */
export const ELSEWHERE_LABELS = {
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  reddit: "Reddit",
  discord: "Discord",
  twitch: "Twitch",
  github: "GitHub",
  gitlab: "GitLab",
  bluesky: "Bluesky",
  threads: "Threads",
  tumblr: "Tumblr",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  telegram: "Telegram",
  medium: "Medium",
  substack: "Substack",
  patreon: "Patreon",
  vimeo: "Vimeo",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  bandcamp: "Bandcamp",
  flickr: "Flickr",
  stackoverflow: "Stack Overflow",
  keybase: "Keybase",
  matrix: "Matrix",
  weibo: "Weibo",
  bilibili: "Bilibili",
  xiaohongshu: "Xiaohongshu",
  zhihu: "Zhihu",
  line: "LINE",
  kakao: "Kakao",
  naver: "Naver",
  pixiv: "Pixiv",
  vk: "VK",
  odnoklassniki: "Odnoklassniki",
  mastodon: "Mastodon",
  web: "Web",
};

/**
 * Exact hostname → network id.
 * @type {Record<string, string>}
 */
const HOST_NETWORKS = {
  "x.com": "x",
  "twitter.com": "x",
  "mobile.twitter.com": "x",
  "www.twitter.com": "x",
  "facebook.com": "facebook",
  "www.facebook.com": "facebook",
  "fb.com": "facebook",
  "fb.me": "facebook",
  "m.facebook.com": "facebook",
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "youtube.com": "youtube",
  "www.youtube.com": "youtube",
  "m.youtube.com": "youtube",
  "youtu.be": "youtube",
  "linkedin.com": "linkedin",
  "www.linkedin.com": "linkedin",
  "tiktok.com": "tiktok",
  "www.tiktok.com": "tiktok",
  "vm.tiktok.com": "tiktok",
  "reddit.com": "reddit",
  "www.reddit.com": "reddit",
  "old.reddit.com": "reddit",
  "discord.com": "discord",
  "discord.gg": "discord",
  "twitch.tv": "twitch",
  "www.twitch.tv": "twitch",
  "github.com": "github",
  "www.github.com": "github",
  "gitlab.com": "gitlab",
  "www.gitlab.com": "gitlab",
  "bsky.app": "bluesky",
  "threads.net": "threads",
  "www.threads.net": "threads",
  "tumblr.com": "tumblr",
  "www.tumblr.com": "tumblr",
  "pinterest.com": "pinterest",
  "www.pinterest.com": "pinterest",
  "pin.it": "pinterest",
  "snapchat.com": "snapchat",
  "www.snapchat.com": "snapchat",
  "t.me": "telegram",
  "telegram.me": "telegram",
  "telegram.org": "telegram",
  "medium.com": "medium",
  "www.medium.com": "medium",
  "substack.com": "substack",
  "www.substack.com": "substack",
  "patreon.com": "patreon",
  "www.patreon.com": "patreon",
  "vimeo.com": "vimeo",
  "www.vimeo.com": "vimeo",
  "soundcloud.com": "soundcloud",
  "www.soundcloud.com": "soundcloud",
  "open.spotify.com": "spotify",
  "spotify.com": "spotify",
  "bandcamp.com": "bandcamp",
  "flickr.com": "flickr",
  "www.flickr.com": "flickr",
  "stackoverflow.com": "stackoverflow",
  "www.stackoverflow.com": "stackoverflow",
  "keybase.io": "keybase",
  "matrix.to": "matrix",
  "weibo.com": "weibo",
  "www.weibo.com": "weibo",
  "m.weibo.cn": "weibo",
  "bilibili.com": "bilibili",
  "www.bilibili.com": "bilibili",
  "space.bilibili.com": "bilibili",
  "xiaohongshu.com": "xiaohongshu",
  "www.xiaohongshu.com": "xiaohongshu",
  "xhslink.com": "xiaohongshu",
  "zhihu.com": "zhihu",
  "www.zhihu.com": "zhihu",
  "line.me": "line",
  "page.line.me": "line",
  "story.kakao.com": "kakao",
  "open.kakao.com": "kakao",
  "naver.com": "naver",
  "www.naver.com": "naver",
  "blog.naver.com": "naver",
  "pixiv.net": "pixiv",
  "www.pixiv.net": "pixiv",
  "vk.com": "vk",
  "www.vk.com": "vk",
  "vk.ru": "vk",
  "m.vk.com": "vk",
  "ok.ru": "odnoklassniki",
  "www.ok.ru": "odnoklassniki",
  "mastodon.social": "mastodon",
  "mastodon.online": "mastodon",
  "mastodon.world": "mastodon",
  "mstdn.social": "mastodon",
  "mstdn.jp": "mastodon",
  "fosstodon.org": "mastodon",
  "hachyderm.io": "mastodon",
  "infosec.exchange": "mastodon",
  "tech.lgbt": "mastodon",
  "indieweb.social": "mastodon",
  "mas.to": "mastodon",
  "chaos.social": "mastodon",
  "octodon.social": "mastodon",
  "pawoo.net": "mastodon",
  "m.cmx.im": "mastodon",
};

/**
 * Suffix patterns for multi-tenant hosts (checked after exact map).
 * @type {Array<{suffix: string, network: string}>}
 */
const HOST_SUFFIXES = [
  { suffix: ".substack.com", network: "substack" },
  { suffix: ".medium.com", network: "medium" },
  { suffix: ".bandcamp.com", network: "bandcamp" },
  { suffix: ".tumblr.com", network: "tumblr" },
  { suffix: ".github.io", network: "github" },
  { suffix: ".gitlab.io", network: "gitlab" },
];

/**
 * Catalog passed into the browser extractor for non-rel social discovery.
 * @returns {{
 *   hosts: Record<string, string>,
 *   suffixes: Array<{suffix: string, network: string}>,
 * }}
 */
export function elsewhereHostCatalog() {
  return {
    hosts: {
      ...HOST_NETWORKS,
    },
    suffixes: HOST_SUFFIXES.map((entry) => ({
      suffix: entry.suffix,
      network: entry.network,
    })),
  };
}

/**
 * Classifies a hostname into a catalog network id.
 * @param {string} hostname
 * @returns {string}
 */
export function classifyElsewhereHost(hostname) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

  if (!host) {
    return "web";
  }

  if (Object.hasOwn(HOST_NETWORKS, host)) {
    return HOST_NETWORKS[host];
  }

  for (const entry of HOST_SUFFIXES) {
    if (host.endsWith(entry.suffix)) {
      return entry.network;
    }
  }

  return "web";
}

/**
 * Resolves a display label for a classified elsewhere link.
 * @param {string} network
 * @param {string} hostname
 * @returns {string}
 */
export function elsewhereLabel(network, hostname) {
  if (network !== "web" && Object.hasOwn(ELSEWHERE_LABELS, network)) {
    return ELSEWHERE_LABELS[network];
  }

  const host = String(hostname || "")
    .trim()
    .toLowerCase();

  return host || ELSEWHERE_LABELS.web;
}

const GITHUB_RESERVED = new Set([
  "about",
  "account",
  "blog",
  "contact",
  "customer",
  "enterprise",
  "events",
  "explore",
  "features",
  "home",
  "issues",
  "join",
  "login",
  "logout",
  "marketplace",
  "new",
  "nonprofit",
  "notifications",
  "organizations",
  "pricing",
  "pulls",
  "search",
  "security",
  "settings",
  "site",
  "sponsors",
  "topics",
  "trending",
]);

const X_RESERVED = new Set([
  "compose",
  "explore",
  "hashtag",
  "home",
  "i",
  "intent",
  "login",
  "messages",
  "notifications",
  "search",
  "settings",
  "share",
  "signup",
  "tos",
]);

/**
 * Returns path segments without empties.
 * @param {URL} url
 * @returns {string[]}
 */
function pathSegments(url) {
  return url.pathname.split("/").filter(Boolean);
}

/**
 * Host-discovered social links must look like profiles, not repos or share intents.
 * `rel="me"` links skip this filter.
 * @param {URL} url
 * @param {string} network
 * @returns {boolean}
 */
export function isElsewhereProfileUrl(url, network) {
  const segments = pathSegments(url);
  const first = (segments[0] || "").toLowerCase();

  switch (network) {
    case "github":
    case "gitlab":
      return (
        segments.length === 1 && first !== "" && !GITHUB_RESERVED.has(first)
      );
    case "linkedin":
      return first === "in" && segments.length >= 2;
    case "x":
      return segments.length === 1 && first !== "" && !X_RESERVED.has(first);
    case "instagram":
    case "tiktok":
    case "pinterest":
    case "snapchat":
    case "reddit":
    case "twitch":
    case "patreon":
    case "keybase":
    case "vk":
    case "pixiv":
    case "zhihu":
    case "weibo":
    case "naver":
      return (
        segments.length >= 1 &&
        !["share", "intent", "login", "signup"].includes(first)
      );
    case "threads":
      return (
        segments.length >= 1 && (first.startsWith("@") || segments.length >= 1)
      );
    case "bluesky":
      return first === "profile" && segments.length >= 2;
    case "youtube":
      return (
        first.startsWith("@") ||
        first === "channel" ||
        first === "c" ||
        first === "user" ||
        first === "watch"
      );
    case "facebook":
      return (
        segments.length >= 1 &&
        !["share", "dialog", "login", "watch"].includes(first)
      );
    case "mastodon":
      return (
        segments.length >= 1 && (first.startsWith("@") || segments.length === 1)
      );
    case "discord":
      return (
        first === "users" || first === "invite" || url.hostname === "discord.gg"
      );
    case "telegram":
      return segments.length >= 1;
    case "medium":
    case "substack":
    case "tumblr":
    case "bandcamp":
    case "soundcloud":
    case "spotify":
    case "vimeo":
    case "flickr":
    case "bilibili":
    case "xiaohongshu":
    case "line":
    case "kakao":
    case "odnoklassniki":
    case "stackoverflow":
    case "matrix":
      return true;
    case "web":
      return false;
    default:
      return false;
  }
}

/**
 * Validates and classifies elsewhere links for publication.
 * Accepts `rel="me"` ads and catalog social profile links without rel.
 * Bad items are skipped; they do not reject the participant.
 * @param {unknown} rawElsewhere
 * @param {{
 *   lookup?: typeof dns.lookup,
 *   cache?: Map<string, unknown>,
 * }} [options]
 * @returns {Promise<Array<{url: string, network: string, label: string}>>}
 */
export async function sanitizeElsewhere(
  rawElsewhere,
  { lookup = dns.lookup, cache = new Map() } = {},
) {
  if (!Array.isArray(rawElsewhere)) {
    return [];
  }

  const elsewhere = [];
  const seenUrls = new Set();
  const seenNetworks = new Set();

  for (const candidate of rawElsewhere) {
    if (elsewhere.length >= MAX_ELSEWHERE_PER_PARTICIPANT) {
      break;
    }

    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    let href = "";

    if (typeof candidate.href === "string") {
      href = candidate.href;
    } else if (typeof candidate.url === "string") {
      href = candidate.url;
    }

    const trimmed = normalizeText(href);

    if (!trimmed) {
      continue;
    }

    const fromMe = candidate.me === true;

    let parsed;

    try {
      parsed = new URL(trimmed);
    } catch {
      continue;
    }

    if (parsed.protocol === "mailto:") {
      continue;
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      continue;
    }

    try {
      const url = await assertPublicURL(parsed.href, {
        lookup,
        cache,
      });
      const normalized = url.href;

      if (seenUrls.has(normalized)) {
        continue;
      }

      const network = classifyElsewhereHost(url.hostname);

      if (!fromMe) {
        if (network === "web") {
          continue;
        }

        if (!isElsewhereProfileUrl(url, network)) {
          continue;
        }
      }

      // One icon per network on the card.
      if (network !== "web" && seenNetworks.has(network)) {
        continue;
      }

      seenUrls.add(normalized);

      if (network !== "web") {
        seenNetworks.add(network);
      }

      const label = elsewhereLabel(network, url.hostname);

      elsewhere.push({
        url: normalized,
        network,
        label,
      });
    } catch {
      continue;
    }
  }

  return elsewhere;
}

/**
 * Publishes elsewhere links when present; omits the field when there are none.
 * @param {Record<string, unknown>} entry
 * @param {unknown} elsewhere
 * @returns {Record<string, unknown>}
 */
export function withElsewhere(entry, elsewhere) {
  const next = {
    ...entry,
  };

  delete next.elsewhere;

  if (Array.isArray(elsewhere) && elsewhere.length > 0) {
    next.elsewhere = elsewhere;
  }

  return next;
}
