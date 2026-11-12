# Development

This guide explains how to work on the Joshternet website. The website is a Jekyll project with JavaScript tooling and selected Cloudflare Workers. It is one part of Joshternet, not the authoritative source of network membership or protocol rules.

## Prerequisites

- Node.js 22 and npm (the version used by the current CI workflow)
- Ruby 3.1, Bundler, and the dependencies specified in the repository's `Gemfile` (same Ruby version as `site-quality.yml`)
- Git

## Getting started

```sh
git clone https://github.com/joshternet/joshternet.github.io.git
cd joshternet.github.io
npm ci
bundle install
npm run dev
```

Open <http://127.0.0.1:4000/>. The development command starts the Jekyll preview with LiveReload and local services for the site's interactive features. Run `./scripts/dev.sh --help` to inspect available options. It binds the website to the local network as well, so use a trusted network.

## Build and validate

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start a local preview |
| `npm run build` | Run the current production-shaped site build |
| `npm test` | Run library unit tests |
| `npm run test:coverage` | Run the enforced coverage gate |
| `npm run test:browser` | Run browser tests with local fixtures |
| `npm run test:site` | Test the built site after `npm run build` |
| `npm run test:security` | Run security-focused checks |
| `npm run format:check` | Verify formatting |
| `npm run validate` | Run formatting and library coverage checks |

Review `scripts/build.sh` before running a full build in a restricted environment. Prefer `npm run dev` and fixture-based tests when changing markup, styles or presentation logic.

## Tests and fixtures

Use unit tests for parsing and presentation logic, browser tests for interactive behavior and generated-site tests for the built pages. Keep fixtures synthetic or deliberately sanitized. Do not embed scraped personal content, credentials, live account details or copies of production datasets in tests.

For anything timing- or content-sensitive, assert stable behavior rather than exact live counts, current articles, topic labels or timestamps. Cover success, empty results, malformed input, unsupported versions and unavailable upstream services. The current library coverage command enforces 100% coverage on its selected library surface; other commands and generated-site behavior need their own tests.

## Development conventions

Prefer small, reviewable changes and plain JavaScript ES modules (`.mjs`) for Node tooling. Use standard libraries when they meet the requirement, avoid dead code and unnecessary abstractions, and keep business rules outside rendering components. Do not introduce TypeScript or a new service solely to solve a local problem.

Treat public-facing site changes as accessibility and progressive-enhancement work: semantic markup, keyboard support, reduced-motion behavior and useful fallback content matter. Preserve existing URLs when possible; propose redirects for any necessary changes. Do not modify protocol meaning in this repository; protocol changes belong in [joshternet/spec](https://github.com/joshternet/spec).

## Contributions

Open a focused pull request with the reason for the change, tests performed and any relevant screenshots. Do not include secrets or hand-edited network observations. A pull request must not assume permission to change membership or redeploy upstream services.

See [Data pipeline](data-pipeline.md) for the system boundaries and [Operations](operations.md) for release and troubleshooting responsibilities.
