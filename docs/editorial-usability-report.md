# Editorial usability rewrite — review report

Writing-only pass per the Editorial and Usability Plan. No commit, PR, or deploy was made as part of this work.

## 1. Pages and templates audited

**Hand-written:** `/`, `/join/`, `/implement/`, `/implement/validate/`, `/implement/platforms/`, all 11 platform recipes, `/implement/buttons/`, `/implement/connections/`, `/implement/explore/`, `/nominate/`, `/joshbot/`, `/specs/`, `/about/`, `/community/`, `/governance/`, `/network/`, `/activity/`, `/showcase/`, `/topics/`, `/connections/`, `/wander/`, `/search/`, `/privacy/`, `/security/`, `/terms/`, `/infrastructure/`, `/licensing/` (+ `LICENSING.md`), third-party licenses left as attribution inventory.

**Nav / includes:** `site-nav-links.html`, `site-nav-sections.html`, `implement_nav.yml`, new `declaration-*-ref.html` includes.

**Generated:** Topic stubs unchanged (no NLP pipeline edits). `_layouts/topic.html` copy audited (sites/articles first; evidence in `<details>`).

**Baseline:** `docs/editorial-baseline.md`.

## 2. What changed

| Area | Action |
| --- | --- |
| Join | Simplified to 3 core steps + optional next steps; participation-by-declaration corrected |
| Join nav | Promoted to top-level primary; removed from Implement secondary |
| Implement | Repositioned as developer reference; links beginners to Join |
| Validate / Nominate / Buttons | Registry vs validity clarified; buttons lead with preview/install; document embed `20261004` |
| Platforms | Shared includes; common section shape; unique platform material preserved |
| Home / About / Explore shells | Personality-first; less protocol lecture |
| JoshBot / Specs / Connections notes / Explore notes | Progressive disclosure |
| Policy | Plain-language overviews; substance retained |
| Topic NLP / button Worker Join face | Unchanged — tracked as follow-ups |

## 3. Before / after examples

**Join membership language**

- Before: “Completing the steps above alone is not membership success.”
- After: “Publishing a valid declaration establishes participation.” Optional steps for discovery/button/Network/IRC.

**About opening**

- Before: Institutional “open network and standards project…” charter tone.
- After: First-person needle-in-a-haystack founder story, then principles.

**Platform Astro**

- Before: Full identity JSON + 10-bullet checklist repeated.
- After: `{% include declaration-identity-ref.html %}` + `{% include declaration-verify-ref.html %}` with Astro-specific paths kept.

## 4. Technical accuracy issues found

1. **Button Worker face:** `Join the Joshternet` still means “not in public registry” in `workers/joshternet-button/src/button-state.js`. Docs now state that clearly. Changing the face/label needs separate approval (published behavior).
2. **Low-value topics** (`blue`, `data`, `add`, …): pipeline quality issue; use `_data/topic_denylist.json` / `NON_SUBJECT_UNIGRAMS` + `nlp:quality` in a dedicated PR—do not hand-delete generated stubs here.
3. Claims checked against declaration-validate RULES, JoshBot disclosure contracts, and button `EMBED_VERSION=20261004`.

## 5. Tests

| Check | Result |
| --- | --- |
| `npm run format:check` | Pass |
| `npm run test:coverage` | Pass (100% lines/branches/functions on gated scripts) |
| `npm run test:browser` | Pass (62) after Playwright Chromium install |
| `JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter` | Pass |
| `npm run nlp:quality` | Pass |
| `npm run test:site` | Pass (116) |
| `JEKYLL_ENV=production jekyll build` + `test:site` + `test:browser` | Pass (site 116, browser 62) |
| Full `npm run build` (network:sync → …) | Not used for final gate — sync dirties generated `_data`/posters; Jekyll-only rebuild used instead |

No commit / PR / deploy performed.

## 6. Human decisions remaining

- Approve button Worker label/artwork change for not-listed sites?
- Approve a topic-quality denylist PR?
- Approve commit / PR / deploy of this editorial branch?
