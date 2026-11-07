/**
 * Goal & Constraints:
 * Append up to five new uses.tech personal sites to the local dev cache.
 * Writes an intake list so network/nlp only crawl those new origins this run.
 * Does not run under CI. Does not delete cached bodies. Does not publish.
 */

import { createOriginRobotsGate } from "../nlp/origin-robots.mjs";
import { fetchPublicText } from "../nlp/lib.mjs";

import {
  LOCAL_NONJOSHTERNET_INTAKE_LIMIT,
  devCacheEnabled,
  devCacheRoot,
  isPermanentUsesMiss,
  latestUsesOrigins,
  rememberMemberCrawl,
  rememberUnavailableUsesPage,
  selectNewUsesLinks,
  unavailableUsesUrls,
  usesTechHrefs,
  writeLocalIntakeOrigins,
} from "./dev-cache.mjs";

const DIRECTORY = "https://uses.tech/";

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export async function main(argv = process.argv.slice(2)) {
  if (!devCacheEnabled()) {
    console.log("uses.tech cache skipped in CI");
    return 0;
  }
  const root = devCacheRoot();
  const directory = await fetchPublicText(DIRECTORY);
  const cached = await latestUsesOrigins(root);
  const already = [
    ...cached.flatMap((entry) => entry.pages.map((page) => page.url)),
    ...(await unavailableUsesUrls(root)),
  ];
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const parsedLimit = limitArg
    ? Number(limitArg.slice("--limit=".length))
    : LOCAL_NONJOSHTERNET_INTAKE_LIMIT;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.floor(parsedLimit)
      : LOCAL_NONJOSHTERNET_INTAKE_LIMIT;
  // Pull a larger candidate pool so robots skips still leave room for `limit` saves.
  const selected = selectNewUsesLinks(usesTechHrefs(directory.body || ""), {
    seed: "uses-tech",
    limit: Math.max(limit * 8, limit),
    already,
  });
  const gate = createOriginRobotsGate();
  /** @type {string[]} */
  const intakeOrigins = [];
  let appended = 0;
  for (const url of selected) {
    if (intakeOrigins.length >= limit) {
      break;
    }
    try {
      const allowed = await gate.allows(url);
      if (!allowed) {
        console.error(`uses.tech skip ${url}: robots.txt disallows`);
        await rememberUnavailableUsesPage({
          root,
          url,
          reason: "robots",
        });
        continue;
      }
      const fetched = await fetchPublicText(url);
      if (!fetched || fetched.body_complete === false || !fetched.body) {
        console.error(`uses.tech skip ${url}: incomplete`);
        continue;
      }
      const origin = new URL(url).origin;
      const saved = await rememberMemberCrawl({
        enabled: true,
        root,
        origin,
        usesPages: [{ url, html: fetched.body }],
      });
      appended += saved.appended;
      if (!intakeOrigins.includes(origin)) {
        intakeOrigins.push(origin);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`uses.tech skip ${url}: ${message}`);
      if (isPermanentUsesMiss(message)) {
        await rememberUnavailableUsesPage({ root, url, reason: message });
      }
    }
  }
  await writeLocalIntakeOrigins(root, intakeOrigins);
  console.log(
    `uses.tech cache appended ${appended}; intake ${intakeOrigins.length} site` +
      `${intakeOrigins.length === 1 ? "" : "s"} (limit ${limit})`,
  );
  return 0;
}

const isDirect =
  Boolean(process.argv[1]) && process.argv[1].endsWith("fetch-uses-tech.mjs");

if (isDirect) {
  main().then((code) => {
    process.exitCode = code;
  });
}
