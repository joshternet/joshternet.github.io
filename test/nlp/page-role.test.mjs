/**
 * Goal: 100% line/branch/function coverage for scripts/nlp/page-role.mjs.
 * All tests are offline—no network, no live data files as oracles.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  allowsCommunityTopics,
  allowsHeuristicTopics,
  classifyPageRole,
  topicContributionForRole,
} from "../../scripts/nlp/page-role.mjs";

// ─── classifyPageRole ────────────────────────────────────────────────────────

test("classifyPageRole: derived hint → generated", () => {
  assert.equal(
    classifyPageRole("https://a.example/", { derived: true }),
    "generated",
  );
});

test("classifyPageRole: HTTP 4xx status → error", () => {
  assert.equal(
    classifyPageRole("https://a.example/missing", { status: 404 }),
    "error",
  );
  assert.equal(
    classifyPageRole("https://a.example/forbidden", { status: 403 }),
    "error",
  );
});

test("classifyPageRole: HTTP 2xx status is not an error", () => {
  assert.notEqual(
    classifyPageRole("https://a.example/", { status: 200 }),
    "error",
  );
});

test("classifyPageRole: title containing 404 → error", () => {
  assert.equal(
    classifyPageRole("https://a.example/missing", { title: "404: Not Found" }),
    "error",
  );
});

test("classifyPageRole: title containing 'not found' → error", () => {
  assert.equal(
    classifyPageRole("https://a.example/x", { title: "Page not found" }),
    "error",
  );
  assert.equal(
    classifyPageRole("https://a.example/x", { title: "Not found" }),
    "error",
  );
});

test("classifyPageRole: invalid URL → unknown", () => {
  // new URL() throws for these → 'unknown' branch
  assert.equal(classifyPageRole("not-a-url"), "unknown");
  assert.equal(classifyPageRole(":::bad:::"), "unknown");
});

test("classifyPageRole: legal paths", () => {
  assert.equal(classifyPageRole("https://a.example/privacy"), "legal");
  assert.equal(classifyPageRole("https://a.example/terms-of-service"), "legal");
  assert.equal(classifyPageRole("https://a.example/license"), "legal");
  assert.equal(
    classifyPageRole("https://a.example/THIRD_PARTY_LICENSES.html"),
    "legal",
  );
  assert.equal(classifyPageRole("https://a.example/cookies"), "legal");
});

test("classifyPageRole: legal by title", () => {
  assert.equal(
    classifyPageRole("https://a.example/p", { title: "Privacy Policy" }),
    "legal",
  );
  assert.equal(
    classifyPageRole("https://a.example/p", { title: "Terms of service" }),
    "legal",
  );
});

test("classifyPageRole: tag-index paths", () => {
  assert.equal(classifyPageRole("https://a.example/tags/"), "tag-index");
  assert.equal(classifyPageRole("https://a.example/categories"), "tag-index");
  assert.equal(classifyPageRole("https://a.example/topic/ai"), "tag-index");
  assert.equal(classifyPageRole("https://a.example/topics/web"), "tag-index");
});

test("classifyPageRole: archive paths", () => {
  assert.equal(classifyPageRole("https://a.example/archive"), "archive");
  assert.equal(classifyPageRole("https://a.example/archives/"), "archive");
  assert.equal(classifyPageRole("https://a.example/blog/"), "archive");
  assert.equal(classifyPageRole("https://a.example/posts/"), "archive");
  assert.equal(classifyPageRole("https://a.example/index"), "archive");
});

test("classifyPageRole: about paths", () => {
  assert.equal(classifyPageRole("https://a.example/about"), "about");
  assert.equal(classifyPageRole("https://a.example/bio"), "about");
  assert.equal(classifyPageRole("https://a.example/profile"), "about");
});

test("classifyPageRole: project paths (portfolio child)", () => {
  assert.equal(
    classifyPageRole("https://a.example/work/my-project"),
    "project",
  );
  assert.equal(
    classifyPageRole("https://a.example/projects/website-redesign"),
    "project",
  );
  assert.equal(
    classifyPageRole("https://a.example/portfolio/case-study"),
    "project",
  );
});

test("classifyPageRole: portfolio index paths", () => {
  assert.equal(classifyPageRole("https://a.example/work"), "portfolio");
  assert.equal(classifyPageRole("https://a.example/projects"), "portfolio");
  assert.equal(classifyPageRole("https://a.example/portfolio"), "portfolio");
});

test("classifyPageRole: documentation paths", () => {
  assert.equal(classifyPageRole("https://a.example/docs"), "documentation");
  assert.equal(
    classifyPageRole("https://a.example/documentation/api"),
    "documentation",
  );
  assert.equal(
    classifyPageRole("https://a.example/guide/start"),
    "documentation",
  );
  assert.equal(
    classifyPageRole("https://a.example/handbook/onboarding"),
    "documentation",
  );
});

test("classifyPageRole: utility paths", () => {
  assert.equal(classifyPageRole("https://a.example/search"), "utility");
  assert.equal(classifyPageRole("https://a.example/login"), "utility");
  assert.equal(classifyPageRole("https://a.example/feed"), "utility");
  assert.equal(classifyPageRole("https://a.example/rss"), "utility");
  assert.equal(classifyPageRole("https://a.example/atom"), "utility");
});

test("classifyPageRole: home path (trailing-slash root)", () => {
  // Only the bare root "/" reliably returns 'home';
  // /index.html and /index.htm are caught first by the archive regex (\bindex\b matches before .)
  assert.equal(classifyPageRole("https://a.example/"), "home");
});

test("classifyPageRole: schemaTypes BlogPosting → article", () => {
  assert.equal(
    classifyPageRole("https://a.example/post/hello", {
      schemaTypes: ["BlogPosting"],
    }),
    "article",
  );
  assert.equal(
    classifyPageRole("https://a.example/2026/01/15/entry", {
      schemaTypes: ["NewsArticle"],
    }),
    "article",
  );
});

test("classifyPageRole: schemaTypes AboutPage → about", () => {
  assert.equal(
    classifyPageRole("https://a.example/me", { schemaTypes: ["AboutPage"] }),
    "about",
  );
});

test("classifyPageRole: blog/posts path without schema → article", () => {
  assert.equal(
    classifyPageRole("https://a.example/posts/my-post-slug"),
    "article",
  );
  assert.equal(
    classifyPageRole("https://a.example/blog/hello-world"),
    "article",
  );
  assert.equal(classifyPageRole("https://a.example/notes/2026-01"), "article");
  assert.equal(classifyPageRole("https://a.example/essays/on-tech"), "article");
});

test("classifyPageRole: unrecognised path → unknown", () => {
  assert.equal(classifyPageRole("https://a.example/mystery/page"), "unknown");
  assert.equal(classifyPageRole("https://a.example/some-page"), "unknown");
});

test("classifyPageRole: title only (no status, no derived) → reads URL", () => {
  // Passes an empty title — should still classify by URL
  assert.equal(
    classifyPageRole("https://a.example/about", { title: "" }),
    "about",
  );
});

test("classifyPageRole: schemaTypes must be an array", () => {
  // Non-array schemaTypes is treated as empty
  assert.equal(
    classifyPageRole("https://a.example/mystery", {
      schemaTypes: "BlogPosting",
    }),
    "unknown",
  );
});

// ─── topicContributionForRole ────────────────────────────────────────────────

test("topicContributionForRole: full roles", () => {
  assert.equal(topicContributionForRole("article"), "full");
  assert.equal(topicContributionForRole("note"), "full");
  assert.equal(topicContributionForRole("project"), "full");
});

test("topicContributionForRole: profile roles", () => {
  assert.equal(topicContributionForRole("home"), "profile");
  assert.equal(topicContributionForRole("about"), "profile");
  assert.equal(topicContributionForRole("portfolio"), "profile");
  assert.equal(topicContributionForRole("documentation"), "profile");
});

test("topicContributionForRole: limited roles", () => {
  assert.equal(topicContributionForRole("index"), "limited");
  assert.equal(topicContributionForRole("archive"), "limited");
  assert.equal(topicContributionForRole("tag-index"), "limited");
});

test("topicContributionForRole: none roles", () => {
  assert.equal(topicContributionForRole("utility"), "none");
  assert.equal(topicContributionForRole("legal"), "none");
  assert.equal(topicContributionForRole("error"), "none");
  assert.equal(topicContributionForRole("generated"), "none");
});

test("topicContributionForRole: unknown role → limited (default)", () => {
  // @ts-expect-error intentionally invalid role
  assert.equal(topicContributionForRole("unknown"), "limited");
  // @ts-expect-error intentionally invalid role
  assert.equal(topicContributionForRole("totally-made-up"), "limited");
});

// ─── allowsHeuristicTopics ───────────────────────────────────────────────────

test("allowsHeuristicTopics: full and profile roles allow heuristics", () => {
  assert.equal(allowsHeuristicTopics("article"), true);
  assert.equal(allowsHeuristicTopics("note"), true);
  assert.equal(allowsHeuristicTopics("project"), true);
  assert.equal(allowsHeuristicTopics("home"), true);
  assert.equal(allowsHeuristicTopics("about"), true);
  assert.equal(allowsHeuristicTopics("portfolio"), true);
  assert.equal(allowsHeuristicTopics("documentation"), true);
});

test("allowsHeuristicTopics: limited and none roles do not allow heuristics", () => {
  assert.equal(allowsHeuristicTopics("archive"), false);
  assert.equal(allowsHeuristicTopics("tag-index"), false);
  assert.equal(allowsHeuristicTopics("utility"), false);
  assert.equal(allowsHeuristicTopics("legal"), false);
  assert.equal(allowsHeuristicTopics("error"), false);
  assert.equal(allowsHeuristicTopics("generated"), false);
});

test("allowsHeuristicTopics: noindex option blocks any role", () => {
  assert.equal(allowsHeuristicTopics("article", { noindex: true }), false);
  assert.equal(allowsHeuristicTopics("home", { noindex: true }), false);
  assert.equal(allowsHeuristicTopics("about", { noindex: true }), false);
});

test("allowsHeuristicTopics: noindex false is same as omitted", () => {
  assert.equal(
    allowsHeuristicTopics("article", { noindex: false }),
    allowsHeuristicTopics("article"),
  );
});

// ─── allowsCommunityTopics ───────────────────────────────────────────────────

test("allowsCommunityTopics: all non-none roles allow community topics", () => {
  assert.equal(allowsCommunityTopics("article"), true);
  assert.equal(allowsCommunityTopics("home"), true);
  assert.equal(allowsCommunityTopics("archive"), true);
  assert.equal(allowsCommunityTopics("tag-index"), true);
  assert.equal(allowsCommunityTopics("documentation"), true);
});

test("allowsCommunityTopics: none roles disallow community topics", () => {
  assert.equal(allowsCommunityTopics("utility"), false);
  assert.equal(allowsCommunityTopics("legal"), false);
  assert.equal(allowsCommunityTopics("error"), false);
  assert.equal(allowsCommunityTopics("generated"), false);
});

test("allowsCommunityTopics: noindex option blocks any role", () => {
  assert.equal(allowsCommunityTopics("article", { noindex: true }), false);
  assert.equal(allowsCommunityTopics("archive", { noindex: true }), false);
});

test("allowsCommunityTopics: noindex false is same as omitted", () => {
  assert.equal(
    allowsCommunityTopics("article", { noindex: false }),
    allowsCommunityTopics("article"),
  );
});
