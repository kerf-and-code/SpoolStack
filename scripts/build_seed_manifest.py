#!/usr/bin/env python3
"""
Build one training manifest from the public seed datasets in SpoolStack-data.

Reads the two Kaggle datasets fetched by get_seed_datasets.py and writes:

    <data root>/seed_manifest.csv          one row per image file
    <data root>/seed_manifest_summary.txt  counts per label, split and source

Labels are mapped to SpoolStack defect_types by `key` (not `id`), so the
manifest works against any database that has the fdm seed rows.

Splits are assigned per print (Beyer: recording, Hu: capture session), never
per image, because frames from one print are near-duplicates: a random image
split would put the same print in train and test and overstate accuracy.

Usage (Windows):

    py scripts\\build_seed_manifest.py "D:\\Kerf and Code\\SpoolStack-data"

Standard library only, Python 3.8 or newer. Writes nothing inside the repo.
"""

import csv
import datetime
import hashlib
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

BEYER = "kaggle-printing-errors-beyer"
HU = "kaggle-fdm-defects-hu"

# Beyer class codes (Printing_Errors/labels.txt). Empty key = no defect.
BEYER_MAP = {
    "0": ("", "GOOD"),
    "1": ("under_extrusion", "UNDEREXTRUSION"),
    "2": ("stringing", "STRINGING"),
    "4": ("spaghetti", "SPAGHETTI"),
}

# Hu folder names. Off_platform frames show a part that came loose with the
# printer still extruding (SpoolStack's spaghetti). Cracking frames show layers
# splitting apart (layer_separation). Both checked by eye on sample frames.
HU_MAP = {
    "Cracking": "layer_separation",
    "Layer_shifting": "layer_shift",
    "Off_platform": "spaghetti",
    "Stringing": "stringing",
    "Warping": "warping",
}

LICENSES = {
    BEYER: ("Apache 2.0", "PRINTING ERROR DATASET by Nils Beyer (2023), via Kaggle (nimbus200/3d-printing-errors)"),
    HU: ("MIT", "FDM 3D Printing Defect Dataset, via Kaggle (wengmhu/fdm-3d-printing-defect-dataset)"),
}

SESSION_GAP_SECONDS = 600  # Hu frames are 30 s apart; a 10 min gap means a new print

COLUMNS = [
    "image_path", "source", "source_label", "defect_key", "use", "note",
    "group_id", "split", "induced_on_layers", "camera",
    "layer", "nozzle_mm", "layer_height_mm", "filament", "filament_color",
    "bed_color", "extrusion_multiplier", "retraction_mm", "shape",
    "license", "credit",
]


def split_for(index_in_bucket: int) -> str:
    # Every bucket with 3 or more prints gets at least one test and one val
    # print; overall about 14 / 14 / 72.
    slot = index_in_bucket % 7
    return "test" if slot == 0 else "val" if slot == 1 else "train"


def stable_order(names):
    return sorted(names, key=lambda n: hashlib.sha1(n.encode("utf-8")).hexdigest())


def blank_row(source: str) -> dict:
    row = {c: "" for c in COLUMNS}
    row["source"] = source
    row["license"], row["credit"] = LICENSES[source]
    row["camera"] = "fixed side view, nozzle level"
    return row


def beyer_rows(root: Path):
    base = root / BEYER / "Printing_Errors"
    csv_path = base / "general_data" / "all_images_no_filter.csv"
    with open(csv_path, newline="", encoding="utf-8") as f:
        labelled = list(csv.DictReader(f, delimiter=";"))

    classes_by_rec = defaultdict(set)
    for r in labelled:
        classes_by_rec[r["recording"]].add(r["class"])
    buckets = defaultdict(list)
    for rec, cls in classes_by_rec.items():
        buckets[tuple(sorted(cls))].append(rec)
    split_of = {}
    for recs in buckets.values():
        for i, rec in enumerate(stable_order(recs)):
            split_of[rec] = split_for(i)

    rows, seen = [], set()
    for r in labelled:
        if r["class"] not in BEYER_MAP:
            raise SystemExit(f"Unknown Beyer class {r['class']!r} on {r['image']}; update BEYER_MAP")
        key, label = BEYER_MAP[r["class"]]
        row = blank_row(BEYER)
        rel = f"{BEYER}/Printing_Errors/images/all_images256/{r['image']}"
        if not (root / rel).is_file():
            raise SystemExit(f"Missing image listed in CSV: {rel}")
        seen.add(r["image"])
        ex_mul = r["ex_mul"].strip()
        row.update({
            "image_path": rel,
            "source_label": label,
            "defect_key": key,
            "use": "1",
            "group_id": f"beyer:{r['recording']}",
            "split": split_of[r["recording"]],
            "induced_on_layers": r["modified_layers"].strip(),
            "layer": r["layer"],
            "nozzle_mm": r["nozzle"],
            "layer_height_mm": r["layer_height"],
            "filament": r["filament"],
            "filament_color": r["filament_color"],
            "bed_color": r["printbed_color"],
            "extrusion_multiplier": "" if ex_mul in ("", "unspecified") else ex_mul,
            "retraction_mm": r["retraction"],
            "shape": r["shape"],
        })
        if r["modified_layers"].strip():
            row["note"] = "recording with under-extrusion induced on the listed layers"
        rows.append(row)

    # Files on disk the CSV does not label (the silver-bed and oblique test
    # images, which also sit in all_images256). Listed so nothing is silently
    # dropped, but not used.
    for folder in ("all_images256", "test_images_oblique256", "test_images_silver265"):
        for p in sorted((base / "images" / folder).iterdir()):
            if folder == "all_images256" and p.name in seen:
                continue
            row = blank_row(BEYER)
            row.update({
                "image_path": f"{BEYER}/Printing_Errors/images/{folder}/{p.name}",
                "use": "0",
                "note": "no label in all_images_no_filter.csv",
            })
            rows.append(row)
    return rows


