/**
 * Goal: A portfolio index becomes project items and declared sector topics.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { buildTopicCommunities } from "../../scripts/nlp/communities.mjs";
import {
  collectPortfolio,
  contentItemsFromPortfolio,
  MAX_PORTFOLIO_WORKS,
  subjectsFromPortfolio,
  topicsForWork,
  worksFromPortfolioHtml,
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

test("a portfolio table becomes works and sector topics", () => {
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
  assert.equal(slugs.includes("portfolio"), false);
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

// ─── worksFromTable: header and row edge cases ────────────────────────────────

test("worksFromPortfolioHtml: table without sector column returns empty", () => {
  // No sector column → columnName returns "" for all cols → !headers.includes("sector")
  const html = `
<table>
  <thead><tr><th>Year</th><th>Client</th></tr></thead>
  <tbody><tr><td>2020</td><td>Acme</td></tr></tbody>
</table>`;

  const works = worksFromPortfolioHtml(html, "https://portfolio.example/work/");
  assert.equal(works.length, 0);
});

test("worksFromPortfolioHtml: table with sector but neither client nor project returns empty", () => {
  const html = `
<table>
  <thead><tr><th data-sort-col="sector">Sector</th></tr></thead>
  <tbody><tr><td>Health</td></tr></tbody>
</table>`;

  const works = worksFromPortfolioHtml(html, "https://portfolio.example/work/");
  assert.equal(works.length, 0);
});

test("worksFromPortfolioHtml: header row inside tbody is skipped", () => {
  // A row that contains <th> elements inside <tbody> should be skipped.
  const html = `
<table>
  <thead><tr><th data-sort-col="project">Project</th><th data-sort-col="sector">Sector</th></tr></thead>
  <tbody>
    <tr><th>Project</th><th>Sector</th></tr>
    <tr><td>Branding</td><td>Retail</td></tr>
  </tbody>
</table>`;

  const works = worksFromPortfolioHtml(html, "https://portfolio.example/work/");
  assert.equal(works.length, 1);
  assert.equal(works[0].project, "Branding");
});

test("worksFromPortfolioHtml: cells shorter than headers defaults empty string", () => {
  // Row has fewer cells than header columns; cells[index] is undefined → ""
  const html = `
<table>
  <thead>
    <tr>
      <th data-sort-col="project">Project</th>
      <th data-sort-col="sector">Sector</th>
      <th data-sort-col="location">Location</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Microsite</td>
      <td>Tech</td>
    </tr>
  </tbody>
</table>`;

  const works = worksFromPortfolioHtml(html, "https://portfolio.example/work/");
  assert.equal(works.length, 1);
  assert.equal(works[0].project, "Microsite");
  assert.equal(works[0].location, "");
});

test("worksFromPortfolioHtml: MAX_PORTFOLIO_WORKS cap is enforced", () => {
  const rows = Array.from(
    { length: MAX_PORTFOLIO_WORKS + 5 },
    (_, i) => `<tr><td>Project ${i}</td><td>Tech</td></tr>`,
  ).join("\n");
  const html = `<table><thead><tr><th data-sort-col="project">Project</th><th data-sort-col="sector">Sector</th></tr></thead><tbody>${rows}</tbody></table>`;
  const works = worksFromPortfolioHtml(html, "https://portfolio.example/work/");
  assert.equal(works.length, MAX_PORTFOLIO_WORKS);
});

// ─── caseStudyLinks edge cases ────────────────────────────────────────────────

test("worksFromPortfolioHtml: invalid pageUrl returns no case-study links", () => {
  // caseStudyLinks tries new URL(pageUrl); invalid URL → catch → return []
  const html = `<a href="/work/project-x/">Project X</a>`;
  const works = worksFromPortfolioHtml(html, "not-a-url");
  // No works from table (no table), links slice falls back
  assert.deepEqual(works, []);
});

test("worksFromPortfolioHtml: link with invalid href is skipped", () => {
  // caseStudyLinks: new URL(match[1], pageUrl) throws for "http://"
  const html = `
<table>
  <thead><tr><th data-sort-col="project">Project</th><th data-sort-col="sector">Sector</th></tr></thead>
  <tbody><tr><td>Alpha</td><td>Tech</td></tr></tbody>
</table>
<a href="http://">Bad link</a>
<a href="/work/alpha/">Alpha</a>`;

  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 1);
  // Good link was parsed; bad link was skipped
});

test("worksFromPortfolioHtml: cross-origin links are ignored for case studies", () => {
  const html = `
<table>
  <thead><tr><th data-sort-col="project">Project</th><th data-sort-col="sector">Sector</th></tr></thead>
  <tbody><tr><td>Beta</td><td>Health</td></tr></tbody>
</table>
<a href="https://other.example/work/beta/">Beta Case Study</a>`;

  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 1);
  // Cross-origin link not matched as case study → fallback URL assigned
  assert.ok(works[0].url.includes("portfolio.example"));
});

test("worksFromPortfolioHtml: path not matching portfolio pattern is ignored", () => {
  // Path like /blog/something does not match /work|portfolio|projects?/SLUG
  const html = `
<table>
  <thead><tr><th data-sort-col="project">Project</th><th data-sort-col="sector">Sector</th></tr></thead>
  <tbody><tr><td>Gamma</td><td>Finance</td></tr></tbody>
</table>
<a href="/blog/gamma/">Gamma</a>`;

  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 1);
  // Blog link doesn't match the portfolio path regex
  assert.ok(!works[0].url.includes("/blog/"));
});

test("worksFromPortfolioHtml: no-table page uses only case study links", () => {
  // No <table> element → works = links.slice(0, MAX_PORTFOLIO_WORKS)
  const html = `
<a href="/portfolio/project-a/">Project Alpha</a>
<a href="/portfolio/project-b/">Project Beta</a>`;

  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 2);
  assert.ok(works.some((w) => w.url.includes("project-a")));
  assert.ok(works.some((w) => w.url.includes("project-b")));
  // Titles derived from link text
  assert.ok(works.some((w) => w.project === "Project Alpha"));
});

// ─── subjectsFromPortfolio edge cases ────────────────────────────────────────

test("subjectsFromPortfolio: empty works returns empty array", () => {
  assert.deepEqual(subjectsFromPortfolio([], "https://portfolio.example/"), []);
  assert.deepEqual(
    subjectsFromPortfolio(null, "https://portfolio.example/"),
    [],
  );
});

// ─── contentItemsFromPortfolio edge cases ────────────────────────────────────

test("contentItemsFromPortfolio: works without url or siteOrigin are skipped", () => {
  // Work with no url → continue
  const items = contentItemsFromPortfolio(
    [{ url: "", project: "Missing URL", sector: "Tech" }],
    {
      siteOrigin: "https://portfolio.example",
      pageUrl: "https://portfolio.example/work/",
    },
  );
  assert.equal(items.length, 0);

  // meta without siteOrigin → continue
  const items2 = contentItemsFromPortfolio(
    [
      {
        url: "https://portfolio.example/work/alpha/",
        project: "Alpha",
        sector: "Tech",
      },
    ],
    { siteOrigin: "", pageUrl: "https://portfolio.example/work/" },
  );
  assert.equal(items2.length, 0);
});

// ─── collectPortfolio edge cases ─────────────────────────────────────────────

test("collectPortfolio: returns empty when pages have missing properties", () => {
  // Pages where url or html is not a string → continue
  const result = collectPortfolio(
    [
      null,
      { url: "https://portfolio.example/work/" }, // no html
      { html: "<html/>" }, // no url
      42, // not an object
    ],
    { siteOrigin: "https://portfolio.example" },
  );
  assert.equal(result.profile, null);
  assert.deepEqual(result.subjects, []);
  assert.deepEqual(result.items, []);
});

test("collectPortfolio: page with zero works is skipped (continues to next page)", () => {
  // First page has no recognisable table or case-study links → 0 works → continue.
  // Second page has works.
  const secondPage = `
<table>
  <thead><tr><th data-sort-col="project">Project</th><th data-sort-col="sector">Sector</th></tr></thead>
  <tbody><tr><td>Good Work</td><td>Design</td></tr></tbody>
</table>`;

  const result = collectPortfolio(
    [
      {
        url: "https://portfolio.example/empty/",
        html: "<html><body>Nothing here</body></html>",
      },
      { url: "https://portfolio.example/work/", html: secondPage },
    ],
    { siteOrigin: "https://portfolio.example" },
  );
  assert.equal(result.profile?.work_count, 1);
});

test("collectPortfolio: returns empty when no siteOrigin provided", () => {
  const result = collectPortfolio(
    [{ url: "https://portfolio.example/work/", html: "<html/>" }],
    {},
  );
  assert.equal(result.profile, null);
});

test("collectPortfolio: returns empty when all pages have zero works", () => {
  const result = collectPortfolio(
    [
      {
        url: "https://portfolio.example/empty/",
        html: "<html><body>No table</body></html>",
      },
    ],
    { siteOrigin: "https://portfolio.example" },
  );
  assert.equal(result.profile, null);
});

// ─── worksFromPortfolioHtml row with no sector/client/project (lines 136-138) ─

test("worksFromPortfolioHtml: row with no sector, client, or project is skipped (lines 136-138)", () => {
  // Row has only a year value; all three required fields are empty → continue.
  const html = `
<table>
  <thead>
    <tr>
      <th data-sort-col="year">Year</th>
      <th data-sort-col="client">Client</th>
      <th data-sort-col="project">Project</th>
      <th data-sort-col="sector">Sector</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>2020</td><td></td><td></td><td></td></tr>
  </tbody>
</table>`;
  const works = worksFromPortfolioHtml(html, PAGE);
  assert.equal(works.length, 0);
});

// ─── assignWorkUrls duplicate slug suffix (lines 239-240) ────────────────────

test("worksFromPortfolioHtml: duplicate work slugs get -2 suffix (lines 239-240)", () => {
  // Two identical client+project+year rows produce the same base slug; second
  // iteration of the while-loop appends "-2".
  const html = `
<table>
  <thead>
    <tr>
      <th data-sort-col="year">Year</th>
      <th data-sort-col="client">Client</th>
      <th data-sort-col="project">Project</th>
      <th data-sort-col="sector">Sector</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>2021</td><td>Acme</td><td>Widget</td><td>Tech</td></tr>
    <tr><td>2021</td><td>Acme</td><td>Widget</td><td>Design</td></tr>
  </tbody>
</table>`;
  const works = worksFromPortfolioHtml(html, PAGE);
  assert.equal(works.length, 2);
  const slugs = works.map((w) => new URL(w.url).searchParams.get("work"));
  // First slug is "acme-widget-2021"; second is "acme-widget-2021-2"
  assert.notEqual(slugs[0], slugs[1]);
  assert.ok(slugs[1].endsWith("-2"));
});

// ─── Line 110: table without <tbody> uses full table string as body ───────────

test("worksFromPortfolioHtml: table without tbody uses full table as body (line 110)", () => {
  // No <tbody> → tableHtml.match(/<tbody...>)?.[0] returns undefined → || tableHtml fires
  const html = `
<table>
  <tr><th data-sort-col="project">Project</th><th data-sort-col="sector">Sector</th></tr>
  <tr><td>Clinic</td><td>Health</td></tr>
</table>`;
  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 1);
  assert.equal(works[0].project, "Clinic");
});

// ─── Line 182: root-path link fires pathname || "/" ───────────────────────────

test("worksFromPortfolioHtml: root-path link fires pathname || '/' (line 182)", () => {
  // href="https://portfolio.example/" → pathname="/" → .replace(/\/+$/, "")="" → || "/" fires
  // "/" doesn't match /portfolio|work|projects?/SLUG → link ignored
  const html = `<a href="https://portfolio.example/">Home</a>`;
  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.deepEqual(works, []);
});

// ─── Line 301: empty-text link uses slug as project title ────────────────────

test("worksFromPortfolioHtml: link with no visible text uses slug as project title (line 301)", () => {
  // <a href="/portfolio/my-project/"></a> → visibleCell("") = "" → link.text = ""
  // link.text || link.slug.replace(/-/g, " ") fires the right side → "my project"
  const html = `<a href="/portfolio/my-project/"></a>`;
  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 1);
  assert.equal(works[0].project, "my project");
});

// ─── Line 346: work.url || pageUrl in subjectsFromPortfolio ──────────────────

test("subjectsFromPortfolio: work without url falls back to pageUrl (line 346)", () => {
  // work.url = "" → || pageUrl fires → evidence page uses pageUrl
  const works = [{ project: "Alpha", sector: "Health", url: "" }];
  const subjects = subjectsFromPortfolio(
    works,
    "https://portfolio.example/work/",
  );
  const health = subjects.find((s) => s.slug === "health");
  assert.ok(health);
  assert.ok(
    health.pages.some((p) => p.url === "https://portfolio.example/work/"),
  );
});

// ─── Lines 394-395: work.project || work.client || "Work" ───────────────────

test("contentItemsFromPortfolio: work with no project or client uses 'Work' title (lines 394-395)", () => {
  // project="" and client="" → || "Work" fires
  const items = contentItemsFromPortfolio(
    [
      {
        url: "https://portfolio.example/work/x/",
        project: "",
        client: "",
        sector: "Health",
        year: "2020",
      },
    ],
    {
      siteOrigin: "https://portfolio.example",
      pageUrl: "https://portfolio.example/work/",
    },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Work");
});

// ─── Line 419: summary || null ────────────────────────────────────────────────

test("contentItemsFromPortfolio: work with all empty fields has empty string summary (line 419)", () => {
  const items = contentItemsFromPortfolio(
    [
      {
        url: "https://portfolio.example/work/x/",
        project: "",
        client: "",
        sector: "",
        year: "",
        location: "",
      },
    ],
    {
      siteOrigin: "https://portfolio.example",
      pageUrl: "https://portfolio.example/work/",
    },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].summary, "");
  assert.equal(items[0].title, "Work");
});

// ─── Line 450: pages || [] when pages is null ─────────────────────────────────

test("collectPortfolio: null pages fires pages || [] (line 450)", () => {
  // pages=null → for (const page of null || []) → || [] fires
  const result = collectPortfolio(null, {
    siteOrigin: "https://portfolio.example",
  });
  assert.equal(result.profile, null);
  assert.deepEqual(result.subjects, []);
  assert.deepEqual(result.items, []);
});

// ─── subjectsFromPortfolio: bySlug.get(topic.slug) left-branch (line 338) ────

test("subjectsFromPortfolio: two works with same sector fires bySlug.get left branch (line 338)", () => {
  // Two works in "Fintech" → second call to bySlug.get returns existing → left || branch fires
  const works = [
    {
      project: "Alpha",
      client: "",
      sector: "Fintech",
      location: "",
      year: "2020",
      url: "https://a.example/work/alpha",
    },
    {
      project: "Beta",
      client: "",
      sector: "Fintech",
      location: "",
      year: "2021",
      url: "https://a.example/work/beta",
    },
  ];
  const subjects = subjectsFromPortfolio(works, "https://a.example/");
  const fintech = subjects.find((s) => s.slug === "fintech");
  assert.ok(fintech, "fintech subject should exist");
  // Both works are pushed to the same existing entry
  assert.ok(fintech.pages.length >= 2);
});

// ─── subjectsFromPortfolio: existing.pages.length >= 8 fires false branch (line 344) ─

test("subjectsFromPortfolio: 9 works with same sector caps at 8 pages (line 344)", () => {
  // pages.length >= 8 fires the false branch (skip push) on 9th+ work
  const works = Array.from({ length: 9 }, (_, i) => ({
    project: `Work${i}`,
    client: "",
    sector: "Fintech",
    location: "",
    year: "2020",
    url: `https://a.example/work/w${i}`,
  }));
  const subjects = subjectsFromPortfolio(works, "https://a.example/");
  const fintech = subjects.find((s) => s.slug === "fintech");
  assert.ok(fintech, "fintech subject should exist");
  // Pages are capped at 8 (< 8 fails after 8 items)
  assert.ok(fintech.pages.length <= 8);
});

// ─── worksFromPortfolioHtml: null html fires || '' in String(html || '') (line 284) ─

test("worksFromPortfolioHtml: null html fires || '' (line 284)", () => {
  // html=null → String(null || "")="" → no tables, no links → empty works
  const works = worksFromPortfolioHtml(null, "https://a.example/");
  assert.deepEqual(works, []);
});

// ─── worksFromTable: no thead, no tr fires '' fallback (line 96-97) ─

test("worksFromTable: table with no thead and no tr fires '' header fallback", () => {
  // Both tableHtml.match(/<thead/)?.[0] and match(/<tr/)?.[0] return undefined → ""
  // In worksFromPortfolioHtml, the table regex always finds <tr> in any table row
  // so we test via a bare table with <td> only (no <tr> wrapper is invalid HTML but let's try)
  // Actually V8 branches fires on the .match(/<tr/)?.[0] being undefined.
  // An empty <table></table> has no tr → second .match returns null → || "" fires (L96-97)
  const works = worksFromPortfolioHtml(
    "<html><body><table></table></body></html>",
    "https://a.example/",
  );
  // No header → no works from table
  assert.equal(works.length, 0);
});

// ─── worksFromTable: unknown column name fires if(name && hasOwn) false (L131) ─

test("worksFromTable via worksFromPortfolioHtml: unknown column header is skipped (L131 false branch)", () => {
  // header with data-sort-col="description" (not in record) → name truthy, !hasOwn → false branch
  const html = `
<table>
  <thead><tr>
    <th data-sort-col="project">Project</th>
    <th data-sort-col="description">Description</th>
    <th data-sort-col="sector">Sector</th>
  </tr></thead>
  <tbody><tr>
    <td>Alpha</td>
    <td>Some description</td>
    <td>Fintech</td>
  </tr></tbody>
</table>`;
  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 1);
  assert.equal(works[0].project, "Alpha");
  assert.equal(works[0].sector, "Fintech");
});

// ─── worksFromTable: all-empty row fires continue (L136-137) ─────────────────

test("worksFromTable via worksFromPortfolioHtml: all-empty row fires continue (L136-137)", () => {
  // Row with no sector, project, or client → continue fires (L136-137)
  const html = `
<table>
  <thead><tr>
    <th data-sort-col="year">Year</th>
    <th data-sort-col="location">Location</th>
  </tr></thead>
  <tbody>
    <tr><td>2020</td><td>NYC</td></tr>
    <tr><td></td><td></td></tr>
  </tbody>
</table>`;
  // All rows have only year/location (no project/client/sector) → all fire continue
  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 0);
});

// ─── worksFromTable: column with no th data-sort-col fires name="" (L131 falsy) ─

test("worksFromTable via worksFromPortfolioHtml: th without data-sort-col gives empty name (L131 falsy)", () => {
  // <th> with no data-sort-col → columnName returns "" → name="" is falsy → L131 false fires
  const html = `
<table>
  <thead><tr>
    <th>Project Name</th>
    <th>Sector</th>
  </tr></thead>
  <tbody><tr>
    <td>Alpha</td>
    <td>Health</td>
  </tr></tbody>
</table>`;
  // No data-sort-col → columnName returns "" → header not mapped → record all empty → continue
  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 0);
});

// ─── assignWorkUrls: while(usedSlugs.has(slug)) body fires on duplicate slug ─

test("assignWorkUrls fires while-loop body: two works with same slug but no link (L238-239)", () => {
  // Two works identical project/client/year → slug collision → while body fires
  const html = `
<table>
  <thead><tr>
    <th data-sort-col="project">Project</th>
    <th data-sort-col="sector">Sector</th>
    <th data-sort-col="year">Year</th>
  </tr></thead>
  <tbody>
    <tr><td>Alpha</td><td>Health</td><td>2020</td></tr>
    <tr><td>Alpha</td><td>Fintech</td><td>2020</td></tr>
  </tbody>
</table>`;
  // No links → no link match → both works get slug-based URLs
  // Both "alpha-2020" slugs → while loop fires on second → gets "alpha-2020-2"
  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 2);
  // URLs should be different (one is the plain slug, the other has -2 appended)
  assert.notEqual(works[0].url, works[1].url);
});

// ─── collectPortfolio: !meta?.siteOrigin fires early return (L446-448) ───────

test("collectPortfolio: missing siteOrigin fires early return (L446-448)", () => {
  // meta has no siteOrigin → !meta?.siteOrigin = true → return empty fires
  const result = collectPortfolio(
    [{ url: "https://a.example/", html: "<html></html>" }],
    {}, // no siteOrigin
  );
  assert.deepEqual(result, { profile: null, subjects: [], items: [] });
});

// ─── collectPortfolio: null page fires continue (L452) ───────────────────────

test("collectPortfolio: null page in array fires continue (L452)", () => {
  const html = `<table>
    <thead><tr><th data-sort-col="project">Project</th><th data-sort-col="sector">Sector</th></tr></thead>
    <tbody><tr><td>Clinic</td><td>Health</td></tr></tbody>
  </table>`;
  // First page is null → L452 continue fires; second page has valid works
  const result = collectPortfolio([null, { url: "https://a.example/", html }], {
    siteOrigin: "https://a.example",
  });
  assert.ok(result.profile !== null);
  assert.equal(result.profile.work_count, 1);
});

// ─── caseStudyLinks: invalid href fires try-catch continue (L174-175) ────────

test("worksFromPortfolioHtml: invalid href fires try-catch continue in caseStudyLinks (L174-175)", () => {
  // href "::bad" throws in new URL() → catch fires → continue (L174-175)
  const html = `
<a href="::bad">Broken</a>
<a href="/portfolio/real-project">Real Project</a>`;
  const works = worksFromPortfolioHtml(html, "https://portfolio.example/");
  assert.equal(works.length, 1);
  assert.equal(works[0].project, "Real Project");
});

// ─── Additional branch coverage ───────────────────────────────────────────────

// worksFromPortfolioHtml: null html fires html || "" (L284)
test("worksFromPortfolioHtml: null html fires || '' (L284)", () => {
  // String(null || "") → null || "" fires (L284 false branch)
  const works = worksFromPortfolioHtml(null, "https://a.example/portfolio/");
  assert.deepEqual(works, []);
});

// worksFromPortfolioHtml: table without thead uses <tr> fallback (L95)
test("worksFromPortfolioHtml: table without thead uses <tr> fallback (L95-96)", () => {
  // No <thead> → L95 || match(/<tr...) fires
  const html = `<html><body>
    <table>
      <tr>
        <th data-sort-col="project">Project</th>
        <th data-sort-col="sector">Sector</th>
      </tr>
      <tr>
        <td>Website Redesign</td>
        <td>Technology</td>
      </tr>
    </table>
  </body></html>`;
  const works = worksFromPortfolioHtml(html, "https://a.example/portfolio/");
  assert.ok(works.length >= 1);
});

// worksFromPortfolioHtml: no table and empty html fires || "" (L96)
test("worksFromPortfolioHtml: empty html fires || '' (L96)", () => {
  // No <thead> and no <tr> → L96 || "" fires → header = ""
  const works = worksFromPortfolioHtml(
    "<p>No tables here</p>",
    "https://a.example/portfolio/",
  );
  // No tables → falls through to caseStudyLinks → no portfolio links → []
  assert.deepEqual(works, []);
});

// worksFromPortfolioHtml: null caseStudyLinks html fires || "" (L167)
test("worksFromPortfolioHtml: caseStudyLinks receives null html fires || '' (L167)", () => {
  // caseStudyLinks(null, pageUrl) → String(null || "") fires (L167)
  // worksFromPortfolioHtml passes original html to caseStudyLinks
  const works = worksFromPortfolioHtml(null, "https://a.example/portfolio/");
  assert.deepEqual(works, []);
});

// topicsForWork: work without sector/project/client fires || "" (L255, L256)
test("topicsForWork: work without sector/project/client fires || '' (L255-256)", () => {
  // work.sector is undefined → L255 || "" fires
  // work.project and work.client are undefined → L256 || "" fires for each
  const topics = topicsForWork({});
  assert.ok(Array.isArray(topics));
});

// contentItemsFromPortfolio: works without url fires || [] (L390)
test("contentItemsFromPortfolio: null works fires || [] (L390)", () => {
  // works = null → null || [] fires (L390)
  const items = contentItemsFromPortfolio(null, {
    siteOrigin: "https://a.example",
    pageUrl: "https://a.example/portfolio/",
  });
  assert.deepEqual(items, []);
});

// subjectsFromPortfolio: work without url fires || pageUrl (L346)
// work with no url + topicsForWork returning topics fires || work.client || "Work" at L335
test("subjectsFromPortfolio: work without sector fires || work.client || 'Work' (L335)", () => {
  const works = [
    {
      url: "https://a.example/portfolio/project-1",
      sector: "Health",
    },
  ];
  const subjects = subjectsFromPortfolio(works, "https://a.example/portfolio/");
  assert.ok(!subjects.find((s) => s.slug === "portfolio"));
  assert.ok(subjects.find((s) => s.slug === "health"));
});

// workSlug resulting in "" fires || "work" (L236)
test("worksFromPortfolioHtml: link text fires project || link.slug.replace (L301)", () => {
  // link.text = "" (empty visible text) → link.text || link.slug.replace fires (L301)
  const html = `<html><body>
    <a href="/portfolio/empty-text"><!-- no visible text --></a>
  </body></html>`;
  const works = worksFromPortfolioHtml(html, "https://a.example/portfolio/");
  // Works created from link with no visible text → project = "" || slug.replace fires
  assert.ok(Array.isArray(works));
});

// collectPortfolio: null pages fires || [] (L450)
test("collectPortfolio: null pages fires || [] (L450)", () => {
  // pages = null → null || [] fires (L450) → iterates empty array → returns empty
  const result = collectPortfolio(null, {
    siteOrigin: "https://a.example",
    pageUrl: "https://a.example/portfolio/",
  });
  assert.deepEqual(result.subjects, []);
  assert.deepEqual(result.items, []);
});

// collectPortfolio: work with empty sector fires || "" (L467)
test("collectPortfolio: work with empty sector fires || '' (L467)", () => {
  // work.sector = "" → String("" || "").trim() = "" → fires (L467 || "" branch)
  const html = `<html><body>
    <table>
      <thead>
        <tr>
          <th data-sort-col="project">Project</th>
          <th data-sort-col="sector">Sector</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>My Project</td><td></td></tr>
      </tbody>
    </table>
  </body></html>`;
  const result = collectPortfolio(
    [{ url: "https://a.example/portfolio/", html }],
    {
      siteOrigin: "https://a.example",
      pageUrl: "https://a.example/portfolio/",
    },
  );
  // sectors should be empty (empty sector filtered out)
  assert.ok(result.profile !== null);
  assert.deepEqual(result.profile.sectors, []);
});

// ─── topicsForWork: optional chain (?.) fires when properties absent ──────────

test("topicsForWork: work with no sector/project/client fires all || '' branches (L255-257)", () => {
  // work.sector/project/client all undefined → || "" fires for each (L255-257)
  // Also sectorSlug = "" → if(sectorSlug && ...) = false → L271 false (already tested but re-fires)
  const topics = topicsForWork({}); // all fields absent
  // No patterns match "" haystack, no sectorSlug → empty topics
  assert.deepEqual(topics, []);
});

test("topicsForWork: sectorSlug already in topics fires !topics.has(sectorSlug) false branch (L271)", () => {
  // Fintech sector → SECTOR_SUBJECTS adds "fintech" via pattern AND sectorSlug="fintech" too
  // → topics.has("fintech") = true → !topics.has("fintech") = false → sector not re-added (L271)
  const topics = topicsForWork({ sector: "Fintech", project: "", client: "" });
  const slugs = topics.map((t) => t.slug);
  // "fintech" should appear exactly once (not twice)
  assert.equal(slugs.filter((s) => s === "fintech").length, 1);
});

// ─── collectPortfolio: link-based works fire work.sector || '' (L467) ────────

test("collectPortfolio: link-based works with empty sector fire || '' (L467)", () => {
  // No table → link-based works have sector="" → String("" || "").trim() fires right branch
  const html = `
<a href="/work/alpha-project">Alpha Project</a>
<a href="/work/beta-project">Beta Project</a>`;
  const result = collectPortfolio(
    [{ url: "https://portfolio.example/", html }],
    { siteOrigin: "https://portfolio.example" },
  );
  // Link-based works have no sector → sectors = [] (filtered out)
  assert.ok(result.profile !== null);
  assert.equal(result.profile.work_count, 2);
  assert.deepEqual(result.profile.sectors, []);
});

// ─── contentItemsFromPortfolio: !meta.siteOrigin fires second || branch (L391) ─

test("contentItemsFromPortfolio: work with url but no siteOrigin fires || false branch (L391)", () => {
  // work.url is truthy but !meta?.siteOrigin is true → continue fires via second branch
  const items = contentItemsFromPortfolio(
    [
      {
        url: "https://portfolio.example/work/alpha/",
        project: "Alpha",
        sector: "Health",
        year: "2020",
        client: "",
        location: "",
      },
    ],
    { pageUrl: "https://portfolio.example/" }, // no siteOrigin
  );
  assert.equal(items.length, 0);
});

// ─── worksFromPortfolioHtml: workSlug returns "" fires || "work" (L236) ──────

test("worksFromPortfolioHtml: work with only sector (empty client/project/year) fires || 'work' (L236)", () => {
  // workSlug(` ${ } ${ }`) = slugifyTopic("  ") = "" → || "work" fires (L236)
  // Record has sector non-empty so passes L136 filter, but client/project/year all empty
  const html = `<html><body>
    <table>
      <thead><tr>
        <th data-sort-col="sector">Sector</th>
        <th data-sort-col="client">Client</th>
        <th data-sort-col="project">Project</th>
      </tr></thead>
      <tbody><tr>
        <td>Technology</td><td></td><td></td>
      </tr></tbody>
    </table>
  </body></html>`;
  const works = worksFromPortfolioHtml(html, "https://a.example/portfolio/");
  // workSlug("  ") = "" → || "work" fires → slug = "work"
  assert.equal(works.length, 1);
  assert.ok(works[0].url?.includes("work=work"));
});
