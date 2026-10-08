/**
 * Goal & Constraints:
 * Local registry simulation for origins that publish /.well-known/josh before
 * JoshBot has recorded them. Inputs: _data/network_preview.json plus a live
 * declaration fetch. Outputs: publication-shaped participants, or a skip
 * reason when the declaration is missing or invalid. CI and GitHub Actions
 * ignore the file so production publishes only the JoshBot registry.
 */

import fs from "node:fs/promises";

import { classifyLiveResponse } from "../../assets/js/declaration-validate.js";
import {
  canonicalOrigin,
  cloneDeclaration,
  identityFromDeclaration,
  registryTimestamp,
} from "./lib.mjs";

const MAX_REDIRECTS = 5;

/**
 * @param {unknown} error - Thrown value from fetch or a response body read.
 * @returns {string} Message safe to log.
 */
function errorReason(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Whether this process should merge local preview origins into the registry.
 * @param {NodeJS.ProcessEnv} [env] - Environment to read. Defaults to process.env.
 * @returns {boolean} True outside CI and GitHub Actions.
 */
export function localPreviewEnabled(env = process.env) {
  const ci = env.CI;
  const actions = env.GITHUB_ACTIONS;

  if (ci === "true" || ci === "1" || actions === "true") {
    return false;
  }

  return true;
}

/**
 * Builds the version 1 declaration object for a validated identity.
 * @param {string} identity - affirmed, declined, or undeclared.
 * @returns {{ version: 1, josh?: boolean }} Declaration stored on a participant.
 */
function declarationForIdentity(identity) {
  if (identity === "affirmed") {
    return { version: 1, josh: true };
  }

  if (identity === "declined") {
    return { version: 1, josh: false };
  }

  return { version: 1 };
}

/**
 * Parses one preview participant.
 * @param {unknown} entry - Raw JSON value.
 * @param {Set<string>} seen - Origins already accepted.
 * @returns {{ origin: string, first_participated_at: string, latest_declaration_check_at: string }}
 * @throws {Error} When the entry is not a unique canonical origin with timestamps.
 */
function parseParticipant(entry, seen) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error("preview participant must be an object");
  }

  const origin = canonicalOrigin(entry.origin);

  if (seen.has(origin)) {
    throw new Error(`duplicate preview origin: ${origin}`);
  }

  seen.add(origin);

  return {
    origin,
    first_participated_at: registryTimestamp(
      entry.first_participated_at,
      "first_participated_at",
    ),
    latest_declaration_check_at: registryTimestamp(
      entry.latest_declaration_check_at,
      "latest_declaration_check_at",
    ),
  };
}

/**
 * Parses a preview document.
 * @param {unknown} value - Parsed JSON.
 * @returns {{ schema_version: 1, participants: Array<{ origin: string, first_participated_at: string, latest_declaration_check_at: string }> }}
 * @throws {Error} When the document shape is wrong.
 */
export function parsePreviewDocument(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("preview document must be an object");
  }

  if (value.schema_version !== 1) {
    throw new Error("preview schema_version must be 1");
  }

  if (!Array.isArray(value.participants)) {
    throw new Error("preview participants must be an array");
  }

  const seen = new Set();
  const participants = [];

  for (const entry of value.participants) {
    participants.push(parseParticipant(entry, seen));
  }

  return {
    schema_version: 1,
    participants,
  };
}

/**
 * Reads the preview file. A missing file means there is nothing to simulate.
 * @param {string} filePath - Absolute or relative path to network_preview.json.
 * @returns {Promise<{ schema_version: 1, participants: Array<{ origin: string, first_participated_at: string, latest_declaration_check_at: string }> }>}
 * @throws {Error} When the file exists but is not a valid preview document.
 */
export async function readPreviewFile(filePath) {
  let text;

  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        schema_version: 1,
        participants: [],
      };
    }

    throw error;
  }

  return parsePreviewDocument(JSON.parse(text));
}

