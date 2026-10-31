/**
 * Goal: connections-select is wired for user handlers, not selectOrigin itself.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("connections tracks deliberate selections only", async () => {
  const source = await readFile(
    path.join(root, "assets/js/connections.js"),
    "utf8",
  );

  assert.match(source, /function trackConnectionsSelect/);
  assert.match(source, /trackConnectionsSelect\(origin\)/);
  assert.match(
    source,
    /selectOrigin\(requested \? requested\.origin : null\);/,
  );

  const selectOriginBlock = source.slice(
    source.indexOf("function selectOrigin"),
    source.indexOf("function selectEdge"),
  );

  assert.doesNotMatch(selectOriginBlock, /joshternetTrack/);
  assert.doesNotMatch(selectOriginBlock, /connections-select/);
});
