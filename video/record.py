"""Record one episode's Reel frames.

Usage: python3 record.py <episode>     (reads episodes/<episode>/episode.json)

Plays the episode's timeline on composer.html in headless Chromium and captures real 1080x1920 frames.
Output: out/frames/*.jpg, out/concat.txt (FFmpeg concat list with real frame timings), out/duration.txt.
make_reel.sh turns these into the finished Reel.
"""
import base64, functools, http.server, json, random, sys, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

VIDEO = Path(__file__).resolve().parent
REPO = VIDEO.parent                  # web root, so the composer can load ../styles/* and other game files
OUT = VIDEO / "out"
PORT = 8765

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def events_for(ep):
    """Timeline entries plus tap events, sorted by time."""
    ev = [tuple(e) for e in ep["timeline"]] + [(ep["durationMs"], "end", None)]
    # warm each screen up 600 ms before it appears, so the switch doesn't stall the capture
    ev += [(max(0, t - 600), "warm", arg) for t, action, arg in ep["timeline"] if action == "screen"]
    for t in ep.get("taps", []):
        ev += [(ms, "tap", t["screen"]) for ms in range(t["fromMs"], t["toMs"], t["everyMs"])]
    return sorted(ev, key=lambda e: e[0])

def main(name):
    ep = json.loads((VIDEO / "episodes" / name / "episode.json").read_text())
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
        page.goto(f"http://127.0.0.1:{PORT}/video/composer.html?ep={name}")
        page.evaluate("window.ready")
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready.then(() => 1)")
        page.wait_for_timeout(1200)              # let every screen load its fonts

        cdp = ctx.new_cdp_session(page)
        def on_frame(e):
            i = len(frames)
            (frames_dir / f"{i:05d}.jpg").write_bytes(base64.b64decode(e["data"]))
            frames.append(e["metadata"]["timestamp"])
            try:
                cdp.send("Page.screencastFrameAck", {"sessionId": e["sessionId"]})
            except Exception:
                pass                             # browser already closing
        cdp.on("Page.screencastFrame", on_frame)
        cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 95, "maxWidth": 1080, "maxHeight": 1920})
        page.wait_for_timeout(300)

        t0, t0_wall = time.monotonic(), time.time()
        for t, action, arg in events_for(ep):
            while (wait := t / 1000 - (time.monotonic() - t0)) > 0:
                page.wait_for_timeout(min(wait, 0.05) * 1000)   # keeps frame events flowing
            if action == "end":
                break
            if action == "tap":
                box = page.frame_locator(f"#s_{arg}").locator("#pet").bounding_box()
                page.mouse.click(box["x"] + box["width"] * random.uniform(0.3, 0.7),
                                 box["y"] + box["height"] * random.uniform(0.35, 0.7))
            elif action == "screen":
                page.evaluate("id => showScreen(id)", arg)
            elif action in ("show", "hide", "option", "warm"):
                page.evaluate(f"a => {action}(a)", arg)
            elif action == "nobadge":
                page.evaluate("nobadge()")
            else:
                raise ValueError(f"unknown timeline action: {action}")
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
    gaps = [frames[order[k + 1]] - frames[order[k]] for k in range(len(order) - 1)]
    worst = max(gaps) if gaps else 0
    print(json.dumps({"episode": name, "frames": len(frames), "used": len(lines) - 1,
                      "duration": round(duration, 2), "longest_gap_s": round(worst, 3)}))
    if worst > 0.4:
        print(f"WARNING: capture stalled for {worst:.2f}s; the Reel will show a freeze there. Re-run to fix.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 record.py <episode>")
    main(sys.argv[1])
