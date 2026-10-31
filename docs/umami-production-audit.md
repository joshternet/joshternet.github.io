# Umami production audit (2026-10-31)

Brief Phase 0 report for joshternet.org. Dashboard confirmation of events still
requires an authenticated Umami Cloud session.

## Verified from production browser / HTTP

| Check | Result |
| --- | --- |
| Umami script loads | `https://cloud.umami.is/script.js` present and HTTP 200 |
| Website ID in HTML | `809e87e4-2ed7-4fac-a144-10d194eb44cd` |
| CSP | `script-src` includes `https://cloud.umami.is`; `connect-src` includes `https://gateway.umami.is` |
| Collection | `POST https://gateway.umami.is/api/send` returns 200 (`{"beep":"boop"}`) on pageview and custom event |
| Client API | `window.umami.track` available; `joshternetTrack` available |
| `umami-events.js` | Served same-origin; no extra CSP origins required |
| Internal navigation | Full document loads (not SPA); one automatic pageview per destination; `internal-link-click` is a separate custom event |

## Failures corrected in code

| Issue | Fix |
| --- | --- |
| `connections-select` fired on `?site=` deep-link init | Track only from deliberate graph/list/pointer handlers |
| Join CTAs would double-count with generic link clicks | `data-joshternet-skip-link-track` plus dedicated join events |

## Authenticated dashboard (human gate)

Confirm in Umami Cloud for website `809e87e4-2ed7-4fac-a144-10d194eb44cd`:

- Recent pageviews after a non-blocked visit to https://joshternet.org/
- Custom events after Join interactions and a Connections node click
- No payloads containing search text, nomination URLs, or form fields

## Remaining limitations

- Ad blockers and privacy extensions prevent `/api/send` in the visitor’s browser.
- `data-domains="joshternet.org,www.joshternet.org"` skips localhost and preview hosts.
- Dashboard timezone / date filters can make a healthy property look empty.
- If the Cloud UI points at a different website ID than the HTML embed, counts will not match.
