/**
 * Checks a /.well-known/josh document against the version 1 rules on the
 * implementation guide. Version must be the JSON integer token 1, so 1.0
 * and 1e0 fail even though JSON.parse would turn them into the number 1.
 */

/**
 * @typedef {"undeclared" | "affirmed" | "declined"} DeclarationIdentity
 */

/**
 * @typedef {object} DeclarationResult
 * @property {boolean} ok
 * @property {DeclarationIdentity | null} identity
 * @property {string[]} reasons
 * @property {{ rfc: string, section: string, text: string } | null} rule
 * @property {{ start: number, end: number } | null} span
 */

const RULES = {
  representation: {
    rfc: "RFC-JOSH-0002",
    section: "§5 Representation and §12 Validation",
    text: "The resource must be a JSON object conforming to RFC 8259. An invalid resource must not be treated as a valid declaration.",
  },
  versionPresent: {
    rfc: "RFC-JOSH-0002",
    section: "§6 Version",
    text: "The version member must be present.",
  },
  versionInteger: {
    rfc: "RFC-JOSH-0002",
    section: "§6 Version and §8 Valid Values",
    text: "version must be the RFC 8259 number production with no fraction and no exponent, and its value must be the integer 1. 1.0 and 1e0 are not version 1.",
  },
  joshBoolean: {
    rfc: "RFC-JOSH-0002",
    section: "§8 Valid Values",
    text: "When josh is present it must be a JSON boolean. A string, a number, or null is not accepted.",
  },
  duplicate: {
    rfc: "RFC-JOSH-0002",
    section: "§12 Validation",
    text: "A version 1 declaration is invalid when a member name is repeated.",
  },
  undeclared: {
    rfc: "RFC-JOSH-0002",
    section: "§7.3 Undeclared and §4 Participation",
    text: "Omitting josh declares no Josh identity. That absence is not true and it is not false. A valid declaration means the origin participates.",
  },
  affirmed: {
    rfc: "RFC-JOSH-0002",
    section: "§7.1 Affirmed and §4 Participation",
    text: "josh true declares Affirmed Josh Identity. A valid declaration means the origin participates.",
  },
  declined: {
    rfc: "RFC-JOSH-0002",
    section: "§7.2 Declined and §4 Participation",
    text: "josh false declares Declined Josh Identity. Publishing a valid declaration still means the origin participates. It is not a rejection.",
  },
  contentType: {
    rfc: "RFC-JOSH-0002",
    section: "§5 Representation",
    text: "The media type is application/json, and a server should send that Content-Type. A missing or different type does not by itself make a valid document invalid.",
  },
  redirect: {
    rfc: "RFC-JOSH-0002",
    section: "§10 Redirects",
    text: "A cross-origin redirect must not be treated as a declaration for the origin you typed.",
  },
  removal: {
    rfc: "RFC-JOSH-0002",
    section: "§11 Removal",
    text: "404 and 410 mean no declaration is published there. That is not an invalid file.",
  },
  retrieval: {
    rfc: "RFC-JOSH-0002",
    section: "§11 Removal and §9 Retrieval",
    text: "A timeout, DNS failure, TLS failure, or server error does not establish withdrawal and is not an invalid declaration.",
  },
  path: {
    rfc: "RFC-JOSH-0002",
    section: "§3.2 Path",
    text: "The canonical path is /.well-known/josh, with no trailing slash, query, or fragment.",
  },
};

const IDENTITY_SUMMARY = {
  undeclared:
    "Valid version 1 declaration. Josh identity is undeclared. The origin is participating.",
  affirmed:
    "Valid version 1 declaration. Josh identity is affirmed. The origin is participating.",
  declined:
    "Valid version 1 declaration. Josh identity is declined. Declined identity still participates. This is not a rejection.",
};

/**
 * @param {string} source
 * @returns {DeclarationResult}
 */
export function validateDeclaration(source) {
  let value;

  try {
    value = parseJson(source);
  } catch (error) {
    const span = error instanceof Error ? error.span : null;
    const rule =
      error instanceof Error && error.rule ? error.rule : RULES.representation;

    return fail(
      error instanceof Error ? error.message : "The text is not valid JSON.",
      rule,
      span ?? { start: 0, end: source.length },
    );
  }

  if (!value || value.kind !== "object") {
    return fail(
      "A version 1 declaration must be a JSON object.",
      RULES.representation,
      spanOf(value, source),
    );
  }

  const version = value.members.get("version");

  if (!version) {
    return fail("The declaration is missing version.", RULES.versionPresent, {
      start: value.start,
      end: value.end,
    });
  }

  if (version.kind !== "number" || version.raw !== "1") {
    return fail(
      `version must be the JSON integer 1. Received ${version.raw}.`,
      RULES.versionInteger,
      { start: version.start, end: version.end },
    );
  }

  const josh = value.members.get("josh");

  if (!josh) {
    return pass("undeclared");
  }

  if (josh.kind !== "boolean") {
    return fail(
      `josh must be a JSON Boolean, or be omitted. Received ${josh.raw}.`,
      RULES.joshBoolean,
      { start: josh.start, end: josh.end },
    );
  }

  return pass(josh.value === true ? "affirmed" : "declined");
}

