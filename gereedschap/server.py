"""Lokale testserver zonder cache, zodat gewijzigde modules meteen geladen worden.

Gebruik: python gereedschap/server.py [poort]   (vanuit de projectmap)
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROJECTMAP = Path(__file__).resolve().parent.parent
STANDAARD_POORT = 8123


class GeenCacheHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".webmanifest": "application/manifest+json"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    poort = int(sys.argv[1]) if len(sys.argv) > 1 else STANDAARD_POORT
    handler = partial(GeenCacheHandler, directory=str(PROJECTMAP))
    with ThreadingHTTPServer(("127.0.0.1", poort), handler) as server:
        print(f"Functiefoto op http://localhost:{poort}")
        server.serve_forever()


if __name__ == "__main__":
    main()
