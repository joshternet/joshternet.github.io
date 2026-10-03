# Changelog

## Unreleased

### Added

- Joshes Elsewhere (#37): network enrichment discovers homepage and same-origin about-page `rel="me"` links and catalog social profile links (even without `rel`), publishes an optional `elsewhere` array on participants (email, unsafe URLs, and non-profile paths like GitHub repos dropped), and shows those profiles as icon links on taller Network cards. Icons use brand marks on a single `/assets/icons/elsewhere-sprite.svg` sheet (CSS mask-position)—Simple Icons CC0 paths plus the LinkedIn brand-guidelines mark, with a first-party `web` glyph—documented in `THIRD_PARTY_LICENSES.md`. Marks identify participant-published links only. Feed and elsewhere icons share a compact bottom-left grid. Every network sync (including keep-path / hourly) refreshes elsewhere so cards stay current without a full screenshot recapture.
- Network enrichment discovers advertised blogroll OPML (`rel=blogroll` `text/xml`), publishes participant-to-participant edges to `_data/blogrolls.json`, and writes `/assets/network/joshternet.opml` listing every current Network site (with primary feed and nested blogroll link when available). Refreshed on every network sync.
- Site-wide `<head>` advertises the aggregate blogroll with `<link rel="blogroll" type="text/xml" href="/assets/network/joshternet.opml">` so feed readers can discover it from any page. The Network page no longer shows a duplicate body subscribe link.
- Network enrichment discovers advertised RSS, Atom, and JSON Feed `link[rel=alternate]` declarations during homepage capture and publishes an optional `feeds` array on Network participants. Every network sync refreshes feeds for the current registry membership (including kept screenshots); the hourly job always runs so cards stay aligned as the network grows and shrinks.
- Network cards show an RSS control that opens the participant's primary advertised feed when `feeds` is present.
- Implementation guide: Jekyll recipe for publishing `.well-known/josh`, including the `include` rule and Content-Type / curl checks.
- Primary nav: Implement second-level links (validate, Eleventy, Jekyll) in a frameless row under the header circle-dot motif on tablet/desktop, with raindrop disclosures in the mobile Menu. The Implement item itself opens `/implement/`.

### Changed

- Tablet primary nav matches the desktop top-row pattern instead of the three-column chip grid.
- Implement second-level links overlay under the circle-dot rule without a panel background or page shift; the current section stays visible unless another top-level branch with its own subnav is hovered.

### Fixed

- Drop jekyll-seo-tag advertisements from rendered HTML: the `generator` meta tag and the Begin/End Jekyll SEO HTML comments.
- Implement submenu: keep the hover path open across the gap under the circle-dot rule by treating the whole header as the open zone, dismiss immediately when another top-level item is entered, and keep sticky overlay behavior on Implement section pages without pushing page content.
- Declaration check page: paste and live-origin forms start empty with placeholders, keep feedback between the heading and the field, and color each field for valid or invalid.
- Live origin checks read `/.well-known/josh` through a Joshternet Worker so valid declarations are not blocked by missing publisher CORS headers. The Worker requires an allowlisted browser Origin, rate-limits by client IP and target origin, and does not follow cross-origin redirects.
- Network sync consumes JoshBot registry participation metadata (`first_participated_at`, declarations, latest check time/outcome) and publishes only currently participating origins.
