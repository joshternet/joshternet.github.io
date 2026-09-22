import test from "node:test";
import assert from "node:assert/strict";

import { component, verifySignature, webcrypto } from "http-message-sig";

import worker from "../src/index.js";

const DIRECTORY_URL =
  "https://joshternet.org/.well-known/http-message-signatures-directory";

const DIRECTORY_CONTENT_TYPE =
  "application/http-message-signatures-directory+json";

const DIRECTORY_SIGNATURE_TAG = "http-message-signatures-directory";

const encoder = new TextEncoder();

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function generateIdentity() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "Ed25519",
    },
    true,
    ["sign", "verify"],
  );

  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);

  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

  const pemBody = Buffer.from(pkcs8)
    .toString("base64")
    .match(/.{1,64}/gu)
    .join("\n");

  return {
    pem: [
      "-----BEGIN PRIVATE KEY-----",
      pemBody,
      "-----END PRIVATE KEY-----",
      "",
    ].join("\n"),
    publicJwk: {
      kty: "OKP",
      crv: "Ed25519",
      x: publicJwk.x,
    },
  };
}

async function thumbprint(jwk) {
  const canonical = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
  });

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonical),
  );

  return base64Url(new Uint8Array(digest));
}

function makeRequest({ method = "GET", url = DIRECTORY_URL } = {}) {
  return new Request(url, {
    method,
  });
}

function makeEnv({ active, transition } = {}) {
  return {
    WEB_BOT_AUTH_ACTIVE_PRIVATE_KEY_PEM: active ?? "",
    WEB_BOT_AUTH_TRANSITION_PRIVATE_KEY_PEM: transition ?? "",
  };
}

function requestDescriptor(request) {
  return {
    kind: "request",
    method: request.method,
    targetUri: request.url,
    fields: Array.from(request.headers.entries(), ([name, value]) => ({
      name,
      value,
    })),
  };
}

function responseDescriptor(request, response) {
  return {
    kind: "response",
    status: response.status,
    fields: Array.from(response.headers.entries(), ([name, value]) => ({
      name,
      value,
    })),
    request: requestDescriptor(request),
  };
}

async function verifierFor(jwk) {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "Ed25519",
    },
    true,
    ["verify"],
  );

  return webcrypto.verifier(publicKey);
}

async function verifyDirectorySignature({ request, response, jwk, label }) {
  const verifier = await verifierFor(jwk);
  const expectedKeyId = await thumbprint(jwk);

  const verified = await verifySignature(
    responseDescriptor(request, response),
    {
      label,
      policy: {
        algorithms: ["ed25519"],
        requiredComponents: [
          component("@authority", {
            req: true,
          }),
          "content-digest",
        ],
        requiredParameters: ["created", "expires", "keyid", "alg", "tag"],
        clockSkew: 5,
        validate(signature) {
          assert.equal(signature.parameters.keyid, expectedKeyId);

          assert.equal(signature.parameters.alg, "ed25519");

          assert.equal(signature.parameters.tag, DIRECTORY_SIGNATURE_TAG);

          assert.equal(typeof signature.parameters.created, "number");

          assert.equal(typeof signature.parameters.expires, "number");

          assert.ok(
            signature.parameters.expires > signature.parameters.created,
          );
        },
      },
      resolveVerifier(candidate) {
        assert.equal(candidate.parameters.keyid, expectedKeyId);

        return verifier;
      },
    },
  );

  assert.equal(verified.label, label);
}

test("publishes one public Ed25519 JWK with the required content type", async () => {
  const identity = await generateIdentity();

  const request = makeRequest();

  const response = await worker.fetch(
    request,
    makeEnv({
      active: identity.pem,
    }),
  );

  assert.equal(response.status, 200);

  assert.equal(response.headers.get("Content-Type"), DIRECTORY_CONTENT_TYPE);

  assert.equal(response.headers.get("Cache-Control"), "no-store");

  assert.ok(response.headers.get("Content-Digest"));

  assert.ok(response.headers.get("Signature"));

  assert.ok(response.headers.get("Signature-Input"));

  const body = await response.json();

  assert.deepEqual(body, {
    keys: [identity.publicJwk],
  });

  assert.deepEqual(Object.keys(body.keys[0]).sort(), ["crv", "kty", "x"]);
});

