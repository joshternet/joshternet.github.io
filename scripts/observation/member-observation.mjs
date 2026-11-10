/**
 * Goal & Constraints:
 * One coordinated member observation run: start generation, iterative discovery
 * through registered family adapters via the fetch broker, persist observations
 * into durable stores. Adapters never fetch independently.
 */

import { createFetchBroker } from "./fetch-broker.mjs";
import { registerDefaultContentFamilies } from "./families.mjs";
import { listContentFamilies } from "./family-contract.mjs";
import { startObservationGeneration } from "./generation-lifecycle.mjs";
import { runIterativeDiscovery } from "./iterative-discovery.mjs";

/**
 * @param {object} input
 * @param {string} input.member_origin
 * @param {string} input.base_git_sha
 * @param {import('./source-store.mjs').SourceStore} input.sourceStore
 * @param {import('./observation-store.mjs').ObservationStore} input.observationStore
 * @param {string} [input.observation_run_id]
 * @param {string} [input.registry_snapshot_id]
 * @param {Array<{ url: string, discovery_reason?: string }>} [input.seed_urls]
 * @param {(url: string) => Promise<object>} [input.fetchImpl]
 * @param {number} [input.maxFetches]
 * @param {number} [input.maxRounds]
 * @param {import('./iterative-discovery.mjs').DiscoveryAdapter[]} [input.adapters]
 * @returns {Promise<{
 *   generation: import('./observation-store.mjs').ObservationGenerationRecord,
 *   observations: object[],
 *   discovery: object,
 * }>}
 */
export async function runMemberObservation(input) {
  if (listContentFamilies().length === 0) {
    registerDefaultContentFamilies({ replace: true });
  }

  const generation = await startObservationGeneration(input.observationStore, {
    observation_run_id: input.observation_run_id,
    base_git_sha: input.base_git_sha,
    registry_snapshot_id: input.registry_snapshot_id,
    family_versions: listContentFamilies()
      .map((family) => `${family.id}@${family.schemaVersion}`)
      .join(","),
  });

  const broker = createFetchBroker({
    observation_run_id: generation.observation_run_id,
    member_origin: input.member_origin,
    sourceStore: input.sourceStore,
    observationStore: input.observationStore,
    fetchImpl: input.fetchImpl,
    maxFetches: input.maxFetches,
  });

  for (const seed of input.seed_urls || []) {
    broker.request({
      url: seed.url,
      discovery_reason: seed.discovery_reason || "seed",
      retention_class: "semantic",
      coverage: "complete",
    });
  }

  const adapters =
    input.adapters ||
    listContentFamilies().map((family) => ({
      id: family.id,
      /**
       * @param {{ broker: ReturnType<typeof createFetchBroker>, observations: object[], round: number }} ctx
       */
      async discover(ctx) {
        if (typeof family.discover !== "function") {
          return;
        }
        const requests = await family.discover({
          member_origin: input.member_origin,
          observations: ctx.observations,
          round: ctx.round,
        });
        for (const request of requests || []) {
          if (request?.url) {
            ctx.broker.request({
              url: request.url,
              discovery_reason: request.discovery_reason || family.id,
              retention_class: request.retention_class || "semantic",
            });
          }
        }
      },
    }));

  await broker.drain();
  const discovery = await runIterativeDiscovery({
    broker,
    adapters,
    maxRounds: input.maxRounds,
  });

  return {
    generation,
    observations: discovery.observations,
    discovery,
  };
}