/**
 * Fetches one origin's declaration without following cross-origin redirects.
 * @param {string} origin - Canonical origin.
 * @param {typeof fetch} fetchImpl - HTTP implementation.
 * @returns {Promise<{ ok: true, identity: string } | { ok: false, reason: string }>}
 */
async function readDeclaration(origin, fetchImpl) {
  let current = `${origin}/.well-known/josh`;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response;

    try {
      response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "application/json, */*",
        },
        signal: AbortSignal.timeout(12_000),
      });
    } catch (error) {
      return {
        ok: false,
        reason: errorReason(error),
      };
    }

    const status = response.status;
    const location = response.headers.get("location");

    if (status >= 300 && status < 400 && location) {
      let next;

      try {
        next = new URL(location, current);
      } catch (error) {
        return {
          ok: false,
          reason: errorReason(error),
        };
      }

      if (next.origin !== origin) {
        return {
          ok: false,
          reason: "redirected to a different origin",
        };
      }

      if (hop === MAX_REDIRECTS) {
        break;
      }

      current = next.href;
      continue;
    }

    let body;

    try {
      body = await response.text();
    } catch (error) {
      return {
        ok: false,
        reason: errorReason(error),
      };
    }

    const classification = classifyLiveResponse({
      requestedOrigin: origin,
      finalURL: current,
      status,
      contentType: response.headers.get("content-type") || "",
      body,
    });

    if (
      classification.kind !== "declaration" ||
      classification.declaration.ok !== true
    ) {
      return {
        ok: false,
        reason: classification.summary,
      };
    }

    return {
      ok: true,
      identity: classification.declaration.identity,
    };
  }

  return {
    ok: false,
    reason: "too many redirects",
  };
}

/**
 * Turns preview rows into participants when the live declaration is valid.
 * @param {Array<{ origin: string, first_participated_at: string, latest_declaration_check_at: string }>} participants - Parsed preview rows.
 * @param {{ fetchImpl: typeof fetch }} options - HTTP boundary.
 * @returns {Promise<{ participants: Array<Record<string, unknown>>, skipped: Array<{ origin: string, reason: string }> }>}
 * @throws {Error} When fetchImpl is missing.
 */
export async function simulatedParticipants(participants, { fetchImpl } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("preview fetch implementation is required");
  }

  const accepted = [];
  const skipped = [];

  for (const participant of participants) {
    const result = await readDeclaration(participant.origin, fetchImpl);

    if (!result.ok) {
      skipped.push({
        origin: participant.origin,
        reason: result.reason,
      });
      continue;
    }

    const declaration = declarationForIdentity(result.identity);

    accepted.push({
      origin: participant.origin,
      domain: new URL(participant.origin).host,
      identity: identityFromDeclaration(declaration),
      declaration: cloneDeclaration(declaration),
      initial_declaration: cloneDeclaration(declaration),
      first_participated_at: participant.first_participated_at,
      latest_declaration_check_at: participant.latest_declaration_check_at,
      latest_declaration_check_outcome: "valid",
    });
  }

  return {
    participants: accepted,
    skipped,
  };
}

/**
 * Adds simulated participants that are not already in the registry projection.
 * @param {Array<{ origin: string }>} projected - Participants from the JoshBot registry.
 * @param {Array<{ origin: string }>} extra - Simulated participants.
 * @returns {Array<{ origin: string }>} Combined list sorted by origin.
 */
export function mergePreviewParticipants(projected, extra) {
  const merged = [];
  const seen = new Set();

  for (const entry of Array.isArray(projected) ? projected : []) {
    if (!entry || typeof entry.origin !== "string") {
      continue;
    }

    if (seen.has(entry.origin)) {
      continue;
    }

    seen.add(entry.origin);
    merged.push(entry);
  }

  for (const participant of Array.isArray(extra) ? extra : []) {
    if (!participant || typeof participant.origin !== "string") {
      continue;
    }

    if (seen.has(participant.origin)) {
      continue;
    }

    seen.add(participant.origin);
    merged.push(participant);
  }

  merged.sort((left, right) => left.origin.localeCompare(right.origin));

  return merged;
}