def hu_rows(root: Path):
    base = root / HU / "FDM-3D-Printing-Defect-Dataset" / "data"
    pat = re.compile(r"^Image_(\d{17})(_aug|_original)?\.jpg$")
    files = []
    for folder in sorted(p.name for p in base.iterdir() if p.is_dir()):
        if folder not in HU_MAP:
            raise SystemExit(f"Unknown Hu folder {folder!r}; update HU_MAP")
        for p in sorted((base / folder).iterdir()):
            m = pat.match(p.name)
            if not m:
                raise SystemExit(f"Unexpected Hu file name: {folder}/{p.name}")
            files.append((folder, p.name, m.group(1), m.group(2) or ""))

    # Group frames into capture sessions across all folders, so one print that
    # was labelled Warping early and Off_platform later stays in one split.
    stamps = sorted({(datetime.datetime.strptime(ts[:14], "%Y%m%d%H%M%S"), ts) for _, _, ts, _ in files})
    session_of, n, prev, label = {}, 0, None, ""
    for t, ts in stamps:
        if prev is None or (t - prev).total_seconds() > SESSION_GAP_SECONDS:
            n += 1
            label = f"hu:session{n:02d}:{t:%Y%m%d-%H%M}"
        session_of[ts] = label
        prev = t

    classes_by_session = defaultdict(set)
    for folder, _, ts, _ in files:
        classes_by_session[session_of[ts]].add(folder)
    buckets = defaultdict(list)
    for s, cls in classes_by_session.items():
        buckets[tuple(sorted(cls))].append(s)
    split_of = {}
    for sessions in buckets.values():
        for i, s in enumerate(stable_order(sessions)):
            split_of[s] = split_for(i)

    rows = []
    for folder, name, ts, variant in files:
        row = blank_row(HU)
        g = session_of[ts]
        row.update({
            "image_path": f"{HU}/FDM-3D-Printing-Defect-Dataset/data/{folder}/{name}",
            "source_label": folder,
            "defect_key": HU_MAP[folder],
            "use": "0" if variant else "1",
            "note": f"{variant[1:]} copy of Image_{ts}.jpg" if variant else "",
            "group_id": g,
            "split": split_of[g],
        })
        rows.append(row)
    return rows


def main(argv) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 1
    root = Path(argv[1])
    for d in (BEYER, HU):
        if not (root / d / "LICENSE.txt").is_file():
            raise SystemExit(f"{root / d} is missing or incomplete; run get_seed_datasets.py first")

    rows = beyer_rows(root) + hu_rows(root)

    out = root / "seed_manifest.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)

    used = [r for r in rows if r["use"] == "1"]
    lines = [
        f"seed_manifest.csv: {len(rows)} files listed, {len(used)} usable, {len(rows) - len(used)} excluded",
        "",
        "Usable images by SpoolStack defect key and split (blank key = no defect):",
    ]
    by = Counter((r["defect_key"] or "(no defect)", r["split"]) for r in used)
    for key in sorted({k for k, _ in by}):
        t, v, s = by[(key, "train")], by[(key, "val")], by[(key, "test")]
        lines.append(f"  {key:<18} train {t:>6}  val {v:>5}  test {s:>5}  total {t + v + s:>6}")
    lines += ["", "Usable images by source and label:"]
    for (src, lab), c in sorted(Counter((r["source"], r["source_label"]) for r in used).items()):
        lines.append(f"  {src:<30} {lab:<16} {c:>6}")
    lines += ["", "Prints (split groups) per split:"]
    groups = {(r["group_id"], r["split"]) for r in used}
    for src in (BEYER, HU):
        pre = "beyer:" if src == BEYER else "hu:"
        per_split = Counter(s for g, s in groups if g.startswith(pre))
        lines.append(f"  {src:<30} train {per_split['train']:>3}  val {per_split['val']:>3}  test {per_split['test']:>3}")
    lines += ["", "Excluded:"]
    for note, c in sorted(Counter(re.sub(r" of Image_\d+\.jpg$", "", r["note"]) for r in rows if r["use"] == "0").items()):
        lines.append(f"  {c:>5}  {note}")
    summary = "\n".join(lines) + "\n"
    (root / "seed_manifest_summary.txt").write_text(summary, encoding="utf-8")
    print(summary)
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
