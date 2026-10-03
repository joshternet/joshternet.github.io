#!/usr/bin/env bash
# Goal & Constraints:
# One foreground command starts Jekyll with LiveReload and the Workers the
# development site talks to (button :8790, declaration-check :8789,
# seed-nominations :8787). Jekyll binds 0.0.0.0 so other devices on the LAN
# can open this machine’s IP. Workers stay on 127.0.0.1 to match CSP.
# Do not kill other processes. --help and --dry-run stay non-interactive.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

JEKYLL_HOST="0.0.0.0"
JEKYLL_PORT="4000"
LIVERELOAD_PORT="35729"

usage() {
  cat <<'EOF'
Start a local Joshternet preview: Jekyll with LiveReload plus the Workers
the development pages call.

Usage:
  ./scripts/dev.sh
  ./scripts/dev.sh --dry-run
  ./scripts/dev.sh --help
  npm run dev

Listens on:
  http://0.0.0.0:4000       Jekyll (JEKYLL_ENV=development; all interfaces)
  http://127.0.0.1:4000     same Jekyll process on this machine
  http://127.0.0.1:35729    Jekyll LiveReload
  http://127.0.0.1:8790     joshternet-button
  http://127.0.0.1:8789     declaration-check
  http://127.0.0.1:8787     seed-nominations

Other devices on your network can use http://<this-machine-lan-ip>:4000/

Examples:
  ./scripts/dev.sh
  ./scripts/dev.sh --dry-run
  npm run dev -- --dry-run

Ctrl-C stops this process group. This script does not terminate other
servers that may already be running.
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
      printf '  ./scripts/dev.sh --help\n' >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "$ROOT/_config.yml" ]]; then
  printf 'Error: run this from the Joshternet site repo (missing _config.yml).\n' >&2
  printf '  ./scripts/dev.sh\n' >&2
  exit 1
fi

jekyll_cmd=(
  bundle exec jekyll serve
  --host "$JEKYLL_HOST"
  --port "$JEKYLL_PORT"
  --livereload
  --livereload-port "$LIVERELOAD_PORT"
  --strict_front_matter
)

button_cmd=(npm --prefix workers/joshternet-button run dev)
check_cmd=(npm --prefix workers/declaration-check run dev)
nominate_cmd=(npm --prefix workers/seed-nominations run dev)

print_lan_site_urls() {
  local iface
  local ip

  if ! command -v ipconfig >/dev/null; then
    return 0
  fi

  for iface in en0 en1 en2; do
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "${ip:-}" ]]; then
      printf 'lan: %s\n' "http://${ip}:${JEKYLL_PORT}/"
    fi
  done
}

print_plan() {
  printf 'site: %s\n' "http://127.0.0.1:${JEKYLL_PORT}/"
  print_lan_site_urls
  printf 'button: %s\n' "http://127.0.0.1:8790/embed/joshternet-button.js"
  printf 'declaration-check: %s\n' "http://127.0.0.1:8789/v1/declaration-check"
  printf 'seed-nominations: %s\n' "http://127.0.0.1:8787/v1/seed-nominations"
  printf 'jekyll: %s\n' "${jekyll_cmd[*]}"
  printf 'worker: %s\n' "${button_cmd[*]}"
  printf 'worker: %s\n' "${check_cmd[*]}"
  printf 'worker: %s\n' "${nominate_cmd[*]}"
}

if [[ "$dry_run" -eq 1 ]]; then
  print_plan
  exit 0
fi

if ! command -v bundle >/dev/null; then
  printf 'Error: Bundler is not on PATH.\n' >&2
  printf '  bundle install\n' >&2
  printf '  ./scripts/dev.sh\n' >&2
  exit 1
fi

if ! command -v npm >/dev/null; then
  printf 'Error: npm is not on PATH.\n' >&2
  printf '  npm ci\n' >&2
  printf '  ./scripts/dev.sh\n' >&2
  exit 1
fi

ensure_worker_modules() {
  local dir="$1"

  if [[ -d "$dir/node_modules" ]]; then
    return 0
  fi

  npm --prefix "$dir" ci
}

ensure_worker_modules workers/joshternet-button
ensure_worker_modules workers/declaration-check
ensure_worker_modules workers/seed-nominations

if [[ ! -f workers/declaration-check/.dev.vars ]]; then
  printf 'warning: workers/declaration-check/.dev.vars is missing; copy workers/declaration-check/.dev.vars.example if live checks should allow http://127.0.0.1:4000\n' >&2
fi

print_plan

"${button_cmd[@]}" &
"${check_cmd[@]}" &
"${nominate_cmd[@]}" &
"${jekyll_cmd[@]}" &

wait
