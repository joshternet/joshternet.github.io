# Events vs Showcase — offline Happening audit

**Audited:** 2026-11-02  
**Method:** Offline only — `scripts/nlp/events.mjs` and `test/fixtures/events/`. No live crawl.

## Fixtures

| Fixture | Expected |
| --- | --- |
| `upcoming-event.html` | Happening-eligible (future `start`) |
| `education-study-hall-upcoming.html` | Happening education gathering |
| `education-study-hall-past.html` | Showcase-eligible past education; not Happening |
| `past-hackathon.html` | Not Happening (past); may be Showcase project write-up only if creative-typed |
| `no-date-event.html` | Excluded — no invented dates |
| `hfeed-events.html` | Declared h-event entries with schedule evidence only |

## Local `_data` snapshot

- `happening.json` item count: **0**
- `content.json` `content_type: event`: none with future `start` in this snapshot

Empty Happening remains a **discovery finding** until a scheduled `nlp:sync` observes publisher Event markup with upcoming `start`. No invented venues, tickets, or dates.

## Separation rules (unchanged)

| Surface | Rule |
| --- | --- |
| Happening | Upcoming, not cancelled, publisher schedule evidence |
| Showcase | Past workshops/education may qualify via `isPastEducationShowcaseEvent`; undated “event” prose does not |
