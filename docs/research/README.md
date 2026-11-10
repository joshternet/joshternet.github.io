# Research notes

Offline pipeline notes for Activity, Showcase, and Happening. Publicly
published member pages, domains, and titles may be named when they are the
evidence under discussion. Do not invent private facts or unpublished details.
Fixture paths under `test/fixtures/` remain the regression source of truth.

## Kept here

| Note | Purpose |
| --- | --- |
| [content-pipeline-audit.md](content-pipeline-audit.md) | Field mapping feed → content → hub cards |
| [events-happening-offline-audit.md](events-happening-offline-audit.md) | Past vs upcoming event separation (fixture-based) |
| [directory-event-presentation-baseline.md](directory-event-presentation-baseline.md) | Directory vs work, speaking archives, past events baseline |

## Exclusion taxonomy (Showcase)

| Reason | Keep? |
| --- | --- |
| Hub URL | Yes |
| Member homepage as “project” | Yes |
| Bare creative indexes (`/work`, `/projects`, `/photos`, …) | Yes |
| Individual photo/art attachment pages | Yes |
| Client case studies (`/work/?work=`, deep `/portfolio/…`) | Yes |
| Lone photograph outside an album path | Yes |
| Articles off creative paths | Yes |
| Project without creative directory / named product root | Yes |
| Empty shells / photos without poster | Yes |
| Portfolio-sourced rows on creative paths | Eligible when not a case study |

## Surfaces

| Surface | Rule |
| --- | --- |
| Happening | Upcoming or ongoing; past archive is separate; publisher schedule evidence |
| Showcase | Presentations and past education may qualify; directories and undated event prose do not |
| Activity | Title + capped plain summary + optional poster; outbound to origin |
