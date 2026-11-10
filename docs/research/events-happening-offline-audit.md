# Events vs Showcase — offline Happening audit

**Audited:** 2026-11-07  
**Method:** Offline fixtures (`scripts/nlp/events.mjs`, `scripts/nlp/appearances.mjs`, `test/fixtures/events/`) plus the local `_data` snapshot after a speaking-archive sync.

## Fixtures

| Fixture | Expected |
| --- | --- |
| `upcoming-event.html` | Happening-eligible (future `start`) |
| `education-study-hall-upcoming.html` | Happening education gathering |
| `education-study-hall-past.html` | Showcase-eligible past education; not Happening |
| `past-hackathon.html` | Past Events archive; not Happening |
| `no-date-event.html` | Excluded — no invented dates |
| `hfeed-events.html` | Declared h-event entries with schedule evidence only |
| `speaking-archive.html` | Dated talks → events + presentations with `presented`; directory not a project |
| `speaking-archive-year-headings.html` | Month-day dates inherit section year headings |
| `availability.html` | Booking copy: zero events |
| `course-catalog.html` | Zero undated scheduled classes |
| `mention.html` | Mention stays out of both calendars |

## Local `_data` snapshot

- `happening.json` item count: **0** (no future-dated appearances after the audit clock)
- `past_events.json` item count: **47**
- `content.json`: **62** `event`, **43** `presentation` (including Goldberg speaking archive via automatic `nlp:sync`)
- Showcase kinds include **talks**

Empty upcoming Happening is expected when every observed start is already past. Past appearances use the Past events section. No invented venues, tickets, or dates.

## Separation rules

| Surface | Rule |
| --- | --- |
| Happening | Upcoming/ongoing, not cancelled, publisher schedule evidence |
| Past events | Verified past start; never mixed into upcoming or iCal |
| Showcase | Presentations and past education may qualify; undated “event” prose does not |
