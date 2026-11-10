#!/usr/bin/env bash
# Goal: Regression-check canonical machine-readable endpoints on joshternet.org.
# Exit nonzero when protocol endpoints fail or return challenge-like HTML.
# Inputs: optional CANONICAL_HOST (default https://joshternet.org),
#         optional GITHUB_PAGES_HOST (default https://joshternet.github.io),
#         optional EDGE_SECURITY_PROBE_PATH (operator-only; unset by default).
# Outputs: PASS/FAIL/WARN lines on stdout; nonzero status on FAIL.
# Note: Does not document edge product configuration.

set -euo pipefail

CANONICAL_HOST="${CANONICAL_HOST:-https://joshternet.org}"
GITHUB_PAGES_HOST="${GITHUB_PAGES_HOST:-https://joshternet.github.io}"
JOSHBOT_UA="${JOSHBOT_UA:-Joshternet-Joshbot (+https://joshternet.org/joshbot)}"
TMPDIR_SEC="$(mktemp -d "${TMPDIR:-/tmp}/joshternet-edge-XXXXXX")"
FAILS=0
WARNS=0

cleanup() {
  rm -rf "${TMPDIR_SEC}"
}
trap cleanup EXIT

pass() {
  printf 'PASS: %s\n' "$*"
}

fail() {
  printf 'FAIL: %s\n' "$*"
  FAILS=$((FAILS + 1))
}

warn() {
  printf 'WARN: %s\n' "$*"
  WARNS=$((WARNS + 1))
}

#
# Fetches URL headers into a file; prints HTTP status code.
# @param $1 - Absolute URL.
# @param $2 - Output headers file path.
# @param $3 - Optional User-Agent (defaults to JoshBot).
#
http_headers() {
  local url="$1"
  local out="$2"
  local ua="${3:-$JOSHBOT_UA}"
  curl -sS -D "${out}" -o /dev/null --max-time 25 -A "${ua}" -L --max-redirs 5 "${url}" || true
  awk 'BEGIN{s=0} /^HTTP\//{s=$2} END{print s+0}' "${out}"
}

#
# Fetches URL body into a file; prints HTTP status code from headers.
# @param $1 - Absolute URL.
# @param $2 - Output body file path.
# @param $3 - Optional User-Agent.
#
http_body() {
  local url="$1"
  local out="$2"
  local ua="${3:-$JOSHBOT_UA}"
  local hdr="${TMPDIR_SEC}/hdr.$$"
  local code
  code="$(curl -sS -D "${hdr}" -o "${out}" --max-time 25 -A "${ua}" -L --max-redirs 5 -w '%{http_code}' "${url}" || printf '000')"
  rm -f "${hdr}"
  printf '%s' "${code}"
}

#
# Returns 0 when body looks like a Cloudflare browser challenge/interstitial.
# @param $1 - Body file path.
#
looks_like_challenge() {
  local body="$1"
  if grep -qiE 'cf-browser-verification|challenge-platform|cdn-cgi/challenge|Just a moment|Enable JavaScript and cookies|Attention Required!|cf-challenge' "${body}"; then
    return 0
  fi
  return 1
}

#
# Asserts Content-Type header contains an expected substring (case-insensitive).
# @param $1 - Headers file.
# @param $2 - Expected substring (e.g. application/json).
#
header_has_type() {
  local hdr="$1"
  local expect="$2"
  grep -iE "^content-type:.*${expect}" "${hdr}" >/dev/null
}

printf 'Joshternet edge security verification\n'
printf 'Canonical: %s\n' "${CANONICAL_HOST}"
printf 'User-Agent: %s\n\n' "${JOSHBOT_UA}"

# 1. Homepage
home_hdr="${TMPDIR_SEC}/home.hdr"
home_code="$(http_headers "${CANONICAL_HOST}/" "${home_hdr}")"
if [[ "${home_code}" == "200" ]]; then
  pass "homepage HTTP 200"
else
  fail "homepage expected 200 got ${home_code}"
fi

# 2. HTTP → HTTPS
http_url="$(printf '%s' "${CANONICAL_HOST}" | sed 's|^https://|http://|')"
redir_hdr="${TMPDIR_SEC}/redir.hdr"
# Do not follow redirects for this check.
redir_code="$(curl -sS -D "${redir_hdr}" -o /dev/null --max-time 20 -A "${JOSHBOT_UA}" -w '%{http_code}' "${http_url}/" || printf '000')"
if grep -qiE '^location:[[:space:]]*https://' "${redir_hdr}" && [[ "${redir_code}" =~ ^30[12378]$ ]]; then
  pass "HTTP redirects to HTTPS (${redir_code})"
else
  fail "HTTP did not redirect to HTTPS (status ${redir_code})"
fi

# 3. TLS handshake (openssl when available)
host_only="$(printf '%s' "${CANONICAL_HOST}" | sed -E 's|^https?://||; s|/.*||')"
if command -v openssl >/dev/null 2>&1; then
  if echo | openssl s_client -connect "${host_only}:443" -servername "${host_only}" >/dev/null 2>/tmp/joshternet-tls-err; then
    pass "TLS handshake succeeded for ${host_only}"
  else
    fail "TLS handshake failed for ${host_only}"
  fi
