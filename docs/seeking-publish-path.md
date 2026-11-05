# Seeking publish path (follow-up)

## Goal

Show current Seeking request excerpts on production without committing request
bodies, contact fields, or source HTML into Git history.

## Why this is separate

Hourly `network-sync` commits generated network datasets to `main`, then
requests a GitHub Pages rebuild from the branch. Staging `_data/seeking.json`
would archive request text in repository history. The repo also forbids Actions
artifact upload/download for network-sync generated data
(`test/site/workflows.test.mjs`).

## Local preview (required to ship)

Local `npm run nlp:sync` writes visitor-facing preview files so `/uses/` and
`/seeking/` can be checked after a crawl:

- Seeking: always writes gitignored `_data/seeking.json` from crawl state
- Uses: public views default **on** outside CI (`resolvePreviewPublish`); set
  `JOSHTERNET_USES_PUBLISH=0` to force shadow locally
- CI defaults both publish flags **off** unless the corresponding env/var is set

Do not commit `_data/uses_summary.json`, `assets/data/uses/`, or Seeking JSON.

## Current gate

- Extractor and reconcile: `scripts/nlp/seeking.mjs`
- Ephemeral state: `.network-sync/seeking-state.json` (gitignored via `.network-sync/`)
- Public preview file: `_data/seeking.json` (gitignored)
- Shared resolver: `scripts/nlp/preview-publish.mjs`
- Network nav lists Seeking at `/seeking/`

## Required follow-up for production excerpts

Review and land a custom Pages deploy that builds Seeking into the published
site artifact without committing Seeking JSON, then enable production Seeking
excerpts and retest retention/leakage. Until then, production Pages builds from
committed tree show the empty Seeking explorer (no committed `_data/seeking.json`).
