import {
  appendSignature,
  component,
  createSignature,
  webcrypto,
} from "http-message-sig";

const DIRECTORY_PATH =
  "/.well-known/http-message-signatures-directory";

const DIRECTORY_CONTENT_TYPE =
  "application/http-message-signatures-directory+json";

const DIRECTORY_SIGNATURE_TAG =
  "http-message-signatures-directory";

const SIGNATURE_LIFETIME_SECONDS = 300;

const encoder = new TextEncoder();

function textResponse(body, status, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function base64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64Url(bytes) {
  return base64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function privateKeyDerFromPem(pem) {
  if (typeof pem !== "string" || !pem.trim()) {
    throw new Error("Web Bot Auth private key is unavailable");
  }

  const match = pem.trim().match(
    /^-----BEGIN PRIVATE KEY-----\s+([A-Za-z0-9+/=\s]+?)\s+-----END PRIVATE KEY-----$/u,
  );

  if (!match) {
    throw new Error("Web Bot Auth private key is invalid");
  }

  const encoded = match[1].replace(/\s+/gu, "");

  if (!encoded) {
    throw new Error("Web Bot Auth private key is invalid");
  }

  return decodeBase64(encoded);
}

async function jwkThumbprint(publicJwk) {
  const canonical = JSON.stringify({
    crv: publicJwk.crv,
    kty: publicJwk.kty,
    x: publicJwk.x,
  });

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonical),
  );

  return base64Url(new Uint8Array(digest));
}

async function loadIdentity(pem) {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyDerFromPem(pem),
    {
      name: "Ed25519",
    },
    true,
    ["sign"],
  );

  const privateJwk = await crypto.subtle.exportKey(
    "jwk",
    privateKey,
  );

  if (
    privateJwk.kty !== "OKP" ||
    privateJwk.crv !== "Ed25519" ||
    typeof privateJwk.x !== "string" ||
    !privateJwk.x
  ) {
    throw new Error("Web Bot Auth private key is not Ed25519");
  }

  const publicJwk = Object.freeze({
    kty: "OKP",
    crv: "Ed25519",
    x: privateJwk.x,
  });

  return Object.freeze({
    privateKey,
    publicJwk,
    keyId: await jwkThumbprint(publicJwk),
  });
}

async function loadIdentities(env) {
  const configuredKeys = [
    env.WEB_BOT_AUTH_ACTIVE_PRIVATE_KEY_PEM,
    env.WEB_BOT_AUTH_TRANSITION_PRIVATE_KEY_PEM,
  ].filter(
    (value) =>
      typeof value === "string" &&
      value.trim() !== "",
  );

  if (configuredKeys.length === 0) {
    throw new Error("Web Bot Auth signing identity is unavailable");
  }

  const identities = await Promise.all(
    configuredKeys.map(loadIdentity),
  );

  const keyIds = new Set();

  for (const identity of identities) {
    if (keyIds.has(identity.keyId)) {
      throw new Error("Web Bot Auth signing identities are duplicated");
    }

    keyIds.add(identity.keyId);
  }

  return identities;
}

async function contentDigest(body) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(body),
  );

  return `sha-256=:${base64(new Uint8Array(digest))}:`;
}

function requestDescriptor(request) {
  return {
    kind: "request",
    method: request.method,
    targetUri: request.url,
    fields: Array.from(
      request.headers.entries(),
      ([name, value]) => ({
        name,
        value,
      }),
    ),
  };
}

function responseDescriptor(
  request,
  contentType,
  digest,
) {
  return {
    kind: "response",
    status: 200,
    fields: [
      {
        name: "content-type",
        value: contentType,
      },
      {
        name: "content-digest",
        value: digest,
      },
    ],
    request: requestDescriptor(request),
  };
}

async function signedDirectoryResponse(request, env) {
  const identities = await loadIdentities(env);

  const body = JSON.stringify({
    keys: identities.map(
      (identity) => identity.publicJwk,
    ),
  });

  const digest = await contentDigest(body);

  const descriptor = responseDescriptor(
    request,
    DIRECTORY_CONTENT_TYPE,
    digest,
  );

  const created = Math.floor(Date.now() / 1000);
  const expires =
    created + SIGNATURE_LIFETIME_SECONDS;

  let headers = new Headers({
    "Content-Type": DIRECTORY_CONTENT_TYPE,
    "Content-Digest": digest,
    "Cache-Control": "no-store",
  });

  for (
    let index = 0;
    index < identities.length;
    index += 1
  ) {
    const identity = identities[index];
    const signer = webcrypto.signer(
      identity.privateKey,
    );

    const fields = await createSignature(
      descriptor,
      {
        label: `binding${index}`,
        components: [
          component(
            "@authority",
            {
              req: true,
            },
          ),
          "content-digest",
        ],
        parameters: {
          created,
          expires,
          keyid: identity.keyId,
          alg: signer.algorithm,
          tag: DIRECTORY_SIGNATURE_TAG,
        },
        signer,
      },
    );

    headers = appendSignature(
      headers,
      fields,
    );
  }

  return new Response(body, {
    status: 200,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== DIRECTORY_PATH) {
      return textResponse(
        "Not found.\n",
        404,
      );
    }

    if (request.method !== "GET") {
      return textResponse(
        "Method not allowed.\n",
        405,
        {
          Allow: "GET",
        },
      );
    }

    try {
      return await signedDirectoryResponse(
        request,
        env,
      );
    } catch {
      return textResponse(
        "Web Bot Auth directory unavailable.\n",
        503,
      );
    }
  },
};