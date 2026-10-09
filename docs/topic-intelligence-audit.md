# Topic intelligence audit

Review status: the topic pipeline, Wander sandbox, and production smoke workflow described in the plan are in the working tree. Plural folding leaves devops, analytics, and internet-of-things unchanged and still folds regular plurals such as topics and laptops. The quality report lists added, removed, merged, and renamed topics plus rejection counts. A merge or plural rename is not also listed as an add and a removal, and a failed report does not replace published datasets. Wander keeps `sandbox="allow-scripts allow-same-origin"`, loads the member site in the frame, and shows the blocked-link sentence in a bubble beside the click that would leave the framed site, leaves that page in place, and Dismiss takes focus without scrolling. The smoke workflow is scheduled and is not a pull-request check. Generated network files already on disk keep the previous crawl until the next sync.

Measured on the local tree after the phrase, catalog, and normalization changes. Production crawl datasets were not regenerated. The next network sync applies the new rules.

## A. Executive assessment

Joshternet already had a deterministic JavaScript pipeline: crawl, declared tags, heuristic phrases, alias map, denylist, community pages, and an hourly publish job. The highest-impact defects were manufactured bigrams and a preferred catalog origin.

Before this change, `tokenize` in `scripts/nlp/extract.mjs` dropped stopwords and then `candidatePhrases` joined whatever remained. The sentence "Privacy is the heart of design. Design matters." produced the phrases `privacy heart`, `heart design`, `design design`, and `design matters`. `selectCatalogOrigin` returned `https://joshuamorris.info` whenever that origin was present, even when another participant had more declared subjects. `_data/topic_aliases.json` had an empty alias list. `_data/topics.json` had 203 communities and was 270,724 bytes.

## B. Verified findings

Confirmed defects that this change addresses:

- Stopword removal before bigrams: `tokenize` and `candidatePhrases` in `scripts/nlp/extract.mjs`.
- Catalog preference: `CATALOG_SEED_ORIGIN` and the early return in `selectCatalogOrigin` in `scripts/nlp/catalog.mjs`, called from `scripts/nlp/sync.mjs`.
- No plural fold: `slugifyTopic` in `scripts/network/connections.mjs` only lowercases and hyphenates.
- Empty aliases: `_data/topic_aliases.json`.

Working capabilities that stay:

- Declared, observed, and heuristic evidence classes in `scripts/nlp/evidence.mjs`.
- `heuristicQualifiesForCommunity` still requires document support, and now also refuses a candidate when `contextual` is false.
- English heuristics already skipped non-English pages in `scripts/nlp/sync.mjs` via `isEnglishLanguage`.
- One origin failure is recorded and other origins continue. `originFailureSignal` in `scripts/nlp/crawl.mjs`.
- Generated hub pages carry `joshternet_analysis: derived` and are not treated as publisher evidence.
- Semantic hash skip in `scripts/nlp/publish.mjs`.

Missing before this change, now present in code:

- Equivalent aliases, broader and related links that are not merged, alias cycle and conflict checks.
- A quality report that fails the hourly job before artifact upload.
- Fair topic-page order and a Wander blocked-link notice.

Open limit: a bare `agent` and `agents` share one slug. `ai-agent` and `real-estate-agent` stay separate. The pipeline does not split two meanings of the same word when the publisher did not. Missing `lang` is still treated as English, which matches the previous `isEnglishLanguage("")` behavior, because many pages omit the attribute. Explicit non-English pages do not get English heuristic phrases. Declared tags on those pages are kept.

## C. Architecture

Unchanged: JoshBot registry, crawl bounds, robots checks, feed parsers, view build, and the hourly job order.

Changed path:

1. `phrasesFromText` builds pairs only from words that were neighbors inside one sentence.
2. `foldPluralSlug` folds regular plurals and refuses the listed irregulars.
3. `buildTopicCommunities` resolves the folded slug through the alias map.
4. `networkCatalog` unions declared subjects from every participant.
5. `topicQualityReport` runs in `npm run nlp:quality` after `nlp:validate` and before the artifact upload in `.github/workflows/network-sync.yml`.
6. Topic pages list members by domain and rotate articles with `fairTopicArticles`.

## D. Options

1. Improve the current JavaScript pipeline. Chosen. The fixture failures were adjacency and policy, not a missing parser runtime.
2. Add a lightweight NLP library. Not chosen. A lemmatizer would still need the same exception list, and it would be a new dependency on the static publish path.
3. Use a heavier model only for ambiguous words. Not chosen. Publishing would then depend on a service the hourly job must not require.

