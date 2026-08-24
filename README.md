# Joshternet website

The GitHub Pages website for Joshternet. The canonical specifications are maintained in [joshternet/spec](https://github.com/joshternet/spec).

## Requirements

- Ruby 3.3
- Bundler

## Build and test locally

Install dependencies:

```sh
bundle install
```

Build the site with strict front-matter validation:

```sh
bundle exec jekyll build --strict_front_matter
```

A successful build writes the generated site to `_site/`.
