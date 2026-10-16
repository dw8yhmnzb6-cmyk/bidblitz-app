#!/usr/bin/env python3
"""Serve a production React build for Visual QA with SPA route fallback."""

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        requested = urlparse(self.path).path
        candidate = Path(self.directory) / requested.lstrip("/")
        if requested != "/" and not candidate.exists():
            self.path = "/index.html"
        super().do_GET()

    def end_headers(self):
        if self.path == "/index.html" or self.path == "/":
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", required=True)
    parser.add_argument("--port", type=int, default=3000)
    args = parser.parse_args()

    build_dir = Path(args.directory).resolve()
    index = build_dir / "index.html"
    if not index.is_file():
        raise SystemExit(f"Missing production build: {index}")

    os.chdir(build_dir)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), SpaHandler)
    print(f"Serving {build_dir} on http://127.0.0.1:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
