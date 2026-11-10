# Directory, event, and presentation baseline

**Audited:** 2026-11-07  
**Method:** Offline fixtures plus the published `_data` snapshot after speaking-archive extraction, durable directory eviction, and identity-keyed content merge. Named sites below publish this information on the open web.

## Snapshot counts

| Measure | Value |
| --- | --- |
| Network origins | 35 |
| Affirmed registry origins | 22 |
| Content records | 1022 |
| `content_type: event` | 62 |
| `content_type: presentation` | 43 |
| Showcase cards | 38 (includes Talks) |
| Happening upcoming | 0 |
| Past events | 47 |

## Directory leftovers (resolved)

Extractors reject directory indexes. Durable merge also drops stale project/collection rows whose URL is a directory index (`/collections`, `/html-sitemap`, `/tools/`, `/speaking/`, …) while keeping real `event` / `presentation` rows that may still link to a speaking archive URL.

| URL | Prior problem | Current |
| --- | --- | --- |
| [joshozuna.com/collections](https://joshozuna.com/collections) | Typed as Project | Absent from content |
| [joshozuna.com/html-sitemap](https://joshozuna.com/html-sitemap) | Typed as collection / Project | Absent from content |
| [joshuastuebner.com/tools/](https://joshuastuebner.com/tools/) | Index typed as Project | Absent; child tools remain |

## Classification findings (shipped)

- Page roles `collection` and `speaking-archive` live in `scripts/nlp/page-role.mjs`.
- Peer speaking/tools extraction lives in `scripts/nlp/appearances.mjs` (orchestrated from `scripts/nlp/events.mjs` for Schema.org / h-event).
- Year section headings fill month-day dates (`Mar 28` under `h2` `2026`). Talk titles may come from description text when the conference is the linked label.
- Content merge prefers `identity` over shared archive URLs so many appearances are not collapsed into one row.
- `nlp:sync` probes `/speaking/`, `/tools/`, and event-index slash pages even when deep crawl short-circuits (same pattern as Uses/Seeking), so hourly GitHub Actions refreshes talks without hand-editing `_data`.
- `/events/` shows Upcoming and Past; Showcase kind `talks` is capped at two per origin.
- Event and presentation rows are durable creative.

## Primary speaking archive: Josh Goldberg

[joshuakgoldberg.com/speaking/](https://www.joshuakgoldberg.com/speaking/) is an affirmed registry origin (`frame_reason: allowed`). A deep sync observes `/speaking/` and publishes dated appearances (this snapshot: **80** Goldberg content rows — 44 events + 36 presentations). Production code must not special-case his name.

Regression expectations from his published archive:

- How to Learn to Love the Linter — Boston Code Camp 40 — 2026-03-28
- TypeScript and Aspire — AspireConf 2026 — 2026-03-23
- Tooling Like It's 2025 — repeated across conferences → one presentation

Fixtures: `test/fixtures/events/speaking-archive.html` and `speaking-archive-year-headings.html`.

## Negative fixture: availability / booking

[chrisminnick.com/availability/](https://www.chrisminnick.com/availability/) is declined in the registry; keep availability as a fixture-only negative (`test/fixtures/events/availability.html`). Course catalogs and booking pages must not invent scheduled events.

## Fixture regression (no person-specific production rules)

| Fixture | Expected |
| --- | --- |
| `test/fixtures/events/speaking-archive.html` | Directory is not a project; dated talks → events + presentations; repeated title → one presentation |
| `test/fixtures/events/speaking-archive-year-headings.html` | Month-day dates inherit section year; conference link + description title |
| `test/fixtures/events/availability.html` | Zero events (booking copy) |
| `test/fixtures/events/course-catalog.html` | Zero scheduled classes without dated instances |
| `test/fixtures/events/mention.html` | Mention role stays out of calendars |
| `test/fixtures/creative/sitemap-page.html` | Sitemap not Showcase |
| `test/fixtures/creative/tools-index.html` | Index excluded; linked tools eligible as software/projects |

## Coverage gaps among registered origins

| Origin | Content records | Note |
| --- | --- | --- |
| [joshcanhelp.com](https://www.joshcanhelp.com) | 0 | Affirmed, crawl allowed; still no indexed works — coverage to investigate |
| [joshvickerson.com](https://www.joshvickerson.com) | 0 | Affirmed, but `frame_reason: blocked-by-site` — different failure mode than empty extraction |

## Separation rules

| Surface | Rule |
| --- | --- |
| Upcoming Happening | Future or ongoing start; not cancelled; not mention-only |
| Past events | Verified past start; newest first; year groups when needed |
| Showcase Talks | `content_type: presentation` with title + source link; two per origin |
| Showcase Projects | Directories and sitemaps excluded |
| iCalendar | Upcoming only; date-only values use `VALUE=DATE` |
