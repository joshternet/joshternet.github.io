import {
  component,
  verifySignature,
  webcrypto,
} from "http-message-sig";

const DIRECTORY_CONTENT_TYPE =
  "application/http-message-signatures-directory+json";

const DIRECTORY_SIGNATURE_TAG =
  "http-message-signatures-directory";

const encoder = new TextEncoder();

function fail(message) {
  throw new Error(message);
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
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
  response,
) {
  return {
    kind: "response",
    status: response.status,
    fields: Array.from(
      response.headers.entries(),
      ([name, value]) => ({
        name,
        value,
      }),
    ),
    request: requestDescriptor(request),
  };
}

async function verifyContentDigest(
  body,
  response,
) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(body),
  );

  const expected =
    `sha-256=:${Buffer.from(digest).toString("base64")}:`;

  const actual =
    response.headers.get("Content-Digest");

  if (actual !== expected) {
    fail(
      `Content-Digest mismatch: expected ${expected}, received ${actual}`,
    );
  }
}

function validateJwk(jwk, index) {
  if (
    !jwk ||
    typeof jwk !== "object" ||
    Array.isArray(jwk)
  ) {
    fail(`keys[${index}] is not a JWK object`);
  }

  const fields = Object.keys(jwk).sort();

  if (
    fields.length !== 3 ||
    fields[0] !== "crv" ||
    fields[1] !== "kty" ||
    fields[2] !== "x"
  ) {
    fail(
      `keys[${index}] must contain only crv, kty, and x`,
    );
  }

  if (
    jwk.kty !== "OKP" ||
    jwk.crv !== "Ed25519" ||
    typeof jwk.x !== "string" ||
    !jwk.x
  ) {
    fail(
      `keys[${index}] is not a valid public Ed25519 OKP JWK`,
    );
  }

  if (Object.hasOwn(jwk, "d")) {
    fail(
      `keys[${index}] contains private key material`,
    );
  }
}

async function verifyKeySignature({
  request,
  response,
  jwk,
  index,
}) {
  const keyId = await thumbprint(jwk);
  const verifier = await verifierFor(jwk);

  const verified = await verifySignature(
    responseDescriptor(
      request,
      response,
    ),
    {
      label: `binding${index}`,
      policy: {
        algorithms: ["ed25519"],
        requiredComponents: [
          component(
            "@authority",
            {
              req: true,
            },
          ),
          "content-digest",
        ],
        requiredParameters: [
          "created",
          "expires",
          "keyid",
          "alg",
          "tag",
        ],
        clockSkew: 5,
        validate(signature) {
          if (
            signature.parameters.keyid !==
            keyId
          ) {
            fail(
              `binding${index} keyid does not match its JWK thumbprint`,
            );
          }

          if (
            signature.parameters.alg !==
            "ed25519"
          ) {
            fail(
              `binding${index} does not use ed25519`,
            );
          }

          if (
            signature.parameters.tag !==
            DIRECTORY_SIGNATURE_TAG
          ) {
            fail(
              `binding${index} has an invalid signature tag`,
            );
          }

          const created =
            signature.parameters.created;

          const expires =
            signature.parameters.expires;

          if (
            typeof created !== "number" ||
            typeof expires !== "number" ||
            expires <= created
          ) {
            fail(
              `binding${index} has an invalid validity window`,
            );
          }
        },
      },
      resolveVerifier(candidate) {
        if (
          candidate.parameters.keyid !==
          keyId
        ) {
          fail(
            `binding${index} resolved an unexpected keyid`,
          );
        }

        return verifier;
      },
    },
  );

  return {
    label: verified.label,
    keyId,
  };
}

async function main() {
  const input = process.argv[2];

  if (!input) {
    fail(
      "Usage: node scripts/verify.mjs <directory-url>",
    );
  }

  const url = new URL(input);

  if (url.protocol !== "https:") {
    fail(
      "Directory URL must use HTTPS",
    );
  }

  const request = new Request(
    url,
    {
      method: "GET",
      headers: {
        Accept: DIRECTORY_CONTENT_TYPE,
      },
    },
  );

  const response = await fetch(request);

  if (response.status !== 200) {
    fail(
      `Directory returned HTTP ${response.status}`,
    );
  }

  const contentType =
    response.headers.get("Content-Type");

  if (
    contentType !==
    DIRECTORY_CONTENT_TYPE
  ) {
    fail(
      `Unexpected Content-Type: ${contentType}`,
    );
  }

  for (
    const requiredHeader of [
      "Content-Digest",
      "Signature",
      "Signature-Input",
    ]
  ) {
    if (
      !response.headers.get(requiredHeader)
    ) {
      fail(
        `Missing ${requiredHeader} header`,
      );
    }
  }

  const body =
    await response.clone().text();

  await verifyContentDigest(
    body,
    response,
  );

  let directory;

  try {
    directory = JSON.parse(body);
  } catch {
    fail(
      "Directory body is not valid JSON",
    );
  }

  if (
    !directory ||
    typeof directory !== "object" ||
    Array.isArray(directory) ||
    !Array.isArray(directory.keys) ||
    directory.keys.length === 0
  ) {
    fail(
      "Directory must contain a non-empty keys array",
    );
  }

  const results = [];

  for (
    let index = 0;
    index < directory.keys.length;
    index += 1
  ) {
    const jwk = directory.keys[index];

    validateJwk(
      jwk,
      index,
    );

    results.push(
      await verifyKeySignature({
        request,
        response,
        jwk,
        index,
      }),
    );
  }

  console.log(
    `PASS: ${url.href}`,
  );

  console.log(
    `Validated ${results.length} signed Ed25519 ${results.length === 1 ? "key" : "keys"}.`,
  );

  for (const result of results) {
    console.log(
      `${result.label}: ${result.keyId}`,
    );
  }
}

main().catch((error) => {
  console.error(
    `FAIL: ${error.message}`,
  );

  process.exitCode = 1;
});