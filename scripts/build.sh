#!/usr/bin/env bash
# Goal & Constraints:
# One production build refreshes datasets from the current registry, then
# builds static HTML. Order is fixed: network:sync, nlp:sync, nlp:validate,
# jekyll build. A second run with the same registry and pages leaves
# timestamp-only dataset files unchanged. Does not kill other processes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  cat <<'EOF'
Rebuild Joshternet datasets from the current registry, then build the site.

Usage:
  ./scripts/build.sh
  ./scripts/build.sh --dry-run
  ./scripts/build.sh --help
  npm run build

Steps, in order:
  npm run network:sync    registry membership, feeds, elsewhere
  npm run nlp:sync        topics, connections, content, view datasets
  npm run format:data     Prettier on generated _data/*.json
  npm run nlp:validate    graph invariants and JSON Schema
  JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter

npm run dev previews the datasets already on disk. This script is the
rebuild that picks up registry changes.
EOF
}

dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help | -h)
      usage
      exit 0
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    *)
      printf 'Error: unknown option %s\n' "$1" >&2
      printf '  ./scripts/build.sh --help\n' >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "$ROOT/_config.yml" ]]; then
  printf 'Error: run this from the Joshternet site repo (missing _config.yml).\n' >&2
  printf '  ./scripts/build.sh\n' >&2
  exit 1
fi

printf '1. npm run network:sync\n'
printf '2. npm run nlp:sync\n'
printf '3. npm run format:data\n'
printf '4. npm run nlp:validate\n'
printf '5. JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter\n'

if [[ "$dry_run" -eq 1 ]]; then
  exit 0
fi

npm run network:sync
npm run nlp:sync
npm run format:data
npm run nlp:validate
JEKYLL_ENV=production bundle exec jekyll build --strict_front_matter