else
  warn "openssl not available; skipped TLS handshake check"
fi

#
# Checks a machine endpoint for status, content-type, and challenge body.
# @param $1 - Path beginning with /.
# @param $2 - Expected Content-Type substring.
# @param $3 - Optional body must-contain string.
#
check_machine() {
  local path="$1"
  local ctype="$2"
  local must="${3:-}"
  local url="${CANONICAL_HOST}${path}"
  local hdr="${TMPDIR_SEC}/m.hdr"
  local body="${TMPDIR_SEC}/m.body"
  local code
  code="$(curl -sS -D "${hdr}" -o "${body}" --max-time 25 -A "${JOSHBOT_UA}" -L --max-redirs 5 -w '%{http_code}' "${url}" || printf '000')"
  if [[ "${code}" != "200" ]]; then
    fail "${path} expected 200 got ${code}"
    return
  fi
  if looks_like_challenge "${body}"; then
    fail "${path} returned Cloudflare challenge HTML"
    return
  fi
  if ! header_has_type "${hdr}" "${ctype}"; then
    fail "${path} Content-Type missing ${ctype}"
    return
  fi
  if [[ -n "${must}" ]] && ! grep -q "${must}" "${body}"; then
    fail "${path} body missing expected content: ${must}"
    return
  fi
  pass "${path} ${code} ${ctype}"
}

check_machine "/robots.txt" "text/plain" "Sitemap:"
check_machine "/sitemap.xml" "xml" "joshternet.org"
check_machine "/.well-known/josh" "json" '"version"'
check_machine "/assets/activity/atom.xml" "xml" "feed"
check_machine "/assets/network/joshternet.opml" "opml" "opml"
check_machine "/network/data.json" "json" "{"

# HTTP Message Signatures directory
sig_hdr="${TMPDIR_SEC}/sig.hdr"
sig_body="${TMPDIR_SEC}/sig.body"
sig_code="$(curl -sS -D "${sig_hdr}" -o "${sig_body}" --max-time 25 -A "${JOSHBOT_UA}" -w '%{http_code}' "${CANONICAL_HOST}/.well-known/http-message-signatures-directory" || printf '000')"
if [[ "${sig_code}" == "200" ]] && header_has_type "${sig_hdr}" "http-message-signatures-directory" && ! looks_like_challenge "${sig_body}"; then
  pass "/.well-known/http-message-signatures-directory structured directory"
else
  fail "/.well-known/http-message-signatures-directory unexpected (status ${sig_code})"
fi

# Button state API
btn_hdr="${TMPDIR_SEC}/btn.hdr"
btn_body="${TMPDIR_SEC}/btn.body"
btn_url="${CANONICAL_HOST}/api/button-state?origin=https://joshua.example"
btn_code="$(curl -sS -D "${btn_hdr}" -o "${btn_body}" --max-time 25 -A "${JOSHBOT_UA}" -w '%{http_code}' "${btn_url}" || printf '000')"
if [[ "${btn_code}" == "200" ]] && header_has_type "${btn_hdr}" "json" && ! looks_like_challenge "${btn_body}"; then
  pass "/api/button-state JSON"
else
  fail "/api/button-state unexpected (status ${btn_code})"
fi

# Optional edge probe (set EDGE_SECURITY_PROBE_PATH to a path operators want to
# assert is rejected). Left unset in-repo so public scripts do not advertise
# blocked paths.
if [[ -n "${EDGE_SECURITY_PROBE_PATH:-}" ]]; then
  probe_code="$(curl -sS -o /dev/null --max-time 20 -A "${JOSHBOT_UA}" -w '%{http_code}' "${CANONICAL_HOST}${EDGE_SECURITY_PROBE_PATH}" || printf '000')"
  if [[ "${probe_code}" == "403" || "${probe_code}" == "444" || "${probe_code}" == "503" ]]; then
    pass "optional probe path rejected (${probe_code})"
  else
    fail "optional probe path expected rejection, got ${probe_code}"
  fi
fi

# Canonical hostname must not appear as github.io in sitemap body
map_body="${TMPDIR_SEC}/map.body"
http_body "${CANONICAL_HOST}/sitemap.xml" "${map_body}" >/dev/null
if grep -q 'https://joshternet.github.io' "${map_body}"; then
  fail "sitemap advertises joshternet.github.io"
else
  pass "sitemap does not advertise joshternet.github.io"
fi

# Non-canonical GitHub Pages host reachability (informational)
gh_code="$(curl -sS -o "${TMPDIR_SEC}/gh.body" --max-time 25 -A "${JOSHBOT_UA}" -L --max-redirs 5 -w '%{http_code}' "${GITHUB_PAGES_HOST}/" || printf '000')"
if [[ "${gh_code}" =~ ^(200|301|302)$ ]]; then
  warn "non-canonical host ${GITHUB_PAGES_HOST} remains reachable (${gh_code}); prefer ${CANONICAL_HOST}"
else
  warn "non-canonical host returned ${gh_code}"
fi

printf '\nSummary: %s fail(s), %s warn(s)\n' "${FAILS}" "${WARNS}"
if [[ "${FAILS}" -gt 0 ]]; then
  exit 1
fi
exit 0
