/**
 * Goal: A portfolio index becomes project items and declared sector topics.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { buildTopicCommunities } from "../../scripts/nlp/communities.mjs";
import {
  collectPortfolio,
  topicsForWork,
} from "../../scripts/nlp/portfolio.mjs";
import { splitDeclaredAndSignals } from "../../scripts/nlp/subjects.mjs";

const PAGE = "https://portfolio.example/work/";

const HTML = `
<table>
  <thead>
    <tr>
      <th data-sort-col="year">Year</th>
      <th data-sort-col="client">Client</th>
      <th data-sort-col="project">Project</th>
      <th data-sort-col="sector">Sector</th>
      <th data-sort-col="location">Location</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>2022</td>
      <td><span class="block text-white">Banked</span><span class="md:hidden">Pay by Bank</span></td>
      <td>Pay by Bank</td>
      <td>Fintech</td>
      <td>USA</td>
    </tr>
    <tr>
      <td>2023</td>
      <td><span class="block text-white">Legatum Institute</span></td>
      <td>United States Prosperity Index</td>
      <td>Government &amp; Policy</td>
      <td>UK</td>
    </tr>
  </tbody>
</table>
<a href="/work/banked-pay-by-bank/">Pay by Bank</a>
`;

test("sector language becomes subjects without turning the client into a topic", () => {
  const topics = topicsForWork({
    client: "Banked",
    project: "Pay by Bank",
    sector: "Fintech",
  });
  const slugs = topics.map((topic) => topic.slug).sort();

  assert.deepEqual(slugs, ["banking", "fintech"]);
  assert.equal(slugs.includes("banked"), false);

  const finance = topicsForWork({
    client: "Banked",
    project: "Merchants",
    sector: "Finance",
  }).map((topic) => topic.slug);

  assert.ok(finance.includes("banking"));
  assert.ok(finance.includes("finance"));
  assert.equal(finance.includes("banked"), false);
});

test("a portfolio table becomes works, a portfolio fact, and shared topics", () => {
  const collected = collectPortfolio([{ url: PAGE, html: HTML }], {
    siteOrigin: "https://portfolio.example",
    observedAt: "2026-10-03T00:00:00.000Z",
  });

  assert.equal(collected.profile.work_count, 2);
  assert.equal(collected.profile.url, PAGE);
  assert.ok(collected.profile.sectors.includes("Fintech"));
  assert.ok(collected.profile.sectors.includes("Government & Policy"));

  const bank = collected.items.find((item) => item.title === "Pay by Bank");
  assert.equal(bank.content_type, "project");
  assert.equal(bank.url, "https://portfolio.example/work/banked-pay-by-bank/");
  assert.equal(
    bank.declared_topics.some((topic) => topic.slug === "banking"),
    true,
  );
  assert.equal(bank.summary.includes("Banked"), true);

  const slugs = collected.subjects.map((subject) => subject.slug).sort();
  assert.ok(slugs.includes("portfolio"));
  assert.ok(slugs.includes("government"));
  assert.ok(slugs.includes("banking"));
  assert.equal(slugs.includes("pr"), false);

  const communications = topicsForWork({
    sector: "Communi\u00ADcations & PR",
    project: "Campaign",
    client: "Studio",
  });
  assert.equal(
    communications.some((topic) => topic.slug === "communications-pr"),
    true,
  );
  assert.equal(
    communications.some((topic) => topic.slug === "communi-cations"),
    false,
  );
  assert.equal(
    collected.subjects.every(
      (subject) => subject.evidence_class === "declared",
    ),
    true,
  );

  const split = splitDeclaredAndSignals(collected.subjects);
  const { communities } = buildTopicCommunities([
    {
      origin: "https://portfolio.example",
      domain: "portfolio.example",
      title: "Portfolio",
      declared_topics: split.declared_topics,
      subject_signals: [],
    },
    {
      origin: "https://notes.example",
      domain: "notes.example",
      title: "Notes",
      declared_topics: [
        {
          slug: "government",
          label: "government",
          evidence_class: "declared",
          community_eligible: true,
          evidence: [{ class: "declared", community_eligible: true }],
        },
      ],
      subject_signals: [],
    },
  ]);
  const government = communities.find((topic) => topic.slug === "government");

  assert.ok(government);
  assert.equal(government.sites.length, 2);
  assert.ok(
    government.sites.some(
      (site) => site.origin === "https://portfolio.example",
    ),
  );
});
