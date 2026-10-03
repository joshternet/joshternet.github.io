/**
 * Goal: No O(n²) topic-pair materialization as site count grows.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { topicConnectionObservations } from "../../scripts/network/connections.mjs";
import { buildTopicCommunities } from "../../scripts/nlp/communities.mjs";

test("100 sites sharing one declared topic creates memberships not pairs", () => {
  const origins = [];

  for (let index = 0; index < 100; index += 1) {
    const origin = `https://site${index}.example`;
    origins.push({
      origin,
      domain: `site${index}.example`,
      declared_topics: [
        {
          slug: "design",
          label: "Design",
          community_eligible: true,
          evidence: [
            {
              class: "declared",
              source: "rss:category",
              community_eligible: true,
              page: `${origin}/p`,
            },
          ],
        },
      ],
      subject_signals: [],
    });
  }

  const { communities } = buildTopicCommunities(origins);
  assert.equal(communities.length, 1);
  assert.equal(communities[0].member_count, 100);
  assert.equal(
    topicConnectionObservations(
      origins,
      origins.map((item) => item.origin),
    ).length,
    0,
  );
});

test("1000 sites sharing one declared topic creates memberships not pairs", () => {
  const origins = [];

  for (let index = 0; index < 1000; index += 1) {
    const origin = `https://site${index}.example`;
    origins.push({
      origin,
      domain: `site${index}.example`,
      declared_topics: [
        {
          slug: "design",
          label: "Design",
          community_eligible: true,
          evidence: [
            {
              class: "declared",
              source: "rss:category",
              community_eligible: true,
              page: `${origin}/p`,
            },
          ],
        },
      ],
      subject_signals: [],
    });
  }

  const { communities } = buildTopicCommunities(origins);
  assert.equal(communities.length, 1);
  assert.equal(communities[0].member_count, 1000);
  assert.equal(communities[0].sites.length, 1000);

  // Guard: topic pair builder must not materialize n×(n-1) edges.
  const pairs = topicConnectionObservations(
    origins,
    origins.map((item) => item.origin),
  );
  assert.equal(pairs.length, 0);
});
