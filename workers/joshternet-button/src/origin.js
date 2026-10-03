/**
 * Goal & Constraints:
 * Normalize untrusted origin query values to registry-canonical origins.
 * Never fetch the supplied origin. Reject credentials and non-http(s).
 */

const MAX_ORIGIN_LENGTH = 2048;

/**
 * @param {string} code
 * @param {string} message
 * @returns {{ ok: false, code: string, message: string }}
 */
function invalid(code, message) {
  return {
    ok: false,
    code,
    message,
  };
}

/**
 * @param {string | null} value
 * @returns {{ ok: true, origin: string } | { ok: false, code: string, message: string }}
 */
export function normalizeButtonOrigin(value) {
  if (typeof value !== "string") {
    return invalid("origin_required", "An origin URL is required.");
  }

  const input = value.trim();

  if (!input) {
    return invalid("origin_required", "An origin URL is required.");
  }

  if (input.length > MAX_ORIGIN_LENGTH) {
    return invalid("origin_invalid", "That origin URL is too long.");
  }

  let url;

  try {
    url = new URL(input);
  } catch {
    return invalid("origin_invalid", "That is not a usable origin URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return invalid("origin_invalid", "The origin must use http or https.");
  }

  if (url.username || url.password) {
    return invalid(
      "origin_invalid",
      "The origin must not include a username or password.",
    );
  }

  return {
    ok: true,
    origin: url.origin,
  };
}
