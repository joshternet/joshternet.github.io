# Showcase + Happening — Phase 8 Handoff

**Publication status:** local verification complete; **no commits, pushes, PRs, merges, or deploys.**

Naming: keep **Showcase** (`/showcase/`). Do not rename to Made. `_data/made.json` remains a stable alias of showcase data.

---

## 1. Participant research inventory

Source: `docs/research/creative-work-audit.md` (2026-10-31) + current `_data/network.json`.

| Origin | Creative signals | Events | Notes |
|---|---|---|---|
| joshbeard.com | Photography galleries `/photos/` | None observed | Index extraction present; album cards depend on crawl posters |
| joshghent.com | Products / OSS shelves | None observed | Homepage harvest + creative indexes |
| joshmuller.ca | Guides / tools / articles | None observed | Writing-shaped URLs stay out of Showcase |
| joshtronic.com | Games, software, music | None observed | `/games/`, `/sounds/` indexes |
| joshua.seigler.net | Software / watchfaces / tools | None observed | Feed cross-origin noise filtered |
| joshuamorris.info | Experiments / toys | None observed | Currently dominant Showcase set |
| www.joshcanhelp.com | Technical projects | None observed | |
| www.joshuabaker.com | Portfolio table + case studies | None observed | Portfolio `source_kind` excluded from Showcase |
| joshuakim.studio | 8 works (fixtures) | Hot Chocolate = past hackathon | Declaration confirmed; **not in `network.json` yet** — fixtures only until registry lists the origin |
| joshternet.org | Hub | — | Excluded from Showcase/Happening content |

---

## 2. Before / after coverage matrix

| Check | Expected | Local result |
|---|---|---|
| Registry eligibility | Only verified participants | Pass — Showcase items all have member `site_origin` / `site_title`; hub URLs absent |
| Site coverage | Every independent origin audited | Pass — audit doc covers all current independents + Kim |
| Creative works | Qualifying works evaluated | Partial — fixtures + extractors cover mixed disciplines; **live `_data/showcase.json` currently 10 project cards (joshuamorris.info experiments only)** after eligibility gates |
| Regressions | Articles/feeds/portfolios intact | Pass — `npm test`, `nlp:validate` |
| Mixed disciplines | Software, art, music, photo, guides | Pass in fixtures/tests; live Showcase sparse until next full crawl with creative retention |
| Dedupe | One work ≠ many entries | Pass — identity/`url:` dedupe in extractors; views sort stable |
| Attribution | Member credit + outbound; no hub authorship | Pass — every Showcase card has maker; copy states Joshternet does not claim authorship |
| Events | Only verified future as upcoming | Pass — Happening empty locally; Hot Chocolate fixture excluded; mention/cancelled filtered |
| Multilingual | Original language retained | Pass — RTL fixture + `dirForLanguage` + `lang`/`dir` on cards |
| Fairness | Smaller portfolios remain visible | Pass — no global Showcase max; fair home rotation in views |

---

## 3. Kim fixture results

Offline fixtures under `test/fixtures/creative/joshuakim-studio/` exercise eight works (Order Pipeline Toolkit, SomaSpace, Hot Chocolate, Prism Catch, ChewChat, KindBite, VAP, Graphic Design). Past Hot Chocolate hackathon fixture under `test/fixtures/events/` must not enter Happening — covered by `test/nlp/events.test.mjs`. Production extractors have **no Kim domain special-cases**. Kim remains fixtures-only until the origin is in the JoshBot registry / `network.json`.

---

## 4. Creative + event classification tests

- `test/nlp/creative.test.mjs` — Schema types, RTL, homepage links, OG, member fixtures  
- `test/nlp/events.test.mjs` — Schema/mf2 collect, horizon, mention/cancelled skip, Hot Chocolate past exclusion  
- `test/views/showcase.test.mjs` — kinds, `dirForLanguage`, credit labels  
- `test/network/connections.test.mjs` — credit edges + credits-page / event / portfolio source pages  
- `test/site/showcase.test.mjs`, `test/site/events.test.mjs`, `test/site/topics-and-nav.test.mjs`

---

## 5. Local command log

