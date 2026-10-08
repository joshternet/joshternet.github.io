/**
 * Goal & Constraints:
 * CI entry point for topic quality. Exits non-zero when invariants fail.
 * Does not publish datasets and does not call an external NLP service.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

import { readJSONIfExists } from "./lib.mjs";
import { topicQualityReport } from "./quality.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));

const topics = await readJSONIfExists(path.join(root, "_data/topics.json"), {});
const content = await readJSONIfExists(
  path.join(root, "_data/content.json"),
  {},
);
const aliasesDoc = await readJSONIfExists(
  path.join(root, "_data/topic_aliases.json"),
  { aliases: [] },
);
const search = await readJSONIfExists(
  path.join(root, "_data/search_index.json"),
  {},
);
const searchUrls = Array.isArray(search.documents)
  ? search.documents
      .map((document) =>
        document && typeof document.url === "string" ? document.url : "",
      )
      .filter((url) => url.startsWith("/topics/"))
  : [];

const report = topicQualityReport({
  topics,
  content,
  aliasesDoc,
  searchUrls,
});

process.stdout.write(`${JSON.stringify(report.diff)}\n`);

if (!report.ok) {
  process.stderr.write(`${JSON.stringify(report.errors)}\n`);
  process.exitCode = 1;
}
