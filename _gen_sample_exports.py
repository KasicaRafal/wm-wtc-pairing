import json
from datetime import datetime, timezone
from pathlib import Path
import random

ROOT = Path(__file__).parent
TEAM_ID = "Australia Fairy Penguins"
OUT = ROOT / "samples" / "fairy-penguins"

data = json.loads((ROOT / "data" / "teams.json").read_text(encoding="utf-8"))
teams = data["teams"]
our = next(t for t in teams if t["id"] == TEAM_ID)
opponents = [p for t in teams if t["id"] != TEAM_ID for p in t["players"]]

# Complementary biases so pairings have a clear "best" assignment.
# Values are added to a base of 6, then jittered.
ARMY_BIAS = {
    "Brian Woods": {
        "Grymkin": 3,
        "Khador": 2,
        "Orgoth": 2,
        "Cygnar": -2,
        "Khymaera": -2,
        "Mercenaries": -1,
        "Dusk": 1,
    },
    "Tony Javelin Dijkstra": {
        "Khymaera": 3,
        "Cygnar": 2,
        "Southern Kriels": 2,
        "Grymkin": -3,
        "Khador": -2,
        "Cryx": -1,
        "Dusk": 1,
    },
    "CaptBooyah - Mitch": {
        "Cygnar": 3,
        "Convergence of Cyriss": 2,
        "Three Crown Alliance": 2,
        "Dusk": -2,
        "Orgoth": -2,
        "Khador": 1,
        "Mercenaries": -1,
    },
    "Rafal Kasica": {
        "Dusk": 3,
        "Mercenaries": 2,
        "Cryx": 2,
        "Southern Kriels": -3,
        "Grymkin": -2,
        "Orgoth": 1,
        "Khador": -1,
    },
    "Shane War Daddy Germain": {
        "Khador": 3,
        "Orgoth": 2,
        "Southern Kriels": 2,
        "Dusk": -3,
        "Cygnar": -2,
        "Khymaera": 1,
        "Grymkin": -1,
    },
}


def slug(value: str) -> str:
    import unicodedata
    import re

    n = unicodedata.normalize("NFD", value)
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    n = re.sub(r"[^a-zA-Z0-9]+", "_", n).strip("_")
    return n[:60]


OUT.mkdir(parents=True, exist_ok=True)
exported_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

for player in our["players"]:
    rng = random.Random(f"wtc-sample|{player['id']}")
    biases = ARMY_BIAS[player["name"]]
    ratings = {}
    for opp in opponents:
        army = opp.get("army") or (opp.get("faction") or "").split(" - ")[0]
        bias = biases.get(army, 0)
        score = 6 + bias + rng.choice([-1, 0, 0, 0, 1])
        ratings[opp["id"]] = max(1, min(10, score))

    payload = {
        "version": 1,
        "type": "wtc-matchup-ratings",
        "team": our["name"],
        "teamId": our["id"],
        "player": player["name"],
        "playerId": player["id"],
        "faction": player["faction"],
        "exportedAt": exported_at,
        "sample": True,
        "ratings": ratings,
    }
    filename = f"wtc-ratings-{slug(our['name'])}-{slug(player['name'])}.json"
    (OUT / filename).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{filename}  ({len(ratings)} ratings)")

print(f"Wrote {len(our['players'])} files -> {OUT}")
