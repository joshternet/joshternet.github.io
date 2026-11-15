/**
 * Goal & Constraints:
 * Keep nlp:validate promoted-count gates aligned with site-family projection.
 * Synthetic origins only — no live member locks.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  promotedCountInvariantErrors,
  promotedParticipantCount,
} from "../../scripts/nlp/promoted-counts.mjs";

test("promotedParticipantCount counts primaries only", () => {
  assert.equal(promotedParticipantCount(null), 0);
  assert.equal(
    promotedParticipantCount([
      { origin: "https://primary.example", promoted: true },
      { origin: "https://secondary.example", promoted: false },
      { origin: "https://solo.example" },
    ]),
    2,
  );
});

test("promotedCountInvariantErrors accepts matching explore and site_views", () => {
  const network = [
    {
      origin: "https://primary.example",
      promoted: true,
      destinations: [{ origin: "https://secondary.example" }],
    },
    { origin: "https://secondary.example", promoted: false },
    { origin: "https://solo.example", promoted: true },
  ];
  const explore = {
    participant_count: 2,
    neighborhood: {
      slug: "design",
      label: "Design",
      member_count: 2,
    },
  };
  const siteViews = {
    sites: [
      { origin: "https://primary.example" },
      { origin: "https://solo.example" },
    ],
  };
  const topics = {
    communities: [
      {
        slug: "design",
        sites: [
          { origin: "https://secondary.example" },
          { origin: "https://solo.example" },
        ],
      },
    ],
  };

  assert.deepEqual(
    promotedCountInvariantErrors({ network, explore, siteViews, topics }),
    [],
  );
});

test("promotedCountInvariantErrors rejects stale NLP member tallies", () => {
  const network = [
    {
      origin: "https://primary.example",
      promoted: true,
      destinations: [{ origin: "https://secondary.example" }],
    },
    { origin: "https://secondary.example", promoted: false },
  ];

  assert.match(
    promotedCountInvariantErrors({
      network,
      explore: { participant_count: 2 },
    })[0],
    /participant_count/,
  );

  assert.match(
    promotedCountInvariantErrors({
      network,
      explore: { participant_count: 1 },
      siteViews: {
        sites: [
          { origin: "https://primary.example" },
          { origin: "https://secondary.example" },
        ],
      },
    })[0],
    /site_views\.sites\.length/,
  );

  assert.match(
    promotedCountInvariantErrors({
      network,
      explore: {
        participant_count: 1,
        neighborhood: {
          slug: "design",
          member_count: 2,
        },
      },
      topics: {
        communities: [
          {
            slug: "design",
            sites: [
              { origin: "https://primary.example" },
              { origin: "https://secondary.example" },
            ],
          },
        ],
      },
    })[0],
    /neighborhood\.member_count/,
  );
});

test("promotedCountInvariantErrors requires explore object", () => {
  assert.match(
    promotedCountInvariantErrors({
      network: [],
      explore: null,
    })[0],
    /explore\.json/,
  );
  assert.match(
    promotedCountInvariantErrors({
      network: null,
      explore: [],
    })[0],
    /explore\.json/,
  );
});

test("promotedCountInvariantErrors covers site_views and neighborhood edge shapes", () => {
  const network = [{ origin: "https://solo.example", promoted: true }];

  assert.match(
    promotedCountInvariantErrors({
      network,
      explore: { participant_count: 1 },
      siteViews: { sites: "nope" },
    })[0],
    /site_views\.sites must be an array/,
  );

  // Array siteViews is ignored (not an object document)
  assert.deepEqual(
    promotedCountInvariantErrors({
      network,
      explore: { participant_count: 1 },
      siteViews: [],
    }),
    [],
  );

  assert.deepEqual(
    promotedCountInvariantErrors({
      network,
      explore: {
        participant_count: 1,
        neighborhood: ["not-an-object"],
      },
      topics: [],
    }),
    [],
  );

  assert.match(
    promotedCountInvariantErrors({
      network,
      explore: {
        participant_count: 1,
        neighborhood: { slug: 12, member_count: 1 },
      },
      topics: { communities: "nope" },
    })[0],
    /neighborhood\.member_count/,
  );

  assert.deepEqual(
    promotedCountInvariantErrors({
      network,
      explore: {
        participant_count: 1,
        neighborhood: { slug: "design", member_count: 0 },
      },
      topics: {
        communities: [null, "skip", { slug: "other" }, { slug: "design" }],
      },
    }),
    [],
  );

  assert.deepEqual(
    promotedCountInvariantErrors({
      network,
      explore: {
        participant_count: 1,
        neighborhood: { slug: "design", member_count: 0 },
      },
      // topics omitted → empty communities → zero members
    }),
    [],
  );

  assert.match(
    promotedCountInvariantErrors({
      network: "not-an-array",
      explore: { participant_count: 0 },
      siteViews: {},
    })[0],
    /site_views\.sites must be an array/,
  );
});
