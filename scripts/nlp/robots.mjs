/**
 * Goal: Parse robots.txt and decide whether a path is allowed for a crawler.
 * Empty or missing files allow. Named User-agent groups beat *. Longest
 * Allow/Disallow prefix wins; equal length prefers Allow.
 */

/**
 * @typedef {{ agents: string[], rules: Array<{ type: "allow" | "disallow", path: string }> }} RobotsGroup
 */

/**
 * Product token compared to User-agent lines (before / or space).
 * @param {string} userAgent
 * @returns {string}
 */
export function crawlerProductToken(userAgent) {
  const first = String(userAgent || "")
    .trim()
    .split(/[\s/]/)[0];
  return first ? first.toLowerCase() : "*";
}

/**
 * @param {string} body
 * @returns {RobotsGroup[]}
 */
export function parseRobotsTxt(body) {
  const groups = [];
  /** @type {(RobotsGroup & { startedRules: boolean }) | null} */
  let current = null;

  for (const raw of String(body || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();

    if (!line) {
      continue;
    }

    const colon = line.indexOf(":");

    if (colon < 0) {
      continue;
    }

    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      if (!current || current.startedRules) {
        current = { agents: [], rules: [], startedRules: false };
        groups.push(current);
      }

      current.agents.push((value || "*").toLowerCase());
      continue;
    }

    if (field !== "allow" && field !== "disallow") {
      continue;
    }

    if (!current) {
      current = { agents: ["*"], rules: [], startedRules: true };
      groups.push(current);
    }

    current.startedRules = true;
    current.rules.push({ type: field, path: value });
  }

  return groups.map((group) => ({
    agents: group.agents,
    rules: group.rules,
  }));
}

/**
 * Picks the most specific group for this crawler.
 * @param {RobotsGroup[]} groups
 * @param {string} userAgent
 * @returns {RobotsGroup | null}
 */
export function selectRobotsGroup(groups, userAgent) {
  const product = crawlerProductToken(userAgent);
  const named = groups.filter((group) =>
    group.agents.some((agent) => agent === product),
  );

  if (named.length > 0) {
    return named[0];
  }

  const star = groups.filter((group) => group.agents.includes("*"));
  return star[0] || null;
}

/**
 * True when robots.txt allows pathname for userAgent.
 * Missing/empty files allow. No matching group allows.
 * @param {string} body
 * @param {string} pathname
 * @param {string} userAgent
 * @returns {boolean}
 */
export function robotsAllowsPath(body, pathname, userAgent) {
  const groups = parseRobotsTxt(body);

  if (groups.length === 0) {
    return true;
  }

  const group = selectRobotsGroup(groups, userAgent);

  if (!group) {
    return true;
  }

  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  let bestLength = -1;
  let allowed = true;

  for (const rule of group.rules) {
    if (!rule.path) {
      continue;
    }

    if (!path.startsWith(rule.path)) {
      continue;
    }

    if (rule.path.length > bestLength) {
      bestLength = rule.path.length;
      allowed = rule.type === "allow";
      continue;
    }

    if (rule.path.length === bestLength && rule.type === "allow") {
      allowed = true;
    }
  }

  return allowed;
}
