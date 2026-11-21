#!/usr/bin/env python3
"""Capture the dashboard screenshots in docs/img/ with headless Chromium.

    pip install playwright && playwright install chromium
    make serve          # in another terminal (or: kingcobra run src/main.kc serve)
    python3 scripts/screenshots.py [http://127.0.0.1:8765]

The AI plays on its own; the script lets it run for a few seconds, runs a benchmark and takes the pictures.
"""
import os, sys, time
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8765"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "img") + os.sep

with sync_playwright() as p:
    b = p.chromium.launch()
    errs=[]
    pg = b.new_page(viewport={'width':1280,'height':900}, device_scale_factor=2)
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '/')
    pg.evaluate("localStorage.clear()")
    pg.wait_for_selector('#features .frow')
    # speed up so the snake has grown a bit by the time we capture
    pg.fill('#speed','30'); pg.dispatch_event('#speed','input')
    time.sleep(9)
    # benchmark
    pg.select_option('#benchN','20'); pg.click('#btnBench')
    pg.wait_for_selector('#benchOut:not(.is-hidden)', timeout=60000)
    time.sleep(1)
    pg.fill('#speed','12'); pg.dispatch_event('#speed','input')
    time.sleep(1.2)
    pg.screenshot(path=OUT+'dashboard.png', full_page=True)
    # board close-up
    pg.locator('.board-card').screenshot(path=OUT+'board.png')
    # curves with hover
    box = pg.locator('#curve').bounding_box()
    pg.mouse.move(box['x']+box['width']*0.78, box['y']+box['height']*0.5); time.sleep(0.3)
    pg.locator('.chart-wrap').locator('xpath=ancestor::section').screenshot(path=OUT+'training-curves.png')
    pg.mouse.move(5,5)
    pg.locator('#benchOut').locator('xpath=ancestor::section').screenshot(path=OUT+'benchmark.png')
    pg.locator('#qbars').locator('xpath=ancestor::section').screenshot(path=OUT+'qvalues.png')
    # human mode: take over with a key
    pg.keyboard.press('ArrowDown'); time.sleep(0.6); pg.keyboard.press('ArrowRight'); time.sleep(0.3)
    pg.screenshot(path=OUT+'human-mode.png', clip={'x':0,'y':0,'width':1280,'height':820})
    # mobile
    m = b.new_page(viewport={'width':390,'height':844}, device_scale_factor=2)
    m.on('console', lambda x: errs.append(x.text) if x.type in ('error','warning') else None)
    m.goto(URL + '/'); m.wait_for_selector('#features .frow'); time.sleep(5)
    m.screenshot(path=OUT+'mobile.png', full_page=False)
    print('errors:', errs)
    b.close()
