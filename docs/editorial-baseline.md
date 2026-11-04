# Editorial baseline (before rewrite)

Captured for the Joshternet Editorial and Usability Plan. Word counts are approximate (`wc -w` on source Markdown). Built HTML route count from existing `_site/` at baseline time: ~284 HTML files (hand-written pages + topic stubs + shells).

## Canonical owners

| Concept | Canonical location |
| --- | --- |
| Beginner participation | `/join/` → `join.md` |
| Protocol / edge cases / checklist | `/implement/` → `implement.md` |
| Declaration checker UX | `/implement/validate/` |
| Platform how-tos | `/implement/platforms/<slug>/` |
| Shared identity / origin-root / verify pointers | `_includes/declaration-*.html` (added in rewrite) |
| RFCs | external `joshternet/spec`; hub `specs.md` |
| JoshBot claims | `joshbot.md` + joshbot repo |
| Button public contract | `implement/buttons.md` vs `workers/joshternet-button/` (`EMBED_VERSION=20261004`) |

## Priority page lengths (before)

| Page | Words |
| --- | ---: |
| join.md | 1119 |
| implement.md | 1141 (editorial rewrite: 1464) |
| implement/validate.md | 404 (editorial rewrite: 660) |
| implement/platforms.md | (hub; editorial rewrite: 1760) |
| nominate.md | 381 (editorial rewrite: 392) |
| implement/buttons.md | 469 (editorial rewrite: 814) |
| implement/connections.md | (editorial rewrite: 1944) |
| platforms/astro | 2732 |
| platforms/cloudflare-worker | 2063 |
| platforms/eleventy | 2409 |
| platforms/ghost | 2582 |
| platforms/hugo | 2492 |
| platforms/jekyll | 2638 |
| platforms/nextjs | 3177 |
| platforms/nuxt | 2825 |
| platforms/quartz | 2596 |
| platforms/sveltekit | 2667 |
| platforms/wordpress | 2481 |
| index.md | 706 |
| network.md | 1057 |
| about.md | 997 |
| activity.md | 391 |
| showcase.md | 479 |
| topics/index.md | 468 |
| connections.md | 2379 |
| wander.md | 193 |
| search.md | 265 |
| community.md | 2298 (editorial rewrite: 2577) |
| governance.md | 1092 (editorial rewrite: 1299) |
| joshbot.md | 979 (editorial rewrite: 1261) |
| specs.md | 223 (editorial rewrite: 663) |

## Duplication map

- Affirmed / Declined / Undeclared JSON: `join.md`, `implement.md`, every platform recipe, buttons, home “How it works”
- Participation vs discovery vs registry: `join.md` step 6, `implement.md`, `validate.md`, `nominate.md`, `declaration-continuity.js`
- Protocol checklist + curl: `implement.md`, every platform recipe
- Origin-root warning: every platform recipe

## Misleading wording inventory

1. `join.md`: “Completing the steps above alone is not membership success” — frames Network listing as membership; contradicts RFC-JOSH-0002 participation-by-declaration. Locked by `test/site/join.test.mjs`.
2. Button face “Join the Joshternet” for not-listed origins (`workers/joshternet-button/src/button-state.js`) — behavior follow-up; docs must not call this failure-to-join.
3. Join nested under Implement secondary nav — hard to find as participation entry point.

## Claim verification sources

- Participation: `assets/js/declaration-validate.js` RULES + RFC-JOSH-0002
- JoshBot: `joshbot.md` + `test/site/joshbot-disclosure.test.mjs`
- Buttons: `workers/joshternet-button/src/index.js` `EMBED_VERSION = "20261004"`

## Separate technical follow-ups (not this rewrite)

- Button Worker Join-face label for not-listed sites
- Topic NLP quality (`blue`, `data`, `add`, …) via denylist / `NON_SUBJECT_UNIGRAMS`
