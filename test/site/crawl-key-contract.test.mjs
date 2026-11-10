/**
 * Goal: Fail CI when Liquid still reads clear crawl field names on encoded
 * datasets, or when network.json is left clear after encode.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CRAWL_KEYS } from "../../scripts/nlp/site-record.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Hand-edited _data files that stay clear on purpose. */
const CLEAR_DATA_ALLOWLIST = new Set([
  "topic_aliases",
  "topic_denylist",
  "network_display_titles",
  "network_dev",
  "network_preview",
  "content_support_matrix",
]);

/**
 * Clear field leftovers that blank or skew encoded-dataset pages.
 * @type {ReadonlyArray<{ pattern: RegExp, message: string }>}
 */
const FORBIDDEN_LIQUID = [
  {
    pattern: /\bcandidate\.origin\b/,
    message: "connections peer lookup must use candidate.k4b",
  },
  {
    pattern: /\bcandidate\.title\b/,
    message: "connections peer lookup must use candidate.k7c",
  },
  {
    pattern: /\bcandidate\.domain\b/,
    message: "connections peer lookup must use candidate.k1v",
  },
  {
    pattern: /\bpeer\.articles\b/,
    message: "connections topic peers must use peer.kc",
  },
  {
    pattern: /\bsite_group\.site_title\b/,
    message: "seeking site groups must use site_group.k6h",
  },
  {
    pattern: /\bsite_group\.requests\b/,
    message: "seeking site groups must use site_group.k5s",
  },
  {
    pattern: /\bsite_group\.domain\b/,
    message: "seeking site groups must use site_group.k1v",
  },
  {
    pattern: /\bsite_group\.language\b/,
    message: "seeking site groups must use site_group.k3i",
  },
  {
    pattern: /topic_views\.neighborhoods\b/,
    message: "topic_views neighborhoods must use k44",
  },
  {
    pattern: /topic_views\.community_count\b/,
    message: "topic_views community_count must use kv",
  },
  {
    pattern: /sort:\s*'domain'/,
    message: "network domain sort must use k1v",
  },
  {
    pattern: /sort:\s*'origin'/,
    message: "network origin sort must use k4b",
  },
  {
    pattern: /sort:\s*'first_participated_at'/,
    message: "network first_participated_at sort must use k2j",
  },
  {
    pattern: /\barrival_site\.domain\b/,
    message: "home meet welcome exclusion must use arrival_site.k1v",
  },
  {
    pattern: /origin_entry\.pages\b/,
    message: "connections-page-label must use origin_entry.k4n",
  },
  {
    pattern: /signal_page\.url\b/,
    message: "connections-page-label must use signal_page.k7o",
  },
  {
    pattern: /signal_page\.title\b/,
    message: "connections-page-label must use signal_page.k7c",
  },
];

/**
 * @param {string} dir
 * @param {(name: string) => boolean} match
 * @returns {Promise<string[]>}
 */
async function listFiles(dir, match) {
  const entries = await readdir(dir, { withFileTypes: true });
  /** @type {string[]} */
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "_site" ||
        entry.name === ".git"
      ) {
        continue;
      }
      out.push(...(await listFiles(full, match)));
    } else if (match(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

test("relative crawl paths encode and denylist stays clear", async () => {
  const { isCrawlJsonPath } = await import("../../scripts/nlp/site-record.mjs");
  assert.equal(isCrawlJsonPath("_data/network.json"), true);
  assert.equal(isCrawlJsonPath("_data/topic_aliases.json"), false);
});

test("network.json on disk uses short crawl keys", async () => {
  const raw = await readFile(path.join(root, "_data/network.json"), "utf8");
  const network = JSON.parse(raw);
  assert.ok(Array.isArray(network) && network.length > 0);
  assert.equal(typeof network[0].k4b, "string");
  assert.equal(network[0].origin, undefined);
});

test("Liquid templates do not read clear keys on encoded datasets", async () => {
  const files = [
    ...(await listFiles(root, (name) => name.endsWith(".md"))),
    ...(await listFiles(path.join(root, "_includes"), (name) =>
      name.endsWith(".html"),
    )),
    ...(await listFiles(path.join(root, "_layouts"), (name) =>
      name.endsWith(".html"),
    )),
  ].filter((file) => {
    const rel = path.relative(root, file);
    return (
      !rel.startsWith("node_modules") &&
      !rel.startsWith("docs/") &&
      !rel.startsWith("implement/content/") &&
      !rel.startsWith("test/") &&
      !rel.startsWith(".tmp/")
    );
  });

  /** @type {string[]} */
  const failures = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const rel = path.relative(root, file);
    for (const rule of FORBIDDEN_LIQUID) {
      if (rule.pattern.test(text)) {
        failures.push(`${rel}: ${rule.message}`);
      }
    }
    for (const clearName of Object.keys(CRAWL_KEYS)) {
      if (clearName.length < 4) {
        continue;
      }
      if (CLEAR_DATA_ALLOWLIST.has(clearName)) {
        continue;
      }
      const dataDot = new RegExp(
        String.raw`site\.data\.(?!${[...CLEAR_DATA_ALLOWLIST].join("|")})\w+\.${clearName}\b`,
      );
      if (dataDot.test(text)) {
        failures.push(
          `${rel}: site.data.*.${clearName} must use short key ${CRAWL_KEYS[clearName]}`,
        );
      }
    }
  }

  assert.deepEqual(failures, []);
});
