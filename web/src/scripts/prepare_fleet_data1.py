"""Converts a raw CMAPSS test file (e.g. test_FD004) into the fleet.json
the frontend loads at src/data/loadFleet.ts.

This is for visualization only. It does not produce model features or RUL
predictions; those come from the inference API (see
src/hooks/usePredictions.ts), so fleet.json has no predictedRUL field.

pc1 is a PCA first component fit on sensor readings (not op settings),
z-scored within each operating condition, across every engine in the raw
file, projected per cycle (see fit_pca_pc1). It is a visualization-only composite health signal, computed
independently of the model's feature pipeline.

Usage:
    python3 prepare_fleet_data.py <path-to-raw-test-file> [output.json] [num_units]
        [--engine-ids-from PATH] [--engine-id-column COLUMN]

By default, units are evenly sampled across every engine id in the raw file.
Pass --engine-ids-from with the feature-engineered test set the model scores
to use its engine ids instead, so the visualized aircraft are exactly the ones
being predicted. Ids missing from the raw file are skipped with a warning;
without num_units, every matched id is used.

Expects a CSV with a header row containing at least:
    Engine, Time, Setting1, Setting2, Setting3, T2, T24, T30, T50, P2, P15,
    P30, Nf, Nc, epr, Ps30, phi, NRf, NRc, BPR, farB, htBleed, Nf_dmd,
    PCNfR_dmd, W31, W32
(the standard CMAPSS column set; RUL is ignored even if present, since
test files don't carry ground-truth RUL per row).
"""

import argparse
import csv
import json
import math
import random
import sys

import numpy as np

SENSOR_KEYS = [
    "T2",
    "T24",
    "T30",
    "T50",
    "P2",
    "P15",
    "P30",
    "Nf",
    "Nc",
    "epr",
    "Ps30",
    "phi",
    "NRf",
    "NRc",
    "BPR",
    "farB",
    "htBleed",
    "Nf_dmd",
    "PCNfR_dmd",
    "W31",
    "W32",
]

# Op setting 1 is stored in the raw file in thousands of feet (kft); this
# descales it to feet for human-readable display, per Saxena et al.'s
# description of the six flight conditions (altitude 0-42K ft).
ALTITUDE_KFT_TO_FT = 1000.0

# Scene-space tuning. These only affect how the flight paths look, not the
# underlying data.
ALTITUDE_SCENE_SCALE = 1500.0  # ft of real altitude per scene unit of height
TARGET_PATH_LENGTH = 330.0  # normalizes ground-track length across units (3x)
HEADING_RATE = 0.0008  # rad/cycle per unit of (TRA - 60) deviation
STEP_SCALE = 3.0  # scene units per unit of Mach number, per cycle

# The raw file jumps between discrete flight conditions cycle to cycle (e.g.
# 20K ft -> 25K ft -> 42K ft in 3 rows). ALTITUDE_SMOOTHING eases the path's y
# coordinate toward the raw altitude by this fraction per step so climbs and
# descents look gradual (lower = more gradual). Only the path's y is affected;
# opSettings.altitudeFt keeps the real logged value.
ALTITUDE_SMOOTHING = 0.04

# Anchor placement: units sit on a golden-angle spiral around the hub so they
# spread out with increasing index instead of clumping, with a little random
# jitter so it doesn't look mechanical.
GOLDEN_ANGLE_RAD = 2.399963229728653
ANCHOR_RADIUS_SCALE = 36.0  # scene units of anchor radius per sqrt(index + 1) (3x)
ANCHOR_JITTER = 4.0  # +/- scene units of random offset on top of the spiral


def load_rows(path):
    """Reads the raw CMAPSS CSV and groups rows by engine/unit.

    Args:
        path (str): Path to the raw test file (CSV with a header row).

    Returns:
        dict[int, list[dict]]: Engine id -> its rows, sorted by cycle.
    """
    engines = {}
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            eid = int(row["Engine"])
            engines.setdefault(eid, []).append(row)
    for eid in engines:
        engines[eid].sort(key=lambda r: int(r["Time"]))
    return engines


