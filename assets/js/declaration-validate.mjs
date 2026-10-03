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
 */

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
    return fail(error instanceof Error ? error.message : "The text is not valid JSON.");
  }

  if (!value || value.kind !== "object") {
    return fail("A version 1 declaration must be a JSON object.");
  }

  const version = value.members.get("version");

  if (!version) {
    return fail("The declaration is missing version.");
  }

  if (version.kind !== "number" || version.raw !== "1") {
    return fail(
      `version must be the JSON integer 1. Received ${version.raw}.`,
    );
  }

  const josh = value.members.get("josh");

  if (!josh) {
    return pass("undeclared");
  }

  if (josh.kind !== "boolean") {
    return fail(
      `josh must be a JSON Boolean, or be omitted. Received ${josh.raw}.`,
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
  };
}

/**
 * @param {string} reason
 * @returns {DeclarationResult}
 */
function fail(reason) {
  return {
    ok: false,
    identity: null,
    reasons: [reason],
  };
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
    return { error: "The origin must use http or https." };
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
    };
  }

  if (response.status === null || response.status >= 500) {
    return {
      kind: "unread",
      summary:
        "The declaration could not be read. That is not an invalid file, and it is not a withdrawal.",
      details: [
        response.status === null ? "No HTTP status." : `HTTP ${response.status}`,
        typeNote,
      ].filter(Boolean),
      declaration: null,
    };
  }

  if (response.body === null) {
    return {
      kind: "unread",
      summary:
        "The declaration could not be read. That is not an invalid file, and it is not a withdrawal.",
      details: [`HTTP ${response.status}`, typeNote].filter(Boolean),
      declaration: null,
    };
  }

  const declaration = validateDeclaration(response.body);

  return {
    kind: declaration.ok ? "declaration" : "declaration",
    summary: declaration.reasons[0],
    details: [`HTTP ${response.status}`, typeNote].filter(Boolean),
    declaration,
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
      parseArray();
      return { kind: "array", raw: "array", value: null };
    }

    if (character === '"') {
      const raw = parseString();

      return { kind: "string", raw, value: JSON.parse(raw) };
    }

    if (character === "t" || character === "f") {
      return parseLiteral();
    }

    if (character === "n") {
      const raw = readExact("null");

      return { kind: "null", raw, value: null };
    }

    if (character === "-" || (character >= "0" && character <= "9")) {
      return parseNumber();
    }

    throw new Error("The text is not valid JSON.");
  }

  function parseObject() {
    const members = new Map();

    index += 1;
    skip();

    if (source[index] === "}") {
      index += 1;
      return { kind: "object", members };
    }

    while (index < source.length) {
      skip();

      if (source[index] !== '"') {
        throw new Error("The text is not valid JSON.");
      }

      const key = JSON.parse(parseString());

      if (members.has(key)) {
        throw new Error(`The member "${key}" is repeated.`);
      }

      skip();

      if (source[index] !== ":") {
        throw new Error("The text is not valid JSON.");
      }

      index += 1;
      members.set(key, parseValue());
      skip();

      if (source[index] === "}") {
        index += 1;
        return { kind: "object", members };
      }

      if (source[index] !== ",") {
        throw new Error("The text is not valid JSON.");
      }

      index += 1;
    }

    throw new Error("The text is not valid JSON.");
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
        throw new Error("The text is not valid JSON.");
      }

      index += 1;
    }

    throw new Error("The text is not valid JSON.");
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
        throw new Error("The text is not valid JSON.");
      }

      index += 1;
    }

    throw new Error("The text is not valid JSON.");
  }

  function parseNumber() {
    const start = index;

    if (source[index] === "-") {
      index += 1;
    }

    if (!digit(source[index])) {
      throw new Error("The text is not valid JSON.");
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
        throw new Error("The text is not valid JSON.");
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
        throw new Error("The text is not valid JSON.");
      }

      while (digit(source[index])) {
        index += 1;
      }
    }

    const raw = source.slice(start, index);

    return { kind: "number", raw, value: Number(raw) };
  }

  function parseLiteral() {
    const word = source.startsWith("true", index) ? "true" : "false";

    readExact(word);

    return { kind: "boolean", raw: word, value: word === "true" };
  }

  function readExact(word) {
    if (!source.startsWith(word, index)) {
      throw new Error("The text is not valid JSON.");
    }

    const follower = source[index + word.length];

    if (follower && /[A-Za-z0-9_]/.test(follower)) {
      throw new Error("The text is not valid JSON.");
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
    throw new Error("The text is not valid JSON.");
  }

  return value;
}
