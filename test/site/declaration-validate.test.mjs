import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyLiveResponse,
  declarationURL,
  validateDeclaration,
} from "../../assets/js/declaration-validate.js";

test("version 1 identities participate, including declined", () => {
  assert.equal(validateDeclaration('{"version":1}').identity, "undeclared");
  assert.equal(
    validateDeclaration('{"version":1,"josh":true}').identity,
    "affirmed",
  );

  const declined = validateDeclaration('{"version":1,"josh":false}');

  assert.equal(declined.ok, true);
  assert.equal(declined.identity, "declined");
  assert.match(declined.reasons[0], /still participates/);
});

test("version must be the integer token 1", () => {
  for (const source of [
    '{"version":1.0}',
    '{"version":1e0}',
    '{"version":"1"}',
    "{}",
    "not json",
  ]) {
    const result = validateDeclaration(source);

    assert.equal(result.ok, false, source);
    assert.notEqual(result.reasons[0], "");
    assert.ok(result.rule);
    assert.match(result.rule.section, /§/);
  }

  const fractional = validateDeclaration('{"version":1.0}');

  assert.equal(
    fractional.span &&
      '{"version":1.0}'.slice(fractional.span.start, fractional.span.end),
    "1.0",
  );
  assert.match(fractional.rule.section, /§6/);
});

test("josh must be a boolean when it is present", () => {
  assert.equal(validateDeclaration('{"version":1,"josh":"true"}').ok, false);
  assert.equal(validateDeclaration('{"version":1,"josh":1}').ok, false);
  assert.equal(validateDeclaration('{"version":1,"josh":null}').ok, false);
});

test("unknown members stay valid and repeated members do not", () => {
  assert.equal(validateDeclaration('{"version":1,"note":"hello"}').ok, true);
  assert.match(
    validateDeclaration('{"version":1,"version":1}').reasons[0],
    /repeated/,
  );
});

test("a live check uses the typed origin and the protocol path", () => {
  assert.deepEqual(declarationURL("https://example.invalid/blog?x=1#y"), {
    url: "https://example.invalid/.well-known/josh",
  });
  assert.deepEqual(declarationURL("https://example.invalid:8443"), {
    url: "https://example.invalid:8443/.well-known/josh",
  });
  assert.equal("error" in declarationURL("ftp://example.invalid"), true);
});

test("a missing declaration and a read failure are not invalid files", () => {
  const missing = classifyLiveResponse({
    requestedOrigin: "https://example.invalid",
    finalURL: "https://example.invalid/.well-known/josh",
    status: 404,
    contentType: "text/plain",
    body: "missing",
  });

  assert.equal(missing.kind, "unpublished");
  assert.equal(missing.declaration, null);

  const unread = classifyLiveResponse({
    requestedOrigin: "https://example.invalid",
    finalURL: null,
    status: 503,
    contentType: "",
    body: null,
  });

  assert.equal(unread.kind, "unread");
  assert.match(unread.summary, /not an invalid file/);
  assert.match(unread.details.join(" "), /application\/json/);
});

test("a cross-origin redirect is not the typed origin's declaration", () => {
  const redirected = classifyLiveResponse({
    requestedOrigin: "https://example.invalid",
    finalURL: "https://elsewhere.example/.well-known/josh",
    status: 200,
    contentType: "application/json",
    body: '{"version":1}',
  });

  assert.equal(redirected.kind, "unread");
  assert.match(redirected.summary, /different origin/);
});
