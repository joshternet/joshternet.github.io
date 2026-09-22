# Joshternet HTTP Message Signature Directory

This Cloudflare Worker serves JoshBot's public Web Bot Auth signing-key
directory at:

```text
https://joshternet.org/.well-known/http-message-signatures-directory
```

The directory is part of JoshBot's authenticated crawler identity. It publishes
only public Ed25519 key material and signs its own response using HTTP Message
Signatures.

## Security boundary

JoshBot uses a dedicated Ed25519 signing identity for Web Bot Auth.

The private key must never be committed to this repository, placed in
`wrangler.jsonc`, written to a `.env` file, included in fixtures, logged, or
returned by the Worker.

The Worker receives the private PKCS#8 PEM through a Cloudflare Worker secret:

```text
WEB_BOT_AUTH_ACTIVE_PRIVATE_KEY_PEM
```

An optional second secret supports overlap during key rotation:

```text
WEB_BOT_AUTH_TRANSITION_PRIVATE_KEY_PEM
```

The Worker derives the public Ed25519 key from each private key and publishes
only the normal public OKP JWK members:

```json
{
  "kty": "OKP",
  "crv": "Ed25519",
  "x": "..."
}
```

A private JWK `d` value is never published.

The Web Bot Auth `keyid` is the RFC 7638 SHA-256 JWK thumbprint of the public
JWK.

## Directory response

A successful response uses:

```text
Content-Type: application/http-message-signatures-directory+json
```

The body is a JWKS:

```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "..."
    }
  ]
}
```

The response also contains:

- `Content-Digest`
- `Signature-Input`
- `Signature`

Each published key signs the directory independently.

The signature covers:

```text
"@authority";req
"content-digest"
```

and includes:

```text
created
expires
keyid
alg="ed25519"
tag="http-message-signatures-directory"
```

The related-request `@authority` binding prevents a valid directory response
from being reused as the signed directory for another authority.

## Local development

Install dependencies:

```sh
npm ci
```

Run the tests:

```sh
npm test
```

Validate the Worker bundle:

```sh
npm run check
```

Start a local Worker:

```sh
npm run dev
```

A signing identity is required before the directory endpoint can return `200`.

For local development, create a disposable Ed25519 key outside the repository:

```sh
openssl genpkey \
  -algorithm Ed25519 \
  -out /tmp/joshternet-web-bot-auth-test-key.pem
```

Do not use a disposable development key as JoshBot's production identity.

## Installing the production signing identity

The production Worker must use the same dedicated JoshBot signing identity
configured for JoshBot.

Do not generate a second unrelated production key for the directory.

From this Worker directory, install the active private key as a Cloudflare
secret:

```sh
npx wrangler secret put WEB_BOT_AUTH_ACTIVE_PRIVATE_KEY_PEM
```

Wrangler prompts for the secret value. Paste the complete PKCS#8 PEM, including
the `BEGIN PRIVATE KEY` and `END PRIVATE KEY` lines.

The optional transition identity is installed the same way:

```sh
npx wrangler secret put WEB_BOT_AUTH_TRANSITION_PRIVATE_KEY_PEM
```

The transition secret should normally be absent unless a controlled key
rotation is in progress.

## Deployment stages

The Worker intentionally has no production route in `wrangler.jsonc` while the
directory is being developed.

First deploy it to its `workers.dev` hostname:

```sh
npm run deploy
```

Verify the Worker there before changing `joshternet.org`.

Because `joshternet.org` is currently served directly by GitHub Pages and is
not proxied through Cloudflare, production routing requires a separate
infrastructure change. Cloudflare must first proxy the Joshternet origin while
GitHub Pages remains the website origin. After that change, route only:

```text
joshternet.org/.well-known/http-message-signatures-directory
```

to this Worker.

Do not move the rest of the Joshternet site into this Worker merely to publish
the Web Bot Auth directory.

## Verification

The repository includes a verifier that performs cryptographic validation of a
deployed directory.

Run it with:

```sh
npm run verify -- \
  https://joshternet.org/.well-known/http-message-signatures-directory
```

The verifier checks:

- HTTPS is used.
- HTTP status is `200`.
- `Content-Type` is exactly
  `application/http-message-signatures-directory+json`.
- `Content-Digest`, `Signature-Input`, and `Signature` are present.
- `Content-Digest` matches the exact response body.
- The body contains a non-empty JWKS `keys` array.
- Every key contains only `kty`, `crv`, and `x`.
- Every key is an Ed25519 public OKP JWK.
- No public key contains `d`.
- Every signature `keyid` matches the RFC 7638 thumbprint of its corresponding
  public JWK.
- Every signature uses `alg="ed25519"`.
- Every signature uses
  `tag="http-message-signatures-directory"`.
- Every signature covers `"@authority";req` and `"content-digest"`.
- Every signature verifies cryptographically against its corresponding
  published public key.
- Every signature contains a valid `created` and `expires` window.

The verifier works against the temporary `workers.dev` deployment as well as
the final production URL, provided the URL uses HTTPS.

For a second independent validation, Cloudflare's
`http-signature-directory` command-line validator can also be run against the
deployed endpoint before BotBase submission.

## Manual inspection

The raw deployed response can also be inspected with:

```sh
curl \
  --fail-with-body \
  --silent \
  --show-error \
  --dump-header - \
  https://joshternet.org/.well-known/http-message-signatures-directory
```

Manual inspection is useful for debugging, but the repository verifier should
be used for the actual cryptographic check.

## Key rotation

The directory supports an active identity and one transition identity.

During a rotation:

1. Install the new key as the transition secret.
2. Deploy and verify that both public keys and both signatures are valid.
3. Move JoshBot outbound signing to the new key.
4. Keep both keys published during the transition period.
5. Make the new key active.
6. Remove the old transition key only after the overlap period is complete.

The full production rotation policy and fail-closed crawler behavior are tracked
separately from this directory implementation.

## Failure behavior

The directory fails closed.

If no signing identity is configured, a key is malformed, duplicate active and
transition identities are configured, or signing cannot be completed, the
Worker returns `503` without a directory body or signature.

Requests to unrelated paths return `404`.

Methods other than `GET` on the directory path return `405`.
