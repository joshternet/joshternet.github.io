/**
 * Goal & Constraints:
 * Keep the datasets GitHub Actions publishes in the index, and leave this
 * working tree free to rewrite them during a local crawl.
 * Does not change git config. Does not delete crawl output.
 */

import { execFileSync } from "node:child_process";

/** Tracked paths a local crawl rewrites and hourly network-sync commits. */
export const ACTIONS_CRAWL_PATHS = [
  "_data/network.json",
  "_data/blogrolls.json",
  "_data/connections.json",
  "_data/topics.json",
  "_data/site_signals.json",
  "_data/content.json",
  "_data/data_manifest.json",
  "_data/activity.json",
  "_data/explore.json",
  "_data/topic_views.json",
  "_data/connection_topics.json",
  "_data/site_views.json",
  "_data/search_index.json",
  "_data/showcase.json",
  "_data/happening.json",
  "_data/made.json",
  "_data/uses_summary.json",
  "topics",
  "assets/network",
  "assets/activity",
  "assets/data/uses",
  "data/uses",
];

/**
 * Tracked crawl outputs, without the hand-edited Uses catalog or topic hub.
 * @returns {string[]}
 */
export function trackedCrawlOutputs() {
  const listed = execFileSync(
    "git",
    ["ls-files", "-z", "--", ...ACTIONS_CRAWL_PATHS],
    {
      encoding: "utf8",
    },
  );

  return listed.split("\0").filter((file) => {
    if (!file) {
      return false;
    }

    if (file.startsWith("data/uses/catalog/")) {
      return false;
    }

    return file !== "topics/index.md";
  });
}

/**
 * Hides local edits to the Actions publish set from status and commit.
 * @returns {number} How many tracked files were marked.
 */
export function keepCrawlLocal() {
  const files = trackedCrawlOutputs();

  if (files.length === 0) {
    return 0;
  }

  execFileSync("git", ["update-index", "--skip-worktree", "--", ...files], {
    stdio: "inherit",
  });

  return files.length;
}

const invoked =
  process.argv[1] && process.argv[1].endsWith("keep-crawl-local.mjs");

if (invoked) {
  const count = keepCrawlLocal();
  process.stdout.write(
    `Local crawl edits will stay uncommitted for ${count} file(s).\n`,
  );
}