| Command | Result |
|---|---|
| `npm test` | **PASS** |
| `npm run format:check` | **PASS** (after Prettier on `activity-card.html`) |
| `npm run test:site` | **PASS** |
| `npm run views:build` | **PASS** |
| `npm run nlp:validate` | **PASS** |
| `npm run test:coverage` | **PASS** (100% lines/branches/funcs on included scripts) |
| `npm run build` | **FAIL (expected in sandbox)** — `network:sync` needs network (`ENOTFOUND raw.githubusercontent.com`); not used for this handoff |
| `JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter` | **PASS** |
| Smoke `_site/showcase/index.html` + `_site/events/index.html` | **PASS** — Showcase credits makers; Events empty-state; nav Happening present on homepage |
| `nlp:sync` / live crawl | **Not re-run** — plan: do not commit regenerated network datasets; local datasets already on disk |

---

## 6. Local preview notes

- `/showcase/` — “Creative work made by participants…”; 10 experiment project cards attributed to Joshua Morris; outbound hit links; no embeds/autoplay.  
- `/events/` — “Happening on the Joshternet”; empty calendar copy (no fabricated events); ICS link only when items exist (currently omitted).  
- Homepage — Happening strip omitted when empty; Showcase strip present; Network nav includes Showcase + Happening.  
- Screenshots: not captured in this agent run; HTML smoke above stands in.

---

## 7. Attribution checklist

- [x] Member/creator credited on every Showcase card (`showcase-card__maker`)  
- [x] Outbound to publisher work URL (covering hit + `outbound-href`)  
- [x] No Joshternet authorship/ownership language on cards  
- [x] Showcase page copy: does not claim hub authorship  
- [x] Happening cards credit `site_title` via `activity-card` when items exist  
- [x] Credit connection edges require evidence (`u-credit` / rel / keyword on allowed pages)  
- [x] Hub content URLs excluded from Showcase/Happening filters  

---

## 8. Gaps / ambiguous works

1. **Live Showcase density:** Current on-disk content yields only joshuamorris experiment projects after gates; photography/games/music need a successful production crawl (`nlp:sync`) with creative-page retention — out of scope for this local handoff (no dataset commit).  
2. **joshuakim.studio** still absent from `network.json` — fixtures prove extraction; live Made/Happening awaits registry.  
3. **No upcoming member events** in current content — Happening correctly empty; ICS not generated until events exist.  
4. Audit improvements (Baker visibleCell, Beard individual photos as albums-only policy, etc.) remain documented in `creative-work-audit.md`; album-only photography is intentional product policy.

---

## 9. Perf / a11y / rights

- Previews by reference (local posters under `/assets/activity/posters/` when materialized); no in-hub media players or autoplay.  
- Cards expose `lang` / `dir` for RTL; titles use `dir` from `dirForLanguage` or `auto`.  
- Keyboard: Showcase filter buttons with `aria-pressed`; outbound links open publisher sites.  
- Rights: discovery + outbound only; no republish of member photos/music/video.

---

## 10. Files changed (this implementation pass)

```
CHANGELOG.md
_data/network_nav.yml
_includes/activity-card.html
_includes/home-happening.html
_includes/home-showcase.html
_includes/showcase-card.html
assets/activity/atom.xml          # views:build side effect
events.md
scripts/nlp/events.mjs
scripts/nlp/sync.mjs              # wire collectEvents
scripts/views/lib.mjs             # mention/cancelled Happening filters
showcase.md
test/nlp/events.test.mjs
test/site/events.test.mjs         # new
test/site/topics-and-nav.test.mjs
docs/research/showcase-happening-handoff.md
```

Prior phases already landed fixtures, `events.mjs`, Happening projection, credit edges, Kim fixtures, Showcase eligibility, and `made.json` alias.

---

## 11. Expectation statement

**Local results meet the plan’s Phase 5–8 expectations for wiring, UI, attribution, gates, and empty-calendar honesty.** Live multi-origin Showcase richness and Kim live inclusion remain punch-list items that require registry membership + crawl (human-approved commit of regenerated `_data`), not more local code in this pass.

**STOP before any commit** — awaiting human review of local proof.