test("directory signature verifies against the published JWK thumbprint", async () => {
  const identity = await generateIdentity();

  const request = makeRequest();

  const response = await worker.fetch(
    request,
    makeEnv({
      active: identity.pem,
    }),
  );

  assert.equal(response.status, 200);

  await verifyDirectorySignature({
    request,
    response,
    jwk: identity.publicJwk,
    label: "binding0",
  });
});

test("content digest matches the exact directory response body", async () => {
  const identity = await generateIdentity();

  const response = await worker.fetch(
    makeRequest(),
    makeEnv({
      active: identity.pem,
    }),
  );

  const body = await response.text();

  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(body));

  const expected = `sha-256=:${Buffer.from(digest).toString("base64")}:`;

  assert.equal(response.headers.get("Content-Digest"), expected);
});

test("publishes active and transition keys with independently valid signatures", async () => {
  const active = await generateIdentity();
  const transition = await generateIdentity();

  const request = makeRequest();

  const response = await worker.fetch(
    request,
    makeEnv({
      active: active.pem,
      transition: transition.pem,
    }),
  );

  assert.equal(response.status, 200);

  const body = await response.clone().json();

  assert.deepEqual(body, {
    keys: [active.publicJwk, transition.publicJwk],
  });

  const signatureInput = response.headers.get("Signature-Input");

  assert.match(signatureInput, /binding0=/u);

  assert.match(signatureInput, /binding1=/u);

  await verifyDirectorySignature({
    request,
    response,
    jwk: active.publicJwk,
    label: "binding0",
  });

  await verifyDirectorySignature({
    request,
    response,
    jwk: transition.publicJwk,
    label: "binding1",
  });
});

test("duplicate active and transition identities fail closed", async () => {
  const identity = await generateIdentity();

  const response = await worker.fetch(
    makeRequest(),
    makeEnv({
      active: identity.pem,
      transition: identity.pem,
    }),
  );

  assert.equal(response.status, 503);

  assert.equal(await response.text(), "Web Bot Auth directory unavailable.\n");

  assert.equal(response.headers.get("Signature"), null);
});

test("missing signing identity fails closed", async () => {
  const response = await worker.fetch(makeRequest(), makeEnv());

  assert.equal(response.status, 503);

  assert.equal(await response.text(), "Web Bot Auth directory unavailable.\n");

  assert.equal(
    response.headers.get("Content-Type"),
    "text/plain; charset=utf-8",
  );

  assert.equal(response.headers.get("Signature"), null);
});

test("malformed private key fails closed without exposing key material", async () => {
  const privateMaterial = "definitely-not-a-private-key";

  const response = await worker.fetch(
    makeRequest(),
    makeEnv({
      active: privateMaterial,
    }),
  );

  assert.equal(response.status, 503);

  const output = [
    await response.text(),
    ...response.headers.entries().map(([name, value]) => `${name}: ${value}`),
  ].join("\n");

  assert.doesNotMatch(output, new RegExp(privateMaterial, "u"));
});

test("private key material is absent from the successful response", async () => {
  const identity = await generateIdentity();

  const request = makeRequest();

  const response = await worker.fetch(
    request,
    makeEnv({
      active: identity.pem,
    }),
  );

  assert.equal(response.status, 200);

  const responseText = await response.clone().text();

  const responseHeaders = Array.from(
    response.headers.entries(),
    ([name, value]) => `${name}: ${value}`,
  ).join("\n");

  const combined = `${responseText}\n${responseHeaders}`;

  assert.doesNotMatch(combined, /BEGIN PRIVATE KEY/u);

  assert.doesNotMatch(combined, /"d"\s*:/u);

  const body = JSON.parse(responseText);

  assert.equal(Object.hasOwn(body.keys[0], "d"), false);
});

test("unrelated paths return 404 without loading signing identity", async () => {
  const response = await worker.fetch(
    makeRequest({
      url: "https://joshternet.org/not-the-directory",
    }),
    makeEnv(),
  );

  assert.equal(response.status, 404);

  assert.equal(await response.text(), "Not found.\n");
});

test("non-GET requests return 405 without loading signing identity", async () => {
  const response = await worker.fetch(
    makeRequest({
      method: "POST",
    }),
    makeEnv(),
  );

  assert.equal(response.status, 405);

  assert.equal(response.headers.get("Allow"), "GET");

  assert.equal(await response.text(), "Method not allowed.\n");
});
