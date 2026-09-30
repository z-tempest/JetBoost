"""One-off migration for a fleet.json written in an older schema: drops the
top-level predictedRUL, opSettings, and sensorPC1 fields, renames each history
entry's "rul" to "cyclesRemaining", and re-lays-out every flight path on the
golden-angle anchor spiral from prepare_fleet_data.py, using the per-cycle
opSettings already in the file (no raw CSV needed).

pc1 is carried over as-is, not recomputed: a real PCA fit needs the full raw
population (see fit_pca_pc1 in prepare_fleet_data.py). If the file's pc1
values are old placeholders, regenerate it with prepare_fleet_data.py instead.

Usage:
    python3 migrate_fleet_data.py <input.json> <output.json>
"""

import json
import sys

from prepare_fleet_data import compute_flight_path


def migrate(aircraft, index):
    """Migrates one aircraft record to the current schema.

    Args:
        aircraft (dict): One fleet entry in the old schema.
        index (int): This unit's position in the fleet, for anchor
            placement.

    Returns:
        dict: The same aircraft, migrated.
    """
    eid = int(aircraft["id"].split("-")[-1])
    history = [
        {
            "cycle": h["cycle"],
            "opSettings": h["opSettings"],
            "sensors": h["sensors"],
            "pc1": h["pc1"],
            "cyclesRemaining": h.get("cyclesRemaining", h.get("rul")),
        }
        for h in aircraft["history"]
    ]
    return {
        "id": aircraft["id"],
        "nickname": aircraft["nickname"],
        "history": history,
        "flightPath": compute_flight_path(history, index, eid),
    }


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "../../public/data/fleet.json"
    out = sys.argv[2] if len(sys.argv) > 2 else src

    with open(src) as f:
        fleet = json.load(f)

    migrated = [migrate(a, i) for i, a in enumerate(fleet)]
    with open(out, "w") as f:
        json.dump(migrated, f, indent=2)

    print(f"Migrated {len(migrated)} units -> {out}")


if __name__ == "__main__":
    main()
