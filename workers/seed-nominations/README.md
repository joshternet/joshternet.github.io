# Seed nominations Worker

Public intake for `/nominate/`. Site owners ask JoshBot to consider their
website as a discovery seed. This Worker stores nominations only; it does not
fetch or resolve the nominated host. JoshBot performs authoritative public
validation later.

## Security and abuse controls

This endpoint is on the open web. Controls:

- **Allowlisted browser `Origin` required** (missing or mismatched Origin is
  denied)
- Production `ALLOWED_ORIGIN` is `https://joshternet.org`
- Cloudflare Turnstile required via Worker secret `TURNSTILE_SECRET_KEY`
  (never commit the secret value)
- Turnstile hostname/action expectations from Wrangler vars:
  `TURNSTILE_EXPECTED_HOSTNAME=joshternet.org`,
  `TURNSTILE_EXPECTED_ACTION=seed-nomination`
- **Rate limits**: 60 submissions / minute on the route, 5 / minute / nominated
  origin
- Does **not** fetch or DNS-resolve the nominated website
- Rejects credentials in URLs, IP literals, and non-public host suffixes
  (`.localhost`, `.local`, `.lan`, `.internal`)
- Request body capped at 4 KiB
- Submissions can be disabled with `SUBMISSIONS_ENABLED` other than `true`
- Site CSP `connect-src` allows only this API from the nominate page

## Endpoints

### `POST /v1/seed-nominations`

JSON body:

```json
{
  "url": "https://example.invalid",
  "owner_attestation": true,
  "turnstile_token": "…"
}
```

Success responses:

- `202` with `status: "accepted"` when a new nomination row is stored
- `200` with `status: "already_nominated"` when that origin was already stored

### `OPTIONS /v1/seed-nominations`

CORS preflight for the allowlisted site origin.

### `GET /health`

Liveness JSON:

```json
{
  "ok": true,
  "service": "joshternet-seed-nominations"
}
```

## Failure behavior

| Status | When |
| --- | --- |
| `403` | Browser `Origin` missing or not allowlisted |
| `400` | Invalid URL, missing owner attestation, or Turnstile failure |
| `429` | Route or per-origin rate limit (`Retry-After: 60`) |
| `503` | Submissions disabled, or Turnstile verification unavailable |
| `404` | Unknown path |

## Migrations

D1 schema lives in `migrations/` and is wired through the `DB` binding in
`wrangler.jsonc` (`database_name`: `joshternet-seed-nominations`).

Apply pending migrations locally:

```bash
npx wrangler d1 migrations apply joshternet-seed-nominations --local
```

Apply pending migrations to the remote database used by the deployed Worker:

```bash
npx wrangler d1 migrations apply joshternet-seed-nominations --remote
```

## Local development

```bash
npm ci
npx wrangler d1 migrations apply joshternet-seed-nominations --local
npm test
npm run check
npm run dev
```

From the site root, `npm run dev` starts Jekyll with LiveReload and this Worker
together for local preview only. Do not treat local bind addresses as the
production identity.

## Deploy

```bash
npm test
npm run check
npx wrangler d1 migrations apply joshternet-seed-nominations --remote
npm run deploy
```

Confirm production secrets and vars:

- `TURNSTILE_SECRET_KEY` is set as a Worker secret
- `ALLOWED_ORIGIN` is `https://joshternet.org`
- `SUBMISSIONS_ENABLED` is `true` when intake should be open

## Production smoke

Safe always-on check:

```bash
curl -sS https://joshternet-seed-nominations.joshternet.workers.dev/health
```

Expect JSON with `"ok": true` and `"service": "joshternet-seed-nominations"`.

For a full browser path (Turnstile + CORS), use
https://joshternet.org/nominate/ from the production site origin. Only submit a
nomination when you intend to create or refresh a stored row.
