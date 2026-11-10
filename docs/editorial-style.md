# Joshternet editorial style

Short reference for visitor-facing copy. Length baselines: [editorial-baseline.md](editorial-baseline.md). Protocol evidence rules: [platform-guides-audit.md](platform-guides-audit.md).

## Voice

Write like someone who enjoys the web, understands how it works, and wants to introduce people to interesting independent sites.

| Principle | Meaning |
| --- | --- |
| Curious | An ongoing experiment, not a finished answer |
| Playful | Joshes, joshing, and friends of Joshes—humor where it fits |
| Practical | Say what to do before background |
| Independent | Celebrate publishers’ own sites; Joshternet connects, it does not replace |
| Modest | Describe what exists today; do not overclaim |
| Welcoming | Non-Joshes participate equally; Josh identity is optional |

## Tone by page purpose

| Page type | Approach |
| --- | --- |
| Homepage | Inviting, curious, playful |
| Network / discovery | Enthusiastic about sites and creators |
| Join | Friendly, direct, simple |
| Implement / platforms | Practical, concise, accurate |
| Handbook | Educational, conversational |
| About | Personal, reflective |
| JoshBot | Transparent, technical, light humor OK |
| Specs | Precise; Draft RFCs are not IETF standards |
| Community | Welcoming and principled |
| Governance | Clear and factual |
| Privacy / Terms / Security | Straightforward and accurate |

## Preferred terminology

| Concept | Prefer |
| --- | --- |
| Project | Joshternet |
| Crawler | JoshBot |
| Sites | Independent websites, participating sites/origins (by context) |
| Affirmed | Joshes |
| Declined | Non-Joshes (Network filters); **Friends of the Joshternet** on `/friends/` (presentation only—canonical value stays `declined`) |
| Omit `josh` | Undeclared Josh Identity |
| Mechanism | Joshternet declaration at `/.well-known/josh` |
| Listing | Joshternet registry or Network directory |
| Activity | What’s New |
| Exploration | Wander |
| Creative work | Showcase |
| Relationships | Connections (name the relationship type) |

Capitalize product and section names consistently. In mid-sentence prose, do not alternate “Non-Joshes” / “non-Joshes” casually—prefer **Non-Joshes** for the participant label.

## Participation ≠ identity

Publishing a valid declaration establishes **participation**. The optional Boolean `josh` expresses **Josh identity** (`true` Affirmed, `false` Declined, omitted Undeclared). None ranks above another. The registry does not decide who is a Josh. Nomination is optional discovery, not joining.

## Humor

**Keep** when natural: “Joshes joshing the Joshes,” “Are you a Josh? Get yourself connected,” “Wander the Joshternet,” “Joshness is declared, never derived,” “The name is silly. The HTTP requests are real.”

Do not force jokes into every heading, error, or procedure step.

## Avoid

Institutional or promotional filler: “facilitates,” “empowers users,” “comprehensive ecosystem,” “leverage the capabilities,” “transformative,” “users are encouraged to,” “in order to,” “it is important to note that.”

Prefer “You can publish…” over “Participants are provided with the ability to publish…”

## Concision

Explain a concept where it first matters, then link. Complete paragraphs for prose; short labels and steps are fine for UI. Lists when sequence or comparison helps—not every idea as a bullet.

## Examples

**Good (homepage personality):** “An internet full of Joshes. And friends of Joshes.”

**Good (practical):** “The minimum valid declaration is `{ "version": 1 }`.”

**Weak:** “Publish a tiny file on a site you control”—sounds universal, but Workers and plugins may serve a virtual declaration. Prefer “Publish a small JSON declaration at `/.well-known/josh`.”

**Weak:** “Choose participation identity”—conflates joining with optional Josh identity. Prefer “Choose your declaration.”

## Page review checklist

- Purpose clear in the introduction?
- Sounds like Joshternet (not corporate, not generic AI promo)?
- Direct, natural, useful paragraphs?
- Humor appropriate?
- Repetition removed; deep links used?
- Terminology consistent; participation ≠ identity?
- Registry/crawler claims accurate?
- Metadata matches visible copy?
- Approved recent revisions preserved?

Applied across Groups A–F on the current branch (entry pages, project pages, discovery hubs, JoshBot/Nominate/Buttons, topic SEO generator + stubs, declaration-checker copy, and supporting legal/meta wording). Keep this file short; do not grow it into a second handbook.
