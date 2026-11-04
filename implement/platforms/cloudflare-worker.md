---
layout: default
title: Publish /.well-known/josh with a Cloudflare Worker
description: >-
  Serve a Joshternet /.well-known/josh declaration from a Cloudflare Worker
  Route on a proxied hostname—without replacing your origin or changing your
  app build.
keywords: >-
  Cloudflare Worker, /.well-known/josh, Joshternet declaration, Worker route,
  Wrangler
seo:
  type: TechArticle
  name: Cloudflare Worker
permalink: /implement/platforms/cloudflare-worker/
nav_title: Cloudflare Worker
---

# Publish with a Cloudflare Worker

A Cloudflare Worker can return JSON at one exact path on a website that Cloudflare already proxies. That lets you publish `/.well-known/josh` without changing the underlying application build.

The Worker runs at Cloudflare’s edge for requests that match its Route. Joshternet does not operate this Worker for members—you deploy and control it in your own Cloudflare account.

Using Cloudflare is optional. You can also publish the declaration with ordinary static files or other server configuration. See the [Platforms](/implement/platforms/) directory for alternatives.

## When should you use a Worker?

Use this approach when:

- The website already uses a Cloudflare-proxied hostname.
- The existing application cannot easily serve an extensionless JSON file.
- You prefer to manage the declaration independently of the website’s build.
- An edge Route is already part of the site’s infrastructure.

A static file is usually simpler when your framework and host can already publish the declaration correctly. Do not migrate DNS or hosting to Cloudflare merely to join Joshternet.

## What you need

- A Cloudflare account with permission to deploy and configure Workers.
- A domain or subdomain in an active Cloudflare zone.
- A **proxied** DNS record for the hostname that will use a Worker Route (orange-cloud proxy, not DNS-only).
- An origin that already receives traffic through that hostname.
- A valid Joshternet declaration (the Worker builds it from `JOSH_IDENTITY`).

Worker Routes only run for traffic that reaches Cloudflare through that zone. Confirm the hostname is already proxied before attaching a Route.

## Choose a Route, not a replacement origin

| Mechanism | Behavior | Appropriate here? |
| --- | --- | --- |
| Worker Route | Invokes a Worker for a matching URL pattern in front of the existing origin | Yes |
| Worker Custom Domain | Connects an entire hostname to a Worker as its origin | Usually no |
| `workers.dev` | Cloudflare-hosted Worker endpoint | Useful for development, not the participating domain’s declaration |

A Custom Domain applies to an entire hostname rather than only the declaration path. Using one unnecessarily can replace how the rest of the site is served.

