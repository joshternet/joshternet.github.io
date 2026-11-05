/**
 * Goal & Constraints:
 * Shared local-vs-CI publish resolution for optional discovery surfaces
 * (Uses, Seeking). Local crawls must write visitor-facing preview JSON so
 * /uses/ and /seeking/ can be verified before shipping. CI stays shadow by
 * default so request/tool bodies are not staged unless an operator opts in.
 */

/**
 * True when running under GitHub Actions or another CI that sets CI=true.
 * @returns {boolean}
 */
export function isCiEnvironment() {
  return (
    process.env.CI === "true" ||
    process.env.CI === "1" ||
    process.env.GITHUB_ACTIONS === "true"
  );
}

/**
 * Resolves whether a preview dataset should be written for visitors.
 * Explicit boolean wins. Env `1`/`true` forces on; `0`/`false` forces off.
 * Otherwise local (non-CI) defaults on; CI defaults off (shadow).
 * @param {string} envName - Process env var name (e.g. JOSHTERNET_USES_PUBLISH).
 * @param {boolean} [explicit] - Optional caller override.
 * @returns {boolean}
 * @example
 * resolvePreviewPublish("JOSHTERNET_USES_PUBLISH"); // true locally, false in CI
 */
export function resolvePreviewPublish(envName, explicit) {
  if (explicit === true) {
    return true;
  }

  if (explicit === false) {
    return false;
  }

  const raw = process.env[String(envName || "")];

  if (raw === "1" || raw === "true") {
    return true;
  }

  if (raw === "0" || raw === "false") {
    return false;
  }

  return !isCiEnvironment();
}
