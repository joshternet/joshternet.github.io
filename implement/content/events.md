---
layout: default
title: "Events: Bring the Independent Web Together"
description: >-
  Publish gatherings on your own site—semantic HTML, Microformats2 h-event,
  Schema.org Event, iCalendar, time zones, recurrence, RSVP, and accurate
  updates when plans change.
keywords: >-
  h-event, Schema.org Event, iCalendar, ICS, time zone, RSVP, eventStatus,
  independent web, Happening
permalink: /implement/content/events/
nav_title: Events
content_id: events
matrix_id: events
seo:
  type: TechArticle
  name: Events
---

# Events

Events bring people together around shared interests, places, and activities. A personal website can announce a gathering without requiring organizers or attendees to use a centralized events platform.

An event page can say what is happening, where it takes place, when it starts, who organizes it, and how to attend. Human-readable announcements and structured metadata serve different jobs: people read the page; compatible apps can recognize dates and locations without guessing from prose. Calendar files and subscriptions let visitors add events to apps they already use. Event information must stay accurate—especially when dates or venues change.

## An event is more than a calendar entry

| Resource | Meaning |
| --- | --- |
| Event | The gathering, performance, or activity |
| Event page | The public web page describing it |
| Calendar entry | A representation for calendar software |
| Event series | Related events or a recurring pattern |
| Occurrence | One instance of a repeating series |
| Venue | Physical or virtual location |
| Registration | Reserving a place or expressing interest through a process |
| RSVP | A response about attendance intentions |

These may have different URLs and identifiers. A monthly creative meetup can have a series page plus per-meeting pages with their own dates. A calendar entry should describe the event or occurrence—not an unrelated whole website.

<ol class="content-discovery-flow" aria-label="Publish and maintain an event">
  <li>
    <strong>Announce</strong>
    <span>You publish a clear page with times, place, and how to attend.</span>
  </li>
  <li>
    <strong>Structure</strong>
    <span>You add h-event and Schema.org Event when helpful.</span>
  </li>
  <li>
    <strong>Calendar</strong>
    <span>You offer a downloadable or subscribable iCalendar representation.</span>
  </li>
  <li>
    <strong>Update</strong>
    <span>You keep HTML, metadata, and calendar files aligned when plans change.</span>
  </li>
  <li>
    <strong>Archive</strong>
    <span>Past and cancelled events stay informative rather than silently vanishing.</span>
  </li>
</ol>

## How the web began sharing calendars

