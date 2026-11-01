# Showcase + Happening — Phase 8 Verification Checklist

Naming: keep **Showcase** (`/showcase/`). Do not rename to Made.

## Showcase (`/showcase/`)

- [ ] Member/creator credited on every card; outbound to publisher
- [ ] No Joshternet authorship/ownership language
- [ ] `buildShowcaseItems` fair per-origin rotation
- [ ] `_data/showcase.json` written by `views:build`
- [ ] Nav shows Showcase → `/showcase/`
- [ ] Homepage `home-showcase.html` only when non-empty

## Happening (`/events/`)

- [ ] Only verified future/ongoing events
- [ ] Past hackathon (Hot Chocolate) excluded from upcoming
- [ ] Participant credit + publisher event URL
- [ ] Homepage strip omitted when empty
- [ ] Optional ICS when events exist

## Local gate

- [ ] `npm test` / `test:coverage`
- [ ] `npm run format:check`
- [ ] Dev smoke for `/showcase/`, `/events/`
- [ ] No commits until human review
