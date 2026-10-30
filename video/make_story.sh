#!/usr/bin/env bash
# Renders an episode's Story graphic: ./make_story.sh <episode>  ->  ../reels/<episode>-story.png (1080x1920)
# Share it to the Instagram Story and place a poll sticker in the empty middle area.
set -euo pipefail
cd "$(dirname "$0")"
EP="${1:?usage: ./make_story.sh <episode>}"
mkdir -p ../reels
python3 - "$EP" <<'PY'
import functools, http.server, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ep, video = sys.argv[1], Path.cwd()
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8767), functools.partial(Quiet, directory=str(video.parent)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1080, "height": 1920})
    page.goto(f"http://127.0.0.1:8767/video/story.html?ep={ep}")
    page.evaluate("window.ready")
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready.then(() => 1)")
    page.wait_for_timeout(1500)
    page.screenshot(path=str(video.parent / "reels" / f"{ep}-story.png"))
    b.close()
srv.shutdown()
PY
echo "Done: reels/$EP-story.png"