Electronic calendar exchange led to [iCalendar](https://www.rfc-editor.org/rfc/rfc5545) (RFC 5545). Downloadable `.ics` files move events between applications. Microformats evolved from hCalendar into Microformats2 [h-event](https://microformats.org/wiki/h-event). [Schema.org Event](https://schema.org/Event) describes events in structured data. CalDAV and scheduling protocols (iTIP/iMIP) synchronize or invite—they are complementary, not required merely to publish an event page. Calendar exchange, sync, invitations, and discovery remain different jobs.

## Tell people what they need to know

A useful event page typically makes visible: name, description, date, start (and end or duration), time zone, physical or virtual location, organizer, speakers/performers, accessibility information, registration instructions, admission if any, capacity notes, contact, status, calendar download, and a canonical URL. Those facts should live in ordinary HTML—not only in JSON-LD or an `.ics` file.

## Semantic HTML for events

Use `<main>`, `<article>`, `<header>`, `<section>`, headings, `<time>`, `<address>`, links, and optional figures. The `<time>` element pairs a machine-readable value with readable copy:

```html
<p>
  Begins:
  <time datetime="2026-12-10T18:00:00-08:00">
    Dec. 10, 2026, at 6 p.m. PST
  </time>
</p>
```

The offset `-08:00` is Pacific Standard Time for that instant. Calendar apps may display it in the visitor’s preferred zone. Keep the page useful without JavaScript.

## Make sure everyone arrives at the right time

Distinguish calendar dates, wall-clock times, UTC, UTC offsets, named IANA zones (for example `America/Los_Angeles`), daylight saving, date-only and multi-day events, durations, and cross-midnight sessions. `2026-12-10T18:00:00-08:00` is not the same as a bare local timestamp without an offset. An offset pins one instant; a named zone carries rules that can change across the year. Hardcoding `-08:00` for every occurrence of a year-round series breaks when daylight saving applies. Do not assume the reader’s zone is the event’s zone.

For this workshop: **Dec. 10, 2026, 6:00 p.m. PST** equals **2026-12-11T02:00:00Z**.

## All-day and multi-day events

All-day events, multi-date exhibitions, overnight sessions, and conferences differ from timed appointments. In ordinary prose, end dates are often inclusive; in iCalendar, all-day `DTEND` is **non-inclusive** (the day after the last included day). Do not convert all-day events into midnight timestamps without care—time zones invent surprises. A continuous multi-day event is not the same as a series of separate sessions.

## Describe events directly in HTML

[h-event](https://microformats.org/wiki/h-event) is the Microformats2 vocabulary for events (community living documentation—not an IETF RFC). Root class: `h-event`.

| Property | Purpose |
| --- | --- |
| `p-name` | Event name |
| `p-summary` | Short summary |
| `p-description` | Longer description |
| `dt-start` | Start date/time |
| `dt-end` | End date/time |
| `dt-duration` | Duration |
| `p-location` | Location |
| `u-url` | Event URL |
| `p-category` | Categories |

Useful publishing usually needs at least a clear name and start. Experimental or draft attendee/organizer proposals are not universal requirements. Nested `h-card` / `h-adr` may appear when appropriate.

## Complete h-event implementation

```html
<article class="h-event">
  <h1 class="p-name">Independent Web Workshop</h1>
  <p class="p-summary">An evening of building personal websites.</p>
  <p>
    Starts:
    <time class="dt-start" datetime="2026-12-10T18:00:00-08:00">
      Dec. 10, 2026, at 6 p.m. PST
    </time>
  </p>
  <p>
    Ends:
    <time class="dt-end" datetime="2026-12-10T19:30:00-08:00">
      7:30 p.m. PST
    </time>
  </p>
  <p class="p-location">Example Community Studio</p>
  <p>
    <a class="u-url" href="https://joshua.example/events/web-workshop/">
      Event permalink
    </a>
  </p>
</article>
```

Parsed (abridged):

```json
{
  "type": ["h-event"],
  "properties": {
    "name": ["Independent Web Workshop"],
    "summary": ["An evening of building personal websites."],
    "start": ["2026-12-10T18:00:00-08:00"],
    "end": ["2026-12-10T19:30:00-08:00"],
    "location": ["Example Community Studio"],
    "url": ["https://joshua.example/events/web-workshop/"]
  }
}
```

## Help visitors find the event

Publish venue name, address parts, optional coordinates, directions, transit notes, and accessibility information you have **verified**. Microformats2 `h-adr` and `h-geo` are optional. Addresses and coordinates can raise privacy or safety concerns. Use fictional venues in examples; do not invent a real venue’s access features.

## Schema.org Event

Specialized types include `Event`, `MusicEvent`, `ExhibitionEvent`, `EducationEvent`, `BusinessEvent`, `SocialEvent`, `Festival`, `Hackathon`, `SportsEvent`, `TheaterEvent`, `VisualArtsEvent`, and `EventSeries` (verify against [Schema.org](https://schema.org/Event) when publishing). Prefer a specialized type when it fits; use `EventSeries` for the series entity versus one occurrence.

### Properties

Common properties: `name`, `description`, `url`, `startDate`, `endDate`, `duration`, `eventStatus`, `previousStartDate`, `eventAttendanceMode`, `location`, `organizer`, `performer`, `contributor`, `image`, `offers`, capacity fields, `subEvent`, `superEvent`, `inLanguage`. Do not invent tickets, prices, or attendance counts. Core Schema.org semantics are not the same as a search engine’s rich-result checklist.

### Complete JSON-LD example

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "@id": "https://joshua.example/events/web-workshop/#event",
  "name": "Independent Web Workshop",
  "description": "An evening of building personal websites.",
  "url": "https://joshua.example/events/web-workshop/",
  "startDate": "2026-12-10T18:00:00-08:00",
  "endDate": "2026-12-10T19:30:00-08:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "Example Community Studio",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Example City",
      "addressRegion": "CA",
      "addressCountry": "US"
    }
  },
  "organizer": {
    "@type": "Person",
    "@id": "https://joshua.example/#person",
    "name": "Avery Example",
    "url": "https://joshua.example/about/"
  }
}
```

Match the visible page. Validate with [validator.schema.org](https://validator.schema.org/).

## Physical, virtual and hybrid events

Attendance modes: `OfflineEventAttendanceMode`, `OnlineEventAttendanceMode`, `MixedEventAttendanceMode`. Use `Place` and/or `VirtualLocation`. Online meeting links may need registration; do not publish private credentials on a public page. Schema.org can describe online-only events even when a particular search feature does not promote them.

## Understand search-engine requirements without confusing them with standards

[Google’s Event structured data](https://developers.google.com/search/docs/appearance/structured-data/event) has its own eligibility rules (event landing pages, names, start dates, physical locations, public attendance, accuracy, status, images, optional tickets). As documented in November 2026, **entirely virtual events are not supported** for that Google Event experience—events must take place at a physical location for that feature. That does **not** make online-only Schema.org Events invalid. Vendor rules should not stop you from publishing a clear independent event page. Rich-result placement is never guaranteed.

## What happens when plans change?

Structured status values include `EventScheduled`, `EventPostponed`, `EventRescheduled`, `EventCancelled`, and `EventMovedOnline`. Use `previousStartDate` when rescheduling. Keep cancelled pages up with a clear notice rather than deleting them silently. Update HTML, JSON-LD, calendar files, and registration messages together. Past and cancelled events can remain useful archives.

## Let visitors add your event to their calendar

[RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) defines iCalendar (`.ics`). Key objects/properties: `VCALENDAR`, `VEVENT`, `VERSION`, `PRODID`, `UID`, `DTSTAMP`, `DTSTART`, `DTEND`, `SUMMARY`, `DESCRIPTION`, `LOCATION`, `URL`, `STATUS`, `SEQUENCE`. Real files use CRLF endings and line folding; Markdown examples may show readable lines. iCalendar is distinct from HTML and JSON-LD.

### Complete example (UTC)

Dec. 10, 2026, 6:00–7:30 p.m. PST → `20261211T020000Z`–`20261211T033000Z`.

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Harbor Notes//Events//EN
BEGIN:VEVENT
UID:web-workshop-2026-12-10@joshua.example
DTSTAMP:20261101T120000Z
DTSTART:20261211T020000Z
DTEND:20261211T033000Z
SUMMARY:Independent Web Workshop
DESCRIPTION:An evening of building personal websites.
LOCATION:Example Community Studio
URL:https://joshua.example/events/web-workshop/
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

Keep the **UID** stable across ordinary updates so clients update instead of duplicating.

### Time zone handling

iCalendar supports UTC, floating local times, date-only values, and `TZID` with `VTIMEZONE`. Recurrence across daylight saving needs more care than a one-time UTC stamp. Do not paste `-08:00` onto every occurrence of a year-round series.

### Updates and identity

`UID` identifies the event; `DTSTAMP` / `LAST-MODIFIED` / `SEQUENCE` help clients detect changes; `RECURRENCE-ID` targets one occurrence. Replacing a static `.ics` file differs from iTIP scheduling messages. iTIP/iMIP are separate from ordinary static publication.

## One event series, many occurrences

Use `RRULE` (`FREQ`, `INTERVAL`, `COUNT`, `UNTIL`, `BYDAY`, …), plus `RDATE` / `EXDATE`. `DTSTART` must fit the rule. Bound expansion in application code. Exceptions use `RECURRENCE-ID` for rescheduled, cancelled, or relocated occurrences without new series identity. Discovery UIs may list series differently than calendar clients.

## Downloadable calendars versus subscriptions

**Import** downloads a file once. **Subscribe** periodically fetches a calendar URL. Stable URLs, caching, UIDs, and refresh intervals matter; apps differ. [RFC 7986](https://www.rfc-editor.org/rfc/rfc7986) adds calendar metadata such as names. `webcal:` is an application URI convention, not a separate data format. Refresh intervals are not universal.

## CalDAV and scheduling interoperability

[CalDAV](https://www.rfc-editor.org/rfc/rfc4791) manages calendar collections over WebDAV. Static `.ics` publication, read-only subscription, CalDAV sync, iTIP, and iMIP email scheduling are different layers. A personal site does not need CalDAV merely to announce events.

## Let people respond from their own websites

IndieWeb [RSVP](https://indieweb.org/rsvp) posts use `h-entry` with `p-rsvp` (`yes` / `no` / `maybe` / `interested`), often `u-in-reply-to` the event URL, and `p-author`. An RSVP is not the event’s `h-event`. [Webmention](https://www.w3.org/TR/webmention/) can notify the organizer; verification does not authenticate identity or confirm a paid reservation. See [Connections]({{ '/implement/content/connections/' | relative_url }}).

```html
<article class="h-entry">
  <p class="p-rsvp">yes</p>
  <p>
    <a class="u-in-reply-to" href="https://joshua.example/events/web-workshop/">
      Independent Web Workshop
    </a>
  </p>
  <a class="p-author h-card" href="https://friends.joshua.example/">Friend</a>
</article>
```

## Registration and ticketing

Registration, tickets, waitlists, deadlines, and refunds are processes beyond metadata. Schema.org `Offer` (`price`, `priceCurrency`, `availability`, `url`, `validFrom`) applies only when a **real** offer exists. A calendar file does not reserve a seat.

## Make participation possible for more people

Publish verified accessibility information: entrances, step-free access, seating, restrooms, interpretation/captioning, hearing assistance, registration access, remote options, sensory notes, transit, and accommodation contacts. Keep the page itself accessible (semantics, keyboard). Do not invent venue features. Do not require disclosing attendees’ disability status. See [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Events for artists and creative communities

Concerts, exhibitions, openings, theater, readings, game demos, workshops, meetups, conferences, and classes relate events to performers, organizers, venues, and works (`performer`, `organizer`, `workPerformed`, `subEvent`, `superEvent`). A video recording of an event is not the event itself—see [Creative Media]({{ '/implement/content/media/' | relative_url }}).

## Organize events so people can explore them

Publish `/events/`, individual pages, upcoming and past sections, series pages, and optional subscription files. Separate upcoming from archives. Use semantic lists linking to event pages; `CollectionPage` / `ItemList` complement—not replace—individual `Event` objects.

## Keeping event information consistent

| Representation | Role |
| --- | --- |
| Visible HTML | Title, date, location, status |
| h-event | Structured HTML properties |
| Schema.org Event | JSON-LD entity |
| iCalendar | Calendar identity and updates |
| Feeds | Announcements |
| XML sitemap | Public event URLs |

Drive all formats from one authoritative record. Update calendar and syndication when the announcement changes. Do not replace event dates with build timestamps.

## Complete event publishing example

Harbor Notes publishes `/events/` linking to `/events/web-workshop/` with the h-event and Schema.org examples above, a downloadable `/events/web-workshop.ics` matching the UTC VEVENT, registration instructions (for example “email Avery”), and an accessibility note you have verified for the fictional studio. If the workshop moves online or is cancelled, update `eventStatus`, visible copy, and the `.ics` `STATUS`/`SEQUENCE` together. Static hosting is enough for the page and file.

## Static-site and CMS implementation

Handwritten HTML, Jekyll, Hugo, Eleventy, WordPress, and custom apps can generate HTML, JSON-LD, and `.ics` from shared event data: stable IDs, stored instants + zones, recurrence, venues, organizers, and publication status. Validate before build; keep generation deterministic.

## Keep event information accurate over time

Draft → published → changed → postponed/rescheduled/cancelled → completed → archived. Preserve permalinks. Prefer clear cancellation pages over silent deletion.

## International events and multilingual publishing

Show the same instant in multiple display zones; use language tags for translations; localize date formats carefully. Dual-language descriptions are optional—do not auto-translate inventively.

## Events and the Joshternet

Creative gatherings help people discover activities on member sites. Accurate dates, locations, and structured metadata help compatible systems recognize events. Not every prose mention becomes a calendar entry.

Joshternet consumes Schema.org Event types and h-event markup with a dependable `YYYY-MM-DD…` start. The content store may retain dated events; public [Happening]({{ '/events/' | relative_url }}) lists upcoming/ongoing items (not cancelled; not mention-only attribution). Schema attribution may be hosted, organized, or performed; mf2 extracts are treated as hosted. Past education-shaped events may appear in Showcase under separate rules. The hub may publish a static aggregate `.ics` for Happening items—it does **not** run CalDAV, RSVP ingestion, or Webmention RSVP processing. Details: [Reference]({{ '/implement/content/reference/' | relative_url }}).

## Security and privacy

Keep private meeting links, invitation codes, home addresses, children’s events, and attendance lists off public pages and public structured data. Treat untrusted registration forms, fake tickets, remote descriptions, and calendar attachments carefully. Bound recurrence expansion. Publishing an event URL does not authorize access to private registration resources.

## Make sure the event details are correct

1. Validate HTML and `<time>` values.
2. Parse h-event with a conforming Microformats2 parser.
3. Validate Schema.org JSON-LD.
4. Optionally run Google’s Rich Results Test—know its narrower rules.
5. Validate `.ics` syntax, UIDs, and recurrence.
6. Check UTC conversions and DST cases.
7. Confirm canonical URLs and calendar links.
8. Test create → update → cancel flows.
9. Review accessibility of times and instructions.

## Common mistakes

| Mistake | Consequence | Correction |
| --- | --- | --- |
| Missing start date | Undated noise | Publish machine-readable start |
| Ambiguous dates / missing zones | Wrong arrival times | Offset or TZID |
| Wrong DST offsets | Off-by-one-hour | Named zones or correct offsets |
| Local time as UTC | Global confusion | Label conversions |
| All-day as midnight | Spurious zones | Date values + exclusive DTEND |
| Inclusive vs exclusive end | Off-by-one day | Follow iCalendar rules |
| Shared or regenerating UIDs | Duplicate or lost updates | Stable UID per event |
| Build time as event date | Nonsense schedules | Store real event instants |
| Series vs occurrence confusion | Wrong edits | Separate identities |
| Bad RRULE / ignored EXDATE | Wrong occurrence set | Validate recurrence |
| DTEND + DURATION together | Invalid VEVENT | Use one end representation |
| Missing ICS required fields | Import failures | UID, DTSTAMP, DTSTART, … |
| Bad escaping/folding | Broken files | RFC 5545 text rules |
| Virtual as physical venue | Misleading maps | VirtualLocation / clear copy |
| Invented accessibility | Harmful claims | Verify before publishing |
| RSVP as paid registration | False confirmation | Separate processes |
| Public private meeting links | Access leaks | Gate credentials |
| Stale calendar after reschedule | Wrong reminders | Update ICS + SEQUENCE |
| Delete cancelled pages | Orphaned copies | Leave a clear notice |
| HTML ≠ JSON-LD | Conflicting signals | One source of truth |
| Non-events as Event | Pollution | Require real gatherings |
| Guaranteed Google rich results | False hope | Vendor eligibility separate |
| Article mention as listing | False events | Dedicated event pages |
| Hub filters as universal rules | Spec confusion | Label Joshternet separately |

## Continue through the handbook

- [Semantic HTML]({{ '/implement/content/html/' | relative_url }})
- [Slash pages]({{ '/implement/content/slashpages/' | relative_url }})
- [Microformats2]({{ '/implement/content/microformats2/' | relative_url }})
- [Schema.org]({{ '/implement/content/schema-org/' | relative_url }})
- [Feeds]({{ '/implement/content/feeds/' | relative_url }})
- [XML Sitemaps]({{ '/implement/content/sitemaps/' | relative_url }})
- [Links and relations]({{ '/implement/content/links/' | relative_url }})
- [Identity and authorship]({{ '/implement/content/identity/' | relative_url }})
- [Connections]({{ '/implement/content/connections/' | relative_url }})
- [Creative media]({{ '/implement/content/media/' | relative_url }})
- [Validation]({{ '/implement/content/validation/' | relative_url }})
- [Reference]({{ '/implement/content/reference/' | relative_url }})

Handbook navigation below follows `content_nav` (previous: Creative media; next: Uses).

## Specifications and references

| Reference | Authority |
| --- | --- |
| [Schema.org Event](https://schema.org/Event) | Event vocabulary |
| [EventSeries](https://schema.org/EventSeries) | Series type |
| [VirtualLocation](https://schema.org/VirtualLocation) | Online locations |
| [eventStatus](https://schema.org/eventStatus) | Status property |
| [eventAttendanceMode](https://schema.org/eventAttendanceMode) | Attendance mode |
| [h-event](https://microformats.org/wiki/h-event) | Microformats2 events |
| [Microformats2 parsing](https://microformats.org/wiki/microformats2-parsing) | Parsing |
| [IndieWeb RSVP](https://indieweb.org/rsvp) | RSVP convention |
| [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) | iCalendar |
| [RFC 7986](https://www.rfc-editor.org/rfc/rfc7986) | iCalendar extensions |
| [RFC 4791](https://www.rfc-editor.org/rfc/rfc4791) | CalDAV |
| [RFC 5546](https://www.rfc-editor.org/rfc/rfc5546) | iTIP |
| [RFC 6047](https://www.rfc-editor.org/rfc/rfc6047) | iMIP |
| [iCalendar registries](https://www.iana.org/assignments/icalendar) | IANA |
| [HTML Living Standard](https://html.spec.whatwg.org/) | HTML |
| [Google Event structured data](https://developers.google.com/search/docs/appearance/structured-data/event) | Vendor guidance |
| [Schema.org Markup Validator](https://validator.schema.org/) | Validation |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Accessibility |
| [Webmention](https://www.w3.org/TR/webmention/) | Notifications |

{% include content-chapter-nav.html aria_label="Handbook chapter (bottom)" %}
