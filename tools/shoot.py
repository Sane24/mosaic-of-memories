"""Screenshots and the print PDF of the built site, using the local Chrome.

    python tools/shoot.py shots OUTDIR [width] [height]   # one screenshot per section
    python tools/shoot.py pdf OUT.pdf [url]               # print the page to PDF
"""
import sys
from playwright.sync_api import sync_playwright

URL = "http://localhost:8642/"


def shots(out, width=1440, height=900):
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
        errors = []
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(URL, wait_until="networkidle")
        pg.wait_for_timeout(5500)
        pg.screenshot(path=f"{out}/00_hero.png")
        for sid in ["fragments", "points", "perspective", "stitching", "plate-1", "plate-2", "plate-3", "seams", "behind", "gallery"]:
            pg.evaluate(f"document.getElementById('{sid}').scrollIntoView()")
            pg.wait_for_timeout(1400)
            pg.screenshot(path=f"{out}/{sid}.png")
        h = pg.evaluate("document.documentElement.scrollHeight")
        sw = pg.evaluate("document.documentElement.scrollWidth")
        print("page height", h, "scrollWidth", sw, "viewport", width)
        print("console errors:", errors)
        b.close()


def pdf(out, url=URL):
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page(viewport={"width": 1280, "height": 900})
        pg.goto(url, wait_until="networkidle")
        # load every lazy image before printing
        pg.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager')")
        pg.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        pg.wait_for_timeout(3000)
        pg.evaluate("Promise.all([...document.images].map(i => i.decode().catch(() => {})))")
        pg.wait_for_timeout(1500)
        pg.emulate_media(media="print")
        pg.pdf(path=out, format="Letter", print_background=True, prefer_css_page_size=True)
        b.close()


if __name__ == "__main__":
    if sys.argv[1] == "shots":
        shots(sys.argv[2], *map(int, sys.argv[3:5]))
    else:
        pdf(sys.argv[2], *sys.argv[3:4])
