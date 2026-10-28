# Mosaic of Memories

Results site for CS180/280A Project 4A (image warping and mosaicing), live at
https://sane24.github.io/mosaic-of-memories/

This repository holds only the public write-up: page source in `src/`, the
built static site in `docs/` (what GitHub Pages serves), and `build.py`, which
copies result images and numbers from the project's `outputs/manifest.json`
into `docs/`. The image-processing code is not published here.

```bash
python build.py                                   # rebuild docs/ from ../outputs
python -m http.server 8642 --directory docs       # preview locally
python tools/shoot.py pdf page.pdf                # print-to-PDF (needs playwright)
sh tools/deploy.sh                                # publish docs/ to the gh-pages branch
```

GitHub Pages serves the `gh-pages` branch, which is a copy of `docs/`.
