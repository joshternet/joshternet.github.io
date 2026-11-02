# Research notes

Offline pipeline notes for Activity, Showcase, and Happening. Keep these
**anonymized**: no member domains, article titles, or per-origin exclusion
write-ups. Fixture paths under `test/fixtures/` are fine for regression; public
docs describe gates and taxonomy only.

## Kept here

| Note | Purpose |
| --- | --- |
| [content-pipeline-audit.md](content-pipeline-audit.md) | Field mapping feed → content → hub cards |
| [events-happening-offline-audit.md](events-happening-offline-audit.md) | Past vs upcoming event separation (fixture-based) |

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
| Happening | Upcoming, not cancelled, publisher schedule evidence |
| Showcase | Past workshops/education may qualify; undated event prose does not |
| Activity | Title + capped plain summary + optional poster; outbound to origin |
