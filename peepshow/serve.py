"""Serve this exact extracted site and open it only after binding a free port."""
from __future__ import annotations
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent
BUILD = 'Peepshow Product v11'

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header('X-Peepshow-Build', 'product-v11')
        if self.path.split('?', 1)[0].endswith(('.html', '.js', '.css', '.json')) or self.path == '/':
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

def main() -> None:
    parser = argparse.ArgumentParser(description=BUILD)
    parser.add_argument('--host', default='127.0.0.1', help='Use 0.0.0.0 only for testing on a trusted local network.')
    parser.add_argument('--port', type=int, default=8777, help='First port to try.')
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    if not (ROOT / 'index.html').is_file():
        raise SystemExit('index.html is missing. Extract the complete ZIP first.')
    server = None
    for port in range(args.port, min(args.port + 20, 65536)):
        try:
            server = ThreadingHTTPServer((args.host, port), partial(Handler, directory=str(ROOT)))
            break
        except OSError:
            continue
    if server is None:
        raise SystemExit('No free port in the requested range. Close an old server or pass --port 8800.')
    port = server.server_address[1]
    url = f'http://localhost:{port}/'
    print(f'\n{BUILD}\nFolder: {ROOT}\nOpen:   {url}', flush=True)
    if port != args.port:
        print(f'Port {args.port} was busy. This site is using {port}; no older server was opened.', flush=True)
    if args.host == '0.0.0.0':
        print(f'Phone testing: open http://<this computer LAN address>:{port}/ on the same trusted network.', flush=True)
    print('Keep this window open. Press Ctrl+C to stop.\n', flush=True)
    if not args.no_browser:
        timer = threading.Timer(0.35, lambda: webbrowser.open(url))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
