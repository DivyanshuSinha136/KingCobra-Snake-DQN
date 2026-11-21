#!/usr/bin/env python3
"""Record a gameplay video of the dashboard (AI plays, then a human takes over) with headless Chromium + ffmpeg.

    pip install playwright && playwright install chromium     # and ffmpeg on your PATH
    make serve                                                 # in another terminal
    python3 scripts/record_video.py [http://127.0.0.1:8765]

Writes docs/media/gameplay.mp4 (H.264) and docs/img/gameplay.gif (looping, README-friendly).
"""
import glob, os, shutil, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"
HERE = os.path.dirname(os.path.abspath(__file__))
MEDIA = os.path.join(HERE, "..", "docs", "media")
IMG = os.path.join(HERE, "..", "docs", "img")
os.makedirs(MEDIA, exist_ok=True)
W, H = 1280, 960

tmp = tempfile.mkdtemp(prefix="snake_rec_")
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": W, "height": H}, record_video_dir=tmp, record_video_size={"width": W, "height": H})
    pg = ctx.new_page()
    pg.goto(URL + "/")
    pg.evaluate("localStorage.clear()")
    pg.reload()
    pg.wait_for_selector("#features .frow")

    def set_speed(v):                                # no fill()/click(): those scroll the page
        pg.evaluate("v => { const s = document.getElementById('speed'); s.value = v; s.dispatchEvent(new Event('input')); }", v)

    def state():
        return pg.evaluate("() => fetch('/api/state?sid=' + sessionStorage.getItem('snake-dqn:sid')).then(r => r.json())")

    def steer(s):
        """A tiny human-like player: head for the food, never step into a wall or the body, never reverse."""
        n = s["size"]; hr, hc = s["snake"][0]; fr, fc = s["food"]; body = {tuple(x) for x in s["snake"][:-1]}
        moves = {0: (-1, 0), 1: (0, 1), 2: (1, 0), 3: (0, -1)}
        want = []
        if abs(fr - hr) >= abs(fc - hc): want = [0 if fr < hr else 2, 1 if fc > hc else 3]
        else: want = [1 if fc > hc else 3, 0 if fr < hr else 2]
        cands = want + [d for d in range(4) if d not in want]
        for d in cands:
            if d == (s["dir"] + 2) % 4: continue
            r, c = hr + moves[d][0], hc + moves[d][1]
            if 0 <= r < n and 0 <= c < n and (r, c) not in body: return d
        return s["dir"]

    pg.evaluate("window.scrollTo(0, 0)")
    set_speed(20)
    time.sleep(10)                                   # the AI plays on its own
    pg.evaluate("document.getElementById('btnReset').click()")
    set_speed(5); time.sleep(0.8)
    t_end = time.time() + 10                          # a "human" takes over with the arrow keys
    while time.time() < t_end:
        s = state()
        if s["done"]: break
        pg.keyboard.press(["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"][steer(s)])
        time.sleep(0.07)                             # decide faster than the game ticks (5/s)
    time.sleep(1.2)
    pg.keyboard.press("m"); time.sleep(0.6)          # hand control back to the AI (this resets the board)
    pg.keyboard.press("Space")
    set_speed(20)
    time.sleep(6)
    ctx.close(); b.close()

webm = glob.glob(os.path.join(tmp, "*.webm"))[0]
mp4 = os.path.join(MEDIA, "gameplay.mp4")
gif = os.path.join(IMG, "gameplay.gif")
trim = ["-ss", "1.2"]                                # skip the page-load flash
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *trim, "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-crf", "24", "-preset", "slow", "-movflags", "+faststart", "-an", mp4], check=True)
palette = os.path.join(tmp, "pal.png")
vf = "crop=1280:760:0:0,fps=10,scale=720:-1:flags=lanczos"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *trim, "-i", webm, "-vf", vf + ",palettegen=max_colors=64:stats_mode=diff", palette], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *trim, "-i", webm, "-i", palette, "-lavfi",
                vf + "[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", "-loop", "0", gif], check=True)
shutil.rmtree(tmp, ignore_errors=True)
print("wrote", os.path.normpath(mp4), os.path.getsize(mp4) // 1024, "KB;", os.path.normpath(gif), os.path.getsize(gif) // 1024, "KB")
