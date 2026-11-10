/**
 * Goal & Constraints:
 * Cross-file and historical quality gates for uses datasets. Fail closed.
 */

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
  if (rollup == null) {
    return ["rollup missing"];
  }
  if (typeof rollup !== "object") {
    return ["rollup missing"];
  }
  const tools = Array.isArray(rollup.tools) ? rollup.tools : [];
  const seenTools = new Set();
  for (const tool of tools) {
    if (seenTools.has(tool.tool_id)) {
      errors.push(`duplicate tool row: ${tool.tool_id}`);
    }
    seenTools.add(tool.tool_id);
    const origins = Array.isArray(tool.active_member_origins)
      ? tool.active_member_origins
      : [];
    const unique = new Set(origins).size;
    const countsUnits = tool.count_basis === "units";
    if (!countsUnits && tool.active_member_count !== unique) {
      errors.push(`active_member_count !== unique origins for ${tool.tool_id}`);
    }
    if (countsUnits && tool.active_member_count < unique) {
      errors.push(`unit count below unique origins for ${tool.tool_id}`);
    }
    if (tool.active_member_count < 0) {
      errors.push(`negative count for ${tool.tool_id}`);
    }
    if (tool.adoption_score !== null) {
      if (tool.adoption_score < 0) {
        errors.push(`adoption_score out of range for ${tool.tool_id}`);
      } else if (tool.adoption_score > 100) {
        errors.push(`adoption_score out of range for ${tool.tool_id}`);
      }
    }
    let denominator = rollup.verified_uses_member_count;
    if (Number.isFinite(tool.denominator)) {
      denominator = tool.denominator;
    }
    if (tool.adoption_score !== null) {
      if (denominator > 0) {
        const expected = Math.round(
          (100 * tool.active_member_count) / denominator,
        );
        if (tool.adoption_score !== expected) {
          errors.push(`adoption_score mismatch for ${tool.tool_id}`);
        }
      }
    }
    if (tool.active_member_count > denominator) {
      errors.push(`active exceeds denominator for ${tool.tool_id}`);
    }
    if (
      !countsUnits &&
      tool.active_member_count > rollup.verified_uses_member_count
    ) {
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
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  if (nodeIds.size !== nodes.length) {
    errors.push("duplicate graph node ids");
  }
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`orphan edge ${edge.from} -> ${edge.to}`);
    } else if (!nodeIds.has(edge.to)) {
      errors.push(`orphan edge ${edge.from} -> ${edge.to}`);
    }
    if (edge.relation === "uses") {
      if (!edge.evidence_event_id) {
        errors.push(`uses edge missing evidence: ${edge.from}`);
      }
    }
    const fromMember = String(edge.from).startsWith("member:");
    const toMember = String(edge.to).startsWith("member:");
    if (fromMember) {
      if (toMember) {
        errors.push("forbidden member-member edge");
      }
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
  const stateThrough = state.through_event_id
    ? String(state.through_event_id)
    : "";
  if (replayed.through_event_id !== stateThrough) {
    if (events.length > 0) {
      errors.push("state through_event_id does not match replay");
    } else if (state.through_event_id) {
      errors.push("state through_event_id does not match replay");
    }
  }
  const replayTools = toolProjection(replayed.members);
  const stateMembers = Array.isArray(state.members) ? state.members : [];
  const stateTools = toolProjection(stateMembers);
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
    .map((member) => {
      const tools = Array.isArray(member.tools) ? member.tools : [];
      return {
        origin: member.origin,
        tools: [...tools]
          .map((tool) => {
            const useCases = Array.isArray(tool.use_case_ids)
              ? tool.use_case_ids
              : [];
            return {
              tool_id: tool.tool_id,
              status: tool.status,
              use_case_ids: [...useCases].sort(),
              evidence_event_id: tool.evidence_event_id,
            };
          })
          .sort((a, b) => a.tool_id.localeCompare(b.tool_id)),
      };
    })
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
export async function validateUsesRoot(rootDir, options) {
  const resolvedOptions = options == null ? {} : options;
  void resolvedOptions;
  /** @type {string[]} */
  const errors = [];
  const events = await loadAllEvents(rootDir);
  const state = await readJson(path.join(rootDir, "state.json"), {
    schema_version: 1,
    through_event_id: "",
    members: [],
  });
  errors.push(...validateHistoryInvariants(events, state));

  const members = Array.isArray(state.members) ? state.members : [];
  for (const member of members) {
    if (!PAGE_OUTCOMES.has(member.page_status)) {
      if (member.page_status) {
        errors.push(`unknown page_status for ${member.origin}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * CLI entry used by npm run uses:validate.
 * @param {string[]} [argv] - CLI args after the entry path. Defaults to process.argv.slice(2).
 * @returns {Promise<number>}
 */
export async function main(argv) {
  const args = Array.isArray(argv) ? argv : process.argv.slice(2);
  const rootArg = args.find((a) => a.startsWith("--root="));
  let root = path.join(process.cwd(), "data", "uses");
  if (rootArg) {
    root = rootArg.slice("--root=".length);
  }
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

/**
 * Runs the CLI when this file is the process entry point.
 * Defaults are resolved in the body so coverage stays stable under full suite runs.
 * @param {string} [entryPath] - Process entry path. Defaults to argv[1].
 * @param {string[]} [argv] - Arguments after the entry path.
 * @returns {Promise<number | null>} Exit code when this module is the entry, otherwise null.
 */
export async function runCli(entryPath, argv) {
  const modulePath = fileURLToPath(import.meta.url);
  if (entryPath == null) {
    return null;
  }
  if (entryPath === "") {
    return null;
  }
  if (path.resolve(String(entryPath)) !== path.resolve(modulePath)) {
    return null;
  }
  const args = Array.isArray(argv) ? argv : process.argv.slice(2);
  const code = await main(args);
  process.exitCode = code;
  return code;
}

// Always hand argv through runCli so module-load coverage does not depend on
// whether process.argv[1] is a string (node --test vs direct entry).
await runCli(process.argv[1], process.argv.slice(2));