For this recipe, attach a **Worker Route**. See Cloudflare’s [routing overview](https://developers.cloudflare.com/workers/configuration/routing/) and [Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/).

## Keep the declaration URL exact

The required resource is:

```text
https://joshua.example/.well-known/josh
```

The path begins with `/.well-known/`, uses the filename `josh`, has no `.json` extension, has no trailing slash, and sits at the origin root. [RFC-JOSH-0002](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md) defines participation for the origin that serves that resource.

A declaration on a `workers.dev` hostname does not declare participation for an unrelated custom domain. A file at `/blog/.well-known/josh` does not replace the required root-level resource.

{% include declaration-identity-ref.html %}

## Create the Worker

Save the module as `src/index.js`, or paste it into the Cloudflare dashboard Worker editor.

```js
{% include snippets/cloudflare-worker.js %}
```

The Worker checks the pathname so an accidentally broader Route still cannot serve declaration JSON for unrelated paths. On the declaration path it answers `GET` and `HEAD`, rejects other methods with `405` and `Allow: GET, HEAD`, and sets:

- `Content-Type: application/json; charset=utf-8` (JSON media type expected by RFC-JOSH-0002)
- `Cache-Control: public, max-age=300` (modest public cache; clients may see updates after this lifetime)
- `X-Content-Type-Options: nosniff` (defensive; not required by the Joshternet RFCs)

Unrelated paths call `fetch(request)` so the existing origin keeps serving them when this Worker is invoked.

Caches, zone transforms, or another edge product in front of the Worker can still change the public Content-Type. An unexpected Content-Type alone does not invalidate otherwise valid declaration JSON under RFC-JOSH-0002.

## Configure identity

The public JSON is what RFC-JOSH-0001 and RFC-JOSH-0002 define. This Worker builds that JSON from the `JOSH_IDENTITY` environment variable—those strings are an implementation convenience, not protocol fields.

The minimum valid version 1 declaration is:

```json
{
  "version": 1
}
```

That object is Undeclared: the origin publishes a declaration without setting Boolean `josh`.

### Affirmed

```json
{
  "version": 1,
  "josh": true
}
```

### Declined

```json
{
  "version": 1,
  "josh": false
}
```

| `JOSH_IDENTITY` | Public declaration |
| --- | --- |
| `affirmed` | `{ "version": 1, "josh": true }` |
| `declined` | `{ "version": 1, "josh": false }` |
| `undeclared` | `{ "version": 1 }` |
| Missing or empty | Same as undeclared (documented default) |

Matching is case-insensitive after trimming. An unknown nonempty value does **not** silently become undeclared: the Worker returns `500` with a short diagnostic and `Cache-Control: no-store`. That temporary configuration error is not evidence that you intentionally withdrew from Joshternet.

Never infer identity from a domain name or site title.

## Deploy using the Cloudflare dashboard

Deploying the Worker script and attaching a production Route are separate steps.

1. In Workers & Pages, create or open a Worker.
2. Paste the module above (module syntax).
3. Add a plain-text variable `JOSH_IDENTITY` set to `affirmed`, `declined`, or `undeclared`.
4. Deploy the Worker.
5. Open Settings → Domains & Routes (or the current Routes UI) and add a Route for only `joshua.example/.well-known/josh` (use your real hostname) pointing at this Worker.
6. Confirm the Route is active, then test the public URL and ordinary site pages.

Dashboard labels change over time; follow current Cloudflare Workers documentation if a menu name differs. Deploying the script alone does not attach it to your domain.

## Deploy using Wrangler

Prefer one primary configuration source. If Wrangler declares routes and vars, later `wrangler deploy` may override dashboard edits to those same settings.

1. Create a project with `src/index.js` containing the module above.
2. Add `wrangler.toml` (shown below). Cloudflare currently recommends `wrangler.jsonc` for new projects; TOML remains supported—this guide keeps one complete TOML walkthrough.
3. Authenticate with Wrangler (`wrangler login` or an appropriately scoped API token stored outside the repo).
4. Run `wrangler deploy`.
5. Confirm the Route appears for your zone, then verify the public declaration.

### Wrangler config

```toml
name = "josh-declaration"
main = "src/index.js"
compatibility_date = "2024-09-23"
workers_dev = true

[vars]
# affirmed | declined | undeclared
JOSH_IDENTITY = "undeclared"

# Narrow Route in front of the existing origin (requires proxied DNS).
# Replace joshua.example with your hostname and apex zone name.
[[routes]]
pattern = "joshua.example/.well-known/josh"
zone_name = "joshua.example"
```

Set `workers_dev = false` if you do not want a `*.workers.dev` preview URL. Do not use `joshua.example/*` or `joshua.example/.well-known/*` merely to publish this resource. See [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Make sure the Worker runs only where intended

Cloudflare route patterns match hostnames and paths. They do not take query-string patterns. An exact Route without a trailing wildcard is appropriate because the Joshternet declaration defines no query parameters.

When multiple Routes match, Cloudflare uses the most specific match. Review existing application Workers, authentication Workers, redirect Workers, Cloudflare Pages routes, and other `.well-known` resources before adding another Route.

The pathname check in the Worker is additional protection if someone later broadens the Route. Pass-through via `fetch(request)` is not required for an exact Route that never invokes the Worker for other paths—but it keeps accidental broadening from returning declaration JSON everywhere.

## Don’t interrupt your existing website

Before activation, list Routes and Custom Domains already bound to the hostname. A more-specific Route can take precedence over a broader one. Changing authentication, caching, or request-transformation Workers can affect unrelated traffic.

Do not replace an existing Custom Domain Worker origin with this recipe. Do not assume a new Route is safe on every Cloudflare-managed site without reviewing precedence and security rules.

## DNS requirements

A Worker Route runs only when the request reaches Cloudflare for that zone. The hostname needs a DNS record that is **proxied** through Cloudflare. DNS-only (grey cloud) records do not invoke Worker Routes.

If the site already works through a proxied hostname, verify that configuration rather than recreating DNS. See Cloudflare’s DNS and [Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/) documentation.

{% include declaration-origin-root-note.html %}

Configure the Worker for the **origin hostname**, not the application’s internal base path. The declaration stays at `https://joshua.example/.well-known/josh` even when the CMS lives under `/blog/`.

## Test the Worker before deployment

Exercise the module locally with Wrangler’s supported local tools or by reviewing the automated tests in this repository. Cover affirmed, declined, undeclared, missing, and invalid `JOSH_IDENTITY`; `GET`, `HEAD`, and unsupported methods; the exact pathname; an unrelated path; and response headers.

Local execution does not prove that production DNS, Routes, Access, or WAF rules are correct.

## Verify the deployment

After the Route is active:

```sh
curl -i https://joshua.example/.well-known/josh
```

Confirm HTTP status, final URL, content type, JSON body, integer `version` `1`, and Boolean `josh` when present. Then use the [declaration checker](/implement/validate/).

{% include declaration-verify-ref.html %}

Also load representative site URLs (homepage, an article, static assets, `robots.txt`, other well-known resources) to confirm they still behave as before. Compare with pre-activation behavior when you can.

`www` and apex are different origins. Attaching a Route to one does not declare participation for the other. Redirects between origins are not a substitute for publishing a declaration on each origin you intend to declare.

## What happens when you change your identity setting?

Update `JOSH_IDENTITY` in the dashboard or Wrangler config, deploy or save as required, then re-check the public URL. Cached responses may remain visible for up to the `max-age` and any intermediate caches. Revalidation is separate from deployment completion. Prefer confirming the live endpoint over broad CDN purges unless you have evidence of a stuck cache.

## Security considerations

The declaration must remain publicly readable without authentication. Keep the Route narrowly scoped. Do not put secrets in the JSON body. This Worker has no database, KV, Durable Objects, or outbound calls to Joshternet.

`JOSH_IDENTITY` is a public preference, not a secret—but Cloudflare API tokens and Wrangler credentials must stay out of the repository and examples.

### Cloudflare Access, WAF, and related controls

If Cloudflare Access, WAF, bot management, redirect rules, or custom security rules protect the hostname, they can block or challenge clients before the Worker runs. Prefer scoped exceptions for `/.well-known/josh` after reviewing existing policy. Do not disable sitewide security as a default troubleshooting step.

## Troubleshooting

| Problem | Likely cause |
| --- | --- |
| 404 at declaration URL | Route not attached or not matching |
| Homepage HTML returned | Request reached origin fallback |
| JSON on unrelated paths | Route too broad or pathname check wrong |
| Worker never executes | DNS not proxied or Route inactive |
| Wrong identity | Variable or deployment mismatch |
| Invalid identity silently omitted | Stale Worker without fail-closed behavior—redeploy this module |
| 403 | Access, WAF, or authorization policy |
| 405 for GET | Incorrect method handling |
| Wrong content type | Unexpected handler or origin response |
| Different behavior on `www` | Route on another hostname |
| Works on `workers.dev` only | Production Route missing |
| Works locally, fails publicly | Deployment, DNS, or edge configuration |
| Old identity returned | Cache or stale deployment |
| Other pages break | Overbroad Route or precedence conflict |

Inspect with `curl -i`, the declaration checker, and the Cloudflare Routes UI. A 403 or challenge is not the same as malformed JSON.

## Remove the declaration without breaking the site

{% capture stop_steps %}
1. Identify the Route that serves `/.well-known/josh`.
2. Disable or remove that Route (leave unrelated Workers alone).
3. Confirm ordinary site pages still work.
4. Request `https://joshua.example/.well-known/josh` again—removing the Route may reveal a file your origin already serves, so check the live response.
5. Delete or unpublish the Worker only if nothing else uses it.
{% endcapture %}
{% include declaration-stop-publishing.html stop_steps=stop_steps %}

## Tested

- Platform: Cloudflare Worker module example for `/.well-known/josh` (Route-oriented recipe)
- Verified: 2026-11-03
- Evidence: code review and automated unit tests against the embedded Worker module in this repository (not a live Cloudflare account deployment)
- Protocol: RFC-JOSH-0002 version 1

## References

- [RFC-JOSH-0002: `/.well-known/josh`](https://github.com/joshternet/spec/blob/main/rfcs/0002-well-known-josh.md)
- [RFC-JOSH-0001: Josh Identity](https://github.com/joshternet/spec/blob/main/rfcs/0001-josh-identity.md)
- [Implement](/implement/), [Platforms](/implement/platforms/), [Join](/join/), [declaration checker](/implement/validate/)
- [Workers routing](https://developers.cloudflare.com/workers/configuration/routing/), [Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/), [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch/), [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)

[implement]: /implement/
