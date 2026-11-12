# Joshternet

**A little corner of the independent web for people named Josh.**

[Explore the Joshternet](https://joshternet.org/) | [Join the network](https://joshternet.org/join/) | [Implementation guide](https://joshternet.org/implement/) | [Specifications](https://github.com/joshternet/spec)

The internet used to feel like a collection of interesting places built by interesting people. Personal websites, strange experiments, blogrolls, handmade projects and unexpected discoveries were part of what made exploring the web fun.

Joshternet is a small attempt to bring some of that spirit back.

It started with a simple idea: What if people named Josh connected their personal websites into a network? Not through another social media platform, but through the websites they already own and control.

What began as a joke about there being far too many of us named Josh has become an open project celebrating personal websites, independent publishing and the joy of discovering what other people are creating.

You don't need an account, a new website or permission from a platform to participate. You just need a personal website and a willingness to be part of something a little unusual.

## What is Joshternet?

Joshternet is an open network of personal websites belonging to people named Josh, Joshua and other people who identify as Josh.

Members declare their participation by publishing a small file at `/.well-known/josh` on their own domain. [JoshBot](https://joshternet.org/joshbot/), our network crawler, discovers and verifies those declarations so participating websites can be connected and explored.

The network celebrates the people behind the websites and the things they create.

Through Joshternet, visitors can:

- **Discover personal websites.** Wander through independently owned sites and find people you might never encounter through a search engine or social media feed.
- **Explore connections.** See how participating websites link to one another and discover the wider independent web.
- **Find interesting projects.** Explore writing, software, artwork, experiments and other things members share publicly.
- **Follow what's happening.** Discover recent activity from across participating websites without requiring everyone to publish on the same platform.
- **Celebrate the independent web.** Encourage personal publishing, open standards, creative experimentation and the freedom to make your own corner of the internet.

Joshternet is not a social media platform, a hosting provider or a replacement for anyone's website. It is a way for independently owned websites to find and connect with one another.

And while the name is part of the fun, you don't have to be a Josh to enjoy exploring. Friends of the Joshternet are welcome, too.

## About this repository

This repository contains the source code for [joshternet.org](https://joshternet.org/), the public website for the Joshternet project.

The site is built with Jekyll and published through GitHub Pages. JavaScript tools support its interactive features, data processing, content discovery and automated quality checks. Cloudflare Workers support selected interactive services.

The repository includes:

- **Website and documentation:** Public pages, implementation guides, project information and community resources.
- **Network exploration:** Interfaces for discovering participating websites, connections, topics and creative work.
- **Data processing:** Tools that transform discovered website information into datasets used by the site.
- **Interactive features:** Client-side JavaScript and supporting Cloudflare Workers.
- **Tests and tooling:** Automated checks for application behavior, generated content and site quality.

The canonical protocol specifications are maintained separately in [joshternet/spec](https://github.com/joshternet/spec). This repository implements and presents parts of that ecosystem but is not the authoritative definition of the protocol.

## How the network works

Joshternet is designed around a straightforward principle: **Your website belongs to you.**

Participation does not require creating a profile on Joshternet or surrendering ownership of your content.

1. **Declare membership.** Publish a `/.well-known/josh` file on your own website using the documented format.
2. **Get discovered.** JoshBot discovers and verifies declarations from participating domains.
3. **Connect with others.** Your website becomes discoverable through the network and can link to other members.
4. **Keep publishing.** Continue writing, building and creating on your own website. Joshternet helps people discover what you choose to make public.

Joshternet respects `robots.txt` and site owners' crawling preferences. The network is intended to help people find original work, not to replace the websites where that work lives.

Membership is declared by the website owner, not guessed from a person's name or inferred from their content.

For instructions, examples and technical details, visit the [implementation guide](https://joshternet.org/implement/).

## Running the website locally

You can run the website on your own computer to explore the code, test changes or contribute improvements.

### Requirements

- Ruby 3.1
- Bundler
- Node.js 22 and npm

### Installation

Clone the repository and install its dependencies:

```bash
git clone https://github.com/joshternet/joshternet.github.io.git
cd joshternet.github.io

bundle install
npm ci
```

### Start the development server

```bash
npm run dev
```

The development site is available at:

http://localhost:4000/

The development command starts Jekyll with LiveReload and the local Workers used for supported interactive features.

For local development details, tests and contribution conventions, see [docs/development.md](docs/development.md).

### Build the website

```bash
npm run build
```

This produces a production Jekyll site in `_site/`. Review `scripts/build.sh` before running it in a restricted environment.

### Run quality checks

The project includes automated tests and formatting checks.

| Command | Purpose |
| --- | --- |
| `npm test` | Run JavaScript unit tests |
| `npm run test:coverage` | Run unit tests with enforced coverage requirements |
| `npm run test:browser` | Run Playwright browser tests |
| `npm run format:check` | Check formatting with Prettier |
| `npm run validate` | Run formatting and coverage checks |
| `npm run test:site` | Validate the generated site after building |

Contributions should pass the relevant checks before being submitted for review.

Some tests require a production build, while browser tests can run against offline fixtures.

Contributors should change site source, documentation, tests and reviewed configuration—not invent or hand-edit network observations. See [docs/data-pipeline.md](docs/data-pipeline.md) and [docs/operations.md](docs/operations.md) for system boundaries.

## Contributing

Joshternet is an open project, and contributions are welcome.

You don't need to be named Josh to contribute. If you enjoy personal websites, the IndieWeb, open standards, accessibility or building unusual things for the internet, there is room for you here.

Useful contributions include improving documentation, fixing bugs, making the website more accessible, strengthening tests, improving performance and suggesting ways to make discovering independent websites more enjoyable.

To contribute:

1. Browse the [open issues](https://github.com/joshternet/joshternet.github.io/issues) or start a discussion about an improvement.
2. Fork the repository and make your changes in a separate branch.
3. Include appropriate tests and update documentation when behavior changes.
4. Open a pull request explaining what changed and why.

Please keep contributions focused, understandable and maintainable. We favor standard web technologies, simple solutions and respect for existing web standards over unnecessary complexity.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/development.md](docs/development.md) for development setup and conventions.

For protocol changes, use the [specifications repository](https://github.com/joshternet/spec) rather than treating the website implementation as the source of authority.

## Privacy and respect for site owners

The independent web works best when people respect one another's websites and choices.

Joshternet is built around several principles:

- **Ownership:** Members keep their websites, domains and published content under their own control.
- **Consent:** Membership is explicitly declared rather than inferred.
- **Respectful crawling:** Automated discovery honors `robots.txt` and site owners' restrictions.
- **Attribution:** Discovered work should lead visitors back to its original publisher.
- **Open standards:** Participation should not require proprietary software or a particular hosting provider.
- **Transparency:** The project documents how its network operates and how its data is used.

Read the [privacy policy](https://joshternet.org/privacy/) and [project specifications](https://github.com/joshternet/spec) for additional details.

## Project links

- [Joshternet website](https://joshternet.org/) — Explore the network.
- [Join Joshternet](https://joshternet.org/join/) — Learn how to participate.
- [Implementation guide](https://joshternet.org/implement/) — Add your own website.
- [Protocol specifications](https://github.com/joshternet/spec) — Read the canonical protocol definitions.
- [JoshBot](https://joshternet.org/joshbot/) — Learn about the network crawler.
- [GitHub organization](https://github.com/joshternet) — Explore related repositories.
- [Report an issue](https://github.com/joshternet/joshternet.github.io/issues) — Report bugs or propose improvements.

## Licensing

Joshternet uses different licenses for different types of material.

- **Project-owned source code:** [BSD-3-Clause](LICENSE)
- **Project-owned prose and documentation:** [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Brand assets:** Not open-licensed.
- **Third-party material:** Remains subject to its original copyright and license.

Screenshots, member content and third-party resources are not automatically relicensed by appearing in this repository or on the website.

See the [full licensing information](https://joshternet.org/licensing/) and [third-party license notices](https://joshternet.org/licensing/third-party-licenses/).

---

**The web is more interesting when people make their own little corners of it.**

Joshternet is one of those corners. Come explore, find another Josh and see where the links take you.

[Find yourself on the Joshternet.](https://joshternet.org/)
