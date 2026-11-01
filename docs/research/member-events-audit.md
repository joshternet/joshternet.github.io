# Member events audit — Happening eligibility

**Audited:** 2026-11-01  
**Method:** Live public GETs (User-Agent `JoshternetEventAudit/1.0`) against homepage, `/now/`, `/about/`, and event-catalog paths (`/events/`, `/event/`, `/shows/`, `/gigs/`, `/tour/`, `/live/`, `/concerts/`, `/performances/`, `/exhibitions/`, `/readings/`, `/workshops/`, `/calendar/`, `/speaking/`, `/talks/`, `/appearances/`). Parsed HTML for Schema.org `Event*` JSON-LD, mf2 `h-event`, and `.ics` links. Raw probe log: [`_member-events-audit-raw.json`](_member-events-audit-raw.json).  
**Hub:** `joshternet.org` excluded.  
**Crawl baseline:** `_data/content.json` had **0** `content_type: "event"` items before this audit.

## Inclusion rules used

| Include in Happening | Exclude |
|---|---|
| Same-origin publisher event with dependable `start`, not cancelled, attribution not mere `mention` | Blog “event-driven” posts, soft-404 SPA shells, undated project write-ups about past hackathons, personal memorial pages, creative month challenges without Event markup/dates as public gatherings |

## Summary matrix

| Origin | Event paths | Schema Event / h-event / ICS | Upcoming public events found | Happening recommendation |
|---|---|---|---|---|
| joshbeard.com | Blind probes **403** (WAF); `/`, `/now/`, `/me/` OK | None | None | **exclude** — no public event index |
| joshghent.com | Many paths **200** but same SPA shell (not real event pages) | Person JSON-LD only | None | **exclude** — soft-200s are not events |
| joshmuller.ca | `/events/` **404**; `/`, `/now/` OK | None | None | **exclude** — memorial `/dads-service/` is not a Happening listing |
| joshtronic.com | `/events/` **404**; `/now/` **404** | None | None | **exclude** |
| joshua.seigler.net | `/events/` **404** | None | None | **exclude** |
| joshuakim.studio | No `/events/` index; `/hotchocolate` case study | None on Hot Chocolate page | None upcoming | **exclude** past hackathon write-up; **no parser change** (not Event markup) |
| joshuamorris.info | `/events/` **404** | None | None | **exclude** Weird Web October as creative collection, not a dated public gathering Event |
| www.joshcanhelp.com | `/events/` **404** | None | None | **exclude** |
| www.joshuabaker.com | `/events/` **404** | None | None | **exclude** |

**Upcoming includable events across the network: 0.**

---

## 1. joshbeard.com

**Checked:** `/`, `/now/`, `/me/` (via `/about/` redirect), blind event paths.

**Findings:** Event-catalog paths return **403**. Homepage and `/now/` have no Schema `Event`, no `h-event`, no `.ics`, no event-index links.

**Classification:** no public events observed.

**Recommendation:** **exclude**. No parser change.

---

## 2. joshghent.com

**Checked:** `/`, `/now/`, `/about/`, and full event-path list.

**Findings:** `/events/`, `/speaking/`, `/talks/`, etc. all return **200** with the **same homepage-length SPA shell** (~27KB) and Person JSON-LD—not Event nodes. No `h-event`, no ICS, no event anchors with schedules.

**Classification:** soft-200 / not-an-event.

**Recommendation:** **exclude**. Crawl should not treat 200 SPA shells as event indexes. No Happening parser change; optional future crawl soft-404 detection is out of scope here.

---

## 3. joshmuller.ca

**Checked:** `/`, `/now/`, `/events/` (404).

**Findings:** No Event markup or ICS. Prior creative audit noted `/dads-service/` (personal memorial)—**not** a public upcoming event for Happening.

**Recommendation:** **exclude**.

---

## 4. joshtronic.com

**Checked:** `/`, `/about/`, `/events/` (404), `/now/` (404).

**Findings:** No Event markup or ICS. Homepage “calendar-ish” false positive was an 11ty fragment URL, not a member calendar.

**Recommendation:** **exclude**.

---

## 5. joshua.seigler.net

**Checked:** `/`, `/now/`, `/about/`, `/events/` (404).

**Findings:** No Event markup or ICS.

**Recommendation:** **exclude**.

---

## 6. joshuakim.studio (new member)

**Checked:** `/`, `/about`, `/work/`, `/projects/` (404), `/hotchocolate` (+ trailing slash).

**Findings:** Portfolio links to **Hot Chocolate** as a **past** Stanford XR Hackathon project case study. Page is a creative-work write-up with demo video—**no** Schema `Event` / `h-event`, **no** `startDate`, **no** RSVP/tickets. Historical context only.

**Classification:** past project narrative (not upcoming Event).

**Recommendation:** **exclude from Happening**. Keep as Showcase/creative work if eligible. Existing Happening horizon rules already drop past dated Events; this page would not extract as `content_type: "event"` today—**no parser change required**.

---

## 7. joshuamorris.info

**Checked:** `/`, `/now/`, `/about/`, `/events/` (404).

**Findings:** No Event JSON-LD / h-event / ICS. Weird Web October is a themed experiment collection (creative), not a Schema Event with a public attendance schedule.

**Recommendation:** **exclude** from Happening. Do not invent Event items from experiment folder names.

---

## 8. www.joshcanhelp.com

**Checked:** `/`, `/now/`, `/about/`, `/events/` (404).

**Findings:** No Event markup or ICS.

**Recommendation:** **exclude**.

---

## 9. www.joshuabaker.com

**Checked:** `/`, `/now/`, `/about/`, `/events/` (404).

**Findings:** No Event markup or ICS on probed URLs.

**Recommendation:** **exclude**.

---

## Parser / publish verdict

1. **Do not publish** `/events/` yet (`published: false`, no Happening nav)—no verified upcoming member events.
2. **Do not expand** `collectEvents` for ICS-only or heuristic blog titles based on this audit—there is no member ICS feed and no dated Event HTML to parse.
3. **Current inclusion gate stands:** Schema.org `Event*` + mf2 `h-event`, dependable start, skip `mention` / cancelled / past. That is sufficient for the first real member event pages when they appear.
4. **Re-run** this audit after members add `/events/` (or equivalent) with Event markup, or after the next full crawl retains event paths.

## Happening include list (today)

_None._
