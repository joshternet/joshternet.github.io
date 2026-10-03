# Declaration check Worker

Public helper for `/implement/validate/`. It reads only a target origin’s
`/.well-known/josh` so the browser page can classify live declarations when
publishers do not send CORS headers.

## Security model

This endpoint is on the open web. Controls:

- **Allowlisted browser `Origin` required** (missing Origin is denied)
- Production allowlist is `https://joshternet.org` and `https://www.joshternet.org`
- Local Wrangler overrides via `.dev.vars` (gitignored)
- **Rate limits**: 30 checks / minute / client IP, 20 / minute / target origin
- Fetches **only** `/.well-known/josh` (no query/fragment)
- Rejects credentials, IP literals, and private host suffixes
- **No automatic redirect following**; one same-origin hop to the exact path
  is allowed, then further redirects fail closed
- Response body capped at 64 KiB; fetch timeout 10s
- Site CSP `connect-src` allows only this API

## Endpoints

- `GET /v1/declaration-check?origin=https://example.invalid`
- `OPTIONS /v1/declaration-check`

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # if present
npm run dev                      # wrangler on :8789
# or
npm run dev:local                # Python stand-in on :8789
```

Jekyll development points the validate page at
`http://127.0.0.1:8789/v1/declaration-check`.

## Deploy

```bash
npm test
npm run deploy
```

Confirm production `ALLOWED_ORIGINS` includes `https://joshternet.org` and
`https://www.joshternet.org`, then smoke-test from
https://joshternet.org/implement/validate/ against a known participant such as
`https://joshuamorris.info`.
