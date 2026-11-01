/**
 * Goal & Constraints:
 * CLI entry for formatting sync-generated outputs (format:data / build.sh).
 * Always strict so publish and local build fail closed on Prettier errors.
 * Mid-harvest writers call formatGeneratedOutputs() soft (default) instead.
 */

import { formatGeneratedOutputs } from "./format-written.mjs";

await formatGeneratedOutputs({ strict: true });
process.stdout.write("Formatted generated sync outputs with Prettier.\n");
