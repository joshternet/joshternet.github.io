/**
 * Goal & Constraints:
 * Typed usage graph projection (member→tool→category/use-case). Never invent
 * member–member edges or merge into connections.json.
 */

import { USES_SCHEMA_VERSION } from "./constants.mjs";
import { publicToolName } from "./normalize.mjs";

/**
 * Builds a bounded graph for a period rollup + state + catalogs.
 * @param {object} input
 * @param {object} input.rollup
 * @param {object} input.state
 * @param {Array<{ id: string, name: string, category_id?: string }>} input.tools
 * @param {Array<{ id: string, name: string }>} input.categories
 * @param {Array<{ id: string, name: string }>} input.useCases
 * @param {Map<string, string>} [input.memberLabels] - origin → display label
 * @returns {object}
 */
export function buildUsageGraph(input) {
  const rollup = input.rollup;
  const toolMeta = new Map((input.tools || []).map((t) => [t.id, t]));
  const categoryMeta = new Map((input.categories || []).map((c) => [c.id, c]));
  const useCaseMeta = new Map((input.useCases || []).map((u) => [u.id, u]));
  const labels = input.memberLabels || new Map();

  /** @type {Map<string, object>} */
  const nodes = new Map();
  /** @type {object[]} */
  const edges = [];

  const addNode = (node) => {
    if (!nodes.has(node.id)) {
      nodes.set(node.id, node);
    }
  };

  /** @type {Map<string, Set<string>>} */
  const memberTools = new Map();

  for (const toolRow of rollup.tools || []) {
    const meta = toolMeta.get(toolRow.tool_id);
    addNode({
      id: `tool:${toolRow.tool_id}`,
      kind: "tool",
      label: meta?.name || publicToolName(toolRow.name, toolRow.tool_id),
    });

    if (meta?.category_id && categoryMeta.has(meta.category_id)) {
      const cat = categoryMeta.get(meta.category_id);
      addNode({
        id: `category:${cat.id}`,
        kind: "category",
        label: cat.name,
      });
      edges.push({
        from: `tool:${toolRow.tool_id}`,
        to: `category:${cat.id}`,
        relation: "classified_as",
      });
    }

    for (const useCase of toolRow.use_cases || []) {
      if (!useCaseMeta.has(useCase.id)) {
        continue;
      }
      const uc = useCaseMeta.get(useCase.id);
      addNode({
        id: `usecase:${uc.id}`,
        kind: "usecase",
        label: uc.name,
      });
      edges.push({
        from: `tool:${toolRow.tool_id}`,
        to: `usecase:${uc.id}`,
        relation: "used_for",
        member_count: useCase.member_count,
      });
    }

    for (const origin of toolRow.active_member_origins || []) {
      addNode({
        id: `member:${origin}`,
        kind: "member",
        label: labels.get(origin) || origin.replace(/^https?:\/\//, ""),
      });
      const evidenceId = findEvidenceEventId(
        input.state,
        origin,
        toolRow.tool_id,
      );
      edges.push({
        from: `member:${origin}`,
        to: `tool:${toolRow.tool_id}`,
        relation: "uses",
        evidence_event_id: evidenceId,
      });
      if (!memberTools.has(origin)) {
        memberTools.set(origin, new Set());
      }
      memberTools.get(origin).add(toolRow.tool_id);
    }
  }

  // co_used_with: tools shared by ≥2 distinct members in this period.
  /** @type {Map<string, Set<string>>} */
  const pairMembers = new Map();
  for (const [, tools] of memberTools) {
    const list = [...tools].sort();
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const key = `${list[i]}|${list[j]}`;
        if (!pairMembers.has(key)) {
          pairMembers.set(key, new Set());
        }
      }
    }
  }
  for (const [origin, tools] of memberTools) {
    const list = [...tools].sort();
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const key = `${list[i]}|${list[j]}`;
        pairMembers.get(key).add(origin);
      }
    }
  }
  for (const [key, origins] of pairMembers) {
    if (origins.size < 2) {
      continue;
    }
    const [a, b] = key.split("|");
    edges.push({
      from: `tool:${a}`,
      to: `tool:${b}`,
      relation: "co_used_with",
      member_count: origins.size,
    });
  }

  const nodeList = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  edges.sort(
    (a, b) =>
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to) ||
      a.relation.localeCompare(b.relation),
  );

  return {
    schema_version: USES_SCHEMA_VERSION,
    period: rollup.period,
    nodes: nodeList,
    edges,
  };
}

/**
 * @param {object} state
 * @param {string} origin
 * @param {string} toolId
 * @returns {string}
 */
function findEvidenceEventId(state, origin, toolId) {
  const member = (state?.members || []).find((m) => m.origin === origin);
  const tool = (member?.tools || []).find((t) => t.tool_id === toolId);
  return tool?.evidence_event_id || "";
}
