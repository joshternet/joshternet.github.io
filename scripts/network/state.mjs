import fs from "node:fs/promises";
import path from "node:path";

import { withBlogroll } from "./blogroll.mjs";
import { withElsewhere } from "./elsewhere.mjs";
import { registryParticipationFields } from "./lib.mjs";

export const CAPTURE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function captureIsFresh(entry, currentTime = Date.now()) {
  if (!entry?.captured_at) {
    return false;
  }

  const capturedAt = Date.parse(entry.captured_at);

  if (!Number.isFinite(capturedAt)) {
    return false;
  }

  return currentTime - capturedAt < CAPTURE_MAX_AGE_MS;
}

function participationChanged(entry, participant) {
  const facts = registryParticipationFields(participant);

  return (
    entry.domain !== facts.domain ||
    entry.identity !== facts.identity ||
    entry.first_participated_at !== facts.first_participated_at ||
    entry.latest_declaration_check_at !== facts.latest_declaration_check_at ||
    entry.latest_declaration_check_outcome !==
      facts.latest_declaration_check_outcome ||
    JSON.stringify(entry.declaration) !== JSON.stringify(facts.declaration) ||
    JSON.stringify(entry.initial_declaration) !==
      JSON.stringify(facts.initial_declaration)
  );
}

export function registryNeedsSync(
  participants,
  existing,
  currentTime = Date.now(),
) {
  if (!Array.isArray(participants) || !Array.isArray(existing)) {
    return true;
  }

  if (participants.length !== existing.length) {
    return true;
  }

  const existingByOrigin = new Map();

  for (const entry of existing) {
    if (!entry || typeof entry.origin !== "string") {
      return true;
    }

    existingByOrigin.set(entry.origin, entry);
  }

  if (existingByOrigin.size !== existing.length) {
    return true;
  }

  for (const participant of participants) {
    const entry = existingByOrigin.get(participant.origin);

    if (!entry) {
      return true;
    }

    if (participationChanged(entry, participant)) {
      return true;
    }

    if (!captureIsFresh(entry, currentTime)) {
      return true;
    }
  }

  return false;
}

export function fallbackEntry(participant, previous = null) {
  const entry = {
    ...registryParticipationFields(participant),
    title: previous?.title || participant.domain,
    description:
      typeof previous?.description === "string" ? previous.description : "",
    screenshot: previous?.screenshot || "",
    embeddable:
      typeof previous?.embeddable === "boolean" ? previous.embeddable : false,
    frame_reason:
      typeof previous?.frame_reason === "string"
        ? previous.frame_reason
        : "unknown",
    captured_at: previous?.captured_at || "",
  };

  return withElsewhere(
    withBlogroll(withFeeds(entry, previous?.feeds), previous?.blogroll),
    previous?.elsewhere,
  );
}

/**
 * Publishes feeds when present; omits the field when there are none.
 * @param {Record<string, unknown>} entry
 * @param {unknown} feeds
 * @returns {Record<string, unknown>}
 */
export function withFeeds(entry, feeds) {
  const next = {
    ...entry,
  };

  delete next.feeds;

  if (Array.isArray(feeds) && feeds.length > 0) {
    next.feeds = feeds;
  }

  return next;
}

export async function removeOrphanScreenshots(entries, screenshotRoot) {
  const wanted = new Set(
    entries
      .map((entry) => entry.screenshot)
      .filter(Boolean)
      .map((screenshot) => {
        return path.basename(screenshot);
      }),
  );

  let files;

  try {
    files = await fs.readdir(screenshotRoot);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const file of files) {
    if (file.endsWith(".webp") && !wanted.has(file)) {
      await fs.rm(path.join(screenshotRoot, file), {
        force: true,
      });
    }
  }
}
