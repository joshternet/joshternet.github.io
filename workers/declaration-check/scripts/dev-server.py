#!/usr/bin/env python3
"""Local stand-in for the declaration-check Worker during Jekyll development.

Mirrors production controls: allowlisted Origin required, only
/.well-known/josh, no automatic cross-origin redirects, size/time limits.
Rate limits are not enforced locally.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

ALLOWED = {
    "https://joshternet.org",
    "http://127.0.0.1:4000",
    "http://localhost:4000",
}
HOST = "127.0.0.1"
PORT = 8789
DECLARATION_PATH = "/.well-known/josh"
MAX_BODY_BYTES = 65536
IP_LITERAL = re.compile(r"^\d{1,3}(?:\.\d{1,3}){3}$")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print("declaration-check:", fmt % args, flush=True)

    def cors(self, origin: str) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "Vary": "Origin",
        }
        if origin in ALLOWED:
            headers.update(
                {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Max-Age": "86400",
                }
            )
        return headers

    def send_json(self, status: int, body: dict, headers: dict[str, str]) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        for key, value in headers.items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin", "")
        headers = self.cors(origin)
        if origin not in ALLOWED:
            self.send_json(
                403,
                {
                    "error": "origin_not_allowed",
                    "message": "This browser origin is not allowed to use the checker.",
                },
                headers,
            )
            return
        self.send_response(204)
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()

    def origin_of(self, url: urllib.parse.ParseResult) -> str:
        port = f":{url.port}" if url.port else ""
        return f"{url.scheme}://{url.hostname}{port}"

    def allowed_declaration_url(self, requested: str, candidate: str) -> bool:
        try:
            url = urlparse(candidate)
        except Exception:
            return False
        if not url.hostname or self.origin_of(url) != requested:
            return False
        if url.username or url.password:
            return False
        if url.path != DECLARATION_PATH:
            return False
        if url.query or url.fragment:
            return False
        return True

    def do_GET(self) -> None:  # noqa: N802
        browser_origin = self.headers.get("Origin", "")
        headers = self.cors(browser_origin)
        parsed = urlparse(self.path)

        if parsed.path != "/v1/declaration-check":
            self.send_json(
                404, {"error": "not_found", "message": "Not found."}, headers
            )
            return

        if not browser_origin or browser_origin not in ALLOWED:
            self.send_json(
                403,
                {
                    "error": "origin_not_allowed",
                    "message": "This browser origin is not allowed to use the checker.",
                },
                headers,
            )
            return

        value = (parse_qs(parsed.query).get("origin") or [None])[0]
        if not value:
            self.send_json(
                400,
                {
                    "error": "origin_required",
                    "message": "An origin URL is required.",
                },
                headers,
            )
            return

        try:
            target = urlparse(value)
            if target.scheme not in {"http", "https"} or not target.hostname:
                raise ValueError("invalid")
            host = target.hostname.lower().rstrip(".")
            if (
                host == "localhost"
                or host == "metadata.google.internal"
                or host.endswith(
                    (".localhost", ".local", ".lan", ".internal", ".localdomain")
                )
                or ":" in host
                or IP_LITERAL.fullmatch(host)
            ):
                raise ValueError("private")
            port = f":{target.port}" if target.port else ""
            requested = f"{target.scheme}://{host}{port}"
            declaration_url = f"{requested}{DECLARATION_PATH}"
        except Exception:
            self.send_json(
                400,
                {
                    "error": "invalid_origin",
                    "message": "Enter a valid public origin URL.",
                },
                headers,
            )
            return

        try:
            final_url, status, content_type, body, error = self.fetch_declaration(
                declaration_url, requested
            )
            self.send_json(
                200,
                {
                    "ok": error is None,
                    "requestedOrigin": requested,
                    "declarationURL": declaration_url,
                    "finalURL": final_url,
                    "status": status,
                    "contentType": content_type,
                    "body": body,
                    "error": error,
                },
                headers,
            )
        except Exception:
            self.send_json(
                200,
                {
                    "ok": False,
                    "requestedOrigin": requested,
                    "declarationURL": declaration_url,
                    "finalURL": None,
                    "status": None,
                    "contentType": "",
                    "body": None,
                    "error": "network",
                },
                headers,
            )

    def fetch_declaration(self, declaration_url: str, requested: str):
        opener = urllib.request.build_opener(NoRedirect)
        req = urllib.request.Request(
            declaration_url,
            headers={
                "User-Agent": "JoshternetDeclarationCheck/1.0",
                "Accept": "application/json",
            },
        )
        try:
            with opener.open(req, timeout=10) as upstream:
                raw = upstream.read(MAX_BODY_BYTES + 1)
                if len(raw) > MAX_BODY_BYTES:
                    return (
                        upstream.geturl(),
                        upstream.status,
                        upstream.headers.get("Content-Type") or "",
                        None,
                        "response_too_large",
                    )
                return (
                    upstream.geturl(),
                    upstream.status,
                    upstream.headers.get("Content-Type") or "",
                    raw.decode("utf-8", "replace"),
                    None,
                )
        except urllib.error.HTTPError as err:
            if 300 <= err.code < 400:
                location = err.headers.get("Location")
                if not location:
                    return declaration_url, err.code, "", None, "redirect"
                next_url = urllib.parse.urljoin(declaration_url, location)
                if not self.allowed_declaration_url(requested, next_url):
                    return next_url, err.code, "", None, "redirect"
                follow = urllib.request.Request(
                    next_url,
                    headers={
                        "User-Agent": "JoshternetDeclarationCheck/1.0",
                        "Accept": "application/json",
                    },
                )
                with urllib.request.build_opener(NoRedirect).open(
                    follow, timeout=10
                ) as upstream:
                    raw = upstream.read(MAX_BODY_BYTES + 1)
                    if len(raw) > MAX_BODY_BYTES:
                        return (
                            upstream.geturl(),
                            upstream.status,
                            upstream.headers.get("Content-Type") or "",
                            None,
                            "response_too_large",
                        )
                    return (
                        upstream.geturl(),
                        upstream.status,
                        upstream.headers.get("Content-Type") or "",
                        raw.decode("utf-8", "replace"),
                        None,
                    )
            raw = err.read(MAX_BODY_BYTES + 1)
            too_large = len(raw) > MAX_BODY_BYTES
            return (
                declaration_url,
                err.code,
                err.headers.get("Content-Type") or "",
                None if too_large else raw.decode("utf-8", "replace"),
                "response_too_large" if too_large else None,
            )


def main() -> None:
    print(f"listening on http://{HOST}:{PORT}", flush=True)
    HTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
