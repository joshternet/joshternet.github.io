# Uses Intelligence — Phase 0 baseline

**Status:** Inventory only. Not a coverage claim.  
**Date:** 2026-11-04  
**Source:** Verified site projection `_data/network.json` (22 origins) and `_data/site_signals.json` page records from the last successful `nlp:sync`.

## Eligibility universe

Eligible participating origins are those in the JoshBot registry as projected through `network:sync` into `_data/network.json`. Josh, non-Josh, and undeclared identities are equal for Uses Intelligence. `https://joshternet.org` must never contribute evidence for its own generated analysis pages.

Sampled origins (22):

- https://artlung.com
- https://forwardbias.dev
- https://joshbeard.com
- https://joshcox.co.uk
- https://joshghent.com
- https://joshgr.com
- https://joshkoter.com
- https://joshmuller.ca
- https://joshozuna.com
- https://joshternet.org (hub — excluded as evidence)
- https://joshtronic.com
- https://joshua.seigler.net
- https://joshuadrake.org
- https://joshuakim.studio
- https://joshuamorris.info
- https://joshuapsteele.com
- https://joshuastuebner.com
- https://www.chrisminnick.com
- https://www.joshcanhelp.com
- https://www.joshfinnie.com
- https://www.joshuabaker.com
- https://www.joshvickerson.com

A stale `_data/network.json` must not redefine eligibility; live registry membership via the sync pipeline is authoritative.

## Observed `/uses` page records

From `site_signals` page metadata (role/title only — HTML bodies are not retained). Crawl URL keys under `site_views` often record probe attempts (`content-index`, `budget-exhausted`, soft-404 skips) and **must not** be treated as verified `/uses` content.

Retained `about`-role `/uses` page records in `site_signals` (distinct origins with at least one record; HTML bodies were discarded after crawl, so tool lists are **not** verified here):

- https://joshbeard.com/uses/ (also `/uses`)
- https://joshcox.co.uk/uses/
- https://joshmuller.ca/uses/
- https://joshtronic.com/uses/
- https://joshua.seigler.net/uses/
- https://joshuapsteele.com/uses/
- https://www.joshfinnie.com/uses/
- https://www.joshuabaker.com/uses/

That is **8 distinct eligible origins** with a retained `/uses` page record out of 21 non-hub network entries. Remaining origins had no retained `/uses` page in this snapshot (not found, soft-404, disallowed, unreachable, or not checked). Blind `/uses/` probes are registered in the slash-page catalog and may soft-404 when the path duplicates the homepage fingerprint. OPML `/.well-known/slashpages` with `category="/uses"` is supported for discovery but was not separately tallied in this baseline pass.

## Categories for follow-up extraction

| Category | Meaning |
| --- | --- |
| Verified readable | Successful HTML retention with explicit usage declarations |
| Verified empty | Reachable `/uses` page with no extractable current tools |
| Uncertain | Partial parse or ambiguous structure |
| Not found / soft-404 | Probe skipped or 404 |
| Disallowed | robots/`noindex` blocked |
| Unreachable | Network/timeout failures |
| Out of scope | Off-origin redirect |
| Not checked | Origin not yet evaluated in a uses run |

Do not invent a coverage percentage from probe URL keys alone. Phase 1+ extractors must classify each origin with one of the outcomes above.

## Pipeline notes

- Hourly workflow concurrency group: `joshternet-network-sync`, `cancel-in-progress: false`.
- Phase 0 replaces the scrape→artifact→publish handoff with a single `sync-and-publish` job; durable data lives only in Git commits.
- Uses public publish remains behind `JOSHTERNET_USES_PUBLISH` until shadow gates pass.
