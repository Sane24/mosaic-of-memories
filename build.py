"""Build the public results site from ../outputs (results only, no solution code).

    python build.py            # writes docs/ (the deployable static site)

    python build.py --html     # only re-render the page and copy css/js (after one full build)

Reads ../outputs/manifest.json (Part A) and ../outputs/partb/manifest.json
(Part B) with the figures next to them, re-encodes them for the web, writes
docs/assets/data.js for the interactive pieces, and fills the {{placeholders}}
in src/index.html with the real numbers.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
OUTPUTS = PROJECT / "outputs"
SRC = HERE / "src"
DOCS = HERE / "docs"
IMG = DOCS / "assets" / "img"
SITE_URL = "https://sane24.github.io/mosaic-of-memories/"

# Seam close-ups (fractions of the canvas) for the comparison sliders.
DETAIL = {"mosaic1": [0.30, 0.36, 0.47, 0.76],
          "mosaic2": [0.38, 0.36, 0.58, 0.80],
          "mosaic3": [0.47, 0.25, 0.67, 0.70]}
TITLES = {"mosaic1": "Last Light Over the Bay",
          "mosaic2": "Zoology & Botany",
          "mosaic3": "Halloween at the Tea Counter"}
ROMAN = {"mosaic1": "I", "mosaic2": "II", "mosaic3": "III"}
CACHE = HERE / ".cache" / "build.json"

# Part B seam close-ups, in reference-frame pixels (x0, y0, x1, y1).
SEAM_B = {"mosaic1": (1250, 700, 1800, 1180),
          "mosaic2": (60, 420, 760, 1020),
          "mosaic3": (1050, 150, 1750, 1000)}


# --------------------------------------------------------------------------
# image helpers
# --------------------------------------------------------------------------

def open_rgba(path: Path) -> Image.Image:
    return Image.open(OUTPUTS.parent / path).convert("RGBA")


def fit(im: Image.Image, width: int | None = None, long_side: int | None = None) -> Image.Image:
    w, h = im.size
    scale = 1.0
    if width and w > width:
        scale = width / w
    if long_side and max(w, h) > long_side:
        scale = long_side / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)
    return im


def save_webp(im: Image.Image, name: str, quality: int = 82, lossless: bool = False) -> str:
    IMG.mkdir(parents=True, exist_ok=True)
    im.save(IMG / name, "WEBP", quality=quality, lossless=lossless, method=6)
    return f"assets/img/{name}"


def save_jpg(im: Image.Image, name: str, quality: int = 86, bg=(16, 23, 33)) -> str:
    IMG.mkdir(parents=True, exist_ok=True)
    if im.mode == "RGBA":
        base = Image.new("RGB", im.size, bg)
        base.paste(im, mask=im.split()[3])
        im = base
    im.convert("RGB").save(IMG / name, "JPEG", quality=quality, optimize=True, progressive=True)
    return f"assets/img/{name}"


def crop_frac(im: Image.Image, box: list[float]) -> Image.Image:
    w, h = im.size
    return im.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)))


# --------------------------------------------------------------------------
# math helpers (presentation only)
# --------------------------------------------------------------------------

def apply_h(H, pts):
    H = np.asarray(H, float)
    p = np.column_stack((np.asarray(pts, float), np.ones(len(pts))))
    q = (H @ p.T).T
    return q[:, :2] / q[:, 2:]


def overlap_fraction(H, size_a, size_b, step=6) -> float:
    ys, xs = np.mgrid[0:size_a[1]:step, 0:size_a[0]:step]
    q = apply_h(H, np.column_stack((xs.ravel(), ys.ravel())))
    return float(((q[:, 0] >= 0) & (q[:, 0] < size_b[0]) & (q[:, 1] >= 0) & (q[:, 1] < size_b[1])).mean())


def fmt(v: float, digits: int = 4) -> str:
    """Matrix entry: fixed notation for normal values, x10^k for tiny ones."""
    if v == 0:
        return "0"
    if abs(v) < 1e-2:
        exp = int(np.floor(np.log10(abs(v))))
        return f"{v / 10 ** exp:.{digits - 1}f}<small>&times;10<sup>{exp}</sup></small>".replace("-", "&minus;", 1) \
            if v < 0 else f"{v / 10 ** exp:.{digits - 1}f}<small>&times;10<sup>{exp}</sup></small>"
    s = f"{v:.{digits}f}" if abs(v) < 100 else f"{v:.2f}"
    return s.replace("-", "&minus;")


def matrix_html(H, cls: str = "") -> str:
    cells = "".join(f"<span>{fmt(v)}</span>" for row in H for v in row)
    return f'<div class="matrix {cls}" role="img" aria-label="3 by 3 homography matrix">{cells}</div>'


def exif_line(e: dict) -> str:
    shutter = e.get("ExposureTime")
    sh = f"1/{round(1 / shutter)}" if shutter else "?"
    return f"{int(e.get('FocalLengthIn35mmFilm', 0))}mm eq &middot; f/{e.get('FNumber', 0):.2f} &middot; {sh}s &middot; ISO {int(e.get('ISOSpeedRatings', 0))}"


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------

def build_mosaic(mo: dict, values: dict, data: dict) -> None:
    name = mo["name"]
    key = name[-1]
    out = {"name": name, "title": TITLES[name], "frames": [], "pairs": []}
    full = open_rgba(mo["outputs"]["mosaic"])
    W, H = full.size
    out["src"] = save_webp(fit(full, 2400), f"{name}_feathered_2400.webp")
    out["full"] = save_webp(fit(full, 5600), f"{name}_feathered_full.webp", quality=80)
    out["print"] = save_jpg(fit(full, 2000), f"{name}_feathered_print.jpg", bg=(255, 255, 255))
    out["aspect"] = W / H
    hard = open_rgba(mo["outputs"]["hard_seam"])
    two = open_rgba(mo["outputs"]["two_band"])
    box = DETAIL[name]
    out["detail_box"] = box
    for label, im in (("hard", hard), ("feather", full), ("twoband", two)):
        crop = fit(crop_frac(im, box), 1500)
        out[f"detail_{label}"] = save_jpg(crop, f"{name}_detail_{label}.jpg", quality=88)
    out["detail_aspect"] = (box[2] - box[0]) * W / ((box[3] - box[1]) * H)
    # warped layers (hero uses mosaic1) and per-frame blending shares
    for i, f in enumerate(mo["frames"]):
        src = Image.open(PROJECT / f["source"]).convert("RGB")
        e = f["exif"]
        frame = {"file": f["file"], "size": f["size"], "exif": exif_line(e),
                 "cam": {"f": e.get("FNumber"), "t": e.get("ExposureTime"), "iso": e.get("ISOSpeedRatings"),
                         "mm": e.get("FocalLengthIn35mmFilm")},
                 "src": save_jpg(fit(src, long_side=1600), f"{name}_frame{i + 1}.jpg", quality=84)}
        warped = open_rgba(mo["outputs"]["warped"][i])
        frame["warped"] = save_webp(fit(warped, 2400), f"{name}_warped{i + 1}.webp", quality=78)
        alpha = Image.open(PROJECT / mo["outputs"]["alphas"][i]).convert("L")
        frame["alpha"] = save_jpg(fit(alpha, 1400), f"{name}_alpha{i + 1}.jpg", quality=84, bg=(0, 0, 0))
        share = warped.copy()
        share.putalpha(alpha)
        frame["share"] = save_webp(fit(share, 1600), f"{name}_share{i + 1}.webp", quality=78)
        # footprint polygon of this frame on the canvas, as fractions
        frame["footprint"] = [[x / W, y / H] for x, y in mo["footprints"][i]]
        out["frames"].append(frame)
    weights = open_rgba(mo["outputs"]["weights"])
    out["weights"] = save_jpg(fit(weights, 2400), f"{name}_weights.jpg", quality=84)
    out["weights_print"] = save_jpg(fit(weights, 1600), f"{name}_weights_print.jpg", bg=(255, 255, 255))
    for p in mo["pairs"]:
        a, b = mo["frames"][p["from"]], mo["frames"][p["to"]]
        fa = [[(x + .5) / a["size"][0], (y + .5) / a["size"][1]] for x, y in p["points_from"]]
        fb = [[(x + .5) / b["size"][0], (y + .5) / b["size"][1]] for x, y in p["points_to"]]
        # each frame's view of the other: corners of the partner mapped into it
        Hinv = np.linalg.inv(np.array(p["H"]))
        wb, hb = b["size"]
        wa, ha = a["size"]
        poly_in_a = apply_h(Hinv, [[0, 0], [wb - 1, 0], [wb - 1, hb - 1], [0, hb - 1]])
        poly_in_b = apply_h(p["H"], [[0, 0], [wa - 1, 0], [wa - 1, ha - 1], [0, ha - 1]])
        fig = Image.open(PROJECT / p["figure"]).convert("RGB")
        tag = f"{Path(a['file']).stem[-2:]}{Path(b['file']).stem[-2:]}".replace("_", "")
        out["pairs"].append({
            "from": p["from"], "to": p["to"], "count": p["count"], "labels": p["labels"],
            "a": fa, "b": fb, "errors": p["errors"], "H": p["H"],
            "matrix": matrix_html(p["H"]),
            "mean": p["error_mean"], "max": p["error_max"], "rms": p["error_rms"],
            "overlap": overlap_fraction(p["H"], a["size"], b["size"]),
            "poly_in_a": [[x / wa, y / ha] for x, y in poly_in_a],
            "poly_in_b": [[x / wb, y / hb] for x, y in poly_in_b],
            "figure": save_jpg(fit(fig, 2000), f"{name}_corr_{p['from'] + 1}{p['to'] + 1}.jpg",
                               bg=(255, 255, 255)),
        })
    out["gains"] = mo["exposure_gains"]
    out["canvas"] = [W, H]
    out["reference"] = mo["reference"]
    data["mosaics"].append(out)

    # placeholders for the static text
    values[f"m{key}.title"] = TITLES[name]
    values[f"m{key}.roman"] = ROMAN[name]
    values[f"m{key}.src"] = out["src"]
    values[f"m{key}.full"] = out["full"]
    values[f"m{key}.print"] = out["print"]
    values[f"m{key}.size"] = f"{W:,} &times; {H:,}"
    values[f"m{key}.aspect"] = f"{W / H:.4f}"
    values[f"m{key}.weights"] = out["weights"]
    values[f"m{key}.weights_print"] = out["weights_print"]
    for label in ("hard", "feather", "twoband"):
        values[f"m{key}.detail_{label}"] = out[f"detail_{label}"]
    values[f"m{key}.detail_aspect"] = f"{out['detail_aspect']:.4f}"
    ref_name = mo["frames"][mo["reference"]]["file"]
    values[f"m{key}.ref"] = ref_name
    for i, fr in enumerate(out["frames"]):
        values[f"m{key}.f{i + 1}.src"] = fr["src"]
        values[f"m{key}.f{i + 1}.file"] = fr["file"]
        values[f"m{key}.f{i + 1}.exif"] = fr["exif"]
        values[f"m{key}.f{i + 1}.alpha"] = fr["alpha"]
        values[f"m{key}.f{i + 1}.warped"] = fr["warped"]
        values[f"m{key}.f{i + 1}.share"] = fr["share"]
        values[f"m{key}.f{i + 1}.gain"] = " / ".join(f"{g:.2f}" for g in mo["exposure_gains"][i])
        e = mo["frames"][i]["exif"]
        values[f"m{key}.f{i + 1}.fnum"] = f"{e.get('FNumber', 0):.2f}".rstrip("0").rstrip(".")
        values[f"m{key}.f{i + 1}.shutter"] = f"1/{round(1 / e['ExposureTime'])}" if e.get("ExposureTime") else ""
        values[f"m{key}.f{i + 1}.iso"] = str(int(e.get("ISOSpeedRatings", 0)))
        values[f"m{key}.f{i + 1}.f35"] = str(int(e.get("FocalLengthIn35mmFilm", 0)))
        values[f"m{key}.f{i + 1}.model"] = e.get("Model", "")
        values[f"m{key}.f{i + 1}.clock"] = e.get("DateTimeOriginal", "")[11:16]
    for k, p in enumerate(out["pairs"]):
        pre = f"m{key}.p{k + 1}"
        values[f"{pre}.matrix"] = p["matrix"]
        values[f"{pre}.count"] = str(p["count"])
        values[f"{pre}.mean"] = f"{p['mean']:.2f}"
        values[f"{pre}.max"] = f"{p['max']:.2f}"
        values[f"{pre}.rms"] = f"{p['rms']:.2f}"
        values[f"{pre}.overlap"] = f"{100 * p['overlap']:.0f}"
        values[f"{pre}.figure"] = p["figure"]
        values[f"{pre}.from"] = mo["frames"][p["from"]]["file"]
        values[f"{pre}.to"] = mo["frames"][p["to"]]["file"]


def build_rect(r: dict, values: dict, data: dict) -> None:
    name = r["name"]
    key = name[-1]
    o = r["outputs"]
    src = Image.open(PROJECT / o["source"]).convert("RGB")
    out = {"name": name, "size": r["size"], "output_size": r["output_size"],
           "corners": [[(x + .5) / r["size"][0], (y + .5) / r["size"][1]] for x, y in r["corners"]],
           "zoom_box": r["zoom_box"]}
    out["source"] = save_jpg(fit(src, long_side=1500), f"{name}_source.jpg")
    for k in ("nearest", "bilinear"):
        out[k] = save_webp(Image.open(PROJECT / o[k]).convert("RGB"), f"{name}_{k}.webp", lossless=True)
        out[f"zoom_{k}"] = save_webp(Image.open(PROJECT / o[f"zoom_{k}"]).convert("RGB"),
                                     f"{name}_zoom_{k}.webp", lossless=True)
    out["context"] = save_webp(fit(open_rgba(o["context"]), 1400), f"{name}_context.webp")
    out["comparison"] = save_jpg(fit(Image.open(PROJECT / o["comparison"]).convert("RGB"), 2000),
                                 f"{name}_comparison.jpg", bg=(255, 255, 255))
    out["zoomfig"] = save_jpg(fit(Image.open(PROJECT / o["zoom"]).convert("RGB"), 1600),
                              f"{name}_zoomfig.jpg", bg=(255, 255, 255))
    data["rects"].append(out)
    pre = f"r{key}"
    for k in ("source", "nearest", "bilinear", "zoom_nearest", "zoom_bilinear", "context",
              "comparison", "zoomfig"):
        values[f"{pre}.{k}"] = out[k]
    values[f"{pre}.file"] = r["file"]
    values[f"{pre}.matrix"] = matrix_html(r["H"])
    values[f"{pre}.aspect"] = f"{r['aspect']:.3f}"
    values[f"{pre}.angle"] = f"{r['corner_angle']:.1f}"
    values[f"{pre}.focal"] = f"{r['focal_px']:.0f}"
    values[f"{pre}.w"] = str(r["output_size"][0])
    values[f"{pre}.h"] = str(r["output_size"][1])
    values[f"{pre}.t_nn"] = f"{r['t_nearest_ms']:.0f}"
    values[f"{pre}.t_bil"] = f"{r['t_bilinear_ms']:.0f}"
    values[f"{pre}.ratio"] = f"{r['t_bilinear_ms'] / r['t_nearest_ms']:.1f}"
    values[f"{pre}.zoomx"] = str(r["zoom_factor"])
    values[f"{pre}.src_aspect"] = f"{r['size'][0] / r['size'][1]:.4f}"
    values[f"{pre}.out_aspect"] = f"{r['output_size'][0] / r['output_size'][1]:.4f}"
    values[f"{pre}.mag"] = f"{r['zoom_magnification'][0]:.2f} to {r['zoom_magnification'][1]:.2f}"


def skyline_outlines(sk: dict) -> dict:
    """Outline of every frame on each skyline canvas, as fractions of that canvas."""
    frames = sk["frames"]
    ref = sk["reference"]
    step = {p["from"]: (p["to"], np.array(p["H"])) for p in sk["pairs"]}
    to_ref = []
    for i in range(len(frames)):
        H, k = np.eye(3), i
        while k != ref:
            k, Hs = step[k]
            H = Hs @ H
        to_ref.append(H / H[2, 2])
    w, h = frames[ref]["size"]
    cx, cy = (w - 1) / 2, (h - 1) / 2
    borders = []
    for f in frames:
        fw, fh = f["size"]
        t = np.linspace(0, 1, 25)
        borders.append(np.concatenate([
            np.column_stack((t * (fw - 1), np.zeros_like(t))),
            np.column_stack((np.full_like(t, fw - 1), t * (fh - 1))),
            np.column_stack((t[::-1] * (fw - 1), np.full_like(t, fh - 1))),
            np.column_stack((np.zeros_like(t), t[::-1] * (fh - 1)))]))
    out = {}
    p = sk["planar"]
    S = np.diag([p["scale"], p["scale"], 1.0])
    pts = [apply_h(S @ H, b) for H, b in zip(to_ref, borders)]
    corners = np.concatenate([apply_h(S @ H, [[0, 0], [f["size"][0] - 1, 0], [f["size"][0] - 1, f["size"][1] - 1],
                                                [0, f["size"][1] - 1]]) for H, f in zip(to_ref, frames)])
    o = np.floor(corners.min(axis=0))
    out["planar"] = [((q - o) / [p["width"], p["height"]]).round(4).tolist() for q in pts]
    for c in sk["cylinder"]:
        f = c["f"]
        uv = []
        for H, b in zip(to_ref, borders):
            X, Y = (apply_h(H, b) - [cx, cy]).T
            uv.append(np.column_stack((f * np.arctan2(X, f), f * Y / np.hypot(X, f))))
        o = np.floor(np.concatenate(uv).min(axis=0))
        out[c["scale"]] = [((q - o) / [c["width"], c["height"]]).round(4).tolist() for q in uv]
    return out


def build_skyline(sk: dict, values: dict, data: dict) -> None:
    out = {"runs": [], "frames": []}
    outlines = skyline_outlines(sk)
    runs = [dict(sk["planar"], kind="planar", label="Planar")] + [
        dict(c, kind="cylinder", label=f"{c['scale']:g}\u00d7 f") for c in sk["cylinder"]]
    for r in runs:
        im = open_rgba(r["file"])
        tag = Path(r["file"]).stem
        W, H = im.size
        full_scale = r["scale"] if r["kind"] == "planar" else 1.0
        entry = {"kind": r["kind"], "label": r["label"], "src": save_webp(fit(im, 2400), f"{tag}_2400.webp"),
                 "full": save_webp(fit(im, 6000), f"{tag}_full.webp", quality=80),
                 "w": W, "h": H, "coverage": r["coverage"],
                 "mag_median": r["mag_median"] / full_scale, "mag_max": r["mag_max"] / full_scale,
                 "f": r.get("f"), "scale": r["scale"],
                 "polys": outlines["planar" if r["kind"] == "planar" else r["scale"]]}
        if r["kind"] == "planar":
            entry["w_full"], entry["h_full"] = round(W / full_scale), round(H / full_scale)
        out["runs"].append(entry)
        if r["kind"] == "planar" or r["scale"] == sk["chosen"]:
            key = "planar" if r["kind"] == "planar" else "cyl"
            values[f"sk.{key}.src"] = entry["src"]
            values[f"sk.{key}.full"] = entry["full"]
            values[f"sk.{key}.print"] = save_jpg(fit(im, 2000), f"{tag}_print.jpg", bg=(255, 255, 255))
            values[f"sk.{key}.aspect"] = f"{W / H:.4f}"
            values[f"sk.{key}.size"] = f"{entry.get('w_full', W):,} &times; {entry.get('h_full', H):,}"
            values[f"sk.{key}.coverage"] = f"{100 * r['coverage']:.0f}"
            values[f"sk.{key}.mag_median"] = f"{entry['mag_median']:.2f}"
            values[f"sk.{key}.mag_max"] = f"{entry['mag_max']:.2f}"
            # same 560 x 380 output-pixel window around two landmarks
            for k, (mx, my) in enumerate(r["marks"]):
                box = (round(mx - 280), round(my - 190), round(mx + 280), round(my + 190))
                values[f"sk.{key}.crop{k + 1}"] = save_jpg(im.crop(box), f"{tag}_crop{k + 1}.jpg", quality=88)
    for c in sk["cylinder"]:
        k = f"{c['scale']:g}".replace(".", "p")
        values[f"sk.c{k}.f"] = f"{c['f']:.0f}"
        values[f"sk.c{k}.size"] = f"{c['width']:,} &times; {c['height']:,}"
        values[f"sk.c{k}.coverage"] = f"{100 * c['coverage']:.0f}"
        values[f"sk.c{k}.mag_median"] = f"{c['mag_median']:.2f}"
        values[f"sk.c{k}.mag_max"] = f"{c['mag_max']:.2f}"
        values[f"sk.c{k}.thumb"] = save_jpg(fit(open_rgba(c["file"]), 900), f"skyline_thumb_{k}.jpg",
                                            bg=(255, 255, 255))
    values["sk.planar.scale"] = f"{sk['planar']['scale']:.2f}"
    values["sk.planar.thumb"] = save_jpg(fit(open_rgba(sk["planar"]["file"]), 900), "skyline_thumb_planar.jpg",
                                         bg=(255, 255, 255))
    values["sk.f_exif"] = f"{sk['f_exif']:.0f}"
    chosen = next(c for c in sk["cylinder"] if c["scale"] == sk["chosen"])
    values["sk.span"] = f"{np.degrees(chosen['width'] / chosen['f']):.0f}"
    for i, f in enumerate(sk["frames"]):
        src = Image.open(PROJECT / f["source"]).convert("RGB")
        values[f"sk.f{i + 1}.src"] = save_jpg(fit(src, long_side=900), f"skyline_frame{i + 1}.jpg", quality=82)
        out["frames"].append({"file": f["file"], "exif": exif_line(f["exif"]), "ref": i == sk["reference"],
                              "src": save_jpg(fit(src, long_side=1400), f"skyline_frame{i + 1}_lg.jpg", quality=84)})
        values[f"sk.f{i + 1}.file"] = f["file"]
        values[f"sk.f{i + 1}.exif"] = exif_line(f["exif"])
    for k, pr in enumerate(sk["pairs"]):
        values[f"sk.p{k + 1}.from"] = sk["frames"][pr["from"]]["file"]
        values[f"sk.p{k + 1}.to"] = sk["frames"][pr["to"]]["file"]
        values[f"sk.p{k + 1}.count"] = str(pr["count"])
        values[f"sk.p{k + 1}.mean"] = f"{pr['error_mean']:.2f}"
        values[f"sk.p{k + 1}.max"] = f"{pr['error_max']:.2f}"
    data["skyline"] = out


def bit(mask: str, k: int) -> int:
    return 1 if mask[k] == "1" else 0


def build_partb(pm: dict, a_data: dict, values: dict, data: dict) -> None:
    """Part B: automatic stitching. a_data is the Part A site data (for the frame photos)."""
    st = pm["settings"]
    values.update({
        "b.n_points": f"{st['n_points']:,}", "b.harris_min": f"{st['harris_min']:g}",
        "b.ratio": f"{st['ratio']:g}", "b.eps": f"{st['ransac_eps']:g}",
        "b.iters": f"{st['ransac_iters']:,}", "b.sigma": f"{st['blur_sigma']:g}",
        "b.c_robust": f"{st['c_robust']:g}"})
    out = {"settings": st, "mosaics": []}
    a_mosaics = {m["name"]: m for m in a_data["mosaics"]}
    cam = [f["cam"] for f in a_mosaics["mosaic1"]["frames"]]
    values["b.ev_sunset"] = f"{np.log2(cam[0]['t'] * cam[0]['iso'] / (cam[1]['t'] * cam[1]['iso'])):.1f}"
    for mo in pm["mosaics"]:
        name, key = mo["name"], mo["name"][-1]
        ref = mo["reference"]
        web = json.loads((PROJECT / mo["outputs"]["web"]).read_text())
        W, H = mo["canvas"]["width"], mo["canvas"]["height"]
        ox, oy = mo["canvas"]["origin"]
        entry = {"name": name, "title": TITLES[name], "roman": ROMAN[name], "reference": ref,
                 "frames": [], "pairs": []}
        for i, f in enumerate(mo["frames"]):
            a_frame = a_mosaics[name]["frames"][i]
            atlas = Image.open(PROJECT / f["figures"]["atlas"])
            IMG.mkdir(parents=True, exist_ok=True)
            atlas.save(IMG / f"b_{name}_atlas{i + 1}.png", optimize=True)
            frame = {"file": f["file"], "src": a_frame["src"], "w": f["size"][0], "h": f["size"][1],
                     "atlas": f"assets/img/b_{name}_atlas{i + 1}.png",
                     "harris": f["harris"], "kept": f["points"], "radius": f["anms_radius"]}
            if i == ref:
                overlay = Image.open(PROJECT / f["figures"]["harris_overlay"]).convert("RGBA")
                frame["overlay"] = save_webp(fit(overlay, 1600), f"b_{name}_harris.webp", quality=80)
                frame["anms"] = [[round(x), round(y), min(9999, round(r))] for x, y, r in web["frames"][i]["anms"]]
                frame["strongest"] = web["frames"][i]["strongest"]
            entry["frames"].append(frame)
            pre = f"b{key}.f{i + 1}"
            values[f"{pre}.file"] = f["file"]
            values[f"{pre}.all"] = f"{f['harris_all']:,}"
            values[f"{pre}.harris"] = f"{f['harris']:,}"
            values[f"{pre}.kept"] = f"{f['points']:,}"
            values[f"{pre}.radius"] = f"{f['anms_radius']:.0f}"
        ref_figs = mo["frames"][ref]["figures"]
        values[f"b{key}.corners"] = save_jpg(fit(Image.open(PROJECT / ref_figs["corners"]).convert("RGB"), 2200),
                                             f"b_{name}_corners.jpg", bg=(255, 255, 255))
        values[f"b{key}.descriptors"] = save_jpg(
            fit(Image.open(PROJECT / ref_figs["descriptors"]).convert("RGB"), 1800),
            f"b_{name}_descriptors.jpg", bg=(255, 255, 255))
        values[f"b{key}.title"] = TITLES[name]
        values[f"b{key}.ref"] = mo["frames"][ref]["file"]

        for k, (p, wp) in enumerate(zip(mo["pairs"], web["pairs"])):
            cand = {ia: c for c, ia in enumerate(wp["ia"])}
            nn = wp["nn"]
            # one row per mutual nearest-neighbour pair: xa, ya, xb, yb, ratio x 1000, flags, index a, index b
            # flags: 1 agrees with the final homography, 2 passed the ratio test, 4 RANSAC inlier
            rows = []
            for i, r in enumerate(nn["ratio"]):
                c = cand.get(i)
                if c is None and (nn["mutual"][i] != "1" or r >= .95):
                    continue
                flags = bit(nn["correct"], i) | (2 if c is not None else 0) | (4 if c is not None and bit(wp["inliers"], c) else 0)
                (xa, ya), (xb, yb) = nn["pa"][i], nn["pb"][i]
                rows.append([round(xa), round(ya), round(xb), round(yb), round(r * 1000), flags, i, nn["index"][i]])
            cand_rows = [n for n, row in enumerate(rows) if row[5] & 2]
            inlier_x = [row[0] for row in rows if row[5] & 4]
            values[f"b{key}.p{k + 1}.strip"] = f"{np.percentile(inlier_x, 95) - np.percentile(inlier_x, 5):.0f}"
            log = [{"it": e["iteration"], "s": [cand_rows[c] for c in e["sample"]],
                    "n": e["inliers"].count("1"), "in": e["inliers"]} for e in wp["log"]]
            figs = {}
            for label in ("matches", "ransac", "patches"):
                figs[label] = save_jpg(fit(Image.open(PROJECT / p["figures"][label]).convert("RGB"), 2000),
                                       f"b_{name}_{label}_{k + 1}.jpg", bg=(255, 255, 255))
            entry["pairs"].append({
                "from": p["from"], "to": p["to"], "matches": p["matches"], "inliers": p["inliers"],
                "err": p["error_mean"], "rows": rows, "cand": cand_rows, "log": log,
                "matrix": matrix_html(p["H"])})
            pre = f"b{key}.p{k + 1}"
            values.update({
                f"{pre}.from": mo["frames"][p["from"]]["file"], f"{pre}.to": mo["frames"][p["to"]]["file"],
                f"{pre}.matches": str(p["matches"]), f"{pre}.inliers": str(p["inliers"]),
                f"{pre}.outliers": str(p["matches"] - p["inliers"]),
                f"{pre}.pct": f"{100 * p['inlier_fraction']:.0f}",
                f"{pre}.err": f"{p['error_mean']:.2f}", f"{pre}.errmax": f"{p['error_max']:.2f}",
                f"{pre}.need": f"{np.ceil(p['iterations_needed_99']):,.0f}",
                f"{pre}.hand": f"{p['manual_under_auto_mean']:.1f}", f"{pre}.handmax": f"{p['manual_under_auto_max']:.1f}",
                f"{pre}.handn": str(p["manual_points"]),
                f"{pre}.overlap_gap": f"{p['overlap_gap_mean']:.1f}",
                f"{pre}.corner_gap": f"{p['corner_gap_mean']:,.0f}",
                f"{pre}.stretch_auto": f"{p['stretch_auto']:.2f}", f"{pre}.stretch_manual": f"{p['stretch_manual']:.2f}",
                f"{pre}.seed": f"{p['seed_spread']:,.0f}",
                f"{pre}.seed_overlap": f"{p['seed_spread_overlap']:.1f}",
                f"{pre}.matrix": matrix_html(p["H"]),
                f"{pre}.fig_matches": figs["matches"], f"{pre}.fig_ransac": figs["ransac"],
                f"{pre}.fig_patches": figs["patches"]})

        manual = open_rgba(mo["outputs"]["manual_feathered"])
        auto = open_rgba(mo["outputs"]["auto_feathered"])
        two = open_rgba(mo["outputs"]["auto_two_band"])
        entry["manual"] = save_webp(fit(manual, 2400), f"b_{name}_manual_2400.webp")
        entry["auto"] = save_webp(fit(auto, 2400), f"b_{name}_auto_2400.webp")
        entry["auto_full"] = save_webp(fit(two, 5600), f"b_{name}_auto_full.webp", quality=80)
        entry["aspect"] = W / H
        entry["footprints"] = [[[x / W, y / H] for x, y in poly] for poly in mo["footprints_auto"]]
        x0, y0, x1, y1 = SEAM_B[name]
        box = (x0 - ox, y0 - oy, x1 - ox, y1 - oy)
        values.update({
            f"b{key}.manual": entry["manual"], f"b{key}.auto": entry["auto"], f"b{key}.auto_full": entry["auto_full"],
            f"b{key}.aspect": f"{W / H:.4f}", f"b{key}.size": f"{W:,} &times; {H:,}",
            f"b{key}.print_manual": save_jpg(fit(manual, 2000), f"b_{name}_manual_print.jpg", bg=(255, 255, 255)),
            f"b{key}.print_auto": save_jpg(fit(auto, 2000), f"b_{name}_auto_print.jpg", bg=(255, 255, 255)),
            f"b{key}.seam_manual": save_jpg(manual.crop(box), f"b_{name}_seam_manual.jpg", quality=90),
            f"b{key}.seam_auto": save_jpg(auto.crop(box), f"b_{name}_seam_auto.jpg", quality=90),
            f"b{key}.seam_two": save_jpg(two.crop(box), f"b_{name}_seam_two_band.jpg", quality=90),
            f"b{key}.seam_aspect": f"{(x1 - x0) / (y1 - y0):.4f}"})
        out["mosaics"].append(entry)

    hist = pm["ratio_histogram"]
    out["hist"] = {"correct": hist["correct"], "incorrect": hist["incorrect"]}
    values.update({
        "b.hist.fig": save_jpg(fit(Image.open(PROJECT / hist["figure"]).convert("RGB"), 1500), "b_ratio_histogram.jpg",
                               bg=(255, 255, 255)),
        "b.hist.n": f"{sum(hist['correct']) + sum(hist['incorrect']):,}",
        "b.hist.n_correct": f"{sum(hist['correct']):,}",
        "b.hist.kept_correct": f"{100 * hist['kept_correct']:.0f}",
        "b.hist.kept_incorrect": f"{100 * hist['kept_incorrect']:.1f}"})

    rec = pm["recognition"]
    thumbs = []
    for k, (folder, file) in enumerate(zip(rec["folders"], rec["files"])):
        photo = ImageOps.exif_transpose(Image.open(PROJECT / "images" / folder / file)).convert("RGB")
        thumbs.append(save_jpg(fit(photo, long_side=360), f"b_rec_thumb{k + 1}.jpg", quality=80))
    groups, start = [], 0
    for n, pano in enumerate(rec["panoramas"]):
        im = open_rgba(pano["output"])
        src = save_webp(fit(im, 2400), f"b_rec_panorama{n + 1}_2400.webp")
        full = save_webp(fit(im, 6000), f"b_rec_panorama{n + 1}_full.webp", quality=80)
        groups.append({"start": start, "count": len(pano["frames"]), "src": src, "full": full})
        pre = f"b.rec.p{n + 1}"
        values.update({
            f"{pre}.src": src, f"{pre}.full": full, f"{pre}.count": str(len(pano["frames"])),
            f"{pre}.size": f"{pano['width']:,} &times; {pano['height']:,}",
            f"{pre}.aspect": f"{pano['width'] / pano['height']:.4f}",
            f"{pre}.frames": ", ".join(pano["frames"]), f"{pre}.reference": pano["reference"],
            f"{pre}.print": save_jpg(fit(im, 2000), f"b_rec_panorama{n + 1}_print.jpg", bg=(255, 255, 255))})
        start += len(pano["frames"])
    n = len(rec["photos"])
    out["rec"] = {"photos": rec["photos"], "thumbs": thumbs, "inliers": rec["inliers"], "matches": rec["matches"],
                  "min": rec["min_inliers"], "groups": groups}
    values.update({
        "b.rec.n": str(n), "b.rec.pairs": str(n * (n - 1) // 2), "b.rec.min": str(rec["min_inliers"]),
        "b.rec.weakest": str(rec["weakest_link"]), "b.rec.strongest_false": str(rec["strongest_non_link"]),
        "b.rec.panoramas": str(len(rec["panoramas"])), "b.rec.unmatched": str(len(rec["unmatched"])),
        "b.rec.fig": save_jpg(fit(Image.open(PROJECT / rec["figure"]).convert("RGB"), 1500), "b_recognition_matrix.jpg",
                              bg=(255, 255, 255))})
    data["partb"] = out


def render(template: str, values: dict) -> str:
    missing = set()

    def sub(m):
        k = m.group(1).strip()
        if k not in values:
            missing.add(k)
            return m.group(0)
        return values[k]

    html = re.sub(r"\{\{\s*([\w.]+)\s*\}\}", sub, template)
    if missing:
        raise KeyError(f"unfilled placeholders: {sorted(missing)}")
    return html


def main() -> None:
    if "--html" in sys.argv:
        cached = json.loads(CACHE.read_text())
        values, data = cached["values"], cached["data"]
    else:
        manifest = json.loads((OUTPUTS / "manifest.json").read_text())
        if DOCS.exists():
            shutil.rmtree(DOCS)
        (DOCS / "assets").mkdir(parents=True)
        values = {"site_url": SITE_URL, "site_url_short": SITE_URL.replace("https://", "").rstrip("/")}
        data = {"mosaics": [], "rects": []}
        for mo in manifest["mosaics"]:
            build_mosaic(mo, values, data)
        for r in manifest["rectifications"]:
            build_rect(r, values, data)
        build_skyline(manifest["skyline"], values, data)
        build_partb(json.loads((OUTPUTS / "partb" / "manifest.json").read_text()), data, values, data)
        CACHE.parent.mkdir(exist_ok=True)
        CACHE.write_text(json.dumps({"values": values, "data": data}))
    (DOCS / "assets" / "data.js").write_text(
        "window.MOSAIC_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
    for f in ("styles.css", "app.js"):
        shutil.copy2(SRC / f, DOCS / "assets" / f)
    for f in (SRC / "static").glob("*"):
        shutil.copy2(f, DOCS / "assets" / f.name)
    (DOCS / "index.html").write_text(render((SRC / "index.html").read_text(), values))
    (DOCS / ".nojekyll").write_text("")
    total = sum(p.stat().st_size for p in DOCS.rglob("*") if p.is_file())
    print(f"built {DOCS} ({total / 1e6:.1f} MB, {sum(1 for _ in DOCS.rglob('*'))} files)")


if __name__ == "__main__":
    main()
