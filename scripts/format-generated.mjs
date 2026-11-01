/**
 * Goal & Constraints:
 * CLI entry for formatting sync-generated outputs (format:data / build.sh).
 * Same globs as formatGeneratedOutputs in format-written.mjs.
 */

import { formatGeneratedOutputs } from "./format-written.mjs";

await formatGeneratedOutputs();
process.stdout.write("Formatted generated sync outputs with Prettier.\n");
