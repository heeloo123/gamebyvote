"""Record the Day 0 Reel: composer.html (game + captions) driven on a timeline."""
import http.server, threading, functools, time, json, random, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
OUT = ROOT / "out"
OUT.mkdir(exist_ok=True)
PORT = 8765

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=str(ROOT))
srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

# (time_ms, action, arg)
TIMELINE = [
    (0,     "show", "intro"),
    (3200,  "hide", "intro"),
    (3400,  "show", "c1"),
    (5600,  "hide", "c1"),
    (5800,  "show", "c2"),
    (8200,  "hide", "c2"),
    (8400,  "show", "c3"),
    (10400, "hide", "c3"),
    (10500, "show", "c4"),
    (12300, "hide", "c4"),
    (12400, "show", "outro"),
    (12900, "show", "o1"),
    (13300, "show", "o2"),
    (13700, "show", "o3"),
    (17500, "end",  None),
]
# taps on Mochi: a few early, a burst in the middle, a few slow ones at "ONE thing"
TAPS = [4300, 4900] + list(range(6200, 8200, 260)) + [8900, 9700, 10900, 11300, 11600, 11850]

random.seed(7)
with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": 1080, "height": 1920}, device_scale_factor=1,
    )
    page = ctx.new_page()
    t_page = time.monotonic()
    page.goto(f"http://127.0.0.1:{PORT}/composer.html")
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready.then(()=>1)")
    page.evaluate("show('intro')")
    page.wait_for_timeout(600)  # let fonts/intro settle before t=0

    # capture real device-pixel frames via the DevTools screencast
    import base64
    frames_dir = OUT / "frames"; frames_dir.mkdir(exist_ok=True)
    for f in frames_dir.glob("*.jpg"): f.unlink()
    frames = []
    cdp = ctx.new_cdp_session(page)
    def on_frame(ev):
        i = len(frames)
        (frames_dir / f"{i:05d}.jpg").write_bytes(base64.b64decode(ev["data"]))
        frames.append(ev["metadata"]["timestamp"])
        try:
            cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
        except Exception:
            pass  # browser already closing
    cdp.on("Page.screencastFrame", on_frame)
    cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 95, "maxWidth": 1080, "maxHeight": 1920, "everyNthFrame": 1})
    page.wait_for_timeout(300)

    box = page.frame_locator("#game").locator("#pet").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2

    events = [(t, a, x) for t, a, x in TIMELINE] + [(t, "tap", None) for t in TAPS]
    events.sort(key=lambda e: e[0])
    t0 = time.monotonic()
    t0_wall = time.time()
    offset = t0 - t_page
    for t, action, arg in events:
        wait = t / 1000 - (time.monotonic() - t0)
        while wait > 0:
            page.wait_for_timeout(min(wait, 0.05) * 1000)  # keep processing frame events
            wait = t / 1000 - (time.monotonic() - t0)
        if action == "show":
            page.evaluate(f"show('{arg}')")
        elif action == "hide":
            page.evaluate(f"hide('{arg}')")
        elif action == "tap":
            page.mouse.click(cx + random.uniform(-100, 100), cy + random.uniform(-70, 70))
        elif action == "end":
            break
    duration = time.monotonic() - t0
    cdp.send("Page.stopScreencast")
    ctx.close()
    browser.close()

# build an ffmpeg concat list: frames sorted by capture time, each held until the next, clipped to [t0, t0+duration]
end = t0_wall + duration
order = sorted(range(len(frames)), key=lambda i: frames[i])
lines = []
for k, i in enumerate(order):
    ts = frames[i]
    nxt = frames[order[k + 1]] if k + 1 < len(order) else end
    d = min(nxt, end) - max(ts, t0_wall)
    if d <= 0:
        continue
    lines.append(f"file 'frames/{i:05d}.jpg'\nduration {d:.4f}")
lines.append(lines[-1].split("\n")[0])
(OUT / "concat.txt").write_text("\n".join(lines) + "\n")
print(json.dumps({"frames": len(frames), "used": len(lines) - 1, "duration": round(duration, 2)}))
(OUT / "ts.json").write_text(json.dumps({"t0": t0_wall, "dur": duration, "ts": frames}))
srv.shutdown()