/**
 * @param {DeclarationIdentity} identity
 * @returns {DeclarationResult}
 */
function pass(identity) {
  return {
    ok: true,
    identity,
    reasons: [IDENTITY_SUMMARY[identity]],
    rule: RULES[identity],
    span: null,
  };
}

/**
 * @param {string} reason
 * @returns {DeclarationResult}
 */
function fail(reason, rule, span) {
  return {
    ok: false,
    identity: null,
    reasons: [reason],
    rule,
    span: span ?? null,
  };
}

/**
 * @param {{ start?: number, end?: number } | null | undefined} value
 * @param {string} source
 * @returns {{ start: number, end: number }}
 */
function spanOf(value, source) {
  if (value && Number.isInteger(value.start) && Number.isInteger(value.end)) {
    return { start: value.start, end: value.end };
  }

  return { start: 0, end: source.length };
}

/**
 * Builds the exact declaration URL for a typed origin.
 * The path is always /.well-known/josh. A path, query, or fragment on the
 * input is not requested.
 * @param {string} originText
 * @returns {{ url: string } | { error: string }}
 */
export function declarationURL(originText) {
  const trimmed = originText.trim();

  if (!trimmed) {
    return { error: "Enter an origin, such as https://example.invalid." };
  }

  let url;

  try {
    url = new URL(trimmed);
  } catch {
    return { error: "That is not a usable origin URL." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      error: "The origin must use http or https.",
      rule: RULES.retrieval,
    };
  }

  if (url.username || url.password) {
    return { error: "The origin must not include a username or password." };
  }

  return { url: `${url.origin}/.well-known/josh` };
}

/**
 * Turns a completed live response into a result that does not treat a
 * transport problem as an invalid declaration.
 * @param {object} response
 * @param {string} response.requestedOrigin
 * @param {string | null} response.finalURL
 * @param {number | null} response.status
 * @param {string} response.contentType
 * @param {string | null} response.body
 * @returns {{ kind: "declaration" | "unpublished" | "unread", summary: string, details: string[], declaration: DeclarationResult | null }}
 */
export function classifyLiveResponse(response) {
  const typeNote = contentTypeNote(response.contentType);

  if (response.finalURL) {
    let finalOrigin = "";

    try {
      finalOrigin = new URL(response.finalURL).origin;
    } catch {
      finalOrigin = "";
    }

    if (finalOrigin && finalOrigin !== response.requestedOrigin) {
      return {
        kind: "unread",
        summary:
          "That response redirected to a different origin. It is not a declaration for the origin you typed.",
        details: [`Final URL: ${response.finalURL}`, typeNote].filter(Boolean),
        declaration: null,
        rule: RULES.redirect,
      };
    }
  }

  if (response.status === 404 || response.status === 410) {
    return {
      kind: "unpublished",
      summary:
        "This origin is not publishing a declaration. That is not an invalid file.",
      details: [`HTTP ${response.status}`, typeNote].filter(Boolean),
      declaration: null,
      rule: RULES.removal,
    };
  }

  if (response.status === null || response.status >= 500) {
    return {
      kind: "unread",
      summary:
        "The declaration could not be read. That is not an invalid file, and it is not a withdrawal.",
      details: [
        response.status === null
          ? "No HTTP status."
          : `HTTP ${response.status}`,
        typeNote,
      ].filter(Boolean),
      declaration: null,
      rule: RULES.retrieval,
    };
  }

  if (response.body === null) {
    return {
      kind: "unread",
      summary:
        "The declaration could not be read. That is not an invalid file, and it is not a withdrawal.",
      details: [`HTTP ${response.status}`, typeNote].filter(Boolean),
      declaration: null,
      rule: RULES.retrieval,
    };
  }

  const declaration = validateDeclaration(response.body);

  return {
    kind: declaration.ok ? "declaration" : "declaration",
    summary: declaration.reasons[0],
    details: [`HTTP ${response.status}`, typeNote].filter(Boolean),
    declaration,
    rule: declaration.ok ? RULES.contentType : declaration.rule,
  };
}

/**
 * @param {string} contentType
 * @returns {string}
 */
function contentTypeNote(contentType) {
  const received = contentType.trim() || "(none)";

  return `Content-Type: ${received}. Publishers should send application/json. A valid document is not invalid only because this header is missing or different.`;
}

