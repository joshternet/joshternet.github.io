/**
 * Goal & Constraints:
 * Untrack the datasets GitHub Actions publishes so local crawls stay
 * gitignored. Does not change git config. Does not delete crawl output on disk.
 * Hand-edited topics/index.md and data/uses/catalog/ stay tracked.
 */

import { execFileSync } from "node:child_process";

/** Paths a local crawl rewrites and hourly network-sync force-adds. */
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
  "_data/past_events.json",
  "_data/generation_manifest.json",
  "topics",
  "assets/network",
  "assets/activity",
  "assets/data/uses",
  "assets/events/joshternet.ics",
  "data/uses",
];

/**
 * Whether a tracked path is a crawl output (not the hand-edited allowlist).
 * @param {string} file - Path relative to the repository root.
 * @returns {boolean}
 */
export function isGeneratedCrawlOutput(file) {
  if (!file) {
    return false;
  }

  if (file.startsWith("data/uses/catalog/")) {
    return false;
  }

  if (file === "topics/index.md") {
    return false;
  }

  return true;
}

/**
 * Tracked crawl outputs still in the index, without the hand-edited allowlist.
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

  return listed.split("\0").filter(isGeneratedCrawlOutput);
}

/**
 * Clears skip-worktree bits and removes crawl outputs from the index so
 * `.gitignore` can hide local rewrites. Files remain on disk.
 * @returns {number} How many tracked files were removed from the index.
 */
export function keepCrawlLocal() {
  const files = trackedCrawlOutputs();

  if (files.length === 0) {
    return 0;
  }

  execFileSync("git", ["update-index", "--no-skip-worktree", "--", ...files], {
    stdio: "inherit",
  });
  execFileSync("git", ["rm", "-f", "--cached", "--", ...files], {
    stdio: "inherit",
  });

  return files.length;
}

const invoked =
  process.argv[1] && process.argv[1].endsWith("keep-crawl-local.mjs");

if (invoked) {
  const count = keepCrawlLocal();
  process.stdout.write(
    count === 0
      ? "Crawl publish set is already untracked (gitignored for local runs).\n"
      : `Removed ${count} crawl output(s) from the index; files stay on disk and stay gitignored.\n`,
  );
}
