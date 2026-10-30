"""Record a Reel: plays a timeline on composer.html in headless Chromium and captures 1080x1920 frames.

Output: out/frames/*.jpg plus out/concat.txt (an FFmpeg concat list with real frame timings)
and out/duration.txt. make_reel.sh turns these into out/reel.mp4.
"""
import base64, functools, http.server, json, random, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

VIDEO = Path(__file__).resolve().parent
REPO = VIDEO.parent                  # served as web root so the composer can load ../styles/*
OUT = VIDEO / "out"
PORT = 8765

# (time_ms, action, arg)  actions: show / hide <element id>, style <name>, badge <name>, nobadge, tap <style>, end
TIMELINE = [
    (0,     "show", "intro"),
    (3000,  "hide", "intro"),
    (3200,  "show", "c1"),
    (5400,  "hide", "c1"),
    (5600,  "badge", "pixel"),
    (5600,  "show", "c2"),
    (7700,  "hide", "c2"),
    (8800,  "style", "cartoon"),
    (8900,  "show", "c3"),
    (11200, "hide", "c3"),
    (11800, "style", "clay"),
    (13200, "show", "c4"),
    (14800, "hide", "c4"),
    (14900, "nobadge", None),
    (15000, "show", "outro"),
    (15500, "show", "o1"),
    (15900, "show", "o2"),
    (16300, "show", "o3"),
    (21000, "end",  None),
]
TAPS = (
    [("pixel", t) for t in range(5900, 8600, 230)]
    + [("cartoon", t) for t in range(9100, 11600, 260)]
    + [("clay", t) for t in range(12100, 14600, 260)]
)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def main():
    OUT.mkdir(exist_ok=True)
    frames_dir = OUT / "frames"
    frames_dir.mkdir(exist_ok=True)
    for f in frames_dir.glob("*.jpg"):
        f.unlink()

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=str(REPO)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    random.seed(7)
    frames = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(f"http://127.0.0.1:{PORT}/video/composer.html")
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready.then(() => 1)")
        page.evaluate("setStyle('pixel', false); show('intro')")
        page.wait_for_timeout(1200)              # let every iframe load its fonts

        cdp = ctx.new_cdp_session(page)
        def on_frame(ev):
            i = len(frames)
            (frames_dir / f"{i:05d}.jpg").write_bytes(base64.b64decode(ev["data"]))
            frames.append(ev["metadata"]["timestamp"])
            try:
                cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
            except Exception:
                pass                             # browser already closing
        cdp.on("Page.screencastFrame", on_frame)
        cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 95, "maxWidth": 1080, "maxHeight": 1920})
        page.wait_for_timeout(300)

        events = sorted(TIMELINE + [(t, "tap", s) for s, t in TAPS], key=lambda e: e[0])
        t0, t0_wall = time.monotonic(), time.time()
        for t, action, arg in events:
            while (wait := t / 1000 - (time.monotonic() - t0)) > 0:
                page.wait_for_timeout(min(wait, 0.05) * 1000)   # keeps frame events flowing
            if action == "show":
                page.evaluate(f"show('{arg}')")
            elif action == "hide":
                page.evaluate(f"hide('{arg}')")
            elif action in ("style", "badge"):
                page.evaluate(f"setStyle('{arg}')")
            elif action == "nobadge":
                page.evaluate("hideBadges()")
            elif action == "tap":
                box = page.frame_locator(f"#f_{arg}").locator("#pet").bounding_box()
                page.mouse.click(box["x"] + box["width"] * random.uniform(0.3, 0.7),
                                 box["y"] + box["height"] * random.uniform(0.35, 0.7))
            elif action == "end":
                break
        duration = time.monotonic() - t0
        cdp.send("Page.stopScreencast")
        ctx.close()
        browser.close()
    srv.shutdown()

    # concat list: frames sorted by capture time, each held until the next, clipped to [t0, t0 + duration]
    end = t0_wall + duration
    order = sorted(range(len(frames)), key=lambda i: frames[i])
    lines = []
    for k, i in enumerate(order):
        nxt = frames[order[k + 1]] if k + 1 < len(order) else end
        d = min(nxt, end) - max(frames[i], t0_wall)
        if d > 0:
            lines.append(f"file 'frames/{i:05d}.jpg'\nduration {d:.4f}")
    lines.append(lines[-1].split("\n")[0])
    (OUT / "concat.txt").write_text("\n".join(lines) + "\n")
    (OUT / "duration.txt").write_text(f"{duration:.3f}\n")
    print(json.dumps({"frames": len(frames), "used": len(lines) - 1, "duration": round(duration, 2)}))

if __name__ == "__main__":
    main()