/**
 * @typedef {{ kind: "object", members: Map<string, JsonValue> }} JsonObject
 * @typedef {{ kind: "array" | "string" | "boolean" | "null" | "number", raw: string, value: unknown }} JsonValue
 */

/**
 * @param {string} source
 * @returns {JsonObject | JsonValue}
 */
function parseJson(source) {
  let index = 0;

  function skip() {
    while (index < source.length && /\s/.test(source[index])) {
      index += 1;
    }
  }

  function parseValue() {
    skip();

    const character = source[index];

    if (character === "{") {
      return parseObject();
    }

    if (character === "[") {
      const start = index;

      parseArray();

      return {
        kind: "array",
        raw: source.slice(start, index),
        value: null,
        start,
        end: index,
      };
    }

    if (character === '"') {
      const start = index;
      const raw = parseString();

      return { kind: "string", raw, value: JSON.parse(raw), start, end: index };
    }

    if (character === "t" || character === "f") {
      return parseLiteral();
    }

    if (character === "n") {
      const start = index;
      const raw = readExact("null");

      return { kind: "null", raw, value: null, start, end: index };
    }

    if (character === "-" || (character >= "0" && character <= "9")) {
      return parseNumber();
    }

    syntaxError();
  }

  function syntaxError() {
    const error = new Error("The text is not valid JSON.");
    const start = Math.min(index, source.length);

    error.span = { start, end: Math.max(start, source.length) };
    error.rule = RULES.representation;
    throw error;
  }

  function parseObject() {
    const members = new Map();
    const start = index;

    index += 1;
    skip();

    if (source[index] === "}") {
      index += 1;
      return { kind: "object", members, start, end: index };
    }

    while (index < source.length) {
      skip();

      if (source[index] !== '"') {
        syntaxError();
      }

      const keyStart = index;
      const key = JSON.parse(parseString());

      if (members.has(key)) {
        const error = new Error(`The member "${key}" is repeated.`);

        error.span = { start: keyStart, end: index };
        error.rule = RULES.duplicate;
        throw error;
      }

      skip();

      if (source[index] !== ":") {
        syntaxError();
      }

      index += 1;
      members.set(key, parseValue());
      skip();

      if (source[index] === "}") {
        index += 1;
        return { kind: "object", members, start, end: index };
      }

      if (source[index] !== ",") {
        syntaxError();
      }

      index += 1;
    }

    syntaxError();
  }

  function parseArray() {
    index += 1;
    skip();

    if (source[index] === "]") {
      index += 1;
      return;
    }

    while (index < source.length) {
      parseValue();
      skip();

      if (source[index] === "]") {
        index += 1;
        return;
      }

      if (source[index] !== ",") {
        syntaxError();
      }

      index += 1;
    }

    syntaxError();
  }

  function parseString() {
    const start = index;

    index += 1;

    while (index < source.length) {
      const character = source[index];

      if (character === '"') {
        index += 1;
        return source.slice(start, index);
      }

      if (character === "\\") {
        index += 2;
        continue;
      }

      if (character < " ") {
        syntaxError();
      }

      index += 1;
    }

    syntaxError();
  }

  function parseNumber() {
    const start = index;

    if (source[index] === "-") {
      index += 1;
    }

    if (!digit(source[index])) {
      syntaxError();
    }

    if (source[index] === "0") {
      index += 1;
    } else {
      while (digit(source[index])) {
        index += 1;
      }
    }

    if (source[index] === ".") {
      index += 1;

      if (!digit(source[index])) {
        syntaxError();
      }

      while (digit(source[index])) {
        index += 1;
      }
    }

    if (source[index] === "e" || source[index] === "E") {
      index += 1;

      if (source[index] === "+" || source[index] === "-") {
        index += 1;
      }

      if (!digit(source[index])) {
        syntaxError();
      }

      while (digit(source[index])) {
        index += 1;
      }
    }

    const raw = source.slice(start, index);

    return { kind: "number", raw, value: Number(raw), start, end: index };
  }

  function parseLiteral() {
    const start = index;
    const word = source.startsWith("true", index) ? "true" : "false";

    readExact(word);

    return {
      kind: "boolean",
      raw: word,
      value: word === "true",
      start,
      end: index,
    };
  }

  function readExact(word) {
    if (!source.startsWith(word, index)) {
      syntaxError();
    }

    const follower = source[index + word.length];

    if (follower && /[A-Za-z0-9_]/.test(follower)) {
      syntaxError();
    }

    index += word.length;

    return word;
  }

  function digit(character) {
    return character >= "0" && character <= "9";
  }

  const value = parseValue();

  skip();

  if (index !== source.length) {
    syntaxError();
  }

  return value;
}
