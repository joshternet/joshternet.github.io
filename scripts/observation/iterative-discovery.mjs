/**
 * Goal & Constraints:
 * Bounded multi-round discovery within one coordinated observation run.
 * Adapters inspect fetched observations and request more URLs via the broker.
 * Budget exhaustion is incomplete coverage, never verified absence.
 */

/**
 * @typedef {object} DiscoveryAdapter
 * @property {string} id
 * @property {(ctx: {
 *   broker: ReturnType<import('./fetch-broker.mjs').createFetchBroker>,
 *   round: number,
 *   observations: object[],
 * }) => void|Promise<void>} discover
 */

/**
 * Runs iterative discovery until idle or max rounds / budget.
 * @param {object} input
 * @param {ReturnType<import('./fetch-broker.mjs').createFetchBroker>} input.broker
 * @param {DiscoveryAdapter[]} input.adapters
 * @param {number} [input.maxRounds]
 * @returns {Promise<{
 *   rounds: number,
 *   observations: object[],
 *   budget_exhausted: boolean,
 *   stopped_reason: 'idle'|'max-rounds'|'budget',
 * }>}
 */
export async function runIterativeDiscovery(input) {
  const broker = input.broker;
  const adapters = input.adapters || [];
  const maxRounds =
    Number.isFinite(input.maxRounds) && input.maxRounds > 0
      ? Math.floor(input.maxRounds)
      : 8;

  let rounds = 0;
  /** @type {object[]} */
  let observations = broker.list();

  while (rounds < maxRounds) {
    rounds += 1;
    for (const adapter of adapters) {
      await adapter.discover({
        broker,
        round: rounds,
        observations,
      });
    }
    if (broker.pendingCount() === 0) {
      return {
        rounds,
        observations: broker.list(),
        budget_exhausted: broker.isBudgetExhausted(),
        stopped_reason: broker.isBudgetExhausted() ? "budget" : "idle",
      };
    }
    const produced = await broker.drain();
    observations = broker.list();
    if (broker.isBudgetExhausted() && broker.pendingCount() === 0) {
      return {
        rounds,
        observations,
        budget_exhausted: true,
        stopped_reason: "budget",
      };
    }
  }

  return {
    rounds,
    observations: broker.list(),
    budget_exhausted: broker.isBudgetExhausted(),
    stopped_reason: "max-rounds",
  };
}
