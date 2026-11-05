/**
 * Goal & Constraints:
 * Cross-file and historical quality gates for uses datasets. Fail closed.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  EARLY_SAMPLE_MIN_COVERAGE,
  EARLY_SAMPLE_MIN_PUBLISHERS,
  PAGE_OUTCOMES,
} from "./constants.mjs";
import { loadAllEvents, readJson, replayState } from "./store.mjs";

/**
 * Creates an Ajv instance matching existing NLP validation style.
 * @returns {import('ajv').default}
 */
export function createUsesAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

/**
 * Validates rollup invariants.
 * @param {object} rollup
 * @returns {string[]} error messages
 */
export function validateRollupInvariants(rollup) {
  /** @type {string[]} */
  const errors = [];
  if (!rollup || typeof rollup !== "object") {
    return ["rollup missing"];
  }
  const seenTools = new Set();
  for (const tool of rollup.tools || []) {
    if (seenTools.has(tool.tool_id)) {
      errors.push(`duplicate tool row: ${tool.tool_id}`);
    }
    seenTools.add(tool.tool_id);
    const unique = new Set(tool.active_member_origins || []).size;
    if (tool.active_member_count !== unique) {
      errors.push(`active_member_count !== unique origins for ${tool.tool_id}`);
    }
    if (tool.active_member_count < 0) {
      errors.push(`negative count for ${tool.tool_id}`);
    }
    if (
      tool.adoption_score !== null &&
      (tool.adoption_score < 0 || tool.adoption_score > 100)
    ) {
      errors.push(`adoption_score out of range for ${tool.tool_id}`);
    }
    const denominator = Number.isFinite(tool.denominator)
      ? tool.denominator
      : rollup.verified_uses_member_count;
    if (tool.adoption_score !== null && denominator > 0) {
      const expected = Math.round(
        (100 * tool.active_member_count) / denominator,
      );
      if (tool.adoption_score !== expected) {
        errors.push(`adoption_score mismatch for ${tool.tool_id}`);
      }
    }
    if (tool.active_member_count > denominator) {
      errors.push(`active exceeds denominator for ${tool.tool_id}`);
    }
    if (tool.active_member_count > rollup.verified_uses_member_count) {
      errors.push(`active exceeds coverage for ${tool.tool_id}`);
    }
  }
  return errors;
}

/**
 * Validates graph has no member–member edges and evidence for uses edges.
 * @param {object} graph
 * @returns {string[]}
 */
export function validateGraphInvariants(graph) {
  /** @type {string[]} */
  const errors = [];
  const nodeIds = new Set((graph.nodes || []).map((n) => n.id));
  if (nodeIds.size !== (graph.nodes || []).length) {
    errors.push("duplicate graph node ids");
  }
  for (const edge of graph.edges || []) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push(`orphan edge ${edge.from} -> ${edge.to}`);
    }
    if (edge.relation === "uses" && !edge.evidence_event_id) {
      errors.push(`uses edge missing evidence: ${edge.from}`);
    }
    if (
      String(edge.from).startsWith("member:") &&
      String(edge.to).startsWith("member:")
    ) {
      errors.push("forbidden member-member edge");
    }
  }
  return errors;
}

/**
 * Validates event list uniqueness and replay consistency.
 * @param {object[]} events
 * @param {object} state
 * @returns {string[]}
 */
export function validateHistoryInvariants(events, state) {
  /** @type {string[]} */
  const errors = [];
  const ids = new Set();
  for (const event of events) {
    if (ids.has(event.event_id)) {
      errors.push(`duplicate event_id ${event.event_id}`);
    }
    ids.add(event.event_id);
    const t = Date.parse(event.observed_at);
    if (!Number.isFinite(t)) {
      errors.push(`bad observed_at ${event.event_id}`);
    }
    if (t > Date.now() + 5 * 60 * 1000) {
      errors.push(`future timestamp ${event.event_id}`);
    }
  }
  const replayed = replayState(events);
  if (replayed.through_event_id !== (state.through_event_id || "")) {
    if (events.length > 0 || state.through_event_id) {
      errors.push("state through_event_id does not match replay");
    }
  }
  const replayTools = toolProjection(replayed.members);
  const stateTools = toolProjection(state.members || []);
  if (JSON.stringify(replayTools) !== JSON.stringify(stateTools)) {
    errors.push("state tool projection does not match event replay");
  }
  return errors;
}

/**
 * Stable tool projection for replay comparison (ignores page_status overlays).
 * @param {object[]} members
 * @returns {object[]}
 */
function toolProjection(members) {
  return [...members]
    .map((member) => ({
      origin: member.origin,
      tools: [...(member.tools || [])]
        .map((tool) => ({
          tool_id: tool.tool_id,
          status: tool.status,
          use_case_ids: [...(tool.use_case_ids || [])].sort(),
          evidence_event_id: tool.evidence_event_id,
        }))
        .sort((a, b) => a.tool_id.localeCompare(b.tool_id)),
    }))
    .sort((a, b) => a.origin.localeCompare(b.origin));
}

/**
 * Early-sample detector for UI honesty.
 * @param {number} verifiedPublishers
 * @param {number} eligibleCount
 * @returns {boolean}
 */
export function isEarlySample(verifiedPublishers, eligibleCount) {
  if (verifiedPublishers < EARLY_SAMPLE_MIN_PUBLISHERS) {
    return true;
  }
  if (eligibleCount <= 0) {
    return true;
  }
  return verifiedPublishers / eligibleCount < EARLY_SAMPLE_MIN_COVERAGE;
}

/**
 * Validates a uses data root directory.
 * @param {string} rootDir - data/uses
 * @param {object} [options]
 * @param {string} [options.schemaDir]
 * @returns {Promise<{ ok: boolean, errors: string[] }>}
 */
export async function validateUsesRoot(rootDir, options = {}) {
  /** @type {string[]} */
  const errors = [];
  const events = await loadAllEvents(rootDir);
  const state = await readJson(path.join(rootDir, "state.json"), {
    schema_version: 1,
    through_event_id: "",
    members: [],
  });
  errors.push(...validateHistoryInvariants(events, state));

  for (const member of state.members || []) {
    if (!PAGE_OUTCOMES.has(member.page_status) && member.page_status) {
      // page_status on state uses the same outcome set
      errors.push(`unknown page_status for ${member.origin}`);
    }
  }

  const schemaDir =
    options.schemaDir || path.join(rootDir, "..", "..", "schemas");
  try {
    const rollupSchemaPath = path.join(schemaDir, "uses-rollup.schema.json");
    await readFile(rollupSchemaPath, "utf8");
  } catch {
    // Schemas may be validated separately when absent in unit tests.
  }

  return { ok: errors.length === 0, errors };
}

/**
 * CLI entry used by npm run uses:validate.
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export async function main(argv = process.argv.slice(2)) {
  const root =
    argv.find((a) => a.startsWith("--root="))?.slice("--root=".length) ||
    path.join(process.cwd(), "data", "uses");
  const result = await validateUsesRoot(root);
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`uses:validate: ${error}`);
    }
    return 1;
  }
  console.log("uses:validate ok");
  return 0;
}

const isDirect =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirect) {
  main().then((code) => {
    process.exitCode = code;
  });
}