def condition_key(setting1, setting2, setting3):
    """Rounds one row's raw op settings to its operating-condition bucket.
    Matches roundToCondition in src/utils/operatingCondition.ts (Setting1 is
    in kft, so rounding it to an int is the same as 1000 ft bins).

    Args:
        setting1 (float): Raw Setting1 (altitude, kft).
        setting2 (float): Raw Setting2 (Mach).
        setting3 (float): Raw Setting3 (TRA).

    Returns:
        tuple[int, float, int]: The condition bucket.
    """
    return (round(setting1), round(setting2, 2), round(setting3))


def fit_pca_pc1(engines, keys):
    """Fits a first principal component on sensor readings z-scored *within
    each operating condition*, across every row of every engine in the raw
    file (the full population, not just the sampled units), so the basis
    doesn't depend on fleet size. Op settings are excluded from the PCA
    itself: they are commanded inputs, not degradation signal.

    Z-scoring per condition matters for FD002/FD004. Their six conditions
    shift every sensor by far more than degradation does, so a single global
    z-score makes PC1 mostly a condition label (a flat band per condition)
    and the degradation trend is a rounding error on top of it.

    PCA's sign is arbitrary, so PC1 is oriented to correlate positively with
    elapsed cycle, making "PC1 rising" always mean "getting worse".

    Args:
        engines (dict[int, list[dict]]): Engine id -> its raw rows, as
            returned by load_rows.
        keys (list[str]): Sensor column names to fit on.

    Returns:
        Callable[[dict[str, float], tuple], float]: Projects a single row's
        raw (unrounded) sensor values onto PC1, given that row's condition
        key (see condition_key).
    """
    rows = []
    conds = []
    cycles = []
    for erows in engines.values():
        for row in erows:
            rows.append([float(row[k]) for k in keys])
            conds.append(
                condition_key(float(row["Setting1"]), float(row["Setting2"]), float(row["Setting3"]))
            )
            cycles.append(int(row["Time"]))

    X = np.array(rows, dtype=float)

    stats = {}
    Z = np.empty_like(X)
    for cond in set(conds):
        mask = np.array([c == cond for c in conds])
        mean = X[mask].mean(axis=0)
        std = X[mask].std(axis=0)
        std[std < 1e-6] = 1.0  # sensors that are ~constant within a condition
        stats[cond] = (mean, std)
        Z[mask] = (X[mask] - mean) / std

    # SVD-based PCA: Z's right singular vectors are its principal axes,
    # ordered by explained variance -- no need to build the covariance
    # matrix explicitly.
    _, s, vt = np.linalg.svd(Z, full_matrices=False)
    component = vt[0]
    explained_ratio = (s[0] ** 2) / (s**2).sum()

    raw_pc1 = Z @ component
    corr = np.corrcoef(raw_pc1, np.array(cycles, dtype=float))[0, 1]
    sign = 1.0 if corr >= 0 else -1.0

    print(
        f"[pca] fit on {X.shape[0]} rows x {X.shape[1]} sensors across "
        f"{len(engines)} engines, z-scored within {len(stats)} operating "
        f"condition(s) -- PC1 explains {explained_ratio:.1%} of "
        f"variance (corr with cycle: {sign * corr:+.2f})",
        file=sys.stderr,
    )

    def project(sensors, cond):
        mean, std = stats[cond]
        vec = np.array([sensors[k] for k in keys], dtype=float)
        z = (vec - mean) / std
        return sign * float(z @ component)

    return project


