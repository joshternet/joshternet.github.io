# Platform guides consistency and verification audit

Audit date: 2026-11-03. Fiction examples use `joshua.example` only.

Scope: `/implement/platforms/` hub, `_data/platforms_nav.yml`, and all 11 platform recipes. No production registry/crawler datasets were modified for this audit.

## Protocol checklist (shared)

A valid version 1 declaration:

- Is published at `/.well-known/josh` on the participating origin (no `.json`, no trailing slash).
- Is a JSON object with no duplicate member names.
- Includes `version` as the JSON integer token `1` (not `"1"`, `1.0`, or `1e0`).
- May omit `josh` (Undeclared), or set `josh` to Boolean `true`/`false`.
- Must be publicly retrievable without authentication or client-side JavaScript.
- Must not rely on a cross-origin redirect as the declaration for the requested origin.

Recommended: HTTP 200 with `Content-Type: application/json`. An unexpected Content-Type alone does not invalidate otherwise valid declaration JSON under RFC-JOSH-0002.

Withdrawal: deliberate `404`/`410` indicates no declaration; DNS/TLS/timeouts/5xx do not.

## Evidence levels

| Level | Meaning |
| --- | --- |
| Documentation review | Specs/platform docs and recipe prose inspected |
| Configuration review | Example config checked against documented APIs |
| Build verified | Platform build completed successfully (where applicable) |
| Output verified | Generated declaration file exists and matches expected path |
| Local HTTP verified | Local server returned the expected resource |
| Public HTTP verified | Deployed public origin returned the expected resource |
| Hosting verified | Named hosting provider behavior tested |
| Lifecycle verified | Update and/or removal paths tested |

These describe evidence scope, not a ranking or badge scheme.

## Findings register

| ID | Platform | Section | Issue | Severity | Evidence | Correction | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | Cloudflare Worker | tests | No peer `cloudflare-worker-platform.test.mjs` | Important | Only example/unit coverage vs other recipes | Add platform contract test | `node --test test/site/cloudflare-worker-platform.test.mjs` | Corrected |
| F2 | WordPress | Endpoint headers | Missing “unexpected CT ≠ invalid JSON” caveat | Important | WP docs plugin CT only | Add shared validity sentence | Grep/wording review | Corrected |
| F3 | Ghost | HTTP / CT | Prefer CT without explicit invalidation caveat | Important | Ghost guide | Align with shared CT wording | Grep/wording review | Corrected |
| F4 | Cloudflare Worker | Response headers | Sets CT as expected; no invalidation caveat for intercepted/proxy cases | Important | CF Worker guide | Note hosts/proxies may alter CT; body validity separate | Grep/wording review | Corrected |
| F5 | Cloudflare Worker | Identity | Env table without undeclared-first JSON + Affirmed/Declined headings | Editorial | Pattern differs from other 10 | Add undeclared-first JSON examples beside env table | Platform test | Corrected |
| F6 | All | Tested dates | Dates differ (2026-10-06 / 10-10 / 11-03) | Editorial | Historical evidence scopes | Document in matrix; do not normalize | Audit matrix | Closed (by design) |
| F7 | All | Fiction hosts | Must stay on `joshua.example` | Blocking if violated | Workspace rule | Confirm no `example.invalid` / `harbor.example` | Platform tests | Closed (already clean) |
| F8 | Platforms hub | Index | Check claims vs recipes | Editorial | `implement/platforms.md` | No Blocking mismatch found; leave hub | Manual read | Closed |

No Blocking findings required protocol-breaking rewrites. Guides remain TechArticle with shared includes.

## Cross-platform evidence matrix (2026-11-03)

Public HTTP and named hosting columns are **Not verified** in this repository unless otherwise noted. Do not read “Documentation review” as a live deploy.

| Platform | Verified date (page) | Primary evidence on page | Public HTTP | Notes |
| --- | --- | --- | --- | --- |
| Cloudflare Worker | 2026-11-03 | Docs + Worker unit tests / code review | Not verified | Route recipe; fail-closed identity |
| Astro | 2026-10-06 | Docs/recipe (Astro 5.x) | Not verified | `public/` → `dist/` |
| Eleventy | 2026-10-06 | Docs/recipe | Not verified | Passthrough copy |
| Ghost | 2026-10-06 | Docs/recipe; Ghost(Pro) not claimed | Not verified | Nginx exact `location =` |
| Hugo | 2026-10-06 | Docs/recipe | Not verified | `static/` → `public/` |
| Jekyll | 2026-10-06 | Docs + this repo `_config.yml` pattern | Not verified | `include` for `.well-known` |
| Next.js | 2026-10-06 | Docs/recipe (SK15 static export claim) | Not verified | Server vs export |
| Nuxt | 2026-10-06 | Docs/recipe (Nuxt 4 generate) | Not verified | Nitro vs generate |
| Quartz | 2026-10-10 | Quartz 5.0.0 source review | Not verified | Post-build copy |
| SvelteKit | 2026-10-06 | Docs/recipe (SK2 + adapter-static); SK3 not live-tested | Not verified | Adapter differences |
| WordPress | 2026-10-06 | Plugin 0.1.1 / WP.org listing review | Not verified | WP.com routing not claimed |

## Checklist pass (summary)

Processed order: CF Worker → Astro → Eleventy → Ghost → Hugo → Jekyll → Next.js → Nuxt → Quartz → SvelteKit → WordPress.

| Platform | Undeclared-first + Affirmed/Declined | Shared includes | CT validity caveat | `joshua.example` | Peer platform test |
| --- | --- | --- | --- | --- | --- |
| Cloudflare Worker | Yes (after F5) | Yes | Yes (after F4) | Yes | Yes (after F1) |
| Astro | Yes | Yes | Yes | Yes | Yes |
| Eleventy | Yes | Yes | Yes | Yes | Yes |
| Ghost | Yes | Yes | Yes (after F3) | Yes | Yes |
| Hugo | Yes | Yes | Yes | Yes | Yes |
| Jekyll | Yes | Yes | Yes | Yes | Yes |
| Next.js | Yes | Yes | Yes | Yes | Yes |
| Nuxt | Yes | Yes | Yes | Yes | Yes |
| Quartz | Yes | Yes | Yes | Yes | Yes |
| SvelteKit | Yes | Yes | Yes | Yes | Yes |
| WordPress | Yes | Yes | Yes (after F2) | Yes | Yes |

## Explicit non-goals (this audit)

- Live Netlify/Cloudflare/Vercel/GitHub Pages/WordPress.com deploys for every recipe.
- Unifying Verified dates to one calendar day.
- Rewriting `/implement/validate/`.
- Adding a 12th platform or JoshBot status banners.
