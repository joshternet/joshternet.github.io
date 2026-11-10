# Content pipeline audit — Activity and Showcase

**Audited:** 2026-11-02 (local snapshot; offline)  
**Scope:** Existing NLP harvest → content normalization → views projections  
**Constraints:** No live crawl; no commits. See [README.md](README.md) for the anonymized exclusion taxonomy.

## Pipeline (Action path)

`network:sync` → `nlp:sync` (crawl + feeds + creative/portfolio/events + enrich + posters) → `views:build` inside sync → `nlp:validate` → Jekyll. Scheduled by `.github/workflows/network-sync.yml`.

```text
JoshBot registry
    → network.json (origins, feeds, elsewhere)
    → crawlOrigin + feed/HTML harvest
    → content.json (deduped drafts)
    → compactContentItem + isMadeContentItem
    → showcase.json ≡ made.json, activity.json, happening.json
```

## Evidence table

| Source field | Normalized field | Derived field | Displayed field | Limitations |
| --- | --- | --- | --- | --- |
| Feed `<title>` / JSON `title` | `title` | `showcaseCardTitle` (slug expand) | Card title | Empty titles fall back to summary/slug; homepage harvest can invent junk titles |
| Feed `<summary>` / `<description>` / JSON `summary` | `summary` (plain, ≤400) | — | Card blurb / Atom summary | Full-content RSS descriptions can dominate; prefer `p-summary`/OG when enriching |
| h-entry `p-summary` / `e-content` | `summary` | — | Card blurb | Prefer `p-summary` over `e-content` (snippet hygiene) |
| OG / meta description on page join | `share_description` → fill empty `summary` | — | Card blurb | Only fills when summary empty |
| Feed `pubDate` / `published` / JSON `date_published` | `published_at` | Activity window (14d) | “New” eligibility | Missing dates → Showcase OK, Activity omitted |
| Crawl / sync clock | `observed_at` | Sort fallback | Not “published” | Must not imply recency alone |
| Feed categories / JSON tags / mf2 `p-category` | `declared_topics` | Topic neighborhoods | Tags on cards | Heuristic topics stay out of Showcase tags |
| Enclosure / media:thumbnail / OG image | `image` | Local poster under `/assets/activity/posters/` | Card media | Photography Showcase requires poster (substance gate) |
| Schema CreativeWork / path heuristics | `content_type` | `showcaseKind` / `kind_label` | Section filters | Mis-typed homepage links become false “projects” |
| Portfolio table rows | `content_type: project`, `source.kind: portfolio` | — | — | **Blanketed out of Showcase** via `isPortfolioSourcedItem` (blocks legitimate `/projects/` works) |
| Event schema / h-event | `content_type: event`, `start`/`end` | Happening upcoming filter | `/events/` | Empty Happening when no future `start` |
| Elsewhere YouTube/Vimeo/Twitch | Channel drafts + `channel_publish` | 14d upload gate | Showcase channel cards | Undated networks stay off Activity |
| `site_origin` + network title | `site_title` / `domain` | — | Maker attribution | Must not claim hub authorship |
| Playwright / OG enrich | Local `image` path | — | Poster | Robots/UA: Joshternet-Joshbot |

## Deduplication and survival

- Identity: URL-first (`url:…`), else feed id; `mergeContentItems` unions feeds/topics. Creative harvest mints identities via `contentIdentityKey` (hash stripped) so OG and schema `#fragment` twins collapse.
- Speaking titles: `appearance-title` hygiene rejects `N min read` / `, YYYY` crumbs; year-crumb conferences fall back to the talk title; slides/recording become the presentation card URL when the archive index is the only permalink.
- Showcase eligibility: `isMadeContentItem` (hub/home/index/aggregator/individual photo/portfolio/case-study/chrome/substance + empty appearance titles). Past education events defer to a related presentation. `dedupeCrosspostedContentItems` also collapses same-origin `url:` identities that share a hash-stripped URL.
- Activity: writing + dated Showcase works with publisher `published_at` in 14 days.
- **Audit:** `npm run showcase:audit` is read-only over `_data/content.json` + `_data/showcase.json` (never patches datasets).
- **Feed harvest bug:** `subjectsFromFeeds` and sync content loop use `feeds.slice(0, 3)` — later feeds dropped (must fix on Action path).

## Snapshot (local `_data`, 2026-11-09 attribution pass)

| Metric | Value |
| --- | --- |
| Content items | 871 (parser remint of identities needs next `nlp:sync`) |
| Showcase items (after `views:build`) | 29 |
| Cleared on Showcase | min-read talks, `, 2026` education crumbs, `#gallery` photo doubles, event+presentation pairs |
| Regeneration | Code-only; `_data` refreshed via `views:build` (no hand edits) |
| Gate | `npm run showcase:audit` → ok |

## Snapshot (local `_data`, 2026-11-02)

| Metric | Value |
| --- | --- |
| Origins | 13 |
| Content items | 1403 |
| Showcase items | 33 (project, games, photography, sheet music) |
| Happening | 0 |
| Activity primary | 6 |
| `made.json` vs `showcase.json` | Same URLs; `generated_at` can differ across staggered writes |

## Known limitations (pre-fix)

1. Portfolio-sourced creative works on non-creative paths stay out; creative-path portfolio rows (e.g. `/projects/…`) are eligible; `/work/?work=` case studies stay excluded.
2. ~~First-three-feeds cap~~ — fixed: production sync/NLP processes every feed. Directory probe helper `MAX_FEEDS_PER_ORIGIN = 2` in `directory.mjs` remains a separate scale tool.
3. Photography without poster never Showcase.
4. Finite per-origin crawl budgets (`MAX_PAGES_PER_ORIGIN = 250` default) with skip reasons.
5. Optional `/.well-known/slashpages` OPML reader seeds same-origin outlines only.
6. Bare creative indexes alone do not fill Showcase; product/detail roots must be retained by crawl.
