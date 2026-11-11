# Mosaic of Memories

Results site for CS180 Project 4 (Part A: image warping and mosaicing, Part B:
feature matching for autostitching), live at
https://sane24.github.io/mosaic-of-memories/

This repository holds only the public write-up: page source in `src/`, the
built static site in `docs/` (what GitHub Pages serves), and `build.py`, which
copies result images and numbers from the project's `outputs/manifest.json`
and `outputs/partb/manifest.json` into `docs/`. The image-processing code is
not published here.

```bash
python build.py                                   # rebuild docs/ from ../outputs
python build.py --html                            # re-render the page only, after one full build
python -m http.server 8642 --directory docs       # preview locally
python tools/shoot.py pdf page.pdf                # print-to-PDF (needs playwright)
sh tools/deploy.sh                                # publish docs/ to the gh-pages branch
```

GitHub Pages serves the `gh-pages` branch, which is a copy of `docs/`.