def select_engine_ids(engines, num_units, engine_ids_from, engine_id_column, contiguous):
    """Picks which engine ids to write to fleet.json.

    Default: an evenly strided sample across every id in the raw file, so the
    fleet spans the full range of unit numbers (100 of 248 ids gives every
    other one, not 1-100). Pass contiguous=True for the first num_units ids in
    order instead.

    If engine_ids_from is given, ids come from that file's engine_id_column in
    first-seen order (see the module docstring). Ids not present in the raw
    file are skipped with a warning, and contiguous is ignored.

    Args:
        engines (dict[int, list[dict]]): Engine id -> its raw rows.
        num_units (int | None): Cap on how many ids to return. With
            engine_ids_from set, None means "use every matched id";
            without it, None is treated as 16.
        engine_ids_from (str | None): Path to a CSV to pull ids from
            instead of sampling here.
        engine_id_column (str): Column in that CSV holding the engine id.
        contiguous (bool): If True (and engine_ids_from is not set),
            take the first num_units ids in order instead of striding
            across the full range.

    Returns:
        list[int]: Engine ids, in the order build_aircraft should use
        them (this order also drives anchor placement -- see
        anchor_for_index).
    """
    raw_ids = sorted(engines.keys())

    if not engine_ids_from:
        n = num_units if num_units is not None else 16
        if contiguous:
            return raw_ids[:n]
        step = max(1, len(raw_ids) // n)
        return raw_ids[::step][:n]

    with open(engine_ids_from, newline="") as f:
        reader = csv.DictReader(f)
        if engine_id_column not in (reader.fieldnames or []):
            raise SystemExit(
                f"--engine-ids-from {engine_ids_from}: no column "
                f"'{engine_id_column}' (found: {reader.fieldnames}). Pass "
                f"--engine-id-column to match your file."
            )
        seen = []
        seen_set = set()
        for row in reader:
            eid = int(row[engine_id_column])
            if eid not in seen_set:
                seen_set.add(eid)
                seen.append(eid)

    matched = [eid for eid in seen if eid in engines]
    skipped = len(seen) - len(matched)
    if skipped:
        print(
            f"[engine-ids] {skipped} id(s) from {engine_ids_from} not found "
            f"in the raw test file -- skipped",
            file=sys.stderr,
        )
    if not matched:
        raise SystemExit(
            f"--engine-ids-from {engine_ids_from}: none of its ids matched "
            f"engines in the raw test file -- check --engine-id-column and "
            f"that both files are the same split."
        )
    return matched[:num_units] if num_units is not None else matched


def anchor_for_index(index, eid):
    """Places one unit's flight-path anchor on a golden-angle spiral.

    Args:
        index (int): This unit's position among the units being written
            (0-based), driving how far out on the spiral it sits.
        eid (int): The engine/unit id, used to seed its jitter so re-runs
            are stable.

    Returns:
        tuple[float, float]: (anchor_x, anchor_z) in scene units.
    """
    rng = random.Random(eid)
    radius = ANCHOR_RADIUS_SCALE * math.sqrt(index + 1)
    angle = index * GOLDEN_ANGLE_RAD
    jitter_x = rng.uniform(-ANCHOR_JITTER, ANCHOR_JITTER)
    jitter_z = rng.uniform(-ANCHOR_JITTER, ANCHOR_JITTER)
    return (
        radius * math.cos(angle) + jitter_x,
        radius * math.sin(angle) + jitter_z,
    )


def compute_flight_path(history, index, eid):
    """Derives a scene-space flight path from a unit's history (real op
    settings per cycle). Used by build_aircraft and migrate_fleet_data.py.

    Args:
        history (list[dict]): This unit's history entries, each with at
            least {"cycle": int, "opSettings": {"altitudeFt", "mach",
            "tra"}}.
        index (int): This unit's position among the units being written,
            for anchor placement (see anchor_for_index).
        eid (int): The engine/unit id, for deterministic jitter.

    Returns:
        list[dict]: The flight path, one {"x", "y", "z", "cycle"} dict
        per history entry.
    """
    anchor_x, anchor_z = anchor_for_index(index, eid)
    rng = random.Random(eid)
    heading = rng.uniform(0, 2 * math.pi)
    raw_points = []
    x = z = 0.0
    smoothed_altitude_ft = history[0]["opSettings"]["altitudeFt"] if history else 0.0

    for entry in history:
        altitude_ft = entry["opSettings"]["altitudeFt"]
        mach = entry["opSettings"]["mach"]
        tra = entry["opSettings"]["tra"]

        heading += (tra - 60.0) * HEADING_RATE
        step = mach * STEP_SCALE
        x += math.sin(heading) * step
        z += math.cos(heading) * step
        # Ease toward the real altitude rather than snapping (see ALTITUDE_SMOOTHING).
        smoothed_altitude_ft += (
            altitude_ft - smoothed_altitude_ft
        ) * ALTITUDE_SMOOTHING
        y = smoothed_altitude_ft / ALTITUDE_SCENE_SCALE
        raw_points.append((x, y, z))

    total_len = sum(
        math.hypot(
            raw_points[i][0] - raw_points[i - 1][0],
            raw_points[i][2] - raw_points[i - 1][2],
        )
        for i in range(1, len(raw_points))
    )
    scale = (TARGET_PATH_LENGTH / total_len) if total_len > 0 else 1.0

    return [
        {
            "x": round(anchor_x + px * scale, 2),
            "y": round(py, 2),
            "z": round(anchor_z + pz * scale, 2),
            "cycle": entry["cycle"],
        }
        for (px, py, pz), entry in zip(raw_points, history)
    ]


def build_aircraft(eid, rows, index, pca_project):
    """Builds one aircraft record (history + flight path) from an engine's
    real op-setting and sensor rows.

    Args:
        eid (int): The engine/unit id from the source file.
        rows (list[dict]): That engine's rows, sorted by cycle.
        index (int): This unit's position among the units being written,
            for anchor placement.
        pca_project (Callable[[dict[str, float], tuple], float]): PC1
            projector from fit_pca_pc1, fit across the whole raw population.

    Returns:
        dict: One fleet entry matching the frontend's Aircraft type.
        Has no top-level "current" snapshot; the frontend derives it from
        history (see src/utils/liveCycle.ts).
    """
    total_cycles = int(rows[-1]["Time"])
    history = []

    for row in rows:
        cycle = int(row["Time"])
        altitude_ft = float(row["Setting1"]) * ALTITUDE_KFT_TO_FT
        mach = float(row["Setting2"])
        tra = float(row["Setting3"])

        # Project PCA from the raw values so display rounding doesn't leak into
        # the score; `sensors` is the rounded version shown in the UI.
        raw_sensor_vals = {k: float(row[k]) for k in SENSOR_KEYS}
        sensors = {k: round(v, 3) for k, v in raw_sensor_vals.items()}
        cond = condition_key(float(row["Setting1"]), mach, tra)
        pc1 = round(pca_project(raw_sensor_vals, cond), 3)

        # Test sets are truncated before failure, so there is no ground-truth
        # RUL. cyclesRemaining is just the cycles left in this log, not a
        # prediction.
        cycles_remaining = total_cycles - cycle

        history.append(
            {
                "cycle": cycle,
                "opSettings": {
                    "altitudeFt": round(altitude_ft, 1),
                    "mach": round(mach, 4),
                    "tra": round(tra, 2),
                },
                "sensors": sensors,
                "pc1": pc1,
                "cyclesRemaining": cycles_remaining,
            }
        )

    flight_path = compute_flight_path(history, index, eid)
    return {
        "id": f"unit-{eid}",
        "nickname": f"Aircraft {eid}",
        "history": history,
        "flightPath": flight_path,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Converts a raw CMAPSS test file into fleet.json for the frontend.",
    )
    parser.add_argument("src", nargs="?", default="test_FD004", help="Path to the raw CMAPSS test CSV.")
    parser.add_argument("out", nargs="?", default="fleet.json", help="Output path for fleet.json.")
    parser.add_argument(
        "num_units",
        nargs="?",
        type=int,
        default=None,
        help="How many units to write. Default 16, or (with --engine-ids-from) however many ids that file provides.",
    )
    parser.add_argument(
        "--engine-ids-from",
        metavar="PATH",
        default=None,
        help="CSV to pull engine ids from instead of sampling them here. Point this at "
        "the feature-engineered test set the model scores, so the visualized aircraft "
        "are exactly the ones being predicted.",
    )
    parser.add_argument(
        "--engine-id-column",
        metavar="COLUMN",
        default="Engine",
        help="Column in --engine-ids-from holding the engine/unit id (default: 'Engine', "
        "the raw CMAPSS name; change it if the file renamed it, e.g. 'unit_number').",
    )
    parser.add_argument(
        "--contiguous",
        action="store_true",
        help="Take the first num_units engine ids in order (1, 2, 3, ...) instead of striding "
        "evenly across the full range. Ignored if --engine-ids-from is set.",
    )
    args = parser.parse_args()

    engines = load_rows(args.src)
    sampled = select_engine_ids(engines, args.num_units, args.engine_ids_from, args.engine_id_column, args.contiguous)
    pca_project = fit_pca_pc1(engines, SENSOR_KEYS)

    fleet = [build_aircraft(eid, engines[eid], i, pca_project) for i, eid in enumerate(sampled)]
    with open(args.out, "w") as f:
        json.dump(fleet, f, indent=2)

    print(f"Wrote {len(fleet)} units (of {len(engines)} available) to {args.out}")


if __name__ == "__main__":
    main()
