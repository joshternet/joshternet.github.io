/**
 * Goal: 100% coverage for scripts/nlp/robots.mjs (offline).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { USER_AGENT } from "../../scripts/nlp/lib.mjs";
import {
  crawlerProductToken,
  parseRobotsTxt,
  robotsAllowsPath,
  selectRobotsGroup,
} from "../../scripts/nlp/robots.mjs";

test("crawlerProductToken: empty input is *", () => {
  assert.equal(crawlerProductToken(""), "*");
  assert.equal(crawlerProductToken("   "), "*");
  assert.equal(crawlerProductToken(), "*");
});

test("crawlerProductToken: strips version and comment", () => {
  assert.equal(crawlerProductToken(USER_AGENT), "joshternetnlp");
});

test("parseRobotsTxt: empty and comment-only yield no groups", () => {
  assert.deepEqual(parseRobotsTxt(""), []);
  assert.deepEqual(parseRobotsTxt("# just a comment\n\n"), []);
  assert.deepEqual(parseRobotsTxt("not-a-field\nSitemap: /sitemap.xml"), []);
});

test("parseRobotsTxt: rules before User-agent attach to *", () => {
  const groups = parseRobotsTxt("Disallow: /hidden");
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].agents, ["*"]);
  assert.equal(groups[0].rules[0].type, "disallow");
});

test("parseRobotsTxt: empty User-agent becomes * and consecutive agents share a group", () => {
  const groups = parseRobotsTxt(`User-agent:
User-agent: Googlebot
Disallow: /nogo
`);
  assert.equal(groups.length, 1);
  assert.ok(groups[0].agents.includes("*"));
  assert.ok(groups[0].agents.includes("googlebot"));
});

test("parseRobotsTxt: User-agent after rules starts a new group", () => {
  const groups = parseRobotsTxt(`User-agent: *
Disallow: /secret
User-agent: JoshternetNLP
Allow: /
`);
  assert.equal(groups.length, 2);
  assert.equal(groups[1].agents[0], "joshternetnlp");
});

test("selectRobotsGroup: named group beats *", () => {
  const groups = parseRobotsTxt(`User-agent: *
Disallow: /
User-agent: JoshternetNLP
Allow: /
`);
  const named = selectRobotsGroup(groups, USER_AGENT);
  assert.equal(named.agents[0], "joshternetnlp");
  const star = selectRobotsGroup(groups, "OtherBot/1.0");
  assert.ok(star.agents.includes("*"));
});

test("selectRobotsGroup: unmatched agent with no * returns null", () => {
  const groups = parseRobotsTxt(`User-agent: Googlebot
Disallow: /
`);
  assert.equal(selectRobotsGroup(groups, USER_AGENT), null);
  assert.equal(selectRobotsGroup([], USER_AGENT), null);
});

test("robotsAllowsPath: missing file and unmatched group allow", () => {
  assert.equal(robotsAllowsPath("", "/", USER_AGENT), true);
  assert.equal(
    robotsAllowsPath("User-agent: Googlebot\nDisallow: /\n", "/", USER_AGENT),
    true,
  );
});

test("robotsAllowsPath: Disallow / blocks the homepage", () => {
  assert.equal(
    robotsAllowsPath("User-agent: *\nDisallow: /\n", "/", USER_AGENT),
    false,
  );
});

test("robotsAllowsPath: empty Disallow is ignored; longest Allow wins", () => {
  const body = `User-agent: *
Disallow:
Disallow: /
Allow: /feed
`;
  assert.equal(robotsAllowsPath(body, "/feed.xml", USER_AGENT), true);
  assert.equal(robotsAllowsPath(body, "/blog", USER_AGENT), false);
});

test("robotsAllowsPath: equal-length Allow beats Disallow; bare path gets a slash", () => {
  const body = `User-agent: *
Disallow: /foo
Allow: /foo
Disallow: /zz
`;
  assert.equal(robotsAllowsPath(body, "foo", USER_AGENT), true);
  assert.equal(robotsAllowsPath(body, "/zz", USER_AGENT), false);
});