## E. File map

- `scripts/nlp/extract.mjs` — sentence-bounded phrases and contextual eligibility.
- `scripts/nlp/normalize.mjs` — plural fold, ambiguous short words, alias checks.
- `scripts/nlp/catalog.mjs` — network-wide declared catalog.
- `scripts/nlp/evidence.mjs` — folded evidence slugs, original label kept.
- `scripts/nlp/communities.mjs` — folded community keys, relationship links, compatibility pages.
- `scripts/nlp/quality.mjs` and `scripts/nlp/quality-gate.mjs` — publish invariants.
- `scripts/nlp/sync.mjs` — uses the network catalog and writes compatibility pages for aliases and folded previous slugs.
- `scripts/views/lib.mjs` — alphabetical members and rotated articles.
- `_layouts/topic.html` — related topic links.
- `assets/js/wander.js` — member site in the frame and the blocked-link notice. Sandbox stays `allow-scripts allow-same-origin`.
- `.github/workflows/production-smoke.yml` — scheduled public checks, not on pull requests.
- `_data/topic_aliases.json` — Postgres to PostgreSQL, plus broader and related links that are not merged.

## F. Migration

Schemas were not replaced. New fields are optional. `topics` extractor version is 2.

GitHub Pages is not assumed to redirect. On the next sync, an alias source such as `postgres` gets `topics/postgres.md` pointing at `/topics/postgresql/` when that community exists. A previously published plural slug that folds, such as `agents` to `agent`, gets the same kind of page when the folded community is published. Those pages are marked `joshternet_analysis: derived`.

The committed `_data/topics.json` is still the previous crawl. It is not rewritten here.

## G. Benchmarks

Method: one local Node process, no network.

Before, on the sentence above, manufactured phrases were `privacy heart`, `heart design`, and `design design`.

After, `phrasesFromText` on that sentence returns `privacy`, `heart`, `design`, `design`, `matters`, and `design matters`. The manufactured pairs are gone. `design matters` was adjacent.

2,000 phrase passes over that sentence plus a linked-list sentence and a Go sentence took 12.9 ms and produced 26,000 phrase strings.

Building communities for 200 synthetic origins that declared `agent` or `agents` took 6.2 ms and produced one community, `agent`.

`networkCatalog` on `joshuamorris.info` with only `ai`, plus another origin with `privacy`, `design`, and `writing`, returned `ai`, `design`, `privacy`, and `writing`.

`npm run test:coverage` passed at 100% line, branch, and function coverage for the included library modules. `npm run nlp:quality` on the current datasets printed `{"added":[],"removed":[],"review":[]}` and exited 0.

Public precision and recall against a hand-labeled crawl of every live page were not measured. Those numbers would require a reviewed corpus. The fixture file `test/nlp/topic-quality.test.mjs` is the regression set for the 20 scenarios. Thresholds for a live crawl are not invented here. The hard checks in `topicQualityReport` are the release gate: no alias cycles, no filler or artifact public slugs, no heuristic member without a page, no participant-to-participant content URL mismatch, and no search link to a topic slug that is not public.

## H. Phases

0. Audit. This document. Baseline counts above are from the local run, not from memory.
1. Fixtures. `test/nlp/topic-quality.test.mjs` plus catalog, feed, and view updates.
2. Extraction. `phrasesFromText`.
3. Canonicalization. `foldPluralSlug`, Postgres alias, compatibility pages.
4. Membership. Contextual heuristic bar, network catalog, declared tags unchanged in class.
5. Publication. Quality report, fair article order, related links.
6. CI. `nlp:quality` before artifact upload. Failure skips upload, so publish does not replace production files.
7. Discovery. Alphabetical members, rotated recent articles, Wander blocked-link notice, production smoke workflow.

Rollback: remove the workflow step and revert the library files. The committed datasets stay until a sync run.

## I. Decisions

- `postgres`, discipline names such as ethics and economics, and the slug `united-states` are not plural-folded.
- Curated broader and related links are shown on the topic page when the target is a public topic.
- Sync does not replace published topic files when `topicQualityReport` fails, and an alias page is not written over a topic that is itself still public.
- No publisher ranking and no inferred personal attributes.
- Equivalent, broader, and related stay different fields.
- `JS` and `AI` are not unconditional aliases.
- Missing language metadata stays eligible for English heuristics. Explicit other languages do not.
- A large topic-count change is reported by `topicDiff` and does not fail the job by itself.
- Live `nlp:sync` was not run, so visitor-facing topic pages still show the previous crawl until the hourly job or a local sync.
